/**
 * Shared helpers for the Phase 3 auth-merge scripts (ziko -> portfolio).
 *
 * RULES (enforced here so later scripts cannot drift):
 *  - No default project ref, ever. Every script must receive an explicit --project-ref
 *    (requireRef) and every write path must call assertWriteAllowed first.
 *  - ziko is the live source and is NEVER writable from these scripts (until Phase 7).
 *    portfolio is writable only with --confirm-ref equal to the portfolio ref.
 *  - PII (emails, bcrypt hashes) must never reach a git-tracked file or a log line:
 *    SQL payloads go to temp files in the OS temp dir (deleted in finally), and all CLI
 *    error text is passed through redactPii before being thrown.
 *
 * Node built-ins only (no dependency).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_WIN = process.platform === 'win32';
const NPX = IS_WIN ? 'npx.cmd' : 'npx';

export const PROJECTS = Object.freeze({
  ziko: 'slkobhavpwsubnsmuhya',
  portfolio: 'ubxllsvanurkwkohzxau',
  scratch: 'rkirvurggtgjlkeuhded',
});

/** Source auth.users ids known to collide with portfolio (D-01/D-04). Any other collision is blocking. */
export const KNOWN_COLLISION_SOURCE_IDS = Object.freeze(['ea0f0b65-6681-4780-8ee0-dbf20b95d4d9']);

/**
 * auth.users columns touched by routine logins/token sends on either project. Excluded from every
 * regression hash and every ziko-vs-target equality digest. Single source of truth.
 */
export const VOLATILE_AUTH_USER_COLUMNS = Object.freeze([
  'last_sign_in_at',
  'updated_at',
  'confirmation_sent_at',
  'recovery_sent_at',
  'recovery_token',
  'email_change_sent_at',
  'reauthentication_sent_at',
  'reauthentication_token',
]);

/** auth.identities volatile columns. */
export const VOLATILE_AUTH_IDENTITY_COLUMNS = Object.freeze(['last_sign_in_at', 'updated_at']);

const REF_RE = /^[a-z]{20}$/;

// ---------------------------------------------------------------- args / safety

/**
 * @param {string[]} argv
 * @param {Record<string,'string'|'boolean'|'list'>} spec flag name (no dashes) -> type
 * @param {{exit?: (c:number)=>void, log?: (m:string)=>void}} [io]
 */
export function parseCliArgs(argv, spec, { exit = process.exit, log = console.error } = {}) {
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const out = {};
  for (const [k, t] of Object.entries(spec)) out[camel(k)] = t === 'boolean' ? false : t === 'list' ? [] : null;
  out.help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    const name = a.startsWith('--') ? a.slice(2) : null;
    const type = name !== null ? spec[name] : undefined;
    if (!type) {
      log(`Unknown argument: ${a}\nSupported: ${Object.keys(spec).map((k) => `--${k}`).join(' ')} --help`);
      exit(2);
      return out;
    }
    if (type === 'boolean') out[camel(name)] = true;
    else if (type === 'string') out[camel(name)] = argv[++i] ?? null;
    else out[camel(name)] = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

export function assertProjectRefFormat(ref) {
  if (typeof ref !== 'string' || !REF_RE.test(ref)) {
    throw new Error('Invalid project ref format (expected 20 lowercase letters)');
  }
}

export function requireRef(args, key, { exit = process.exit } = {}) {
  const ref = args?.[key];
  if (!ref) {
    console.error(`ERROR: --${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} <ref> is required (no default, to avoid targeting the wrong project).`);
    exit(2);
    return null;
  }
  assertProjectRefFormat(ref);
  return ref;
}

export function assertWriteAllowed({ projectRef, confirmRef } = {}) {
  assertProjectRefFormat(projectRef);
  if (projectRef === PROJECTS.ziko) {
    throw new Error('Refusing to write: ziko is the live source and is read-only in Phase 3');
  }
  if (projectRef === PROJECTS.portfolio && confirmRef !== PROJECTS.portfolio) {
    throw new Error('Refusing to write to portfolio without --confirm-ref equal to the portfolio ref');
  }
}

export function isMain(importMetaUrl) {
  return !!process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href;
}

// ---------------------------------------------------------------- PII

export function maskEmail(email) {
  if (typeof email !== 'string') return '***';
  const at = email.indexOf('@');
  if (at < 1) return '***';
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  return `${email[0]}***@***${tld}`;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BCRYPT_RE = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;

export function redactPii(text) {
  return String(text ?? '').replace(BCRYPT_RE, '[bcrypt]').replace(EMAIL_RE, (m) => maskEmail(m));
}

// ---------------------------------------------------------------- pure SQL / data helpers

export function intersectColumns(first, second) {
  const set = new Set(second);
  const out = first.filter((c) => set.has(c));
  if (!out.includes('id')) throw new Error("Column intersection does not contain 'id'");
  return out;
}

export function chooseDollarTag(payload, rand = (n) => randomBytes(n)) {
  for (;;) {
    const tag = `$ziko_${rand(4).toString('hex')}$`;
    if (!String(payload).includes(tag)) return tag;
  }
}

export function parseUriList(s) {
  const seen = new Set();
  for (const part of String(s ?? '').split(',')) {
    const t = part.trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

export function unionUriList(existing, additions) {
  const out = parseUriList(existing);
  const seen = new Set(out);
  for (const a of additions ?? []) {
    const t = String(a).trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.join(',');
}

export function diffAuthConfig(before, after, { allowChanged = [] } = {}) {
  const b = parseUriList(before?.uri_allow_list);
  const a = parseUriList(after?.uri_allow_list);
  const bs = new Set(b);
  const as = new Set(a);
  const allow = new Set(allowChanged);
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {}).filter(Boolean)]);
  const changedKeys = [];
  for (const k of keys) {
    if (allow.has(k)) continue;
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) changedKeys.push(k);
  }
  return {
    removedUris: b.filter((u) => !as.has(u)),
    addedUris: a.filter((u) => !bs.has(u)),
    changedKeys,
  };
}

export function matchCollisions(sourceRows, targetRows) {
  const byId = new Map(targetRows.map((r) => [r.id, r]));
  const byFp = new Map(targetRows.map((r) => [r.fp, r]));
  const collisions = [];
  const idConflicts = [];
  const alreadyImported = [];
  for (const s of sourceRows) {
    const sameId = byId.get(s.id);
    if (sameId) {
      if (sameId.fp === s.fp) alreadyImported.push(s.id);
      else idConflicts.push(s.id);
      continue;
    }
    const t = byFp.get(s.fp);
    if (t) {
      collisions.push({
        sourceId: s.id,
        targetId: t.id,
        targetHasPassword: !!t.has_password,
        targetHasEmailIdentity: !!t.has_email_identity,
        targetInstanceIdNull: !!t.instance_id_null,
      });
    }
  }
  return { collisions, idConflicts, alreadyImported };
}

// ---------------------------------------------------------------- transport

function parseRows(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Failed to parse "supabase db query" output as JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed.rows)) throw new Error('Unexpected "supabase db query" output shape (no "rows" array)');
  return parsed.rows;
}

async function withTempSql(sql, fn) {
  const tmpFile = join(tmpdir(), `ziko-auth-merge-${randomUUID()}.sql`);
  await writeFile(tmpFile, sql, 'utf8');
  try {
    return await fn(tmpFile);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

function cliArgs(ref, file) {
  return ['supabase', 'db', 'query', '--linked', '--project-ref', ref, '--file', file];
}

/** Run SQL against ONE explicit project; returns rows of the LAST statement. Sequential use only. */
export async function runSql(ref, sql, { timeoutMs = 600000 } = {}) {
  assertProjectRefFormat(ref);
  return withTempSql(sql, async (file) => {
    try {
      const { stdout } = await execFileAsync(NPX, cliArgs(ref, file), {
        maxBuffer: 1024 * 1024 * 32,
        shell: IS_WIN,
        timeout: timeoutMs,
      });
      return parseRows(stdout);
    } catch (err) {
      throw new Error(redactPii(`supabase db query failed on ${ref}: ${err.stderr || err.message}`));
    }
  });
}

/** Like runSql but expects a non-zero exit (RAISE EXCEPTION probes); returns the redacted error text. */
export async function runSqlExpectError(ref, sql, { timeoutMs = 600000 } = {}) {
  assertProjectRefFormat(ref);
  return withTempSql(sql, async (file) => {
    try {
      await execFileAsync(NPX, cliArgs(ref, file), {
        maxBuffer: 1024 * 1024 * 32,
        shell: IS_WIN,
        timeout: timeoutMs,
      });
    } catch (err) {
      return redactPii(`${err.stderr || ''}\n${err.stdout || ''}\n${err.message || ''}`);
    }
    throw new Error(`Expected SQL to fail on ${ref} but it succeeded`);
  });
}

const COLUMN_TABLES = ['users', 'identities'];

export async function fetchNonGeneratedColumns(ref, table) {
  if (!COLUMN_TABLES.includes(table)) throw new Error(`Table not allowed: ${table}`);
  const rows = await runSql(
    ref,
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = '${table}' AND is_generated = 'NEVER' ORDER BY ordinal_position`
  );
  return rows.map((r) => r.column_name);
}

export async function fetchEmailFingerprints(ref) {
  return runSql(
    ref,
    `SELECT u.id::text AS id,
            md5(lower(trim(u.email))) AS fp,
            (u.encrypted_password IS NOT NULL) AS has_password,
            EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email') AS has_email_identity,
            (u.instance_id IS NULL) AS instance_id_null
       FROM auth.users u ORDER BY u.id`
  );
}

export async function getProjectApiKeys(ref) {
  assertProjectRefFormat(ref);
  let stdout;
  try {
    ({ stdout } = await execFileAsync(NPX, ['supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'json'], {
      maxBuffer: 1024 * 1024 * 4,
      shell: IS_WIN,
    }));
  } catch (err) {
    throw new Error(redactPii(`Could not fetch api keys for ${ref}: ${err.message}`).replace(/eyJ[\w.-]+/g, '[jwt]'));
  }
  const keys = JSON.parse(stdout);
  const pick = (pred) => keys.find(pred)?.api_key;
  const publishable = pick((k) => k.type === 'publishable') ?? pick((k) => k.name === 'anon');
  const secret = pick((k) => k.type === 'secret') ?? pick((k) => k.name === 'service_role');
  if (!publishable || !secret) throw new Error(`Missing publishable or secret api key for project ${ref}`);
  return { publishable, secret };
}

export async function loadAccessToken() {
  const env = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (env) return env;
  try {
    const t = (await readFile(join(__dirname, '.access-token'), 'utf8')).trim();
    if (t) return t;
  } catch {
    /* fall through */
  }
  throw new Error(
    'No Management API token: set SUPABASE_ACCESS_TOKEN or create scripts/auth-merge/.access-token (gitignored)'
  );
}
