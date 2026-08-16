// Phase 4 plan 04-01 (v1.16, lien-invite) — CRED-04/CRED-05 storage-contract and
// deny-all proof for the premium credit-gate alignment migration
// (20260816_premium_credit_flag.sql). Follows the house shape from
// waitlist-config-rpc.spec.ts verbatim: same RUN_DB guard, same
// getAdminClient/getAnonClient fixtures, describe.skipIf(!RUN_DB) on every block.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec is read-only against the cap key and
// creates/deletes one throwaway user for the column-default check, so it must
// never run there. See waitlist-config-rpc.spec.ts for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('app_config.premium_credit_cap_enabled — stored as a JSONB boolean, shipped false (CRED-05, T-04-03)', () => {
  let admin: ReturnType<typeof getAdminClient>;

  beforeAll(() => {
    admin = getAdminClient();
  });

  // Read-only: unlike waitlist-config-rpc.spec.ts's threshold-arbitration block,
  // this suite never writes the cap key. The value under test is the shipped
  // default, not something this suite arbitrates — a transient write here, even
  // with an afterAll restore, would create a window where a live project has
  // the cap enabled ahead of Phase 6.
  it('reads exactly one row whose value is strictly the JS boolean false', async () => {
    const { data, error } = await admin
      .from('app_config')
      .select('value')
      .eq('key', 'premium_credit_cap_enabled');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(typeof data?.[0]?.value).toBe('boolean');
    expect(data?.[0]?.value).toBe(false);
  });
});

describe.skipIf(!RUN_DB)('user_profiles.is_lifetime_premium — exists, defaults false (CRED-04, T-04-03)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    // FK CASCADE on auth.users wipes the user_profiles row created by the trigger.
    await cleanupTestUsers(createdUserIds);
  });

  it('the column exists on user_profiles and is queryable without error', async () => {
    const { error } = await admin.from('user_profiles').select('is_lifetime_premium').limit(1);
    expect(error).toBeNull();
  });

  it('a freshly created profile reads is_lifetime_premium=false by default — nothing in this milestone writes it', async () => {
    const testUser = await createTestUser('premium-gate-cred04');
    createdUserIds.push(testUser.id);

    const { data: row, error } = await admin
      .from('user_profiles')
      .select('is_lifetime_premium')
      .eq('id', testUser.id)
      .single();

    expect(error).toBeNull();
    expect(row?.is_lifetime_premium).toBe(false);
  });
});

describe.skipIf(!RUN_DB)('app_config deny-all posture holds for the new cap row too (CRED-05, T-04-03)', () => {
  let anon: ReturnType<typeof getAnonClient>;

  beforeAll(() => {
    anon = getAnonClient();
  });

  it('anon reading the cap key directly gets zero rows and no error', async () => {
    const { data, error } = await anon.from('app_config').select('*').eq('key', 'premium_credit_cap_enabled');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('anon updating the cap key directly gets an error', async () => {
    const { error } = await anon
      .from('app_config')
      .update({ value: true })
      .eq('key', 'premium_credit_cap_enabled');
    expect(error).not.toBeNull();
  });
});
