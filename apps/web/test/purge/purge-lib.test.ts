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
  classifyAccounts,
  runDryRun,
  writeReport,
} from '../../../../scripts/purge-test-accounts/lib.mjs';

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

describe('isTestAccountEmail — plain matches', () => {
  it('matches the exact test domain', () => {
    expect(isTestAccountEmail('qa@ziko-app.com')).toBe(true);
  });

  it('matches regardless of case', () => {
    expect(isTestAccountEmail('QA@ZIKO-APP.COM')).toBe(true);
  });

  it('matches with surrounding whitespace', () => {
    expect(isTestAccountEmail('  qa@ziko-app.com  ')).toBe(true);
  });
});

describe('isTestAccountEmail — non-matches and safety', () => {
  it('rejects a real consumer domain', () => {
    expect(isTestAccountEmail('athlete@gmail.com')).toBe(false);
  });

  it('does not throw on undefined', () => {
    expect(isTestAccountEmail(undefined)).toBe(false);
  });

  it('does not throw on null', () => {
    expect(isTestAccountEmail(null)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isTestAccountEmail('')).toBe(false);
  });

  it('rejects a lookalike prefix domain', () => {
    expect(isTestAccountEmail('a@notziko-app.com')).toBe(false);
  });

  it('rejects a subdomain of the test domain', () => {
    expect(isTestAccountEmail('a@sub.ziko-app.com')).toBe(false);
  });

  it('rejects a truncated TLD', () => {
    expect(isTestAccountEmail('a@ziko-app.co')).toBe(false);
  });

  it('rejects the test domain as a prefix of a longer attacker-owned domain', () => {
    expect(isTestAccountEmail('a@ziko-app.com.attacker.tld')).toBe(false);
  });

  it('rejects an empty local part', () => {
    expect(isTestAccountEmail('@ziko-app.com')).toBe(false);
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
});
