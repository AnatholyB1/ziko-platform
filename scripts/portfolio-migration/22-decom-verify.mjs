// Phase 7 plan 07-05 (DECOM-03): delta-aware verifier semantics, frozen ziko vs portfolio.
//
// Pure evaluators, SQL builders and the report builder only. The CLI that runs these live
// (together with the existing integrity/auth/tenant verifiers) arrives in plan 07-22.
//
// SAFETY: this module is read-only by construction. Every SQL builder emits a single SELECT.
// It never imports or invokes TRUNCATE-capable reload code (13-cutover-delta --apply,
// 05-load-data --apply). Details never carry PK values, digests, emails or object names:
// counts, table names and masked keys only (T-07-18).

import { EXPECTED_TABLE_COUNT, IDENT_RE, UUID_RE } from './lib-data.mjs';
import { TARGET_BUCKET_RE, maskObjectKey, rekeyObjectName, targetBucketId } from './lib-storage.mjs';
import { assertCommittedSafe } from './18-decom-guard.mjs';

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

/**
 * Row digest query: (pk_key, digest, modified_after_flip) per row. Same shape on both sides;
 * pass remap on the ziko side only so the collision uuid is rewritten before md5.
 */
export function buildRowDigestSql({ table, pkCols, sharedCols, flipAt, timestampCols = [], remap = null } = {}) {
  const t = ident(table, 'table');
  if (!Array.isArray(sharedCols) || sharedCols.length === 0) throw new Error('no shared columns');
  const keys = sharedCols.map((c) => {
    ident(c, 'column');
    return `'${c}'`;
  });
  for (const c of pkCols ?? []) ident(c, 'pk column');
  const ts = (timestampCols ?? []).map((c) => `t.${ident(c, 'timestamp column')}`);
  if (typeof flipAt !== 'string' || !FLIP_AT_RE.test(flipAt)) throw new Error('flipAt must be an ISO UTC timestamp');
  const lit = assertRemapLiteral(remap);
  const wrap = (expr) => (lit ? `replace(lower(${expr}), '${lit.src}', '${lit.tgt}')` : expr);
  const rowJson = `(SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t)) AS e WHERE e.key = ANY (ARRAY[${keys.join(', ')}]::text[]))::text`;
  const modified = ts.length === 0
    ? 'false'
    : `coalesce(greatest(${ts.join(', ')}) > '${flipAt}'::timestamptz, false)`;
  return `SELECT ${wrap(pkExpr(pkCols, 't'))} AS pk_key,
  md5(${wrap(rowJson)}) AS digest,
  ${modified} AS modified_after_flip
FROM public.${t} AS t
ORDER BY 1`;
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
