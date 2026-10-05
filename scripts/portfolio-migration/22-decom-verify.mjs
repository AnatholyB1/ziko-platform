// Phase 7 plan 07-05 (DECOM-03): delta-aware verifier semantics, frozen ziko vs portfolio.
//
// Pure evaluators, SQL builders and the report builder only. The CLI that runs these live
// (together with the existing integrity/auth/tenant verifiers) arrives in plan 07-22.
//
// SAFETY: this module is read-only by construction. Every SQL builder emits a single SELECT.
// It never imports or invokes TRUNCATE-capable reload code (13-cutover-delta --apply,
// 05-load-data --apply). Details never carry PK values, digests, emails or object names:
// counts, table names and masked keys only (T-07-18).

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS, assertProjectRefFormat, getProjectApiKeys, isMain, parseCliArgs, redactPii, runSql } from '../auth-merge/lib.mjs';
import { EXPECTED_TABLE_COUNT, IDENT_RE, UUID_RE, buildTablePlan, loadRenameMap, parseRemapFile } from './lib-data.mjs';
import { SOURCE_BUCKET_RE, TARGET_BUCKET_RE, maskObjectKey, rekeyObjectName, sha256Hex, targetBucketId } from './lib-storage.mjs';
import { BUCKET_LIST_SQL, buildObjectListSql, downloadBuffer, mapPool } from './lib-decom-storage.mjs';
import { assertCommittedSafe, recordGate } from './18-decom-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const ok = (detail, extra = {}) => ({ ok: true, detail, ...extra });
const fail = (detail, extra = {}) => ({ ok: false, detail, ...extra });

const FLIP_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function ident(name, what) {
  if (typeof name !== 'string' || !IDENT_RE.test(name)) throw new Error(`invalid ${what} identifier`);
  return `"${name}"`;
}

function toMs(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (v instanceof Date) return v.getTime();
  return Date.parse(String(v));
}

function flipMs(flipAt) {
  const ms = toMs(flipAt);
  if (Number.isNaN(ms)) throw new Error('flipAt is not a valid timestamp');
  return ms;
}

function remapPk(pk, remap) {
  const s = String(pk);
  if (!remap) return s;
  const src = String(remap.sourceUuid ?? '').toLowerCase();
  const tgt = String(remap.targetUuid ?? '').toLowerCase();
  if (!UUID_RE.test(src) || !UUID_RE.test(tgt)) throw new Error('invalid remap uuid');
  return s.toLowerCase().split(src).join(tgt);
}

function asMap(v) {
  if (v instanceof Map) return v;
  return new Map(Object.entries(v ?? {}));
}

// ---------------------------------------------------------------------------
// SQL (read-only)
// ---------------------------------------------------------------------------

/** Primary key columns per public table, in key order. Run on each side. */
export const PK_COLUMNS_SQL = `SELECT c.relname AS tbl, a.attname AS col, k.ord::int AS ord
FROM pg_index i
JOIN pg_class c ON c.oid = i.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
WHERE i.indisprimary AND n.nspname = 'public'
ORDER BY c.relname, k.ord`;

function pkExpr(pkCols, alias = '') {
  if (!Array.isArray(pkCols) || pkCols.length === 0) throw new Error('no primary key columns');
  const p = alias ? `${alias}.` : '';
  return `concat_ws(chr(31), ${pkCols.map((c) => `${p}${ident(c, 'pk column')}::text`).join(', ')})`;
}

export function buildPkListSql(table, pkCols) {
  const t = ident(table, 'table');
  return `SELECT ${pkExpr(pkCols)} AS pk_key FROM public.${t} ORDER BY 1`;
}

function assertRemapLiteral(remap) {
  if (!remap) return null;
  const src = String(remap.sourceUuid ?? '').toLowerCase();
  const tgt = String(remap.targetUuid ?? '').toLowerCase();
  if (!UUID_RE.test(src) || !UUID_RE.test(tgt)) throw new Error('remap value is not a UUID');
  return { src, tgt };
}

// ---- strict storage URL normalization (ziko -> portfolio Phase 5 rewrite) ----

const URL_MODE_RE = '(public|sign|authenticated)';

/**
 * Rewrite spec from bucket-map.generated.json. Refs come from PROJECTS (no literals).
 * Only `{id, target_id}` pairs with a `ziko-` prefixed target are accepted.
 */
export function buildUrlRewrite(bucketMap, refs = PROJECTS) {
  const buckets = new Map();
  for (const b of bucketMap?.buckets ?? []) {
    if (typeof b?.id !== 'string' || !SOURCE_BUCKET_RE.test(b.id)) throw new Error('invalid bucket map id');
    if (typeof b?.target_id !== 'string' || !TARGET_BUCKET_RE.test(b.target_id) || b.target_id !== `ziko-${b.id}`) throw new Error('invalid bucket map target');
    buckets.set(b.id, b.target_id);
  }
  assertProjectRefFormat(refs.ziko);
  assertProjectRefFormat(refs.portfolio);
  return { zikoRef: refs.ziko, portfolioRef: refs.portfolio, buckets };
}

/**
 * Reference implementation of the SQL rule (used by tests): only columns ending in `_url`, only
 * string values that START with the exact ziko storage prefix of a mapped bucket.
 */
export function rewriteZikoStorageUrl(column, value, rw) {
  if (typeof column !== 'string' || !column.endsWith('_url') || typeof value !== 'string' || !rw) return value;
  for (const [id, target] of rw.buckets) {
    const re = new RegExp(`^https://${rw.zikoRef}[.]supabase[.]co/storage/v1/object/${URL_MODE_RE}/${id}/`);
    const m = re.exec(value);
    if (m) return `https://${rw.portfolioRef}.supabase.co/storage/v1/object/${m[1]}/${target}/${value.slice(m[0].length)}`;
  }
  return value;
}

function urlValueExpr(rw) {
  if (!rw) return 'e.value';
  let inner = "(e.value #>> '{}')";
  for (const [id, target] of rw.buckets) {
    inner = `regexp_replace(${inner}, '^https://${rw.zikoRef}[.]supabase[.]co/storage/v1/object/${URL_MODE_RE}/${id}/', 'https://${rw.portfolioRef}.supabase.co/storage/v1/object/\\1/${target}/')`;
  }
  return `CASE WHEN right(e.key, 4) = '_url' AND jsonb_typeof(e.value) = 'string' THEN to_jsonb(${inner}) ELSE e.value END`;
}

function rowJsonExpr(sharedCols, urlRewrite) {
  const keys = sharedCols.map((c) => {
    ident(c, 'column');
    return `'${c}'`;
  });
  return `(SELECT jsonb_object_agg(e.key, ${urlValueExpr(urlRewrite)}) FROM jsonb_each(to_jsonb(t)) AS e WHERE e.key = ANY (ARRAY[${keys.join(', ')}]::text[]))::text`;
}

/**
 * Row digest query: (pk_key, digest, modified_after_flip) per row. Same shape on both sides;
 * pass remap and urlRewrite on the ziko side only so the collision uuid and the storage URL
 * prefix are rewritten before md5.
 */
export function buildRowDigestSql({ table, pkCols, sharedCols, flipAt, timestampCols = [], remap = null, urlRewrite = null } = {}) {
  const t = ident(table, 'table');
  if (!Array.isArray(sharedCols) || sharedCols.length === 0) throw new Error('no shared columns');
  for (const c of pkCols ?? []) ident(c, 'pk column');
  const ts = (timestampCols ?? []).map((c) => `t.${ident(c, 'timestamp column')}`);
  if (typeof flipAt !== 'string' || !FLIP_AT_RE.test(flipAt)) throw new Error('flipAt must be an ISO UTC timestamp');
  const lit = assertRemapLiteral(remap);
  const wrap = (expr) => (lit ? `replace(${expr}, '${lit.src}', '${lit.tgt}')` : expr);
  const rowJson = rowJsonExpr(sharedCols, urlRewrite);
  const modified = ts.length === 0
    ? 'false'
    : `coalesce(greatest(${ts.join(', ')}) > '${flipAt}'::timestamptz, false)`;
  return `SELECT ${wrap(pkExpr(pkCols, 't'))} AS pk_key,
  md5(${wrap(rowJson)}) AS digest,
  ${modified} AS modified_after_flip
FROM public.${t} AS t
ORDER BY 1`;
}

/** No-PK tables: (digest, n) multiset of normalized row digests. */
export function buildMultisetDigestSql({ table, sharedCols, remap = null, urlRewrite = null } = {}) {
  const t = ident(table, 'table');
  if (!Array.isArray(sharedCols) || sharedCols.length === 0) throw new Error('no shared columns');
  const lit = assertRemapLiteral(remap);
  const wrap = (expr) => (lit ? `replace(${expr}, '${lit.src}', '${lit.tgt}')` : expr);
  return `SELECT md5(${wrap(rowJsonExpr(sharedCols, urlRewrite))}) AS digest, count(*)::bigint AS n
FROM public.${t} AS t
GROUP BY 1
ORDER BY 1`;
}

/** source/target: Map digest -> n. Every ziko digest must occur in portfolio at least as often. */
export function evaluateDigestMultiset({ table, source, target } = {}) {
  const src = asMap(source);
  const tgt = asMap(target);
  let missing = 0;
  let shared = 0;
  let srcTotal = 0;
  let tgtTotal = 0;
  for (const n of tgt.values()) tgtTotal += Number(n);
  for (const [d, n] of src) {
    const sn = Number(n);
    const tn = Number(tgt.get(d) ?? 0);
    srcTotal += sn;
    shared += Math.min(sn, tn);
    if (tn < sn) missing += sn - tn;
  }
  const extra = tgtTotal - shared;
  const base = { table, missing, extra, shared, extraKeys: [], noPk: true, multiset: true };
  if (missing > 0) return fail(`${table}: no primary key, row-digest multiset missing=${missing} of ${srcTotal}`, base);
  return ok(`${table}: no primary key, row-digest multiset all ${srcTotal} ziko rows present extra=${extra}`, base);
}

/** Column set comparison (names only). */
export function diffColumns(sourceCols, targetCols) {
  const s = new Set(sourceCols ?? []);
  const t = new Set(targetCols ?? []);
  return {
    shared: [...s].filter((c) => t.has(c)).sort(),
    sourceOnly: [...s].filter((c) => !t.has(c)).sort(),
    targetOnly: [...t].filter((c) => !s.has(c)).sort(),
  };
}

// ---------------------------------------------------------------------------
// Presence: PK subset and extras
// ---------------------------------------------------------------------------

/**
 * Every ziko PK (collision uuid remapped) must exist in portfolio.
 * Without a primary key (sourcePks/targetPks null) fall back to counts via `counts: {source, target}`.
 */
export function evaluatePkSubset({ table, sourcePks, targetPks, remap = null, counts = null } = {}) {
  if (sourcePks == null || targetPks == null) {
    const s = Number(counts?.source);
    const t = Number(counts?.target);
    if (!Number.isFinite(s) || !Number.isFinite(t)) return fail(`${table}: no primary key and no counts supplied`, { table, missing: 0, extra: 0, shared: 0, extraKeys: [], noPk: true });
    if (t < s) return fail(`${table}: no primary key, portfolio ${t} < ziko ${s}`, { table, missing: s - t, extra: 0, shared: Math.min(s, t), extraKeys: [], noPk: true });
    return ok(`${table}: no primary key, count fallback extra=${t - s}`, { table, missing: 0, extra: t - s, shared: s, extraKeys: [], noPk: true });
  }
  const tgt = new Set(targetPks.map((p) => String(p).toLowerCase()));
  const src = new Set();
  let missing = 0;
  let shared = 0;
  for (const p of sourcePks) {
    const k = remapPk(p, remap).toLowerCase();
    src.add(k);
    if (tgt.has(k)) shared += 1;
    else missing += 1;
  }
  const extraKeys = [...tgt].filter((k) => !src.has(k));
  const extra = extraKeys.length;
  const base = { table, missing, extra, shared, extraKeys, noPk: false };
  if (missing > 0) return fail(`${table}: missing=${missing}`, base);
  return ok(`${table}: all ziko rows present shared=${shared} extra=${extra}`, base);
}

/**
 * Explain extra portfolio rows as post-flip writes. `extraRows` = [{created_at, updated_at}];
 * for tables without a primary key supply {extraCount, postFlipCount} instead.
 */
export function classifyExtras({ extraRows, extraCount, postFlipCount, flipAt, hasCreatedAt = false, hasUpdatedAt = false } = {}) {
  const flip = flipMs(flipAt);
  const total = Array.isArray(extraRows) ? extraRows.length : Number(extraCount ?? 0);
  if (total === 0) return { ok: true, verdict: 'explained', count: 0, unexplained: 0, detail: 'no extra rows' };
  if (!hasCreatedAt && !hasUpdatedAt) {
    return { ok: false, verdict: 'unexplained-needs-review', count: total, unexplained: total, detail: `extra=${total} no timestamp column` };
  }
  let explained;
  if (Array.isArray(extraRows)) {
    explained = extraRows.filter((r) => {
      const c = hasCreatedAt ? toMs(r?.created_at) : NaN;
      const u = hasUpdatedAt ? toMs(r?.updated_at) : NaN;
      return c > flip || u > flip;
    }).length;
  } else {
    explained = Math.min(Number(postFlipCount ?? 0), total);
  }
  const unexplained = total - explained;
  return unexplained === 0
    ? { ok: true, verdict: 'explained', count: total, unexplained: 0, detail: `extra=${total} all post-flip` }
    : { ok: false, verdict: 'unexplained-needs-review', count: total, unexplained, detail: `extra=${total} unexplained=${unexplained}` };
}

// ---------------------------------------------------------------------------
// Content digest
// ---------------------------------------------------------------------------

/**
 * source/target: Map (or object) pk_key -> {digest, modified_after_flip}; ziko side already remapped in SQL.
 */
export function evaluateContentDigest({
  table, source, target, hasTimestamps, hasCreatedAt = false, hasUpdatedAt = false, countsEqual = false,
  sourceOnlyCols = [], targetOnlyCols = [],
} = {}) {
  const src = asMap(source);
  const tgt = asMap(target);
  const timestamped = Boolean(hasTimestamps || hasCreatedAt || hasUpdatedAt);
  const columnDiff = { sourceOnly: [...sourceOnlyCols], targetOnly: [...targetOnlyCols] };
  const base = { table, compared: 0, skippedPostFlip: 0, mismatched: 0, columnDiff };

  if (!timestamped && !countsEqual) {
    const limit = 'content-not-compared: no timestamp column and counts differ';
    return ok(`${table}: ${limit}`, { ...base, limit, notCompared: true });
  }

  let compared = 0;
  let skipped = 0;
  let mismatched = 0;
  for (const [pk, s] of src) {
    const t = tgt.get(pk);
    if (!t) continue; // presence is the PK gate's job
    if (timestamped && t.modified_after_flip) {
      skipped += 1;
      continue;
    }
    compared += 1;
    if (s.digest !== t.digest) mismatched += 1;
  }
  const noUpdated = timestamped && hasCreatedAt && !hasUpdatedAt;
  const res = { ...base, compared, skippedPostFlip: skipped, mismatched };
  if (mismatched > 0) {
    return fail(`${table}: content_mismatch=${mismatched}${noUpdated ? ' no-updated_at' : ''} compared=${compared}`, res);
  }
  return ok(`${table}: content ok compared=${compared} skipped_post_flip=${skipped}`, res);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function objKey(bucket, name) {
  return `${bucket}\u0000${name}`;
}

/**
 * source: [{bucket_id, name, sha256}] (ziko), target: [{bucket_id, name, sha256, created_at?, updated_at?}].
 * allowlist: masked keys (maskObjectKey) for D-13 known orphans.
 */
export function evaluateObjectSubset({ source, target, remap = null, allowlist = [], flipAt } = {}) {
  const flip = flipMs(flipAt);
  const allow = new Set(allowlist);
  const tgt = new Map();
  for (const t of target ?? []) tgt.set(objKey(t.bucket_id, t.name), t);
  const buckets = new Set();
  const expected = new Set();
  let missing = 0;
  let shaMismatch = 0;
  let rekeyErrors = 0;
  let checked = 0;
  for (const s of source ?? []) {
    let tb;
    let key;
    try {
      tb = targetBucketId(s.bucket_id);
      key = rekeyObjectName(s.name, remap).key;
    } catch {
      rekeyErrors += 1;
      continue;
    }
    buckets.add(tb);
    const k = objKey(tb, key);
    expected.add(k);
    checked += 1;
    const t = tgt.get(k);
    if (!t) {
      missing += 1;
      continue;
    }
    if (!s.sha256 || !t.sha256 || s.sha256 !== t.sha256) shaMismatch += 1;
  }
  let explained = 0;
  let unexplained = 0;
  const unexplainedKeys = [];
  for (const [k, t] of tgt) {
    if (!TARGET_BUCKET_RE.test(t.bucket_id) || expected.has(k)) continue;
    const masked = maskObjectKey(t.bucket_id, t.name);
    const postFlip = toMs(t.updated_at) > flip || toMs(t.created_at) > flip;
    if (postFlip || allow.has(masked)) explained += 1;
    else {
      unexplained += 1;
      unexplainedKeys.push(masked);
    }
  }
  const pass = missing === 0 && shaMismatch === 0 && rekeyErrors === 0 && unexplained === 0;
  const detail = `buckets=${buckets.size} objects=${checked} missing=${missing} sha_mismatch=${shaMismatch} rekey_errors=${rekeyErrors} extra_explained=${explained} unexplained=${unexplained}`;
  const res = { buckets: buckets.size, objects: checked, missing, shaMismatch, rekeyErrors, explained, unexplained, unexplainedKeys };
  return pass ? ok(detail, res) : fail(detail, res);
}

// ---------------------------------------------------------------------------
// Tenants (D-11)
// ---------------------------------------------------------------------------

const TENANT_PREFIX_RE = /^(?:bucket |policy )?(rh|gecko|sv)[_-]/;

function tenantOf(entry) {
  const m = TENANT_PREFIX_RE.exec(String(entry));
  return m ? m[1] : null;
}

/**
 * Inputs are the result objects of evaluateTenants (problems/warnings), evaluateStorageTenants
 * (failures/warnings) and the auth tenant check. rh_/gecko_ changes of any kind fail; sv_ is
 * informational only; problems on unknown tenants still fail.
 */
export function evaluateTenantDelta({ data, storage, auth } = {}) {
  const sides = { data, storage, auth };
  const failures = [];
  const informational = [];
  const perSide = {};
  for (const [name, side] of Object.entries(sides)) {
    if (!side) {
      failures.push(`${name}: not run`);
      perSide[name] = 'NOT-RUN';
      continue;
    }
    const problems = side.problems ?? side.failures ?? [];
    const warnings = side.warnings ?? [];
    let sideFail = false;
    for (const p of problems) {
      if (tenantOf(p) === 'sv') informational.push(`${name}: ${p}`);
      else {
        failures.push(`${name}: ${p}`);
        sideFail = true;
      }
    }
    for (const w of warnings) {
      const t = tenantOf(w);
      if (t === 'rh' || t === 'gecko') {
        failures.push(`${name}: ${w}`);
        sideFail = true;
      } else informational.push(`${name}: ${w}`);
    }
    perSide[name] = sideFail ? 'FAIL' : 'PASS';
  }
  const pass = failures.length === 0;
  return {
    ok: pass,
    detail: pass ? `tenants unchanged for rh_/gecko_, informational=${informational.length}` : `tenant failures=${failures.length}`,
    failures,
    informational,
    perSide,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const verdict = (r) => (r === undefined || r === null ? 'NOT-RUN' : r.ok ? 'PASS' : 'FAIL');

/**
 * tables: [{table, pk, extras, content, columnDiff?}] with pk from evaluatePkSubset, extras from
 * classifyExtras (optional when pk.extra is 0), content from evaluateContentDigest.
 */
export function buildDecomReport({
  generatedAt, target, source, flipAt, tables = [], storage = null, integrity = {}, auth = {}, tenants = null,
  expectedTables = EXPECTED_TABLE_COUNT,
} = {}) {
  const failed = [];
  const mismatched = [];
  const notCompared = [];
  const deviations = [];
  let pass = 0;
  let explainedExtra = 0;
  let comparedRows = 0;
  let skippedPostFlip = 0;

  for (const e of tables) {
    const name = e.table ?? e.pk?.table;
    const extrasOk = e.pk?.extra > 0 ? Boolean(e.extras?.ok) : true;
    const contentOk = e.content ? e.content.ok : false;
    const tablePass = Boolean(e.pk?.ok) && extrasOk && contentOk;
    if (tablePass) pass += 1;
    else failed.push(name);
    if (e.pk?.extra > 0 && extrasOk) explainedExtra += 1;
    if (e.content) {
      comparedRows += e.content.compared ?? 0;
      skippedPostFlip += e.content.skippedPostFlip ?? 0;
      if ((e.content.mismatched ?? 0) > 0) mismatched.push(name);
      if (e.content.limit) {
        notCompared.push(name);
        deviations.push({ table: name, limit: e.content.limit });
      }
      const cd = e.content.columnDiff ?? e.columnDiff;
      if (cd && (cd.sourceOnly?.length || cd.targetOnly?.length)) {
        deviations.push({
          table: name,
          limit: `column sets differ: ziko-only=${(cd.sourceOnly ?? []).join(',') || '-'} portfolio-only=${(cd.targetOnly ?? []).join(',') || '-'}`,
        });
      }
    }
  }

  const integrityOut = {};
  for (const k of ['rls', 'triggers', 'fk', 'orphans']) integrityOut[k] = verdict(integrity?.[k]);
  const authOut = { users: verdict(auth?.users), identities: verdict(auth?.identities) };
  const tenantsOut = tenants
    ? { ...tenants.perSide, informational: tenants.informational?.length ?? 0 }
    : { data: 'NOT-RUN', storage: 'NOT-RUN', auth: 'NOT-RUN', informational: 0 };
  const storageOut = storage
    ? { buckets: storage.buckets ?? 0, objects: storage.objects ?? 0, missing: storage.missing ?? 0, unexplained: storage.unexplained ?? 0 }
    : { buckets: 0, objects: 0, missing: 0, unexplained: 0, verdict: 'NOT-RUN' };

  const passed =
    tables.length === expectedTables &&
    failed.length === 0 &&
    mismatched.length === 0 &&
    Boolean(storage?.ok) &&
    Object.values(integrityOut).every((v) => v === 'PASS') &&
    Object.values(authOut).every((v) => v === 'PASS') &&
    Boolean(tenants?.ok);

  const report = {
    generated_at: generatedAt,
    target,
    source,
    flip_at: flipAt,
    passed,
    tables: { total: tables.length, pass, explained_extra: explainedExtra, failed },
    content: { compared_rows: comparedRows, skipped_post_flip: skippedPostFlip, mismatched, not_compared: notCompared },
    storage: storageOut,
    integrity: integrityOut,
    auth: authOut,
    tenants: tenantsOut,
    deviations,
  };
  assertCommittedSafe(report);
  return report;
}

// ---------------------------------------------------------------------------
// CLI (plan 07-22): read-only live collection + existing verifiers as child steps
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(HERE, '..', '..');
const HANDOFF_PATH = resolve(REPO_ROOT, '.planning', 'HANDOFF.json');
const DEFAULT_REMAP_FILE = resolve(HERE, '..', 'auth-merge', 'uuid-remap.json');
const DEFAULT_BASELINES = Object.freeze({
  data: resolve(HERE, 'baseline', 'portfolio-tenants-precutover.json'),
  storage: resolve(HERE, 'baseline', 'portfolio-storage-tenants-precutover.json'),
  auth: resolve(HERE, '..', 'auth-merge', 'baseline', 'portfolio-baseline-precutover.json'),
});
const CHILD_SCRIPTS = Object.freeze({
  verifyData: join(HERE, '06-verify-data.mjs'),
  verifyStorage: join(HERE, '09-verify-storage.mjs'),
  authVerify: resolve(HERE, '..', 'auth-merge', '06-verify.mjs'),
});

const CHECKS = ['pk-subset', 'content', 'storage-subset', 'integrity', 'auth', 'tenants'];
const TS_COLUMNS = ['created_at', 'updated_at'];
// Row-creation timestamps used only to prove no-PK extras are post-flip (ziko_user_inventory, ziko_user_plugins).
const NOPK_CREATED_COLUMNS = ['purchased_at', 'installed_at'];
const JWT_G = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const FULL_UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CONCURRENCY = 4;

function safeText(text) {
  return redactPii(String(text ?? '')).replace(JWT_G, '[jwt]').replace(FULL_UUID_G, (u) => `${u.slice(0, 8)}-…`).slice(0, 400);
}

/**
 * Child steps for the existing verifiers. Never contains a `counts` check, 13-cutover-delta or
 * 05-load-data (T-07-17).
 */
export function buildChildSteps(o = {}) {
  const refs = ['--project-ref', o.projectRef, '--source-ref', o.sourceRef];
  const step = (name, script, argv) => ({ name, script, argv });
  const b = { ...DEFAULT_BASELINES, ...(o.baselines ?? {}) };
  const remap = o.remapFile ?? DEFAULT_REMAP_FILE;
  return {
    integrity: ['rls', 'triggers', 'fk', 'orphans'].map((c) => step(`integrity-${c}`, CHILD_SCRIPTS.verifyData, [...refs, '--check', c])),
    auth: ['users', 'identities'].map((c) => step(`auth-${c}`, CHILD_SCRIPTS.authVerify, [...refs, '--check', c])),
    tenants: [
      step('tenants-data', CHILD_SCRIPTS.verifyData, [...refs, '--check', 'tenants', '--baseline', b.data]),
      step('tenants-storage', CHILD_SCRIPTS.verifyStorage, [...refs, '--check', 'tenants', '--remap-file', remap, '--baseline', b.storage]),
      step('tenants-auth', CHILD_SCRIPTS.authVerify, [...refs, '--check', 'tenants', '--baseline', b.auth]),
    ],
  };
}

/** Problems/warnings from a child verifier's stdout (the `[FAIL] name: a; b` and `[WARN] x` lines). */
export function parseTenantOutput(stdout, status) {
  const problems = [];
  const warnings = [];
  for (const raw of String(stdout ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '');
    const w = /^\s*\[WARN\]\s*(.*)$/.exec(line);
    if (w) {
      warnings.push(safeText(w[1]));
      continue;
    }
    const f = /^\[FAIL\]\s+[\w-]+:\s*(.*)$/.exec(line);
    if (f) for (const p of f[1].split('; ')) if (p.trim()) problems.push(safeText(p.trim()));
  }
  if (status === 0) return { problems: [], warnings };
  if (problems.length === 0) problems.push('child verifier failed without an attributable problem');
  return { problems, warnings };
}

const FORBIDDEN_SQL_RE = /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|COPY|VACUUM)\b/i;

/** Last line of defence: only a single read statement may pass (T-07-20b). */
export function assertReadOnlySql(sql) {
  const s = String(sql ?? '');
  if (!/^\s*(SELECT|WITH)\b/i.test(s) || FORBIDDEN_SQL_RE.test(s)) throw new Error('refusing non-read-only SQL');
}

export function buildColumnsSql(table) {
  ident(table, 'table');
  return `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND is_generated = 'NEVER' ORDER BY ordinal_position`;
}

export function buildCountSql(table) {
  return `SELECT count(*)::bigint AS n FROM public.${ident(table, 'table')}`;
}

export function buildTimestampSql(table, pkCols, tsCols) {
  const cols = tsCols.map((c) => `, ${ident(c, 'timestamp column')}`).join('');
  return `SELECT ${pkExpr(pkCols)} AS pk_key${cols} FROM public.${ident(table, 'table')}`;
}

export function buildPostFlipCountSql(table, tsCols, flipAt) {
  if (typeof flipAt !== 'string' || !FLIP_AT_RE.test(flipAt)) throw new Error('flipAt must be an ISO UTC timestamp');
  const ts = tsCols.map((c) => ident(c, 'timestamp column')).join(', ');
  return `SELECT count(*)::bigint AS n FROM public.${ident(table, 'table')} WHERE coalesce(greatest(${ts}) > '${flipAt}'::timestamptz, false)`;
}

export function buildTargetObjectListSql(buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) throw new Error('needs at least one bucket id');
  for (const b of buckets) if (typeof b !== 'string' || !TARGET_BUCKET_RE.test(b)) throw new Error('invalid bucket id');
  const list = buckets.map((b) => `'${b}'`).join(', ');
  return `SELECT bucket_id, name, created_at, updated_at FROM storage.objects WHERE bucket_id IN (${list}) ORDER BY bucket_id, name`;
}

const SPEC = {
  'project-ref': 'string',
  'source-ref': 'string',
  check: 'string',
  'remap-file': 'string',
  allowlist: 'string',
  'json-out': 'string',
  'record-gate': 'boolean',
  tables: 'string',
};

const HELP = `22-decom-verify.mjs - Phase 7 DECOM-03 read-only verifier (frozen ziko vs portfolio)

Required:
  --project-ref <ref>   Must be the portfolio project (anything else is refused).
  --source-ref <ref>    Must be the ziko project (anything else is refused).
  --check <name>        pk-subset|content|storage-subset|integrity|auth|tenants|all
Optional:
  --remap-file <path>   uuid-remap.json (default scripts/auth-merge/uuid-remap.json)
  --allowlist <path>    JSON array of masked object keys (known orphans), default none
  --json-out <path>     Write the PII-free report (repo-relative path when used with --record-gate)
  --tables <a,b>        Debug: restrict pk-subset/content to these portfolio table names (never with --record-gate)
  --record-gate         With --check all and a passing run, record the verify_pass gate
  --help, -h            Show this help

SELECT-only. Never runs --check counts, 13-cutover-delta or 05-load-data.
Exit codes: 0 passed; 1 failed or refused; 2 bad arguments.
`;

function defaultDeps() {
  return {
    runSql: (ref, sql) => runSql(ref, sql),
    runner: (step) => {
      const r = spawnSync(process.execPath, [step.script, ...step.argv], {
        env: process.env,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      });
      return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error ? String(r.error.message) : '') };
    },
    loadPlan: async () => buildTablePlan(await loadRenameMap()),
    loadBucketMap: async () => JSON.parse(await readFile(resolve(HERE, 'bucket-map.generated.json'), 'utf8')),
    makeStorageClient: async (ref) => {
      const { createClient } = await import('@supabase/supabase-js');
      const keys = await getProjectApiKeys(ref);
      return createClient(`https://${ref}.supabase.co`, keys.secret, { auth: { persistSession: false, autoRefreshToken: false } });
    },
    readText: (p) => readFile(p, 'utf8'),
    writeText: (p, t) => writeFile(p, t, 'utf8'),
    recordGate: (key, opts) => recordGate(key, opts),
    now: () => new Date().toISOString(),
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
    retryOpts: undefined,
    expectedTables: EXPECTED_TABLE_COUNT,
  };
}

async function loadPkMap(sql, ref) {
  const map = new Map();
  for (const r of await sql(ref, PK_COLUMNS_SQL)) {
    if (!map.has(r.tbl)) map.set(r.tbl, []);
    map.get(r.tbl)[Number(r.ord) - 1] = r.col;
  }
  return map;
}

const lowerMap = (rows) => new Map(rows.map((r) => [String(r.pk_key).toLowerCase(), { digest: r.digest, modified_after_flip: r.modified_after_flip === true }]));

async function collectTable(ctx, { source, target }, { doPk, doContent }) {
  const { sql, flipAt, remap, zikoPk, portPk, urlRewrite } = ctx;
  const entry = { table: target };
  const sPk = zikoPk.get(source) ?? [];
  const tPk = portPk.get(target) ?? [];
  const noPk = sPk.length === 0 || tPk.length === 0;
  const sCols = (await sql(PROJECTS.ziko, buildColumnsSql(source))).map((r) => r.column_name);
  const tCols = (await sql(PROJECTS.portfolio, buildColumnsSql(target))).map((r) => r.column_name);
  const cd = diffColumns(sCols, tCols);
  const tsCols = TS_COLUMNS.filter((c) => cd.shared.includes(c));
  const hasCreatedAt = tsCols.includes('created_at');
  const hasUpdatedAt = tsCols.includes('updated_at');
  entry.columnDiff = { sourceOnly: cd.sourceOnly, targetOnly: cd.targetOnly };

  let multiset = null;
  const multisetOf = async () => {
    if (multiset) return multiset;
    const sRows = await sql(PROJECTS.ziko, buildMultisetDigestSql({ table: source, sharedCols: cd.shared, remap, urlRewrite }));
    const tRows = await sql(PROJECTS.portfolio, buildMultisetDigestSql({ table: target, sharedCols: cd.shared }));
    const toMap = (rows) => new Map(rows.map((r) => [String(r.digest), Number(r.n)]));
    multiset = { result: evaluateDigestMultiset({ table: target, source: toMap(sRows), target: toMap(tRows) }) };
    return multiset;
  };

  if (doPk) {
    if (noPk) {
      const ms = await multisetOf();
      entry.pk = ms.result;
      if (entry.pk.extra > 0) {
        const extraTs = [...tsCols, ...NOPK_CREATED_COLUMNS.filter((c) => cd.shared.includes(c))];
        const postFlip = extraTs.length
          ? Number((await sql(PROJECTS.portfolio, buildPostFlipCountSql(target, extraTs, flipAt)))[0]?.n)
          : 0;
        entry.extras = classifyExtras({
          extraCount: entry.pk.extra, postFlipCount: postFlip, flipAt,
          hasCreatedAt: hasCreatedAt || extraTs.length > tsCols.length, hasUpdatedAt,
        });
      }
    } else {
      const sKeys = (await sql(PROJECTS.ziko, buildPkListSql(source, sPk))).map((r) => r.pk_key);
      const tKeys = (await sql(PROJECTS.portfolio, buildPkListSql(target, tPk))).map((r) => r.pk_key);
      entry.pk = evaluatePkSubset({ table: target, sourcePks: sKeys, targetPks: tKeys, remap });
      if (entry.pk.extra > 0) {
        const extraSet = new Set(entry.pk.extraKeys);
        let extraRows;
        // Tables without created_at (user_inventory, user_plugins) are dated by their creation column.
        const createdAlt = tsCols.includes('created_at') ? [] : NOPK_CREATED_COLUMNS.filter((c) => cd.shared.includes(c));
        const rowTsCols = [...tsCols, ...createdAlt];
        if (rowTsCols.length) {
          const rows = await sql(PROJECTS.portfolio, buildTimestampSql(target, tPk, rowTsCols));
          extraRows = rows
            .filter((r) => extraSet.has(String(r.pk_key).toLowerCase()))
            .map((r) => (createdAlt.length ? { ...r, created_at: r[createdAlt[0]] } : r));
        } else {
          extraRows = entry.pk.extraKeys.map(() => ({}));
        }
        entry.extras = classifyExtras({ extraRows, flipAt, hasCreatedAt: hasCreatedAt || createdAlt.length > 0, hasUpdatedAt });
      }
    }
  }

  if (doContent) {
    if (noPk && cd.shared.length > 0) {
      const r = (await multisetOf()).result;
      entry.content = (r.ok ? ok : fail)(`${target}: row-digest multiset ${r.ok ? 'ok' : 'mismatch'} compared=${r.shared}`, {
        table: target, compared: r.shared, skippedPostFlip: 0, mismatched: r.missing, columnDiff: entry.columnDiff,
      });
    } else if (noPk || cd.shared.length === 0) {
      entry.content = ok(`${target}: content-not-compared: no primary key`, {
        table: target, compared: 0, skippedPostFlip: 0, mismatched: 0, columnDiff: entry.columnDiff, limit: 'content-not-compared: no primary key',
      });
    } else {
      const sRows = await sql(PROJECTS.ziko, buildRowDigestSql({ table: source, pkCols: sPk, sharedCols: cd.shared, flipAt, timestampCols: tsCols, remap, urlRewrite }));
      const tRows = await sql(PROJECTS.portfolio, buildRowDigestSql({ table: target, pkCols: tPk, sharedCols: cd.shared, flipAt, timestampCols: tsCols }));
      const sMap = lowerMap(sRows);
      const tMap = lowerMap(tRows);
      entry.content = evaluateContentDigest({
        table: target, source: sMap, target: tMap, hasCreatedAt, hasUpdatedAt,
        countsEqual: sMap.size === tMap.size, sourceOnlyCols: cd.sourceOnly, targetOnlyCols: cd.targetOnly,
      });
    }
  }
  return entry;
}

async function collectTables(ctx, plan, which) {
  const entries = [];
  for (const t of plan) {
    try {
      entries.push(await collectTable(ctx, t, which));
    } catch (err) {
      const f = fail(`${t.target}: error: ${safeText(err?.message)}`, { table: t.target, missing: 0, extra: 0, compared: 0, mismatched: 0 });
      entries.push({ table: t.target, pk: which.doPk ? f : undefined, content: which.doContent ? f : undefined });
    }
  }
  return entries;
}

async function sha256Of(client, bucket, name, retryOpts) {
  try {
    return sha256Hex(await downloadBuffer(client, bucket, name, retryOpts));
  } catch {
    return null;
  }
}

async function collectStorage(ctx) {
  const { sql, deps, remap, flipAt, allowlist } = ctx;
  const zBuckets = (await sql(PROJECTS.ziko, BUCKET_LIST_SQL)).map((r) => r.id);
  const srcObjs = zBuckets.length ? await sql(PROJECTS.ziko, buildObjectListSql(zBuckets)) : [];
  const pBuckets = (await sql(PROJECTS.portfolio, BUCKET_LIST_SQL)).map((r) => r.id).filter((id) => TARGET_BUCKET_RE.test(id));
  const tgtObjs = pBuckets.length ? await sql(PROJECTS.portfolio, buildTargetObjectListSql(pBuckets)) : [];
  const zClient = await deps.makeStorageClient(PROJECTS.ziko);
  const pClient = await deps.makeStorageClient(PROJECTS.portfolio);

  const source = await mapPool(srcObjs, CONCURRENCY, async (o) => ({
    bucket_id: o.bucket_id, name: o.name, sha256: await sha256Of(zClient, o.bucket_id, o.name, deps.retryOpts),
  }));
  const expected = new Set();
  for (const s of srcObjs) {
    try {
      expected.add(objKey(targetBucketId(s.bucket_id), rekeyObjectName(s.name, remap).key));
    } catch {
      // counted as rekey error by the evaluator
    }
  }
  const target = await mapPool(tgtObjs, CONCURRENCY, async (o) => ({
    bucket_id: o.bucket_id,
    name: o.name,
    created_at: o.created_at,
    updated_at: o.updated_at,
    sha256: expected.has(objKey(o.bucket_id, o.name)) ? await sha256Of(pClient, o.bucket_id, o.name, deps.retryOpts) : null,
  }));
  return evaluateObjectSubset({ source, target, remap, allowlist, flipAt });
}

/** Runs every step (no stop on failure); returns [{step, status, stdout}]. */
async function runChildren(steps, runner) {
  const out = [];
  for (const step of steps) {
    const r = await runner(step);
    out.push({ step, status: typeof r?.status === 'number' ? r.status : 1, stdout: String(r?.stdout ?? '') });
  }
  return out;
}

const childResult = (c) => (c.status === 0 ? ok(`${c.step.name} passed`) : fail(`${c.step.name} failed (exit ${c.status})`));

export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...depsIn };
  const { log, errlog } = deps;
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    log(HELP);
    return 0;
  }
  if (!args.projectRef || !args.sourceRef) {
    errlog('ERROR: --project-ref and --source-ref are required (no defaults)');
    return 2;
  }
  if (args.check !== 'all' && !CHECKS.includes(args.check)) {
    errlog(`ERROR: --check must be one of ${[...CHECKS, 'all'].join('|')}`);
    return 2;
  }
  try {
    assertProjectRefFormat(args.projectRef);
    assertProjectRefFormat(args.sourceRef);
  } catch (e) {
    errlog(`ERROR: ${safeText(e.message)}`);
    return 2;
  }
  if (args.projectRef !== PROJECTS.portfolio) {
    errlog('ERROR: the verification target must be the portfolio project');
    return 1;
  }
  if (args.sourceRef !== PROJECTS.ziko) {
    errlog('ERROR: the verification source must be the ziko project');
    return 1;
  }
  if (args.recordGate && (args.check !== 'all' || !args.jsonOut)) {
    errlog('ERROR: --record-gate requires --check all and --json-out');
    return 2;
  }
  if (args.tables && args.recordGate) {
    errlog('ERROR: --tables cannot be combined with --record-gate');
    return 2;
  }
  const tableFilter = args.tables ? args.tables.split(',').map((s) => s.trim()).filter(Boolean) : null;

  let flipAt;
  let remap;
  let allowlist = [];
  try {
    flipAt = JSON.parse(await deps.readText(HANDOFF_PATH))?.phase7_handoff_from_phase6?.backend_flip_at;
    if (typeof flipAt !== 'string' || !FLIP_AT_RE.test(flipAt)) throw new Error('backend_flip_at missing or not an ISO UTC timestamp');
    remap = parseRemapFile(JSON.parse(await deps.readText(args.remapFile ?? DEFAULT_REMAP_FILE)), { projectRef: PROJECTS.portfolio, sourceRef: PROJECTS.ziko });
    if (args.allowlist) {
      const raw = JSON.parse(await deps.readText(args.allowlist));
      allowlist = Array.isArray(raw) ? raw : raw?.keys ?? [];
    }
  } catch (e) {
    errlog(`ERROR: ${safeText(e.message)}`);
    return 1;
  }

  const sql = async (ref, text) => {
    assertReadOnlySql(text);
    return deps.runSql(ref, text);
  };
  const want = new Set(args.check === 'all' ? CHECKS : [args.check]);
  const results = {};
  const record = (name, r) => {
    results[name] = r;
    log(`[${r.ok ? 'PASS' : 'FAIL'}] ${name}: ${safeText(r.detail)}`);
  };

  let tables = [];
  let storage = null;
  let integrity = {};
  let auth = {};
  let tenants = null;

  try {
    if (want.has('pk-subset') || want.has('content')) {
      const doPk = want.has('pk-subset');
      const doContent = want.has('content');
      let plan;
      let urlRewrite;
      let zikoPk;
      let portPk;
      try {
        plan = await deps.loadPlan();
        if (tableFilter) {
          const known = new Set(plan.map((p) => p.target));
          const unknown = tableFilter.filter((n) => !known.has(n));
          if (unknown.length) throw new Error(`--tables names not in plan: ${unknown.join(',')}`);
          plan = plan.filter((p) => tableFilter.includes(p.target));
        }
        urlRewrite = buildUrlRewrite(await deps.loadBucketMap());
        zikoPk = await loadPkMap(sql, PROJECTS.ziko);
        portPk = await loadPkMap(sql, PROJECTS.portfolio);
      } catch (e) {
        record(doPk ? 'pk-subset' : 'content', fail(`error: ${safeText(e.message)}`));
        plan = null;
      }
      if (plan) {
        tables = await collectTables({ sql, flipAt, remap, zikoPk, portPk, urlRewrite }, plan, { doPk, doContent });
        if (doPk) {
          const bad = tables.filter((e) => !e.pk?.ok || (e.pk.extra > 0 && !e.extras?.ok)).map((e) => (e.pk?.extra > 0 && e.pk.ok ? `${e.table}:${e.extras?.detail ?? 'no-extras-verdict'}` : e.table));
          const missing = tables.reduce((n, e) => n + (e.pk?.missing ?? 0), 0);
          const explained = tables.filter((e) => e.pk?.extra > 0 && e.extras?.ok).length;
          record('pk-subset', (bad.length ? fail : ok)(`tables=${tables.length} failed=${bad.length} missing_rows=${missing} tables_with_explained_extras=${explained}${bad.length ? ` [${bad.slice(0, 10).join(',')}]` : ''}`));
        }
        if (doContent) {
          const bad = tables.filter((e) => !e.content?.ok).map((e) => e.table);
          const compared = tables.reduce((n, e) => n + (e.content?.compared ?? 0), 0);
          const mism = tables.filter((e) => (e.content?.mismatched ?? 0) > 0).length;
          const limited = tables.filter((e) => e.content?.limit).length;
          record('content', (bad.length ? fail : ok)(`tables=${tables.length} failed=${bad.length} compared_rows=${compared} tables_with_mismatch=${mism} not_compared=${limited}${bad.length ? ` [${bad.slice(0, 10).join(',')}]` : ''}`));
        }
      }
    }

    if (want.has('storage-subset')) {
      try {
        storage = await collectStorage({ sql, deps, remap, flipAt, allowlist });
        record('storage-subset', storage);
      } catch (e) {
        storage = null;
        record('storage-subset', fail(`error: ${safeText(e.message)}`));
      }
    }

    if (want.has('integrity') || want.has('auth') || want.has('tenants')) {
      const steps = buildChildSteps({ projectRef: args.projectRef, sourceRef: args.sourceRef, remapFile: args.remapFile ?? DEFAULT_REMAP_FILE });
      if (want.has('integrity')) {
        const res = await runChildren(steps.integrity, deps.runner);
        for (const c of res) integrity[c.step.name.replace('integrity-', '')] = childResult(c);
        const bad = res.filter((c) => c.status !== 0).map((c) => c.step.name);
        record('integrity', (bad.length ? fail : ok)(bad.length ? `failed: ${bad.join(',')}` : 'rls, triggers, fk, orphans passed'));
      }
      if (want.has('auth')) {
        const res = await runChildren(steps.auth, deps.runner);
        for (const c of res) auth[c.step.name.replace('auth-', '')] = childResult(c);
        const bad = res.filter((c) => c.status !== 0).map((c) => c.step.name);
        record('auth', (bad.length ? fail : ok)(bad.length ? `failed: ${bad.join(',')}` : 'users, identities passed'));
      }
      if (want.has('tenants')) {
        const res = await runChildren(steps.tenants, deps.runner);
        const parsed = Object.fromEntries(res.map((c) => [c.step.name.replace('tenants-', ''), parseTenantOutput(c.stdout, c.status)]));
        tenants = evaluateTenantDelta(parsed);
        record('tenants', tenants);
      }
    }
  } catch (e) {
    errlog(`ERROR: ${safeText(e.message)}`);
    return 1;
  }

  let report = null;
  let reportFailure = false;
  try {
    report = buildDecomReport({
      generatedAt: deps.now(), target: 'portfolio', source: 'ziko', flipAt,
      tables, storage, integrity, auth, tenants, expectedTables: deps.expectedTables,
    });
  } catch (e) {
    errlog(`ERROR: report refused: ${safeText(e.message)}`);
    reportFailure = true;
  }

  let allOk = !reportFailure && Object.values(results).every((r) => r.ok === true);
  if (want.size === CHECKS.length && report && !report.passed) allOk = false;

  if (report && args.jsonOut) {
    try {
      await deps.writeText(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    } catch (e) {
      errlog(`ERROR: could not write report: ${safeText(e.message)}`);
      allOk = false;
    }
  }
  log(allOk ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED');

  if (allOk && args.recordGate) {
    try {
      deps.recordGate('verify_pass', { evidence: args.jsonOut });
      log('gate verify_pass recorded');
    } catch (e) {
      errlog(`ERROR: ${safeText(e.message)}`);
      return 1;
    }
  }
  return allOk ? 0 : 1;
}

if (isMain(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ERROR: ${safeText(e?.message ?? e)}`);
      process.exit(1);
    },
  );
}
