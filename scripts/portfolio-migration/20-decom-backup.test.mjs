import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPgDumpArgs, buildPgEnv, buildGpgEncryptArgs, buildGpgDecryptArgs, buildManifest,
  renderChecksums, parseChecksums, buildBackupReport, encryptArchive, decryptArchive,
  hashDirectory, verifyDirectory, resolveGpg, resolveTar, CHECKSUMS_FILE,
} from './20-decom-backup.mjs';
import { ENV_MATRIX } from './17-env-switch.mjs';
import { REPO_ROOT } from './18-decom-guard.mjs';

const PASS = randomBytes(32).toString('base64url');

test('buildPgDumpArgs per mode, no URL and no password in argv', () => {
  const full = buildPgDumpArgs({ mode: 'full', file: 'x/db.dump', parentRole: 'postgres' });
  assert.deepEqual(full, ['-Fc', '--schema=public', '--schema=auth', '--role=postgres', '--file=x/db.dump']);
  const meta = buildPgDumpArgs({ mode: 'storage-meta', file: 'x/s.dump', parentRole: 'postgres' });
  assert.ok(meta.includes('-Fc') && meta.includes('--schema=storage') && meta.includes('--data-only'));
  const schema = buildPgDumpArgs({ mode: 'schema-only', file: 'x/s.sql', parentRole: 'postgres' });
  assert.ok(schema.includes('--schema-only') && !schema.includes('-Fc'));
  for (const a of [full, meta, schema]) {
    assert.ok(!a.join(' ').includes('://'));
    assert.ok(!/password/i.test(a.join(' ')));
  }
  assert.throws(() => buildPgDumpArgs({ mode: 'bogus', file: 'f', parentRole: 'postgres' }), /mode/);
  assert.throws(() => buildPgDumpArgs({ mode: 'full', file: 'postgres://u:p@h/db', parentRole: 'postgres' }), /URL/);
  assert.throws(() => buildPgDumpArgs({ mode: 'full', file: 'f', parentRole: 'x; drop' }), /role/);
});

test('buildPgEnv returns PG env vars only', () => {
  const env = buildPgEnv({ host: 'pooler.example.test', port: 5432, user: 'login.ref', password: 'pw-value' });
  assert.deepEqual(env, {
    PGHOST: 'pooler.example.test', PGPORT: '5432', PGUSER: 'login.ref', PGPASSWORD: 'pw-value',
    PGDATABASE: 'postgres', PGSSLMODE: 'require',
  });
  const v = buildPgEnv({ host: 'h.test', port: 5432, user: 'u', password: 'p', sslRootCert: 'ca.crt' });
  assert.equal(v.PGSSLMODE, 'verify-full');
  assert.equal(v.PGSSLROOTCERT, 'ca.crt');
  assert.throws(() => buildPgEnv({ host: 'h', port: 5432, user: 'u' }), /password/);
});

test('gpg argv carries the required flags and never the passphrase', () => {
  const enc = buildGpgEncryptArgs({ input: 'in.tar', output: 'out.gpg' });
  for (const f of ['--batch', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256']) {
    assert.ok(enc.includes(f), f);
  }
  assert.equal(enc[enc.indexOf('--passphrase-fd') + 1], '0');
  const dec = buildGpgDecryptArgs({ input: 'out.gpg', output: 'o.tar' });
  assert.ok(dec.includes('--decrypt') && dec.includes('--passphrase-fd') && dec.includes('--batch'));
  assert.ok(!enc.concat(dec).some((a) => a.includes(PASS)));
});

test('buildManifest reduces secret-like auth keys to names and lists env key names only', () => {
  const envBefore = { ...process.env };
  process.env.SUPABASE_SERVICE_KEY = 'super-secret-env-value-123';
  try {
    const m = buildManifest({
      serverVersion: '15.1',
      authConfig: {
        site_url: 'https://app.example.test',
        smtp_pass: 'hunter2-value',
        external_google_secret: 'gsecret-value',
        jwt_secret: 'jwtsecret-value',
        hook_token: '',
        mailer_autoconfirm: true,
      },
      buckets: [{ id: 'b1' }],
    });
    const text = JSON.stringify(m);
    for (const leaked of ['hunter2-value', 'gsecret-value', 'jwtsecret-value', 'super-secret-env-value-123']) {
      assert.ok(!text.includes(leaked), leaked);
    }
    assert.deepEqual(m.auth_config.smtp_pass, { name: 'smtp_pass', present: true });
    assert.deepEqual(m.auth_config.hook_token, { name: 'hook_token', present: false });
    assert.equal(m.auth_config.site_url, 'https://app.example.test');
    assert.equal(m.auth_config.mailer_autoconfirm, true);
    assert.deepEqual(m.env_key_names.api, Object.keys(ENV_MATRIX.api));
    assert.deepEqual(m.env_key_names.web, Object.keys(ENV_MATRIX.web));
    assert.equal(m.server_version, '15.1');
  } finally {
    delete process.env.SUPABASE_SERVICE_KEY;
    assert.equal(process.env.PATH, envBefore.PATH);
  }
});

test('renderChecksums sorts by path and parseChecksums is its inverse', () => {
  const entries = [
    { path: 'z/file', sha256: 'b'.repeat(64) },
    { path: 'a/file', sha256: 'a'.repeat(64) },
  ];
  const text = renderChecksums(entries);
  assert.equal(text, `${'a'.repeat(64)}  a/file\n${'b'.repeat(64)}  z/file\n`);
  assert.deepEqual(parseChecksums(text), [entries[1], entries[0]]);
  assert.throws(() => parseChecksums('not a checksum line\n'), /malformed/);
});

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'decom-backup-test-'));
  const dir = join(root, 'backup');
  mkdirSync(join(dir, 'db'), { recursive: true });
  mkdirSync(join(dir, 'storage', 'b1'), { recursive: true });
  writeFileSync(join(dir, 'db', 'full.dump'), 'dump-bytes');
  writeFileSync(join(dir, 'storage', 'b1', 'a.txt'), 'object-bytes');
  writeFileSync(join(dir, 'manifest.json'), '{}');
  writeFileSync(join(dir, CHECKSUMS_FILE), renderChecksums(hashDirectory(dir)));
  return { root, dir };
}

test('verifyDirectory reports a tampered path, a missing file and an unlisted file', () => {
  const { root, dir } = makeFixture();
  try {
    assert.equal(verifyDirectory(dir).ok, true);
    writeFileSync(join(dir, 'db', 'full.dump'), 'dump-bytez');
    rmSync(join(dir, 'manifest.json'));
    writeFileSync(join(dir, 'extra.txt'), 'x');
    const r = verifyDirectory(dir);
    assert.equal(r.ok, false);
    assert.deepEqual(r.tampered, ['db/full.dump']);
    assert.deepEqual(r.missing, ['manifest.json']);
    assert.deepEqual(r.unlisted, ['extra.txt']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildBackupReport is aggregate-only and passes the committed-content check', () => {
  const r = buildBackupReport({
    archiveName: 'ziko-backup.tar.gpg', archiveSha256: 'c'.repeat(64), archiveBytes: 10, plaintextBytes: 20,
    tableCounts: { profiles: 39 }, buckets: [{ id: 'scan-photos', objects: 3, bytes: 99 }],
    storageManifestSha256: 'd'.repeat(64), manifestSha256: 'e'.repeat(64), toolVersions: { gpg: '2.4.9' },
  });
  assert.equal(r.archive.file, 'ziko-backup.tar.gpg');
  assert.equal(r.tables.profiles, 39);
  assert.equal(r.buckets[0].objects, 3);
  assert.throws(() => buildBackupReport({ archiveName: 'a@b.test', archiveSha256: 'c' }), /email|@|committed|report/i);
  assert.throws(() => buildBackupReport({ archiveName: 'x', toolVersions: { t: 'eyJhbGciOiJIUzI1NiJ9abc' } }), /JWT/);
});

test('encryptArchive and decryptArchive refuse paths inside the repo before any spawn', () => {
  const calls = [];
  const deps = { spawn: (...a) => { calls.push(a); return { status: 0, stdout: 'v' }; }, exists: () => true };
  const outside = join(tmpdir(), 'x-outside');
  assert.throws(() => encryptArchive({ dir: join(REPO_ROOT, 'backup'), archivePath: join(outside, 'a.gpg'), passphrase: PASS }, deps), /inside the repository/);
  assert.throws(() => encryptArchive({ dir: outside, archivePath: join(REPO_ROOT, 'a.gpg'), passphrase: PASS }, deps), /inside the repository/);
  assert.throws(() => decryptArchive({ archivePath: join(REPO_ROOT, 'a.gpg'), outDir: outside, passphrase: PASS }, deps), /inside the repository/);
  assert.throws(() => decryptArchive({ archivePath: join(outside, 'a.gpg'), outDir: join(REPO_ROOT, 'out'), passphrase: PASS }, deps), /inside the repository/);
  assert.equal(calls.length, 0);
});

test('passphrase reaches gpg on stdin only and never appears in argv or logs (fake spawn)', () => {
  const calls = [];
  const logs = [];
  const deps = {
    spawn: (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: 'tool 1.0\n', stderr: '' }; },
    exists: () => true,
    remove: () => {},
    log: (l) => logs.push(l),
  };
  const outside = join(tmpdir(), 'x-outside');
  encryptArchive({ dir: join(outside, 'd'), archivePath: join(outside, 'a.gpg'), passphrase: PASS }, deps);
  const gpgCall = calls.find((c) => c.args.includes('--symmetric'));
  assert.ok(gpgCall.opts.input.startsWith(PASS));
  for (const c of calls) assert.ok(!c.args.some((a) => a.includes(PASS)));
  assert.ok(!logs.some((l) => l.includes(PASS)));
});

test('gpg failure output is redacted of the passphrase', () => {
  const deps = {
    spawn: (cmd, args) => (args.includes('--symmetric') ? { status: 2, stderr: `bad ${PASS} thing` } : { status: 0, stdout: 'v\n' }),
    exists: () => true,
    remove: () => {},
  };
  const outside = join(tmpdir(), 'x-outside');
  assert.throws(
    () => encryptArchive({ dir: join(outside, 'd'), archivePath: join(outside, 'a.gpg'), passphrase: PASS }, deps),
    (e) => !e.message.includes(PASS) && e.message.includes('[secret]'),
  );
});

let haveTools = true;
try {
  resolveGpg();
  resolveTar();
} catch {
  haveTools = false;
}

test('local gpg round-trip: encrypt, decrypt, checksums match, no plaintext temp files', { skip: haveTools ? false : 'gpg or tar not found' }, () => {
  const { root, dir } = makeFixture();
  try {
    const archivePath = join(root, 'out', 'backup.tar.gpg');
    mkdirSync(join(root, 'out'));
    encryptArchive({ dir, archivePath, passphrase: PASS });
    assert.deepEqual(readdirSync(join(root, 'out')), ['backup.tar.gpg']);
    assert.ok(!readFileSync(archivePath).includes('object-bytes'));
    const outDir = join(root, 'restored');
    const r = decryptArchive({ archivePath, outDir, passphrase: PASS });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.fileCount, 3);
    assert.equal(readFileSync(join(outDir, 'storage', 'b1', 'a.txt'), 'utf8'), 'object-bytes');
    assert.ok(!readdirSync(root).some((n) => n.endsWith('.tmp.tar')));
    assert.throws(() => decryptArchive({ archivePath, outDir: join(root, 'wrong'), passphrase: `${PASS}x` }), /gpg failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('local gpg round-trip reports a tampered inner file', { skip: haveTools ? false : 'gpg or tar not found' }, () => {
  const { root, dir } = makeFixture();
  try {
    writeFileSync(join(dir, 'db', 'full.dump'), 'changed-after-checksums');
    const archivePath = join(root, 'tampered.tar.gpg');
    encryptArchive({ dir, archivePath, passphrase: PASS });
    const r = decryptArchive({ archivePath, outDir: join(root, 'restored'), passphrase: PASS });
    assert.equal(r.ok, false);
    assert.deepEqual(r.tampered, ['db/full.dump']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- CLI (plan 07-21)

import { run } from './20-decom-backup.mjs';
import { DECOM_REFS } from './18-decom-guard.mjs';
import { existsSync } from 'node:fs';
import { join as pjoin } from 'node:path';

function harness(over = {}) {
  const calls = { runner: [], fetch: [], loginRole: [], connect: [], loadToken: 0, deleteRoles: [], encrypt: 0, writes: [] };
  const out = [];
  const err = [];
  const deps = {
    loadToken: async () => { calls.loadToken++; return 'sbp_testtoken_value'; },
    fetchImpl: async (...a) => { calls.fetch.push(a); return { ok: true, status: 200, json: async () => ({}) }; },
    connect: async (...a) => { calls.connect.push(a); throw new Error('connect not faked'); },
    loginRole: async (ref) => {
      calls.loginRole.push(ref);
      return { role: 'cli_login_postgres', password: 'login-pw-secret-xyz', host: 'aws-0.pooler.supabase.com', port: 5432 };
    },
    deleteRoles: async (ref) => { calls.deleteRoles.push(ref); return true; },
    runner: (cmd, args) => {
      calls.runner.push([cmd, args]);
      return { status: 0, stdout: `${cmd} (fake) 16.0\n`, stderr: '' };
    },
    log: (m) => out.push(String(m)),
    errlog: (m) => err.push(String(m)),
    exists: () => false,
    caDefault: pjoin(tmpdir(), 'no-such-ca.crt'),
    ...over,
  };
  return { deps, calls, out, err };
}

const inRepo = (...p) => pjoin(REPO_ROOT, ...p);
const noSideEffects = (calls) => {
  assert.equal(calls.runner.length, 0, 'runner called');
  assert.equal(calls.fetch.length, 0, 'fetch called');
  assert.equal(calls.loginRole.length, 0, 'loginRole called');
  assert.equal(calls.connect.length, 0, 'connect called');
  assert.equal(calls.loadToken, 0, 'token loaded');
};

test('--help prints usage and exits 0', async () => {
  const h = harness();
  assert.equal(await run(['--help'], h.deps), 0);
  assert.match(h.out.join('\n'), /Usage:/);
});

test('--init-passphrase writes 32 random bytes via writeSecret and never prints them', async () => {
  const written = [];
  const fixed = Buffer.alloc(32, 7);
  const h = harness({
    randomBytes: () => fixed,
    writeSecret: (p, t) => written.push([p, t]),
  });
  const file = pjoin(tmpdir(), 'ziko-pp-test.txt');
  assert.equal(await run(['--init-passphrase', '--passphrase-file', file], h.deps), 0);
  assert.equal(written.length, 1);
  const secret = fixed.toString('base64url');
  assert.equal(written[0][1].trim(), secret);
  assert.deepEqual(h.out, ['passphrase file created']);
  assert.ok(!h.out.concat(h.err).join('\n').includes(secret));
  noSideEffects(h.calls);
});

test('--init-passphrase real file mode 0600 (posix) and refuses an existing file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ziko-pp-'));
  try {
    const file = join(dir, 'pp.txt');
    const out = [];
    assert.equal(await run(['--init-passphrase', '--passphrase-file', file], { log: (m) => out.push(m), errlog: () => {} }), 0);
    const body = readFileSync(file, 'utf8').trim();
    assert.ok(body.length >= 43);
    assert.ok(!out.join('\n').includes(body));
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
    const err = [];
    assert.equal(await run(['--init-passphrase', '--passphrase-file', file], { log: () => {}, errlog: (m) => err.push(m) }), 1);
    assert.match(err.join(''), /already exists/);
    assert.equal(readFileSync(file, 'utf8').trim(), body);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refusals return exit 1 with zero runner, fetch, token, login and connect calls', async () => {
  const outside = pjoin(tmpdir(), 'ziko-backup-refuse');
  const cases = [
    ['init-passphrase in repo', ['--init-passphrase', '--passphrase-file', inRepo('pp.txt')]],
    ['schema-probe out-dir in repo', ['--schema-probe', '--target', 'scratch', '--out-dir', inRepo('out')]],
    ['schema-probe portfolio target', ['--schema-probe', '--target', 'portfolio', '--out-dir', outside]],
    ['schema-probe arbitrary ref', ['--schema-probe', '--target', 'abcdefghijklmnopqrst', '--out-dir', outside]],
  ];
  for (const [name, argv] of cases) {
    const h = harness();
    assert.equal(await run(argv, h.deps), 1, name);
    noSideEffects(h.calls);
  }
});

test('bad mode combinations exit 2', async () => {
  const h = harness();
  assert.equal(await run([], h.deps), 2);
  assert.equal(await run(['--probe-tools', '--schema-probe'], h.deps), 2);
  assert.equal(await run(['--bogus'], h.deps), 2);
  noSideEffects(h.calls);
});

test('--probe-tools writes versions and exits 1 listing missing tools', async () => {
  const written = [];
  const h = harness({
    runner: (cmd) => {
      h.calls.runner.push([cmd]);
      if (cmd === 'pg_restore') return { status: null, error: new Error('ENOENT') };
      return { status: 0, stdout: `${cmd} 1.2.3\nsecond line\n` };
    },
    writeText: (p, t) => written.push([p, t]),
  });
  const code = await run(['--probe-tools', '--json-out', inRepo('report.json')], h.deps);
  assert.equal(code, 1);
  const rep = JSON.parse(written[0][1]);
  assert.equal(rep.pg_dump, 'pg_dump 1.2.3');
  assert.equal(rep.pg_restore, 'missing');
  assert.equal(typeof rep.gpg, 'string');
  assert.equal(typeof rep.tar, 'string');
  assert.match(h.err.join(' '), /missing tools: pg_restore/);
});

test('--probe-tools exits 0 when every tool reports a version', async () => {
  const h = harness();
  assert.equal(await run(['--probe-tools'], h.deps), 0);
});

test('--schema-probe runs only schema-only dumps and pg_restore --list, then deletes login roles', async () => {
  const written = [];
  const h = harness({
    mkdir: () => {},
    writeText: (p, t) => written.push([p, t]),
    runner: (cmd, args) => {
      h.calls.runner.push([cmd, args]);
      if (cmd === 'pg_restore' && args[0] === '--list') return { status: 0, stdout: '; header\n1; 1 2 TABLE public a x\n2; 1 3 TABLE public b x\n' };
      return { status: 0, stdout: 'v 1\n', stderr: '' };
    },
  });
  const outDir = pjoin(tmpdir(), 'ziko-schema-probe');
  const code = await run(['--schema-probe', '--target', 'scratch', '--out-dir', outDir, '--json-out', 'r.json'], h.deps);
  assert.equal(code, 0);
  const dumps = h.calls.runner.filter(([c, a]) => c === 'pg_dump' && !a.includes('--version'));
  assert.equal(dumps.length, 2);
  for (const [, a] of dumps) {
    assert.ok(a.includes('--schema-only'));
    assert.ok(!a.includes('--data-only'));
    assert.ok(!a.join(' ').includes('login-pw-secret-xyz'));
  }
  assert.deepEqual(h.calls.loginRole, [DECOM_REFS.scratch, DECOM_REFS.scratch]);
  assert.deepEqual(h.calls.deleteRoles, [DECOM_REFS.scratch]);
  assert.equal(h.calls.connect.length, 0, 'schema-probe never opens a SQL connection');
  assert.equal(JSON.parse(written[0][1]).pg_restore_list_entries, 2);
});

test('--schema-probe pg_dump failure exits 1, redacts the password and still deletes login roles', async () => {
  const h = harness({
    mkdir: () => {},
    runner: (cmd, args) => {
      h.calls.runner.push([cmd, args]);
      if (cmd === 'pg_dump' && !args.includes('--version')) return { status: 1, stderr: 'FATAL: password login-pw-secret-xyz rejected' };
      return { status: 0, stdout: 'v 1\n' };
    },
  });
  const code = await run(['--schema-probe', '--target', 'ziko', '--out-dir', pjoin(tmpdir(), 'ziko-sp-fail')], h.deps);
  assert.equal(code, 1);
  assert.deepEqual(h.calls.deleteRoles, [DECOM_REFS.ziko]);
  assert.ok(!h.err.join('\n').includes('login-pw-secret-xyz'));
  assert.match(h.err.join('\n'), /pg_dump schema-only failed/);
});
