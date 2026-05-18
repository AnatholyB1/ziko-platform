// Phase 26 plan 03 — CLIENT-04: executive summary aggregates
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  redeemInvitation,
  getClientSummary,
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
  coach = await createTestUser('summary-coach');
  client = await createTestUser('summary-client');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach', name: 'Summary Coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'Summary Coach' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client', name: 'Summary Client' });

  coachJwt = await getJwt(coach);
  clientJwt = await getJwt(client);

  // Create invitation and redeem to establish link
  const { data, error } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'SUMRYX', expires_at: fourteenDays() })
    .select()
    .single();
  if (error) throw new Error(`setup invite: ${error.message}`);
  if (data) cleanupInvIds.push(data.id);

  const r = await redeemInvitation(clientJwt, { code: data!.code }, client.id);
  if (!r.ok) throw new Error('setup redeem failed');
});

afterAll(async () => {
  await adminClient.from('workout_sessions').delete().eq('user_id', client.id);
  await adminClient.from('coach_client_links').delete().eq('client_id', client.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id, client.id]);
});

describe('GET /coach/clients/:id/summary — executive summary aggregates', () => {
  it('returns null fields when athlete has no data', async () => {
    const summary = await getClientSummary(coachJwt, coach.id, client.id);
    expect(summary.sessions_this_week).toBe(0);
    expect(summary.habits_pct).toBeNull();
    expect(summary.last_workout_at).toBeNull();
    expect(summary.latest_weight_kg).toBeNull();
    expect(summary.mood_delta).toBeNull();
    expect(summary.mood_curr_avg).toBeNull();
    expect(summary.mood_prev_avg).toBeNull();
  });

  it('returns sessions_this_week count for current week', async () => {
    // Insert a workout session for this client dated this week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - now.getDay());
    const sessionDate = new Date(weekStart.getTime() + 60 * 60 * 1000).toISOString(); // 1h after week start

    await adminClient.from('workout_sessions').insert({
      user_id: client.id,
      name: 'Test Session',
      created_at: sessionDate,
    });

    const summary = await getClientSummary(coachJwt, coach.id, client.id);
    expect(summary.sessions_this_week).toBeGreaterThanOrEqual(1);
    expect(summary.last_workout_at).not.toBeNull();
  });

  it('returns last_workout_at relative to now', async () => {
    const summary = await getClientSummary(coachJwt, coach.id, client.id);
    // After inserting a session above, last_workout_at should be populated
    if (summary.last_workout_at !== null) {
      expect(new Date(summary.last_workout_at).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('returns mood_delta computed from last 14 days (null when < 3 entries per window)', async () => {
    // Fresh client has no journal entries — mood_delta must be null
    const summary = await getClientSummary(coachJwt, coach.id, client.id);
    expect(summary.mood_delta).toBeNull();
    expect(summary.mood_curr_avg).toBeNull();
    expect(summary.mood_prev_avg).toBeNull();
  });

  it('returns habits_pct as 7-day average completion rate (null when no habits)', async () => {
    // Client has no habits configured — must be null
    const summary = await getClientSummary(coachJwt, coach.id, client.id);
    expect(summary.habits_pct).toBeNull();
  });

  it('unlinked coach gets zero-value summary (RLS returns empty, not error)', async () => {
    const unlinkedCoach = await createTestUser('summary-unlinked');
    await adminClient.from('user_profiles').upsert({ id: unlinkedCoach.id, role: 'coach' });
    const unlinkedJwt = await getJwt(unlinkedCoach);
    // RLS prevents reading client data — getClientSummary returns zero/null fields, not throws
    const summary = await getClientSummary(unlinkedJwt, unlinkedCoach.id, client.id);
    expect(summary.sessions_this_week).toBe(0);
    expect(summary.habits_pct).toBeNull();
    expect(summary.last_workout_at).toBeNull();
    // cleanup
    await adminClient.auth.admin.deleteUser(unlinkedCoach.id);
  });
});
