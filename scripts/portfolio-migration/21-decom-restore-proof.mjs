#!/usr/bin/env node
/**
 * 21-decom-restore-proof.mjs - Phase 7 restore proof (DECOM-02, D-07).
 *
 * Decrypts the final ziko archive, wipes the SCRATCH project completely, restores ziko data into
 * it and verifies the restored state against frozen ziko and the archive manifest with no sampling.
 *
 * SAFETY (hard lock): every mode targets only the scratch project. The ref comes from
 * DECOM_REFS.scratch, the Management API name must equal EXPECTED_NAMES.scratch, and --confirm-ref
 * must equal the scratch ref. There is no --project-ref flag; ziko and portfolio are refused before
 * any network call. The wipe code (schema drop, user truncate, bucket empty/delete) lives only in
 * this file and takes no ref argument. Do not import this file from 08/09 (lib-storage
 * findDeleteCalls guards the copy scripts).
 *
 * Modes: --wipe | --restore | --verify | --all (wipe -> restore -> verify, stop at first failure)
 *
 * Archive contract (written by the backup CLI): db/full.dump (pg_dump -Fc public+auth),
 * copy/auth.users.copy and copy/auth.identities.copy (COPY text layer), storage/<bucket>/<name>,
 * storage-manifest.json ({buckets:[{id,public,file_size_limit,allowed_mime_types}],
 * objects:[{bucket,name,sha256,mimetype,cache_control}]}), manifest.json (buildManifest output;
 * optional rls_tables and copy_columns), checksums.sha256.
 *
 * Auth method (stated honestly in the report): GoTrue DDL is not replayed over the live auth
 * schema. auth.users and auth.identities are loaded from the COPY layer with triggers off and
 * proven by non-volatile column fingerprints.
 *
 * Exit codes: 0 ok | 1 refused or failed | 2 bad args. Output is PII-free.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import copyStreams from 'pg-copy-streams';
import { createClient } from '@supabase/supabase-js';
import {
  VOLATILE_AUTH_IDENTITY_COLUMNS,
  VOLATILE_AUTH_USER_COLUMNS,
  getProjectApiKeys,
  isMain,
  loadAccessToken,
  parseCliArgs,
  redactPii,
} from '../auth-merge/lib.mjs';
import { assertReportSafe, evaluateOrphans } from './lib-verify.mjs';
import { createLoginRole, connectClient, deleteLoginRoles, getSessionPooler, parentRoleOf, redactSecrets } from './lib-conn.mjs';
import { maskObjectKey, sha256Hex } from './lib-storage.mjs';
import { BUCKET_LIST_SQL, buildObjectListSql, downloadBuffer, mapPool, uploadObject, withRetry } from './lib-decom-storage.mjs';
import { buildPgEnv, decryptArchive } from './20-decom-backup.mjs';
import {
  DECOM_REFS,
  EXPECTED_NAMES,
  REPO_ROOT,
  assertCommittedSafe,
  assertOutsideRepo,
  assertScratchWriteAllowed,
  recordGate,
} from './18-decom-guard.mjs';

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const q = (name) => `"${name}"`;

function ident(name, what = 'identifier') {
  if (typeof name !== 'string' || !IDENT_RE.test(name)) throw new Error(`invalid ${what}: ${JSON.stringify(String(name).slice(0, 40))}`);
  return name;
}

const ok = (detail, data = null) => ({ ok: true, detail, data });
const fail = (detail, data = null) => ({ ok: false, detail, data });

// ---------------------------------------------------------------- wipe

/** Fixed statement set (snapshot-tested). Scratch only: nothing here takes a project ref. */
export function buildWipeSql() {
  return [
    'DROP SCHEMA IF EXISTS public CASCADE;',
    'CREATE SCHEMA public;',
    'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;',
    'TRUNCATE auth.users CASCADE;',
  ].join('\n');
}

export const EMPTY_COUNTS_SQL = `SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')::int AS public_tables,
  (SELECT count(*) FROM auth.users)::int AS auth_users,
  (SELECT count(*) FROM auth.identities)::int AS auth_identities,
  (SELECT count(*) FROM storage.buckets)::int AS buckets,
  (SELECT count(*) FROM storage.objects)::int AS objects`;

const EMPTY_KEYS = ['publicTables', 'authUsers', 'authIdentities', 'buckets', 'objects'];

/** ok only when every count is a number equal to 0 (missing counts are not "empty"). */
export function evaluateEmpty(counts = {}) {
  const nonEmpty = [];
  const data = {};
  for (const k of EMPTY_KEYS) {
    const n = Number(counts[k]);
    data[k] = Number.isFinite(n) ? n : null;
    if (!Number.isFinite(n) || n !== 0) nonEmpty.push(k);
  }
  const good = nonEmpty.length === 0;
  return { ok: good, detail: good ? 'scratch is empty' : `not empty: ${nonEmpty.join(', ')}`, data };
}

// ---------------------------------------------------------------- pg_restore stderr

const TOLERATED = [
  ['unrecognized-configuration-parameter', /unrecognized configuration parameter/i],
  ['must-be-owner-of-extension', /must be owner of extension/i],
  ['already-exists', /(extension|schema|role) "[^"]*" already exists/i],
];

/** Splits pg_restore stderr into tolerated server-version noise and fatal lines. */
export function classifyRestoreErrors(stderrText) {
  const counts = new Map();
  const fatal = [];
  for (const raw of String(stderrText ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (line === '') continue;
    const isError = /\bERROR:/.test(line) || /\bFATAL:/.test(line) || /^pg_restore: error:/.test(line);
    if (!isError) continue; // Command was:, warnings, from TOC entry context, summary
    const hit = /\bERROR:/.test(line) ? TOLERATED.find(([, re]) => re.test(line)) : undefined;
    if (hit) counts.set(hit[0], (counts.get(hit[0]) ?? 0) + 1);
    else fatal.push(redactPii(line).slice(0, 300));
  }
  return { tolerated: [...counts].map(([kind, count]) => ({ kind, count })), fatal };
}

// ---------------------------------------------------------------- digests (identical SQL on ziko and scratch)

/** Per public table: count and md5 over the sorted row md5s. Identical SQL runs on both sides. */
export function buildTableDigestSql(tables) {
  if (!Array.isArray(tables) || tables.length === 0) throw new Error('buildTableDigestSql needs at least one table');
  return tables
    .map((t) => {
      ident(t, 'table');
      return (
        `SELECT '${t}' AS tbl, count(*)::bigint AS n, ` +
        `md5(coalesce(string_agg(md5(t::text), '' ORDER BY md5(t::text)), '')) AS digest FROM public.${q(t)} t`
      );
    })
    .join('\nUNION ALL\n');
}

const AUTH_VOLATILE = { users: VOLATILE_AUTH_USER_COLUMNS, identities: VOLATILE_AUTH_IDENTITY_COLUMNS };

/** Non-volatile column fingerprint of an auth table: only a count and a digest leave the database. */
export function buildAuthFingerprintSql(table) {
  if (!Object.hasOwn(AUTH_VOLATILE, table)) throw new Error(`auth table not allowed: ${String(table).slice(0, 20)}`);
  const cols = AUTH_VOLATILE[table].map((c) => `'${ident(c, 'column')}'`).join(', ');
  return (
    `SELECT 'auth.${table}' AS tbl, count(*)::bigint AS n, ` +
    `md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS digest ` +
    `FROM (SELECT md5((to_jsonb(t) - ARRAY[${cols}]::text[])::text) AS h FROM auth.${q(table)} t) s`
  );
}

const sortedNames = (set) => [...set].sort();

/** source/target: arrays of {tbl, n, digest}. Fails on any missing table, count or digest difference. */
export function evaluateSameName({ source, target } = {}) {
  const s = new Map((source ?? []).map((r) => [r.tbl, r]));
  const t = new Map((target ?? []).map((r) => [r.tbl, r]));
  if (s.size === 0) return fail('no tables on the source side (vacuous)', { tables: 0 });
  const missingOnTarget = sortedNames([...s.keys()].filter((k) => !t.has(k)));
  const missingOnSource = sortedNames([...t.keys()].filter((k) => !s.has(k)));
  const countDiff = [];
  const digestDiff = [];
  for (const [k, a] of s) {
    const b = t.get(k);
    if (!b) continue;
    if (String(a.n) !== String(b.n)) countDiff.push(k);
    else if (String(a.digest) !== String(b.digest)) digestDiff.push(k);
  }
  countDiff.sort();
  digestDiff.sort();
  const good = !missingOnTarget.length && !missingOnSource.length && !countDiff.length && !digestDiff.length;
  const parts = [];
  if (missingOnTarget.length) parts.push(`missing on target: ${missingOnTarget.join(', ')}`);
  if (missingOnSource.length) parts.push(`missing on source: ${missingOnSource.join(', ')}`);
  if (countDiff.length) parts.push(`count differs: ${countDiff.join(', ')}`);
  if (digestDiff.length) parts.push(`row digest differs: ${digestDiff.join(', ')}`);
  return {
    ok: good,
    detail: good ? `${s.size} tables equal (count and row md5)` : parts.join('; '),
    data: { tables: s.size, missingOnTarget, missingOnSource, countDiff, digestDiff },
  };
}

// ---------------------------------------------------------------- inventory

const pick = (row, ...keys) => {
  for (const k of keys) if (row?.[k] !== undefined && row[k] !== null) return row[k];
  return undefined;
};
const inPublic = (row) => {
  const s = pick(row, 'schemaname', 'nspname', 'table_schema', 'schema');
  return s === undefined || s === 'public';
};

function groupNames(rows, tableKeys, nameKeys) {
  const out = new Map();
  for (const r of rows ?? []) {
    if (!inPublic(r)) continue;
    const t = pick(r, ...tableKeys);
    const n = pick(r, ...nameKeys);
    if (t === undefined) continue;
    if (!out.has(t)) out.set(t, []);
    if (n !== undefined) out.get(t).push(String(n));
  }
  for (const v of out.values()) v.sort();
  return out;
}

export function normalizeInventory({ rls, rlsTables, policies, triggers, functions } = {}) {
  let rlsSet = null;
  if (Array.isArray(rlsTables)) rlsSet = new Set(rlsTables.map(String));
  else if (Array.isArray(rls)) rlsSet = new Set(rls.filter((r) => r.relrowsecurity === true).map((r) => String(r.relname)));
  return {
    rls: rlsSet,
    policies: groupNames(policies, ['tablename', 'table', 'relname'], ['policyname', 'name']),
    triggers: groupNames(triggers, ['relname', 'table', 'tablename'], ['tgname', 'name']),
    functions: new Set(
      (functions ?? []).filter(inPublic).map((f) => String(pick(f, 'proname', 'name'))),
    ),
  };
}

function diffGrouped(a, b) {
  const out = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (JSON.stringify(a.get(k) ?? []) !== JSON.stringify(b.get(k) ?? [])) out.push(k);
  }
  return out.sort();
}

const symDiff = (a, b) => sortedNames([...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x))));

/**
 * manifest: manifest.json shape (policies, triggers, functions rows, optional rls_tables names);
 * live: {rls, policies, triggers, functions} rows read from the database under test.
 * Compares the RLS-enabled set (when the manifest carries it), policy names per table,
 * trigger names per table and public function names.
 */
export function evaluateInventory({ manifest, live } = {}) {
  const m = normalizeInventory({
    rlsTables: manifest?.rls_tables,
    policies: manifest?.policies,
    triggers: manifest?.triggers,
    functions: manifest?.functions,
  });
  const l = normalizeInventory(live);
  const rlsCompared = m.rls !== null && l.rls !== null;
  const rlsDiff = rlsCompared ? symDiff(m.rls, l.rls) : [];
  const policyDiff = diffGrouped(m.policies, l.policies);
  const triggerDiff = diffGrouped(m.triggers, l.triggers);
  const functionDiff = symDiff(m.functions, l.functions);
  const good = !rlsDiff.length && !policyDiff.length && !triggerDiff.length && !functionDiff.length;
  const parts = [];
  if (rlsDiff.length) parts.push(`RLS differs: ${rlsDiff.join(', ')}`);
  if (policyDiff.length) parts.push(`policies differ: ${policyDiff.join(', ')}`);
  if (triggerDiff.length) parts.push(`triggers differ: ${triggerDiff.join(', ')}`);
  if (functionDiff.length) parts.push(`functions differ: ${functionDiff.join(', ')}`);
  return {
    ok: good,
    detail: good
      ? `inventory equal (${m.functions.size} functions, ${m.policies.size} policy tables, ${m.triggers.size} trigger tables${rlsCompared ? '' : ', RLS set not in manifest'})`
      : parts.join('; '),
    data: { rlsCompared, rlsDiff, policyDiff, triggerDiff, functionDiff },
  };
}

// ---------------------------------------------------------------- object hashes

const objKey = (o) => `${o.bucket}\u0000${o.name}`;
const hashMap = (list) => new Map((list ?? []).map((o) => [objKey(o), o]));
const maskList = (entries, limit = 20) => entries.slice(0, limit).map((o) => maskObjectKey(o.bucket, o.name));

/** archiveManifest, scratchHashes, zikoHashes: arrays of {bucket, name, sha256}. Names are masked in output. */
export function evaluateObjectHashes({ archiveManifest, scratchHashes, zikoHashes } = {}) {
  const a = hashMap(archiveManifest);
  const s = hashMap(scratchHashes);
  const z = hashMap(zikoHashes);
  if (a.size === 0) return fail('archive manifest lists no objects (vacuous)', { checked: 0 });
  const missingOnScratch = [];
  const missingOnZiko = [];
  const mismatch = [];
  for (const [k, o] of a) {
    const so = s.get(k);
    const zo = z.get(k);
    if (!so) missingOnScratch.push(o);
    if (!zo) missingOnZiko.push(o);
    if ((so && so.sha256 !== o.sha256) || (zo && zo.sha256 !== o.sha256)) mismatch.push(o);
  }
  const extraOnScratch = [...s].filter(([k]) => !a.has(k)).map(([, o]) => o);
  const extraOnZiko = [...z].filter(([k]) => !a.has(k)).map(([, o]) => o);
  const good = ![missingOnScratch, missingOnZiko, mismatch, extraOnScratch, extraOnZiko].some((l) => l.length);
  const parts = [];
  if (missingOnScratch.length) parts.push(`${missingOnScratch.length} missing on scratch`);
  if (missingOnZiko.length) parts.push(`${missingOnZiko.length} missing on ziko`);
  if (mismatch.length) parts.push(`${mismatch.length} sha256 mismatch`);
  if (extraOnScratch.length) parts.push(`${extraOnScratch.length} extra on scratch`);
  if (extraOnZiko.length) parts.push(`${extraOnZiko.length} not in archive manifest (on ziko)`);
  return {
    ok: good,
    detail: good ? `${a.size} objects: sha256 equal across archive, scratch and ziko` : parts.join('; '),
    data: {
      checked: a.size,
      missingOnScratch: maskList(missingOnScratch),
      missingOnZiko: maskList(missingOnZiko),
      mismatch: maskList(mismatch),
      extraOnScratch: maskList(extraOnScratch),
      extraOnZiko: maskList(extraOnZiko),
    },
  };
}

// ---------------------------------------------------------------- report

export const AUTH_METHOD = 'data-restore + fingerprint (GoTrue DDL not replayed)';

export const DEVIATIONS = Object.freeze([
  'D-07 wording deviation: 06-verify-data and 09-verify-storage are bound to the ziko_ table prefix and the uuid remap (parseRemapFile rejects identity remaps), so they cannot run on an unprefixed raw restore. Same-name evaluators replace them: per-table count and row md5 vs frozen ziko, RLS/policy/trigger/function inventory vs the manifest, FK validation with orphan counts, and per-object sha256 across archive, scratch and ziko.',
  'Auth proof is by data restore plus non-volatile column fingerprints; the GoTrue schema DDL is not replayed over the live auth schema of the scratch project.',
]);

const safeText = (s) => redactPii(String(s ?? '')).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (u) => `${u.slice(0, 8)}-...`).slice(0, 600);

/** checks: {name: {ok, detail, data}}. Throws if anything PII- or secret-shaped is present. */
export function buildRestoreReport({ checks = {}, counts = null } = {}) {
  const out = {};
  for (const [name, c] of Object.entries(checks)) out[name] = { ok: c.ok === true, detail: safeText(c.detail), data: c.data ?? null };
  const report = {
    generated_at: new Date().toISOString(),
    target: 'scratch',
    passed: Object.keys(out).length > 0 && Object.values(out).every((c) => c.ok),
    auth_method: AUTH_METHOD,
    deviations: [...DEVIATIONS],
    counts,
    checks: out,
  };
  assertReportSafe(report);
  assertCommittedSafe(report);
  return report;
}
