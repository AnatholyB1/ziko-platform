/**
 * Waitlist erasure — human-triggered invocation of Phase 1's
 * anonymize_waitlist_signup() RPC (D-06, LEGAL-09).
 *
 * Usage: node scripts/waitlist-erasure/erase.mjs --email <address> --confirm [--log <path>]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This script does not carry Phase 2's full purge ceremony (no dry-run export,
 * no hashed manifest, no two-person rule) — the RPC it calls is a single-row,
 * non-destructive, anonymising UPDATE with no cascade (see
 * supabase/migrations/20260812_waitlist_founder_offer.sql lines 217-241), and
 * that rigor would be disproportionate here. The admin client follows
 * scripts/purge-test-accounts/lib.mjs exactly: read SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from the environment, fail fast and by name when
 * either is missing, and never fall back to a publishable or anon key — the
 * RPC has no grant for those roles anyway (REVOKE ... FROM PUBLIC, anon,
 * authenticated), so a fallback would produce a confusing permission error
 * instead of an honest missing-credential message.
 *
 * The email address is passed through to the RPC verbatim, never normalised
 * or lowercased in JavaScript: normalize_waitlist_email() already runs inside
 * the RPC, and a second client-side normalisation would silently diverge if
 * the SQL definition ever changes.
 */

import { createClient } from '@supabase/supabase-js';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// ── CLI argument parsing ────────────────────────────────────────────────

/**
 * Parses `--email <address>`, the required `--confirm` flag, and an optional
 * `--log <path>`. Throws a descriptive error when the address is missing,
 * when it fails a basic single-`@` shape check, or when `--confirm` is
 * absent. The address is trimmed of surrounding whitespace only — no
 * lowercasing, no other normalisation; the RPC's own
 * normalize_waitlist_email() is the single source of truth for that.
 * @param {string[]} argv
 * @returns {{ email: string, confirm: boolean, logPath: string }}
 */
export function parseErasureArgs(argv) {
  const emailIdx = argv.indexOf('--email');
  const rawEmail = emailIdx !== -1 ? argv[emailIdx + 1] : undefined;

  if (!rawEmail) {
    throw new Error('Missing required --email <address>');
  }

  const email = rawEmail.trim();
  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) {
    throw new Error(`--email does not look like a valid address (expected exactly one '@'): ${rawEmail}`);
  }

  const confirm = argv.includes('--confirm');
  if (!confirm) {
    throw new Error('Missing required --confirm flag — this is a deliberate safety gate, not optional');
  }

  const logIdx = argv.indexOf('--log');
  const logPath = logIdx !== -1 && argv[logIdx + 1] ? argv[logIdx + 1] : defaultLogPath();

  return { email, confirm, logPath };
}

/**
 * Default log path lives under the OS temp directory, never inside the
 * repository — a real registrant's address must never be committed
 * (T-03-14).
 * @returns {string}
 */
function defaultLogPath() {
  return join(tmpdir(), 'waitlist-erasure', 'erasure-log.jsonl');
}

// ── Admin client (mirrors scripts/purge-test-accounts/lib.mjs) ─────────────

/**
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from process.env. Exits 1
 * (naming the missing variables, never a value) when either is absent. Never
 * falls back to a publishable or anon key.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createErasureAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Erasure call ─────────────────────────────────────────────────────────

/**
 * Calls anonymize_waitlist_signup(p_email) and maps the result. `anonymized:
 * false` (RPC returned `false`, no error) is a legitimate outcome — no
 * matching un-anonymised row was found — and is reported to the caller, not
 * treated as a failure.
 * @param {{ rpc: (fn: string, args: object) => Promise<{ data: unknown, error: { message?: string } | null }> }} client
 * @param {string} email
 * @returns {Promise<{ ok: boolean, anonymized: boolean, error: string | null }>}
 */
export async function runErasure(client, email) {
  const { data, error } = await client.rpc('anonymize_waitlist_signup', { p_email: email });

  if (error) {
    return { ok: false, anonymized: false, error: error.message ?? String(error) };
  }

  return { ok: true, anonymized: data === true, error: null };
}

// ── Audit log ────────────────────────────────────────────────────────────

/**
 * Appends one JSON line recording the timestamp, the address acted on, the
 * boolean outcome, and the operator identifier (from the ERASURE_OPERATOR
 * env var, if set) to logPath — created recursively.
 * @param {{ email: string, result: { ok: boolean, anonymized: boolean, error: string | null } }} entry
 * @param {string} logPath
 * @returns {Promise<void>}
 */
export async function writeErasureLog(entry, logPath) {
  await mkdir(dirname(logPath), { recursive: true });

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    email: entry.email,
    ok: entry.result.ok,
    anonymized: entry.result.anonymized,
    error: entry.result.error,
    operator: process.env.ERASURE_OPERATOR ?? null,
  });

  await appendFile(logPath, line + '\n', 'utf8');
}

// ── CLI ──────────────────────────────────────────────────────────────────

async function main() {
  let args;
  try {
    args = parseErasureArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error('Usage: node scripts/waitlist-erasure/erase.mjs --email <address> --confirm [--log <path>]');
    process.exit(1);
    return;
  }

  const client = createErasureAdminClient();
  const result = await runErasure(client, args.email);
  await writeErasureLog({ email: args.email, result }, args.logPath);

  if (!result.ok) {
    console.error(`Waitlist erasure — error: ${result.error}`);
    process.exit(1);
    return;
  }

  if (result.anonymized) {
    console.log(`Waitlist erasure — ${args.email} anonymized.`);
  } else {
    console.log(`Waitlist erasure — no matching active row found for ${args.email}.`);
  }
  console.log(`  log written to: ${args.logPath}`);

  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('erase failed:', err.message);
    process.exit(1);
  });
}
