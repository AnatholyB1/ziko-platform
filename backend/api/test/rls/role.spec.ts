import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from './fixtures';

const adminClient = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('user_profiles.role', () => {
  it('column exists with default client (introspection)', async () => {
    const { error } = await adminClient
      .from('user_profiles')
      .select('id, role')
      .limit(1);
    expect(error).toBeNull();
    // The shape check is "the column comes back" — if it doesn't exist, .select would error.
  });

  it('new user gets role=client via handle_new_user trigger', async () => {
    const u = await createTestUser('role-default');
    createdIds.push(u.id);
    const { data, error } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', u.id)
      .single();
    expect(error).toBeNull();
    expect(data?.role).toBe('client');
  });

  it('CHECK rejects role=invalid', async () => {
    const u = await createTestUser('role-check');
    createdIds.push(u.id);
    const { error } = await adminClient
      .from('user_profiles')
      .update({ role: 'invalid' })
      .eq('id', u.id);
    expect(error).not.toBeNull();
    // Postgres code 23514 = check_violation
    expect(error?.code).toBe('23514');
  });

  it('updating role to coach succeeds', async () => {
    const u = await createTestUser('role-coach');
    createdIds.push(u.id);
    const { error } = await adminClient
      .from('user_profiles')
      .update({ role: 'coach' })
      .eq('id', u.id);
    expect(error).toBeNull();
  });

  it('backfill: no existing user_profiles row has NULL role', async () => {
    const { count, error } = await adminClient
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .is('role', null);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });
});
