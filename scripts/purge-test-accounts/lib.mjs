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
 * Every cross-user table this purge must check, declared once so the query
 * loop below is the same shape for all of them — every table in
 * supabase/migrations/ with two or more columns `REFERENCES auth.users(id)`.
 * Verified by direct migration inspection (CR-01, 2026-08-14):
 * supabase/migrations/035_coach_invitations_links_rls.sql (coach_invitations,
 * coach_client_links), supabase/migrations/20260527_coach_vocal_feedbacks.sql,
 * supabase/migrations/036_workout_programs_ai_imports.sql,
 * supabase/migrations/009_community_schema.sql (friendships, app_invites,
 * screen_reactions, shared_programs, xp_gifts, coin_gifts,
 * habit_encouragements), supabase/migrations/041_coach_client_tags_notes.sql,
 * supabase/migrations/050_coach_ai_schema.sql,
 * supabase/migrations/056_dashboard_widgets.sql,
 * supabase/migrations/057_coach_videos_schema.sql, and
 * supabase/migrations/063_coach_metric_thresholds.sql. Since a future
 * migration could add another two-FK table without this list being updated,
 * treat any new cross-user table as a required addition here.
 */
const CROSS_LINK_SOURCES = [
  { table: 'coach_client_links', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_vocal_feedbacks', columnA: 'coach_id', columnB: 'athlete_id' },
  { table: 'workout_programs', columnA: 'created_by_coach_id', columnB: 'assigned_to_user_id' },
  { table: 'coach_invitations', columnA: 'coach_id', columnB: 'used_by' },
  { table: 'friendships', columnA: 'requester_id', columnB: 'addressee_id' },
  { table: 'app_invites', columnA: 'inviter_id', columnB: 'used_by' },
  { table: 'screen_reactions', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'shared_programs', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'xp_gifts', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'coin_gifts', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'habit_encouragements', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'coach_client_tags', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_client_notes', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_alerts', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'ai_tool_audit', columnA: 'coach_id', columnB: 'target_client_id' },
  { table: 'dashboard_configs', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_client_videos', columnA: 'athlete_id', columnB: 'coach_id' },
  { table: 'coach_metric_thresholds', columnA: 'coach_id', columnB: 'client_id' },
];

// PostgREST's URL length limit is what this guards against — a large
// candidate set issued as a single `.in(...)` call could exceed it.
const CROSS_LINK_BATCH_SIZE = 200;

/** @param {string[]} arr @param {number} size @returns {string[][]} */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Queries every declared cross-user table (coach_client_links,
 * coach_vocal_feedbacks, workout_programs) on both of its user columns, so a
 * test account is caught whichever side of the pair it sits on. Skips any row
 * whose opposite column is null — nobody to entangle with. Chunks
 * candidateIds into batches of 200 per `.in(...)` call. Throws, naming the
 * table and column, on any query error rather than swallowing it — a
 * swallowed error here would silently read as "no cross-links found," the
 * single most dangerous failure mode of this whole script. Returns an empty
 * array without issuing a query when candidateIds is empty.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} candidateIds
 * @returns {Promise<Array<{table: string, candidateColumn: string, candidateId: string, linkedColumn: string, linkedUserId: string}>>}
 */
export async function fetchCrossLinks(client, candidateIds) {
  if (!candidateIds || candidateIds.length === 0) return [];

  const links = [];
  const batches = chunk(candidateIds, CROSS_LINK_BATCH_SIZE);

  for (const { table, columnA, columnB } of CROSS_LINK_SOURCES) {
    for (const batch of batches) {
      // Candidate on columnA (e.g. coach_id) — linked on columnB.
      const { data: rowsA, error: errorA } = await client
        .from(table)
        .select(`${columnA}, ${columnB}`)
        .in(columnA, batch);
      if (errorA) {
        throw new Error(`fetchCrossLinks: ${table}.${columnA} query failed: ${errorA.message}`);
      }
      for (const row of rowsA ?? []) {
        if (row[columnB] == null) continue;
        links.push({
          table,
          candidateColumn: columnA,
          candidateId: row[columnA],
          linkedColumn: columnB,
          linkedUserId: row[columnB],
        });
      }

      // Candidate on columnB (e.g. client_id/athlete_id/assigned_to_user_id) — linked on columnA.
      const { data: rowsB, error: errorB } = await client
        .from(table)
        .select(`${columnA}, ${columnB}`)
        .in(columnB, batch);
      if (errorB) {
        throw new Error(`fetchCrossLinks: ${table}.${columnB} query failed: ${errorB.message}`);
      }
      for (const row of rowsB ?? []) {
        if (row[columnA] == null) continue;
        links.push({
          table,
          candidateColumn: columnB,
          candidateId: row[columnB],
          linkedColumn: columnA,
          linkedUserId: row[columnA],
        });
      }
    }
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

/** Quotes a CSV field only when it contains a comma, quote, or newline. */
function csvField(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Renders the to_delete row set as CSV — the artifact a second reviewer
 * actually reads under Pitfall 13's two-person rule, so it carries the
 * delete set and not the flagged set.
 * @param {Array<{id: string, email: string | undefined, created_at: string}>} toDelete
 * @returns {string}
 */
function toDeleteCsv(toDelete) {
  const header = 'id,email,created_at';
  const rows = toDelete.map((r) =>
    [csvField(r.id), csvField(r.email), csvField(r.created_at)].join(',')
  );
  return [header, ...rows].join('\n') + '\n';
}

/**
 * Writes the report as pretty-printed JSON and the to_delete set as CSV to
 * outDir (created recursively). Returns both paths.
 * @param {object} report DryRunReport
 * @param {string} outDir
 * @returns {Promise<{ jsonPath: string, csvPath: string }>}
 */
export async function writeReport(report, outDir) {
  await mkdir(outDir, { recursive: true });

  const stamp = report.generated_at.replace(/:/g, '-');

  const jsonPath = join(outDir, `dry-run-${stamp}.json`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = join(outDir, `dry-run-${stamp}.csv`);
  await writeFile(csvPath, toDeleteCsv(report.to_delete), 'utf8');

  return { jsonPath, csvPath };
}
