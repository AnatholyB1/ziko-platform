// Phase 25 plan 06 Task 1 — convert plan 03 it.todo stubs to green tests.
// INVITE-05 happy path + INVITE-07 / T-25-01 byte-identical error envelopes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import { peekInvitation } from '../../src/coach/clients/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
let client: TestUser;
let linkedClient: TestUser; // has an active link with coach (LINK_EXISTS case)
let clientJwt: string;
let linkedJwt: string;
const codes: Record<string, string> = {};
const cleanupInvIds: string[] = [];
const cleanupUserIds: string[] = [];

function fourteenDays(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  return data.session!.access_token;
}

async function makeInv(over: Record<string, unknown>, code: string): Promise<string> {
  const { data, error } = await adminClient
    .from('coach_invitations')
    .insert({
      coach_id: coach.id,
      code,
      expires_at: fourteenDays(),
      ...over,
    })
    .select()
    .single();
  if (error) throw new Error(`makeInv(${code}): ${error.message}`);
  if (data) cleanupInvIds.push(data.id);
  return code;
}

beforeAll(async () => {
  coach = await createTestUser('cp-coach');
  client = await createTestUser('cp-client');
  linkedClient = await createTestUser('cp-linked');
  cleanupUserIds.push(coach.id, client.id, linkedClient.id);

  await adminClient
    .from('user_profiles')
    .upsert({ id: coach.id, role: 'coach', display_name: 'Coach' });
  await adminClient.from('coach_profiles').upsert({
    user_id: coach.id,
    display_name: 'Coach Name',
    bio: 'Hi',
    specialties: ['Hyrox'],
    kyc_status: 'verified',
  });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client' });
  await adminClient.from('user_profiles').upsert({ id: linkedClient.id, role: 'client' });

  clientJwt = await getJwt(client);
  linkedJwt = await getJwt(linkedClient);

  // Codes for 5 error causes:
  codes.valid = await makeInv({}, 'VALID2');
  codes.revoked = await makeInv({ revoked_at: new Date().toISOString() }, 'REVOK2');
  codes.expired = await makeInv(
    { expires_at: new Date(Date.now() - 1000).toISOString() },
    'EXPIR2',
  );
  codes.usedUp = await makeInv({ use_count: 1, max_uses: 1 }, 'USEDU2');

  // Set up the LINK_EXISTS case by redeeming a fresh code for linkedClient.
  const linkSeed = await makeInv({}, 'SEEDLK');
  await linkedClient.client.rpc('redeem_invitation_code', {
    code_input: linkSeed,
  });
  // Then issue another code: peeking with linkedJwt now triggers LINK_EXISTS.
  codes.linkExists = await makeInv({}, 'LNKEXS');
});

afterAll(async () => {
  await adminClient.from('coach_client_links').delete().eq('coach_id', coach.id);
  if (cleanupInvIds.length) {
    await adminClient.from('coach_invitations').delete().in('id', cleanupInvIds);
  }
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await cleanupTestUsers(cleanupUserIds);
});

describe('coach/clients/db.peekInvitation happy path (INVITE-05)', () => {
  it('returns ok=true + preview with coach profile fields on valid code', async () => {
    const result = await peekInvitation(clientJwt, { code: codes.valid });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.coach_id).toBe(coach.id);
      expect(result.preview.display_name).toBe('Coach Name');
      expect(result.preview.bio).toBe('Hi');
      expect(result.preview.specialties).toEqual(['Hyrox']);
      expect(result.preview.kyc_status).toBe('verified');
      // photo_url is null in this fixture, so photo_signed_url must be null
      expect(result.preview.photo_signed_url).toBeNull();
    }
  });
});

describe('coach/clients/db.peekInvitation error collapsing (INVITE-07 + T-25-01)', () => {
  const EXPECTED_ERROR = {
    ok: false,
    error_code: 'INVALID_OR_EXPIRED',
    preview: null,
  };

  it('nonexistent code (INVALID_CODE) collapses to INVALID_OR_EXPIRED', async () => {
    const res = await peekInvitation(clientJwt, { code: 'ZZZZ23' });
    expect(res).toEqual(EXPECTED_ERROR);
  });

  it('SELF_INVITATION collapses to INVALID_OR_EXPIRED', async () => {
    const coachJwt = await getJwt(coach);
    const res = await peekInvitation(coachJwt, { code: codes.valid });
    expect(res).toEqual(EXPECTED_ERROR);
  });

  it('revoked code (REVOKED) collapses to INVALID_OR_EXPIRED', async () => {
    const res = await peekInvitation(clientJwt, { code: codes.revoked });
    expect(res).toEqual(EXPECTED_ERROR);
  });

  it('expired code (EXPIRED) collapses to INVALID_OR_EXPIRED', async () => {
    const res = await peekInvitation(clientJwt, { code: codes.expired });
    expect(res).toEqual(EXPECTED_ERROR);
  });

  it('already-used code (ALREADY_USED) collapses to INVALID_OR_EXPIRED', async () => {
    const res = await peekInvitation(clientJwt, { code: codes.usedUp });
    expect(res).toEqual(EXPECTED_ERROR);
  });

  it('link already exists (LINK_EXISTS) collapses to INVALID_OR_EXPIRED', async () => {
    const res = await peekInvitation(linkedJwt, { code: codes.linkExists });
    expect(res).toEqual(EXPECTED_ERROR);
  });

  it('all 6 error envelopes are byte-identical (deep-equal JSON)', async () => {
    const coachJwt = await getJwt(coach);
    const responses = await Promise.all([
      peekInvitation(clientJwt, { code: 'ZZZZ23' }), // INVALID_CODE
      peekInvitation(coachJwt, { code: codes.valid }), // SELF_INVITATION
      peekInvitation(clientJwt, { code: codes.revoked }), // REVOKED
      peekInvitation(clientJwt, { code: codes.expired }), // EXPIRED
      peekInvitation(clientJwt, { code: codes.usedUp }), // ALREADY_USED
      peekInvitation(linkedJwt, { code: codes.linkExists }), // LINK_EXISTS
    ]);
    const first = JSON.stringify(responses[0]);
    for (const r of responses) {
      expect(JSON.stringify(r)).toBe(first);
    }
  });
});
