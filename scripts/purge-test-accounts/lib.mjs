/**
 * Test-account purge — read-only enumeration, classification, and report writer.
 *
 * Usage: node scripts/purge-test-accounts/dry-run.mjs
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This module contains no destructive Admin API call and no raw SQL against the
 * auth schema. The criterion (D-01) is an exact domain match after the final `@` —
 * never a substring, LIKE, or contains match. See
 * .planning/workstreams/lien-invite/phases/02-test-account-purge/02-CONTEXT.md.
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// ── Criterion (D-01) ────────────────────────────────────────────────────────

export const TEST_ACCOUNT_DOMAIN = 'ziko-app.com';

/**
 * Exact domain equality after the final `@`, case-insensitive, whitespace-trimmed.
 * Never a substring, LIKE, or contains match — a lookalike domain
 * (notziko-app.com, sub.ziko-app.com, ziko-app.co, ziko-app.com.attacker.tld) must
 * never match.
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isTestAccountEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return false; // no '@', or empty local part
  const domain = normalized.slice(at + 1);
  return domain === TEST_ACCOUNT_DOMAIN;
}

// ── Admin client (mirrors apps/web/src/lib/supabase/admin.ts) ──────────────

/**
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from process.env. Exits 1
 * (naming the missing variables, never a value) when either is absent — this
 * fail-fast is also the D-03 safety property: with no key in the environment
 * this tooling cannot touch anything.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createPurgeAdminClient() {
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

// ── Enumeration ──────────────────────────────────────────────────────────

/**
 * Loops the Admin API's paginated listUsers until a page returns fewer than
 * perPage rows. A single unpaginated call would silently under-report
 * candidates on a project with more than 1000 accounts.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<Array<{id: string, email: string | undefined, created_at: string, last_sign_in_at: string | null}>>}
 */
export async function listAllUsers(client) {
  const perPage = 1000;
  let page = 1;
  const users = [];

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listAllUsers: Admin API error on page ${page}: ${error.message}`);
    }
    const pageUsers = data?.users ?? [];
    for (const u of pageUsers) {
      users.push({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

// ── Cross-link detection (D-05) ─────────────────────────────────────────

/**
 * Queries coach_client_links for candidates on either the coach_id or client_id
 * column, so a test account is caught whether it is the coach or the client.
 * Returns an empty array when candidateIds is empty rather than issuing a query.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} candidateIds
 * @returns {Promise<Array<{table: string, candidateColumn: string, candidateId: string, linkedColumn: string, linkedUserId: string}>>}
 */
export async function fetchCrossLinks(client, candidateIds) {
  if (!candidateIds || candidateIds.length === 0) return [];

  const links = [];

  const { data: coachRows, error: coachError } = await client
    .from('coach_client_links')
    .select('coach_id, client_id')
    .in('coach_id', candidateIds);
  if (coachError) {
    throw new Error(
      `fetchCrossLinks: coach_client_links.coach_id query failed: ${coachError.message}`
    );
  }
  for (const row of coachRows ?? []) {
    if (row.client_id == null) continue;
    links.push({
      table: 'coach_client_links',
      candidateColumn: 'coach_id',
      candidateId: row.coach_id,
      linkedColumn: 'client_id',
      linkedUserId: row.client_id,
    });
  }

  const { data: clientRows, error: clientError } = await client
    .from('coach_client_links')
    .select('coach_id, client_id')
    .in('client_id', candidateIds);
  if (clientError) {
    throw new Error(
      `fetchCrossLinks: coach_client_links.client_id query failed: ${clientError.message}`
    );
  }
  for (const row of clientRows ?? []) {
    if (row.coach_id == null) continue;
    links.push({
      table: 'coach_client_links',
      candidateColumn: 'client_id',
      candidateId: row.client_id,
      linkedColumn: 'coach_id',
      linkedUserId: row.coach_id,
    });
  }

  return links;
}

// ── Pure classification (D-05) ──────────────────────────────────────────

/**
 * Partitions users into candidates via isTestAccountEmail, then walks
 * crossLinks: a link counts when its candidateId is in the candidate set and
 * its linkedUserId is NOT — that is D-05's hazard, a test account entangled
 * with a real one. Free of I/O so it is directly assertable.
 * @param {{ users: Array<{id: string, email: string | undefined, created_at: string, last_sign_in_at: string | null}>, crossLinks: Array<{table: string, candidateColumn: string, candidateId: string, linkedColumn: string, linkedUserId: string}> }} input
 * @returns {{ candidates: Array<object>, flagged: Array<object>, toDelete: Array<object> }}
 */
export function classifyAccounts({ users, crossLinks }) {
  const candidates = users.filter((u) => isTestAccountEmail(u.email));
  const candidateIds = new Set(candidates.map((c) => c.id));
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  const flagged = [];
  const flaggedCandidateIds = new Set();

  for (const link of crossLinks) {
    if (!candidateIds.has(link.candidateId)) continue;
    if (candidateIds.has(link.linkedUserId)) continue; // both ends are test data

    const candidate = candidateById.get(link.candidateId);
    flagged.push({
      candidate_id: link.candidateId,
      candidate_email: candidate?.email,
      linked_user_id: link.linkedUserId,
      table: link.table,
      candidate_column: link.candidateColumn,
      linked_column: link.linkedColumn,
    });
    flaggedCandidateIds.add(link.candidateId);
  }

  const toDelete = candidates.filter((c) => !flaggedCandidateIds.has(c.id));

  return { candidates, flagged, toDelete };
}

// ── Orchestration (injection seam) ──────────────────────────────────────

/**
 * Takes its two data sources as injected async functions with no default
 * binding to any client. This injection seam is what lets the whole pipeline
 * be proven without a service-role key.
 * @param {{ listUsers: () => Promise<Array<object>>, fetchCrossLinks: (candidateIds: string[]) => Promise<Array<object>>, now?: () => Date }} deps
 * @returns {Promise<object>} DryRunReport
 */
export async function runDryRun({ listUsers, fetchCrossLinks, now = () => new Date() }) {
  const users = await listUsers();

  // First pass: derive the candidate id set with an empty cross-link list.
  const { candidates } = classifyAccounts({ users, crossLinks: [] });
  const candidateIds = candidates.map((c) => c.id);

  const crossLinks = await fetchCrossLinks(candidateIds);

  // Second pass: real partition using the fetched cross-links.
  const { flagged, toDelete } = classifyAccounts({ users, crossLinks });

  const generated_at = now().toISOString();

  return {
    generated_at,
    criterion: {
      rule: `The account email domain equals ${TEST_ACCOUNT_DOMAIN} exactly, case-insensitively`,
      decision: 'D-01',
      domain: TEST_ACCOUNT_DOMAIN,
    },
    totals: {
      users_scanned: users.length,
      candidates: candidates.length,
      flagged_cross_linked: flagged.length,
      to_delete: toDelete.length,
    },
    candidates: candidates.map((c) => ({
      id: c.id,
      email: c.email,
      created_at: c.created_at,
      last_sign_in_at: c.last_sign_in_at,
    })),
    flagged,
    to_delete: toDelete.map((c) => ({ id: c.id, email: c.email, created_at: c.created_at })),
  };
}

// ── Report writer ────────────────────────────────────────────────────────

/**
 * Writes the report as pretty-printed JSON to outDir (created recursively).
 * Returns the path written. csvPath is added in a later task.
 * @param {object} report DryRunReport
 * @param {string} outDir
 * @returns {Promise<{ jsonPath: string, csvPath: undefined }>}
 */
export async function writeReport(report, outDir) {
  await mkdir(outDir, { recursive: true });

  const stamp = report.generated_at.replace(/:/g, '-');

  const jsonPath = join(outDir, `dry-run-${stamp}.json`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  return { jsonPath, csvPath: undefined };
}
