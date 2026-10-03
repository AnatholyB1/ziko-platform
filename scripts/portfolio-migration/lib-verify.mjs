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

// ---------------------------------------------------------------------------
// Sequences (read-only: last_value / is_called, never advanced)
// ---------------------------------------------------------------------------

export const SEQUENCE_LIST_SQL = `SELECT sequencename
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename`;

// Sequences owned by (or identity-linked to) a table column.
export const OWNED_SEQUENCE_COLUMNS_SQL = `SELECT s.relname AS sequence, t.relname AS "table", a.attname AS "column"
FROM pg_class s
JOIN pg_depend d ON d.objid = s.oid
  AND d.classid = 'pg_class'::regclass
  AND d.refclassid = 'pg_class'::regclass
  AND d.deptype IN ('a', 'i')
JOIN pg_class t ON t.oid = d.refobjid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
WHERE s.relkind = 'S'
  AND s.relnamespace = 'public'::regnamespace
  AND left(t.relname, 5) = 'ziko_'
ORDER BY s.relname`;

// Column defaults that depend on a public sequence (serial-style referrers).
export const REFERRERS_SQL = `SELECT s.relname AS sequence, t.relname AS "table", a.attname AS "column"
FROM pg_class s
JOIN pg_depend d ON d.refobjid = s.oid AND d.classid = 'pg_attrdef'::regclass AND d.deptype = 'n'
JOIN pg_attrdef ad ON ad.oid = d.objid
JOIN pg_class t ON t.oid = ad.adrelid
JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
WHERE s.relkind = 'S'
  AND s.relnamespace = 'public'::regnamespace
ORDER BY s.relname`;

// The only consumer: the waitlist RPC writes the sequence value into founder_rank.
export const SEQUENCE_CONSUMERS = [
  { sequence: 'ziko_waitlist_founder_seq', table: 'ziko_waitlist_signups', column: 'founder_rank' },
];

export function mapSequenceName(source) {
  ident(source, 'source sequence');
  if (source.startsWith('ziko_')) throw new Error(`sequence already prefixed: ${source}`);
  return zikoIdent(`ziko_${source}`, 'target sequence');
}

export function buildSequenceStateSql(name, side) {
  if (side === 'target') zikoIdent(name, 'target sequence');
  else ident(name, 'sequence');
  return `SELECT last_value, is_called FROM public.${q(name)}`;
}

const POS_INT_RE = /^[1-9][0-9]*$/;

export function buildSetvalSql(target, state) {
  zikoIdent(target, 'target sequence');
  const v = String(state?.last_value);
  if (!POS_INT_RE.test(v)) throw new Error('last_value must be a positive integer');
  return `SELECT setval('public.${target}', ${v}, ${state.is_called === true ? 'true' : 'false'})`;
}

export function buildConsumerMaxSql(consumer) {
  zikoIdent(consumer.table, 'consumer table');
  ident(consumer.column, 'consumer column');
  return `SELECT coalesce(max(${q(consumer.column)}), 0)::bigint AS m FROM public.${q(consumer.table)}`;
}

export function evaluateSequences({ pairs, ownedColumns }) {
  const problems = [];
  const owned = ownedColumns ?? [];
  const byName = new Map();
  for (const p of pairs ?? []) {
    const label = p.source ?? p.target ?? '?';
    if (!p.target || !p.targetState || !p.sourceState) {
      problems.push(`${label}: missing on target`);
      continue;
    }
    byName.set(p.target, p);
    byName.set(p.source, p);
    const tv = big(p.targetState.last_value);
    if (tv !== big(p.sourceState.last_value) || Boolean(p.targetState.is_called) !== Boolean(p.sourceState.is_called)) {
      problems.push(`${p.target}: last_value/is_called differ from source`);
    }
    if (p.previousTargetState && tv < big(p.previousTargetState.last_value)) {
      problems.push(`${p.target}: regressed below previous target value`);
    }
    if (p.consumerMax !== undefined && p.consumerMax !== null && tv < big(p.consumerMax)) {
      problems.push(`${p.target}: last_value below max of consumer column`);
    }
  }
  for (const o of owned) {
    const pair = byName.get(o.sequence);
    if (!pair || !pair.targetState) problems.push(`${o.sequence}: owned column without compared pair`);
    else if (o.tableMax !== undefined && big(o.tableMax) > big(pair.targetState.last_value)) {
      problems.push(`${o.sequence}: ${o.table}.${o.column} max exceeds last_value`);
    }
  }
  const ok = problems.length === 0;
  return {
    ok,
    detail: `${(pairs ?? []).length} sequences compared, sequence-backed columns: ${owned.length}${ok ? '' : `; ${problems.join('; ')}`}`,
    data: { sequences: (pairs ?? []).length, sequenceBackedColumns: owned.length, problems },
  };
}

// ---------------------------------------------------------------------------
// UUID remap occurrence checks
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildUuidOccurrenceSql(names, uuid) {
  if (typeof uuid !== 'string' || !UUID_RE.test(uuid)) throw new Error('invalid uuid literal');
  if (!Array.isArray(names) || names.length === 0) throw new Error('no tables');
  return names
    .map((n) => {
      zikoIdent(n);
      return `SELECT '${n}' AS tbl, count(*)::bigint AS n FROM public.${q(n)} t WHERE t::text ILIKE '%${uuid}%'`;
    })
    .join('\nUNION ALL\n');
}

function occIndex(rows) {
  const m = new Map();
  for (const r of rows ?? []) m.set(r.tbl, big(r.n));
  return m;
}

function nonZero(rows) {
  return (rows ?? []).filter((r) => big(r.n) > 0n).map((r) => r.tbl);
}

export function evaluateRemap({ targetSourceOcc, targetTargetOcc, sourceSourceOcc, preLoadTargetOcc }) {
  const problems = [];
  const sourceOnTarget = nonZero(targetSourceOcc);
  if (sourceOnTarget.length > 0) problems.push(`source UUID present on target in ${sourceOnTarget.length} tables`);
  const tt = occIndex(targetTargetOcc);
  const ss = occIndex(sourceSourceOcc);
  const diff = [];
  for (const tbl of new Set([...tt.keys(), ...ss.keys()])) {
    if ((tt.get(tbl) ?? 0n) !== (ss.get(tbl) ?? 0n)) diff.push(tbl);
  }
  if (diff.length > 0) problems.push(`target UUID occurrence differs from source in ${diff.length} tables`);
  let preLoad = null;
  if (preLoadTargetOcc !== undefined && preLoadTargetOcc !== null) {
    preLoad = nonZero(preLoadTargetOcc);
    if (preLoad.length > 0) problems.push(`pre-load occurrences in ${preLoad.length} tables`);
  }
  const ok = problems.length === 0;
  return {
    ok,
    detail: ok
      ? 'source UUID absent on target; target UUID occurrences match source'
      : problems.join('; '),
    data: {
      sourceOnTargetTables: sourceOnTarget,
      occurrenceDiffTables: diff,
      preLoadTables: preLoad,
    },
  };
}

// ---------------------------------------------------------------------------
// Tenant (non-ziko) regression guard
// ---------------------------------------------------------------------------

export const TENANT_TABLES_SQL = `SELECT table_name AS tbl
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'ziko\\_%'
UNION ALL
SELECT 'auth.users' AS tbl
ORDER BY tbl`;

export function buildTenantCountsSql(names) {
  if (!Array.isArray(names) || names.length === 0) throw new Error('no tables');
  return names
    .map((n) => {
      if (n === 'auth.users') return `SELECT 'auth.users' AS tbl, count(*)::bigint AS n FROM auth.users`;
      ident(n, 'tenant table');
      return `SELECT '${n}' AS tbl, count(*)::bigint AS n FROM public.${q(n)}`;
    })
    .join('\nUNION ALL\n');
}

export function evaluateTenants(baseline, current) {
  const problems = [];
  const warnings = [];
  const cur = occIndex(current?.tables);
  for (const r of baseline?.tables ?? []) {
    const b = big(r.n);
    if (!cur.has(r.tbl)) {
      problems.push(`${r.tbl}: missing`);
      continue;
    }
    const c = cur.get(r.tbl);
    if (b > 0n && c === 0n) problems.push(`${r.tbl}: emptied`);
    else if (c !== b) warnings.push(`${r.tbl}: ${b} -> ${c}`);
  }
  if (big(current?.authUsers ?? 0) < big(baseline?.authUsers ?? 0)) problems.push('auth.users count decreased');
  else if (big(current?.authUsers ?? 0) !== big(baseline?.authUsers ?? 0)) {
    warnings.push(`auth.users: ${baseline.authUsers} -> ${current.authUsers}`);
  }
  const trig = (rows) => JSON.stringify([...(rows ?? [])].map((t) => [t.tgname, t.tgenabled]).sort());
  if (trig(baseline?.authTriggers) !== trig(current?.authTriggers)) problems.push('auth.users trigger state differs');
  const ok = problems.length === 0;
  return {
    ok,
    warnings,
    detail: ok
      ? `tenant tables intact (${(baseline?.tables ?? []).length} tables, ${warnings.length} row-count deltas)`
      : problems.join('; '),
    data: { problems, warnings },
  };
}

// ---------------------------------------------------------------------------
// Report safety
// ---------------------------------------------------------------------------

export function maskUuid(uuid) {
  return `${String(uuid).slice(0, 8)}-…`;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
const FULL_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function assertReportSafe(obj) {
  const text = JSON.stringify(obj);
  if (EMAIL_RE.test(text)) throw new Error('report contains an email address');
  if (FULL_UUID_RE.test(text)) throw new Error('report contains a full UUID');
  return true;
}
