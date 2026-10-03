/**
 * Phase 6 (cutover) shared helpers for the signup-isolation and core-flow smoke scripts.
 *
 * RULES:
 *  - ziko is never a write target. portfolio needs --confirm-ref AND the exact typed
 *    authorization line in a file (`Typed authorization: <phrase>`).
 *  - Temp users live in memory only; cleanup is restricted to their ids and ziko_-prefixed tables.
 *  - Reports are PII-free: writeSafeReport refuses '@', full UUIDs and JWT fragments.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

import { PROJECTS, assertProjectRefFormat, runSql, redactPii } from '../auth-merge/lib.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ANY_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const JWT_FRAGMENT_RE = /eyJ[A-Za-z0-9_-]{10,}/;

export const TEMP_EMAIL_DOMAIN = 'example.com';

export function safeMessage(err) {
  return redactPii(String(err?.message ?? err)).replace(/eyJ[\w.-]+/g, '[jwt]').slice(0, 300);
}

/**
 * Gate every write. Throws on refusal. Synchronous and offline (reads only the authorization file).
 * - ziko: always refused
 * - confirmRef must equal projectRef
 * - portfolio: authorizationFile must contain a line exactly `Typed authorization: <phrase>`
 */
export function requireWriteAuthorization({ projectRef, confirmRef, authorizationFile, phrase } = {}) {
  assertProjectRefFormat(projectRef);
  if (projectRef === PROJECTS.ziko) {
    throw new Error('Refusing: ziko is the live source and is never a test target');
  }
  if (confirmRef !== projectRef) {
    throw new Error('Refusing: --confirm-ref must equal --project-ref');
  }
  if (projectRef === PROJECTS.portfolio) {
    if (!authorizationFile || !phrase) {
      throw new Error('Refusing: portfolio requires --authorization-file and --authorization-phrase');
    }
    let text;
    try {
      text = readFileSync(authorizationFile, 'utf8');
    } catch {
      throw new Error('Refusing: authorization file is not readable');
    }
    const expected = `Typed authorization: ${phrase}`;
    const ok = text.split(/\r?\n/).some((l) => l === expected);
    if (!ok) throw new Error('Refusing: authorization file does not contain the exact typed authorization line');
  }
  return { projectRef, isPortfolio: projectRef === PROJECTS.portfolio };
}

/** Throws if the serialized report would leak an email, a full UUID or a JWT fragment. */
export function assertReportSafe(obj) {
  const s = JSON.stringify(obj);
  if (s.includes('@')) throw new Error('report contains "@" (possible email)');
  if (UUID_ANY_RE.test(s)) throw new Error('report contains a full UUID');
  if (JWT_FRAGMENT_RE.test(s)) throw new Error('report contains a JWT fragment');
}

export async function writeSafeReport(path, obj) {
  assertReportSafe(obj);
  await writeFile(path, `${JSON.stringify(obj, null, 2)}\n`);
}

/** Set of 20-char project refs found in https://<ref>.supabase.co occurrences. */
export function detectProjectRefs(text) {
  const out = new Set();
  for (const m of String(text ?? '').matchAll(/https:\/\/([a-z]{20})\.supabase\.co/g)) out.add(m[1]);
  return out;
}

export function tempEmail(runId, role) {
  if (!/^[a-z0-9]+$/.test(String(runId))) throw new Error('runId must be lowercase alphanumeric');
  if (!/^[a-z0-9-]+$/.test(String(role))) throw new Error('role must be lowercase alphanumeric or dash');
  return `ziko-cutover-test-${runId}-${role}@${TEMP_EMAIL_DOMAIN}`;
}

export function newRunId() {
  return randomBytes(4).toString('hex');
}

/** Creates a confirmed temp user via the admin API. Credentials stay in memory only. */
export async function createTempUser(admin, { runId, role, metadata }) {
  const email = tempEmail(runId, role);
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(metadata ? { user_metadata: metadata } : {}),
  });
  if (error || !data?.user) throw new Error(`createUser failed: ${safeMessage(error)}`);
  return { id: data.user.id, email, password };
}

export async function signInTemp(createClient, url, publishable, user) {
  const client = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error || !data?.session) throw new Error(`signInWithPassword failed: ${safeMessage(error)}`);
  return { jwt: data.session.access_token, client };
}

function idList(ids) {
  for (const id of ids) if (!UUID_RE.test(id)) throw new Error('invalid user id');
  return ids.map((i) => `'${i}'`).join(',');
}

function checkPrefix(prefix) {
  if (!/^[a-z]+_$/.test(prefix)) throw new Error('invalid table prefix');
  return prefix;
}

/** Read-only: total rows across public <prefix>* tables whose user_id/id uuid column is in ids. */
export async function countRowsByPrefix(ref, prefix, ids) {
  if (ids.length === 0) return 0;
  const list = idList(ids);
  const p = checkPrefix(prefix);
  const rows = await runSql(
    ref,
    `SELECT COALESCE(SUM((xpath('/row/c/text()', query_to_xml(
        format('SELECT count(*) AS c FROM public.%I WHERE %I::text IN (${list.replace(/'/g, "''")})', c.table_name, c.column_name),
        false, true, '')))[1]::text::int), 0)::int AS n
       FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND starts_with(c.table_name, '${p}')
        AND c.column_name IN ('user_id', 'id') AND c.data_type = 'uuid'`,
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Deletes temp users, then asserts zero auth rows and zero ziko_ rows remain for their ids.
 * Remaining ziko_ rows are deleted with a statement restricted to ziko_-prefixed tables and exactly
 * those ids, then re-checked. Returns { leftoverUsers, leftoverRows }.
 */
export async function cleanupTempUsers(admin, ref, users) {
  const ids = users.map((u) => u.id).filter(Boolean);
  if (ids.length === 0) return { leftoverUsers: 0, leftoverRows: 0 };
  const list = idList(ids);
  for (const id of ids) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      /* asserted below */
    }
  }
  let leftoverUsers = Number((await runSql(ref, `SELECT count(*)::int AS n FROM auth.users WHERE id IN (${list})`))[0]?.n ?? 0);
  let leftoverRows = await countRowsByPrefix(ref, 'ziko_', ids);
  if (leftoverRows > 0) {
    await runSql(
      ref,
      `DO $cleanup$
       DECLARE r record; pass int;
       BEGIN
         FOR pass IN 1..3 LOOP
           FOR r IN
             SELECT c.table_name, c.column_name
               FROM information_schema.columns c
               JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
              WHERE c.table_schema = 'public' AND starts_with(c.table_name, 'ziko_')
                AND c.column_name IN ('user_id', 'id') AND c.data_type = 'uuid'
           LOOP
             BEGIN
               EXECUTE format('DELETE FROM public.%I WHERE %I::text IN (${list.replace(/'/g, "''")})', r.table_name, r.column_name);
             EXCEPTION WHEN foreign_key_violation THEN NULL;
             END;
           END LOOP;
         END LOOP;
       END
       $cleanup$;
       SELECT 1 AS n`,
    );
    leftoverRows = await countRowsByPrefix(ref, 'ziko_', ids);
  }
  leftoverUsers = Number((await runSql(ref, `SELECT count(*)::int AS n FROM auth.users WHERE id IN (${list})`))[0]?.n ?? leftoverUsers);
  return { leftoverUsers, leftoverRows };
}
