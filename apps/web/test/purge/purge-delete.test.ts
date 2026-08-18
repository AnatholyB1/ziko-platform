// Phase 02-03 — guarded Admin API deletion (task 1), extended with
// post-purge reconciliation proofs (task 2). Imports the .mjs modules by
// relative path across the workspace boundary into the root scripts folder,
// mirroring apps/web/test/purge/purge-export.test.ts (phase 02-02).
import { describe, expect, it, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parsePurgeArgs,
  assertManifestIntegrity,
  runDelete,
  writeDeleteLog,
} from '../../../../scripts/purge-test-accounts/delete.mjs';
import {
  checkResidualMatches,
  checkAccountConservation,
  fetchOrphanRows,
  summarizeOrphans,
  checkReportMatchesManifest,
} from '../../../../scripts/purge-test-accounts/verify-purge.mjs';
import { resolve } from 'node:path';

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

// WR-01: manifest_sha256 covers candidate_ids, generated_at, and pitr
// together — mirrors buildManifest's hash input in export.mjs exactly.
function manifestSha256({
  candidate_ids,
  generated_at,
  pitr,
}: {
  candidate_ids: string[];
  generated_at: unknown;
  pitr: unknown;
}): string {
  return createHash('sha256').update(JSON.stringify({ candidate_ids, generated_at, pitr })).digest('hex');
}

function makeManifest(overrides: Record<string, unknown> = {}) {
  const base = {
    generated_at: '2026-08-13T12:00:00.000Z',
    source_report: '/tmp/report.json',
    export_csv: '/tmp/export.csv',
    candidate_ids: ['a', 'b', 'c'],
    counts: { accounts: 3, profiles: 0, waitlist_rows: 0 },
    pitr: { status: 'enabled', checked_at: '2026-08-13T12:00:00.000Z', detail: 'Management API reported pitr_enabled=true' },
  };
  const merged: Record<string, unknown> = { ...base, ...overrides };
  // Auto-recompute manifest_sha256 from the merged fields unless the test
  // explicitly overrides it (e.g. to simulate a tampered/mismatched hash) —
  // this keeps every non-hash-focused test's manifest internally consistent
  // without each call site having to compute the hash by hand.
  if (!('manifest_sha256' in overrides)) {
    merged.manifest_sha256 = manifestSha256(
      merged as { candidate_ids: string[]; generated_at: unknown; pitr: unknown }
    );
  }
  return merged;
}

const NOW = new Date('2026-08-13T12:30:00.000Z'); // 30 minutes after generated_at
const alwaysExists = () => true;

describe('parsePurgeArgs', () => {
  it('parses --manifest, --confirm and --accept-unknown-pitr', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--confirm', '--accept-unknown-pitr']);
    expect(args.manifestPath).toBe('/tmp/m.json');
    expect(args.confirm).toBe(true);
    expect(args.acceptUnknownPitr).toBe(true);
  });

  it('defaults confirm and acceptUnknownPitr to false when the flags are absent', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json']);
    expect(args.confirm).toBe(false);
    expect(args.acceptUnknownPitr).toBe(false);
  });

  it('defaults --max-manifest-age-minutes to 60', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json']);
    expect(args.maxManifestAgeMinutes).toBe(60);
  });

  it('reads an explicit --max-manifest-age-minutes value', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--max-manifest-age-minutes', '15']);
    expect(args.maxManifestAgeMinutes).toBe(15);
  });

  // WR-03: parsePurgeArgs itself does no validation — Number('typo') is NaN
  // — so this documents the coupling to assertManifestIntegrity's NaN guard
  // below, which is what actually catches a malformed value.
  it('produces NaN for a non-numeric --max-manifest-age-minutes value', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--max-manifest-age-minutes', 'sixty']);
    expect(Number.isNaN(args.maxManifestAgeMinutes)).toBe(true);
  });

  it('reads an explicit --out directory', () => {
    const args = parsePurgeArgs(['--manifest', '/tmp/m.json', '--out', '/tmp/custom-out']);
    expect(args.outDir).toBe('/tmp/custom-out');
  });

  it('leaves manifestPath null when --manifest is absent', () => {
    const args = parsePurgeArgs([]);
    expect(args.manifestPath).toBeNull();
  });
});

describe('assertManifestIntegrity', () => {
  it('accepts a fresh, hash-matching, PITR-enabled manifest', () => {
    const manifest = makeManifest();
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a manifest whose PITR status is disabled', () => {
    const manifest = makeManifest({ pitr: { status: 'disabled', checked_at: 't', detail: 'off' } });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a manifest whose recorded hash disagrees with the recomputed hash', () => {
    const manifest = makeManifest({ manifest_sha256: 'deadbeef' });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /sha256|hash/i.test(e))).toBe(true);
  });

  it('rejects (rather than silently passing) a non-numeric maxAgeMinutes instead of letting NaN comparisons default to false', () => {
    const manifest = makeManifest();
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: Number('not-a-number'),
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /max-manifest-age-minutes|not a valid number/i.test(e))).toBe(true);
  });

  it('rejects a manifest generated 120 minutes ago against a 60-minute limit', () => {
    const manifest = makeManifest({ generated_at: '2026-08-13T10:30:00.000Z' }); // 120 min before NOW
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /minute/i.test(e))).toBe(true);
  });

  it('rejects a manifest whose exported CSV is missing from disk', () => {
    const manifest = makeManifest();
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: () => false,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /export_csv|csv/i.test(e))).toBe(true);
  });

  it('rejects a manifest with an empty id list', () => {
    const manifest = makeManifest({ candidate_ids: [] });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /empty/i.test(e))).toBe(true);
  });

  it('rejects a manifest whose PITR status is unknown, without the acknowledgement flag', () => {
    const manifest = makeManifest({ pitr: { status: 'unknown', checked_at: 't', detail: 'no token' } });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /pitr/i.test(e))).toBe(true);
  });

  it('accepts that same unknown-PITR manifest when the acknowledgement flag is set', () => {
    const manifest = makeManifest({ pitr: { status: 'unknown', checked_at: 't', detail: 'no token' } });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: true,
      fileExists: alwaysExists,
    });
    expect(result.ok).toBe(true);
  });

  it('accumulates every failing check rather than stopping at the first', () => {
    const manifest = makeManifest({
      candidate_ids: [],
      manifest_sha256: 'deadbeef',
      generated_at: '2026-08-13T10:30:00.000Z',
      pitr: { status: 'unknown', checked_at: 't', detail: 'no token' },
    });
    const result = assertManifestIntegrity({
      manifest,
      now: NOW,
      maxAgeMinutes: 60,
      acceptUnknownPitr: false,
      fileExists: () => false,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('runDelete', () => {
  it('is inert without confirm: the deletion fake is never called and nothing is attempted', async () => {
    const manifest = makeManifest();
    let calls = 0;
    const result = await runDelete({
      manifest,
      deleteAccount: async () => {
        calls += 1;
        return { error: null };
      },
      confirm: false,
    });
    expect(calls).toBe(0);
    expect(result.confirmed).toBe(false);
    expect(result.attempted).toBe(0);
    expect(result.planned).toEqual(['a', 'b', 'c']);
  });

  it('calls the deletion fake exactly once per manifest id, in manifest order, with confirm true', async () => {
    const manifest = makeManifest();
    const seen: string[] = [];
    const result = await runDelete({
      manifest,
      deleteAccount: async (id: string) => {
        seen.push(id);
        return { error: null };
      },
      confirm: true,
    });
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toEqual([]);
  });

  it('never passes an id present in a live database but absent from the manifest', async () => {
    const manifest = makeManifest(); // candidate_ids: a, b, c
    const liveDatabaseIds = ['a', 'b', 'c', 'z']; // z is a real account, not in the manifest
    const seen: string[] = [];
    await runDelete({
      manifest,
      deleteAccount: async (id: string) => {
        seen.push(id);
        return { error: null };
      },
      confirm: true,
    });
    expect(seen).not.toContain('z');
    expect(liveDatabaseIds).toContain('z'); // sanity: z really was live-only
  });

  it('continues past a mid-run failure, names it, and reports overall failure', async () => {
    const manifest = makeManifest();
    const seen: string[] = [];
    const result = await runDelete({
      manifest,
      deleteAccount: async (id: string) => {
        seen.push(id);
        if (id === 'b') return { error: { message: 'Admin API: user not found' } };
        return { error: null };
      },
      confirm: true,
    });
    expect(seen).toEqual(['a', 'b', 'c']); // c still attempted after b's failure
    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe('b');
    expect(result.failed[0].error).toMatch(/not found/);
  });
});

describe('writeDeleteLog', () => {
  it('writes a delete-log JSON file naming every id with its outcome', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'purge-delete-'));
    tmpDirs.push(dir);

    const result = {
      confirmed: true,
      attempted: 2,
      succeeded: 1,
      failed: [{ id: 'b', error: 'boom' }],
      results: [
        { id: 'a', ok: true, error: null },
        { id: 'b', ok: false, error: 'boom' },
      ],
      manifest_path: '/tmp/m.json',
      manifest_hash: 'abc123',
    };

    const logPath = await writeDeleteLog(result, dir);
    expect(logPath).toMatch(/delete-log-.*\.json$/);

    const written = JSON.parse(readFileSync(logPath, 'utf8'));
    expect(written.results).toHaveLength(2);
    expect(written.results.map((r: { id: string }) => r.id)).toEqual(['a', 'b']);
    expect(written.manifest_hash).toBe('abc123');
  });
});

// ── Task 2: residual reconciliation and cross-table orphan scan ──────────

function makeVerifyManifest(overrides: Record<string, unknown> = {}) {
  return {
    candidate_ids: ['x', 'y'],
    ...overrides,
  };
}

function makeVerifyReport(overrides: Record<string, unknown> = {}) {
  return {
    totals: { users_scanned: 5 },
    flagged: [],
    ...overrides,
  };
}

describe('checkResidualMatches', () => {
  it('reports deleted_still_present as empty when the manifest ids are all gone', () => {
    const result = checkResidualMatches({
      users: [{ id: 'real1', email: 'real@gmail.com' }],
      manifest: makeVerifyManifest(),
      report: makeVerifyReport(),
    });
    expect(result.deleted_still_present).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reports a manifest id still present in the database and fails overall', () => {
    const result = checkResidualMatches({
      users: [{ id: 'x', email: 'qa1@ziko-app.com' }],
      manifest: makeVerifyManifest(),
      report: makeVerifyReport(),
    });
    expect(result.deleted_still_present).toEqual(['x']);
    expect(result.ok).toBe(false);
  });

  it('reports a criterion-matching survivor named in report.flagged as expected_remaining, and does not fail', () => {
    const result = checkResidualMatches({
      users: [{ id: 'z', email: 'coach@ziko-app.com' }],
      manifest: makeVerifyManifest(),
      report: makeVerifyReport({ flagged: [{ candidate_id: 'z' }] }),
    });
    expect(result.expected_remaining).toEqual(['z']);
    expect(result.unexpected_matches).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reports a criterion-matching survivor in neither the manifest nor flagged as unexpected_matches, and fails', () => {
    const result = checkResidualMatches({
      users: [{ id: 'z', email: 'qa@ziko-app.com' }],
      manifest: makeVerifyManifest(),
      report: makeVerifyReport({ flagged: [] }),
    });
    expect(result.unexpected_matches).toEqual(['z']);
    expect(result.ok).toBe(false);
  });

  it('ignores a surviving account that does not match the criterion at all', () => {
    const result = checkResidualMatches({
      users: [{ id: 'real1', email: 'real@gmail.com' }],
      manifest: makeVerifyManifest(),
      report: makeVerifyReport(),
    });
    expect(result.expected_remaining).toEqual([]);
    expect(result.unexpected_matches).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('checkAccountConservation', () => {
  it('passes when the surviving count equals the scanned count minus the manifest size', () => {
    const result = checkAccountConservation({
      users: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      manifest: { candidate_ids: ['x', 'y'] },
      report: { totals: { users_scanned: 5 } },
    });
    expect(result.ok).toBe(true);
    expect(result.expected_floor).toBe(3);
    expect(result.actual).toBe(3);
  });

  it('still passes when the surviving count is higher — post-dry-run signups only add', () => {
    const result = checkAccountConservation({
      users: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      manifest: { candidate_ids: ['x', 'y'] },
      report: { totals: { users_scanned: 5 } },
    });
    expect(result.ok).toBe(true);
  });

  it('fails when the surviving count is even one lower than the floor, reporting the shortfall', () => {
    const result = checkAccountConservation({
      users: [{ id: 'a' }],
      manifest: { candidate_ids: ['x', 'y'] },
      report: { totals: { users_scanned: 5 } },
    });
    expect(result.ok).toBe(false);
    expect(result.expected_floor).toBe(3);
    expect(result.shortfall).toBe(2);
  });
});

// A hand-rolled fake exposing only from(table).select(cols).in(col, ids)
// resolving { data, error } — mirrors apps/web/test/purge/purge-lib.test.ts's
// makeFakeClient. `tables` maps a table name to its fixture rows; passing
// `errorOn` makes exactly one table.column combination fail.
function makeOrphanFakeClient(
  tables: Record<string, Array<Record<string, unknown>>>,
  errorOn?: { table: string; column: string }
) {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            in(col: string, ids: string[]) {
              if (errorOn && errorOn.table === table && errorOn.column === col) {
                return Promise.resolve({ data: null, error: { message: 'connection reset' } });
              }
              const rows = (tables[table] ?? []).filter((r) => ids.includes(r[col] as string));
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  };
}

describe('fetchOrphanRows', () => {
  it('reports a hit per matching row across the documented tables and columns', async () => {
    const tables = {
      user_profiles: [{ id: 'u1' }],
      coach_client_links: [{ coach_id: 'u1', client_id: 'real1' }],
      coach_vocal_feedbacks: [],
      workout_programs: [{ user_id: 'u1' }],
    };
    const client = makeOrphanFakeClient(tables);
    const hits = await fetchOrphanRows(client as never, ['u1']);
    expect(hits.some((h: { table: string; column: string }) => h.table === 'user_profiles' && h.column === 'id')).toBe(
      true
    );
    expect(
      hits.some((h: { table: string; column: string }) => h.table === 'coach_client_links' && h.column === 'coach_id')
    ).toBe(true);
    expect(
      hits.some((h: { table: string; column: string }) => h.table === 'workout_programs' && h.column === 'user_id')
    ).toBe(true);
  });

  // CR-01: ORPHAN_SOURCES was expanded from 4 tables (8 columns) to 19
  // tables (38 columns) to mirror lib.mjs's expanded CROSS_LINK_SOURCES.
  // These cases pin a representative sample of the new columns.
  it('reports a hit for a lingering reference in friendships.addressee_id (community schema)', async () => {
    const client = makeOrphanFakeClient({
      friendships: [{ requester_id: 'real1', addressee_id: 'u1' }],
    });
    const hits = await fetchOrphanRows(client as never, ['u1']);
    expect(
      hits.some((h: { table: string; column: string }) => h.table === 'friendships' && h.column === 'addressee_id')
    ).toBe(true);
  });

  it('reports a hit for a lingering reference in coach_metric_thresholds.client_id (coach-CRM schema)', async () => {
    const client = makeOrphanFakeClient({
      coach_metric_thresholds: [{ coach_id: 'real1', client_id: 'u1' }],
    });
    const hits = await fetchOrphanRows(client as never, ['u1']);
    expect(
      hits.some(
        (h: { table: string; column: string }) =>
          h.table === 'coach_metric_thresholds' && h.column === 'client_id'
      )
    ).toBe(true);
  });

  it('reports a hit for a lingering reference in coach_invitations.used_by (verified against migrations, not in the original review list)', async () => {
    const client = makeOrphanFakeClient({
      coach_invitations: [{ coach_id: 'real1', used_by: 'u1' }],
    });
    const hits = await fetchOrphanRows(client as never, ['u1']);
    expect(
      hits.some(
        (h: { table: string; column: string }) => h.table === 'coach_invitations' && h.column === 'used_by'
      )
    ).toBe(true);
  });

  it('returns an empty array without querying when deletedIds is empty', async () => {
    let queried = false;
    const client = {
      from() {
        queried = true;
        return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
      },
    };
    const hits = await fetchOrphanRows(client as never, []);
    expect(hits).toEqual([]);
    expect(queried).toBe(false);
  });

  it('throws, naming the table and column, on a query error rather than returning an empty result', async () => {
    const client = makeOrphanFakeClient({}, { table: 'coach_vocal_feedbacks', column: 'athlete_id' });
    await expect(fetchOrphanRows(client as never, ['u1'])).rejects.toThrow(/coach_vocal_feedbacks/);
    await expect(fetchOrphanRows(client as never, ['u1'])).rejects.toThrow(/athlete_id/);
  });
});

describe('summarizeOrphans', () => {
  it('returns a per-table breakdown and total for rows from three tables', () => {
    const rows = [
      { table: 'user_profiles', column: 'id', id: 'u1' },
      { table: 'coach_client_links', column: 'coach_id', id: 'u1' },
      { table: 'workout_programs', column: 'user_id', id: 'u1' },
    ];
    const result = summarizeOrphans(rows);
    expect(result.total).toBe(3);
    expect(result.byTable['user_profiles.id']).toBe(1);
    expect(result.byTable['coach_client_links.coach_id']).toBe(1);
    expect(result.byTable['workout_programs.user_id']).toBe(1);
  });

  it('reports success only when the total is zero', () => {
    expect(summarizeOrphans([]).ok).toBe(true);
    expect(
      summarizeOrphans([{ table: 'user_profiles', column: 'id', id: 'u1' }]).ok
    ).toBe(false);
  });

  it('fails and names the table when a single orphan row exists in any one of the four tables', () => {
    const result = summarizeOrphans([{ table: 'coach_vocal_feedbacks', column: 'athlete_id', id: 'u1' }]);
    expect(result.ok).toBe(false);
    expect(result.byTable['coach_vocal_feedbacks.athlete_id']).toBe(1);
  });
});

// WR-04: verify-purge.mjs never cross-checked --report against
// manifest.source_report, so an operator pointing --report at the wrong
// dry-run report would reconcile against a mismatched baseline silently.
describe('checkReportMatchesManifest', () => {
  it('passes when manifest.source_report resolves to the same path as --report', () => {
    const result = checkReportMatchesManifest({
      manifestSourceReport: '/tmp/dry-run-2026.json',
      reportPath: '/tmp/dry-run-2026.json',
    });
    expect(result.ok).toBe(true);
  });

  it('passes when the two paths are equivalent once both are resolved (relative vs. absolute spelling)', () => {
    // manifest.source_report is always stored absolute (buildManifest calls
    // resolve() on it), but --report may be passed relative to the cwd the
    // operator happens to be in — both must resolve to the same location.
    const absoluteManifestPath = resolve(process.cwd(), 'dry-run-2026.json');
    const result = checkReportMatchesManifest({
      manifestSourceReport: absoluteManifestPath,
      reportPath: 'dry-run-2026.json',
    });
    expect(result.ok).toBe(true);
  });

  it('fails when --report points at a different file than manifest.source_report', () => {
    const result = checkReportMatchesManifest({
      manifestSourceReport: '/tmp/dry-run-2026-08-13.json',
      reportPath: '/tmp/dry-run-2026-08-01-STALE.json',
    });
    expect(result.ok).toBe(false);
    expect(result.manifestSourceReport).toBe(resolve('/tmp/dry-run-2026-08-13.json'));
    expect(result.resolvedReportPath).toBe(resolve('/tmp/dry-run-2026-08-01-STALE.json'));
  });

  it('fails when manifest.source_report is missing entirely', () => {
    const result = checkReportMatchesManifest({
      manifestSourceReport: undefined,
      reportPath: '/tmp/dry-run-2026.json',
    });
    expect(result.ok).toBe(false);
  });
});
