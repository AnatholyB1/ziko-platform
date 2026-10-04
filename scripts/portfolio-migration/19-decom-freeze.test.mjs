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
