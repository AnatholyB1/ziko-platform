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
import { SOURCE_BUCKET_RE, maskObjectKey, sha256Hex } from './lib-storage.mjs';
import { BUCKET_LIST_SQL, buildObjectListSql, downloadBuffer, mapPool, uploadObject } from './lib-decom-storage.mjs';
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

// ---------------------------------------------------------------- inventory / FK SQL (public schema, unprefixed)

const TABLE_LIST_SQL =
  "SELECT table_name AS tbl FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name";
const RLS_ALL_SQL =
  "SELECT c.relname, c.relrowsecurity FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') ORDER BY c.relname";
const POLICIES_SQL = "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname";
// names only: trigger definitions can embed secrets
const TRIGGERS_SQL = `SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace ORDER BY c.relname, t.tgname`;
const FUNCTIONS_SQL = "SELECT p.proname FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY p.proname";
const PUBLIC_FK_SQL = `SELECT c.conname, r.relname AS child, pn.nspname AS parent_schema, pr.relname AS parent_table,
  (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS child_cols,
  (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS parent_cols,
  c.convalidated
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN pg_class pr ON pr.oid = c.confrelid
JOIN pg_namespace pn ON pn.oid = pr.relnamespace
WHERE c.contype = 'f' AND r.relnamespace = 'public'::regnamespace
ORDER BY r.relname, c.conname`;

/** Orphan count for one FK of the unprefixed public schema (parent may be public or auth.users). */
export function buildPublicOrphanSql(fk) {
  ident(fk.conname, 'constraint');
  ident(fk.child, 'child table');
  if (fk.parent_schema !== 'public' && fk.parent_schema !== 'auth') throw new Error('unsupported parent schema');
  ident(fk.parent_table, 'parent table');
  if (!Array.isArray(fk.child_cols) || !Array.isArray(fk.parent_cols) || fk.child_cols.length === 0 || fk.child_cols.length !== fk.parent_cols.length) {
    throw new Error('FK column arrays invalid');
  }
  const notNull = fk.child_cols.map((c) => `c.${q(ident(c, 'column'))} IS NOT NULL`).join(' AND ');
  const join = fk.child_cols.map((c, i) => `p.${q(ident(fk.parent_cols[i], 'column'))} = c.${q(c)}`).join(' AND ');
  return `SELECT '${fk.conname}' AS conname, count(*)::bigint AS orphans FROM public.${q(fk.child)} c WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM ${q(fk.parent_schema)}.${q(fk.parent_table)} p WHERE ${join})`;
}

/** Scratch FKs must be validated, non-empty and the same count as frozen ziko. */
export function evaluatePublicFks({ scratch, ziko }) {
  const s = scratch ?? [];
  const unvalidated = s.filter((f) => f.convalidated !== true).map((f) => f.conname).sort();
  const problems = [];
  if (s.length === 0) problems.push('FK discovery returned 0 constraints');
  if (ziko && s.length !== ziko.length) problems.push(`FK count ${s.length} differs from ziko ${ziko.length}`);
  if (unvalidated.length) problems.push(`${unvalidated.length} unvalidated constraints`);
  const good = problems.length === 0;
  return { ok: good, detail: good ? `${s.length} FK constraints, all validated, count equals ziko` : problems.join('; '), data: { fkCount: s.length, zikoFkCount: ziko?.length ?? null, unvalidated } };
}

// ---------------------------------------------------------------- CLI

const SPEC = {
  wipe: 'boolean',
  restore: 'boolean',
  verify: 'boolean',
  all: 'boolean',
  archive: 'string',
  'passphrase-file': 'string',
  'confirm-ref': 'string',
  'json-out': 'string',
  'record-gate': 'boolean',
  'ca-file': 'string',
};

const HELP = `Usage: node scripts/portfolio-migration/21-decom-restore-proof.mjs <mode> --confirm-ref <scratch ref>
  --wipe [--json-out <report>]                        empty the scratch project (public, auth, storage)
  --restore --archive <p> --passphrase-file <p>       restore the archive into an EMPTY scratch project
  --verify  --archive <p> --passphrase-file <p> --json-out <report> [--record-gate]
  --all     (same args as --verify)                   wipe -> restore -> verify, stop at first failure
  --ca-file <path>                                    TLS CA (default .ca/supabase-ca.crt when present)
Scratch is the only writable project. ziko is read-only (verify only). portfolio is never touched.`;

const API_BASE = 'https://api.supabase.com';
const RESTORE_CONCURRENCY = 4;
const DUMP_FILE = 'db/full.dump';

function defaultDeps() {
  return {
    loadToken: loadAccessToken,
    fetchImpl: (...a) => fetch(...a),
    connect: connectClient,
    loginRole: async (ref, { token, fetchImpl }) => {
      const { role, password } = await createLoginRole(ref, {}, { token, fetchImpl });
      const { host, port } = await getSessionPooler(ref, { token, fetchImpl });
      return { role, password, host, port };
    },
    deleteRoles: deleteLoginRoles,
    getKeys: getProjectApiKeys,
    storageFactory: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    runner: (cmd, args, { env } = {}) =>
      spawnSync(cmd, args, { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }),
    copyIn: async (client, sql, file) => {
      await pipeline(createReadStream(file), client.query(copyStreams.from(sql)));
    },
    decrypt: decryptArchive,
    recordGate,
    readFile: (p, enc) => readFile(p, enc),
    writeFile: (p, t) => writeFile(p, t, 'utf8'),
    rm: (p) => rm(p, { recursive: true, force: true }),
    mkdir: (p) => mkdir(p, { recursive: true }),
    fileExists: async (p) => {
      try {
        await readFile(p);
        return true;
      } catch {
        return false;
      }
    },
    tmpdir: tmpdir(),
    repoRoot: REPO_ROOT,
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
  };
}

const rowsOf = async (client, sql, params) => (await (params ? client.query(sql, params) : client.query(sql))).rows ?? [];

function toEmptyCounts(r = {}) {
  return {
    publicTables: r.public_tables,
    authUsers: r.auth_users,
    authIdentities: r.auth_identities,
    buckets: r.buckets,
    objects: r.objects,
  };
}

async function gatherEmpty(client) {
  return toEmptyCounts((await rowsOf(client, EMPTY_COUNTS_SQL))[0]);
}

async function scratchSql(ctx) {
  if (!ctx.scratch) {
    ctx.touched.add(DECOM_REFS.scratch);
    const { client } = await ctx.deps.connect(DECOM_REFS.scratch, { readOnly: false, token: ctx.token, caPem: ctx.caPem });
    ctx.scratch = client;
    ctx.opened.push(client);
  }
  return ctx.scratch;
}

/** ziko is opened read-only and only ever receives SELECT statements. */
async function zikoSql(ctx) {
  if (!ctx.ziko) {
    ctx.touched.add(DECOM_REFS.ziko);
    const { client } = await ctx.deps.connect(DECOM_REFS.ziko, { readOnly: true, token: ctx.token, caPem: ctx.caPem });
    ctx.ziko = client;
    ctx.opened.push(client);
  }
  return ctx.ziko;
}

async function scratchStorage(ctx) {
  if (!ctx.scratchStorage) {
    const keys = await ctx.deps.getKeys(DECOM_REFS.scratch);
    ctx.scratchSecret = keys.secret;
    ctx.secrets.push(keys.secret);
    ctx.scratchUrl = `https://${DECOM_REFS.scratch}.supabase.co`;
    ctx.scratchStorage = ctx.deps.storageFactory(ctx.scratchUrl, keys.secret);
  }
  return ctx.scratchStorage;
}

async function zikoStorage(ctx) {
  if (!ctx.zikoStorage) {
    const keys = await ctx.deps.getKeys(DECOM_REFS.ziko);
    ctx.secrets.push(keys.secret);
    ctx.zikoStorage = ctx.deps.storageFactory(`https://${DECOM_REFS.ziko}.supabase.co`, keys.secret);
  }
  return ctx.zikoStorage;
}

function assertWriteContext(ctx) {
  assertScratchWriteAllowed({ ref: DECOM_REFS.scratch, confirmRef: ctx.confirmRef });
  if (ctx.nameVerified !== true) throw new Error('Refusing to write: scratch project name was not verified');
}

// ---- wipe (scratch only; no ref parameter anywhere in this function)

async function wipeScratch(ctx) {
  assertWriteContext(ctx);
  const client = await scratchSql(ctx);
  const sc = await scratchStorage(ctx);
  await client.query(buildWipeSql());
  const { data: buckets, error } = await sc.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  for (const b of buckets ?? []) {
    const e1 = (await sc.storage.emptyBucket(b.id)).error;
    if (e1) throw new Error(`emptyBucket failed: ${e1.message}`);
    // emptyBucket is batched/asynchronous server side: when the bucket is still reported
    // non-empty, empty it again and retry the delete (bounded) before failing.
    let e2 = (await sc.storage.deleteBucket(b.id)).error;
    for (let i = 0; e2 && /not empty/i.test(e2.message) && i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const e3 = (await sc.storage.emptyBucket(b.id)).error;
      if (e3) throw new Error(`emptyBucket failed: ${e3.message}`);
      e2 = (await sc.storage.deleteBucket(b.id)).error;
    }
    if (e2) throw new Error(`deleteBucket failed: ${e2.message}`);
  }
  const ev = evaluateEmpty(await gatherEmpty(client));
  if (!ev.ok) throw new Error(`wipe incomplete: ${ev.detail}`);
  return ev;
}

async function assertScratchEmpty(ctx) {
  const client = await scratchSql(ctx);
  const ev = evaluateEmpty(await gatherEmpty(client));
  if (!ev.ok) throw new Error(`refusing restore, scratch ${ev.detail}`);
}

// ---- archive

async function withArchive(ctx, args, fn) {
  const { deps } = ctx;
  const passphrase = String(await deps.readFile(resolve(args.passphraseFile), 'utf8')).trim();
  ctx.secrets.push(passphrase);
  const dir = join(deps.tmpdir, `ziko-restore-proof-${randomBytes(6).toString('hex')}`);
  assertOutsideRepo(dir, deps.repoRoot);
  try {
    const res = await deps.decrypt({ archivePath: resolve(args.archive), outDir: dir, passphrase });
    if (!res?.ok) {
      const bad = [...(res?.tampered ?? []), ...(res?.missing ?? []), ...(res?.unlisted ?? [])].slice(0, 10);
      throw new Error(`archive checksum verification failed${res?.error ? ` (${res.error})` : ''}${bad.length ? `: ${bad.join(', ')}` : ''}`);
    }
    return await fn(dir);
  } finally {
    await deps.rm(dir);
  }
}

async function readJson(ctx, dir, rel) {
  return JSON.parse(await ctx.deps.readFile(join(dir, rel), 'utf8'));
}

function storagePath(dir, bucket, name) {
  if (!SOURCE_BUCKET_RE.test(String(bucket))) throw new Error('invalid bucket id in storage manifest');
  const parts = String(name).split('/');
  if (parts.some((p) => p === '..' || p === '') || isAbsolute(name) || /^[A-Za-z]:/.test(name)) throw new Error('unsafe object name in storage manifest');
  const base = resolve(dir, 'storage');
  const full = resolve(base, bucket, ...parts);
  if (!full.startsWith(base + sep)) throw new Error('object path escapes the archive');
  return full;
}

// ---- restore

async function loadAuthData(ctx, dir, manifest) {
  const client = await scratchSql(ctx);
  const copyColumns = manifest?.copy_columns ?? {};
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL session_replication_role = replica');
    const r = await rowsOf(client, "SELECT current_setting('session_replication_role') AS v");
    if (r[0]?.v !== 'replica') throw new Error('replica role not in effect; refusing to load auth data with triggers on');
    for (const t of ['users', 'identities']) {
      let cols = copyColumns[`auth.${t}`];
      if (!Array.isArray(cols)) {
        cols = (
          await rowsOf(
            client,
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = $1 AND is_generated = 'NEVER' ORDER BY ordinal_position",
            [t],
          )
        ).map((x) => x.column_name);
      }
      if (cols.length === 0) throw new Error(`no columns resolved for auth.${t}`);
      const list = cols.map((c) => q(ident(c, 'column'))).join(', ');
      await ctx.deps.copyIn(client, `COPY auth.${q(t)} (${list}) FROM STDIN`, join(dir, 'copy', `auth.${t}.copy`));
    }
    const c = (await rowsOf(client, 'SELECT (SELECT count(*) FROM auth.users)::int AS u, (SELECT count(*) FROM auth.identities)::int AS i'))[0];
    if (!(Number(c?.u) > 0)) throw new Error('auth.users is empty after the COPY load');
    await client.query('COMMIT');
    return { users: Number(c.u), identities: Number(c.i) };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

async function restorePublic(ctx, dir) {
  const { deps } = ctx;
  const lr = await deps.loginRole(DECOM_REFS.scratch, { token: ctx.token, fetchImpl: deps.fetchImpl });
  ctx.touched.add(DECOM_REFS.scratch);
  ctx.secrets.push(lr.password);
  const env = buildPgEnv({
    host: lr.host,
    port: lr.port,
    user: `${lr.role}.${DECOM_REFS.scratch}`,
    password: lr.password,
    sslRootCert: ctx.caFile,
  });
  const args = ['--no-owner', `--role=${parentRoleOf(lr.role)}`, '--schema=public', '-d', 'postgres', join(dir, DUMP_FILE)];
  const r = await deps.runner('pg_restore', args, { env });
  if (r?.error) throw new Error(`pg_restore could not run: ${r.error.message}`);
  const cls = classifyRestoreErrors(r?.stderr);
  if (cls.fatal.length > 0 || (r?.status !== 0 && cls.tolerated.length === 0)) {
    throw new Error(`pg_restore failed (status ${r?.status}): ${cls.fatal.slice(0, 5).join(' | ') || 'no error lines'}`);
  }
  return cls.tolerated;
}

async function restoreStorage(ctx, dir) {
  const sm = await readJson(ctx, dir, 'storage-manifest.json');
  const sc = await scratchStorage(ctx);
  for (const b of sm.buckets ?? []) {
    if (!SOURCE_BUCKET_RE.test(String(b.id))) throw new Error('invalid bucket id in storage manifest');
    const opts = { public: b.public === true };
    if (b.file_size_limit !== null && b.file_size_limit !== undefined) opts.fileSizeLimit = Number(b.file_size_limit);
    if (Array.isArray(b.allowed_mime_types)) opts.allowedMimeTypes = b.allowed_mime_types;
    const { error } = await sc.storage.createBucket(b.id, opts);
    if (error) throw new Error(`createBucket failed: ${error.message}`);
  }
  const objects = sm.objects ?? [];
  const up = { client: sc, url: ctx.scratchUrl, secret: ctx.scratchSecret, fetchImpl: ctx.deps.fetchImpl };
  await mapPool(objects, RESTORE_CONCURRENCY, async (o) => {
    const buf = Buffer.from(await ctx.deps.readFile(storagePath(dir, o.bucket, o.name)));
    if (o.sha256 && sha256Hex(buf) !== o.sha256) throw new Error(`archive object failed sha256 re-check: ${maskObjectKey(o.bucket, o.name)}`);
    await uploadObject(up, o.bucket, o.name, buf, { mimetype: o.mimetype, cacheControl: o.cache_control });
  });
  return objects.length;
}

async function restoreScratch(ctx, dir) {
  assertWriteContext(ctx);
  ctx.deps.log('restore: auth.users and auth.identities from the COPY layer');
  const manifest = await readJson(ctx, dir, 'manifest.json');
  const auth = await loadAuthData(ctx, dir, manifest);
  ctx.deps.log('restore: public schema via pg_restore');
  const tolerated = await restorePublic(ctx, dir);
  ctx.deps.log('restore: storage buckets and objects');
  const uploaded = await restoreStorage(ctx, dir);
  const client = await scratchSql(ctx);
  const after = await gatherEmpty(client);
  const problems = [];
  if (!(Number(after.publicTables) > 0)) problems.push('no public tables after restore');
  if (!(Number(after.authUsers) > 0)) problems.push('no auth users after restore');
  if (!(uploaded > 0)) problems.push('archive holds no objects (vacuous storage proof)');
  else if (Number(after.objects) !== uploaded) problems.push(`object count ${after.objects} differs from ${uploaded} uploaded`);
  if (problems.length) throw new Error(`restore proof is vacuous or incomplete: ${problems.join('; ')}`);
  return { auth, tolerated, tables: Number(after.publicTables), objects: uploaded };
}

// ---- verify

async function inventoryRows(client) {
  return {
    rls: await rowsOf(client, RLS_ALL_SQL),
    policies: await rowsOf(client, POLICIES_SQL),
    triggers: await rowsOf(client, TRIGGERS_SQL),
    functions: await rowsOf(client, FUNCTIONS_SQL),
  };
}

async function digestSide(client) {
  const tables = (await rowsOf(client, TABLE_LIST_SQL)).map((r) => r.tbl);
  const rows = tables.length ? await rowsOf(client, buildTableDigestSql(tables)) : [];
  const auth = [];
  for (const t of ['users', 'identities']) auth.push(...(await rowsOf(client, buildAuthFingerprintSql(t))));
  return { tables: rows, auth };
}

async function hashObjects(ctx, storageClient, sqlClient, bucketIds) {
  if (bucketIds.length === 0) return [];
  const list = await rowsOf(sqlClient, buildObjectListSql(bucketIds));
  return mapPool(list, RESTORE_CONCURRENCY, async (o) => {
    const buf = await downloadBuffer(storageClient, o.bucket_id, o.name);
    return { bucket: o.bucket_id, name: o.name, sha256: sha256Hex(buf) };
  });
}

async function verifyScratch(ctx, dir) {
  const manifest = await readJson(ctx, dir, 'manifest.json');
  const sm = await readJson(ctx, dir, 'storage-manifest.json');
  const sClient = await scratchSql(ctx);
  const zClient = await zikoSql(ctx);
  const checks = {};

  const z = await digestSide(zClient);
  const s = await digestSide(sClient);
  checks.tables = evaluateSameName({ source: z.tables, target: s.tables });
  checks.auth = evaluateSameName({ source: z.auth, target: s.auth });

  const sInv = await inventoryRows(sClient);
  checks.inventory_manifest = evaluateInventory({ manifest, live: sInv });
  const zInv = await inventoryRows(zClient);
  checks.inventory_ziko = evaluateInventory({
    manifest: {
      rls_tables: zInv.rls.filter((r) => r.relrowsecurity === true).map((r) => r.relname),
      policies: zInv.policies,
      triggers: zInv.triggers,
      functions: zInv.functions,
    },
    live: sInv,
  });

  const sFks = await rowsOf(sClient, PUBLIC_FK_SQL);
  const zFks = await rowsOf(zClient, PUBLIC_FK_SQL);
  checks.fks = evaluatePublicFks({ scratch: sFks, ziko: zFks });
  const orphanRows = [];
  for (const fk of sFks) orphanRows.push(...(await rowsOf(sClient, buildPublicOrphanSql(fk))));
  checks.orphans = evaluateOrphans(orphanRows);

  const bucketIds = (sm.buckets ?? []).map((b) => b.id);
  const scratchHashes = await hashObjects(ctx, await scratchStorage(ctx), sClient, bucketIds);
  const zikoHashes = await hashObjects(ctx, await zikoStorage(ctx), zClient, bucketIds);
  const archiveManifest = (sm.objects ?? []).map((o) => ({ bucket: o.bucket, name: o.name, sha256: o.sha256 }));
  checks.objects = evaluateObjectHashes({ archiveManifest, scratchHashes, zikoHashes });

  const counts = {
    tables: z.tables.length,
    auth_users: Number(z.auth.find((r) => r.tbl === 'auth.users')?.n ?? 0),
    objects: archiveManifest.length,
  };
  return buildRestoreReport({ checks, counts });
}

async function checkScratchName(ctx) {
  const { deps } = ctx;
  const res = await deps.fetchImpl(`${API_BASE}/v1/projects/${DECOM_REFS.scratch}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`scratch project lookup returned HTTP ${res.status}`);
  const json = await res.json();
  const idOk = json?.ref === undefined && json?.id === undefined ? false : (json.ref ?? json.id) === DECOM_REFS.scratch;
  if (json?.name !== EXPECTED_NAMES.scratch || !idOk) {
    throw new Error(`Refusing to write: project name/ref does not match the expected scratch project`);
  }
  ctx.nameVerified = true;
}

export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)) };
  const { log, errlog } = deps;
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    log(HELP);
    return 0;
  }
  const modeFlags = ['wipe', 'restore', 'verify', 'all'].filter((m) => args[m]);
  if (modeFlags.length !== 1) {
    errlog('ERROR: exactly one of --wipe, --restore, --verify, --all is required');
    return 2;
  }
  const mode = modeFlags[0];
  if (mode !== 'wipe' && (!args.archive || !args.passphraseFile)) {
    errlog('ERROR: --archive and --passphrase-file are required for this mode');
    return 2;
  }
  if ((mode === 'verify' || mode === 'all') && !args.jsonOut) {
    errlog('ERROR: --json-out is required for --verify and --all');
    return 2;
  }
  if (args.recordGate && mode !== 'verify' && mode !== 'all') {
    errlog('ERROR: --record-gate only applies to --verify or --all');
    return 2;
  }

  // Hard lock before any network call: scratch ref + matching confirm-ref only.
  try {
    assertScratchWriteAllowed({ ref: DECOM_REFS.scratch, confirmRef: args.confirmRef });
  } catch (e) {
    errlog(`ERROR: ${redactPii(e?.message ?? e)}`);
    return 1;
  }

  const ctx = { deps, confirmRef: args.confirmRef, secrets: [], opened: [], touched: new Set(), nameVerified: false };
  try {
    ctx.token = await deps.loadToken();
    ctx.secrets.push(ctx.token);
    await checkScratchName(ctx);

    ctx.caFile = args.caFile ? resolve(args.caFile) : join(deps.repoRoot, '.ca', 'supabase-ca.crt');
    if (await deps.fileExists(ctx.caFile)) ctx.caPem = await deps.readFile(ctx.caFile, 'utf8');
    else ctx.caFile = undefined;

    if (mode === 'wipe' || mode === 'all') {
      const wiped = await wipeScratch(ctx);
      log('wipe: scratch is empty');
      if (mode === 'wipe') {
        if (args.jsonOut) {
          const wipeReport = { kind: 'decom-restore-wipe', passed: wiped.ok, scratch_ref: DECOM_REFS.scratch, counts: wiped.data, checked_at: new Date().toISOString() };
          await deps.writeFile(resolve(args.jsonOut), `${JSON.stringify(wipeReport, null, 2)}
`);
        }
        return 0;
      }
    }

    if (mode === 'restore') {
      await assertScratchEmpty(ctx);
      const r = await withArchive(ctx, args, (dir) => restoreScratch(ctx, dir));
      log(`restore: ${r.tables} tables, ${r.auth.users} auth users, ${r.objects} objects (tolerated pg_restore noise: ${r.tolerated.map((t) => `${t.kind}=${t.count}`).join(', ') || 'none'})`);
      return 0;
    }

    let report;
    if (mode === 'verify') {
      report = await withArchive(ctx, args, (dir) => verifyScratch(ctx, dir));
    } else {
      report = await (async () => {
        await assertScratchEmpty(ctx);
        return withArchive(ctx, args, async (dir) => {
          const r = await restoreScratch(ctx, dir);
          log(`restore: ${r.tables} tables, ${r.auth.users} auth users, ${r.objects} objects`);
          return verifyScratch(ctx, dir);
        });
      })();
    }

    for (const [name, c] of Object.entries(report.checks)) log(`[${c.ok ? 'PASS' : 'FAIL'}] ${name}: ${c.detail}`);
    await deps.writeFile(resolve(args.jsonOut), `${JSON.stringify(report, null, 2)}\n`);
    log(report.passed ? 'RESTORE PROOF PASSED' : 'RESTORE PROOF FAILED');
    if (!report.passed) return 1;
    if (args.recordGate) {
      const rel = relative(deps.repoRoot, resolve(args.jsonOut));
      if (rel.startsWith('..') || isAbsolute(rel)) {
        errlog('ERROR: --record-gate needs --json-out inside the repository (evidence must be repo-relative)');
        return 1;
      }
      deps.recordGate('restore_proven', { evidence: rel.replaceAll('\\', '/') });
      log('gate recorded: restore_proven');
    }
    return 0;
  } catch (e) {
    errlog(`ERROR: ${redactSecrets(e?.message ?? e, ctx.secrets)}`);
    return 1;
  } finally {
    for (const c of ctx.opened) await Promise.resolve(c.end?.()).catch(() => {});
    for (const ref of ctx.touched) await deps.deleteRoles(ref, { token: ctx.token, fetchImpl: deps.fetchImpl });
    ctx.secrets.length = 0;
  }
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ERROR: ${redactPii(e?.message ?? e)}`);
      process.exit(1);
    },
  );
}
