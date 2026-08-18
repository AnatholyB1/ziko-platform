// Phase 02-04 — the end-to-end rehearsal: one ordered composition test that
// walks RUNBOOK.md's steps 2 through 7 against a single in-memory fixture
// project, chaining the real exported functions from all five modules
// (lib.mjs, export.mjs, pitr.mjs, delete.mjs, verify-purge.mjs) rather than
// reimplementing any of their logic. Issues no network call and reads no
// environment variable — every data source is an injected fixture or fake,
// which is what makes this a rehearsal rather than a run (D-03).
import { describe, expect, it, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDryRun, writeReport, fetchCrossLinks } from '../../../../scripts/purge-test-accounts/lib.mjs';
import { collectExportRows, buildManifest, writeExport } from '../../../../scripts/purge-test-accounts/export.mjs';
import { checkPitrStatus } from '../../../../scripts/purge-test-accounts/pitr.mjs';
import { assertManifestIntegrity, runDelete } from '../../../../scripts/purge-test-accounts/delete.mjs';
import {
  checkResidualMatches,
  checkAccountConservation,
  fetchOrphanRows,
  summarizeOrphans,
} from '../../../../scripts/purge-test-accounts/verify-purge.mjs';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

// ── Fixture project ──────────────────────────────────────────────────────
// 5 test-domain accounts (one of them a coach cross-linked to the real
// athlete below), 2 lookalike-domain accounts, 1 real consumer address.
// coach_vocal_feedbacks, workout_programs and user_profiles carry no row
// referencing any account here — that absence is what a clean, zero-orphan
// post-purge scan actually proves.
function makeFixture() {
  return {
    accounts: [
      { id: 'test-coach-1', email: 'coach1@ziko-app.com', created_at: '2026-01-01T00:00:00Z' },
      { id: 'test-user-2', email: 'qa2@ziko-app.com', created_at: '2026-01-02T00:00:00Z' },
      { id: 'test-user-3', email: 'qa3@ziko-app.com', created_at: '2026-01-03T00:00:00Z' },
      { id: 'test-user-4', email: 'qa4@ziko-app.com', created_at: '2026-01-04T00:00:00Z' },
      { id: 'test-user-5', email: 'qa5@ziko-app.com', created_at: '2026-01-05T00:00:00Z' },
      { id: 'lookalike-1', email: 'person@notziko-app.com', created_at: '2026-01-06T00:00:00Z' },
      { id: 'lookalike-2', email: 'person@sub.ziko-app.com', created_at: '2026-01-07T00:00:00Z' },
      { id: 'real-athlete', email: 'athlete@gmail.com', created_at: '2026-01-08T00:00:00Z' },
    ],
    // D-05's observable end-to-end case: a test-domain coach linked to the
    // real athlete above.
    coach_client_links: [{ coach_id: 'test-coach-1', client_id: 'real-athlete' }],
    coach_vocal_feedbacks: [],
    workout_programs: [],
    user_profiles: [],
    waitlist_signups: [],
  };
}

// A hand-rolled fake exposing only from(table).select(cols).in(col, ids)
// resolving { data, error } — the same seam apps/web/test/purge/purge-lib.test.ts
// and purge-delete.test.ts use, reading live off the mutable fixture so a
// query issued after a mutation sees the mutation.
function makeFixtureClient(fixture: ReturnType<typeof makeFixture>) {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            in(col: string, ids: string[]) {
              const rows = ((fixture as Record<string, Array<Record<string, unknown>>>)[table] ?? []).filter((r) =>
                ids.includes(r[col] as string)
              );
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  };
}

const DRY_RUN_NOW = new Date('2026-08-13T12:00:00.000Z');
const EXPORT_NOW = new Date('2026-08-13T12:05:00.000Z'); // 5 minutes after the dry-run
const INTEGRITY_NOW = new Date('2026-08-13T12:10:00.000Z'); // 10 minutes after the dry-run, well inside the 60-minute window

describe('purge rehearsal — RUNBOOK.md steps 2 through 7 on one fixture', () => {
  it('composes all five modules end to end: dry-run, export, integrity gate, delete, reconciliation', async () => {
    const fixture = makeFixture();
    const client = makeFixtureClient(fixture);
    const dir = mkdtempSync(join(tmpdir(), 'purge-rehearsal-'));
    tmpDirs.push(dir);

    // ── Step 2: dry-run ──────────────────────────────────────────────────
    const report = await runDryRun({
      listUsers: async () => fixture.accounts,
      fetchCrossLinks: (candidateIds: string[]) => fetchCrossLinks(client as never, candidateIds),
      now: () => DRY_RUN_NOW,
    });

    expect(report.totals.candidates).toBe(5);
    expect(report.totals.flagged_cross_linked).toBe(1);
    expect(report.totals.to_delete).toBe(4);
    expect(report.flagged[0]).toMatchObject({ candidate_id: 'test-coach-1', linked_user_id: 'real-athlete' });
    expect(report.to_delete.map((c: { id: string }) => c.id).sort()).toEqual(
      ['test-user-2', 'test-user-3', 'test-user-4', 'test-user-5'].sort()
    );

    const { jsonPath } = await writeReport(report, dir);
    expect(existsSync(jsonPath)).toBe(true);

    // ── Step 3: second-person review — a human reads the written CSV; no code here ──

    // ── Step 4: export, with a PITR read wired in per step 5 ────────────────
    const pitr = await checkPitrStatus({
      supabaseUrl: 'https://fixtureproj.supabase.co',
      accessToken: 'fixture-access-token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ pitr_enabled: true, walg_enabled: true }),
      }),
      now: () => EXPORT_NOW,
    });
    expect(pitr.status).toBe('enabled');

    const rows = await collectExportRows({
      report,
      fetchProfiles: async (ids: string[]) => fixture.user_profiles.filter((p) => ids.includes(p.id as never)),
      fetchWaitlistRows: async (emails: string[]) =>
        fixture.waitlist_signups.filter((w) => emails.includes((w as { email?: string }).email?.toLowerCase() as never)),
    });
    expect(rows.map((r: { user_id: string }) => r.user_id).sort()).toEqual(
      ['test-user-2', 'test-user-3', 'test-user-4', 'test-user-5'].sort()
    );

    const manifest = buildManifest({
      report,
      reportPath: jsonPath,
      csvPath: join(dir, 'placeholder.csv'),
      rows,
      pitr,
      now: () => EXPORT_NOW,
    });
    expect(manifest.candidate_ids.sort()).toEqual(report.to_delete.map((c: { id: string }) => c.id).sort());

    const { csvPath, manifestPath } = await writeExport({ rows, manifest, outDir: dir });
    expect(existsSync(csvPath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);

    // The manifest as actually persisted to disk — export_csv is always
    // corrected to the real written path (see export.mjs's writeExport).
    const finalManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(finalManifest.export_csv).toBe(csvPath);

    // ── Step 6, integrity gate: the manifest passes fresh ───────────────────
    const freshIntegrity = assertManifestIntegrity({
      manifest: finalManifest,
      now: INTEGRITY_NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: existsSync,
    });
    expect(freshIntegrity.ok).toBe(true);
    expect(freshIntegrity.errors).toEqual([]);

    // Negative case: flip one character of the id list and confirm the
    // hash-mismatch guard trips, with nothing deleted.
    const tamperedManifest = { ...finalManifest, candidate_ids: [...finalManifest.candidate_ids] };
    const originalId = tamperedManifest.candidate_ids[0];
    tamperedManifest.candidate_ids[0] = originalId.slice(0, -1) + (originalId.endsWith('2') ? '9' : '2');
    const tamperedIntegrity = assertManifestIntegrity({
      manifest: tamperedManifest,
      now: INTEGRITY_NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: existsSync,
    });
    expect(tamperedIntegrity.ok).toBe(false);
    expect(tamperedIntegrity.errors.some((e: string) => /sha256|hash/i.test(e))).toBe(true);
    expect(fixture.accounts).toHaveLength(8); // nothing was deleted on the tampered path

    // ── Step 6, delete: unconfirmed attempts nothing ────────────────────────
    let deleteCalls = 0;
    const unconfirmedResult = await runDelete({
      manifest: finalManifest,
      deleteAccount: async () => {
        deleteCalls += 1;
        return { error: null };
      },
      confirm: false,
    });
    expect(deleteCalls).toBe(0);
    expect(unconfirmedResult.attempted).toBe(0);
    expect(fixture.accounts).toHaveLength(8);

    // ── Step 6, delete: confirmed removes exactly the manifest's four ids ──
    const confirmedResult = await runDelete({
      manifest: finalManifest,
      deleteAccount: async (id: string) => {
        fixture.accounts = fixture.accounts.filter((a) => a.id !== id);
        return { error: null };
      },
      confirm: true,
    });
    expect(confirmedResult.confirmed).toBe(true);
    expect(confirmedResult.attempted).toBe(4);
    expect(confirmedResult.succeeded).toBe(4);
    expect(confirmedResult.failed).toEqual([]);
    expect(fixture.accounts.map((a) => a.id).sort()).toEqual(
      ['lookalike-1', 'lookalike-2', 'real-athlete', 'test-coach-1'].sort()
    );

    // ── Step 7: residual reconciliation — the withheld coach is expected, not a surprise ──
    const residual = checkResidualMatches({ users: fixture.accounts, manifest: finalManifest, report });
    expect(residual.deleted_still_present).toEqual([]);
    expect(residual.expected_remaining).toEqual(['test-coach-1']);
    expect(residual.unexpected_matches).toEqual([]);
    expect(residual.ok).toBe(true);

    // ── Step 7: account conservation passes at the floor ────────────────────
    const conservation = checkAccountConservation({ users: fixture.accounts, manifest: finalManifest, report });
    expect(conservation.expected_floor).toBe(4); // 8 scanned - 4 deleted
    expect(conservation.actual).toBe(4);
    expect(conservation.ok).toBe(true);

    // Over-deletion case: remove one real account by hand and confirm the
    // conservation check is the one that catches it, with a shortfall of one.
    fixture.accounts = fixture.accounts.filter((a) => a.id !== 'lookalike-1');
    const overDeletionConservation = checkAccountConservation({
      users: fixture.accounts,
      manifest: finalManifest,
      report,
    });
    expect(overDeletionConservation.ok).toBe(false);
    expect(overDeletionConservation.shortfall).toBe(1);

    // ── Step 7: cross-table orphan scan — zero references to any deleted id ──
    const orphanRows = await fetchOrphanRows(client as never, finalManifest.candidate_ids);
    const orphans = summarizeOrphans(orphanRows);
    expect(orphanRows).toEqual([]);
    expect(orphans.total).toBe(0);
    expect(orphans.ok).toBe(true);
  });
});
