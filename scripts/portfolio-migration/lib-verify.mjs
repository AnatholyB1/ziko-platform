// Phase 4 (plan 04-02) verification logic: pure SQL builders and evaluators.
//
// Rules for this module:
//   - read-only verification logic; no database driver is imported here.
//   - output is limited to table names, constraint names, counts, booleans and
//     masked UUIDs (see assertReportSafe).
//   - never calls the sequence-advancing function (nextval) anywhere: it is
//     non-transactional and would turn 87/true into 88/true even in a rolled back
//     transaction. Sequences are compared via last_value/is_called only.
//   - never prints trigger definitions (they embed a webhook secret header);
//     only tgname/tgenabled are selected.
//
// Success criterion mapping ("a subsequent insert succeeds without collision"):
//   - the only sequence (waitlist founder seq) is proven by source equality plus
//     last_value >= max(ziko_waitlist_signups.founder_rank) on the loaded data;
//   - sequence-backed PK columns are proven by owned-column discovery reporting
//     0 such columns (no serial/identity columns exist on ziko).

export const CHECK_NAMES = ['counts', 'rls', 'triggers', 'fk', 'orphans', 'sequence', 'remap', 'tenants'];

// ---------------------------------------------------------------------------
// Identifier handling (independent of lib-data on purpose)
// ---------------------------------------------------------------------------

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const ZIKO_RE = /^ziko_[a-z0-9_]+$/;

function ident(name, what = 'identifier') {
  if (typeof name !== 'string' || !IDENT_RE.test(name)) {
    throw new Error(`invalid ${what}: ${JSON.stringify(name)}`);
  }
  return name;
}

function zikoIdent(name, what = 'target table') {
  if (typeof name !== 'string' || !ZIKO_RE.test(name)) {
    throw new Error(`invalid ${what} (must match ${ZIKO_RE}): ${JSON.stringify(name)}`);
  }
  return name;
}

function q(name) {
  return `"${name}"`;
}

function big(n) {
  try {
    return BigInt(String(n));
  } catch {
    throw new Error(`non-integer count value: ${JSON.stringify(n)}`);
  }
}

// ---------------------------------------------------------------------------
// Catalog SQL constants
// ---------------------------------------------------------------------------

// Corrected spec section 3 query: regclass::text drops the public. qualifier,
// so the namespace/name predicate is applied on pg_class directly.
export const FK_TO_AUTH_USERS_SQL = `SELECT r.relname AS child, a.attname AS "column", c.conname
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN LATERAL unnest(c.conkey) AS k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
  AND r.relnamespace = 'public'::regnamespace
  AND r.relname LIKE 'ziko\\_%'
ORDER BY r.relname, a.attname`;

export const FK_LIST_SQL = `SELECT c.conname,
  r.relname AS child,
  pn.nspname AS parent_schema,
  pr.relname AS parent_table,
  (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS child_cols,
  (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS parent_cols,
  c.convalidated,
  c.confmatchtype::text AS confmatchtype
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN pg_class pr ON pr.oid = c.confrelid
JOIN pg_namespace pn ON pn.oid = pr.relnamespace
WHERE c.contype = 'f'
  AND r.relnamespace = 'public'::regnamespace
  AND r.relname LIKE 'ziko\\_%'
ORDER BY r.relname, c.conname`;

export const RLS_SQL = `SELECT c.relname, c.relrowsecurity
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relname LIKE 'ziko\\_%'
ORDER BY c.relname`;

// tgname/tgenabled only: trigger definitions embed a webhook secret header.
export const TRIGGER_STATE_SQL = `SELECT c.relname, t.tgname, t.tgenabled::text AS tgenabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND c.relnamespace = 'public'::regnamespace
  AND c.relname LIKE 'ziko\\_%'
ORDER BY c.relname, t.tgname`;

export const AUTH_USERS_TRIGGER_STATE_SQL = `SELECT c.relname, t.tgname, t.tgenabled::text AS tgenabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND t.tgrelid = 'auth.users'::regclass
ORDER BY t.tgname`;

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export function buildCountsSql(plan, side) {
  if (side !== 'source' && side !== 'target') throw new Error(`invalid side: ${side}`);
  if (!Array.isArray(plan) || plan.length === 0) throw new Error('empty plan');
  return plan
    .map((p) => {
      const target = zikoIdent(p.target);
      const name = side === 'source' ? ident(p.source, 'source table') : target;
      return `SELECT '${target}' AS tbl, count(*)::bigint AS n FROM public.${q(name)}`;
    })
    .join('\nUNION ALL\n');
}

function indexCounts(rows) {
  const m = new Map();
  for (const r of rows ?? []) m.set(r.tbl, big(r.n));
  return m;
}

export function evaluateCounts(plan, sourceRows, targetRows) {
  const s = indexCounts(sourceRows);
  const t = indexCounts(targetRows);
  const mismatches = [];
  const missing = [];
  for (const p of plan) {
    const hasS = s.has(p.target);
    const hasT = t.has(p.target);
    if (!hasS || !hasT) {
      missing.push({ tbl: p.target, source: hasS, target: hasT });
      continue;
    }
    if (s.get(p.target) !== t.get(p.target)) {
      mismatches.push({ tbl: p.target, source: String(s.get(p.target)), target: String(t.get(p.target)) });
    }
  }
  const ok = mismatches.length === 0 && missing.length === 0;
  return {
    ok,
    mismatches,
    missing,
    detail: ok
      ? `row counts match on ${plan.length}/${plan.length} tables`
      : `row counts: ${mismatches.length} mismatched, ${missing.length} missing of ${plan.length} tables`,
    data: { tables: plan.length, mismatches, missing },
  };
}

// ---------------------------------------------------------------------------
// RLS / triggers
// ---------------------------------------------------------------------------

export function evaluateRls(plan, rows) {
  const byName = new Map((rows ?? []).map((r) => [r.relname, r.relrowsecurity === true]));
  const absent = [];
  const disabled = [];
  for (const p of plan) {
    if (!byName.has(p.target)) absent.push(p.target);
    else if (!byName.get(p.target)) disabled.push(p.target);
  }
  const enabled = plan.length - absent.length - disabled.length;
  const ok = absent.length === 0 && disabled.length === 0;
  return {
    ok,
    detail: `RLS enabled on ${enabled}/${plan.length} tables${ok ? '' : ` (absent: ${absent.length}, disabled: ${disabled.length})`}`,
    data: { enabled, total: plan.length, absent, disabled },
  };
}

export function evaluateTriggers(rows) {
  const list = rows ?? [];
  const notEnabled = list
    .filter((r) => r.tgenabled !== 'O')
    .map((r) => ({ relname: r.relname, tgname: r.tgname, tgenabled: r.tgenabled }));
  const ok = notEnabled.length === 0;
  return {
    ok,
    detail: `${list.length} triggers inspected, ${notEnabled.length} not in enabled-origin state`,
    data: { total: list.length, notEnabled },
  };
}

// ---------------------------------------------------------------------------
// Foreign keys / orphans
// ---------------------------------------------------------------------------

export function evaluateFks({ fkRows, authFkRows }) {
  const fks = fkRows ?? [];
  const auth = authFkRows ?? [];
  const unvalidated = fks.filter((f) => f.convalidated !== true).map((f) => f.conname);
  const problems = [];
  if (fks.length === 0) problems.push('FK discovery returned 0 constraints');
  if (auth.length === 0) problems.push('FK discovery to auth.users returned 0 columns (discovery bug, not "nothing to remap")');
  if (unvalidated.length > 0) problems.push(`${unvalidated.length} unvalidated constraints`);
  const ok = problems.length === 0;
  return {
    ok,
    detail: `${fks.length} FK constraints, ${auth.length} FK columns to auth.users${ok ? '' : `; ${problems.join('; ')}`}`,
    data: { fkCount: fks.length, authFkColumns: auth.length, unvalidated },
  };
}

function checkFkShape(fk) {
  zikoIdent(fk.child, 'child table');
  if (!Array.isArray(fk.child_cols) || !Array.isArray(fk.parent_cols) || fk.child_cols.length === 0) {
    throw new Error('FK column arrays missing');
  }
  if (fk.child_cols.length !== fk.parent_cols.length) throw new Error('FK column array length mismatch');
  fk.child_cols.forEach((c) => ident(c, 'child column'));
  fk.parent_cols.forEach((c) => ident(c, 'parent column'));
  if (fk.parent_schema === 'public') zikoIdent(fk.parent_table, 'parent table');
  else if (fk.parent_schema === 'auth') {
    if (fk.parent_table !== 'users') throw new Error('only auth.users may be referenced in auth schema');
  } else {
    throw new Error(`unsupported parent schema: ${JSON.stringify(fk.parent_schema)}`);
  }
  ident(fk.conname, 'constraint name');
}

export function buildOrphanSql(fk) {
  checkFkShape(fk);
  const notNull = fk.child_cols.map((c) => `c.${q(c)} IS NOT NULL`).join(' AND ');
  const join = fk.child_cols.map((c, i) => `p.${q(fk.parent_cols[i])} = c.${q(c)}`).join(' AND ');
  return `SELECT '${fk.conname}' AS conname, count(*)::bigint AS orphans FROM public.${q(fk.child)} c WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM ${q(fk.parent_schema)}.${q(fk.parent_table)} p WHERE ${join})`;
}

export function buildValidateConstraintSql(fk) {
  zikoIdent(fk.child, 'child table');
  ident(fk.conname, 'constraint name');
  return `ALTER TABLE public.${q(fk.child)} VALIDATE CONSTRAINT ${q(fk.conname)}`;
}

export function evaluateOrphans(rows) {
  const list = rows ?? [];
  const bad = list.filter((r) => big(r.orphans) > 0n).map((r) => ({ conname: r.conname, orphans: String(big(r.orphans)) }));
  const ok = bad.length === 0;
  return {
    ok,
    detail: ok
      ? `0 orphans across ${list.length} FK constraints`
      : `orphans found: ${bad.map((b) => `${b.conname}=${b.orphans}`).join(', ')}`,
    data: { checked: list.length, orphaned: bad },
  };
}
