/**
 * Connection layer for the Phase 4 loader (ziko -> portfolio).
 *
 * RULES:
 *  - Credentials are short-lived Management API login roles, held in memory only.
 *  - No connection-string URLs are ever built (they leak the password in error text).
 *  - TLS verification is always on; there is no option to disable it.
 *  - Session pooler only (port 5432). The transaction pooler port is refused.
 *  - Every thrown error passes through redactSecrets (token, password) and redactPii.
 */

import pg from 'pg';
import { assertProjectRefFormat, redactPii } from '../auth-merge/lib.mjs';

const API = 'https://api.supabase.com';
const POOLER_HOST_RE = /^[a-z0-9.-]+\.pooler\.supabase\.com$/;
const APP_NAME = 'ziko-portfolio-migration-phase4';

/** Mask each secret (any non-empty string) as [secret], then apply redactPii. */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? '');
  const list = secrets
    .filter((s) => typeof s === 'string' && s.length > 0)
    .sort((a, b) => b.length - a.length);
  for (const s of list) out = out.split(s).join('[secret]');
  return redactPii(out);
}

function fail(message, secrets) {
  return new Error(redactSecrets(message, secrets));
}

async function api(ref, path, { method, body, token, fetchImpl = fetch }) {
  assertProjectRefFormat(ref);
  const res = await fetchImpl(`${API}/v1/projects/${ref}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res;
}

/** POST login-role. Returns { role, password } (password must never be logged). */
export async function createLoginRole(ref, { readOnly = false } = {}, { token, fetchImpl = fetch } = {}) {
  assertProjectRefFormat(ref);
  let res;
  try {
    res = await api(ref, '/cli/login-role', {
      method: 'POST',
      body: { read_only: !!readOnly },
      token,
      fetchImpl,
    });
  } catch (err) {
    throw fail(`login-role request failed on ${ref}: ${err.message}`, [token]);
  }
  if (!res.ok) throw fail(`login-role request returned HTTP ${res.status} on ${ref}`, [token]);
  const json = await res.json();
  if (typeof json?.role !== 'string' || typeof json?.password !== 'string') {
    throw fail(`login-role response malformed on ${ref}`, [token, json?.password]);
  }
  return { role: json.role, password: json.password };
}

/** Best effort DELETE of temporary login roles. Never throws. */
export async function deleteLoginRoles(ref, { token, fetchImpl = fetch } = {}) {
  try {
    assertProjectRefFormat(ref);
    const res = await api(ref, '/cli/login-role', { method: 'DELETE', token, fetchImpl });
    return !!res.ok;
  } catch {
    return false;
  }
}

/** Pure: pick the PRIMARY pooler config; session mode is always port 5432. */
export function pickSessionPooler(json) {
  const list = Array.isArray(json) ? json : [];
  const primary = list.find((c) => String(c?.database_type ?? '').toUpperCase() === 'PRIMARY');
  if (!primary) throw new Error('no PRIMARY pooler config returned');
  const host = primary.db_host;
  if (typeof host !== 'string' || !POOLER_HOST_RE.test(host)) {
    throw new Error('pooler host is not a *.pooler.supabase.com hostname');
  }
  return { host, port: 5432 };
}

export async function getSessionPooler(ref, { token, fetchImpl = fetch } = {}) {
  assertProjectRefFormat(ref);
  let res;
  try {
    res = await api(ref, '/config/database/pooler', { method: 'GET', token, fetchImpl });
  } catch (err) {
    throw fail(`pooler config request failed on ${ref}: ${err.message}`, [token]);
  }
  if (!res.ok) throw fail(`pooler config returned HTTP ${res.status} on ${ref}`, [token]);
  try {
    return pickSessionPooler(await res.json());
  } catch (err) {
    throw fail(`${err.message} (${ref})`, [token]);
  }
}

/** pg config object (never a URL). */
export function buildClientConfig({ host, port = 5432, role, ref, password, caPem }) {
  if (Number(port) === 6543) throw new Error('refusing transaction pooler port; session mode (5432) required');
  if (Number(port) !== 5432) throw new Error('unexpected pooler port');
  assertProjectRefFormat(ref);
  if (typeof host !== 'string' || !host) throw new Error('host is required');
  if (typeof role !== 'string' || !role) throw new Error('role is required');
  const ssl = { rejectUnauthorized: true };
  if (caPem) ssl.ca = caPem;
  return {
    host,
    port: 5432,
    user: `${role}.${ref}`,
    password,
    database: 'postgres',
    application_name: APP_NAME,
    ssl,
  };
}

/** Pure: parent role of a temporary CLI login role (cli_login_postgres -> postgres). */
export function parentRoleOf(loginRole) {
  const m = /^cli_login_([a-z_][a-z0-9_]*)$/.exec(String(loginRole ?? ''));
  if (!m) throw new Error('unexpected login role name');
  return m[1];
}

/**
 * The temporary login role is only a member of its parent (NOINHERIT, no BYPASSRLS of its own).
 * SET ROLE to the parent (session scoped, no RESET) gives the parent's table privileges and
 * BYPASSRLS. Verified: the effective role must bypass RLS, otherwise COPY could drop rows.
 */
export async function assumeParentRole(client, loginRole) {
  const parent = parentRoleOf(loginRole);
  await client.query(`SET ROLE "${parent}"`);
  const r = await client.query(
    'SELECT current_user AS u, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass'
  );
  if (r.rows[0]?.u !== parent || r.rows[0]?.bypass !== true) {
    throw new Error(`effective role ${parent} does not bypass RLS`);
  }
  return parent;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One pg.Client (no Pool, no reconnect after success). Connects immediately after role creation
 * because the login role TTL may be very short. The password is not retained after connect.
 * A pooler can briefly hold stale state for a just-recreated role name, so the connect plus
 * SET ROLE sequence is retried (fresh role each time) a few times before failing.
 */
export async function connectClient(ref, { readOnly = false, token, caPem, fetchImpl = fetch, attempts = 4, delayMs = 4000 } = {}) {
  assertProjectRefFormat(ref);
  const { host, port } = await getSessionPooler(ref, { token, fetchImpl });
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    let { role, password } = await createLoginRole(ref, { readOnly }, { token, fetchImpl });
    const secrets = [token, password];
    const client = new pg.Client(buildClientConfig({ host, port, role, ref, password, caPem }));
    client.on('error', (err) => {
      process.stderr.write(`${redactSecrets(`pg client error on ${ref}: ${err.message}`, secrets)}
`);
    });
    try {
      await client.connect();
      const effective = await assumeParentRole(client, role);
      return { client, role, effective };
    } catch (err) {
      lastErr = fail(`connect failed on ${ref} (attempt ${i}/${attempts}): ${err.message}`, secrets);
      await client.end().catch(() => {});
      if (i < attempts) await sleep(delayMs);
    } finally {
      password = null;
    }
  }
  throw lastErr;
}
