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
      { status: 'idle', isFounder: false, founderRank: null, message: '' },
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
