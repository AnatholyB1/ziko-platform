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

// ---------------------------------------------------------------- CLI

const API = 'https://api.supabase.com';

const SPEC = {
  target: 'string',
  'confirm-ref': 'string',
  plan: 'boolean',
  'snapshot-grants': 'boolean',
  'probe-auth-config': 'boolean',
  apply: 'boolean',
  unfreeze: 'boolean',
  status: 'boolean',
  'snapshot-state': 'boolean',
  prove: 'boolean',
  against: 'string',
  out: 'string',
  'json-out': 'string',
};

const MODES = ['plan', 'snapshotGrants', 'probeAuthConfig', 'apply', 'unfreeze', 'status', 'snapshotState', 'prove'];

const HELP = `Usage: node scripts/portfolio-migration/19-decom-freeze.mjs --target ziko|scratch <mode>
  --plan                                   print the statements, execute nothing
  --snapshot-grants                        print the public write-grant snapshot (read-only)
  --probe-auth-config --confirm-ref <ref> [--json-out <file>]   no-op PATCH of disable_signup
  --apply --confirm-ref <ref>              disable signup, snapshot grants, REVOKE, verify
  --unfreeze --confirm-ref <ref>           replay the grant snapshot, restore signup, verify by diff
  --status                                 exit 0 only if no write privilege is held
  --snapshot-state --out <file>            write the state snapshot (counts and digests only)
  --prove --against <t0.json> --out <proof.json>   take T1 and compare with T0
Exit codes: 0 ok | 1 refused or failed | 2 bad args`;

export const snapshotPath = (target) => join(HERE, 'baseline', `decom-${target}-freeze-state.json`);

function defaultDeps() {
  return {
    runSql,
    fetchImpl: (...a) => fetch(...a),
    loadToken: loadAccessToken,
    fetchColumns: fetchNonGeneratedColumns,
    readText: (p) => readFileSync(p, 'utf8'),
    writeText: (p, t) => writeFileSync(p, t, 'utf8'),
    fileExists: (p) => existsSync(p),
    now: () => new Date().toISOString(),
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
  };
}

const json = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

export async function run(argv, depsIn = {}) {
  const deps = { ...defaultDeps(), ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)) };
  const { log, errlog } = deps;
  let token = null;
  const safe = (m) => redactSecrets(m, [token]);
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: errlog });
  if (badArgs) return 2;
  if (args.help) {
    log(HELP);
    return 0;
  }
  const active = MODES.filter((m) => args[m]);
  if (active.length !== 1) {
    errlog('ERROR: exactly one mode is required');
    return 2;
  }
  const mode = active[0];
  if (!args.target) {
    errlog('ERROR: --target ziko|scratch is required');
    return 2;
  }

  // Gate: before any SQL or API side effect.
  const needsConfirm = ['probeAuthConfig', 'apply', 'unfreeze'].includes(mode);
  try {
    if (args.confirmRef === DECOM_REFS.portfolio) throw new Error('Refusing: portfolio ref is never allowed');
    assertZikoFreezeAllowed({ target: args.target, confirmRef: needsConfirm ? args.confirmRef : DECOM_REFS[args.target] });
  } catch (e) {
    errlog(`ERROR: ${safe(e.message)}`);
    return 1;
  }
  const target = args.target;
  const ref = DECOM_REFS[target];
  const file = snapshotPath(target);

  const authApi = async (method, body) =>
    deps.fetchImpl(`${API}/v1/projects/${ref}/config/auth`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const getSignup = async () => {
    const res = await authApi('GET');
    if (!res.ok) return { status: res.status, value: null };
    const j = await res.json();
    return { status: res.status, value: typeof j?.disable_signup === 'boolean' ? j.disable_signup : null };
  };
  const patchSignup = async (value) => authApi('PATCH', { disable_signup: value });

  const takeState = async () => {
    const tables = (await deps.runSql(ref, TABLES_SQL)).map((r) => r.table_name);
    const uCols = (await deps.fetchColumns(ref, 'users')).filter((c) => !VOLATILE_AUTH_USER_COLUMNS.includes(c));
    const iCols = (await deps.fetchColumns(ref, 'identities')).filter((c) => !VOLATILE_AUTH_IDENTITY_COLUMNS.includes(c));
    const rows = await deps.runSql(ref, buildStateSnapshotSql({ tables, authUserCols: uCols, authIdentityCols: iCols }));
    return { target, generated_at: deps.now(), keys: rowsToKeys(rows) };
  };

  try {
    if (mode === 'plan') {
      log('-- grant snapshot (read-only)');
      log(GRANT_SNAPSHOT_SQL);
      log('-- freeze');
      log(`${buildRevokeSql([]).replace(/;$/, '')} (+ the same FROM PUBLIC only if the snapshot holds a PUBLIC grant)`);
      log('-- status check');
      log(FREEZE_STATUS_SQL);
      log('-- also: PATCH disable_signup true BEFORE the REVOKE; restored on --unfreeze');
      return 0;
    }

    if (mode === 'snapshotGrants') {
      const rows = await deps.runSql(ref, GRANT_SNAPSHOT_SQL);
      log(JSON.stringify(normalizeGrants(rows)));
      return 0;
    }

    if (mode === 'status') {
      const r = evaluateFreezeStatus(await deps.runSql(ref, FREEZE_STATUS_SQL));
      log(`[${r.ok ? 'PASS' : 'FAIL'}] freeze-status: ${r.detail}`);
      return r.ok ? 0 : 1;
    }

    if (mode === 'snapshotState') {
      if (!args.out) {
        errlog('ERROR: --out <file> is required');
        return 2;
      }
      const doc = await takeState();
      assertCommittedSafe(doc);
      await deps.writeText(args.out, json(doc));
      log(`state snapshot written: ${Object.keys(doc.keys).length} keys`);
      return 0;
    }

    if (mode === 'prove') {
      if (!args.against || !args.out) {
        errlog('ERROR: --against <t0.json> and --out <proof.json> are required');
        return 2;
      }
      const t0 = JSON.parse(await deps.readText(args.against));
      const t1 = await takeState();
      const r = evaluateFreezeProof(t0.keys, t1.keys);
      const proof = { target, t0_generated_at: t0.generated_at ?? null, t1_generated_at: t1.generated_at, passed: r.ok, differing_keys: r.data.differing_keys };
      assertCommittedSafe(proof);
      await deps.writeText(args.out, json(proof));
      log(`[${r.ok ? 'PASS' : 'FAIL'}] freeze-proof: ${r.detail}`);
      return r.ok ? 0 : 1;
    }

    // From here on the Management API token is needed.
    token = await deps.loadToken();

    if (mode === 'probeAuthConfig') {
      const before = await getSignup();
      const doc = { target, get_status: before.status, patch_status: null, unchanged: false, auth_config_patch: 'refused' };
      let okProbe = false;
      if (before.value !== null) {
        const res = await patchSignup(before.value);
        doc.patch_status = res.status;
        const after = await getSignup();
        doc.unchanged = after.value === before.value;
        okProbe = res.ok && doc.unchanged;
        doc.auth_config_patch = okProbe ? 'ok' : 'refused';
      }
      if (args.jsonOut) await deps.writeText(args.jsonOut, json(doc));
      log(`auth-config patch: ${doc.auth_config_patch} (get ${doc.get_status}, patch ${doc.patch_status ?? 'n/a'}, unchanged ${doc.unchanged})`);
      return okProbe ? 0 : 1;
    }

    if (mode === 'apply') {
      // Prior value: reuse the stored one on a repeat apply (the live value is already true then).
      const existing = deps.fileExists(file) ? JSON.parse(await deps.readText(file)) : null;
      let prior;
      if (existing) {
        prior = existing.prior_disable_signup;
      } else {
        const cur = await getSignup();
        if (cur.value === null) {
          errlog(`ERROR: cannot read auth config (HTTP ${cur.status}); nothing changed`);
          return 1;
        }
        prior = cur.value;
      }
      // PATCH before any SQL: a refusal leaves zero side effects.
      const p = await patchSignup(true);
      if (!p.ok) {
        errlog(`ERROR: disable_signup PATCH refused (HTTP ${p.status}); nothing changed`);
        return 1;
      }
      const undoSignup = async () => {
        try {
          const u = await patchSignup(prior);
          if (!u.ok) errlog(`WARNING: could not restore disable_signup (HTTP ${u.status}); restore it manually to ${prior}`);
        } catch (e) {
          errlog(`WARNING: could not restore disable_signup: ${safe(e.message)}; restore it manually to ${prior}`);
        }
      };
      try {
        let grants;
        if (existing) {
          grants = normalizeGrants(existing.grants);
        } else {
          grants = normalizeGrants(await deps.runSql(ref, GRANT_SNAPSHOT_SQL));
          const doc = { target, generated_at: deps.now(), prior_disable_signup: prior, grants };
          assertCommittedSafe(doc);
          await deps.writeText(file, json(doc));
        }
        await deps.runSql(ref, buildRevokeSql(grants));
      } catch (e) {
        await undoSignup();
        throw e;
      }
      const st = evaluateFreezeStatus(await deps.runSql(ref, FREEZE_STATUS_SQL));
      log(`[${st.ok ? 'PASS' : 'FAIL'}] freeze-status: ${st.detail}`);
      return st.ok ? 0 : 1;
    }

    if (mode === 'unfreeze') {
      if (!deps.fileExists(file)) {
        errlog('ERROR: freeze-state snapshot missing; refusing to unfreeze blind');
        return 1;
      }
      const snap = JSON.parse(await deps.readText(file));
      const replay = buildReplaySql(snap.grants); // validates before anything runs
      if (replay) await deps.runSql(ref, replay);
      const u = await patchSignup(snap.prior_disable_signup);
      if (!u.ok) {
        errlog(`ERROR: could not restore disable_signup (HTTP ${u.status}); grants were replayed`);
        return 1;
      }
      const d = diffGrantSnapshots(snap.grants, await deps.runSql(ref, GRANT_SNAPSHOT_SQL));
      if (!d.ok) {
        errlog(`ERROR: grants differ after replay (added ${d.added.length}, removed ${d.removed.length})`);
        return 1;
      }
      log('unfrozen: grants replayed byte-equal, signup restored');
      return 0;
    }
    return 2;
  } catch (e) {
    errlog(`ERROR: ${safe(e?.message ?? e)}`);
    return 1;
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
