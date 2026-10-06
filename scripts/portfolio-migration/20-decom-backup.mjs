/**
 * 20-decom-backup.mjs - Phase 7 cold backup (DECOM-02, D-05/D-06).
 *
 * Pure builders (pg_dump argv/env, gpg argv, secret-free manifest, checksums, committed report), the
 * encrypt/decrypt primitives (tar + gpg AES256 symmetric) and the guarded orchestration CLI.
 *
 * CLI modes (exactly one):
 *   --init-passphrase --passphrase-file <p>      create a 0600 passphrase file outside the repo (never printed)
 *   --probe-tools [--json-out <report>]          pg_dump / pg_restore / gpg / tar versions
 *   --schema-probe --target scratch|ziko --out-dir <d> [--json-out <report>]
 *                                                schema-only pg_dump + pg_restore --list, read-only
 *   --run --out-dir <d> --passphrase-file <p> --json-out <report>
 *                                                full ziko backup (ziko only, read-only login role)
 *   --verify-archive <archive> --passphrase-file <p> --report <committed report>
 *
 * Data of record (D-05): pg_dump -Fc. The per-table COPY layer is an independent second layer and can
 * never complete a backup on its own: a pg_dump failure in --run is fatal.
 *
 * Archive layout (consumed by 21-decom-restore-proof.mjs): db/full.dump, db/storage-meta.dump,
 * db/schema.sql, copy/<schema>.<table>.copy (incl. auth.users, auth.identities),
 * storage/<bucket>/<name>, manifest.json (rls_tables, copy_columns included), storage-manifest.json,
 * checksums.sha256.
 *
 * Security rules:
 *  - the passphrase reaches gpg on stdin (--passphrase-fd 0), never argv, never logged
 *  - pg_dump gets credentials through PG* env vars only, never a URL and never argv
 *  - backup and archive paths inside the repository are refused before any network or child process
 *  - the manifest holds env key NAMES and secret-like auth config key NAMES, never values
 *  - deleteLoginRoles runs in finally on every path; the plaintext dir never outlives a run
 *
 * Exit codes: 0 ok | 1 refused or failed | 2 bad args.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { basename, dirname, isAbsolute, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import copyStreams from 'pg-copy-streams';
import { createClient } from '@supabase/supabase-js';
import { getProjectApiKeys, isMain, loadAccessToken, parseCliArgs, redactPii } from '../auth-merge/lib.mjs';
import {
  connectClient, createLoginRole, deleteLoginRoles, getSessionPooler, parentRoleOf, redactSecrets,
} from './lib-conn.mjs';
import { buildCopyToSql, quoteIdent } from './lib-data.mjs';
import { SOURCE_BUCKET_RE, maskObjectKey } from './lib-storage.mjs';
import { BUCKET_LIST_SQL, buildObjectListSql, downloadBuffer, mapPool } from './lib-decom-storage.mjs';
import { ENV_MATRIX } from './17-env-switch.mjs';
import { DECOM_REFS, REPO_ROOT, assertCommittedSafe, assertOutsideRepo } from './18-decom-guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

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
  authConfig, buckets, tables, presence, rlsTables, copyColumns,
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
    rls_tables: rlsTables ?? [],
    copy_columns: copyColumns ?? {},
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

function runTool(deps, tool, args, { input, secrets = [] } = {}) {
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
    runTool(deps, tar.path, ['-cf', tmpTar, '-C', dir, '.']);
    runTool(deps, gpg.path, buildGpgEncryptArgs({ input: tmpTar, output: archivePath }), { input: `${passphrase}\n`, secrets: [passphrase] });
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
    runTool(deps, gpg.path, buildGpgDecryptArgs({ input: archivePath, output: tmpTar }), { input: `${passphrase}\n`, secrets: [passphrase] });
    runTool(deps, tar.path, ['-xf', tmpTar, '-C', outDir]);
  } finally {
    deps.remove(tmpTar);
  }
  return { ...verifyDirectory(outDir), gpgVersion: gpg.version };
}

// ---------------------------------------------------------------- CLI

const SPEC = {
  'init-passphrase': 'boolean',
  'passphrase-file': 'string',
  'probe-tools': 'boolean',
  'schema-probe': 'boolean',
  target: 'string',
  'out-dir': 'string',
  run: 'boolean',
  'verify-archive': 'string',
  report: 'string',
  'json-out': 'string',
  'ca-file': 'string',
};

const HELP = `Usage: node scripts/portfolio-migration/20-decom-backup.mjs <mode>
  --init-passphrase --passphrase-file <p>        create a 0600 passphrase file outside the repo
  --probe-tools [--json-out <report>]            report pg_dump, pg_restore, gpg and tar versions
  --schema-probe --target scratch|ziko --out-dir <d> [--json-out <report>]
                                                 schema-only pg_dump and pg_restore --list (read-only)
  --run --out-dir <d> --passphrase-file <p> --json-out <report>
                                                 full ziko backup (read-only login role, encrypted archive)
  --verify-archive <archive> --passphrase-file <p> --report <committed report>
  --ca-file <path>                               TLS CA (default scripts/portfolio-migration/.ca/supabase-ca.crt when present)
All data paths must be outside the repository. ziko is only ever read.`;

const API_BASE = 'https://api.supabase.com';
const STORAGE_CONCURRENCY = 4;
const PROBE_TARGETS = Object.freeze({ scratch: DECOM_REFS.scratch, ziko: DECOM_REFS.ziko });

async function hashFileStream(file) {
  const h = createHash('sha256');
  let bytes = 0;
  await pipeline(
    createReadStream(file),
    new Transform({
      transform(chunk, _e, cb) {
        h.update(chunk);
        bytes += chunk.length;
        cb();
      },
    }),
  );
  return { sha256: h.digest('hex'), bytes };
}

function hashDirectoryBytes(dir) {
  let total = 0;
  for (const p of walkFiles(dir)) total += statSync(join(dir, p)).size;
  return total;
}

function cliDeps(depsIn = {}) {
  return {
    loadToken: loadAccessToken,
    fetchImpl: (...a) => fetch(...a),
    connect: connectClient,
    loginRole: async (ref, { token, fetchImpl }) => {
      const { role, password } = await createLoginRole(ref, { readOnly: true }, { token, fetchImpl });
      const { host, port } = await getSessionPooler(ref, { token, fetchImpl });
      return { role, password, host, port };
    },
    deleteRoles: deleteLoginRoles,
    getKeys: getProjectApiKeys,
    storageFactory: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    runner: (cmd, args, { env, input } = {}) =>
      spawnSync(cmd, args, {
        env: { ...process.env, ...env },
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        ...(input === undefined ? {} : { input }),
      }),
    copyOut: async (client, sql, file) => {
      const h = createHash('sha256');
      let bytes = 0;
      const tap = new Transform({
        transform(chunk, _e, cb) {
          h.update(chunk);
          bytes += chunk.length;
          cb(null, chunk);
        },
      });
      await pipeline(client.query(copyStreams.to(sql)), tap, createWriteStream(file));
      return { sha256: h.digest('hex'), bytes };
    },
    encrypt: encryptArchive,
    decrypt: decryptArchive,
    hashFile: hashFileStream,
    readText: (p) => readFileSync(p, 'utf8'),
    writeText: (p, t) => writeFileSync(p, t, 'utf8'),
    writeSecret: (p, t) => writeFileSync(p, t, { mode: 0o600, flag: 'wx' }),
    writeBinary: (p, buf) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, buf);
    },
    exists: (p) => existsSync(p),
    dirNonEmpty: (p) => existsSync(p) && readdirSync(p).length > 0,
    mkdir: (p) => mkdirSync(p, { recursive: true }),
    rmTree: (p) => rmSync(p, { recursive: true, force: true }),
    rmFile: (p) => rmSync(p, { force: true }),
    fileSize: (p) => statSync(p).size,
    dirSize: hashDirectoryBytes,
    tmpdir: tmpdir(),
    repoRoot: REPO_ROOT,
    caDefault: join(HERE, '.ca', 'supabase-ca.crt'),
    now: () => new Date(),
    randomBytes,
    log: (m) => console.log(m),
    errlog: (m) => console.error(m),
    ...Object.fromEntries(Object.entries(depsIn).filter(([, v]) => v !== undefined)),
  };
}

/** Throws a plain Error when a path lies inside the repo. Runs before any network or child process. */
function refuseRepoPath(p, label, deps) {
  try {
    assertOutsideRepo(resolve(p), deps.repoRoot);
  } catch {
    throw new Error(`Refusing: ${label} is inside the repository`);
  }
}

function readPassphrase(deps, file, secrets) {
  const pass = String(deps.readText(resolve(file))).trim();
  secrets.push(pass);
  return pass;
}

/** Tool versions through the injected runner. Missing tools get the string `missing`. */
function probeTools(deps) {
  const versionOf = (cmd) => {
    const r = deps.runner(cmd, ['--version'], {});
    return !r || r.error || r.status !== 0 ? 'missing' : String(r.stdout ?? '').split('\n')[0].trim() || 'missing';
  };
  const out = { pg_dump: versionOf('pg_dump'), pg_restore: versionOf('pg_restore') };
  const spawn = (c, a, o) => deps.runner(c, a, o);
  try {
    out.gpg = resolveGpg({ spawn }).version || 'missing';
  } catch {
    out.gpg = 'missing';
  }
  try {
    out.tar = resolveTar({ spawn }).version || 'missing';
  } catch {
    out.tar = 'missing';
  }
  return out;
}

const missingTools = (tools, only) =>
  Object.entries(tools).filter(([k, v]) => v === 'missing' && (!only || only.includes(k))).map(([k]) => k);

function resolveCa(deps, caFileArg) {
  const file = caFileArg ? resolve(caFileArg) : deps.caDefault;
  if (file && deps.exists(file)) return { caFile: file, caPem: deps.readText(file) };
  return { caFile: undefined, caPem: undefined };
}

/** One pg_dump with a fresh read-only login role (login-role TTL, RESEARCH Pitfall 7). Failure is fatal. */
async function dumpWith(ctx, ref, mode, file, opts = {}) {
  // The pooler can briefly hold stale state for a just-recreated login role (auth failure or
  // "invalid role OID"), same as connectClient. Retry with a fresh role; the last failure is fatal.
  const { deps } = ctx;
  const attempts = deps.dumpAttempts ?? 4;
  const delayMs = deps.retryDelayMs ?? 4000;
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await dumpOnce(ctx, ref, mode, file, opts);
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        deps.log(`pg_dump ${mode} attempt ${i}/${attempts} failed, retrying with a fresh login role`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

async function dumpOnce(ctx, ref, mode, file, { custom = false } = {}) {
  const { deps } = ctx;
  ctx.touched.add(ref);
  const lr = await deps.loginRole(ref, { token: ctx.token, fetchImpl: deps.fetchImpl });
  ctx.secrets.push(lr.password);
  const env = buildPgEnv({
    host: lr.host,
    port: lr.port,
    user: `${lr.role}.${ref}`,
    password: lr.password,
    sslRootCert: ctx.caFile,
  });
  let args = buildPgDumpArgs({ mode, file, parentRole: parentRoleOf(lr.role) });
  if (custom) args = ['-Fc', ...args];
  deps.log(`pg_dump ${mode}`);
  const r = deps.runner('pg_dump', args, { env });
  if (!r || r.error || r.status !== 0) {
    const detail = redactSecrets(String(r?.stderr ?? r?.error?.message ?? '').trim().slice(0, 400), ctx.secrets);
    throw new Error(`pg_dump ${mode} failed (status ${r?.status ?? 'n/a'}): ${detail}`);
  }
}

async function modeInitPassphrase(args, deps) {
  if (!args.passphraseFile) {
    deps.errlog('ERROR: --passphrase-file is required');
    return 2;
  }
  refuseRepoPath(args.passphraseFile, 'passphrase file', deps);
  const file = resolve(args.passphraseFile);
  if (deps.exists(file)) {
    deps.errlog('ERROR: passphrase file already exists; refusing to overwrite');
    return 1;
  }
  deps.writeSecret(file, `${deps.randomBytes(32).toString('base64url')}\n`);
  deps.log('passphrase file created');
  return 0;
}

async function modeProbeTools(args, deps) {
  const tools = probeTools(deps);
  const report = { generated_at: deps.now().toISOString(), ...tools };
  assertCommittedSafe(report);
  if (args.jsonOut) deps.writeText(resolve(args.jsonOut), `${JSON.stringify(report, null, 2)}\n`);
  for (const [k, v] of Object.entries(tools)) deps.log(`${k}: ${v}`);
  const missing = missingTools(tools);
  if (missing.length) {
    deps.errlog(`ERROR: missing tools: ${missing.join(', ')}`);
    return 1;
  }
  return 0;
}

async function modeSchemaProbe(args, deps) {
  if (!args.target || !Object.hasOwn(PROBE_TARGETS, args.target)) {
    deps.errlog('ERROR: --target must be scratch or ziko');
    return 1;
  }
  if (!args.outDir) {
    deps.errlog('ERROR: --out-dir is required');
    return 2;
  }
  refuseRepoPath(args.outDir, 'out-dir', deps);
  const ref = PROBE_TARGETS[args.target];
  const outDir = resolve(args.outDir);
  const tools = probeTools(deps);
  const missing = missingTools(tools, ['pg_dump', 'pg_restore']);
  if (missing.length) {
    deps.errlog(`ERROR: missing tools: ${missing.join(', ')}`);
    return 1;
  }
  const ctx = { deps, secrets: [], touched: new Set() };
  try {
    ctx.token = await deps.loadToken();
    ctx.secrets.push(ctx.token);
    const ca = resolveCa(deps, args.caFile);
    ctx.caFile = ca.caFile;
    deps.mkdir(outDir);
    const sqlFile = join(outDir, 'schema.sql');
    const dumpFile = join(outDir, 'schema.dump');
    await dumpWith(ctx, ref, 'schema-only', sqlFile);
    await dumpWith(ctx, ref, 'schema-only', dumpFile, { custom: true });
    const lr = deps.runner('pg_restore', ['--list', dumpFile], {});
    if (!lr || lr.error || lr.status !== 0) throw new Error(`pg_restore --list failed (status ${lr?.status ?? 'n/a'})`);
    const tocEntries = String(lr.stdout ?? '').split('\n').filter((l) => l.trim() !== '' && !l.startsWith(';')).length;
    const report = {
      generated_at: deps.now().toISOString(),
      target: args.target,
      tool_versions: tools,
      tls: ca.caFile ? 'verified' : 'encrypted-not-verified',
      schema_only_dump: 'ok',
      pg_restore_list_entries: tocEntries,
    };
    assertCommittedSafe(report);
    if (args.jsonOut) deps.writeText(resolve(args.jsonOut), `${JSON.stringify(report, null, 2)}\n`);
    deps.log(`schema probe ok on ${args.target}: ${tocEntries} TOC entries (tls: ${report.tls})`);
    return 0;
  } catch (e) {
    deps.errlog(`ERROR: ${redactSecrets(redactPii(e?.message ?? e), ctx.secrets)}`);
    return 1;
  } finally {
    for (const r of ctx.touched) await deps.deleteRoles(r, { token: ctx.token, fetchImpl: deps.fetchImpl });
    ctx.secrets.length = 0;
  }
}

// ---------------------------------------------------------------- --run

const SQL = Object.freeze({
  version: 'SHOW server_version',
  extensions: 'SELECT extname, extversion FROM pg_extension ORDER BY extname',
  functions:
    "SELECT p.proname, p.prosecdef, p.proacl::text AS proacl FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY p.proname, p.oid",
  triggers: `SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace ORDER BY c.relname, t.tgname`,
  policies:
    "SELECT schemaname, tablename, policyname, cmd, roles::text AS roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname",
  rls: "SELECT c.relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relrowsecurity ORDER BY c.relname",
  roles: "SELECT rolname FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname",
  grants:
    "SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' ORDER BY grantee, table_name, privilege_type",
  defaultAcl: `SELECT pg_get_userbyid(d.defaclrole) AS owner, n.nspname AS schema, d.defaclobjtype::text AS objtype, d.defaclacl::text AS acl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace ORDER BY 1, 2, 3`,
  publications: 'SELECT pubname FROM pg_publication ORDER BY pubname',
  functionsSchema: "SELECT count(*)::int AS n FROM pg_namespace WHERE nspname = 'supabase_functions'",
  tables:
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  columns:
    "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND is_generated = 'NEVER' ORDER BY ordinal_position",
});

const AUTH_COPY_TABLES = Object.freeze(['users', 'identities']);

export function buildCopyOutSql(schema, table, cols) {
  if (!Array.isArray(cols) || cols.length === 0) throw new Error(`no columns resolved for ${schema}.${table}`);
  if (schema === 'public') return buildCopyToSql(table, cols);
  if (schema !== 'auth') throw new Error('unsupported schema for the COPY layer');
  return `COPY auth.${quoteIdent(table)} (${cols.map((c) => quoteIdent(c)).join(', ')}) TO STDOUT`;
}

/** Archive path of a storage object. Strict: any odd name is fatal (loud) rather than skipped. */
export function storageFile(dir, bucket, name) {
  if (!SOURCE_BUCKET_RE.test(String(bucket))) throw new Error('invalid bucket id');
  const n = String(name);
  const parts = n.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..') || n.includes('\\') || isAbsolute(n) || /^[A-Za-z]:/.test(n)) {
    throw new Error('unsafe object name');
  }
  const base = resolve(dir, 'storage');
  const full = resolve(base, bucket, ...parts);
  if (!full.startsWith(base + sep)) throw new Error('object path escapes the backup directory');
  return full;
}

const rowsOf = async (client, sql, params) => (await (params ? client.query(sql, params) : client.query(sql))).rows ?? [];
const jsonText = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

async function fetchAuthConfig(ctx, ref) {
  const { deps } = ctx;
  const res = await deps.fetchImpl(`${API_BASE}/v1/projects/${ref}/config/auth`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`auth config export returned HTTP ${res.status}`);
  return res.json();
}

/** Catalog snapshot for manifest.json. Metadata only: no row data. */
async function collectCatalog(client) {
  const version = (await rowsOf(client, SQL.version))[0]?.server_version ?? null;
  const extensions = await rowsOf(client, SQL.extensions);
  const functions = await rowsOf(client, SQL.functions);
  const triggers = await rowsOf(client, SQL.triggers);
  const policies = await rowsOf(client, SQL.policies);
  const rlsTables = (await rowsOf(client, SQL.rls)).map((r) => r.relname);
  const roles = (await rowsOf(client, SQL.roles)).map((r) => r.rolname);
  const tableGrants = await rowsOf(client, SQL.grants);
  const defaultAcl = await rowsOf(client, SQL.defaultAcl);
  const publications = (await rowsOf(client, SQL.publications)).map((r) => r.pubname);
  const fnSchema = Number((await rowsOf(client, SQL.functionsSchema))[0]?.n ?? 0) > 0;
  const extNames = new Set(extensions.map((e) => e.extname));
  const presence = {
    pg_cron: extNames.has('pg_cron'),
    vault: extNames.has('supabase_vault') || extNames.has('vault'),
    supabase_functions: fnSchema,
    realtime_publications: publications,
  };
  return { version, extensions, functions, triggers, policies, rlsTables, roles, tableGrants, defaultAcl, presence };
}

async function copyLayer(ctx, client, outDir) {
  const { deps } = ctx;
  const targets = [];
  for (const r of await rowsOf(client, SQL.tables)) targets.push(['public', r.table_name]);
  for (const t of AUTH_COPY_TABLES) targets.push(['auth', t]);
  const copyColumns = {};
  const counts = {};
  const hashes = new Map();
  for (const [schema, table] of targets) {
    const cols = (await rowsOf(client, SQL.columns, [schema, table])).map((c) => c.column_name);
    const sql = buildCopyOutSql(schema, table, cols);
    const key = `${schema}.${table}`;
    copyColumns[key] = cols;
    counts[key] = Number((await rowsOf(client, `SELECT count(*)::bigint AS n FROM ${schema}.${quoteIdent(table)}`))[0]?.n ?? 0);
    const rel = `copy/${key}.copy`;
    const r = await deps.copyOut(client, sql, join(outDir, 'copy', `${key}.copy`));
    hashes.set(rel, r.sha256);
  }
  return { copyColumns, counts, hashes };
}

async function exportStorage(ctx, client, ref, outDir) {
  const { deps } = ctx;
  const buckets = await rowsOf(client, BUCKET_LIST_SQL);
  const ids = buckets.map((b) => b.id);
  const objects = ids.length ? await rowsOf(client, buildObjectListSql(ids)) : [];
  let exported = [];
  if (objects.length) {
    const keys = await deps.getKeys(ref);
    ctx.secrets.push(keys.secret);
    const sc = deps.storageFactory(`https://${ref}.supabase.co`, keys.secret);
    exported = await mapPool(objects, STORAGE_CONCURRENCY, async (o) => {
      try {
        const buf = await downloadBuffer(sc, o.bucket_id, o.name);
        if (o.size !== null && o.size !== undefined && Number(o.size) !== buf.length) throw new Error('size differs from storage metadata');
        deps.writeBinary(storageFile(outDir, o.bucket_id, o.name), buf);
        return {
          bucket: o.bucket_id,
          name: o.name,
          sha256: sha256Hex(buf),
          mimetype: o.mimetype ?? null,
          cache_control: o.cache_control ?? null,
          bytes: buf.length,
        };
      } catch (e) {
        throw new Error(`storage export failed for ${maskObjectKey(o.bucket_id, o.name)}: ${e?.message ?? e}`);
      }
    });
  }
  const bucketRows = buckets.map((b) => ({
    id: b.id,
    public: b.public === true,
    file_size_limit: b.file_size_limit ?? null,
    allowed_mime_types: b.allowed_mime_types ?? null,
  }));
  const perBucket = bucketRows.map((b) => {
    const mine = exported.filter((o) => o.bucket === b.id);
    return { id: b.id, objects: mine.length, bytes: mine.reduce((s, o) => s + o.bytes, 0) };
  });
  const storageManifest = {
    buckets: bucketRows,
    objects: exported.map(({ bytes, ...rest }) => rest),
  };
  return { bucketRows, perBucket, storageManifest };
}

function badPaths(res) {
  return [...(res?.tampered ?? []), ...(res?.missing ?? []), ...(res?.unlisted ?? [])].slice(0, 10);
}

async function modeRun(args, deps) {
  if (args.target && args.target !== 'ziko') {
    deps.errlog('ERROR: --run only targets ziko');
    return 1;
  }
  if (!args.outDir || !args.passphraseFile || !args.jsonOut) {
    deps.errlog('ERROR: --out-dir, --passphrase-file and --json-out are required');
    return 2;
  }
  refuseRepoPath(args.outDir, 'out-dir', deps);
  refuseRepoPath(args.passphraseFile, 'passphrase file', deps);
  const outDir = resolve(args.outDir);
  if (deps.dirNonEmpty(outDir)) {
    deps.errlog('ERROR: out-dir is not empty; refusing to reuse it');
    return 1;
  }
  const archivePath = join(dirname(outDir), `ziko-final-${deps.now().toISOString().slice(0, 10)}.tar.gpg`);
  refuseRepoPath(archivePath, 'archive path', deps);
  if (deps.exists(archivePath)) {
    deps.errlog('ERROR: archive already exists; refusing to overwrite');
    return 1;
  }
  const secrets = [];
  const passphrase = readPassphrase(deps, args.passphraseFile, secrets);
  if (passphrase.length < 16) {
    deps.errlog('ERROR: passphrase missing or too short');
    return 1;
  }
  const tools = probeTools(deps);
  const missing = missingTools(tools);
  if (missing.length) {
    deps.errlog(`ERROR: missing tools: ${missing.join(', ')}`);
    return 1;
  }

  const ref = DECOM_REFS.ziko;
  const ctx = { deps, secrets, touched: new Set() };
  let client = null;
  let ok = false;
  let archiveVerified = false;
  try {
    ctx.token = await deps.loadToken();
    secrets.push(ctx.token);
    const ca = resolveCa(deps, args.caFile);
    ctx.caFile = ca.caFile;
    deps.mkdir(join(outDir, 'db'));
    deps.mkdir(join(outDir, 'copy'));

    // 1. pg_dump is the data of record: any failure aborts the whole run (no COPY-only completion path).
    await dumpWith(ctx, ref, 'full', join(outDir, 'db', 'full.dump'));
    await dumpWith(ctx, ref, 'storage-meta', join(outDir, 'db', 'storage-meta.dump'));
    await dumpWith(ctx, ref, 'schema-only', join(outDir, 'db', 'schema.sql'));

    // 2. catalog, COPY layer and storage listing share one read-only snapshot.
    ctx.touched.add(ref);
    client = (await deps.connect(ref, { readOnly: true, token: ctx.token, caPem: ca.caPem })).client;
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const catalog = await collectCatalog(client);
    const layer = await copyLayer(ctx, client, outDir);
    const storage = await exportStorage(ctx, client, ref, outDir);
    await client.query('COMMIT');
    const authConfig = await fetchAuthConfig(ctx, ref);

    const manifest = buildManifest({
      serverVersion: catalog.version,
      extensions: catalog.extensions,
      functions: catalog.functions,
      triggers: catalog.triggers,
      policies: catalog.policies,
      roles: catalog.roles,
      tableGrants: catalog.tableGrants,
      defaultAcl: catalog.defaultAcl,
      authConfig,
      buckets: storage.bucketRows,
      tables: Object.entries(layer.counts).map(([name, rows]) => ({ name, rows })),
      presence: catalog.presence,
      rlsTables: catalog.rlsTables,
      copyColumns: layer.copyColumns,
    });
    const manifestText = jsonText(manifest);
    const storageText = jsonText(storage.storageManifest);
    deps.writeText(join(outDir, 'manifest.json'), manifestText);
    deps.writeText(join(outDir, 'storage-manifest.json'), storageText);

    // 3. checksums over every file; the streamed COPY hashes must still match what is on disk.
    const entries = hashDirectory(outDir);
    const onDisk = new Map(entries.map((e) => [e.path, e.sha256]));
    for (const [rel, sha] of layer.hashes) {
      if (onDisk.get(rel) !== sha) throw new Error(`COPY layer file changed after streaming: ${rel}`);
    }
    for (const required of ['db/full.dump', 'db/storage-meta.dump', 'db/schema.sql']) {
      if (!onDisk.has(required)) throw new Error(`pg_dump output missing: ${required}`);
    }
    deps.writeText(join(outDir, CHECKSUMS_FILE), renderChecksums(entries));
    const plaintextBytes = deps.dirSize(outDir);

    // 4. encrypt, then prove it decrypts and re-hashes before any plaintext is removed.
    const enc = await deps.encrypt({ dir: outDir, archivePath, passphrase });
    const vdir = join(deps.tmpdir, `ziko-backup-verify-${deps.randomBytes(6).toString('hex')}`);
    refuseRepoPath(vdir, 'verify dir', deps);
    try {
      const res = await deps.decrypt({ archivePath, outDir: vdir, passphrase });
      if (!res?.ok) throw new Error(`archive verification failed: ${badPaths(res).join(', ') || res?.error || 'unknown'}`);
      if (res.fileCount !== entries.length) throw new Error('archive file count differs from the backup');
    } finally {
      deps.rmTree(vdir);
    }
    const archive = await deps.hashFile(archivePath);
    archiveVerified = true;

    const report = buildBackupReport({
      archiveName: basename(archivePath),
      archiveSha256: archive.sha256,
      archiveBytes: archive.bytes,
      plaintextBytes,
      tableCounts: layer.counts,
      buckets: storage.perBucket,
      storageManifestSha256: sha256Hex(Buffer.from(storageText)),
      manifestSha256: sha256Hex(Buffer.from(manifestText)),
      toolVersions: {
        ...tools,
        gpg: enc?.gpgVersion ?? tools.gpg,
        tar: enc?.tarVersion ?? tools.tar,
        tls: ca.caFile ? 'verified' : 'encrypted-not-verified',
      },
    });

    // 5. plaintext never outlives the run.
    deps.rmTree(outDir);
    if (deps.exists(outDir)) throw new Error('plaintext backup directory could not be removed');
    deps.writeText(resolve(args.jsonOut), jsonText(report));
    deps.log(`backup ok: ${basename(archivePath)} (${Object.keys(layer.counts).length} tables, ${storage.perBucket.length} buckets, ${storage.storageManifest.objects.length} objects)`);
    ok = true;
    return 0;
  } catch (e) {
    deps.errlog(`ERROR: ${redactSecrets(redactPii(e?.message ?? e), secrets)}`);
    return 1;
  } finally {
    if (client) await Promise.resolve(client.end?.()).catch(() => {});
    for (const r of ctx.touched) await deps.deleteRoles(r, { token: ctx.token, fetchImpl: deps.fetchImpl });
    if (!ok) {
      try {
        deps.rmTree(outDir);
      } catch {
        /* best effort */
      }
      if (!archiveVerified) {
        try {
          deps.rmFile(archivePath);
        } catch {
          /* best effort */
        }
      }
    }
    secrets.length = 0;
  }
}

// ---------------------------------------------------------------- --verify-archive

async function modeVerifyArchive(args, deps) {
  if (!args.passphraseFile || !args.report) {
    deps.errlog('ERROR: --passphrase-file and --report are required');
    return 2;
  }
  refuseRepoPath(args.verifyArchive, 'archive', deps);
  refuseRepoPath(args.passphraseFile, 'passphrase file', deps);
  const archive = resolve(args.verifyArchive);
  if (!deps.exists(archive)) {
    deps.errlog('ERROR: archive does not exist');
    return 1;
  }
  const secrets = [];
  const vdir = join(deps.tmpdir, `ziko-backup-verify-${deps.randomBytes(6).toString('hex')}`);
  refuseRepoPath(vdir, 'verify dir', deps);
  try {
    const expected = JSON.parse(deps.readText(resolve(args.report)))?.archive?.sha256;
    if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected)) {
      deps.errlog('ERROR: report has no archive sha256');
      return 1;
    }
    const passphrase = readPassphrase(deps, args.passphraseFile, secrets);
    const { sha256 } = await deps.hashFile(archive);
    if (sha256 !== expected) {
      deps.errlog('ERROR: archive sha256 does not match the report');
      return 1;
    }
    const res = await deps.decrypt({ archivePath: archive, outDir: vdir, passphrase });
    if (!res?.ok) {
      deps.errlog(`ERROR: inner checksum verification failed: ${badPaths(res).join(', ') || res?.error || 'unknown'}`);
      return 1;
    }
    deps.log(`archive verified: sha256 matches the report, ${res.fileCount} inner files re-hashed`);
    return 0;
  } catch (e) {
    deps.errlog(`ERROR: ${redactSecrets(redactPii(e?.message ?? e), secrets)}`);
    return 1;
  } finally {
    deps.rmTree(vdir);
    secrets.length = 0;
  }
}

export async function run(argv, depsIn = {}) {
  const deps = cliDeps(depsIn);
  let badArgs = false;
  const args = parseCliArgs(argv, SPEC, { exit: () => { badArgs = true; }, log: deps.errlog });
  if (badArgs) return 2;
  if (args.help) {
    deps.log(HELP);
    return 0;
  }
  const modes = [
    args.initPassphrase && 'init-passphrase',
    args.probeTools && 'probe-tools',
    args.schemaProbe && 'schema-probe',
    args.run && 'run',
    args.verifyArchive && 'verify-archive',
  ].filter(Boolean);
  if (modes.length !== 1) {
    deps.errlog('ERROR: exactly one of --init-passphrase, --probe-tools, --schema-probe, --run, --verify-archive is required');
    return 2;
  }
  try {
    switch (modes[0]) {
      case 'init-passphrase':
        return await modeInitPassphrase(args, deps);
      case 'probe-tools':
        return await modeProbeTools(args, deps);
      case 'schema-probe':
        return await modeSchemaProbe(args, deps);
      case 'run':
        return await modeRun(args, deps);
      default:
        return await modeVerifyArchive(args, deps);
    }
  } catch (e) {
    deps.errlog(`ERROR: ${redactPii(e?.message ?? e)}`);
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
