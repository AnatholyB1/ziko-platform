// Phase 4 plan 04-02 (v1.16, lien-invite) — CRED-03 idempotency and
// service-role-only proof for grant_premium_credits()
// (20260816_premium_credit_grant.sql). Follows the house shape from
// waitlist-config-rpc.spec.ts verbatim: same RUN_DB guard, same
// getAdminClient/getAnonClient/createTestUser/cleanupTestUsers fixtures,
// same skipIf(!RUN_DB) guard on every describe block.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec creates users and mutates credit
// balances, so it must never run there. See waitlist-config-rpc.spec.ts for
// the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

const GRANT_AMOUNT = 300;

/** YYYY-MM for the current UTC month — matches to_char(now(), 'YYYY-MM') in the RPC. */
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

describe.skipIf(!RUN_DB)('grant_premium_credits — funds once per calendar month, service-role only (CRED-03, T-04-04)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  it('a fresh user granted once: balance rises by the amount, exactly one ledger row with the grant type and this month\'s key', async () => {
    const user = await createTestUser('premium-grant-first');
    createdUserIds.push(user.id);

    // The new-user welcome-credit trigger (026_ai_credits.sql) may already have
    // seeded a row — assert the delta, not an absolute value, so this test
    // does not couple to that unrelated trigger's amount.
    const { data: before } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    const balanceBefore = before?.balance ?? 0;

    const { data, error } = await admin.rpc('grant_premium_credits', {
      p_user_id: user.id,
      p_amount: GRANT_AMOUNT,
    });
    expect(error).toBeNull();
    expect(data.granted).toBe(true);
    expect(data.amount).toBe(GRANT_AMOUNT);

    const { data: after } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    expect(after?.balance).toBe(balanceBefore + GRANT_AMOUNT);

    const { data: txRows } = await admin
      .from('ai_credit_transactions')
      .select('source, idempotency_key, amount')
      .eq('user_id', user.id)
      .eq('type', 'premium_grant');
    expect(txRows).toHaveLength(1);
    expect(txRows?.[0].source).toBe('premium_grant');
    expect(txRows?.[0].amount).toBe(GRANT_AMOUNT);
    expect(txRows?.[0].idempotency_key).toBe(`premium_grant_${currentMonthKey()}`);
  });

  it('the same user granted a second time immediately: balance strictly unchanged, still exactly one ledger row, granted is falsy', async () => {
    const user = await createTestUser('premium-grant-dup');
    createdUserIds.push(user.id);

    const first = await admin.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
    expect(first.error).toBeNull();
    expect(first.data.granted).toBe(true);

    const { data: afterFirst } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    const balanceAfterFirst = afterFirst?.balance;

    const second = await admin.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
    expect(second.error).toBeNull();
    expect(second.data.granted).toBeFalsy();
    expect(second.data.reason).toBe('duplicate');

    const { data: afterSecond } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    // Strict equality: a function that reports failure while still incrementing
    // is exactly the defect this test guards against.
    expect(afterSecond?.balance).toBe(balanceAfterFirst);

    const { data: txRows } = await admin
      .from('ai_credit_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'premium_grant');
    expect(txRows).toHaveLength(1);
  });

  it('a user with no user_ai_credits row at all is granted successfully — the RPC creates the row', async () => {
    const user = await createTestUser('premium-grant-norow');
    createdUserIds.push(user.id);

    // Remove the row the welcome-credit trigger seeded, so this user genuinely
    // has none — proves the RPC's INSERT ... ON CONFLICT DO NOTHING path,
    // not just its UPDATE path.
    await admin.from('user_ai_credits').delete().eq('user_id', user.id);
    const { data: gone } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).maybeSingle();
    expect(gone).toBeNull();

    const { data, error } = await admin.rpc('grant_premium_credits', {
      p_user_id: user.id,
      p_amount: GRANT_AMOUNT,
    });
    expect(error).toBeNull();
    expect(data.granted).toBe(true);

    const { data: row } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    expect(row?.balance).toBe(GRANT_AMOUNT);
  });

  it('an amount of zero is refused without touching the balance', async () => {
    const user = await createTestUser('premium-grant-zero');
    createdUserIds.push(user.id);

    const { data: before } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();

    const { data, error } = await admin.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: 0 });
    expect(error).toBeNull();
    expect(data.granted).toBe(false);
    expect(data.reason).toBe('invalid_amount');

    const { data: after } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    expect(after?.balance).toBe(before?.balance);
  });

  it('a negative amount is refused without touching the balance', async () => {
    const user = await createTestUser('premium-grant-negative');
    createdUserIds.push(user.id);

    const { data: before } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();

    const { data, error } = await admin.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: -5 });
    expect(error).toBeNull();
    expect(data.granted).toBe(false);
    expect(data.reason).toBe('invalid_amount');

    const { data: after } = await admin.from('user_ai_credits').select('balance').eq('user_id', user.id).single();
    expect(after?.balance).toBe(before?.balance);
  });

  it('the anon client gets an error; the authenticated client gets an error; the admin client succeeds', async () => {
    const user = await createTestUser('premium-grant-role-check');
    createdUserIds.push(user.id);

    const anon = getAnonClient();
    const anonResult = await anon.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
    expect(anonResult.error).not.toBeNull();

    const authedResult = await user.client.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
    expect(authedResult.error).not.toBeNull();

    const adminResult = await admin.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
    expect(adminResult.error).toBeNull();
    expect(adminResult.data.granted).toBe(true);
  });
});
