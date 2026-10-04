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
  buildPublicOrphanSql,
  run,
} from './21-decom-restore-proof.mjs';
import { PROJECTS } from '../auth-merge/lib.mjs';
import { sha256Hex } from './lib-storage.mjs';

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

test('buildPublicOrphanSql validates identifiers and shapes the anti-join', () => {
  const fk = { conname: 'fk_a', child: 'a', parent_schema: 'auth', parent_table: 'users', child_cols: ['user_id'], parent_cols: ['id'] };
  const sql = buildPublicOrphanSql(fk);
  assert.match(sql, /FROM public\."a" c WHERE c\."user_id" IS NOT NULL AND NOT EXISTS \(SELECT 1 FROM "auth"\."users" p WHERE p\."id" = c\."user_id"\)/);
  assert.throws(() => buildPublicOrphanSql({ ...fk, parent_schema: 'storage' }), /schema/);
  assert.throws(() => buildPublicOrphanSql({ ...fk, child: 'a; drop' }), /invalid/);
});

// ---------------------------------------------------------------- CLI (all side effects injected)

const SCRATCH = PROJECTS.scratch;
const ZIKO = PROJECTS.ziko;
const PORTFOLIO = PROJECTS.portfolio;
const REPO = 'C:\\repo-under-test';
const GOOD_OBJ = Buffer.from('hello-object');
const OBJ_SHA = sha256Hex(GOOD_OBJ);

function makeWorld({ scratchName = 'ziko-migration-scratch', emptyCounts, pgRestore, verifyOverrides = {}, decryptOk = true, deleteNotEmptyTimes = 0 } = {}) {
  const w = {
    fetches: [],
    sql: { scratch: [], ziko: [] },
    connects: [],
    storage: [],
    runs: [],
    copies: [],
    removed: [],
    written: {},
    gates: [],
    deleted: [],
    uploads: [],
    decrypts: 0,
    ended: 0,
  };
  const zeros = { public_tables: 0, auth_users: 0, auth_identities: 0, buckets: 0, objects: 0 };
  let state = emptyCounts ?? zeros;

  const route = (side) => (sql, params) => {
    w.sql[side].push(String(sql));
    const s = String(sql);
    if (s.includes('AS public_tables')) return { rows: [state] };
    if (s.includes('current_setting')) return { rows: [{ v: 'replica' }] };
    if (s.includes('information_schema.columns')) return { rows: [{ column_name: 'id' }, { column_name: 'email' }] };
    if (s.includes('count(*) FROM auth.users)::int AS u')) return { rows: [{ u: 2, i: 2 }] };
    if (s.includes('FROM information_schema.tables')) return { rows: [{ tbl: 'habits' }] };
    if (s.includes("'auth.users' AS tbl")) return { rows: [{ tbl: 'auth.users', n: '2', digest: verifyOverrides.authDigest?.[side] ?? 'au' }] };
    if (s.includes("'auth.identities' AS tbl")) return { rows: [{ tbl: 'auth.identities', n: '2', digest: 'ai' }] };
    if (s.includes('AS digest FROM public')) return { rows: [{ tbl: 'habits', n: '5', digest: verifyOverrides.tableDigest?.[side] ?? 'd1' }] };
    if (s.includes('relrowsecurity')) return { rows: [{ relname: 'habits', relrowsecurity: true }] };
    if (s.includes('FROM pg_policies')) return { rows: [{ tablename: 'habits', policyname: 'own' }] };
    if (s.includes('FROM pg_trigger')) return { rows: [{ relname: 'habits', tgname: 'trg' }] };
    if (s.includes('FROM pg_proc')) return { rows: [{ proname: 'fn' }] };
    if (s.includes('FROM pg_constraint')) return { rows: [{ conname: 'fk1', child: 'habits', parent_schema: 'auth', parent_table: 'users', child_cols: ['user_id'], parent_cols: ['id'], convalidated: true }] };
    if (s.includes('AS orphans')) return { rows: [{ conname: 'fk1', orphans: verifyOverrides.orphans ?? '0' }] };
    if (s.includes('FROM storage.objects')) return { rows: [{ bucket_id: 'avatars', name: 'u/1.png', size: 12, mimetype: 'image/png', cache_control: null, etag: 'e' }] };
    return { rows: [] };
  };
  const mkClient = (side) => ({ query: async (...a) => route(side)(...a), end: async () => { w.ended++; } });
  const storageFor = (label) => ({
    storage: {
      listBuckets: async () => { w.storage.push(`${label}:listBuckets`); return { data: [{ id: 'avatars' }], error: null }; },
      emptyBucket: async (id) => { w.storage.push(`${label}:emptyBucket:${id}`); return { error: null }; },
      deleteBucket: async (id) => {
        w.storage.push(`${label}:deleteBucket:${id}`);
        if (deleteNotEmptyTimes > 0) { deleteNotEmptyTimes--; return { error: { message: 'The bucket you tried to delete is not empty' } }; }
        if (!emptyCounts) state = zeros;
        return { error: null };
      },
      createBucket: async (id, o) => { w.storage.push(`${label}:createBucket:${id}:${o.public}`); return { error: null }; },
      from: (bucket) => ({
        upload: async (key) => { w.uploads.push(`${bucket}/${key}`); return { error: null }; },
        download: async () => ({ data: { arrayBuffer: async () => GOOD_OBJ }, error: null }),
      }),
    },
  });
  const files = {
    '/tmp-pass': 'p'.repeat(32),
    'manifest.json': JSON.stringify({
      extensions: [{ extname: 'unaccent', extversion: '1.1' }],
      rls_tables: ['habits'],
      policies: [{ tablename: 'habits', policyname: 'own' }],
      triggers: [{ relname: 'habits', tgname: 'trg' }],
      functions: [{ proname: 'fn' }],
    }),
    'storage-manifest.json': JSON.stringify({
      buckets: [{ id: 'avatars', public: true, file_size_limit: null, allowed_mime_types: null }],
      objects: [{ bucket: 'avatars', name: 'u/1.png', sha256: OBJ_SHA, mimetype: 'image/png', cache_control: null }],
    }),
    'storage/avatars/u/1.png': GOOD_OBJ,
  };
  const norm = (p) => String(p).replaceAll('\\', '/');
  const deps = {
    repoRoot: REPO,
    tmpdir: 'C:\\Temp',
    log: () => {},
    errlog: (m) => { (w.errs ??= []).push(String(m)); },
    loadToken: async () => 'tok-secret-value',
    fetchImpl: async (url, opts = {}) => {
      w.fetches.push({ url: String(url), method: opts.method ?? 'GET' });
      return { ok: true, status: 200, json: async () => ({ name: scratchName, ref: SCRATCH }) };
    },
    connect: async (ref, o) => {
      w.connects.push({ ref, readOnly: o.readOnly });
      return { client: mkClient(ref === SCRATCH ? 'scratch' : 'ziko'), role: 'cli_login_postgres', effective: 'postgres' };
    },
    loginRole: async () => ({ role: 'cli_login_postgres', password: 'pw-secret-value-123', host: 'aws-0-x.pooler.supabase.com', port: 5432 }),
    deleteRoles: async (ref) => { w.deleted.push(ref); return true; },
    getKeys: async () => ({ secret: 'sk-secret-key-value' }),
    storageFactory: (url) => storageFor(url.includes(SCRATCH) ? 'scratch' : 'ziko'),
    runner: (cmd, args, o) => { w.runs.push({ cmd, args, env: o?.env }); state = { public_tables: 3, auth_users: 2, auth_identities: 2, buckets: 0, objects: 1 }; return pgRestore ?? { status: 0, stdout: '', stderr: 'pg_restore: error: could not execute query: ERROR:  schema "public" already exists\n' }; },
    copyIn: async (client, sql, file) => { w.copies.push({ sql, file: norm(file) }); },
    decrypt: async ({ outDir }) => { w.decrypts++; w.outDir = outDir; return decryptOk ? { ok: true, tampered: [], missing: [], unlisted: [] } : { ok: false, tampered: ['db/full.dump'], missing: [], unlisted: [] }; },
    recordGate: (key, o) => { w.gates.push({ key, ...o }); },
    readFile: async (p) => {
      const n = norm(p);
      if (n === '/tmp-pass' || n.endsWith('/tmp-pass')) return files['/tmp-pass'];
      for (const k of Object.keys(files)) if (n.endsWith(`/${k}`)) return files[k];
      throw new Error(`ENOENT ${n}`);
    },
    writeFile: async (p, t) => { w.written[norm(p)] = t; },
    rm: async (p) => { w.removed.push(p); },
    fileExists: async () => false,
  };
  return { w, deps };
}

const noSideEffects = (w) => {
  assert.equal(w.fetches.length, 0, 'no fetch');
  assert.equal(w.connects.length, 0, 'no connect');
  assert.equal(w.sql.scratch.length + w.sql.ziko.length, 0, 'no sql');
  assert.equal(w.storage.length, 0, 'no storage');
  assert.equal(w.runs.length, 0, 'no pg_restore');
  assert.equal(w.decrypts, 0, 'no decrypt');
};

test('CLI refuses ziko, portfolio and missing confirm-ref with zero side effects', async () => {
  for (const confirm of [ZIKO, PORTFOLIO, null]) {
    for (const mode of ['--wipe', '--restore', '--verify', '--all']) {
      const { w, deps } = makeWorld();
      const argv = [mode, ...(confirm ? ['--confirm-ref', confirm] : []), '--archive', 'a.gpg', '--passphrase-file', '/tmp-pass', '--json-out', 'r.json'];
      assert.equal(await run(argv, deps), 1, `${mode} ${confirm}`);
      noSideEffects(w);
    }
  }
});

test('CLI has no way to pick another project (unknown --project-ref is a usage error)', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run(['--wipe', '--project-ref', ZIKO, '--confirm-ref', ZIKO], deps), 2);
  noSideEffects(w);
});

test('CLI refuses when the Management API name does not match: zero SQL and zero storage', async () => {
  const { w, deps } = makeWorld({ scratchName: 'ziko' });
  assert.equal(await run(['--wipe', '--confirm-ref', SCRATCH], deps), 1);
  assert.equal(w.fetches.length, 1);
  assert.equal(w.connects.length, 0);
  assert.equal(w.sql.scratch.length, 0);
  assert.equal(w.storage.length, 0);
});

test('--wipe runs the fixed SQL, empties and deletes every bucket, asserts empty', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run(['--wipe', '--confirm-ref', SCRATCH], deps), 0);
  assert.ok(w.sql.scratch.includes(buildWipeSql()));
  assert.deepEqual(w.storage, ['scratch:listBuckets', 'scratch:emptyBucket:avatars', 'scratch:deleteBucket:avatars']);
  assert.equal(w.sql.ziko.length, 0);
  assert.ok(w.deleted.includes(SCRATCH));
  assert.ok(!w.connects.some((c) => c.ref !== SCRATCH), 'only scratch connected');
});

test('--wipe re-empties and retries deleteBucket when the bucket is reported not empty', async () => {
  const { w, deps } = makeWorld({ deleteNotEmptyTimes: 1 });
  assert.equal(await run(['--wipe', '--confirm-ref', SCRATCH], deps), 0);
  assert.deepEqual(w.storage, ['scratch:listBuckets', 'scratch:emptyBucket:avatars', 'scratch:deleteBucket:avatars', 'scratch:emptyBucket:avatars', 'scratch:deleteBucket:avatars']);
});

test('--wipe --json-out writes a passed all-zero report', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run(['--wipe', '--confirm-ref', SCRATCH, '--json-out', 'C:\ziko-platform\wipe.json'], deps), 0);
  const rep = JSON.parse(Object.values(w.written)[0]);
  assert.equal(rep.passed, true);
  assert.deepEqual(Object.values(rep.counts), [0, 0, 0, 0, 0]);
});

test('--wipe fails (exit 1) when scratch is still not empty afterwards', async () => {
  const { w, deps } = makeWorld({ emptyCounts: { public_tables: 3, auth_users: 0, auth_identities: 0, buckets: 0, objects: 0 } });
  // the fake never clears public tables, so the post-wipe assertion must trip
  assert.equal(await run(['--wipe', '--confirm-ref', SCRATCH], deps), 1);
  assert.ok(w.deleted.includes(SCRATCH), 'login roles cleaned up on failure');
});

const RESTORE_ARGV = ['--restore', '--confirm-ref', SCRATCH, '--archive', 'C:\\bk\\a.tar.gpg', '--passphrase-file', '/tmp-pass'];

test('--restore is refused when scratch is not empty: no decrypt, no pg_restore', async () => {
  const { w, deps } = makeWorld({ emptyCounts: { public_tables: 1, auth_users: 0, auth_identities: 0, buckets: 0, objects: 0 } });
  assert.equal(await run(RESTORE_ARGV, deps), 1);
  assert.equal(w.decrypts, 0);
  assert.equal(w.runs.length, 0);
  assert.equal(w.copies.length, 0);
});

test('--restore: auth COPY in one replica transaction, pg_restore argv, buckets and objects', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run(RESTORE_ARGV, deps), 0);
  const s = w.sql.scratch;
  const iBegin = s.indexOf('BEGIN');
  const iSet = s.indexOf('SET LOCAL session_replication_role = replica');
  const iCommit = s.indexOf('COMMIT');
  assert.ok(iBegin >= 0 && iSet > iBegin && iCommit > iSet);
  assert.equal(w.copies.length, 2);
  assert.match(w.copies[0].sql, /^COPY auth\."users" \("id", "email"\) FROM STDIN$/);
  assert.match(w.copies[1].sql, /^COPY auth\."identities"/);
  assert.match(w.copies[0].file, /copy\/auth\.users\.copy$/);
  assert.equal(w.runs.length, 1);
  assert.equal(w.runs[0].cmd, 'pg_restore');
  assert.deepEqual(w.runs[0].args.slice(0, 6), ['--no-owner', '--role=postgres', '--schema=public', '--no-privileges', '-d', 'postgres']);
  assert.ok(!w.runs[0].args.join(' ').includes('pw-secret'), 'password never in argv');
  assert.equal(w.runs[0].env.PGPASSWORD, 'pw-secret-value-123');
  assert.deepEqual(w.storage, ['scratch:createBucket:avatars:true']);
  assert.deepEqual(w.uploads, ['avatars/u/1.png']);
  assert.equal(w.removed.length, 1);
  assert.equal(w.removed[0], w.outDir, 'temp dir removed');
  assert.ok(w.deleted.includes(SCRATCH));
});

test('--restore recreates archive extensions missing from scratch before pg_restore', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run(RESTORE_ARGV, deps), 0);
  assert.ok(w.sql.scratch.some((x) => x === 'CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public'));
});

test('--restore removes the temp dir and fails when pg_restore reports a fatal error', async () => {
  const { w, deps } = makeWorld({ pgRestore: { status: 1, stdout: '', stderr: 'pg_restore: error: could not execute query: ERROR:  relation "habits" already exists\n' } });
  assert.equal(await run(RESTORE_ARGV, deps), 1);
  assert.deepEqual(w.removed, [w.outDir]);
  assert.deepEqual(w.uploads, [], 'storage untouched after a failed DB restore');
  assert.ok(w.errs.some((e) => /pg_restore failed/.test(e)));
});

test('--restore stops on a failed archive checksum verification and still removes the temp dir', async () => {
  const { w, deps } = makeWorld({ decryptOk: false });
  assert.equal(await run(RESTORE_ARGV, deps), 1);
  assert.equal(w.runs.length, 0);
  assert.equal(w.copies.length, 0);
  assert.deepEqual(w.removed, [w.outDir]);
});

test('secrets never reach error output', async () => {
  const { w, deps } = makeWorld({ pgRestore: { status: 1, stdout: '', stderr: 'pg_restore: error: FATAL: bad pw-secret-value-123 tok-secret-value\n' } });
  assert.equal(await run(RESTORE_ARGV, deps), 1);
  const out = w.errs.join('\n');
  assert.doesNotMatch(out, /pw-secret-value-123|tok-secret-value|sk-secret-key-value/);
});

const VERIFY_ARGV = ['--verify', '--confirm-ref', SCRATCH, '--archive', 'C:\\bk\\a.tar.gpg', '--passphrase-file', '/tmp-pass', '--json-out', 'C:\\repo-under-test\\scripts\\portfolio-migration\\reports\\decom-restore-proof.json', '--record-gate'];

test('--verify passing writes the report and records restore_proven with a repo-relative path', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run(VERIFY_ARGV, deps), 0, (w.errs ?? []).join('\n'));
  const key = Object.keys(w.written).find((k) => k.endsWith('decom-restore-proof.json'));
  const rep = JSON.parse(w.written[key]);
  assert.equal(rep.passed, true);
  assert.equal(rep.auth_method, 'data-restore + fingerprint (GoTrue DDL not replayed)');
  assert.deepEqual(w.gates, [{ key: 'restore_proven', evidence: 'scripts/portfolio-migration/reports/decom-restore-proof.json' }]);
  assert.equal(w.sql.scratch.filter((s) => /^(DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|CREATE)/i.test(s)).length, 0, 'verify issues no writes');
  assert.equal(w.sql.ziko.filter((s) => !/^\s*(SELECT|WITH)/i.test(s)).length, 0, 'ziko only sees SELECTs');
  assert.deepEqual(w.connects.find((c) => c.ref === ZIKO), { ref: ZIKO, readOnly: true });
  assert.deepEqual(w.removed, [w.outDir]);
});

test('--verify failing (row digest differs) does not record the gate and exits 1', async () => {
  const { w, deps } = makeWorld({ verifyOverrides: { tableDigest: { ziko: 'a', scratch: 'b' } } });
  assert.equal(await run(VERIFY_ARGV, deps), 1);
  assert.deepEqual(w.gates, []);
  const key = Object.keys(w.written).find((k) => k.endsWith('decom-restore-proof.json'));
  assert.equal(JSON.parse(w.written[key]).passed, false);
});

test('--verify failing on orphans does not record the gate', async () => {
  const { w, deps } = makeWorld({ verifyOverrides: { orphans: '2' } });
  assert.equal(await run(VERIFY_ARGV, deps), 1);
  assert.deepEqual(w.gates, []);
});

test('--record-gate with a json-out outside the repo is refused', async () => {
  const { w, deps } = makeWorld();
  const argv = VERIFY_ARGV.map((a) => (a.includes('decom-restore-proof.json') ? 'C:\\elsewhere\\r.json' : a));
  assert.equal(await run(argv, deps), 1);
  assert.deepEqual(w.gates, []);
});

test('--all runs wipe, restore and verify in order and stops at the first failure', async () => {
  const ok = makeWorld();
  const argv = ['--all', '--confirm-ref', SCRATCH, '--archive', 'C:\\bk\\a.tar.gpg', '--passphrase-file', '/tmp-pass', '--json-out', 'C:\\repo-under-test\\r.json'];
  assert.equal(await run(argv, ok.deps), 0, (ok.w.errs ?? []).join('\n'));
  const s = ok.w.sql.scratch;
  assert.ok(s.indexOf(buildWipeSql()) < s.indexOf('BEGIN'), 'wipe before restore');
  assert.equal(ok.w.runs.length, 1);
  assert.equal(ok.w.decrypts, 1, 'archive decrypted once');

  const bad = makeWorld({ pgRestore: { status: 1, stdout: '', stderr: 'pg_restore: error: FATAL: boom\n' } });
  assert.equal(await run(argv, bad.deps), 1);
  assert.deepEqual(Object.keys(bad.w.written), [], 'no verify report after a failed restore');
});

test('bad arguments exit 2 without side effects', async () => {
  const { w, deps } = makeWorld();
  assert.equal(await run([], deps), 2);
  assert.equal(await run(['--wipe', '--restore', '--confirm-ref', SCRATCH], deps), 2);
  assert.equal(await run(['--restore', '--confirm-ref', SCRATCH], deps), 2);
  assert.equal(await run(['--verify', '--confirm-ref', SCRATCH, '--archive', 'a', '--passphrase-file', 'p'], deps), 2);
  assert.equal(await run(['--wipe', '--record-gate', '--confirm-ref', SCRATCH], deps), 2);
  noSideEffects(w);
});
