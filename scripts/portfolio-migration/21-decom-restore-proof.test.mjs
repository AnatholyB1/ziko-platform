import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWipeSql,
  evaluateEmpty,
  classifyRestoreErrors,
  buildTableDigestSql,
  buildAuthFingerprintSql,
  evaluateSameName,
  evaluateInventory,
  evaluateObjectHashes,
  buildRestoreReport,
} from './21-decom-restore-proof.mjs';

// ---------------------------------------------------------------- wipe

test('buildWipeSql is pinned exactly (snapshot)', () => {
  assert.equal(
    buildWipeSql(),
    [
      'DROP SCHEMA IF EXISTS public CASCADE;',
      'CREATE SCHEMA public;',
      'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;',
      'TRUNCATE auth.users CASCADE;',
    ].join('\n'),
  );
});

test('evaluateEmpty is ok only when everything is zero', () => {
  const zero = { publicTables: 0, authUsers: 0, authIdentities: 0, buckets: 0, objects: 0 };
  assert.equal(evaluateEmpty(zero).ok, true);
  for (const k of Object.keys(zero)) {
    const r = evaluateEmpty({ ...zero, [k]: 1 });
    assert.equal(r.ok, false, k);
    assert.match(r.detail, new RegExp(k));
  }
  assert.equal(evaluateEmpty({}).ok, false, 'missing counts are not empty');
  assert.equal(evaluateEmpty({ ...zero, objects: '3' }).ok, false, 'string counts are coerced');
});

// ---------------------------------------------------------------- restore stderr

test('classifyRestoreErrors tolerates the known kinds and flags everything else', () => {
  const stderr = [
    'pg_restore: error: could not execute query: ERROR:  schema "public" already exists',
    'Command was: CREATE SCHEMA public;',
    'pg_restore: error: could not execute query: ERROR:  extension "pgcrypto" already exists',
    'Command was: CREATE EXTENSION pgcrypto;',
    'pg_restore: error: could not execute query: ERROR:  role "supabase_admin" already exists',
    'pg_restore: error: could not execute query: ERROR:  unrecognized configuration parameter "transaction_timeout"',
    'Command was: SET transaction_timeout = 0;',
    'pg_restore: error: could not execute query: ERROR:  must be owner of extension pg_trgm',
    'pg_restore: error: could not execute query: ERROR:  relation "habits" already exists',
    'pg_restore: warning: errors ignored on restore: 6',
  ].join('\n');
  const r = classifyRestoreErrors(stderr);
  const byKind = Object.fromEntries(r.tolerated.map((t) => [t.kind, t.count]));
  assert.equal(byKind['already-exists'], 3);
  assert.equal(byKind['unrecognized-configuration-parameter'], 1);
  assert.equal(byKind['must-be-owner-of-extension'], 1);
  assert.equal(r.fatal.length, 1);
  assert.match(r.fatal[0], /relation "habits" already exists/);
});

test('classifyRestoreErrors: empty stderr is clean, bare errors and FATAL are fatal', () => {
  assert.deepEqual(classifyRestoreErrors(''), { tolerated: [], fatal: [] });
  const r = classifyRestoreErrors('pg_restore: error: connection to server failed\nFATAL:  password authentication failed');
  assert.equal(r.fatal.length, 2);
});

// ---------------------------------------------------------------- digests

test('buildTableDigestSql builds count + ordered row md5 per table and validates identifiers', () => {
  const sql = buildTableDigestSql(['habits', 'user_profiles']);
  assert.match(sql, /count\(\*\)::bigint AS n/);
  assert.match(sql, /md5\(coalesce\(string_agg\(md5\(t::text\), '' ORDER BY md5\(t::text\)\), ''\)\) AS digest/);
  assert.match(sql, /FROM public\."habits" t/);
  assert.match(sql, /UNION ALL/);
  assert.throws(() => buildTableDigestSql(['x"; drop table y; --']), /invalid/);
  assert.throws(() => buildTableDigestSql([]), /at least one/);
});

test('buildAuthFingerprintSql excludes volatile columns and never selects raw values', () => {
  const sql = buildAuthFingerprintSql('users');
  assert.match(sql, /auth\.users/);
  assert.match(sql, /last_sign_in_at/);
  assert.match(sql, /recovery_token/);
  assert.doesNotMatch(sql, /SELECT\s+email/i);
  assert.throws(() => buildAuthFingerprintSql('sessions'), /not allowed/);
});

test('evaluateSameName: equal passes; missing table, count and digest differences fail with names only', () => {
  const rows = [
    { tbl: 'a', n: '3', digest: 'x' },
    { tbl: 'b', n: 0, digest: 'y' },
  ];
  assert.equal(evaluateSameName({ source: rows, target: rows.map((r) => ({ ...r })) }).ok, true);
  const miss = evaluateSameName({ source: rows, target: [rows[0]] });
  assert.equal(miss.ok, false);
  assert.deepEqual(miss.data.missingOnTarget, ['b']);
  const extra = evaluateSameName({ source: [rows[0]], target: rows });
  assert.equal(extra.ok, false);
  assert.deepEqual(extra.data.missingOnSource, ['b']);
  const cnt = evaluateSameName({ source: rows, target: [{ tbl: 'a', n: '4', digest: 'x' }, rows[1]] });
  assert.equal(cnt.ok, false);
  assert.deepEqual(cnt.data.countDiff, ['a']);
  const dig = evaluateSameName({ source: rows, target: [{ tbl: 'a', n: '3', digest: 'z' }, rows[1]] });
  assert.equal(dig.ok, false);
  assert.deepEqual(dig.data.digestDiff, ['a']);
  assert.doesNotMatch(dig.detail, /\bz\b/, 'digest values are not echoed');
  assert.equal(evaluateSameName({ source: [], target: [] }).ok, false, 'zero tables is vacuous');
});

// ---------------------------------------------------------------- inventory

const MANIFEST = {
  rls_tables: ['a', 'b'],
  policies: [
    { tablename: 'a', policyname: 'p1' },
    { tablename: 'a', policyname: 'p2' },
    { tablename: 'b', policyname: 'p3' },
  ],
  triggers: [
    { relname: 'a', tgname: 't1' },
    { relname: 'users', tgname: 'auth_only', nspname: 'auth' },
  ],
  functions: [{ proname: 'f1' }, { proname: 'f2' }],
};
const LIVE = {
  rls: [
    { relname: 'a', relrowsecurity: true },
    { relname: 'b', relrowsecurity: true },
    { relname: 'c', relrowsecurity: false },
  ],
  policies: [
    { tablename: 'a', policyname: 'p1' },
    { tablename: 'a', policyname: 'p2' },
    { tablename: 'b', policyname: 'p3' },
  ],
  triggers: [{ relname: 'a', tgname: 't1' }],
  functions: [{ proname: 'f1' }, { proname: 'f2' }],
};

test('evaluateInventory passes on equal inventories (non-public manifest rows ignored)', () => {
  const r = evaluateInventory({ manifest: MANIFEST, live: LIVE });
  assert.equal(r.ok, true, r.detail);
});

test('evaluateInventory fails on RLS, policy, trigger and function differences', () => {
  const rls = evaluateInventory({ manifest: MANIFEST, live: { ...LIVE, rls: LIVE.rls.slice(0, 1) } });
  assert.equal(rls.ok, false);
  assert.deepEqual(rls.data.rlsDiff, ['b']);
  const pol = evaluateInventory({ manifest: MANIFEST, live: { ...LIVE, policies: LIVE.policies.slice(0, 2) } });
  assert.equal(pol.ok, false);
  assert.deepEqual(pol.data.policyDiff, ['b']);
  const trg = evaluateInventory({ manifest: MANIFEST, live: { ...LIVE, triggers: [] } });
  assert.equal(trg.ok, false);
  assert.deepEqual(trg.data.triggerDiff, ['a']);
  const fn = evaluateInventory({ manifest: MANIFEST, live: { ...LIVE, functions: [{ proname: 'f1' }] } });
  assert.equal(fn.ok, false);
  assert.deepEqual(fn.data.functionDiff, ['f2']);
});

test('evaluateInventory reports a manifest without rls_tables as skipped, not as a pass of that dimension', () => {
  const { rls_tables: _drop, ...noRls } = MANIFEST;
  const r = evaluateInventory({ manifest: noRls, live: LIVE });
  assert.equal(r.ok, true);
  assert.equal(r.data.rlsCompared, false);
});

// ---------------------------------------------------------------- object hashes

const H = (c) => c.repeat(64);

test('evaluateObjectHashes: three-way equal passes', () => {
  const a = [{ bucket: 'avatars', name: 'u/1.png', sha256: H('a') }];
  const r = evaluateObjectHashes({ archiveManifest: a, scratchHashes: a, zikoHashes: a });
  assert.equal(r.ok, true);
  assert.equal(r.data.checked, 1);
});

test('evaluateObjectHashes: missing, mismatch and extras fail with masked names', () => {
  const a = [
    { bucket: 'avatars', name: 'secret/name@x.png', sha256: H('a') },
    { bucket: 'avatars', name: 'other.png', sha256: H('b') },
  ];
  const missing = evaluateObjectHashes({ archiveManifest: a, scratchHashes: [a[0]], zikoHashes: a });
  assert.equal(missing.ok, false);
  assert.equal(missing.data.missingOnScratch.length, 1);
  const bad = evaluateObjectHashes({
    archiveManifest: a,
    scratchHashes: [{ ...a[0], sha256: H('c') }, a[1]],
    zikoHashes: a,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.data.mismatch.length, 1);
  const zMissing = evaluateObjectHashes({ archiveManifest: a, scratchHashes: a, zikoHashes: [a[0]] });
  assert.equal(zMissing.ok, false);
  const extra = evaluateObjectHashes({
    archiveManifest: [a[0]],
    scratchHashes: a,
    zikoHashes: [a[0]],
  });
  assert.equal(extra.ok, false);
  for (const r of [missing, bad, zMissing, extra]) {
    assert.doesNotMatch(JSON.stringify(r), /secret\/name|@x\.png|other\.png/);
  }
  assert.equal(evaluateObjectHashes({ archiveManifest: [], scratchHashes: [], zikoHashes: [] }).ok, false, 'zero objects is vacuous');
});

// ---------------------------------------------------------------- report

test('buildRestoreReport carries the D-07 deviation and auth method and is commit-safe', () => {
  const rep = buildRestoreReport({
    checks: { counts: { ok: true, detail: '3 tables', data: null } },
  });
  assert.equal(rep.passed, true);
  assert.equal(rep.auth_method, 'data-restore + fingerprint (GoTrue DDL not replayed)');
  assert.ok(Array.isArray(rep.deviations) && rep.deviations.length >= 1);
  const text = rep.deviations.join(' ');
  assert.match(text, /06-verify-data/);
  assert.match(text, /09-verify-storage/);
  assert.match(text, /ziko_/);
  assert.equal(buildRestoreReport({ checks: { a: { ok: false, detail: 'x', data: null } } }).passed, false);
  const red = buildRestoreReport({ checks: { a: { ok: true, detail: 'user@example.com', data: null } } });
  assert.doesNotMatch(JSON.stringify(red), /user@example\.com/, 'details are redacted');
  assert.throws(
    () => buildRestoreReport({ checks: { a: { ok: true, detail: 'x', data: { who: 'user@example.com' } } } }),
    /email/,
  );
});
