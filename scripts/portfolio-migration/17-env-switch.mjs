#!/usr/bin/env node
// 17-env-switch.mjs (06-05) - flip or roll back the Supabase env vars of one surface.
//
//   node scripts/portfolio-migration/17-env-switch.mjs --surface api|web|mobile \
//        --target portfolio|ziko --dest local|vercel|eas (--plan|--apply|--audit|--verify-remote) [options]
//
// The flip and the rollback (D-10) are the same command with a different --target.
// Key values are fetched live (getProjectApiKeys), held in memory, handed to Vercel on stdin and to
// EAS on argv (EAS has no stdin support), and are NEVER printed: output shows names + an 8-char
// sha256 fingerprint only.
// Exit codes: 0 ok, 1 refused/failed, 2 bad args.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS, getProjectApiKeys, parseCliArgs, isMain, assertProjectRefFormat } from '../auth-merge/lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PORTFOLIO_REF = PROJECTS.portfolio;
/** Pinned eas-cli (threat T-6-24). Recorded in the plan SUMMARY. */
export const EAS_CLI_VERSION = '24.10.0';

/**
 * Env var matrix (06-RESEARCH "Env Var Matrix"). `from` selects which live value feeds the var.
 * NEXT_PUBLIC_SUPABASE_KEY is a publishable-key alias that web application code reads; it must be
 * switched together with NEXT_PUBLIC_SUPABASE_ANON_KEY or the browser clients keep the old project.
 */
export const ENV_MATRIX = Object.freeze({
  api: Object.freeze({
    SUPABASE_URL: { from: 'url', visibility: 'plaintext' },
    SUPABASE_PUBLISHABLE_KEY: { from: 'publishable', visibility: 'plaintext' },
    SUPABASE_SERVICE_KEY: { from: 'secret', visibility: 'sensitive' },
  }),
  web: Object.freeze({
    NEXT_PUBLIC_SUPABASE_URL: { from: 'url', visibility: 'plaintext' },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: { from: 'publishable', visibility: 'plaintext' },
    NEXT_PUBLIC_SUPABASE_KEY: { from: 'publishable', visibility: 'plaintext' },
    SUPABASE_URL: { from: 'url', visibility: 'plaintext' },
    SUPABASE_SERVICE_ROLE_KEY: { from: 'secret', visibility: 'sensitive' },
  }),
  mobile: Object.freeze({
    EXPO_PUBLIC_SUPABASE_URL: { from: 'url', visibility: 'plaintext' },
    EXPO_PUBLIC_SUPABASE_KEY: { from: 'publishable', visibility: 'sensitive' },
  }),
});

/** D-03: the re-login banner must stay inert, these are never written. */
export const FORBIDDEN_NAMES = Object.freeze([
  'EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE',
  'NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE',
]);

const SURFACES = Object.keys(ENV_MATRIX);
const LOCAL_PATHS = {
  api: 'backend/api/.env.local',
  web: 'apps/web/.env.local',
  mobile: 'apps/mobile/.env',
};
const FLIP_OPTION = { api: 'option-backend-flip', web: 'option-web-flip', mobile: 'option-mobile-build' };

export function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
}

const urlFor = (ref) => `https://${ref}.supabase.co`;

/** Resolve the matrix of a surface to concrete values. */
export function resolveValues(surface, { url, publishable, secret }) {
  const src = { url, publishable, secret };
  const out = {};
  for (const [name, spec] of Object.entries(ENV_MATRIX[surface])) out[name] = src[spec.from];
  return out;
}

// ---------------------------------------------------------------- env file rendering

/** Replace keys in place, append missing ones; preserve comments, order, blank lines, line endings. */
export function renderEnvFile(existing, updates) {
  for (const k of Object.keys(updates)) {
    if (FORBIDDEN_NAMES.includes(k)) throw new Error(`Refusing to write forbidden env name ${k} (D-03)`);
  }
  const text = existing ?? '';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text === '' ? [] : text.split(/\r?\n/);
  const hadTrailingNewline = lines.length > 0 && lines[lines.length - 1] === '';
  if (hadTrailingNewline) lines.pop();
  const pending = new Map(Object.entries(updates));
  const out = lines.map((line) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && pending.has(m[1])) {
      const v = pending.get(m[1]);
      pending.delete(m[1]);
      return `${m[1]}=${v}`;
    }
    return line;
  });
  for (const [k, v] of pending) out.push(`${k}=${v}`);
  return out.join(eol) + eol;
}

export function assertLocalPathIgnored(path, isIgnored) {
  if (!isIgnored(path)) throw new Error(`Refusing to write ${path}: path is not ignored by git`);
}

// ---------------------------------------------------------------- gates

function hasLine(text, line) {
  return String(text ?? '')
    .split(/\r?\n/)
    .some((l) => l === line);
}

function assertTypedAuthorization(surface, authorizationText) {
  const line = `Typed authorization: approve ${PORTFOLIO_REF} ${FLIP_OPTION[surface]}`;
  if (!hasLine(authorizationText, line)) {
    throw new Error(`Missing exact authorization line for ${surface} in --authorization-file: "${line}"`);
  }
}

// ---------------------------------------------------------------- command builders

/**
 * Vercel command plan. `stdin: true` means the value is fed on stdin by the runner (never argv).
 */
export function buildVercelCommands({ surface, environment, gitBranch, confirmRef, authorizationText }) {
  if (!ENV_MATRIX[surface]) throw new Error(`Unknown surface ${surface}`);
  if (environment === 'production') {
    if (confirmRef !== PORTFOLIO_REF) throw new Error('Production env writes require --confirm-ref equal to the portfolio ref');
    assertTypedAuthorization(surface, authorizationText);
  } else if (environment === 'preview') {
    if (!gitBranch) throw new Error('Preview env writes require --git-branch (never touch all-branches Preview)');
  } else {
    throw new Error(`Unknown vercel environment ${environment}`);
  }
  const branchArg = environment === 'preview' ? [gitBranch] : [];
  const cmds = [];
  for (const name of Object.keys(ENV_MATRIX[surface])) {
    cmds.push({ op: 'rm', name, args: ['env', 'rm', name, environment, ...branchArg, '--yes'], tolerateAbsent: true });
    cmds.push({ op: 'add', name, args: ['env', 'add', name, environment, ...branchArg], stdin: true });
  }
  return cmds;
}

/** EAS command plan (surface is always mobile). `{{value}}` is substituted by the runner. */
export function buildEasCommands({ environment, authorizationText }) {
  if (!['production', 'preview', 'development'].includes(environment)) throw new Error(`Unknown eas environment ${environment}`);
  assertTypedAuthorization('mobile', authorizationText);
  return Object.entries(ENV_MATRIX.mobile).map(([name, spec]) => ({
    op: 'create',
    name,
    args: [
      'env:create',
      '--environment',
      environment,
      '--name',
      name,
      '--value',
      '{{value}}',
      '--visibility',
      spec.visibility,
      '--force',
      '--non-interactive',
    ],
  }));
}

// ---------------------------------------------------------------- audit

const ENV_READ_RE = /process\.env(?:\.([A-Z0-9_]*SUPABASE[A-Z0-9_]*)|\[\s*['"]([A-Z0-9_]*SUPABASE[A-Z0-9_]*)['"]\s*\])/g;

/**
 * @param {{surface: 'api'|'web'|'mobile'|'shared', path: string, text: string}[]} sources
 * `shared` code is checked against the union of all surfaces.
 */
export function auditEnvNames(sources) {
  const union = new Set(SURFACES.flatMap((s) => Object.keys(ENV_MATRIX[s])));
  const unknown = [];
  const found = new Set();
  for (const { surface, path, text } of sources) {
    const allowed = surface === 'shared' ? union : new Set(Object.keys(ENV_MATRIX[surface] ?? {}));
    for (const m of text.matchAll(ENV_READ_RE)) {
      const name = m[1] ?? m[2];
      found.add(name);
      if (!allowed.has(name)) unknown.push({ name, path, surface });
    }
  }
  return { ok: unknown.length === 0, unknown, found: [...found].sort() };
}

const SCAN_DIRS = {
  api: ['backend/api/src'],
  web: ['apps/web/src'],
  mobile: ['apps/mobile/app', 'apps/mobile/src'],
};
const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIR = new Set(['node_modules', 'dist', '.next', '__tests__', 'build', '.turbo']);

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (SCAN_EXT.test(entry) && !/\.(test|spec)\./.test(entry)) acc.push(p);
  }
  return acc;
}

export function collectSources(surface) {
  const sources = [];
  const add = (dir, s) => {
    for (const f of walk(join(ROOT, dir))) sources.push({ surface: s, path: relative(ROOT, f), text: readFileSync(f, 'utf8') });
  };
  for (const dir of SCAN_DIRS[surface]) add(dir, surface);
  for (const group of ['plugins', 'packages']) {
    const base = join(ROOT, group);
    if (!existsSync(base)) continue;
    for (const pkg of readdirSync(base)) add(`${group}/${pkg}/src`, 'shared');
  }
  return sources;
}

// ---------------------------------------------------------------- runners

function defaultRun(cmd, args, { input, cwd } = {}) {
  const r = spawnSync(cmd, args, { input, cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 8 * 1024 * 1024 });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function defaultIsIgnored(path) {
  return spawnSync('git', ['check-ignore', '-q', path], { cwd: ROOT }).status === 0;
}

function defaultReadFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return '';
    throw e;
  }
}

const SPEC = {
  surface: 'string',
  target: 'string',
  dest: 'string',
  plan: 'boolean',
  apply: 'boolean',
  audit: 'boolean',
  'verify-remote': 'boolean',
  'vercel-project': 'string',
  'vercel-scope': 'string',
  'vercel-env': 'string',
  'git-branch': 'string',
  'eas-env': 'string',
  'confirm-ref': 'string',
  'authorization-file': 'string',
};

function table(log, rows) {
  log('surface | dest | env | name | fingerprint');
  for (const r of rows) log(`${r.surface} | ${r.dest} | ${r.env} | ${r.name} | ${r.fp}`);
}

/**
 * @returns {Promise<number>} exit code
 */
export async function runEnvSwitch(argv, deps = {}) {
  const log = deps.log ?? console.log;
  const errLog = deps.errLog ?? console.error;
  const run = deps.run ?? defaultRun;
  const isIgnored = deps.isIgnored ?? defaultIsIgnored;
  const readFile = deps.readFile ?? defaultReadFile;
  const writeFile = deps.writeFile ?? writeFileSync;
  const getKeys = deps.getKeys ?? getProjectApiKeys;

  let exited = null;
  const args = parseCliArgs(argv, SPEC, { exit: (c) => (exited = c), log: errLog });
  if (exited !== null) return exited;
  if (args.help) {
    log('Usage: 17-env-switch.mjs --surface api|web|mobile --target portfolio|ziko --dest local|vercel|eas (--plan|--apply|--audit|--verify-remote)');
    return 0;
  }
  const bad = (m) => {
    errLog(`ERROR: ${m}`);
    return 2;
  };
  if (!SURFACES.includes(args.surface)) return bad('--surface must be api|web|mobile');
  const modes = ['plan', 'apply', 'audit', 'verifyRemote'].filter((m) => args[m]);
  if (modes.length !== 1) return bad('exactly one of --plan --apply --audit --verify-remote is required');
  const mode = modes[0];
  const surface = args.surface;

  if (mode === 'audit') {
    const result = auditEnvNames(collectSources(surface));
    log(`audit ${surface}: names read by code = ${result.found.join(', ') || '(none)'}`);
    for (const u of result.unknown) errLog(`UNKNOWN env name ${u.name} in ${u.path} (not in the ${u.surface} matrix)`);
    return result.ok ? 0 : 1;
  }

  if (!['local', 'vercel', 'eas'].includes(args.dest)) return bad('--dest must be local|vercel|eas');
  if (args.dest === 'eas' && surface !== 'mobile') return bad('--dest eas only applies to --surface mobile');
  if (args.dest === 'vercel' && surface === 'mobile') return bad('--dest vercel does not apply to --surface mobile');

  const names = Object.keys(ENV_MATRIX[surface]);
  const envLabel = args.dest === 'vercel' ? args.vercelEnv : args.dest === 'eas' ? args.easEnv : 'local';
  if (args.dest !== 'local' && !envLabel) return bad(`--${args.dest === 'vercel' ? 'vercel-env' : 'eas-env'} is required`);

  // ---- verify-remote (names only)
  if (mode === 'verifyRemote') {
    let listing = '';
    let tmp = null;
    try {
      if (args.dest === 'local') return bad('--verify-remote needs --dest vercel|eas');
      if (args.dest === 'vercel') {
        if (!args.vercelProject) return bad('--vercel-project is required');
        tmp = mkdtempSync(join(tmpdir(), 'ziko-vercel-'));
        const linkArgs = ['link', '--yes', '--project', args.vercelProject, '--cwd', tmp, ...(args.vercelScope ? ['--scope', args.vercelScope] : [])];
        const link = run('vercel', linkArgs);
        if (link.status !== 0) {
          errLog('ERROR: vercel link failed');
          return 1;
        }
        const ls = run('vercel', ['env', 'ls', envLabel, ...(envLabel === 'preview' && args.gitBranch ? [args.gitBranch] : []), '--cwd', tmp]);
        if (ls.status !== 0) {
          errLog('ERROR: vercel env ls failed');
          return 1;
        }
        listing = ls.stdout + ls.stderr;
      } else {
        const ls = run('npx', ['--yes', `eas-cli@${EAS_CLI_VERSION}`, 'env:list', '--environment', envLabel], { cwd: join(ROOT, 'apps/mobile') });
        if (ls.status !== 0) {
          errLog('ERROR: eas env:list failed');
          return 1;
        }
        listing = ls.stdout + ls.stderr;
      }
    } finally {
      if (tmp) {
        try {
          rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch {
          // best effort (Windows EPERM)
        }
      }
    }
    const has = (n) => new RegExp(`(^|[^A-Z0-9_])${n}([^A-Z0-9_]|$)`).test(listing);
    const missing = names.filter((n) => !has(n));
    const forbidden = FORBIDDEN_NAMES.filter(has);
    for (const n of names) log(`${surface} | ${args.dest} | ${envLabel} | ${n} | ${has(n) ? 'present' : 'MISSING'}`);
    for (const n of forbidden) errLog(`FORBIDDEN name present remotely: ${n}`);
    return missing.length === 0 && forbidden.length === 0 ? 0 : 1;
  }

  // ---- plan / apply: need live values
  const targetRef = args.target === 'portfolio' ? PROJECTS.portfolio : args.target === 'ziko' ? PROJECTS.ziko : null;
  if (!targetRef) return bad('--target must be portfolio|ziko');
  assertProjectRefFormat(targetRef);
  let keys;
  try {
    keys = await getKeys(targetRef);
  } catch (e) {
    errLog(`ERROR: ${String(e.message).replace(/eyJ[\w.-]+/g, '[jwt]')}`);
    return 1;
  }
  const values = resolveValues(surface, { url: urlFor(targetRef), publishable: keys.publishable, secret: keys.secret });
  const rows = names.map((name) => ({ surface, dest: args.dest, env: envLabel, name, fp: fingerprint(values[name]) }));

  if (mode === 'plan') {
    log(`PLAN (no remote write): ${surface} -> ${args.target} (${targetRef})`);
    table(log, rows);
    return 0;
  }

  // ---- apply
  try {
    if (args.dest === 'local') {
      const rel = LOCAL_PATHS[surface];
      assertLocalPathIgnored(rel, isIgnored);
      const abs = join(ROOT, rel);
      writeFile(abs, renderEnvFile(readFile(abs), values));
    } else {
      const authorizationText = args.authorizationFile ? readFile(args.authorizationFile) : '';
      if (args.dest === 'vercel') {
        if (!args.vercelProject) return bad('--vercel-project is required');
        const cmds = buildVercelCommands({
          surface,
          environment: args.vercelEnv,
          gitBranch: args.gitBranch,
          confirmRef: args.confirmRef,
          authorizationText,
        });
        const tmp = mkdtempSync(join(tmpdir(), 'ziko-vercel-'));
        try {
          const linkArgs = ['link', '--yes', '--project', args.vercelProject, '--cwd', tmp, ...(args.vercelScope ? ['--scope', args.vercelScope] : [])];
          if (run('vercel', linkArgs).status !== 0) throw new Error('vercel link failed');
          for (const c of cmds) {
            // Vercel refuses to guess the type for NEXT_PUBLIC_*KEY names; publishable keys are public config.
            const typeArgs = c.op === 'add' && /^NEXT_PUBLIC_.*KEY$/.test(c.name) ? ['--type', 'config'] : [];
            const r = run('vercel', [...c.args, ...typeArgs, '--cwd', tmp], c.stdin ? { input: values[c.name] } : {});
            if (r.status !== 0) {
              const absent = c.tolerateAbsent && /not found|does not exist|no environment variable/i.test(r.stdout + r.stderr);
              if (!absent) throw new Error(`vercel ${c.op} ${c.name} failed`);
            }
          }
        } finally {
          try {
            rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
          } catch {
            // Windows may hold the temp dir briefly (EPERM); it holds no secrets (env values go via stdin).
          }
        }
      } else {
        const cmds = buildEasCommands({ environment: args.easEnv, authorizationText });
        for (const c of cmds) {
          const v = values[c.name];
          if (!/^[\x21-\x7e]+$/.test(v) || /[&|;<>^"'`$%()\\]/.test(v)) throw new Error(`Refusing to pass ${c.name} on argv: unsafe characters`);
          const r = run('npx', ['--yes', `eas-cli@${EAS_CLI_VERSION}`, ...c.args.map((a) => (a === '{{value}}' ? v : a))], { cwd: join(ROOT, 'apps/mobile') });
          if (r.status !== 0) throw new Error(`eas env:create ${c.name} failed`);
        }
      }
    }
  } catch (e) {
    errLog(`ERROR: ${String(e.message).replace(/eyJ[\w.-]+/g, '[jwt]')}`);
    return 1;
  }
  log(`APPLIED: ${surface} -> ${args.target} (${targetRef})`);
  table(log, rows);
  return 0;
}

if (isMain(import.meta.url)) {
  runEnvSwitch(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`FATAL: ${String(e?.message ?? e).replace(/eyJ[\w.-]+/g, '[jwt]')}`);
      process.exit(1);
    }
  );
}
