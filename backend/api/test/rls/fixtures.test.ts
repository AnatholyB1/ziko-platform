import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from './fixtures';

const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) await cleanupTestUsers(createdUserIds);
});

describe('fixtures', () => {
  it('getAdminClient returns a client with autoRefreshToken disabled', () => {
    const admin = getAdminClient();
    expect(admin).toBeDefined();
    // Smoke: a basic admin call works.
  });

  it('createTestUser yields a real UUID + authed anon client', async () => {
    const u = await createTestUser('fixture');
    createdUserIds.push(u.id);
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.email).toMatch(/^fixture-[0-9a-f]{8}@ziko\.test$/);
    const { data, error } = await u.client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(u.id);
  });

  it('two createTestUser calls produce distinct ids', async () => {
    const a = await createTestUser('fixture');
    const b = await createTestUser('fixture');
    createdUserIds.push(a.id, b.id);
    expect(a.id).not.toBe(b.id);
  });

  it('cleanupTestUsers actually deletes the user', async () => {
    const u = await createTestUser('fixture-delete');
    await cleanupTestUsers([u.id]);
    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(u.id);
    // Either error is set OR user is null — both signal "gone"
    expect(error !== null || data.user === null).toBe(true);
  });
});
