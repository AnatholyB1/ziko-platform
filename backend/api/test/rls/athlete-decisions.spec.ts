// Phase 42 plan 03 (v1.18, decision-system-foundation) — FOUND-02 coverage
// for public.athlete_decisions.
// Migrations under test:
//   supabase/migrations/20260831120100_athlete_decisions.sql
//     (append-only journal table + SELECT-only RLS)
//   supabase/migrations/20260831120200_athlete_decisions_rpc.sql
//     (public.record_athlete_decision() RPC + GRANT/REVOKE lockdown)
// Follows the house shape from premium-grant-rpc.spec.ts verbatim: same
// RUN_DB guard, same getAdminClient/getAnonClient/createTestUser/
// cleanupTestUsers fixtures, same skipIf(!RUN_DB) guard on the describe block.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec creates users and writes
// athlete_decisions journal rows via the RPC, so it must never run there.
// See premium-grant-rpc.spec.ts for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('athlete_decisions — evidence contract, append-only immutability (FOUND-02)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  it('evidence required: a null p_evidence returns evidence_required and writes no journal row', async () => {
    const a = await createTestUser('athlete-decisions-evidence-null');
    createdUserIds.push(a.id);

    const { data, error } = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'no evidence',
      p_rationale: null,
      p_evidence: null,
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(error).toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toBe('evidence_required');

    const { data: rows, error: selectError } = await admin
      .from('ziko_athlete_decisions')
      .select('id')
      .eq('user_id', a.id);
    expect(selectError).toBeNull();
    expect(rows?.length ?? 0).toBe(0);
  });

  it('evidence must be an object: a JSON array for p_evidence also returns evidence_required', async () => {
    const a = await createTestUser('athlete-decisions-evidence-array');
    createdUserIds.push(a.id);

    const { data, error } = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'array evidence',
      p_rationale: null,
      p_evidence: [],
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(error).toBeNull();
    expect(data.error).toBe('evidence_required');

    const { data: rows, error: selectError } = await admin
      .from('ziko_athlete_decisions')
      .select('id')
      .eq('user_id', a.id);
    expect(selectError).toBeNull();
    expect(rows?.length ?? 0).toBe(0);
  });

  it('happy path: a populated p_evidence object round-trips the summary/rationale/evidence into a single journal row', async () => {
    const a = await createTestUser('athlete-decisions-happy-path');
    createdUserIds.push(a.id);

    const evidence = { workouts_completed: 4, habits_logged: 12 };
    const { data, error } = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'onboarding decision summary',
      p_rationale: 'onboarding decision rationale',
      p_evidence: evidence,
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(typeof data.decision_id).toBe('string');
    expect(data.decision_id.length).toBeGreaterThan(0);

    const { data: rows, error: selectError } = await admin
      .from('ziko_athlete_decisions')
      .select('id, summary, rationale, evidence')
      .eq('user_id', a.id);
    expect(selectError).toBeNull();
    expect(rows?.length).toBe(1);
    expect(rows?.[0].summary).toBe('onboarding decision summary');
    expect(rows?.[0].rationale).toBe('onboarding decision rationale');
    expect(rows?.[0].evidence).toEqual(evidence);
  });

  it('own-read: the athlete\'s own client reads their journal rows', async () => {
    const a = await createTestUser('athlete-decisions-own-read');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'own read seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);

    const { data, error } = await a.client.from('ziko_athlete_decisions').select('id').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });

  it('cross-read denied: athlete B reads athlete A\'s journal → RLS silently filters, 0 rows', async () => {
    const a = await createTestUser('athlete-decisions-cross-a');
    const b = await createTestUser('athlete-decisions-cross-b');
    createdUserIds.push(a.id, b.id);

    const seed = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'cross-read seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();

    const { data, error } = await b.client.from('ziko_athlete_decisions').select('id').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('direct INSERT is blocked for the admin client — proves the table-level REVOKE that makes the journal append-only-through-the-RPC', async () => {
    const a = await createTestUser('athlete-decisions-admin-insert');
    createdUserIds.push(a.id);

    const result = await admin.from('ziko_athlete_decisions').insert({
      user_id: a.id,
      decision_type: 'onboarding_profile',
      summary: 'direct insert attempt',
      evidence: { attempt: 'direct-admin-insert' },
    });
    expect(result.error).not.toBeNull();
  });

  it('direct UPDATE is blocked for the admin client — immutability of a genuinely existing row', async () => {
    const a = await createTestUser('athlete-decisions-admin-update');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'update-target seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    const decisionId = seed.data.decision_id as string;
    expect(decisionId.length).toBeGreaterThan(0);

    const result = await admin.from('ziko_athlete_decisions').update({ summary: 'tampered' }).eq('id', decisionId);
    expect(result.error).not.toBeNull();
  });

  it('direct DELETE is blocked for the admin client — append-only, no client of any kind can remove a row', async () => {
    const a = await createTestUser('athlete-decisions-admin-delete');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'delete-target seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    const decisionId = seed.data.decision_id as string;

    const result = await admin.from('ziko_athlete_decisions').delete().eq('id', decisionId);
    expect(result.error).not.toBeNull();
  });

  it('authenticated client INSERT/UPDATE/DELETE on athlete_decisions are all blocked', async () => {
    const a = await createTestUser('athlete-decisions-authed-writes');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'authenticated-write-block seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    const decisionId = seed.data.decision_id as string;

    const insertResult = await a.client.from('ziko_athlete_decisions').insert({
      user_id: a.id,
      decision_type: 'onboarding_profile',
      summary: 'authenticated insert attempt',
      evidence: { attempt: 'authenticated-insert' },
    });
    expect(insertResult.error).not.toBeNull();

    const updateResult = await a.client.from('ziko_athlete_decisions').update({ summary: 'pwned' }).eq('id', decisionId);
    expect(updateResult.error).not.toBeNull();

    const deleteResult = await a.client.from('ziko_athlete_decisions').delete().eq('id', decisionId);
    expect(deleteResult.error).not.toBeNull();
  });

  // Phase 44 plan 06 (v1.18, weekly-adaptive-decision-engine) — ENGINE-04.
  // Migrations under test:
  //   supabase/migrations/20260831120100_athlete_decisions.sql
  //     (idx_athlete_decisions_week_idempotency — the arbiter partial index)
  //   supabase/migrations/20260902100200_record_athlete_decision_v2.sql
  //     (the duplicate early-return path, before the goal insert and the
  //     athlete_state UPDATE)
  // Binding test name per 44-VALIDATION.md's ENGINE-04 filter: the
  // substring "weekly_focus idempotency" below is load-bearing.
  // Reuses this file's existing RUN_DB guard, admin client and
  // cleanupTestUsers afterAll — no second guard or afterAll introduced.
  describe('weekly_focus idempotency (ENGINE-04)', () => {
    it('first fire succeeds; second fire for the same user/type/week returns duplicate; exactly one row survives with the first call\'s summary; readiness is not re-applied', async () => {
      const a = await createTestUser('athlete-decisions-weekly-focus-dup');
      createdUserIds.push(a.id);

      const weekOf = '2026-09-14';

      const first = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'weekly_focus',
        p_week_of: weekOf,
        p_summary: 'week of 2026-09-14 focus — first call',
        p_rationale: 'first call rationale',
        p_evidence: { workouts_completed: 3 },
        p_outcome: {},
        p_source: 'weekly_review_cron',
        p_state_patch: { readiness: 'building' },
      });
      expect(first.error).toBeNull();
      expect(first.data.success).toBe(true);
      expect(typeof first.data.decision_id).toBe('string');
      expect(first.data.decision_id.length).toBeGreaterThan(0);

      const readinessAfterFirst = await admin
        .from('ziko_athlete_state')
        .select('readiness')
        .eq('user_id', a.id);
      expect(readinessAfterFirst.error).toBeNull();
      expect(readinessAfterFirst.data?.[0].readiness).toBe('building');

      const second = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'weekly_focus',
        p_week_of: weekOf,
        p_summary: 'week of 2026-09-14 focus — second call, should be rejected as duplicate',
        p_rationale: 'second call rationale — different from the first',
        p_evidence: { workouts_completed: 5 },
        p_outcome: {},
        p_source: 'weekly_review_cron',
        p_state_patch: { readiness: 'thriving' },
      });
      expect(second.error).toBeNull();
      expect(second.data.success).toBe(false);
      expect(second.data.error).toBe('duplicate');

      // The second call's state patch (readiness: 'thriving') must NOT have
      // been applied — the first call's early-return-preceding UPDATE stands.
      const readinessAfterSecond = await admin
        .from('ziko_athlete_state')
        .select('readiness')
        .eq('user_id', a.id);
      expect(readinessAfterSecond.error).toBeNull();
      expect(readinessAfterSecond.data?.[0].readiness).toBe('building');

      const rows = await admin
        .from('ziko_athlete_decisions')
        .select('id, summary')
        .eq('user_id', a.id)
        .eq('decision_type', 'weekly_focus')
        .eq('week_of', weekOf);
      expect(rows.error).toBeNull();
      expect(rows.data?.length).toBe(1);
      expect(rows.data?.[0].summary).toBe('week of 2026-09-14 focus — first call');
    });

    it('a different week_of for the same athlete inserts a second weekly_focus row — the arbiter is per week, not per athlete', async () => {
      const a = await createTestUser('athlete-decisions-weekly-focus-next-week');
      createdUserIds.push(a.id);

      const weekOne = '2026-09-14';
      const weekTwo = '2026-09-21';

      const firstWeek = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'weekly_focus',
        p_week_of: weekOne,
        p_summary: 'week 1 focus',
        p_rationale: null,
        p_evidence: { workouts_completed: 3 },
        p_outcome: {},
        p_source: 'weekly_review_cron',
        p_state_patch: {},
      });
      expect(firstWeek.error).toBeNull();
      expect(firstWeek.data.success).toBe(true);

      const secondWeek = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'weekly_focus',
        p_week_of: weekTwo,
        p_summary: 'week 2 focus',
        p_rationale: null,
        p_evidence: { workouts_completed: 4 },
        p_outcome: {},
        p_source: 'weekly_review_cron',
        p_state_patch: {},
      });
      expect(secondWeek.error).toBeNull();
      expect(secondWeek.data.success).toBe(true);

      const rows = await admin
        .from('ziko_athlete_decisions')
        .select('id, week_of')
        .eq('user_id', a.id)
        .eq('decision_type', 'weekly_focus');
      expect(rows.error).toBeNull();
      expect(rows.data?.length).toBe(2);
    });

    it('p_week_of: null with decision_type goal_created can be called repeatedly without conflict — the partial index excludes non-weekly_focus and null-week rows', async () => {
      const a = await createTestUser('athlete-decisions-goal-created-repeat');
      createdUserIds.push(a.id);

      const firstGoal = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'goal_created',
        p_week_of: null,
        p_summary: 'first goal_created decision',
        p_rationale: null,
        p_evidence: { seeded_by: 'weekly_focus idempotency spec' },
        p_outcome: {},
        p_source: 'onboarding_tool',
        p_state_patch: {},
      });
      expect(firstGoal.error).toBeNull();
      expect(firstGoal.data.success).toBe(true);

      const secondGoal = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'goal_created',
        p_week_of: null,
        p_summary: 'second goal_created decision — must not conflict with the first',
        p_rationale: null,
        p_evidence: { seeded_by: 'weekly_focus idempotency spec' },
        p_outcome: {},
        p_source: 'onboarding_tool',
        p_state_patch: {},
      });
      expect(secondGoal.error).toBeNull();
      expect(secondGoal.data.success).toBe(true);
      expect(secondGoal.data.decision_id).not.toBe(firstGoal.data.decision_id);

      const rows = await admin
        .from('ziko_athlete_decisions')
        .select('id')
        .eq('user_id', a.id)
        .eq('decision_type', 'goal_created');
      expect(rows.error).toBeNull();
      expect(rows.data?.length).toBe(2);
    });

    it('next_review_due_at advances on weekly_focus and onboarding_profile decisions, but not on goal_created or program_created', async () => {
      const a = await createTestUser('athlete-decisions-next-review-due-at');
      createdUserIds.push(a.id);

      const goalCreated = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'goal_created',
        p_week_of: null,
        p_summary: 'goal_created — must not stamp next_review_due_at',
        p_rationale: null,
        p_evidence: { seeded_by: 'next_review_due_at spec' },
        p_outcome: {},
        p_source: 'onboarding_tool',
        p_state_patch: {},
      });
      expect(goalCreated.error).toBeNull();
      expect(goalCreated.data.success).toBe(true);

      const afterGoalCreated = await admin
        .from('ziko_athlete_state')
        .select('next_review_due_at')
        .eq('user_id', a.id);
      expect(afterGoalCreated.error).toBeNull();
      expect(afterGoalCreated.data?.[0].next_review_due_at).toBeNull();

      const programCreated = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'program_created',
        p_week_of: null,
        p_summary: 'program_created — must not stamp next_review_due_at',
        p_rationale: null,
        p_evidence: { seeded_by: 'next_review_due_at spec' },
        p_outcome: {},
        p_source: 'onboarding_tool',
        p_state_patch: {},
      });
      expect(programCreated.error).toBeNull();
      expect(programCreated.data.success).toBe(true);

      const afterProgramCreated = await admin
        .from('ziko_athlete_state')
        .select('next_review_due_at')
        .eq('user_id', a.id);
      expect(afterProgramCreated.error).toBeNull();
      expect(afterProgramCreated.data?.[0].next_review_due_at).toBeNull();

      const onboardingProfile = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'onboarding_profile',
        p_week_of: null,
        p_summary: 'onboarding_profile — must stamp next_review_due_at',
        p_rationale: null,
        p_evidence: { seeded_by: 'next_review_due_at spec' },
        p_outcome: {},
        p_source: 'onboarding_tool',
        p_state_patch: {},
      });
      expect(onboardingProfile.error).toBeNull();
      expect(onboardingProfile.data.success).toBe(true);

      const afterOnboardingProfile = await admin
        .from('ziko_athlete_state')
        .select('next_review_due_at')
        .eq('user_id', a.id);
      expect(afterOnboardingProfile.error).toBeNull();
      const dueAtAfterOnboarding = afterOnboardingProfile.data?.[0].next_review_due_at;
      expect(dueAtAfterOnboarding).not.toBeNull();

      const weeklyFocus = await admin.rpc('ziko_record_athlete_decision', {
        p_user_id: a.id,
        p_decision_type: 'weekly_focus',
        p_week_of: '2026-09-28',
        p_summary: 'weekly_focus — must stamp next_review_due_at',
        p_rationale: null,
        p_evidence: { seeded_by: 'next_review_due_at spec' },
        p_outcome: {},
        p_source: 'weekly_review_cron',
        p_state_patch: {},
      });
      expect(weeklyFocus.error).toBeNull();
      expect(weeklyFocus.data.success).toBe(true);

      const afterWeeklyFocus = await admin
        .from('ziko_athlete_state')
        .select('next_review_due_at')
        .eq('user_id', a.id);
      expect(afterWeeklyFocus.error).toBeNull();
      expect(afterWeeklyFocus.data?.[0].next_review_due_at).not.toBeNull();
    });
  });
});
