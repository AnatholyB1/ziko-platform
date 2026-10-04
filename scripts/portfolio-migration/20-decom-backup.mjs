/**
 * 20-decom-backup.mjs - Phase 7 cold-backup primitives (DECOM-02, D-05/D-06).
 *
 * Pure builders (pg_dump argv/env, gpg argv, secret-free manifest, checksums, committed report) plus
 * the encrypt/decrypt primitives (tar + gpg AES256 symmetric). The orchestration CLI is a later plan;
 * this module has no entry point.
 *
 * Security rules:
 *  - the passphrase reaches gpg on stdin (--passphrase-fd 0), never argv, never logged
 *  - pg_dump gets credentials through PG* env vars only, never a URL and never argv
 *  - backup and archive paths inside the repository are refused before any spawn
 *  - the manifest holds env key NAMES and secret-like auth config key NAMES, never values
 *
 * Archive layout (backup directory): db/, copy/, storage/<bucket>/..., manifest.json,
 * storage-manifest.json, checksums.sha256.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, posix, isAbsolute } from 'node:path';
import { redactSecrets } from './lib-conn.mjs';
import { ENV_MATRIX } from './17-env-switch.mjs';
import { assertCommittedSafe, assertOutsideRepo, REPO_ROOT } from './18-decom-guard.mjs';

export const CHECKSUMS_FILE = 'checksums.sha256';
export const SECRET_KEY_RE = /secret|password|token|key|smtp_pass/i;

const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------- pg_dump builders

const ROLE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HOST_RE = /^[A-Za-z0-9.-]+$/;

/** Modes: full (public+auth), storage-meta (storage schema data), schema-only. */
export function buildPgDumpArgs({ mode, file, parentRole } = {}) {
  if (!['full', 'storage-meta', 'schema-only'].includes(mode)) throw new Error('unknown pg_dump mode');
  if (typeof file !== 'string' || file === '') throw new Error('pg_dump needs an output file');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file)) throw new Error('pg_dump output must be a file path, not a URL');
  if (typeof parentRole !== 'string' || !ROLE_RE.test(parentRole)) throw new Error('invalid parent role');
  let args;
  if (mode === 'full') args = ['-Fc', '--schema=public', '--schema=auth'];
  else if (mode === 'storage-meta') args = ['-Fc', '--schema=storage', '--data-only'];
  else args = ['--schema-only'];
  return [...args, `--role=${parentRole}`, `--file=${file}`];
}

/** Child env for pg_dump. A CA path upgrades the connection to verify-full. */
export function buildPgEnv({ host, port, user, password, sslRootCert } = {}) {
  if (typeof host !== 'string' || !HOST_RE.test(host)) throw new Error('invalid host');
  if (!Number.isInteger(Number(port)) || Number(port) <= 0) throw new Error('invalid port');
  if (typeof user !== 'string' || user === '') throw new Error('invalid user');
  if (typeof password !== 'string' || password === '') throw new Error('invalid password');
  const env = {
    PGHOST: host,
    PGPORT: String(port),
    PGUSER: user,
    PGPASSWORD: password,
    PGDATABASE: 'postgres',
    PGSSLMODE: sslRootCert ? 'verify-full' : 'require',
  };
  if (sslRootCert) env.PGSSLROOTCERT = sslRootCert;
  return env;
}

// ---------------------------------------------------------------- gpg builders

export function buildGpgEncryptArgs({ input, output } = {}) {
  if (!input || !output) throw new Error('gpg encrypt needs input and output');
  return [
    '--batch', '--yes', '--no-symkey-cache',
    '--pinentry-mode', 'loopback',
    '--passphrase-fd', '0',
    '--symmetric', '--cipher-algo', 'AES256',
    '--output', output,
    input,
  ];
}

export function buildGpgDecryptArgs({ input, output } = {}) {
  if (!input || !output) throw new Error('gpg decrypt needs input and output');
  return [
    '--batch', '--yes', '--no-symkey-cache',
    '--pinentry-mode', 'loopback',
    '--passphrase-fd', '0',
    '--decrypt',
    '--output', output,
    input,
  ];
}

// ---------------------------------------------------------------- manifest

function reduceAuthConfig(authConfig) {
  const out = {};
  for (const [k, v] of Object.entries(authConfig ?? {})) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = { name: k, present: v !== null && v !== undefined && v !== '' };
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Env key names per surface, from ENV_MATRIX only; process.env is never read. */
export function envKeyNames() {
  const out = {};
  for (const [surface, vars] of Object.entries(ENV_MATRIX)) out[surface] = Object.keys(vars);
  return out;
}

export function buildManifest({
  serverVersion, extensions, functions, triggers, policies, roles, tableGrants, defaultAcl,
  authConfig, buckets, tables, presence,
} = {}) {
  return {
    server_version: serverVersion ?? null,
    extensions: extensions ?? [],
    functions: functions ?? [],
    triggers: triggers ?? [],
    policies: policies ?? [],
    roles: roles ?? [],
    table_grants: tableGrants ?? [],
    default_acl: defaultAcl ?? [],
    auth_config: reduceAuthConfig(authConfig),
    buckets: buckets ?? [],
    tables: tables ?? [],
    presence: presence ?? {},
    env_key_names: envKeyNames(),
  };
}

// ---------------------------------------------------------------- checksums

/** entries: [{path, sha256}] -> `sha256  path` lines sorted by path. */
export function renderChecksums(entries) {
  const lines = [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((e) => `${e.sha256}  ${e.path}`);
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export function parseChecksums(text) {
  const entries = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line === '') continue;
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (!m) throw new Error('malformed checksum line');
    entries.push({ sha256: m[1], path: m[2] });
  }
  return entries;
}

function assertSafeRelative(p) {
  const n = posix.normalize(p);
  if (isAbsolute(p) || /^[A-Za-z]:/.test(p) || n === '..' || n.startsWith('../')) {
    throw new Error('checksum path escapes the backup directory');
  }
}

function walkFiles(root, rel = '') {
  const out = [];
  for (const ent of readdirSync(join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...walkFiles(root, r));
    else if (ent.isFile()) out.push(r);
  }
  return out;
}

/** Hash every file under dir (except checksums.sha256) into checksum entries. */
export function hashDirectory(dir, readBytes = readFileSync) {
  return walkFiles(dir)
    .filter((p) => p !== CHECKSUMS_FILE)
    .map((p) => ({ path: p, sha256: sha256Hex(readBytes(join(dir, p))) }));
}

/** Re-hash every file against checksums.sha256 in dir; reports tampered, missing and unlisted paths. */
export function verifyDirectory(dir, readBytes = readFileSync) {
  const sumPath = join(dir, CHECKSUMS_FILE);
  if (!existsSync(sumPath)) return { ok: false, error: `${CHECKSUMS_FILE} missing`, tampered: [], missing: [], unlisted: [], fileCount: 0 };
  const listed = parseChecksums(readFileSync(sumPath, 'utf8'));
  const tampered = [];
  const missing = [];
  for (const e of listed) {
    assertSafeRelative(e.path);
    const full = join(dir, e.path);
    if (!existsSync(full)) { missing.push(e.path); continue; }
    if (sha256Hex(readBytes(full)) !== e.sha256) tampered.push(e.path);
  }
  const known = new Set(listed.map((e) => e.path));
  const unlisted = walkFiles(dir).filter((p) => p !== CHECKSUMS_FILE && !known.has(p));
  return {
    ok: tampered.length === 0 && missing.length === 0 && unlisted.length === 0,
    tampered, missing, unlisted, fileCount: listed.length,
  };
}

// ---------------------------------------------------------------- committed report

/** Aggregates only; no object names. Throws if anything PII-shaped or secret-shaped slips in. */
export function buildBackupReport({
  archiveName, archiveSha256, archiveBytes, plaintextBytes, tableCounts, buckets,
  storageManifestSha256, manifestSha256, toolVersions,
} = {}) {
  const report = {
    generated_at: new Date().toISOString(),
    archive: { file: archiveName, sha256: archiveSha256, bytes: Number(archiveBytes ?? 0), plaintext_bytes: Number(plaintextBytes ?? 0) },
    tables: Object.fromEntries(Object.entries(tableCounts ?? {}).map(([t, n]) => [t, Number(n)])),
    buckets: (buckets ?? []).map((b) => ({ id: b.id, objects: Number(b.objects ?? 0), bytes: Number(b.bytes ?? 0) })),
    storage_manifest_sha256: storageManifestSha256 ?? null,
    manifest_sha256: manifestSha256 ?? null,
    tool_versions: { ...(toolVersions ?? {}) },
  };
  assertCommittedSafe(report);
  return report;
}

// ---------------------------------------------------------------- tool resolution

function defaultDeps(depsIn = {}) {
  return {
    spawn: (cmd, args, opts) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }),
    exists: existsSync,
    mkdir: (p) => mkdirSync(p, { recursive: true }),
    remove: (p) => rmSync(p, { force: true }),
    log: () => {},
    repoRoot: REPO_ROOT,
    env: process.env,
    ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)),
  };
}

function resolveTool(candidates, versionArgs, deps) {
  for (const c of candidates) {
    const r = deps.spawn(c, versionArgs, {});
    if (!r.error && r.status === 0) return { path: c, version: String(r.stdout ?? '').split('\n')[0].trim() };
  }
  return null;
}

export function resolveGpg(depsIn = {}) {
  const deps = defaultDeps(depsIn);
  const cands = ['gpg', 'C:\\Program Files\\Git\\usr\\bin\\gpg.exe', 'C:\\Program Files (x86)\\Git\\usr\\bin\\gpg.exe'];
  const found = resolveTool(cands, ['--version'], deps);
  if (!found) throw new Error('gpg not found on PATH or in the Git install');
  return found;
}

export function resolveTar(depsIn = {}) {
  const deps = defaultDeps(depsIn);
  const sys = join(deps.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const found = resolveTool([sys, 'tar'], ['--version'], deps);
  if (!found) throw new Error('tar not found');
  return found;
}

// ---------------------------------------------------------------- encrypt / decrypt

function run(deps, tool, args, { input, secrets = [] } = {}) {
  deps.log(redactSecrets(`${tool} ${args.join(' ')}`, secrets));
  const r = deps.spawn(tool, args, input === undefined ? {} : { input });
  if (r.error || r.status !== 0) {
    const detail = redactSecrets(String(r.stderr ?? r.error?.message ?? '').trim().slice(0, 400), secrets);
    throw new Error(`${tool} failed (status ${r.status ?? 'n/a'}): ${detail}`);
  }
  return r;
}

function assertPassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 16) throw new Error('passphrase missing or too short');
}

/** tar the directory, then gpg --symmetric AES256. The plaintext tar is removed in finally. */
export function encryptArchive({ dir, archivePath, passphrase } = {}, depsIn = {}) {
  const deps = defaultDeps(depsIn);
  assertOutsideRepo(dir, deps.repoRoot);
  assertOutsideRepo(archivePath, deps.repoRoot);
  assertPassphrase(passphrase);
  if (!deps.exists(dir)) throw new Error('backup directory does not exist');
  const tar = resolveTar(deps);
  const gpg = resolveGpg(deps);
  const tmpTar = `${archivePath}.tmp.tar`;
  try {
    run(deps, tar.path, ['-cf', tmpTar, '-C', dir, '.']);
    run(deps, gpg.path, buildGpgEncryptArgs({ input: tmpTar, output: archivePath }), { input: `${passphrase}\n`, secrets: [passphrase] });
  } finally {
    deps.remove(tmpTar);
  }
  return { archivePath, gpgVersion: gpg.version, tarVersion: tar.version };
}

/** gpg --decrypt, untar into outDir, re-hash every inner file against checksums.sha256. */
export function decryptArchive({ archivePath, outDir, passphrase } = {}, depsIn = {}) {
  const deps = defaultDeps(depsIn);
  assertOutsideRepo(archivePath, deps.repoRoot);
  assertOutsideRepo(outDir, deps.repoRoot);
  assertPassphrase(passphrase);
  if (!deps.exists(archivePath)) throw new Error('archive does not exist');
  const tar = resolveTar(deps);
  const gpg = resolveGpg(deps);
  const tmpTar = join(outDir, '..', `${posix.basename(String(outDir).replaceAll('\\', '/'))}.tmp.tar`);
  deps.mkdir(outDir);
  try {
    run(deps, gpg.path, buildGpgDecryptArgs({ input: archivePath, output: tmpTar }), { input: `${passphrase}\n`, secrets: [passphrase] });
    run(deps, tar.path, ['-xf', tmpTar, '-C', outDir]);
  } finally {
    deps.remove(tmpTar);
  }
  return { ...verifyDirectory(outDir), gpgVersion: gpg.version };
}
