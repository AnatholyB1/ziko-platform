// Phase 26 plan 03 — CLIENT-07: multi-client comparison data
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  redeemInvitation,
  listCompareData,
} from '../../src/coach/clients/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
let clientA: TestUser;
let clientB: TestUser;
let coachJwt: string;
let clientAJwt: string;
let clientBJwt: string;
const cleanupInvIds: string[] = [];

function fourteenDays(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  return data.session!.access_token;
}

beforeAll(async () => {
  coach = await createTestUser('compare-coach');
  clientA = await createTestUser('compare-clienta');
  clientB = await createTestUser('compare-clientb');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach', name: 'Compare Coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'Compare Coach' });
  await adminClient.from('user_profiles').upsert({ id: clientA.id, role: 'client', name: 'Client A' });
  await adminClient.from('user_profiles').upsert({ id: clientB.id, role: 'client', name: 'Client B' });

  coachJwt = await getJwt(coach);
  clientAJwt = await getJwt(clientA);
  clientBJwt = await getJwt(clientB);

  // Link clientA
  const { data: invA, error: errA } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'CMPRAX', expires_at: fourteenDays() })
    .select()
    .single();
  if (errA) throw new Error(`setup invite A: ${errA.message}`);
  if (invA) cleanupInvIds.push(invA.id);
  const rA = await redeemInvitation(clientAJwt, { code: invA!.code }, clientA.id);
  if (!rA.ok) throw new Error('setup redeem A failed');

  // Link clientB
  const { data: invB, error: errB } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'CMPRBX', expires_at: fourteenDays() })
    .select()
    .single();
  if (errB) throw new Error(`setup invite B: ${errB.message}`);
  if (invB) cleanupInvIds.push(invB.id);
  const rB = await redeemInvitation(clientBJwt, { code: invB!.code }, clientB.id);
  if (!rB.ok) throw new Error('setup redeem B failed');

  // Insert body_measurements for clientA (for weight metric test)
  await adminClient.from('body_measurements').insert([
    { user_id: clientA.id, weight_kg: 80.0, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: clientA.id, weight_kg: 79.5, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  ]);
});

afterAll(async () => {
  await adminClient.from('body_measurements').delete().eq('user_id', clientA.id);
  await adminClient.from('coach_client_links').delete().eq('client_id', clientA.id);
  await adminClient.from('coach_client_links').delete().eq('client_id', clientB.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id, clientA.id, clientB.id]);
});

describe('GET /coach/clients/compare — multi-client comparison data', () => {
  it('returns time-series data for requested client IDs (body weight)', async () => {
    const result = await listCompareData(coachJwt, coach.id, [clientA.id], 'weight', 30);
    expect(result).toHaveProperty(clientA.id);
    const points = result[clientA.id];
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThanOrEqual(2);
    // Each point has date (string) and value (number)
    for (const p of points) {
      expect(typeof p.date).toBe('string');
      expect(typeof p.value).toBe('number');
    }
  });

  it('returns aggregate data for sessions metric (empty when no sessions)', async () => {
    const result = await listCompareData(coachJwt, coach.id, [clientA.id, clientB.id], 'sessions', 30);
    // Both clients are linked — both keys present (even if empty arrays)
    expect(result).toHaveProperty(clientA.id);
    expect(result).toHaveProperty(clientB.id);
    // sessions is aggregated by week — array of { date, value }
    expect(Array.isArray(result[clientA.id])).toBe(true);
    expect(Array.isArray(result[clientB.id])).toBe(true);
  });

  it('does not include data for unlinked client IDs', async () => {
    const unlinkedClient = await createTestUser('compare-unlinked');
    await adminClient.from('user_profiles').upsert({ id: unlinkedClient.id, role: 'client' });

    const result = await listCompareData(coachJwt, coach.id, [unlinkedClient.id], 'weight', 30);
    // Unlinked client is silently excluded — result should be empty object
    expect(result).not.toHaveProperty(unlinkedClient.id);
    expect(Object.keys(result).length).toBe(0);

    // cleanup
    await adminClient.auth.admin.deleteUser(unlinkedClient.id);
  });

  it('metric=sleep returns sleep_logs duration data (empty when no data)', async () => {
    const result = await listCompareData(coachJwt, coach.id, [clientA.id], 'sleep', 30);
    expect(result).toHaveProperty(clientA.id);
    expect(Array.isArray(result[clientA.id])).toBe(true);
  });

  it('metric=mood returns journal_entries mood data (empty when no data)', async () => {
    const result = await listCompareData(coachJwt, coach.id, [clientA.id], 'mood', 30);
    expect(result).toHaveProperty(clientA.id);
    expect(Array.isArray(result[clientA.id])).toBe(true);
  });
});
