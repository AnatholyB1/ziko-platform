// Phase 42 plan 03 (v1.18, decision-system-foundation) — FOUND-01, FOUND-03,
// FOUND-04 coverage for public.athlete_state.
// Migrations under test:
//   supabase/migrations/20260831120000_athlete_state.sql (table + SELECT-only RLS)
//   supabase/migrations/20260831120200_athlete_decisions_rpc.sql
//     (public.record_athlete_decision() RPC + GRANT/REVOKE lockdown)
// Follows the house shape from premium-grant-rpc.spec.ts verbatim: same
// RUN_DB guard, same getAdminClient/getAnonClient/createTestUser/
// cleanupTestUsers fixtures, same skipIf(!RUN_DB) guard on the describe block.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec creates users and mutates
// athlete_state via the RPC, so it must never run there. See
// premium-grant-rpc.spec.ts for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('athlete_state — RLS reads, write lockdown, RPC role matrix (FOUND-01, FOUND-03, FOUND-04)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  /**
   * The only available seeding path once direct writes are revoked (see
   * <seeding_constraint> in 42-03-PLAN.md) — admin.from('athlete_state')
   * .insert(...) is REVOKEd by 20260831120200_athlete_decisions_rpc.sql.
   * decision_type 'onboarding_profile' + p_week_of null keeps every seed
   * call outside the weekly_focus idempotency index entirely.
   */
  async function seedState(userId: string, statePatch: Record<string, unknown> = {}) {
    return admin.rpc('record_athlete_decision', {
      p_user_id: userId,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'seed for athlete-state.spec',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-state.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: statePatch,
    });
  }

  it('athlete reads own athlete_state row after seeding, with schema-default readiness/level (D-01/D-02, FOUND-01, reads own)', async () => {
    const a = await createTestUser('athlete-state-own-read');
    createdUserIds.push(a.id);

    const seed = await seedState(a.id, {});
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);

    const { data, error } = await a.client
      .from('athlete_state')
      .select('user_id, level, readiness')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].readiness).toBe('fragile');
    expect(data?.[0].level).toBe(1);
  });

  it('cross-read: athlete A selects athlete B\'s athlete_state row → RLS silently filters, 0 rows (FOUND-04)', async () => {
    const a = await createTestUser('athlete-state-cross-a');
    const b = await createTestUser('athlete-state-cross-b');
    createdUserIds.push(a.id, b.id);

    await seedState(a.id, {});
    await seedState(b.id, {});

    const { data, error } = await a.client
      .from('athlete_state')
      .select('user_id')
      .eq('user_id', b.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('authenticated client cannot UPDATE athlete_state directly (FOUND-03)', async () => {
    const a = await createTestUser('athlete-state-authed-write');
    createdUserIds.push(a.id);
    await seedState(a.id, {});

    const result = await a.client.from('athlete_state').update({ level: 99 }).eq('user_id', a.id);
    expect(result.error).not.toBeNull();
  });

  it('service-role (admin) client also cannot UPDATE athlete_state directly (D-06, FOUND-03, the load-bearing case — cannot UPDATE)', async () => {
    const a = await createTestUser('athlete-state-admin-update');
    createdUserIds.push(a.id);
    await seedState(a.id, {});

    const result = await admin.from('athlete_state').update({ level: 99 }).eq('user_id', a.id);
    expect(result.error).not.toBeNull();
  });

  it('service-role (admin) client also cannot INSERT athlete_state directly (D-06, FOUND-03)', async () => {
    // A random UUID, not a real test user — the privilege check fails before
    // the FK to auth.users is ever reached, so no test user needs cleanup.
    const freshUserId = randomUUID();

    const result = await admin.from('athlete_state').insert({ user_id: freshUserId });
    expect(result.error).not.toBeNull();
  });

  it('RPC role matrix: anon and authenticated are denied EXECUTE, admin succeeds (D-06, FOUND-03)', async () => {
    const a = await createTestUser('athlete-state-rpc-matrix');
    createdUserIds.push(a.id);

    const anon = getAnonClient();
    const anonResult = await anon.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'anon attempt',
      p_rationale: null,
      p_evidence: { attempt: 'anon' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(anonResult.error).not.toBeNull();

    const authedResult = await a.client.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'authenticated attempt',
      p_rationale: null,
      p_evidence: { attempt: 'authenticated' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(authedResult.error).not.toBeNull();

    const adminResult = await seedState(a.id, {});
    expect(adminResult.error).toBeNull();
    expect(adminResult.data.success).toBe(true);
  });

  it('RPC still works after the REVOKEs — SECURITY DEFINER owner smoke test (D-06, FOUND-03, FOUND-04)', async () => {
    const a = await createTestUser('athlete-state-owner-smoke');
    createdUserIds.push(a.id);

    const rpcResult = await seedState(a.id, { level: 3, readiness: 'building', tier: 2, points: 50 });
    expect(rpcResult.error).toBeNull();
    expect(rpcResult.data.success).toBe(true);

    const { data, error } = await a.client
      .from('athlete_state')
      .select('level, readiness, tier, points')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.[0].level).toBe(3);
    expect(data?.[0].readiness).toBe('building');
    expect(data?.[0].tier).toBe(2);
    expect(data?.[0].points).toBe(50);
  });

  it('self-heal: the first RPC call for a brand-new user creates the athlete_state row (FOUND-01, reads own)', async () => {
    const a = await createTestUser('athlete-state-self-heal');
    createdUserIds.push(a.id);

    const before = await admin.from('athlete_state').select('user_id').eq('user_id', a.id);
    expect(before.error).toBeNull();
    expect(before.data?.length ?? 0).toBe(0);

    const seed = await seedState(a.id, {});
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);

    const { data, error } = await a.client.from('athlete_state').select('user_id').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it('ratchet: points/tier never decrease across two RPC calls, level is exempt and can de-escalate (REWARD-04, ENGINE-03)', async () => {
    const a = await createTestUser('athlete-state-ratchet');
    createdUserIds.push(a.id);

    const first = await seedState(a.id, { level: 3, readiness: 'building', tier: 2, points: 50 });
    expect(first.error).toBeNull();
    expect(first.data.success).toBe(true);

    const second = await seedState(a.id, { points: 10, tier: 1, level: 2 });
    expect(second.error).toBeNull();
    expect(second.data.success).toBe(true);

    const { data, error } = await a.client
      .from('athlete_state')
      .select('level, tier, points')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.[0].points).toBe(50);
    expect(data?.[0].tier).toBe(2);
    expect(data?.[0].level).toBe(2);
  });

  it('weekly idempotency: a second weekly_focus RPC call for the same user and week returns duplicate and does not re-apply the state patch (ENGINE-04)', async () => {
    const a = await createTestUser('athlete-state-idempotency');
    createdUserIds.push(a.id);

    const weekOf = '2026-09-07';

    const first = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'weekly_focus',
      p_week_of: weekOf,
      p_summary: 'week 1 focus',
      p_rationale: 'first call',
      p_evidence: { workouts_completed: 3 },
      p_outcome: {},
      p_source: 'weekly_review_cron',
      p_state_patch: { level: 5, points: 100, tier: 3 },
    });
    expect(first.error).toBeNull();
    expect(first.data.success).toBe(true);

    const second = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'weekly_focus',
      p_week_of: weekOf,
      p_summary: 'week 1 focus retry',
      p_rationale: 'second call — should be a no-op duplicate',
      p_evidence: { workouts_completed: 3 },
      p_outcome: {},
      p_source: 'weekly_review_cron',
      p_state_patch: { level: 1, points: 0, tier: 1 },
    });
    expect(second.error).toBeNull();
    expect(second.data.success).toBe(false);
    expect(second.data.error).toBe('duplicate');

    const { data, error } = await admin
      .from('athlete_state')
      .select('level, points, tier')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    // The second call's patch (level:1, points:0, tier:1) must NOT have been
    // applied — the first call's values (level:5, points:100, tier:3) stand.
    expect(data?.[0].level).toBe(5);
    expect(data?.[0].points).toBe(100);
    expect(data?.[0].tier).toBe(3);
  });
});
