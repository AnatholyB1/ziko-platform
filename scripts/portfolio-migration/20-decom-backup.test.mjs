import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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
