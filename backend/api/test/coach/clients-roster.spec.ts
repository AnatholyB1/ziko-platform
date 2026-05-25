// Phase 26 plan 02 — CLIENT-01: roster list with signal flags
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  redeemInvitation,
  listCoachClients,
} from '../../src/coach/clients/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
let client: TestUser;
let coachJwt: string;
let clientJwt: string;
const cleanupInvIds: string[] = [];

function fourteenDays(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  return data.session!.access_token;
}

beforeAll(async () => {
  coach = await createTestUser('roster-coach');
  client = await createTestUser('roster-client');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach', name: 'Roster Client' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'Roster Coach' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client', name: 'Test Client' });

  coachJwt = await getJwt(coach);
  clientJwt = await getJwt(client);

  // Create an invitation and redeem it to establish the coach-client link
  const { data, error } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'ROSTRX', expires_at: fourteenDays() })
    .select()
    .single();
  if (error) throw new Error(`setup invite: ${error.message}`);
  if (data) cleanupInvIds.push(data.id);

  const r = await redeemInvitation(clientJwt, { code: data!.code }, client.id);
  if (!r.ok) throw new Error('setup redeem failed');
});

afterAll(async () => {
  await adminClient.from('coach_client_links').delete().eq('client_id', client.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id, client.id]);
});

describe('GET /coach/clients — roster with signal flags', () => {
  it('returns roster rows for linked coach', async () => {
    const rows = await listCoachClients(coachJwt, coach.id);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows.find((r) => r.id === client.id);
    expect(row).toBeDefined();
    expect(row!.id).toBe(client.id);
  });

  it('does not return rows for unlinked coach', async () => {
    // A coach with no linked clients returns empty array
    const unlinkedCoach = await createTestUser('unlinked-coach');
    await adminClient.from('user_profiles').upsert({ id: unlinkedCoach.id, role: 'coach' });
    const unlinkedJwt = await getJwt(unlinkedCoach);
    const rows = await listCoachClients(unlinkedJwt, unlinkedCoach.id);
    expect(rows).toEqual([]);
    // cleanup
    await adminClient.auth.admin.deleteUser(unlinkedCoach.id);
  });

  it('includes signal_missed, signal_stale, signal_mood boolean flags', async () => {
    const rows = await listCoachClients(coachJwt, coach.id);
    const row = rows.find((r) => r.id === client.id);
    expect(row).toBeDefined();
    // signal flags should be booleans
    expect(typeof row!.signal_missed).toBe('boolean');
    expect(typeof row!.signal_stale).toBe('boolean');
    expect(typeof row!.signal_mood).toBe('boolean');
    // sessions_this_week should be a non-negative number
    expect(typeof row!.sessions_this_week).toBe('number');
    expect(row!.sessions_this_week).toBeGreaterThanOrEqual(0);
    // A fresh test client with no sessions should have signal_missed = true
    expect(row!.signal_missed).toBe(true);
    // A fresh test client with no measurements should have signal_stale = true
    expect(row!.signal_stale).toBe(true);
    // habits_pct is null when no habits configured
    expect(row!.habits_pct).toBeNull();
  });
});
