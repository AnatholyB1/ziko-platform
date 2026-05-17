// Phase 25 plan 06 Task 1 — INVITE-06: client revokes link, is_coach_of FALSE.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  redeemInvitation,
  revokeLink,
} from '../../src/coach/clients/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
let client: TestUser;
let clientJwt: string;
let linkId: string;
const cleanupInvIds: string[] = [];

function fourteenDays(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  return data.session!.access_token;
}

beforeAll(async () => {
  coach = await createTestUser('cv-coach');
  client = await createTestUser('cv-client');
  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach' });
  await adminClient
    .from('coach_profiles')
    .upsert({ user_id: coach.id, display_name: 'V' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client' });

  clientJwt = await getJwt(client);

  const { data, error } = await adminClient
    .from('coach_invitations')
    .insert({ coach_id: coach.id, code: 'RVOK22', expires_at: fourteenDays() })
    .select()
    .single();
  if (error) throw new Error(`setup invite: ${error.message}`);
  if (data) cleanupInvIds.push(data.id);

  const r = await redeemInvitation(clientJwt, { code: data!.code }, client.id);
  if (!r.ok) throw new Error('setup redeem failed');
  linkId = r.link.id;
});

afterAll(async () => {
  await adminClient.from('coach_client_links').delete().eq('client_id', client.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers([coach.id, client.id]);
});

describe('coach/clients/db.revokeLink (INVITE-06)', () => {
  it('sets revoked_at on link owned by client', async () => {
    const r = await revokeLink(clientJwt, client.id, linkId);
    expect(r.revoked_at).not.toBeNull();
    const { data } = await adminClient
      .from('coach_client_links')
      .select('revoked_at')
      .eq('id', linkId)
      .single();
    expect(data!.revoked_at).not.toBeNull();
  });

  it('after revoke, is_coach_of returns FALSE on next RLS check', async () => {
    // is_coach_of(coach UUID, client UUID) — positional args per migration 035.
    const { data, error } = await adminClient.rpc('is_coach_of', {
      coach: coach.id,
      client: client.id,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('is idempotent — second call returns success', async () => {
    await expect(revokeLink(clientJwt, client.id, linkId)).resolves.toBeDefined();
  });
});
