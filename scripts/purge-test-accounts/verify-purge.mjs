/**
 * Test-account purge — post-purge reconciliation: proves no manifest id
 * survived, that every surviving criterion match was named in advance as
 * deliberately withheld, that no real account outside the reviewed set
 * disappeared, and that no reference to a deleted id remains in any
 * cross-user table.
 *
 * Usage: node scripts/purge-test-accounts/verify-purge.mjs --manifest <path> --report <path>
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This script issues reads only — no deletion, no raw bulk statement, no
 * RPC call exists anywhere in this file (PURGE-05).
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createPurgeAdminClient, isTestAccountEmail, listAllUsers } from './lib.mjs';

// ── Residual reconciliation (D-05, PURGE-05) ─────────────────────────────

/**
 * D-05 deliberately withholds cross-linked candidates from the purge, so a
 * literal "re-run the match, expect nothing" check would report failure on
 * exactly the accounts the design chose to spare. The honest form of that
 * criterion is implemented here: nothing from the manifest survived
 * (`deleted_still_present`), and every surviving criterion match is either
 * one `report.flagged` named as withheld in advance (`expected_remaining`)
 * or a genuine surprise (`unexpected_matches`).
 * @param {{ users: Array<{id: string, email?: string}>, manifest: {candidate_ids: string[]}, report: {flagged?: Array<{candidate_id: string}>} }} args
 * @returns {{ ok: boolean, deleted_still_present: string[], expected_remaining: string[], unexpected_matches: string[] }}
 */
export function checkResidualMatches({ users, manifest, report }) {
  const candidateIdSet = new Set(manifest.candidate_ids ?? []);
  const deletedStillPresent = users.filter((u) => candidateIdSet.has(u.id)).map((u) => u.id);

  const flaggedIdSet = new Set((report.flagged ?? []).map((f) => f.candidate_id));
  const criterionMatches = users.filter((u) => isTestAccountEmail(u.email));

  const expectedRemaining = [];
  const unexpectedMatches = [];
  for (const u of criterionMatches) {
    if (flaggedIdSet.has(u.id)) {
      expectedRemaining.push(u.id);
    } else {
      unexpectedMatches.push(u.id);
    }
  }

  return {
    ok: deletedStillPresent.length === 0 && unexpectedMatches.length === 0,
    deleted_still_present: deletedStillPresent,
    expected_remaining: expectedRemaining,
    unexpected_matches: unexpectedMatches,
  };
}

// ── Account conservation (T-02-24, PITFALLS.md Pitfall 13 step 7) ────────

/**
 * The only post-check able to see a real account destroyed by an
 * over-broad criterion: the residual and orphan checks both look at what
 * remains or dangles, and a wrongly deleted real account leaves neither
 * trace. Asserts the surviving count never falls below the scanned count
 * minus the manifest size — a higher count is legitimate (accounts created
 * between the dry-run and this check only add), a lower one means an
 * account outside the reviewed set is gone.
 * @param {{ users: Array<object>, manifest: {candidate_ids: string[]}, report: {totals: {users_scanned: number}} }} args
 * @returns {{ ok: boolean, expected_floor: number, actual: number, shortfall: number }}
 */
export function checkAccountConservation({ users, manifest, report }) {
  const expectedFloor = report.totals.users_scanned - manifest.candidate_ids.length;
  const actual = users.length;
  const shortfall = Math.max(0, expectedFloor - actual);

  return {
    ok: actual >= expectedFloor,
    expected_floor: expectedFloor,
    actual,
    shortfall,
  };
}

// ── Cross-table orphan scan (T-02-22, PURGE-05) ───────────────────────────

// The documented orphan-scan surface — every column across every table that
// references a deleted id, mirroring CROSS_LINK_SOURCES in lib.mjs plus
// workout_programs.user_id and user_profiles.id (which are single-FK, not
// cross-link, tables but are still part of the post-purge orphan proof).
// Verified against supabase/migrations/035_coach_invitations_links_rls.sql
// (coach_invitations, coach_client_links),
// supabase/migrations/20260527_coach_vocal_feedbacks.sql,
// supabase/migrations/036_workout_programs_ai_imports.sql (plus
// workout_programs.user_id from 001_initial_schema.sql),
// supabase/migrations/009_community_schema.sql (friendships, app_invites,
// screen_reactions, shared_programs, xp_gifts, coin_gifts,
// habit_encouragements), supabase/migrations/041_coach_client_tags_notes.sql,
// supabase/migrations/050_coach_ai_schema.sql,
// supabase/migrations/056_dashboard_widgets.sql,
// supabase/migrations/057_coach_videos_schema.sql, and
// supabase/migrations/063_coach_metric_thresholds.sql (CR-01, 2026-08-14).
const ORPHAN_SOURCES = [
  { table: 'user_profiles', column: 'id' },
  { table: 'coach_client_links', column: 'coach_id' },
  { table: 'coach_client_links', column: 'client_id' },
  { table: 'coach_vocal_feedbacks', column: 'coach_id' },
  { table: 'coach_vocal_feedbacks', column: 'athlete_id' },
  { table: 'workout_programs', column: 'user_id' },
  { table: 'workout_programs', column: 'created_by_coach_id' },
  { table: 'workout_programs', column: 'assigned_to_user_id' },
  { table: 'coach_invitations', column: 'coach_id' },
  { table: 'coach_invitations', column: 'used_by' },
  { table: 'friendships', column: 'requester_id' },
  { table: 'friendships', column: 'addressee_id' },
  { table: 'app_invites', column: 'inviter_id' },
  { table: 'app_invites', column: 'used_by' },
  { table: 'screen_reactions', column: 'sender_id' },
  { table: 'screen_reactions', column: 'receiver_id' },
  { table: 'shared_programs', column: 'sender_id' },
  { table: 'shared_programs', column: 'receiver_id' },
  { table: 'xp_gifts', column: 'sender_id' },
  { table: 'xp_gifts', column: 'receiver_id' },
  { table: 'coin_gifts', column: 'sender_id' },
  { table: 'coin_gifts', column: 'receiver_id' },
  { table: 'habit_encouragements', column: 'sender_id' },
  { table: 'habit_encouragements', column: 'receiver_id' },
  { table: 'coach_client_tags', column: 'coach_id' },
  { table: 'coach_client_tags', column: 'client_id' },
  { table: 'coach_client_notes', column: 'coach_id' },
  { table: 'coach_client_notes', column: 'client_id' },
  { table: 'coach_alerts', column: 'coach_id' },
  { table: 'coach_alerts', column: 'client_id' },
  { table: 'ai_tool_audit', column: 'coach_id' },
  { table: 'ai_tool_audit', column: 'target_client_id' },
  { table: 'dashboard_configs', column: 'coach_id' },
  { table: 'dashboard_configs', column: 'client_id' },
  { table: 'coach_client_videos', column: 'athlete_id' },
  { table: 'coach_client_videos', column: 'coach_id' },
  { table: 'coach_metric_thresholds', column: 'coach_id' },
  { table: 'coach_metric_thresholds', column: 'client_id' },
];

// Mirrors CROSS_LINK_BATCH_SIZE in lib.mjs — the same PostgREST URL-length
// limit applies to `.in()` calls here.
const ORPHAN_CHUNK_SIZE = 200;

/** @param {string[]} arr @param {number} size @returns {string[][]} */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Queries every documented orphan-scan column for a reference to any
 * deleted id. Throws, naming the table and column, on a query error —
 * an empty result caused by a swallowed error reads identically to a clean
 * scan and would certify the exact thing this scan exists to detect
 * (T-02-22). Returns an empty array without issuing a query when
 * deletedIds is empty.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} deletedIds
 * @returns {Promise<Array<{table: string, column: string, id: string}>>}
 */
export async function fetchOrphanRows(client, deletedIds) {
  if (!deletedIds || deletedIds.length === 0) return [];

  const hits = [];
  for (const { table, column } of ORPHAN_SOURCES) {
    for (const batch of chunk(deletedIds, ORPHAN_CHUNK_SIZE)) {
      const { data, error } = await client.from(table).select(column).in(column, batch);
      if (error) {
        throw new Error(`fetchOrphanRows: ${table}.${column} query failed: ${error.message}`);
      }
      for (const row of data ?? []) {
        const id = row[column];
        if (id != null) hits.push({ table, column, id });
      }
    }
  }
  return hits;
}

/**
 * Pure summary over fetchOrphanRows' output: a per-`table.column` count and
 * a total, succeeding only when that total is zero.
 * @param {Array<{table: string, column: string, id: string}>} rows
 * @returns {{ ok: boolean, total: number, byTable: Record<string, number> }}
 */
export function summarizeOrphans(rows) {
  const byTable = {};
  for (const row of rows) {
    const key = `${row.table}.${row.column}`;
    byTable[key] = (byTable[key] ?? 0) + 1;
  }
  return { ok: rows.length === 0, total: rows.length, byTable };
}

// ── CLI ──────────────────────────────────────────────────────────────────

function parseVerifyArgs(argv) {
  const manifestIdx = argv.indexOf('--manifest');
  const manifestPath = manifestIdx !== -1 && argv[manifestIdx + 1] ? argv[manifestIdx + 1] : null;

  const reportIdx = argv.indexOf('--report');
  const reportPath = reportIdx !== -1 && argv[reportIdx + 1] ? argv[reportIdx + 1] : null;

  return { manifestPath, reportPath };
}

async function main() {
  const { manifestPath, reportPath } = parseVerifyArgs(process.argv.slice(2));

  if (!manifestPath || !reportPath) {
    console.error('Usage: node scripts/purge-test-accounts/verify-purge.mjs --manifest <path> --report <path>');
    process.exit(1);
    return;
  }

  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
  const report = JSON.parse(await readFile(resolve(reportPath), 'utf8'));

  const client = createPurgeAdminClient();
  const users = await listAllUsers(client);

  const residual = checkResidualMatches({ users, manifest, report });
  const conservation = checkAccountConservation({ users, manifest, report });
  const orphanRows = await fetchOrphanRows(client, manifest.candidate_ids);
  const orphans = summarizeOrphans(orphanRows);

  console.log('Test-account purge — verify');
  console.log('  residual reconciliation:');
  console.log(`    deleted_still_present: ${residual.deleted_still_present.length}`);
  if (residual.deleted_still_present.length > 0) {
    console.log(`      ${residual.deleted_still_present.join(', ')}`);
  }
  console.log(`    expected_remaining (withheld, D-05): ${residual.expected_remaining.length}`);
  if (residual.expected_remaining.length > 0) {
    console.log(`      ${residual.expected_remaining.join(', ')}`);
  }
  console.log(`    unexpected_matches: ${residual.unexpected_matches.length}`);
  if (residual.unexpected_matches.length > 0) {
    console.log(`      ${residual.unexpected_matches.join(', ')}`);
  }

  console.log('  account conservation:');
  console.log(`    expected floor (scanned - manifest size): ${conservation.expected_floor}`);
  console.log(`    actual surviving count:                   ${conservation.actual}`);
  console.log(`    shortfall:                                ${conservation.shortfall}`);

  console.log('  orphan scan:');
  console.log(`    total orphan rows: ${orphans.total}`);
  for (const [key, count] of Object.entries(orphans.byTable)) {
    console.log(`      ${key}: ${count}`);
  }

  const ok = residual.ok && conservation.ok && orphans.ok;
  console.log(ok ? '  RESULT: PASS' : '  RESULT: FAIL');
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('verify-purge failed:', err.message);
    process.exit(1);
  });
}
