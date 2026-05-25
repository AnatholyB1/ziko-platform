import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('coach_profiles RLS', () => {
  it('User A can insert their own coach_profiles row', async () => {
    const a = await createTestUser('cp-a');
    createdIds.push(a.id);
    const { error } = await a.client
      .from('coach_profiles')
      .insert({ user_id: a.id, display_name: 'Coach A' });
    expect(error).toBeNull();
  });

  it('User A cannot insert a coach_profiles row owned by User B', async () => {
    const a = await createTestUser('cp-rls-a');
    const b = await createTestUser('cp-rls-b');
    createdIds.push(a.id, b.id);
    const { error } = await a.client
      .from('coach_profiles')
      .insert({ user_id: b.id, display_name: 'Hijack' });
    expect(error).not.toBeNull();
    // Postgres error code 42501 (insufficient_privilege) or PostgREST '23' family on RLS denial
    expect(error?.code === '42501' || error?.message?.includes('row-level security')).toBe(true);
  });

  it('User A can read their own coach_profiles row', async () => {
    // Migration 042 added "coach_profiles_authenticated_read" allowing all
    // authenticated users to SELECT any coach_profiles row (athletes need to
    // read their coach's display name). User A must at minimum see their own row.
    const a = await createTestUser('cp-sel-a');
    const b = await createTestUser('cp-sel-b');
    createdIds.push(a.id, b.id);
    await a.client.from('coach_profiles').insert({ user_id: a.id, display_name: 'A' });
    await admin.from('coach_profiles').insert({ user_id: b.id, display_name: 'B' });

    const { data, error } = await a.client
      .from('coach_profiles')
      .select('user_id')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].user_id).toBe(a.id);
  });

  it('kyc_status CHECK rejects banana', async () => {
    const a = await createTestUser('cp-kyc');
    createdIds.push(a.id);
    await a.client.from('coach_profiles').insert({ user_id: a.id, display_name: 'A' });
    const { error } = await admin
      .from('coach_profiles')
      .update({ kyc_status: 'banana' })
      .eq('user_id', a.id);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('updated_at trigger fires on UPDATE', async () => {
    const a = await createTestUser('cp-upd');
    createdIds.push(a.id);
    await a.client.from('coach_profiles').insert({ user_id: a.id, display_name: 'A' });
    const { data: r1 } = await admin
      .from('coach_profiles')
      .select('updated_at')
      .eq('user_id', a.id)
      .single();
    await new Promise((r) => setTimeout(r, 50));
    await a.client.from('coach_profiles').update({ display_name: 'A2' }).eq('user_id', a.id);
    const { data: r2 } = await admin
      .from('coach_profiles')
      .select('updated_at')
      .eq('user_id', a.id)
      .single();
    expect(new Date(r2!.updated_at).getTime()).toBeGreaterThan(new Date(r1!.updated_at).getTime());
  });

  it('FK CASCADE on auth.users delete removes coach_profiles row', async () => {
    const a = await createTestUser('cp-fk');
    await a.client.from('coach_profiles').insert({ user_id: a.id, display_name: 'A' });
    await admin.auth.admin.deleteUser(a.id);
    const { data } = await admin
      .from('coach_profiles')
      .select('user_id')
      .eq('user_id', a.id);
    expect(data?.length ?? 0).toBe(0);
    // No cleanup push — user already deleted.
  });
});
