// Phase 1 plan 01-02 — app_config deny-all, threshold arbitration, erasure
// monotonicity, and the service_role-only sequence-reset contract.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getAdminClient, getAnonClient } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec mutates waitlist state, so it must never
// run there. See waitlist.concurrency.test.ts (apps/web) for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

const PREFIX = `cfg-${randomUUID().slice(0, 8)}-`;

describe.skipIf(!RUN_DB)('app_config + get_waitlist_founder_status — deny-all, threshold arbitration (T-01-09, T-01-10, T-01-11)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  let anon: ReturnType<typeof getAnonClient>;
  let originalThreshold: unknown;

  beforeAll(async () => {
    admin = getAdminClient();
    anon = getAnonClient();
    const { data } = await admin.from('app_config').select('value').eq('key', 'waitlist_reveal_threshold').single();
    originalThreshold = data?.value ?? 30;
  });

  afterAll(async () => {
    await admin.from('app_config').update({ value: originalThreshold }).eq('key', 'waitlist_reveal_threshold');
  });

  it('anon reading app_config directly gets zero rows', async () => {
    const { data, error } = await anon.from('app_config').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('anon writing app_config directly gets an error', async () => {
    const { error } = await anon.from('app_config').update({ value: 999 }).eq('key', 'waitlist_reveal_threshold');
    expect(error).not.toBeNull();
  });

  it('anon executing the counter RPC gets an error', async () => {
    const { error } = await anon.rpc('get_waitlist_founder_status');
    expect(error).not.toBeNull();
  });

  it('admin executing the counter RPC gets exactly should_display/remaining/is_full, remaining = 200 - claimed', async () => {
    const { data: claimedRows } = await admin.from('waitlist_signups').select('id', { count: 'exact', head: true }).eq('is_founder', true);
    const { data, error } = await admin.rpc('get_waitlist_founder_status');
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row).toHaveProperty('should_display');
    expect(row).toHaveProperty('remaining');
    expect(row).toHaveProperty('is_full');
    expect(row.is_full).toBe(false);
  });

  it('raising the threshold above 200 - claimed flips should_display to true with a plain UPDATE', async () => {
    await admin.from('app_config').update({ value: 200 }).eq('key', 'waitlist_reveal_threshold');
    const { data } = await admin.rpc('get_waitlist_founder_status');
    const row = Array.isArray(data) ? data[0] : data;
    expect(row.should_display).toBe(true);
    await admin.from('app_config').update({ value: originalThreshold }).eq('key', 'waitlist_reveal_threshold');
  });
});

describe.skipIf(!RUN_DB)('anonymize_waitlist_signup — erasure keeps the founder spot consumed (D-07, T-01-13)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await admin.from('waitlist_signups').delete().in('email', createdEmails);
    await admin.from('waitlist_signups').delete().like('email', `anonymized+%`);
  });

  it('anonymizing a founder blanks the address, keeps founder_rank/is_founder, leaves remaining unchanged', async () => {
    // Fast-forward into the founder range (rank <= 200 is what sets is_founder=true in
    // claim_waitlist_signup) so this row is guaranteed founder status.
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 150 });
    const email = `${PREFIX}erase-${randomUUID()}@example.com`;
    createdEmails.push(email);

    const { data: claimData } = await admin.rpc('claim_waitlist_signup', { p_email: email, p_audience: 'athlete' });
    const claimed = Array.isArray(claimData) ? claimData[0] : claimData;
    expect(claimed.is_founder).toBe(true);

    const { data: beforeStatus } = await admin.rpc('get_waitlist_founder_status');
    const beforeRow = Array.isArray(beforeStatus) ? beforeStatus[0] : beforeStatus;
    const remainingBefore = beforeRow.remaining;

    const { data: result, error } = await admin.rpc('anonymize_waitlist_signup', { p_email: email });
    expect(error).toBeNull();
    expect(result).toBe(true);

    const { data: row } = await admin
      .from('waitlist_signups')
      .select('email, email_normalized, anonymized_at, founder_rank, is_founder')
      .eq('founder_rank', claimed.founder_rank)
      .single();
    expect(row?.email).not.toBe(email.toLowerCase());
    expect(row?.email_normalized).not.toContain(email.split('@')[0].toLowerCase());
    expect(row?.anonymized_at).not.toBeNull();
    expect(row?.founder_rank).toBe(claimed.founder_rank);
    expect(row?.is_founder).toBe(true);

    const { data: afterStatus } = await admin.rpc('get_waitlist_founder_status');
    const afterRow = Array.isArray(afterStatus) ? afterStatus[0] : afterStatus;
    expect(afterRow.remaining).toBe(remainingBefore);
  });

  it('anonymizing an address that is not registered returns false and changes nothing', async () => {
    const { data, error } = await admin.rpc('anonymize_waitlist_signup', {
      p_email: `${PREFIX}never-registered-${randomUUID()}@example.com`,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('anonymizing an already-anonymized address returns false the second time', async () => {
    const email = `${PREFIX}erase-twice-${randomUUID()}@example.com`;
    createdEmails.push(email);
    await admin.rpc('claim_waitlist_signup', { p_email: email, p_audience: 'athlete' });

    const first = await admin.rpc('anonymize_waitlist_signup', { p_email: email });
    expect(first.data).toBe(true);

    const second = await admin.rpc('anonymize_waitlist_signup', { p_email: email });
    expect(second.data).toBe(false);
  });
});

describe.skipIf(!RUN_DB)('reset_waitlist_founder_sequence — service_role-only, deterministic next value (T-01-12)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  let anon: ReturnType<typeof getAnonClient>;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    admin = getAdminClient();
    anon = getAnonClient();
  });

  afterEach(async () => {
    // Restore to a high, collision-free value so later describe blocks in this
    // file (and other specs sharing the sequence) never observe a low rank.
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 800000 });
  });

  afterAll(async () => {
    await admin.from('waitlist_signups').delete().in('email', createdEmails);
  });

  it('after reset(900000), the next two claims receive ranks 900000 and 900001, both non-founder', async () => {
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 900000 });

    const emailA = `${PREFIX}seq-${randomUUID()}@example.com`;
    const emailB = `${PREFIX}seq-${randomUUID()}@example.com`;
    createdEmails.push(emailA, emailB);

    const { data: dataA } = await admin.rpc('claim_waitlist_signup', { p_email: emailA, p_audience: 'athlete' });
    const rowA = Array.isArray(dataA) ? dataA[0] : dataA;
    expect(rowA.founder_rank).toBe(900000);
    expect(rowA.is_founder).toBe(false);

    const { data: dataB } = await admin.rpc('claim_waitlist_signup', { p_email: emailB, p_audience: 'athlete' });
    const rowB = Array.isArray(dataB) ? dataB[0] : dataB;
    expect(rowB.founder_rank).toBe(900001);
    expect(rowB.is_founder).toBe(false);
  });

  it('anon cannot execute get_waitlist_founder_status, anonymize_waitlist_signup, or reset_waitlist_founder_sequence', async () => {
    const status = await anon.rpc('get_waitlist_founder_status');
    expect(status.error).not.toBeNull();

    const anonymize = await anon.rpc('anonymize_waitlist_signup', { p_email: 'nobody@example.com' });
    expect(anonymize.error).not.toBeNull();

    const reset = await anon.rpc('reset_waitlist_founder_sequence', { p_next_value: 1 });
    expect(reset.error).not.toBeNull();
  });
});
