// Phase 26 plan 02 — CLIENT-05: tags CRUD with RLS isolation
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  listClientTags,
  createClientTag,
  deleteClientTag,
} from '../../src/coach/clients/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
let coachB: TestUser;
let client: TestUser;
let coachJwt: string;
let coachBJwt: string;

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  return data.session!.access_token;
}

beforeAll(async () => {
  coach = await createTestUser('tags-coach');
  coachB = await createTestUser('tags-coachb');
  client = await createTestUser('tags-client');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'Tags Coach A' });
  await adminClient.from('user_profiles').upsert({ id: coachB.id, role: 'coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coachB.id, display_name: 'Tags Coach B' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client' });

  coachJwt = await getJwt(coach);
  coachBJwt = await getJwt(coachB);
});

afterAll(async () => {
  await adminClient.from('coach_client_tags').delete().eq('coach_id', coach.id);
  await adminClient.from('coach_client_tags').delete().eq('coach_id', coachB.id);
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await adminClient.from('coach_profiles').delete().eq('user_id', coachB.id);
  await cleanupTestUsers([coach.id, coachB.id, client.id]);
});

describe('GET/POST/DELETE /coach/clients/:id/tags — tag CRUD', () => {
  it('POST creates a tag row with coach_id = auth.uid()', async () => {
    const tag = await createClientTag(coachJwt, coach.id, client.id, 'vip');
    expect(tag.coach_id).toBe(coach.id);
    expect(tag.client_id).toBe(client.id);
    expect(tag.tag).toBe('vip');
    expect(tag.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('GET lists only the calling coach\'s tags for this client', async () => {
    // Create a tag by coach A
    await createClientTag(coachJwt, coach.id, client.id, 'motivated');
    // Create a tag by coach B for same client
    await createClientTag(coachBJwt, coachB.id, client.id, 'coachb-tag');

    const coachATags = await listClientTags(coachJwt, coach.id, client.id);
    const tagNames = coachATags.map((t) => t.tag);
    expect(tagNames).toContain('motivated');
    // Coach A should NOT see Coach B's tags
    expect(tagNames).not.toContain('coachb-tag');
  });

  it('DELETE removes tag by id when coach_id matches', async () => {
    const tag = await createClientTag(coachJwt, coach.id, client.id, 'to-delete');
    const before = await listClientTags(coachJwt, coach.id, client.id);
    expect(before.some((t) => t.id === tag.id)).toBe(true);

    await deleteClientTag(coachJwt, coach.id, tag.id);

    const after = await listClientTags(coachJwt, coach.id, client.id);
    expect(after.some((t) => t.id === tag.id)).toBe(false);
  });

  it('Coach B cannot read Coach A\'s tags (RLS isolation)', async () => {
    // Ensure Coach A has at least one tag
    await createClientTag(coachJwt, coach.id, client.id, 'private-tag');

    // Coach B lists tags for same client — should see 0 of Coach A's tags
    const coachBTags = await listClientTags(coachBJwt, coachB.id, client.id);
    const coachBTagNames = coachBTags.map((t) => t.tag);
    expect(coachBTagNames).not.toContain('private-tag');
    expect(coachBTagNames).not.toContain('vip');
    expect(coachBTagNames).not.toContain('motivated');
  });

  it('duplicate tag (same coach+client+tag) is rejected (UNIQUE)', async () => {
    await createClientTag(coachJwt, coach.id, client.id, 'unique-tag');
    await expect(
      createClientTag(coachJwt, coach.id, client.id, 'unique-tag'),
    ).rejects.toThrow();
  });
});
