// Phase 02-01 — end-to-end dry-run proof plus criterion-hardening and
// cross-link-exclusion proofs. Imports the .mjs module by relative path
// across the workspace boundary into the root scripts folder.
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  TEST_ACCOUNT_DOMAIN,
  isTestAccountEmail,
  listAllUsers,
  fetchCrossLinks,
  classifyAccounts,
  runDryRun,
  writeReport,
} from '../../../../scripts/purge-test-accounts/lib.mjs';

// A hand-rolled fake exposing only from(table).select(cols).in(col, ids)
// resolving { data, error } — no chainable Supabase mock. `tables` maps a
// table name to its fixture rows; `calls` records every .in() invocation so
// batching behavior can be asserted.
function makeFakeClient(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ table: string; col: string; ids: string[] }> = [];
  return {
    calls,
    client: {
      from(table: string) {
        return {
          select(_cols: string) {
            return {
              in(col: string, ids: string[]) {
                calls.push({ table, col, ids });
                const rows = (tables[table] ?? []).filter((r) => ids.includes(r[col] as string));
                return Promise.resolve({ data: rows, error: null });
              },
            };
          },
        };
      },
    },
  };
}

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('TEST_ACCOUNT_DOMAIN', () => {
  it('is the locked ziko-app.com domain (D-01)', () => {
    expect(TEST_ACCOUNT_DOMAIN).toBe('ziko-app.com');
  });
});

// D-01's executable form — the criterion's blast radius is the highest
// severity thing in this phase, so its behavior is pinned in one screen
// rather than scattered across individual `it` blocks. Covers, at minimum:
// plain match, uppercase, whitespace padding, plus-suffixed local part,
// lookalike prefix domain, subdomain, test domain as a longer-domain prefix,
// truncated TLD, empty local part, two at-signs (final domain wins), empty
// string, null, undefined, and a real consumer domain.
describe('isTestAccountEmail — criterion table (D-01)', () => {
  const cases: Array<[string | null | undefined, boolean, string]> = [
    ['qa@ziko-app.com', true, 'plain match'],
    ['QA@ZIKO-APP.COM', true, 'uppercase match'],
    ['  qa@ziko-app.com  ', true, 'whitespace-padded match'],
    ['qa+e2e@ziko-app.com', true, 'plus-suffixed local part at test domain'],
    ['a@notziko-app.com', false, 'lookalike prefix domain'],
    ['a@sub.ziko-app.com', false, 'subdomain of the test domain'],
    ['a@ziko-app.com.attacker.tld', false, 'test domain as prefix of a longer attacker-owned domain'],
    ['a@ziko-app.co', false, 'truncated top-level domain'],
    ['@ziko-app.com', false, 'empty local part'],
    ['a@b@ziko-app.com', true, 'two at-signs — the final domain is the test domain'],
    ['', false, 'empty string'],
    [null, false, 'null'],
    [undefined, false, 'undefined'],
    ['athlete@gmail.com', false, 'real consumer domain'],
  ];

  it.each(cases)('%s → %s (%s)', (input, expected) => {
    expect(isTestAccountEmail(input)).toBe(expected);
  });
});

describe('listAllUsers — pagination', () => {
  it('keeps requesting pages until a page returns fewer than perPage rows', async () => {
    // The module's perPage is fixed at 1000 — a full page-1 of exactly 1000
    // rows plus a short page-2 exercises the real looping condition.
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `p1-${i}`,
      email: `u${i}@ziko-app.com`,
      created_at: '2026-01-01T00:00:00Z',
      last_sign_in_at: null,
    }));
    const page2 = [
      {
        id: 'p2-0',
        email: 'v0@gmail.com',
        created_at: '2026-01-01T00:00:00Z',
        last_sign_in_at: null,
      },
    ];

    let call = 0;
    const fakeClient = {
      auth: {
        admin: {
          listUsers: async ({ page }: { page: number; perPage: number }) => {
            call += 1;
            const users = page === 1 ? page1 : page === 2 ? page2 : [];
            return { data: { users }, error: null };
          },
        },
      },
    };

    const users = await listAllUsers(fakeClient as never);
    expect(call).toBe(2);
    expect(users).toHaveLength(1001);
    expect(users[0]).toMatchObject({ id: 'p1-0', email: 'u0@ziko-app.com' });
    expect(users[1000]).toMatchObject({ id: 'p2-0', email: 'v0@gmail.com' });
  });

  it('surfaces an Admin API error by throwing rather than returning a short list', async () => {
    const fakeClient = {
      auth: {
        admin: {
          listUsers: async () => ({ data: null, error: { message: 'boom' } }),
        },
      },
    };

    await expect(listAllUsers(fakeClient as never)).rejects.toThrow(/page 1/);
  });
});

describe('classifyAccounts', () => {
  const users = [
    { id: 'u1', email: 'qa@ziko-app.com', created_at: 't', last_sign_in_at: null },
    { id: 'u2', email: 'real@gmail.com', created_at: 't', last_sign_in_at: null },
    { id: 'u3', email: 'other@gmail.com', created_at: 't', last_sign_in_at: null },
  ];

  it('returns exactly one candidate when one user matches the domain', () => {
    const { candidates } = classifyAccounts({ users, crossLinks: [] });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe('u1');
  });

  it('places the matching candidate in toDelete when no cross-link names it', () => {
    const { toDelete } = classifyAccounts({ users, crossLinks: [] });
    expect(toDelete.map((c) => c.id)).toEqual(['u1']);
  });

  it('flags a candidate cross-linked to a non-candidate and excludes it from toDelete', () => {
    const crossLinks = [
      {
        table: 'coach_client_links',
        candidateColumn: 'coach_id',
        candidateId: 'u1',
        linkedColumn: 'client_id',
        linkedUserId: 'u2',
      },
    ];
    const { flagged, toDelete } = classifyAccounts({ users, crossLinks });
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({
      candidate_id: 'u1',
      linked_user_id: 'u2',
      table: 'coach_client_links',
    });
    expect(toDelete.map((c) => c.id)).not.toContain('u1');
  });
});

describe('runDryRun + writeReport — end to end', () => {
  it('writes a JSON report whose to_delete matches expectations and totals agree with array lengths', async () => {
    const users = [
      { id: 'u1', email: 'qa@ziko-app.com', created_at: 't1', last_sign_in_at: null },
      { id: 'u2', email: 'real@gmail.com', created_at: 't2', last_sign_in_at: null },
    ];

    const report = await runDryRun({
      listUsers: async () => users,
      fetchCrossLinks: async () => [],
      now: () => new Date('2026-08-13T12:00:00.000Z'),
    });

    const dir = mkdtempSync(join(tmpdir(), 'purge-'));
    tmpDirs.push(dir);

    const { jsonPath } = await writeReport(report, dir);
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));

    expect(parsed.to_delete).toHaveLength(1);
    expect(parsed.to_delete[0].id).toBe('u1');
    expect(parsed.totals.users_scanned).toBe(users.length);
    expect(parsed.totals.candidates).toBe(parsed.candidates.length);
    expect(parsed.totals.flagged_cross_linked).toBe(parsed.flagged.length);
    expect(parsed.totals.to_delete).toBe(parsed.to_delete.length);
    expect(parsed.criterion.decision).toBe('D-01');
  });

  it('also writes a to_delete CSV whose header is id,email,created_at and whose row count equals to_delete.length', async () => {
    const users = [
      { id: 'u1', email: 'qa@ziko-app.com', created_at: 't1', last_sign_in_at: null },
      { id: 'u2', email: 'qa2@ziko-app.com', created_at: 't2', last_sign_in_at: null },
      { id: 'u3', email: 'real@gmail.com', created_at: 't3', last_sign_in_at: null },
    ];

    const report = await runDryRun({
      listUsers: async () => users,
      fetchCrossLinks: async () => [],
      now: () => new Date('2026-08-13T12:05:00.000Z'),
    });

    const dir = mkdtempSync(join(tmpdir(), 'purge-'));
    tmpDirs.push(dir);

    const { csvPath } = await writeReport(report, dir);
    expect(csvPath).toBeTruthy();

    const csv = readFileSync(csvPath as string, 'utf8').trim();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,email,created_at');
    expect(lines).toHaveLength(1 + report.to_delete.length);
  });

  // WR-02: the to_delete CSV is the artifact a second reviewer opens in
  // Excel/Sheets under the two-person rule — a formula-trigger leading
  // character in the email column must never reach the file unescaped.
  it('neutralizes a formula-injection-triggering leading character in the email column', async () => {
    const users = [{ id: 'u1', email: '=cmd|"/c calc"!A1@ziko-app.com', created_at: 't1', last_sign_in_at: null }];

    const report = await runDryRun({
      listUsers: async () => users,
      fetchCrossLinks: async () => [],
      now: () => new Date('2026-08-13T12:06:00.000Z'),
    });

    const dir = mkdtempSync(join(tmpdir(), 'purge-'));
    tmpDirs.push(dir);

    const { csvPath } = await writeReport(report, dir);
    const csv = readFileSync(csvPath as string, 'utf8').trim();
    const lines = csv.split('\n');
    // The email is quoted (it contains embedded quotes) and the quoted
    // content must start with the neutralizing apostrophe, not the raw '='.
    expect(lines[1]).toMatch(/^u1,"'=cmd/);
  });

  // WR-05: a lone \r (old-style Mac line ending, unaccompanied by \n) must
  // also trigger quoting — a naive comma/quote/\n-only check would let it
  // through unquoted and a spreadsheet app could read it as a row break.
  it('quotes an email field containing a bare carriage return', async () => {
    const users = [{ id: 'u1', email: 'a\rb@ziko-app.com', created_at: 't1', last_sign_in_at: null }];

    const report = await runDryRun({
      listUsers: async () => users,
      fetchCrossLinks: async () => [],
      now: () => new Date('2026-08-13T12:07:00.000Z'),
    });

    const dir = mkdtempSync(join(tmpdir(), 'purge-'));
    tmpDirs.push(dir);

    const { csvPath } = await writeReport(report, dir);
    const csv = readFileSync(csvPath as string, 'utf8');
    // Confirm the field is wrapped in quotes rather than left bare — a raw
    // split on '\n' would otherwise misparse the row.
    expect(csv).toContain('"a\rb@ziko-app.com"');
  });
});

describe('classifyAccounts — multi-link aggregation', () => {
  it('produces no flag when two candidates are linked only to each other', () => {
    const users = [
      { id: 'u1', email: 'qa1@ziko-app.com', created_at: 't', last_sign_in_at: null },
      { id: 'u2', email: 'qa2@ziko-app.com', created_at: 't', last_sign_in_at: null },
    ];
    const crossLinks = [
      {
        table: 'coach_client_links',
        candidateColumn: 'coach_id',
        candidateId: 'u1',
        linkedColumn: 'client_id',
        linkedUserId: 'u2',
      },
    ];
    const { flagged, toDelete } = classifyAccounts({ users, crossLinks });
    expect(flagged).toHaveLength(0);
    expect(toDelete.map((c) => c.id).sort()).toEqual(['u1', 'u2']);
  });

  it('flags a candidate cross-linked through two different tables once per link, and drops it from toDelete', () => {
    const users = [
      { id: 'u1', email: 'qa@ziko-app.com', created_at: 't', last_sign_in_at: null },
      { id: 'u2', email: 'real1@gmail.com', created_at: 't', last_sign_in_at: null },
      { id: 'u3', email: 'real2@gmail.com', created_at: 't', last_sign_in_at: null },
    ];
    const crossLinks = [
      {
        table: 'coach_client_links',
        candidateColumn: 'coach_id',
        candidateId: 'u1',
        linkedColumn: 'client_id',
        linkedUserId: 'u2',
      },
      {
        table: 'coach_vocal_feedbacks',
        candidateColumn: 'coach_id',
        candidateId: 'u1',
        linkedColumn: 'athlete_id',
        linkedUserId: 'u3',
      },
    ];
    const { flagged, toDelete } = classifyAccounts({ users, crossLinks });
    expect(flagged).toHaveLength(2);
    expect(flagged.filter((f) => f.candidate_id === 'u1')).toHaveLength(2);
    expect(toDelete.filter((c) => c.id === 'u1')).toHaveLength(0);
  });
});

describe('fetchCrossLinks — full cross-link surface (D-05)', () => {
  it('flags a candidate as coach_id in coach_vocal_feedbacks opposite a non-candidate athlete_id', async () => {
    const { client } = makeFakeClient({
      coach_vocal_feedbacks: [{ coach_id: 'cand-1', athlete_id: 'real-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'coach_vocal_feedbacks',
      candidateColumn: 'coach_id',
      candidateId: 'cand-1',
      linkedColumn: 'athlete_id',
      linkedUserId: 'real-1',
    });
  });

  it('flags a candidate as athlete_id opposite a non-candidate coach_id — symmetric on both columns', async () => {
    const { client } = makeFakeClient({
      coach_vocal_feedbacks: [{ coach_id: 'real-1', athlete_id: 'cand-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'coach_vocal_feedbacks',
      candidateColumn: 'athlete_id',
      candidateId: 'cand-1',
      linkedColumn: 'coach_id',
      linkedUserId: 'real-1',
    });
  });

  it('flags a candidate as created_by_coach_id on a workout_programs row assigned to a non-candidate', async () => {
    const { client } = makeFakeClient({
      workout_programs: [{ created_by_coach_id: 'cand-1', assigned_to_user_id: 'real-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'workout_programs',
      candidateColumn: 'created_by_coach_id',
      candidateId: 'cand-1',
      linkedColumn: 'assigned_to_user_id',
      linkedUserId: 'real-1',
    });
  });

  it('produces no cross-link for a workout_programs row whose assigned_to_user_id is null', async () => {
    const { client } = makeFakeClient({
      workout_programs: [{ created_by_coach_id: 'cand-1', assigned_to_user_id: null }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toHaveLength(0);
  });

  it('still detects coach_client_links (task 1 source preserved)', async () => {
    const { client } = makeFakeClient({
      coach_client_links: [{ coach_id: 'cand-1', client_id: 'real-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'coach_client_links',
      candidateColumn: 'coach_id',
      candidateId: 'cand-1',
      linkedColumn: 'client_id',
      linkedUserId: 'real-1',
    });
  });

  it('references all three original cross-link tables in a single pass', async () => {
    const { client } = makeFakeClient({
      coach_client_links: [{ coach_id: 'cand-1', client_id: 'real-1' }],
      coach_vocal_feedbacks: [{ coach_id: 'cand-2', athlete_id: 'real-2' }],
      workout_programs: [{ created_by_coach_id: 'cand-3', assigned_to_user_id: 'real-3' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1', 'cand-2', 'cand-3']);
    const tables = new Set(links.map((l) => l.table));
    expect(tables).toEqual(
      new Set(['coach_client_links', 'coach_vocal_feedbacks', 'workout_programs'])
    );
  });

  // CR-01: the review found only 3 of at least 17 two-auth.users-FK tables
  // were checked. These cases pin the expanded surface — one representative
  // from each schema family the review's gap spanned (community/social,
  // coach-CRM, and coach_invitations, a table the review itself missed but
  // which has the identical coach_id/used_by shape as coach_client_links).
  it('flags a candidate linked through friendships (community schema)', async () => {
    const { client } = makeFakeClient({
      friendships: [{ requester_id: 'cand-1', addressee_id: 'real-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'friendships',
      candidateColumn: 'requester_id',
      candidateId: 'cand-1',
      linkedColumn: 'addressee_id',
      linkedUserId: 'real-1',
    });
  });

  it('flags a candidate linked through coach_metric_thresholds (coach-CRM schema)', async () => {
    const { client } = makeFakeClient({
      coach_metric_thresholds: [{ coach_id: 'cand-1', client_id: 'real-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'coach_metric_thresholds',
      candidateColumn: 'coach_id',
      candidateId: 'cand-1',
      linkedColumn: 'client_id',
      linkedUserId: 'real-1',
    });
  });

  it('flags a candidate linked through coach_invitations.used_by (verified against migrations, not in the original review list)', async () => {
    const { client } = makeFakeClient({
      coach_invitations: [{ coach_id: 'real-1', used_by: 'cand-1' }],
    });
    const links = await fetchCrossLinks(client as never, ['cand-1']);
    expect(links).toContainEqual({
      table: 'coach_invitations',
      candidateColumn: 'used_by',
      candidateId: 'cand-1',
      linkedColumn: 'coach_id',
      linkedUserId: 'real-1',
    });
  });

  it('references all 18 declared cross-link tables across a full candidate set', async () => {
    const declaredTables = [
      'coach_client_links',
      'coach_vocal_feedbacks',
      'workout_programs',
      'coach_invitations',
      'friendships',
      'app_invites',
      'screen_reactions',
      'shared_programs',
      'xp_gifts',
      'coin_gifts',
      'habit_encouragements',
      'coach_client_tags',
      'coach_client_notes',
      'coach_alerts',
      'ai_tool_audit',
      'dashboard_configs',
      'coach_client_videos',
      'coach_metric_thresholds',
    ];
    const columnPairs: Record<string, [string, string]> = {
      coach_client_links: ['coach_id', 'client_id'],
      coach_vocal_feedbacks: ['coach_id', 'athlete_id'],
      workout_programs: ['created_by_coach_id', 'assigned_to_user_id'],
      coach_invitations: ['coach_id', 'used_by'],
      friendships: ['requester_id', 'addressee_id'],
      app_invites: ['inviter_id', 'used_by'],
      screen_reactions: ['sender_id', 'receiver_id'],
      shared_programs: ['sender_id', 'receiver_id'],
      xp_gifts: ['sender_id', 'receiver_id'],
      coin_gifts: ['sender_id', 'receiver_id'],
      habit_encouragements: ['sender_id', 'receiver_id'],
      coach_client_tags: ['coach_id', 'client_id'],
      coach_client_notes: ['coach_id', 'client_id'],
      coach_alerts: ['coach_id', 'client_id'],
      ai_tool_audit: ['coach_id', 'target_client_id'],
      dashboard_configs: ['coach_id', 'client_id'],
      coach_client_videos: ['athlete_id', 'coach_id'],
      coach_metric_thresholds: ['coach_id', 'client_id'],
    };
    const tables: Record<string, Array<Record<string, unknown>>> = {};
    const candidateIds: string[] = [];
    declaredTables.forEach((table, i) => {
      const [colA, colB] = columnPairs[table];
      const candId = `cand-${i}`;
      const realId = `real-${i}`;
      tables[table] = [{ [colA]: candId, [colB]: realId }];
      candidateIds.push(candId);
    });
    const { client } = makeFakeClient(tables);
    const links = await fetchCrossLinks(client as never, candidateIds);
    const seenTables = new Set(links.map((l) => l.table));
    expect(seenTables).toEqual(new Set(declaredTables));
    expect(seenTables.size).toBe(18);
  });

  it('surfaces a query error by throwing, naming the table and column', async () => {
    const client = {
      from(_table: string) {
        return {
          select() {
            return {
              in(_col: string) {
                return Promise.resolve({
                  data: null,
                  error: { message: 'boom' },
                });
              },
            };
          },
        };
      },
    };
    await expect(fetchCrossLinks(client as never, ['cand-1'])).rejects.toThrow(
      /coach_client_links/
    );
  });

  it('returns an empty array without issuing a query when candidateIds is empty', async () => {
    const { client, calls } = makeFakeClient({});
    const links = await fetchCrossLinks(client as never, []);
    expect(links).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('chunks candidateIds into batches of 200 per .in() call', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `cand-${i}`);
    const { client, calls } = makeFakeClient({});
    await fetchCrossLinks(client as never, ids);
    const batchSizes = calls.map((c) => c.ids.length);
    for (const size of batchSizes) {
      expect(size).toBeLessThanOrEqual(200);
    }
    // 450 ids -> 3 batches (200, 200, 50) per column-query, and there are 18
    // tables x 2 columns = 36 column-queries per batch (CR-01 expanded the
    // declared table count from 3 to 18).
    expect(calls.length).toBe(3 * 36);
  });
});
