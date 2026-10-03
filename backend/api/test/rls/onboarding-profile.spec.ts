// Phase 43 plan 04 (v1.18, conversational-onboarding) — ONBOARD-05 coverage
// for the onboarding_profile starting-state write contract: the exact
// record_athlete_decision() payload shape plan 43-01's assess_profile
// executor (backend/api/src/tools/onboarding.ts) sends, and the
// app_open_fallback attribution plan 43-04's retroactive path
// (backend/api/src/tools/onboarding-retroactive.ts) sends.
// Migrations under test:
//   supabase/migrations/20260831120000_athlete_state.sql
//     (table + SELECT-only RLS)
//   supabase/migrations/20260831120100_athlete_decisions.sql
//     (append-only journal table + SELECT-only RLS)
//   supabase/migrations/20260831120200_athlete_decisions_rpc.sql
//     (public.record_athlete_decision() RPC + GRANT/REVOKE lockdown)
// Follows the house shape from athlete-decisions.spec.ts verbatim: same
// RUN_DB guard, same getAdminClient/createTestUser/cleanupTestUsers
// fixtures, same skipIf(!RUN_DB) guard on the describe block. This inherits
// the pre-existing Phase 42 environment gap (specs skip when .env.test is
// unconfigured) — expected, not worked around.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with
// production Supabase secrets. This spec creates users and writes
// athlete_state/athlete_decisions rows via the RPC, so it must never run
// there. See athlete-decisions.spec.ts / athlete-state.spec.ts for the same
// pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('onboarding_profile — ONBOARD-05 starting-state write contract', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  it('a brand-new athlete gets status=active, level=1, tier=1, readiness, and current_focus_summary from a single onboarding_profile write (plan 43-01 payload shape)', async () => {
    const a = await createTestUser('onboarding-profile-fresh');
    createdUserIds.push(a.id);

    const result = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'A motivated beginner easing back into training.',
      p_rationale: 'Assessed as beginner experience with medium adherence risk.',
      p_evidence: {
        experience_level: 'beginner',
        experience_confidence: 4,
        adherence_risk: 'medium',
        adherence_confidence: 3,
        readiness: 'building',
        readiness_confidence: 5,
        evidence_source: 'onboarding_conversation',
      },
      p_outcome: { level: 1, tier: 1, micro_action: 'hydration_log', mission_title: "Bois un verre d'eau" },
      p_source: 'onboarding_tool',
      p_state_patch: {
        level: 1,
        tier: 1,
        readiness: 'building',
        status: 'active',
        current_focus_summary: 'A motivated beginner easing back into training.',
        onboarding_profile: {
          experience_level: 'beginner',
          adherence_risk: 'medium',
          confidences: { experience: 4, adherence: 3, readiness: 5 },
        },
      },
    });
    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);

    const { data, error } = await a.client
      .from('ziko_athlete_state')
      .select('status, level, tier, readiness, current_focus_summary')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].status).toBe('active');
    expect(data?.[0].level).toBe(1);
    expect(data?.[0].tier).toBe(1);
    expect(data?.[0].readiness).toBe('building');
    expect(data?.[0].current_focus_summary).toBe('A motivated beginner easing back into training.');
  });

  it('the onboarding_profile JSONB round-trips experience_level, adherence_risk, and the nested confidences object', async () => {
    const a = await createTestUser('onboarding-profile-jsonb');
    createdUserIds.push(a.id);

    const result = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'JSONB round-trip check.',
      p_rationale: null,
      p_evidence: { evidence_source: 'onboarding_conversation' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {
        readiness: 'ready',
        onboarding_profile: {
          experience_level: 'advanced',
          adherence_risk: 'low',
          confidences: { experience: 5, adherence: 5, readiness: 5 },
        },
      },
    });
    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);

    const { data, error } = await a.client
      .from('ziko_athlete_state')
      .select('onboarding_profile')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.[0].onboarding_profile.experience_level).toBe('advanced');
    expect(data?.[0].onboarding_profile.adherence_risk).toBe('low');
    expect(data?.[0].onboarding_profile.confidences).toEqual({ experience: 5, adherence: 5, readiness: 5 });
  });

  it('a matching athlete_decisions row lands with decision_type=onboarding_profile, source=onboarding_tool, week_of null, and confidence scores in evidence', async () => {
    const a = await createTestUser('onboarding-profile-journal');
    createdUserIds.push(a.id);

    const evidence = {
      experience_level: 'intermediate',
      experience_confidence: 3,
      adherence_risk: 'high',
      adherence_confidence: 2,
      readiness: 'fragile',
      readiness_confidence: 4,
      evidence_source: 'onboarding_conversation',
    };

    const result = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'journal row check',
      p_rationale: 'rationale check',
      p_evidence: evidence,
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: { readiness: 'fragile' },
    });
    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);

    const { data, error } = await admin
      .from('ziko_athlete_decisions')
      .select('decision_type, source, week_of, evidence')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].decision_type).toBe('onboarding_profile');
    expect(data?.[0].source).toBe('onboarding_tool');
    expect(data?.[0].week_of).toBeNull();
    expect(data?.[0].evidence.experience_confidence).toBe(3);
    expect(data?.[0].evidence.adherence_confidence).toBe(2);
    expect(data?.[0].evidence.readiness_confidence).toBe(4);
  });

  it('last_review_at and next_review_due_at remain null after an onboarding_profile decision — must not start the weekly-review clock', async () => {
    const a = await createTestUser('onboarding-profile-review-clock');
    createdUserIds.push(a.id);

    const result = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'review clock check',
      p_rationale: null,
      p_evidence: { evidence_source: 'onboarding_conversation' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: { readiness: 'building' },
    });
    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);

    const { data, error } = await admin
      .from('ziko_athlete_state')
      .select('last_review_at, next_review_due_at')
      .eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.[0].last_review_at).toBeNull();
    expect(data?.[0].next_review_due_at).toBeNull();
  });

  it('a second onboarding_profile call for the same athlete is NOT deduplicated (idempotency index is scoped to weekly_focus) and patches the existing row rather than inserting a second one', async () => {
    const a = await createTestUser('onboarding-profile-not-dedup');
    createdUserIds.push(a.id);

    const first = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'first onboarding_profile call',
      p_rationale: null,
      p_evidence: { evidence_source: 'onboarding_conversation' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: { readiness: 'fragile', status: 'active' },
    });
    expect(first.error).toBeNull();
    expect(first.data.success).toBe(true);

    const second = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'second onboarding_profile call — simulates a later retroactive recompute',
      p_rationale: null,
      p_evidence: { evidence_source: 'real_activity_history' },
      p_outcome: {},
      p_source: 'app_open_fallback',
      p_state_patch: { readiness: 'ready', status: 'active' },
    });
    expect(second.error).toBeNull();
    expect(second.data.success).toBe(true);
    expect(second.data.decision_id).not.toBe(first.data.decision_id);

    const { data: stateRows, error: stateError } = await admin
      .from('ziko_athlete_state')
      .select('user_id, readiness')
      .eq('user_id', a.id);
    expect(stateError).toBeNull();
    // Exactly one athlete_state row for the user — the second call patched
    // it, it did not insert a second row.
    expect(stateRows?.length).toBe(1);
    expect(stateRows?.[0].readiness).toBe('ready');

    const { data: journalRows, error: journalError } = await admin
      .from('ziko_athlete_decisions')
      .select('id')
      .eq('user_id', a.id)
      .eq('decision_type', 'onboarding_profile');
    expect(journalError).toBeNull();
    // NOT deduplicated: both journal rows exist.
    expect(journalRows?.length).toBe(2);
  });

  it('p_source=app_open_fallback is accepted by the source CHECK constraint (proves the plan 43-04 retroactive attribution is writable)', async () => {
    const a = await createTestUser('onboarding-profile-app-open-fallback');
    createdUserIds.push(a.id);

    const result = await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'retroactive recompute',
      p_rationale: null,
      p_evidence: { evidence_source: 'real_activity_history', workout_sessions_90d: 0 },
      p_outcome: {},
      p_source: 'app_open_fallback',
      p_state_patch: { readiness: 'fragile', status: 'active' },
    });
    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);

    const { data, error } = await admin.from('ziko_athlete_decisions').select('source').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.[0].source).toBe('app_open_fallback');
  });

  it("the athlete's own client cannot INSERT or UPDATE athlete_state directly — the RPC remains the sole write path after this phase's additions", async () => {
    const a = await createTestUser('onboarding-profile-write-block');
    createdUserIds.push(a.id);

    await admin.rpc('ziko_record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'write block seed',
      p_rationale: null,
      p_evidence: { evidence_source: 'onboarding_conversation' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });

    const insertResult = await a.client.from('ziko_athlete_state').insert({ user_id: a.id });
    expect(insertResult.error).not.toBeNull();

    const updateResult = await a.client.from('ziko_athlete_state').update({ level: 99 }).eq('user_id', a.id);
    expect(updateResult.error).not.toBeNull();
  });
});
