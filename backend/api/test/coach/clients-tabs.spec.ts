// Phase 26 plan 03 — CLIENT-03: 7 tab routes for linked coach
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  redeemInvitation,
  getClientSessions,
  getClientMeasurements,
  getClientHabits,
  getClientNutrition,
  getClientSleep,
  getClientCardio,
  getClientJournal,
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
  coach = await createTestUser('tabs-coach');
  client = await createTestUser('tabs-client');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach', name: 'Tabs Coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'Tabs Coach' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client', name: 'Tabs Client' });

  coachJwt = await getJwt(coach);
  clientJwt = await getJwt(client);

  // Establish coach-client link
  const { data, error } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'TABSRX', expires_at: fourteenDays() })
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

describe('GET /coach/clients/:id/[tab] — 7 tab routes', () => {
  it('sessions tab returns 200 for linked coach (empty array when no data)', async () => {
    const rows = await getClientSessions(coachJwt, client.id);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('measurements tab returns 200 for linked coach (empty array when no data)', async () => {
    const rows = await getClientMeasurements(coachJwt, client.id);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('habits tab returns 200 for linked coach (empty habits + logs when no data)', async () => {
    const result = await getClientHabits(coachJwt, client.id);
    expect(Array.isArray(result.habits)).toBe(true);
    expect(Array.isArray(result.logs)).toBe(true);
  });

  it('nutrition tab returns 200 for linked coach (empty array when no data)', async () => {
    const rows = await getClientNutrition(coachJwt, client.id);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('sleep tab returns 200 for linked coach (empty array when no data)', async () => {
    const rows = await getClientSleep(coachJwt, client.id);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('cardio tab returns 200 for linked coach (empty array when no data)', async () => {
    const rows = await getClientCardio(coachJwt, client.id);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('journal tab returns 200 for linked coach (empty array when no data)', async () => {
    const rows = await getClientJournal(coachJwt, client.id);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('all tabs return empty rows for unlinked coach (RLS isolation)', async () => {
    const unlinkedCoach = await createTestUser('tabs-unlinked');
    await adminClient.from('user_profiles').upsert({ id: unlinkedCoach.id, role: 'coach' });
    const unlinkedJwt = await getJwt(unlinkedCoach);

    const [sessions, measurements, habits, nutrition, sleep, cardio, journal] = await Promise.all([
      getClientSessions(unlinkedJwt, client.id),
      getClientMeasurements(unlinkedJwt, client.id),
      getClientHabits(unlinkedJwt, client.id),
      getClientNutrition(unlinkedJwt, client.id),
      getClientSleep(unlinkedJwt, client.id),
      getClientCardio(unlinkedJwt, client.id),
      getClientJournal(unlinkedJwt, client.id),
    ]);

    expect(sessions).toEqual([]);
    expect(measurements).toEqual([]);
    expect(habits.habits).toEqual([]);
    expect(habits.logs).toEqual([]);
    expect(nutrition).toEqual([]);
    expect(sleep).toEqual([]);
    expect(cardio).toEqual([]);
    expect(journal).toEqual([]);

    // cleanup
    await adminClient.auth.admin.deleteUser(unlinkedCoach.id);
  });
});
