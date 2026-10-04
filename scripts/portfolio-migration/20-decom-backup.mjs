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
import { SOURCE_BUCKET_RE } from './lib-storage.mjs';
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
async function dumpWith(ctx, ref, mode, file, { custom = false } = {}) {
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

// MODES-INSERT-POINT

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
      // DISPATCH-INSERT-POINT
      default:
        deps.errlog('ERROR: mode not available yet');
        return 2;
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
