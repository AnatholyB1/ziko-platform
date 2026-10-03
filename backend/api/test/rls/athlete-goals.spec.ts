// Phase 44 plan 06 (v1.18, weekly-adaptive-decision-engine) — ENGINE-06, D-09
// coverage for public.athlete_goals.
// Migrations under test:
//   supabase/migrations/20260902100000_athlete_goals.sql
//     (dedicated table, SELECT-only RLS, three-role write REVOKE in the
//     same migration)
//   supabase/migrations/20260902100200_record_athlete_decision_v2.sql
//     (the only write path — public.record_athlete_decision()'s p_new_goal
//     parameter, atomic goal_id link into athlete_state.current_focus_detail)
// Follows the house shape from test/rls/athlete-state.spec.ts verbatim: same
// RUN_DB guard, same getAdminClient/getAnonClient/createTestUser/
// cleanupTestUsers fixtures, same skipIf(!RUN_DB) guard on the describe
// block, same createdUserIds + afterAll cleanup pattern.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with
// the production Supabase secrets. This spec creates users and mutates
// athlete_goals via the RPC, so it must never run there. See
// athlete-state.spec.ts for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('athlete_goals — RLS reads, three-role write lockdown, RPC-only seeding (ENGINE-06, D-09)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  /**
   * The only available seeding path — direct admin.from('athlete_goals')
   * .insert(...) is REVOKEd for anon, authenticated AND service_role by
   * 20260902100000_athlete_goals.sql. p_decision_type 'goal_created' +
   * p_week_of null keeps every seed call outside the weekly_focus
   * idempotency index entirely (mirrors athlete-state.spec.ts's seedState).
   */
  async function seedGoal(userId: string, goalPatch: Record<string, unknown> = {}) {
    return admin.rpc('ziko_record_athlete_decision', {
      p_user_id: userId,
      p_decision_type: 'goal_created',
      p_week_of: null,
      p_summary: 'seed for athlete-goals.spec',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-goals.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
      p_new_goal: {
        goal_text: 'Lose 5kg in 12 weeks',
        target_metric: 'weight_kg',
        target_value: 5,
        target_date: '2026-12-01',
        status: 'active',
        ...goalPatch,
      },
    });
  }

  it('seeding through the RPC returns success and a non-null goal_id, and the admin select finds exactly one matching row', async () => {
    const a = await createTestUser('athlete-goals-seed-roundtrip');
    createdUserIds.push(a.id);

    const seed = await seedGoal(a.id);
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);
    expect(typeof seed.data.goal_id).toBe('string');
    expect(seed.data.goal_id.length).toBeGreaterThan(0);

    const { data, error } = await admin
      .from('ziko_athlete_goals')
      .select('id, goal_text, target_metric, target_value, target_date, status')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].id).toBe(seed.data.goal_id);
    expect(data?.[0].goal_text).toBe('Lose 5kg in 12 weeks');
    expect(data?.[0].target_metric).toBe('weight_kg');
    expect(data?.[0].target_value).toBe(5);
    expect(data?.[0].target_date).toBe('2026-12-01');
    expect(data?.[0].status).toBe('active');
  });

  it('atomic linkage (D-09): after the same RPC call, athlete_state.current_focus_detail.goal_id equals the returned goal_id', async () => {
    const a = await createTestUser('athlete-goals-atomic-link');
    createdUserIds.push(a.id);

    const seed = await seedGoal(a.id);
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);
    const goalId = seed.data.goal_id as string;
    expect(goalId.length).toBeGreaterThan(0);

    const { data, error } = await admin
      .from('ziko_athlete_state')
      .select('current_focus_detail')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].current_focus_detail?.goal_id).toBe(goalId);
  });

  it('read scoping: athlete A reads their own goal row, and the same client reading athlete B\'s goal row returns zero rows (RLS filters, not an error)', async () => {
    const a = await createTestUser('athlete-goals-read-scope-a');
    const b = await createTestUser('athlete-goals-read-scope-b');
    createdUserIds.push(a.id, b.id);

    const seedA = await seedGoal(a.id, { goal_text: 'Athlete A goal' });
    expect(seedA.error).toBeNull();
    expect(seedA.data.success).toBe(true);

    const seedB = await seedGoal(b.id, { goal_text: 'Athlete B goal' });
    expect(seedB.error).toBeNull();
    expect(seedB.data.success).toBe(true);

    const ownRead = await a.client.from('ziko_athlete_goals').select('id, goal_text').eq('user_id', a.id);
    expect(ownRead.error).toBeNull();
    expect(ownRead.data?.length).toBe(1);
    expect(ownRead.data?.[0].goal_text).toBe('Athlete A goal');

    const crossRead = await a.client.from('ziko_athlete_goals').select('id').eq('user_id', b.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data?.length ?? 0).toBe(0);
  });

  it('write lockdown, authenticated: an athlete\'s own client cannot insert, update or delete athlete_goals rows', async () => {
    const a = await createTestUser('athlete-goals-authed-writes');
    createdUserIds.push(a.id);

    const seed = await seedGoal(a.id);
    expect(seed.error).toBeNull();
    const goalId = seed.data.goal_id as string;

    const insertResult = await a.client.from('ziko_athlete_goals').insert({
      user_id: a.id,
      goal_text: 'authenticated insert attempt',
    });
    expect(insertResult.error).not.toBeNull();

    const updateResult = await a.client.from('ziko_athlete_goals').update({ goal_text: 'pwned' }).eq('id', goalId);
    expect(updateResult.error).not.toBeNull();

    const deleteResult = await a.client.from('ziko_athlete_goals').delete().eq('id', goalId);
    expect(deleteResult.error).not.toBeNull();
  });

  it('write lockdown, anon (unauthenticated): a client holding no session cannot insert, update or delete athlete_goals rows', async () => {
    const a = await createTestUser('athlete-goals-anon-writes');
    createdUserIds.push(a.id);

    const seed = await seedGoal(a.id);
    expect(seed.error).toBeNull();
    const goalId = seed.data.goal_id as string;

    const anon = getAnonClient();

    const insertResult = await anon.from('ziko_athlete_goals').insert({
      user_id: a.id,
      goal_text: 'anon insert attempt',
    });
    expect(insertResult.error).not.toBeNull();

    const updateResult = await anon.from('ziko_athlete_goals').update({ goal_text: 'pwned' }).eq('id', goalId);
    expect(updateResult.error).not.toBeNull();

    const deleteResult = await anon.from('ziko_athlete_goals').delete().eq('id', goalId);
    expect(deleteResult.error).not.toBeNull();
  });

  it('write lockdown, service_role: the admin client\'s direct insert into athlete_goals fails — the service key is not a backdoor around the grounded-decision RPC', async () => {
    const a = await createTestUser('athlete-goals-service-role-write');
    createdUserIds.push(a.id);

    const result = await admin.from('ziko_athlete_goals').insert({
      user_id: a.id,
      goal_text: 'service-role direct insert attempt',
    });
    expect(result.error).not.toBeNull();
  });

  it('status CHECK: an RPC call with p_new_goal.status \'bogus\' fails rather than persisting an out-of-enum value', async () => {
    const a = await createTestUser('athlete-goals-status-check');
    createdUserIds.push(a.id);

    const result = await seedGoal(a.id, { goal_text: 'bogus-status attempt', status: 'bogus' });
    expect(result.error).not.toBeNull();

    const { data, error } = await admin
      .from('ziko_athlete_goals')
      .select('id')
      .eq('user_id', a.id)
      .eq('goal_text', 'bogus-status attempt');
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });
});
