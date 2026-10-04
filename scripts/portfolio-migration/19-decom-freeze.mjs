#!/usr/bin/env node
/**
 * 19-decom-freeze.mjs - Phase 7 reversible write-freeze (D-02).
 *
 * Mechanism: REVOKE INSERT/UPDATE/DELETE/TRUNCATE on all public tables from anon, authenticated and
 * service_role (and PUBLIC when granted), plus disable_signup. Reads keep working. Function EXECUTE is
 * NOT revoked (it would break read RPCs); REVOKE also does not stop SECURITY DEFINER functions, GoTrue
 * or Storage writes, so the real gate is the measured proof: state snapshot T0 == T1.
 *
 * All SQL comes from the pure builders below (identifier whitelist, role and privilege whitelists, no
 * free-form SQL input). Refs come only from DECOM_REFS; there is no --project-ref flag.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCliArgs,
  isMain,
  redactPii,
  runSql,
  loadAccessToken,
  fetchNonGeneratedColumns,
  VOLATILE_AUTH_USER_COLUMNS,
  VOLATILE_AUTH_IDENTITY_COLUMNS,
} from '../auth-merge/lib.mjs';
import { redactSecrets } from './lib-conn.mjs';
import { quoteIdent } from './lib-data.mjs';
import { DECOM_REFS, assertZikoFreezeAllowed, assertCommittedSafe } from './18-decom-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const ROLES = Object.freeze(['anon', 'authenticated', 'service_role']);
const GRANT_ROLES = Object.freeze([...ROLES, 'PUBLIC']);
const PRIVS = Object.freeze(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']);

const sqlList = (xs) => xs.map((x) => `'${x}'`).join(', ');

// ---------------------------------------------------------------- pure builders

export const GRANT_SNAPSHOT_SQL = `SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN (${sqlList(GRANT_ROLES)})
   AND privilege_type IN (${sqlList(PRIVS)})
 ORDER BY grantee, table_name, privilege_type`;

export const TABLES_SQL = `SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 ORDER BY c.relname`;

/** Offending rows only: a role still holding a write privilege on a public table. */
export const FREEZE_STATUS_SQL = `SELECT r.rolname AS role_name, c.relname AS table_name, p.priv AS privilege
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
 CROSS JOIN (VALUES ${ROLES.map((r) => `('${r}')`).join(', ')}) AS r(rolname)
 CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
 WHERE c.relkind = 'r'
   AND has_table_privilege(r.rolname, format('public.%I', c.relname), p.priv)
 ORDER BY 1, 2, 3`;

function normGrant(row) {
  return {
    grantee: row?.grantee,
    table: row?.table ?? row?.table_name,
    privilege: row?.privilege ?? row?.privilege_type,
  };
}

export function normalizeGrants(rows) {
  return (rows ?? []).map(normGrant);
}

export function buildRevokeSql(snapshotRows) {
  const base = `REVOKE ${PRIVS.join(', ')} ON ALL TABLES IN SCHEMA public FROM`;
  const stmts = [`${base} ${ROLES.join(', ')}`];
  if (normalizeGrants(snapshotRows).some((g) => g.grantee === 'PUBLIC')) stmts.push(`${base} PUBLIC`);
  return `${stmts.join(';\n')};`;
}

export function buildReplaySql(rows) {
  const stmts = normalizeGrants(rows).map((g) => {
    if (!GRANT_ROLES.includes(g.grantee)) throw new Error('replay refused: role not allowed');
    if (!PRIVS.includes(g.privilege)) throw new Error('replay refused: privilege not allowed');
    return `GRANT ${g.privilege} ON public.${quoteIdent(g.table)} TO ${g.grantee}`;
  });
  return stmts.length ? `${stmts.join(';\n')};` : '';
}

const grantKey = (g) => `${g.grantee}|${g.table}|${g.privilege}`;

export function diffGrantSnapshots(a, b) {
  const A = new Map(normalizeGrants(a).map((g) => [grantKey(g), g]));
  const B = new Map(normalizeGrants(b).map((g) => [grantKey(g), g]));
  const removed = [...A.keys()].filter((k) => !B.has(k)).sort().map((k) => A.get(k));
  const added = [...B.keys()].filter((k) => !A.has(k)).sort().map((k) => B.get(k));
  return { ok: removed.length === 0 && added.length === 0, added, removed };
}

function assertIdents(list, what) {
  if (!Array.isArray(list)) throw new Error(`${what} must be a list`);
  for (const n of list) quoteIdent(n); // throws on non-identifier
}

export function buildStateSnapshotSql({ tables, authUserCols, authIdentityCols } = {}) {
  assertIdents(tables, 'tables');
  assertIdents(authUserCols, 'authUserCols');
  assertIdents(authIdentityCols, 'authIdentityCols');
  if (!authUserCols.length || !authIdentityCols.length) throw new Error('auth column lists must not be empty');
  const parts = [];
  for (const t of tables) {
    parts.push(
      `SELECT 'public.${t}' AS key, count(*)::text AS count, NULL::text AS size_sum, ` +
        `coalesce(md5(string_agg(md5(r::text), '' ORDER BY md5(r::text))), '') AS digest FROM public.${quoteIdent(t)} r`,
    );
  }
  const colRow = (cols) => `ROW(${cols.map((c) => `x.${quoteIdent(c)}`).join(', ')})::text`;
  for (const [key, tbl, cols] of [
    ['auth.users', 'auth.users', authUserCols],
    ['auth.identities', 'auth.identities', authIdentityCols],
  ]) {
    parts.push(
      `SELECT '${key}' AS key, count(*)::text AS count, NULL::text AS size_sum, ` +
        `coalesce(md5(string_agg(md5(${colRow(cols)}), '' ORDER BY md5(${colRow(cols)}))), '') AS digest FROM ${tbl} x`,
    );
  }
  parts.push(
    `SELECT 'storage:' || b.id AS key, count(o.id)::text AS count, coalesce(sum((o.metadata->>'size')::bigint), 0)::text AS size_sum, ` +
      `md5(coalesce(string_agg(o.name || '|' || coalesce(o.metadata->>'size', '') || '|' || coalesce(o.metadata->>'eTag', ''), ',' ORDER BY o.name), '')) AS digest ` +
      `FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id = b.id GROUP BY b.id`,
  );
  return `${parts.join('\nUNION ALL\n')}\nORDER BY key`;
}

/** Rows {key,count,size_sum,digest} -> keyed map. */
export function rowsToKeys(rows) {
  const out = {};
  for (const r of rows ?? []) {
    out[r.key] = { count: String(r.count), size_sum: r.size_sum == null ? null : String(r.size_sum), digest: r.digest };
  }
  return out;
}

const asKeys = (x) => (Array.isArray(x) ? rowsToKeys(x) : x ?? {});
const same = (a, b) =>
  a && b && String(a.count) === String(b.count) && (a.size_sum ?? null) === (b.size_sum ?? null) && a.digest === b.digest;

export function evaluateFreezeProof(t0, t1) {
  const A = asKeys(t0);
  const B = asKeys(t1);
  const all = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const differing = all.filter((k) => !same(A[k], B[k]));
  if (differing.length === 0) return { ok: true, detail: `${all.length} keys identical`, data: { differing_keys: [] } };
  return { ok: false, detail: `${differing.length} of ${all.length} keys differ: ${differing.join(', ')}`, data: { differing_keys: differing } };
}

export function evaluateFreezeStatus(rows) {
  const offenders = (rows ?? []).filter((r) => r.granted !== false);
  if (offenders.length === 0) return { ok: true, detail: 'no write privilege held by anon, authenticated, service_role', data: { offenders: 0 } };
  return { ok: false, detail: `${offenders.length} write privileges still held`, data: { offenders: offenders.length } };
}
