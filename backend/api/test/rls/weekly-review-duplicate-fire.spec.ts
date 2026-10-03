// Phase 44 plan 08 (v1.18, weekly-adaptive-decision-engine) — ENGINE-04
// end-to-end concurrent duplicate-fire simulation.
//
// Migrations under test (indirectly, via the full runWeeklyReview chain):
//   supabase/migrations/20260831120000_athlete_state.sql
//   supabase/migrations/20260831120100_athlete_decisions.sql
//   supabase/migrations/20260831120200_athlete_decisions_rpc.sql
//   supabase/migrations/20260902100200_record_athlete_decision_v2.sql
//
// Unlike every other spec in this phase, this is the only one that does not
// mock the database — only the model boundary is faked (the single mock
// declaration below). Everything from context.ts through the RPC and the
// arbiter partial index runs for real against the live test project. Lives
// under test/rls/ so it inherits vitest.config.ts's fileParallelism: false
// (this spec mutates auth.users and must stay serialized with every other
// RLS spec).
//
// Due-condition note (T-44-36): record_athlete_decision's
// `next_review_due_at = NOW() + INTERVAL '7 days'` stamp always runs
// server-side against Postgres's own clock, and there is no RPC-reachable
// state transition that writes a past-due next_review_due_at directly. This
// spec is explicitly forbidden from adding a migration or a test-only GRANT
// to work around that write lockdown, so it never touches athlete_state
// directly. Instead it fakes ONLY the Node-side Date global
// (`useFakeTimers({ toFake: ['Date'] })` + `setSystemTime`) so that
// apply.ts's runWeeklyReview due-check — which reads `Date()` client-side,
// never Postgres's NOW() — evaluates the real server-stamped
// next_review_due_at as already past. setTimeout/setInterval are
// deliberately left un-faked (`toFake: ['Date']` only) so the live Supabase
// network calls this spec depends on are never starved of real timers.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAdminClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with
// the production Supabase secrets. This spec creates users, writes
// athlete_decisions/athlete_state/ai_cost_log rows and exercises the real
// RPC, so it must never run there. See athlete-decisions.spec.ts for the
// same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

// ─── The one mock in this spec: the model boundary only ──────────────────
// generateObject is replaced with a scripted resolver; every other export
// of the 'ai' package (including jsonSchema, which decide.ts's own
// Anthropic-schema sanitizer calls) is the real implementation.
const mockGenerateObject = vi.fn();
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  };
});

import { runWeeklyReview } from '../../src/coaching-engine/apply.js';

// A fixed, scripted WeeklyDecisionResult — trajectory escalate, a
// new_readiness distinct from the schema default ('fragile') so case 5 can
// prove the state patch actually landed, and call_create_program: false so
// this spec never exercises the create_program side path (already covered
// by coaching-engine.spec.ts's ENGINE-06 block) and stays focused on the
// ENGINE-04 idempotency guarantee.
const SCRIPTED_DECISION = {
  trajectory: 'escalate' as const,
  new_readiness: 'building' as const,
  new_focus_summary: 'Duplicate-fire simulation focus summary.',
  rationale: 'Scripted rationale for the duplicate-fire simulation.',
  call_create_program: false,
  new_focus_detail: null,
};
// Non-zero on both sides — case 4 (ENGINE-05 cost attribution) asserts the
// ai_cost_log row carries these exact counts, not a defaulted zero.
const SCRIPTED_USAGE = { inputTokens: 421, outputTokens: 137 };

describe.skipIf(!RUN_DB)('weekly-review duplicate fire — real concurrent dual-trigger simulation (ENGINE-04)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterEach(() => {
    // Belt-and-braces: every test below restores real timers itself before
    // its own assertions finish, but a thrown assertion mid-test could
    // otherwise leak fake time into the next test's seed queries.
    vi.useRealTimers();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  /**
   * Creates a disposable athlete and calls record_athlete_decision with
   * p_decision_type: 'onboarding_profile' to self-create the athlete_state
   * row. Per migration 20260902100200_record_athlete_decision_v2.sql, that
   * call also stamps next_review_due_at seven real days out — the only
   * RPC-reachable way to produce a next_review_due_at value at all.
   */
  async function seedDueAthlete(prefix: string): Promise<{ userId: string; weekOf: string; dueAt: string }> {
    const athlete = await createTestUser(prefix);
    createdUserIds.push(athlete.id);

    const seed = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: athlete.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'weekly-review-duplicate-fire spec onboarding seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'weekly-review-duplicate-fire.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);

    const { data: stateRow, error: stateError } = await admin
      .from('ziko_athlete_state')
      .select('next_review_due_at')
      .eq('user_id', athlete.id)
      .single();
    expect(stateError).toBeNull();
    const dueAt = (stateRow as { next_review_due_at: string }).next_review_due_at;
    const weekOf = dueAt.slice(0, 10);

    return { userId: athlete.id, weekOf, dueAt };
  }

  /**
   * Fakes ONLY the Date global so runWeeklyReview's due-check (Node-side
   * `Date()`) reads a moment after the real, server-stamped
   * next_review_due_at — see the file header for why this is the sanctioned
   * alternative to a migration or a test-only GRANT.
   */
  function fakeClockPastDueDate(dueAt: string) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(new Date(dueAt).getTime() + 5 * 60 * 1000));
  }

  it(
    'sequential double fire: the cheap pre-check short-circuits the second call, and the single surviving row proves week_of stability, cost attribution and state-patch scope',
    async () => {
      mockGenerateObject.mockReset();
      mockGenerateObject.mockResolvedValue({ object: SCRIPTED_DECISION, usage: SCRIPTED_USAGE });

      const { userId, weekOf, dueAt } = await seedDueAthlete('weekly-review-dup-sequential');
      fakeClockPastDueDate(dueAt);

      // Case 1: sequential double fire — call, await, call again, await.
      const first = await runWeeklyReview(userId, 'app_open_fallback');
      expect(first.ran).toBe(true);
      expect((first as { success?: boolean }).success).toBe(true);

      const second = await runWeeklyReview(userId, 'weekly_review_cron');
      expect(second.ran).toBe(false);
      expect((second as { reason?: string }).reason).toBe('already_recorded');

      vi.useRealTimers();

      // The second call's cheap pre-check found the first call's row and
      // never re-invoked the model — exactly one Claude call was paid for.
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);

      const rows = await admin
        .from('ziko_athlete_decisions')
        .select('id, week_of, source')
        .eq('user_id', userId)
        .eq('decision_type', 'weekly_focus');
      expect(rows.error).toBeNull();
      expect(rows.data?.length).toBe(1);
      const row = rows.data![0] as { id: string; week_of: string; source: string };
      expect(['app_open_fallback', 'weekly_review_cron']).toContain(row.source);

      // Case 3: week_of stability — derived from next_review_due_at as it
      // stood BEFORE the fire, never today's wall-clock date.
      expect(row.week_of).toBe(weekOf);
      expect(row.week_of).not.toBe(new Date().toISOString().slice(0, 10));

      // Case 4: cost attribution (ENGINE-05) — exactly one ai_cost_log row,
      // tagged with the trigger source (never user_chat), carrying the
      // scripted non-zero usage rather than a defaulted zero.
      const costRows = await admin
        .from('ziko_ai_cost_log')
        .select('source, input_tokens, output_tokens')
        .eq('user_id', userId);
      expect(costRows.error).toBeNull();
      expect(costRows.data?.length).toBe(1);
      const costRow = costRows.data![0] as { source: string; input_tokens: number; output_tokens: number };
      expect(costRow.source).not.toBe('user_chat');
      expect(['app_open_fallback', 'weekly_review_cron']).toContain(costRow.source);
      expect(costRow.input_tokens).toBe(SCRIPTED_USAGE.inputTokens);
      expect(costRow.input_tokens).toBeGreaterThan(0);

      // Case 5: state patch scope (ENGINE-03) — readiness moves to the
      // scripted value; level/points/tier stay at their post-onboarding
      // schema-default values (the weekly engine never touches them —
      // Open Question 1's resolution).
      const stateRows = await admin
        .from('ziko_athlete_state')
        .select('readiness, level, points, tier')
        .eq('user_id', userId);
      expect(stateRows.error).toBeNull();
      const state = stateRows.data![0] as { readiness: string; level: number; points: number; tier: number };
      expect(state.readiness).toBe(SCRIPTED_DECISION.new_readiness);
      expect(state.level).toBe(1);
      expect(state.points).toBe(0);
      expect(state.tier).toBe(1);
    },
    30000,
  );

  it(
    'concurrent double fire: Promise.all without awaiting the first still leaves exactly one weekly_focus row',
    async () => {
      mockGenerateObject.mockReset();
      mockGenerateObject.mockResolvedValue({ object: SCRIPTED_DECISION, usage: SCRIPTED_USAGE });

      const { userId, dueAt } = await seedDueAthlete('weekly-review-dup-concurrent');
      fakeClockPastDueDate(dueAt);

      // Case 2: the real at-least-once scenario — invoke both sources with
      // Promise.all, without awaiting the first.
      const [r1, r2] = await Promise.all([
        runWeeklyReview(userId, 'app_open_fallback'),
        runWeeklyReview(userId, 'weekly_review_cron'),
      ]);

      vi.useRealTimers();

      const results = [r1, r2] as Array<{ ran: boolean; success?: boolean; reason?: string }>;

      // At most one of the two results has ran: true with success: true —
      // the race outcome is genuinely nondeterministic, so this asserts the
      // invariant rather than pinning which source won.
      const successCount = results.filter((r) => r.ran && r.success === true).length;
      expect(successCount).toBeLessThanOrEqual(1);

      for (const r of results) {
        if (!r.ran) {
          expect(r.reason).toBe('already_recorded');
        } else if (r.success !== true) {
          expect(r.reason).toBe('duplicate');
        }
      }

      const rows = await admin
        .from('ziko_athlete_decisions')
        .select('id, source')
        .eq('user_id', userId)
        .eq('decision_type', 'weekly_focus');
      expect(rows.error).toBeNull();
      expect(rows.data?.length).toBe(1);
      expect(['app_open_fallback', 'weekly_review_cron']).toContain(
        (rows.data![0] as { source: string }).source,
      );
    },
    30000,
  );
});
