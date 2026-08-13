// Phase 1 plan 01-03 — deny-all RLS proof (table + all five RPCs, anon AND
// authenticated) and the normalized-dedupe proof.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cleanupTestUsers, createTestUser, getAdminClient, getAnonClient, type TestUser } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec writes waitlist rows, so it must never
// run there. See waitlist-config-rpc.spec.ts (backend/api) for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

const PREFIX = `dedupe-${randomUUID().slice(0, 8)}-`;

describe.skipIf(!RUN_DB)('waitlist_signups + waitlist RPCs (20260812_waitlist_founder_offer.sql)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  let anon: ReturnType<typeof getAnonClient>;
  let rlsUser: TestUser;
  const createdEmails: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    admin = getAdminClient();
    anon = getAnonClient();

    // Preflight: fail loudly by name if the migration hasn't been applied, rather
    // than letting a missing table/function masquerade as a passing deny-all.
    const { error: tableError } = await admin.from('waitlist_signups').select('id').limit(1);
    if (tableError) {
      throw new Error(
        `waitlist_signups is not queryable (${tableError.message}) — ` +
        `supabase/migrations/20260812_waitlist_founder_offer.sql has not been applied to this project.`
      );
    }
    const { error: fnError } = await admin.rpc('normalize_waitlist_email', { p_email: 'preflight@example.com' });
    if (fnError) {
      throw new Error(
        `normalize_waitlist_email is not callable (${fnError.message}) — ` +
        `supabase/migrations/20260812_waitlist_founder_offer.sql has not been applied to this project.`
      );
    }

    rlsUser = await createTestUser('waitlist-rls');
    createdUserIds.push(rlsUser.id);
  });

  afterAll(async () => {
    if (createdEmails.length) {
      await admin.from('waitlist_signups').delete().in('email', createdEmails);
    }
    await admin.from('waitlist_signups').delete().like('email', `${PREFIX}%`);
    if (createdUserIds.length) await cleanupTestUsers(createdUserIds);
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 700000 });
  });

  describe('deny-all RLS — anon (DATA-05, T-01-16, T-01-17)', () => {
    it('SELECT returns no error and an empty array (RLS filters silently)', async () => {
      const { data, error } = await anon.from('waitlist_signups').select('*');
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('INSERT errors', async () => {
      const { error } = await anon.from('waitlist_signups').insert({
        email: 'x@example.com', email_normalized: 'x@example.com', audience: 'athlete',
      });
      expect(error).not.toBeNull();
    });

    it('UPDATE matches and affects zero rows (RLS filters the target set silently, not an error)', async () => {
      // Confirmed live via direct SQL: with RLS enabled and zero policies, UPDATE's
      // implicit USING clause filters the target set to nothing before WITH CHECK is
      // ever evaluated, so this is a silent no-op — unlike INSERT, which has no
      // existing rows to filter against and therefore throws. .select() surfaces the
      // filtered (empty) result set.
      const { data, error } = await anon.from('waitlist_signups').update({ audience: 'coach' }).eq('audience', 'athlete').select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('DELETE matches and affects zero rows (same silent RLS filter as UPDATE)', async () => {
      const { data, error } = await anon.from('waitlist_signups').delete().eq('audience', 'athlete').select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('deny-all RLS — authenticated (DATA-05, T-01-16, T-01-17)', () => {
    it('SELECT returns no error and an empty array (deny-all is not logged-out-only)', async () => {
      const { data, error } = await rlsUser.client.from('waitlist_signups').select('*');
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('INSERT errors', async () => {
      const { error } = await rlsUser.client.from('waitlist_signups').insert({
        email: 'y@example.com', email_normalized: 'y@example.com', audience: 'athlete',
      });
      expect(error).not.toBeNull();
    });

    it('UPDATE matches and affects zero rows (same silent RLS filter as anon)', async () => {
      const { data, error } = await rlsUser.client.from('waitlist_signups').update({ audience: 'coach' }).eq('audience', 'athlete').select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('DELETE matches and affects zero rows (same silent RLS filter as anon)', async () => {
      const { data, error } = await rlsUser.client.from('waitlist_signups').delete().eq('audience', 'athlete').select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('RPC privilege — all five functions reject the anon key (DATA-06, T-01-18)', () => {
    it('claim_waitlist_signup errors for anon', async () => {
      const { error } = await anon.rpc('claim_waitlist_signup', { p_email: 'z@example.com', p_audience: 'athlete' });
      expect(error).not.toBeNull();
    });

    it('normalize_waitlist_email errors for anon', async () => {
      const { error } = await anon.rpc('normalize_waitlist_email', { p_email: 'z@example.com' });
      expect(error).not.toBeNull();
    });

    it('get_waitlist_founder_status errors for anon', async () => {
      const { error } = await anon.rpc('get_waitlist_founder_status');
      expect(error).not.toBeNull();
    });

    it('anonymize_waitlist_signup errors for anon', async () => {
      const { error } = await anon.rpc('anonymize_waitlist_signup', { p_email: 'z@example.com' });
      expect(error).not.toBeNull();
    });

    it('reset_waitlist_founder_sequence errors for anon', async () => {
      const { error } = await anon.rpc('reset_waitlist_founder_sequence', { p_next_value: 1 });
      expect(error).not.toBeNull();
    });

    it('the service-role client CAN execute claim_waitlist_signup and read the row back (denials above are privilege, not breakage)', async () => {
      const email = `${PREFIX}preflight-${randomUUID()}@example.com`;
      createdEmails.push(email);
      const { data, error } = await admin.rpc('claim_waitlist_signup', { p_email: email, p_audience: 'athlete' });
      expect(error).toBeNull();
      const row = Array.isArray(data) ? data[0] : data;
      expect(row.is_new).toBe(true);

      const { data: stored } = await admin.from('waitlist_signups').select('*').eq('email', email.toLowerCase()).single();
      expect(stored).not.toBeNull();
    });
  });

  describe('claim_waitlist_signup — normalized dedupe (DATA-04, D-10, T-01-19, T-01-20)', () => {
    it('Gmail case + sub-addressing + dots collapse to one row and do not burn a second founder rank', async () => {
      await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 900500 });
      const suffix = randomUUID().split('-').join('');
      // The suffix MUST sit before the '+' — split_part(local, '+', 1) discards
      // everything from '+' onward, so anything placed after it (e.g. "+promo-<suffix>")
      // never survives normalization and cannot correlate the two addresses.
      const emailA = `${PREFIX}Dedupe.User${suffix}+promo@GMAIL.com`;
      const emailB = `${PREFIX}dedupeuser${suffix}@gmail.com`;
      const expectedNormalized = `${PREFIX}dedupeuser${suffix}@gmail.com`.toLowerCase();
      createdEmails.push(emailA, emailB);

      const first = await admin.rpc('claim_waitlist_signup', { p_email: emailA, p_audience: 'athlete' });
      const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
      expect(firstRow.is_new).toBe(true);

      const second = await admin.rpc('claim_waitlist_signup', { p_email: emailB, p_audience: 'athlete' });
      const secondRow = Array.isArray(second.data) ? second.data[0] : second.data;
      expect(secondRow.is_new).toBe(false);
      expect(secondRow.founder_rank).toBe(firstRow.founder_rank);

      const { data: rows } = await admin
        .from('waitlist_signups')
        .select('id')
        .eq('email_normalized', expectedNormalized);
      expect(rows).toHaveLength(1);

      // The duplicate must not have advanced the sequence: the next fresh signup
      // receives firstRow.founder_rank + 1, not +2.
      const nextEmail = `${PREFIX}seq-check-${suffix}@example.com`;
      createdEmails.push(nextEmail);
      const next = await admin.rpc('claim_waitlist_signup', { p_email: nextEmail, p_audience: 'athlete' });
      const nextRow = Array.isArray(next.data) ? next.data[0] : next.data;
      expect(nextRow.founder_rank).toBe(firstRow.founder_rank + 1);
    });

    it('a dot stays significant outside Gmail — two distinct Outlook rows', async () => {
      const suffix = randomUUID();
      const emailA = `${PREFIX}first.last-${suffix}@outlook.com`;
      const emailB = `${PREFIX}firstlast-${suffix}@outlook.com`;
      createdEmails.push(emailA, emailB);

      const first = await admin.rpc('claim_waitlist_signup', { p_email: emailA, p_audience: 'coach' });
      const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
      expect(firstRow.is_new).toBe(true);

      const second = await admin.rpc('claim_waitlist_signup', { p_email: emailB, p_audience: 'coach' });
      const secondRow = Array.isArray(second.data) ? second.data[0] : second.data;
      expect(secondRow.is_new).toBe(true);
      expect(secondRow.founder_rank).not.toBe(firstRow.founder_rank);
    });

    it('case and surrounding whitespace alone never create a second row', async () => {
      const suffix = randomUUID();
      const clean = `${PREFIX}case-${suffix}@example.com`;
      const messy = `  ${PREFIX}CASE-${suffix}@EXAMPLE.COM  `;
      createdEmails.push(clean);

      const first = await admin.rpc('claim_waitlist_signup', { p_email: messy, p_audience: 'athlete' });
      const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
      expect(firstRow.is_new).toBe(true);

      const second = await admin.rpc('claim_waitlist_signup', { p_email: clean, p_audience: 'athlete' });
      const secondRow = Array.isArray(second.data) ? second.data[0] : second.data;
      expect(secondRow.is_new).toBe(false);
    });
  });

  describe('normalization invariant + field completeness (D-12, DATA-01)', () => {
    it('every non-anonymized row created by this spec has email_normalized === normalize_waitlist_email(email)', async () => {
      const { data: rows } = await admin
        .from('waitlist_signups')
        .select('email, email_normalized')
        .is('anonymized_at', null)
        .like('email', `${PREFIX}%`)
        .limit(50);

      expect(rows && rows.length).toBeGreaterThan(0);
      for (const row of rows ?? []) {
        const { data: expected } = await admin.rpc('normalize_waitlist_email', { p_email: row.email });
        expect(row.email_normalized).toBe(expected);
      }
    });

    it('every row created through the RPC has non-null email, audience, created_at, founder_rank', async () => {
      const { data: rows } = await admin
        .from('waitlist_signups')
        .select('email, audience, created_at, founder_rank')
        .like('email', `${PREFIX}%`)
        .limit(50);

      expect(rows && rows.length).toBeGreaterThan(0);
      for (const row of rows ?? []) {
        expect(row.email).not.toBeNull();
        expect(row.audience).not.toBeNull();
        expect(row.created_at).not.toBeNull();
        expect(row.founder_rank).not.toBeNull();
      }
    });
  });
});
