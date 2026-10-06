import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRANT_SNAPSHOT_SQL,
  buildRevokeSql,
  buildReplaySql,
  diffGrantSnapshots,
  buildStateSnapshotSql,
  evaluateFreezeProof,
  evaluateFreezeStatus,
} from './19-decom-freeze.mjs';

const G = (grantee, table_name, privilege_type) => ({ grantee, table_name, privilege_type });

// ---------------------------------------------------------------- Task 1: pure builders

test('GRANT_SNAPSHOT_SQL targets public grants of the four roles and four privileges, ordered', () => {
  assert.match(GRANT_SNAPSHOT_SQL, /information_schema\.role_table_grants/);
  assert.match(GRANT_SNAPSHOT_SQL, /table_schema = 'public'/);
  for (const r of ['anon', 'authenticated', 'service_role', 'PUBLIC']) assert.ok(GRANT_SNAPSHOT_SQL.includes(`'${r}'`));
  for (const p of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) assert.ok(GRANT_SNAPSHOT_SQL.includes(`'${p}'`));
  assert.match(GRANT_SNAPSHOT_SQL, /ORDER BY/);
});

test('buildRevokeSql: fixed statement, PUBLIC only when granted', () => {
  const base = 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role';
  const noPub = buildRevokeSql([G('anon', 'profiles', 'INSERT')]);
  assert.ok(noPub.includes(base));
  assert.ok(!/FROM PUBLIC/.test(noPub));
  const withPub = buildRevokeSql([G('PUBLIC', 'profiles', 'INSERT')]);
  assert.ok(withPub.includes(base));
  assert.ok(/ON ALL TABLES IN SCHEMA public FROM PUBLIC/.test(withPub));
  assert.ok(buildRevokeSql([]).includes(base));
});

test('buildReplaySql: one GRANT per row, quoted identifiers', () => {
  const sql = buildReplaySql([G('anon', 'profiles', 'INSERT'), G('PUBLIC', 'logs', 'DELETE')]);
  assert.ok(sql.includes('GRANT INSERT ON public."profiles" TO anon'));
  assert.ok(sql.includes('GRANT DELETE ON public."logs" TO PUBLIC'));
  assert.equal(sql.split('GRANT').length - 1, 2);
  assert.equal(buildReplaySql([]), '');
});

test('buildReplaySql: injection, bad role and bad privilege are refused', () => {
  assert.throws(() => buildReplaySql([G('anon', 'x; drop table y', 'INSERT')]));
  assert.throws(() => buildReplaySql([G('postgres', 'profiles', 'INSERT')]));
  assert.throws(() => buildReplaySql([G('anon', 'profiles', 'SELECT')]));
  assert.throws(() => buildReplaySql([G('anon', 'profiles', 'INSERT; DROP')]));
});

test('diffGrantSnapshots is order-insensitive and reports added/removed', () => {
  const a = [G('anon', 'a', 'INSERT'), G('anon', 'b', 'UPDATE')];
  const b = [G('anon', 'b', 'UPDATE'), G('anon', 'a', 'INSERT')];
  assert.equal(diffGrantSnapshots(a, b).ok, true);
  const d = diffGrantSnapshots(a, [G('anon', 'a', 'INSERT'), G('anon', 'c', 'DELETE')]);
  assert.equal(d.ok, false);
  assert.equal(d.removed.length, 1);
  assert.equal(d.added.length, 1);
});

test('symmetry: snapshot -> revoke -> replay -> diff ok', () => {
  const snapshot = [G('anon', 'profiles', 'INSERT'), G('authenticated', 'profiles', 'UPDATE'), G('service_role', 'logs', 'DELETE'), G('PUBLIC', 'logs', 'TRUNCATE')];
  // model the database as a set of grants
  let db = new Set(snapshot.map((g) => `${g.grantee}|${g.table_name}|${g.privilege_type}`));
  const revoke = buildRevokeSql(snapshot);
  assert.ok(revoke.length > 0);
  db = new Set(); // REVOKE removes every grant of the four privileges
  const replay = buildReplaySql(snapshot);
  for (const m of replay.matchAll(/GRANT (\w+) ON public\."(\w+)" TO (\w+)/g)) db.add(`${m[3]}|${m[2]}|${m[1]}`);
  const after = [...db].map((k) => { const [grantee, table_name, privilege_type] = k.split('|'); return G(grantee, table_name, privilege_type); });
  assert.equal(diffGrantSnapshots(snapshot, after).ok, true);
});

test('buildStateSnapshotSql: one row per key, digests over given columns, storage per bucket', () => {
  const sql = buildStateSnapshotSql({ tables: ['profiles', 'logs'], authUserCols: ['id', 'email'], authIdentityCols: ['id', 'user_id'] });
  assert.ok(sql.includes("'public.profiles'"));
  assert.ok(sql.includes("'public.logs'"));
  assert.ok(sql.includes('FROM public."profiles"'));
  assert.ok(sql.includes("'auth.users'"));
  assert.ok(sql.includes("'auth.identities'"));
  assert.ok(sql.includes('"email"'));
  assert.match(sql, /storage\.objects/);
  assert.match(sql, /'storage:' \|\| /);
  assert.match(sql, /md5\(string_agg\(md5\(/);
  assert.match(sql, /ORDER BY md5\(/);
});

test('buildStateSnapshotSql refuses non-identifier names', () => {
  const ok = { tables: ['profiles'], authUserCols: ['id'], authIdentityCols: ['id'] };
  assert.throws(() => buildStateSnapshotSql({ ...ok, tables: ['x; drop'] }));
  assert.throws(() => buildStateSnapshotSql({ ...ok, authUserCols: ['id', 'a"b'] }));
  assert.throws(() => buildStateSnapshotSql({ ...ok, authIdentityCols: ['id)--'] }));
  assert.throws(() => buildStateSnapshotSql({ ...ok, authUserCols: [] }));
});

const keys = () => ({
  'public.profiles': { count: '3', size_sum: null, digest: 'aaaa' },
  'auth.users': { count: '2', size_sum: null, digest: 'bbbb' },
  'storage:avatars': { count: '5', size_sum: '100', digest: 'cccc' },
});

test('evaluateFreezeProof: identical snapshots pass', () => {
  const r = evaluateFreezeProof(keys(), keys());
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.differing_keys, []);
});

test('evaluateFreezeProof: a single digest change fails and names only the key', () => {
  const t1 = keys();
  t1['public.profiles'].digest = 'dddd';
  const r = evaluateFreezeProof(keys(), t1);
  assert.equal(r.ok, false);
  assert.deepEqual(r.data.differing_keys, ['public.profiles']);
  assert.ok(!r.detail.includes('aaaa') && !r.detail.includes('dddd'));
});

test('evaluateFreezeProof: key set difference and count difference fail', () => {
  const t1 = keys();
  delete t1['auth.users'];
  assert.equal(evaluateFreezeProof(keys(), t1).ok, false);
  const t2 = keys();
  t2['storage:avatars'].count = '6';
  const r = evaluateFreezeProof(keys(), t2);
  assert.equal(r.ok, false);
  assert.deepEqual(r.data.differing_keys, ['storage:avatars']);
  const t3 = keys();
  t3['storage:avatars'].size_sum = '101';
  assert.equal(evaluateFreezeProof(keys(), t3).ok, false);
});

test('evaluateFreezeStatus: ok only when no write privilege is held', () => {
  assert.equal(evaluateFreezeStatus([]).ok, true);
  assert.equal(evaluateFreezeStatus([{ role_name: 'anon', table_name: 'profiles', privilege: 'INSERT' }]).ok, false);
  assert.equal(evaluateFreezeStatus([{ role_name: 'anon', table_name: 'profiles', privilege: 'INSERT', granted: false }]).ok, true);
});

// ---------------------------------------------------------------- Task 2: CLI

import { run, snapshotPath } from './19-decom-freeze.mjs';
import { PROJECTS } from '../auth-merge/lib.mjs';

const TOKEN = 'sbp_testtoken1234567890';
const ZIKO = PROJECTS.ziko;

function makeDeps({ signup = false, patchOk = true, patchFails = null, grants = [G('anon', 'profiles', 'INSERT')], revokeFails = false, files = {}, statusRows = [] } = {}) {
  const sqlCalls = [];
  const fetchCalls = [];
  const out = [];
  const written = {};
  const store = { ...files };
  let live = signup;
  let currentGrants = grants;
  const deps = {
    sqlCalls, fetchCalls, out, written, store,
    runSql: async (ref, sql) => {
      sqlCalls.push({ ref, sql });
      if (sql.startsWith('REVOKE') && revokeFails) throw new Error('revoke failed');
      if (sql.startsWith('REVOKE')) { currentGrants = []; return []; }
      if (sql.startsWith('GRANT')) {
        currentGrants = [...sql.matchAll(/GRANT (\w+) ON public\."(\w+)" TO (\w+)/g)].map((m) => G(m[3], m[2], m[1]));
        return [];
      }
      if (sql.includes('role_table_grants')) return currentGrants;
      if (sql.includes('has_table_privilege')) return statusRows;
      if (sql.includes('relname AS table_name')) return [{ table_name: 'profiles' }];
      return [{ key: 'public.profiles', count: 1, size_sum: null, digest: 'aa' }];
    },
    fetchImpl: async (url, opts) => {
      fetchCalls.push({ url, method: opts.method, body: opts.body });
      if (opts.method === 'GET') return { ok: true, status: 200, json: async () => ({ disable_signup: live }) };
      if (patchFails) throw new Error(patchFails);
      if (!patchOk) return { ok: false, status: 403, json: async () => ({}) };
      live = JSON.parse(opts.body).disable_signup;
      return { ok: true, status: 200, json: async () => ({}) };
    },
    loadToken: async () => TOKEN,
    fetchColumns: async () => ['id', 'email', 'updated_at'],
    readText: async (p) => { const k = String(p).replaceAll('\\', '/'); if (k in store) return store[k]; throw new Error(`ENOENT ${k}`); },
    writeText: async (p, t) => { const k = String(p).replaceAll('\\', '/'); written[k] = t; store[k] = t; },
    fileExists: (p) => String(p).replaceAll('\\', '/') in store,
    now: () => '2026-10-04T00:00:00.000Z',
    log: (m) => out.push(String(m)),
    errlog: (m) => out.push(String(m)),
  };
  deps.live = () => live;
  return deps;
}
const patches = (d) => d.fetchCalls.filter((c) => c.method === 'PATCH');
const SNAP = () => snapshotPath('ziko').replaceAll('\\', '/');

test('refusals have zero side effects: portfolio, missing/wrong confirm-ref', async () => {
  for (const argv of [
    ['--target', 'portfolio', '--apply', '--confirm-ref', PROJECTS.portfolio],
    ['--target', 'ziko', '--apply', '--confirm-ref', PROJECTS.portfolio],
    ['--target', 'ziko', '--apply'],
    ['--target', 'ziko', '--apply', '--confirm-ref', PROJECTS.scratch],
    ['--target', 'scratch', '--unfreeze', '--confirm-ref', ZIKO],
    ['--target', 'ziko', '--probe-auth-config'],
  ]) {
    const d = makeDeps();
    assert.equal(await run(argv, d), 1, argv.join(' '));
    assert.equal(d.sqlCalls.length, 0);
    assert.equal(d.fetchCalls.length, 0);
  }
});

test('bad args exit 2', async () => {
  const d = makeDeps();
  assert.equal(await run(['--target', 'ziko'], d), 2);
  assert.equal(await run(['--apply'], d), 2);
  assert.equal(await run(['--target', 'ziko', '--bogus'], d), 2);
});

test('--apply order: PATCH true, grant snapshot written, REVOKE, status; stores prior value', async () => {
  const d = makeDeps({ signup: false });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 0);
  assert.equal(JSON.parse(patches(d)[0].body).disable_signup, true);
  assert.ok(d.sqlCalls.every((c) => c.ref === ZIKO));
  const snap = JSON.parse(d.written[SNAP()]);
  assert.equal(snap.prior_disable_signup, false);
  assert.equal(snap.grants.length, 1);
  assert.equal(d.sqlCalls.filter((c) => c.sql.startsWith('REVOKE')).length, 1);
  assert.equal(d.live(), true);
});

test('refused PATCH during --apply: exit 1, zero runSql, no REVOKE', async () => {
  const d = makeDeps({ patchOk: false });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 1);
  assert.equal(d.sqlCalls.length, 0);
});

test('failing REVOKE patches signup back to the prior value', async () => {
  const d = makeDeps({ signup: false, revokeFails: true });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 1);
  const ps = patches(d);
  assert.equal(ps.length, 2);
  assert.equal(JSON.parse(ps[0].body).disable_signup, true);
  assert.equal(JSON.parse(ps[1].body).disable_signup, false);
  assert.equal(d.live(), false);
});

test('second --apply does not overwrite the freeze-state snapshot', async () => {
  const original = JSON.stringify({ target: 'ziko', generated_at: 'x', prior_disable_signup: false, grants: [{ grantee: 'anon', table: 'profiles', privilege: 'INSERT' }] });
  const d = makeDeps({ signup: true, files: { [SNAP()]: original } });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 0);
  assert.equal(d.written[SNAP()], undefined);
  assert.equal(d.store[SNAP()], original);
  assert.equal(d.sqlCalls.some((c) => c.sql.includes('role_table_grants')), false);
});

test('--apply fails when status still shows write privileges', async () => {
  const d = makeDeps({ statusRows: [{ role_name: 'anon', table_name: 'profiles', privilege: 'INSERT' }] });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 1);
});

test('--probe-auth-config: one no-op PATCH with the value read, zero SQL', async () => {
  for (const v of [true, false]) {
    const d = makeDeps({ signup: v });
    assert.equal(await run(['--target', 'ziko', '--probe-auth-config', '--confirm-ref', ZIKO, '--json-out', 'probe.json'], d), 0);
    assert.equal(patches(d).length, 1);
    assert.equal(JSON.parse(patches(d)[0].body).disable_signup, v);
    assert.equal(d.sqlCalls.length, 0);
    const doc = JSON.parse(d.written['probe.json']);
    assert.deepEqual(Object.keys(doc).sort(), ['auth_config_patch', 'get_status', 'patch_status', 'target', 'unchanged']);
    assert.equal(doc.auth_config_patch, 'ok');
    assert.equal(doc.unchanged, true);
  }
});

test('--probe-auth-config: refused PATCH exits 1 and records refused', async () => {
  const d = makeDeps({ patchOk: false });
  assert.equal(await run(['--target', 'ziko', '--probe-auth-config', '--confirm-ref', ZIKO, '--json-out', 'probe.json'], d), 1);
  assert.equal(JSON.parse(d.written['probe.json']).auth_config_patch, 'refused');
});

test('--unfreeze refuses when the snapshot file is missing', async () => {
  const d = makeDeps();
  assert.equal(await run(['--target', 'ziko', '--unfreeze', '--confirm-ref', ZIKO], d), 1);
  assert.equal(d.sqlCalls.length, 0);
  assert.equal(d.fetchCalls.length, 0);
});

test('apply then unfreeze restores grants and signup', async () => {
  const d = makeDeps({ signup: false, grants: [G('anon', 'profiles', 'INSERT'), G('authenticated', 'profiles', 'UPDATE')] });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 0);
  assert.equal(d.live(), true);
  assert.equal(await run(['--target', 'ziko', '--unfreeze', '--confirm-ref', ZIKO], d), 0);
  assert.equal(d.live(), false);
});

test('--unfreeze exits 1 when the re-snapshot differs', async () => {
  const snap = JSON.stringify({ target: 'ziko', generated_at: 'x', prior_disable_signup: false, grants: [{ grantee: 'anon', table: 'profiles', privilege: 'INSERT' }, { grantee: 'anon', table: 'gone', privilege: 'INSERT' }] });
  const d = makeDeps({ files: { [SNAP()]: snap } });
  d.runSql = async (ref, sql) => { d.sqlCalls.push({ ref, sql }); return sql.includes('role_table_grants') ? [G('anon', 'profiles', 'INSERT')] : []; };
  assert.equal(await run(['--target', 'ziko', '--unfreeze', '--confirm-ref', ZIKO], d), 1);
});

test('--prove: equal passes, differing digest fails, output names keys only', async () => {
  const t0 = JSON.stringify({ target: 'ziko', generated_at: 'T0', keys: { 'public.profiles': { count: '1', size_sum: null, digest: 'aa' } } });
  const ok = makeDeps({ files: { 't0.json': t0 } });
  assert.equal(await run(['--target', 'ziko', '--prove', '--against', 't0.json', '--out', 'proof.json'], ok), 0);
  const proof = JSON.parse(ok.written['proof.json']);
  assert.deepEqual(Object.keys(proof).sort(), ['differing_keys', 'passed', 't0_generated_at', 't1_generated_at', 'target']);
  assert.equal(proof.passed, true);

  const bad = makeDeps({ files: { 't0.json': t0.replace('"aa"', '"zz"') } });
  assert.equal(await run(['--target', 'ziko', '--prove', '--against', 't0.json', '--out', 'proof.json'], bad), 1);
  assert.deepEqual(JSON.parse(bad.written['proof.json']).differing_keys, ['public.profiles']);
});

test('--snapshot-state excludes volatile auth columns and writes keys', async () => {
  const d = makeDeps();
  assert.equal(await run(['--target', 'scratch', '--snapshot-state', '--out', 's.json'], d), 0);
  const sql = d.sqlCalls.map((c) => c.sql).find((s) => s.includes("'auth.users'"));
  assert.ok(sql && !sql.includes('updated_at'));
  assert.ok(JSON.parse(d.written['s.json']).keys['public.profiles']);
});

test('--plan and --help run no SQL and no fetch', async () => {
  const d = makeDeps();
  assert.equal(await run(['--target', 'ziko', '--plan'], d), 0);
  assert.equal(await run(['--help'], d), 0);
  assert.equal(d.sqlCalls.length, 0);
  assert.equal(d.fetchCalls.length, 0);
});

test('token never appears in output even when the request error carries it', async () => {
  const d = makeDeps({ patchFails: `network down ${TOKEN}` });
  assert.equal(await run(['--target', 'ziko', '--apply', '--confirm-ref', ZIKO], d), 1);
  assert.ok(!d.out.join('\n').includes(TOKEN));
  assert.ok(d.out.join('\n').includes('[secret]'));
});
