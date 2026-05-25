// Phase 25 plan 06 Task 1 — converts plan 02 it.todo stubs into real green tests.
// Uses shared fixtures from ../rls/fixtures (no inline createClient).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  insertInvitation,
  listInvitations,
  revokeInvitation,
} from '../../src/coach/invitations/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
const createdInvitationIds: string[] = [];

beforeAll(async () => {
  coach = await createTestUser('inv-coach');
  await adminClient
    .from('user_profiles')
    .upsert({ id: coach.id, role: 'coach', display_name: 'TestCoach' });
  await adminClient
    .from('coach_profiles')
    .upsert({ user_id: coach.id, display_name: 'TestCoach' });
});

afterAll(async () => {
  if (createdInvitationIds.length) {
    await adminClient
      .from('coach_invitations')
      .delete()
      .in('id', createdInvitationIds);
  }
  await adminClient.from('coach_invitations').delete().eq('coach_id', coach.id);
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id]);
});

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No access token for test user');
  return token;
}

// 14-day default expiry — schema column is NOT NULL with DB DEFAULT (now() + 14d).
// Service layer materializes the default to an ISOString before calling db.ts
// (db.ts inserts the value verbatim, so passing null would override the default
// with a NULL literal and violate the NOT NULL constraint).
function fourteenDays(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

describe('coach/invitations/db.insertInvitation (INVITE-01)', () => {
  it('inserts row with 6-char [A-Z2-9] code matching DB CHECK', async () => {
    const jwt = await getJwt(coach);
    const row = await insertInvitation(jwt, coach.id, { expires_at: fourteenDays() });
    createdInvitationIds.push(row.id);
    expect(row.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(row.coach_id).toBe(coach.id);
    expect(row.use_count).toBe(0);
    expect(row.max_uses).toBeGreaterThanOrEqual(1);
  });

  it('respects expires_at when caller provides ISOString', async () => {
    const jwt = await getJwt(coach);
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const row = await insertInvitation(jwt, coach.id, { expires_at: expires });
    createdInvitationIds.push(row.id);
    expect(row.expires_at).not.toBeNull();
    const diff = Math.abs(
      new Date(row.expires_at!).getTime() - new Date(expires).getTime(),
    );
    // ms-level precision in TIMESTAMPTZ — allow 2s drift for round-trip
    expect(diff).toBeLessThan(2000);
  });

  it('retries up to 3 times on PG 23505 unique violation (deterministic mock)', async () => {
    // Mock nanoid customAlphabet to yield deterministic sequence:
    //   first two calls => 'DUPLI2' (already exists)
    //   third call      => 'UNIQU3' (free)
    const sequence = ['DUPLI2', 'DUPLI2', 'UNIQU3'];
    let callIdx = 0;
    vi.resetModules();
    vi.doMock('nanoid', () => ({
      customAlphabet: () => () => sequence[callIdx++] ?? 'FALLB2',
    }));
    const { insertInvitation: retryInsert } = await import(
      '../../src/coach/invitations/db.js'
    );

    // Pre-insert the colliding code so first two attempts hit PG 23505.
    const pre = await adminClient
      .from('coach_invitations')
      .insert({
        coach_id: coach.id,
        code: 'DUPLI2',
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select()
      .single();
    if (pre.data) createdInvitationIds.push(pre.data.id);

    const jwt = await getJwt(coach);
    const result = await retryInsert(jwt, coach.id, { expires_at: fourteenDays() });
    if (result?.id) createdInvitationIds.push(result.id);

    expect(result.code).toBe('UNIQU3');
    expect(callIdx).toBe(3); // exactly 3 attempts

    vi.doUnmock('nanoid');
    vi.resetModules();
  });

  it('throws on non-23505 db errors immediately (no retry)', async () => {
    const jwt = await getJwt(coach);
    // RLS violation when coach_id != auth.uid() — throws (no retry path).
    // Both 23503 (FK) and 42501 (RLS) outcomes satisfy "throws immediately".
    await expect(
      insertInvitation(jwt, '00000000-0000-0000-0000-000000000000', {
        expires_at: fourteenDays(),
      }),
    ).rejects.toThrow();
  });
});

describe('coach/invitations/db.listInvitations (INVITE-02)', () => {
  it('returns rows with computed status field', async () => {
    const jwt = await getJwt(coach);
    const rows = await listInvitations(jwt, coach.id, 'all');
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(['active', 'used', 'expired', 'revoked']).toContain(r.status);
    }
  });

  it('filter=active excludes expired and revoked rows', async () => {
    const expired = await adminClient
      .from('coach_invitations')
      .insert({
        coach_id: coach.id,
        code: 'EXP234',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
      .select()
      .single();
    if (expired.data) createdInvitationIds.push(expired.data.id);

    const jwt = await getJwt(coach);
    const active = await listInvitations(jwt, coach.id, 'active');
    expect(active.every((r) => r.status === 'active')).toBe(true);
    expect(active.find((r) => r.id === expired.data!.id)).toBeUndefined();
  });

  it('orders by created_at DESC', async () => {
    const jwt = await getJwt(coach);
    const rows = await listInvitations(jwt, coach.id, 'all');
    for (let i = 1; i < rows.length; i++) {
      expect(new Date(rows[i - 1].created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(rows[i].created_at).getTime(),
      );
    }
  });
});

describe('coach/invitations/db.revokeInvitation (INVITE-02)', () => {
  it('sets revoked_at on active row owned by caller', async () => {
    const jwt = await getJwt(coach);
    const row = await insertInvitation(jwt, coach.id, { expires_at: fourteenDays() });
    createdInvitationIds.push(row.id);
    const r = await revokeInvitation(jwt, coach.id, row.id);
    expect(r.revoked_at).not.toBeNull();
    const { data } = await adminClient
      .from('coach_invitations')
      .select('revoked_at')
      .eq('id', row.id)
      .single();
    expect(data!.revoked_at).not.toBeNull();
  });

  it('is idempotent — second call returns success without throwing', async () => {
    const jwt = await getJwt(coach);
    const row = await insertInvitation(jwt, coach.id, { expires_at: fourteenDays() });
    createdInvitationIds.push(row.id);
    await revokeInvitation(jwt, coach.id, row.id);
    await expect(
      revokeInvitation(jwt, coach.id, row.id),
    ).resolves.toBeDefined();
  });
});
