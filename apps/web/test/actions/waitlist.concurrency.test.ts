// Phase 1 plan 01-01 Task 2 — end-to-end round-trip proof for claimWaitlistSpot.
// This harness is extended by plan 01-04 with the 200-cap race and non-disclosure tests.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// The service-role admin client module imports 'server-only', whose default export
// throws outside a React Server Component. Vitest hoists this mock above the static
// imports below, so claimWaitlistSpot can be imported directly in a plain Node process.
vi.mock('server-only', () => ({}));

const { claimWaitlistSpot } = await import('../../src/actions/waitlist');

// Load-bearing guard: the root CI `verify` job runs `npx turbo run test` with the
// *production* Supabase secrets, and backend/api's `test` script has no path
// restriction. A DB-mutating waitlist spec running there would consume real founder
// ranks and destroy the guarantee this phase ships. Every DB-touching describe below
// is skipped unless SUPABASE_TEST_URL is explicitly set and matches SUPABASE_URL.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

function getAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const RUN_ID = randomUUID().slice(0, 8);
const PREFIX = `tracer-${RUN_ID}-`;

describe.skipIf(!RUN_DB)('claimWaitlistSpot — one signup end to end (DATA-01, DATA-02, DATA-06, DATA-07)', () => {
  // getAdmin() calls createClient(), which throws synchronously when SUPABASE_URL is
  // unset. The describe callback body always runs during Vitest's collection phase —
  // even for a skipped suite — so admin creation MUST live inside beforeAll (deferred
  // to the run phase, which a skipped suite genuinely never enters), never inline here.
  let admin: ReturnType<typeof getAdmin>;

  beforeAll(async () => {
    admin = getAdmin();
    // Every waitlist spec cleans only its own prefix — never a shared wildcard —
    // so two specs can never delete each other's fixtures.
    await admin.from('waitlist_signups').delete().like('email', `${PREFIX}%`);
  });

  afterAll(async () => {
    await admin.from('waitlist_signups').delete().like('email', `${PREFIX}%`);
  });

  it('a never-seen email produces exactly one row whose stored founder_rank matches the returned rank', async () => {
    const email = `${PREFIX}${randomUUID()}@example.com`;
    const formData = new FormData();
    formData.set('email', email);
    formData.set('audience', 'athlete');

    const result = await claimWaitlistSpot(
      { status: 'idle', isFounder: false, founderRank: null, message: '', code: null },
      formData,
    );

    expect(result.status).toBe('success');
    expect(typeof result.founderRank).toBe('number');

    const { data, error } = await admin
      .from('waitlist_signups')
      .select('founder_rank, audience, created_at')
      .eq('email', email.toLowerCase())
      .single();

    expect(error).toBeNull();
    expect(data?.founder_rank).toBe(result.founderRank);
    expect(data?.audience).toBe('athlete');
    expect(data?.created_at).not.toBeNull();
  });

  it('normalize_waitlist_email collapses Gmail +suffix/dots and keeps Outlook dots significant', async () => {
    const { data: gmailA } = await admin.rpc('normalize_waitlist_email', {
      p_email: 'Test.User+promo@GMAIL.com',
    });
    const { data: gmailB } = await admin.rpc('normalize_waitlist_email', {
      p_email: 'testuser@gmail.com',
    });
    expect(gmailA).toBe(gmailB);

    const { data: outlookA } = await admin.rpc('normalize_waitlist_email', {
      p_email: 'first.last@outlook.com',
    });
    const { data: outlookB } = await admin.rpc('normalize_waitlist_email', {
      p_email: 'firstlast@outlook.com',
    });
    expect(outlookA).not.toBe(outlookB);
  });
});

describe.skipIf(!RUN_DB)('claimWaitlistSpot — 200-cap race and founder-status non-disclosure (DATA-02, DATA-03, DATA-07)', () => {
  let admin: ReturnType<typeof getAdmin>;
  const runId = randomUUID().slice(0, 8);
  const racePrefix = `race-${runId}-`;
  const founderPrefix = `founder-${runId}-`;

  beforeAll(async () => {
    admin = getAdmin();

    // Dirty-state guard: a leftover founder_rank in the band either block below
    // positions the sequence into would collide with the unique partial index and
    // produce a failure that reads like a concurrency bug when it is really stale
    // data left by an interrupted prior run.
    const { data: stale } = await admin
      .from('waitlist_signups')
      .select('founder_rank')
      .not('founder_rank', 'is', null)
      .gte('founder_rank', 140)
      .lte('founder_rank', 220);
    if (stale && stale.length > 0) {
      throw new Error(
        `Test project holds ${stale.length} stale founder_rank row(s) in the 140-220 band ` +
        `(ranks: ${stale.map((r) => r.founder_rank).join(', ')}). Clear waitlist_signups before running this suite.`
      );
    }

    await admin.from('waitlist_signups').delete().like('email', `${racePrefix}%`);
    await admin.from('waitlist_signups').delete().like('email', `${founderPrefix}%`);
  });

  afterAll(async () => {
    await admin.from('waitlist_signups').delete().like('email', `${racePrefix}%`);
    await admin.from('waitlist_signups').delete().like('email', `${founderPrefix}%`);
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 600000 });
  });

  it('twenty submissions racing the 200 boundary produce exactly five founders on ranks 196-200, and no rank is ever held twice', async () => {
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 196 });

    const forms = Array.from({ length: 20 }, (_, i) => {
      const fd = new FormData();
      fd.set('email', `${racePrefix}${i}@example.com`);
      fd.set('audience', 'athlete');
      return fd;
    });

    const results = await Promise.all(
      forms.map((fd) => claimWaitlistSpot({ status: 'idle', isFounder: false, founderRank: null, message: '', code: null }, fd)),
    );

    const foundersReported = results.filter((r) => r.isFounder).length;
    expect(foundersReported).toBe(5);

    const { data: rows } = await admin
      .from('waitlist_signups')
      .select('founder_rank, is_founder')
      .like('email', `${racePrefix}%`);
    expect(rows).toHaveLength(20);

    const founderRows = (rows ?? []).filter((r) => r.is_founder);
    expect(founderRows).toHaveLength(5);
    expect(new Set(founderRows.map((r) => r.founder_rank))).toEqual(new Set([196, 197, 198, 199, 200]));

    const nonFounderRows = (rows ?? []).filter((r) => !r.is_founder);
    expect(nonFounderRows).toHaveLength(15);
    for (const row of nonFounderRows) {
      expect(row.founder_rank).not.toBeNull();
    }

    // Whole-table uniqueness — not only across this raced batch. No generic
    // SQL-execution RPC exists in this codebase, so uniqueness is checked here
    // by comparing array length against a Set built from the same values.
    const { data: allRanks } = await admin
      .from('waitlist_signups')
      .select('founder_rank')
      .not('founder_rank', 'is', null);
    const rankValues = (allRanks ?? []).map((r) => r.founder_rank);
    expect(new Set(rankValues).size).toBe(rankValues.length);
  });

  it('re-submitting a known founder address returns the same neutral response as a brand-new non-founder signup', async () => {
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 150 });
    const founderEmail = `${founderPrefix}known@example.com`;

    const seed = await admin.rpc('claim_waitlist_signup', { p_email: founderEmail, p_audience: 'athlete' });
    const seedRow = Array.isArray(seed.data) ? seed.data[0] : seed.data;
    expect(seedRow.is_founder).toBe(true);

    const { data: beforeRow } = await admin
      .from('waitlist_signups')
      .select('is_founder')
      .eq('email', founderEmail.toLowerCase())
      .single();
    expect(beforeRow?.is_founder).toBe(true);

    const dupFormData = new FormData();
    dupFormData.set('email', founderEmail);
    dupFormData.set('audience', 'athlete');
    const dupResult = await claimWaitlistSpot({ status: 'idle', isFounder: false, founderRank: null, message: '', code: null }, dupFormData);

    expect(dupResult.status).toBe('success');
    expect(dupResult.isFounder).toBe(false);
    expect(dupResult.founderRank).toBeNull();

    // A brand-new, genuinely non-founder signup must produce a field-identical
    // response — that identity is the whole requirement (no field distinguishes
    // "already registered founder" from "just joined, not a founder").
    await admin.rpc('reset_waitlist_founder_sequence', { p_next_value: 600100 });
    const freshEmail = `${founderPrefix}fresh@example.com`;
    const freshFormData = new FormData();
    freshFormData.set('email', freshEmail);
    freshFormData.set('audience', 'athlete');
    const freshResult = await claimWaitlistSpot({ status: 'idle', isFounder: false, founderRank: null, message: '', code: null }, freshFormData);

    expect(freshResult).toEqual(dupResult);

    // The database still knows the truth — only the Server Action's response was
    // filtered, proving the filter is at the trust boundary and not a data loss.
    const { data: afterRow } = await admin
      .from('waitlist_signups')
      .select('is_founder')
      .eq('email', founderEmail.toLowerCase())
      .single();
    expect(afterRow?.is_founder).toBe(true);
  });
});
