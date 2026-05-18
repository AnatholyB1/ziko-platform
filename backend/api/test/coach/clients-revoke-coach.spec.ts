// Phase 26 plan 02 — CLIENT-08: coach-side link revocation
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  redeemInvitation,
  revokeClientLinkByCoach,
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
  coach = await createTestUser('rc-coach');
  client = await createTestUser('rc-client');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'RC Coach' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client' });

  coachJwt = await getJwt(coach);
  clientJwt = await getJwt(client);

  // Create an invitation and redeem it to establish a link
  const { data, error } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'RVCCHX', expires_at: fourteenDays() })
    .select()
    .single();
  if (error) throw new Error(`setup invite: ${error.message}`);
  if (data) cleanupInvIds.push(data.id);

  const r = await redeemInvitation(clientJwt, { code: data!.code }, client.id);
  if (!r.ok) throw new Error('setup redeem failed');
});

afterAll(async () => {
  await adminClient.from('coach_client_links').delete().eq('client_id', client.id);
  await adminClient.from('coach_client_links').delete().eq('coach_id', coach.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id, client.id]);
});

describe('DELETE /coach/clients/links/:clientId — coach-side revoke', () => {
  it('sets revoked_at on the link row when called by the coach', async () => {
    const result = await revokeClientLinkByCoach(coachJwt, coach.id, client.id);
    expect(result.revoked_at).toBeTruthy();
    expect(new Date(result.revoked_at).getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    // Verify in DB
    const { data } = await adminClient
      .from('coach_client_links')
      .select('revoked_at')
      .eq('coach_id', coach.id)
      .eq('client_id', client.id)
      .single();
    expect(data!.revoked_at).not.toBeNull();
  });

  it('coach cannot read client data after revocation (is_coach_of returns FALSE)', async () => {
    const { data, error } = await adminClient.rpc('is_coach_of', {
      coach: coach.id,
      client: client.id,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('revoke by wrong coach (non-coach user) affects 0 rows — no error thrown', async () => {
    // A different user (client itself) calling revokeClientLinkByCoach with their own ID as coachId
    // The WHERE clause coach_id = wrongCoachId AND client_id = clientId matches 0 rows
    // Function should complete without throwing (0 rows updated is not an error)
    await expect(
      revokeClientLinkByCoach(clientJwt, client.id, client.id),
    ).resolves.toBeDefined();
  });
});
