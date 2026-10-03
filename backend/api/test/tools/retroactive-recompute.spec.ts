// Phase 43 plan 04 (v1.18, conversational-onboarding) — ONBOARD-06
// coverage for the retroactive recompute module: the concurrency/eligibility
// guards, the real-activity aggregation, and the app_open_fallback
// source-attribution contract.
//
// Pure unit spec — no database access and no conditional skip guard, so it
// runs unconditionally in CI. Mocks src/tools/db.js so clientForUser
// returns a fake client whose from(...) chains resolve scripted rows and
// whose rpc() records its call arguments, and mocks 'ai' so generateObject
// resolves a scripted { object }.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks (hoisted by Vitest before imports resolve) ─────────────
const mockRpc = vi.fn();
const tableResults: Record<string, { data: unknown; error: unknown }> = {};
let singleResults: Record<string, { data: unknown; error: unknown }> = {};

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => singleResults[table] ?? { data: null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(tableResults[table] ?? { data: [], error: null }).then(resolve, reject),
  };
  return chain;
}

const mockFrom = vi.fn((table: string) => makeChain(table));

vi.mock('../../src/tools/db.js', () => ({
  clientForUser: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  jsonSchema: vi.fn((schema: unknown) => schema),
}));

vi.mock('@ai-sdk/provider-utils', () => ({
  zodSchema: vi.fn(() => ({ jsonSchema: {} })),
}));

// ─── Import module under test AFTER mocks are set up ─────────────────────
import {
  fetchActivityAggregates,
  computeRetroactiveProfile,
  RETROACTIVE_WINDOW_DAYS,
} from '../../src/tools/onboarding-retroactive.js';

const SCRIPTED_OBJECT = {
  experience_level: 'beginner',
  experience_confidence: 3,
  adherence_risk: 'medium',
  adherence_confidence: 3,
  readiness: 'fragile',
  readiness_confidence: 4,
  profile_summary: 'A beginner easing back in based on light recent activity.',
};

function resetTableScripts() {
  for (const key of Object.keys(tableResults)) delete tableResults[key];
  singleResults = {};
}

describe('fetchActivityAggregates', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    resetTableScripts();
  });

  it('issues its five reads in parallel and returns numeric counts, never raw rows', async () => {
    tableResults.workout_sessions = {
      data: [
        { started_at: '2026-08-01T10:00:00Z', total_volume_kg: 120.4 },
        { started_at: '2026-08-15T10:00:00Z', total_volume_kg: 80 },
      ],
      error: null,
    };
    tableResults.habit_logs = {
      data: [
        { date: '2026-08-01', value: 1 },
        { date: '2026-08-02', value: 1 },
        { date: '2026-08-02', value: 1 }, // duplicate date must collapse
      ],
      error: null,
    };
    tableResults.nutrition_logs = { data: [{ date: '2026-08-03' }], error: null };
    tableResults.cardio_sessions = { data: [{ date: '2026-08-04' }, { date: '2026-08-05' }], error: null };
    tableResults.body_measurements = { data: [{ date: '2026-08-06' }], error: null };

    const result = await fetchActivityAggregates('user-1', 'token-1');

    expect(mockFrom).toHaveBeenCalledWith('workout_sessions');
    expect(mockFrom).toHaveBeenCalledWith('habit_logs');
    expect(mockFrom).toHaveBeenCalledWith('nutrition_logs');
    expect(mockFrom).toHaveBeenCalledWith('cardio_sessions');
    expect(mockFrom).toHaveBeenCalledWith('body_measurements');

    expect(result).toEqual({
      workout_sessions_90d: 2,
      total_volume_kg_90d: 200,
      habit_log_days_90d: 2,
      nutrition_log_days_90d: 1,
      cardio_sessions_90d: 2,
      measurement_entries_90d: 1,
      distinct_active_days_90d: 7,
      days_since_last_activity: expect.any(Number),
      window_days: RETROACTIVE_WINDOW_DAYS,
    });
    // No raw row (e.g. a started_at string, a value field) should leak into
    // the returned aggregate object's own keys.
    expect(Object.keys(result)).not.toContain('started_at');
    expect(Object.keys(result)).not.toContain('value');
  });

  it('returns days_since_last_activity: null and all-zero counts when the athlete has no activity in the window', async () => {
    resetTableScripts();
    // Explicit empty arrays for every table.
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.nutrition_logs = { data: [], error: null };
    tableResults.cardio_sessions = { data: [], error: null };
    tableResults.body_measurements = { data: [], error: null };

    const result = await fetchActivityAggregates('user-2');

    expect(result.workout_sessions_90d).toBe(0);
    expect(result.total_volume_kg_90d).toBe(0);
    expect(result.distinct_active_days_90d).toBe(0);
    expect(result.days_since_last_activity).toBeNull();
    expect(result.window_days).toBe(RETROACTIVE_WINDOW_DAYS);
  });
});

describe('computeRetroactiveProfile', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockRpc.mockReset();
    mockGenerateObject.mockReset();
    resetTableScripts();
  });

  it('returns { success: false, skipped: "state_exists" } without any model call when athlete_state already has a row', async () => {
    singleResults.athlete_state = { data: { user_id: 'user-1' }, error: null };

    const result = await computeRetroactiveProfile('user-1', 'token-1');

    expect(result).toEqual({ success: false, skipped: 'state_exists' });
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns { success: false, skipped: "not_onboarded" } without any model call when user_profiles.onboarding_done is false', async () => {
    singleResults.athlete_state = { data: null, error: null };
    singleResults.user_profiles = { data: { onboarding_done: false }, error: null };

    const result = await computeRetroactiveProfile('user-1', 'token-1');

    expect(result).toEqual({ success: false, skipped: 'not_onboarded' });
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns { success: false, skipped: "not_onboarded" } without any model call when the user_profiles row is absent', async () => {
    singleResults.athlete_state = { data: null, error: null };
    singleResults.user_profiles = { data: null, error: null };

    const result = await computeRetroactiveProfile('user-1', 'token-1');

    expect(result).toEqual({ success: false, skipped: 'not_onboarded' });
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('a pre-v1.18 athlete with real activity gets a decision written with app_open_fallback attribution', async () => {
    singleResults.athlete_state = { data: null, error: null };
    singleResults.user_profiles = { data: { onboarding_done: true }, error: null };
    tableResults.workout_sessions = {
      data: [{ started_at: '2026-08-01T10:00:00Z', total_volume_kg: 100 }],
      error: null,
    };
    tableResults.habit_logs = { data: [{ date: '2026-08-01', value: 1 }], error: null };
    tableResults.nutrition_logs = { data: [], error: null };
    tableResults.cardio_sessions = { data: [], error: null };
    tableResults.body_measurements = { data: [], error: null };

    mockGenerateObject.mockResolvedValue({ object: SCRIPTED_OBJECT });
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'decision-abc' }, error: null });

    const result = await computeRetroactiveProfile('user-1', 'token-1');

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcArgs] = mockRpc.mock.calls[0];
    expect(rpcName).toBe('record_athlete_decision');
    expect(rpcArgs.p_source).toBe('app_open_fallback');
    expect(rpcArgs.p_decision_type).toBe('onboarding_profile');
    expect(rpcArgs.p_week_of).toBeNull();
    expect(rpcArgs.p_state_patch.status).toBe('active');
    expect(rpcArgs.p_state_patch.level).toBe(1);
    expect(rpcArgs.p_state_patch.tier).toBe(1);
    expect(rpcArgs.p_state_patch.readiness).toBe(SCRIPTED_OBJECT.readiness);
    expect(rpcArgs.p_state_patch.onboarding_profile.computed_retroactively).toBe(true);
    // The evidence payload carries the actual queried aggregates.
    expect(rpcArgs.p_evidence.evidence_source).toBe('real_activity_history');
    expect(rpcArgs.p_evidence.workout_sessions_90d).toBe(1);
    expect(rpcArgs.p_evidence.window_days).toBe(RETROACTIVE_WINDOW_DAYS);

    expect(result).toEqual({ success: true, decision_id: 'decision-abc' });
  });

  it('an athlete with all-zero aggregates still writes a decision, with the zero counts as its evidence', async () => {
    singleResults.athlete_state = { data: null, error: null };
    singleResults.user_profiles = { data: { onboarding_done: true }, error: null };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.nutrition_logs = { data: [], error: null };
    tableResults.cardio_sessions = { data: [], error: null };
    tableResults.body_measurements = { data: [], error: null };

    mockGenerateObject.mockResolvedValue({
      object: { ...SCRIPTED_OBJECT, readiness: 'fragile' },
    });
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'decision-zero' }, error: null });

    const result = await computeRetroactiveProfile('user-3', 'token-3');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [, rpcArgs] = mockRpc.mock.calls[0];
    expect(rpcArgs.p_evidence.workout_sessions_90d).toBe(0);
    expect(rpcArgs.p_evidence.total_volume_kg_90d).toBe(0);
    expect(rpcArgs.p_evidence.distinct_active_days_90d).toBe(0);
    expect(rpcArgs.p_evidence.days_since_last_activity).toBeNull();
    expect(rpcArgs.p_source).toBe('app_open_fallback');

    expect(result).toEqual({ success: true, decision_id: 'decision-zero' });
  });

  it('surfaces the failure rather than reporting success when the RPC resolves an error-shaped payload', async () => {
    singleResults.athlete_state = { data: null, error: null };
    singleResults.user_profiles = { data: { onboarding_done: true }, error: null };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.nutrition_logs = { data: [], error: null };
    tableResults.cardio_sessions = { data: [], error: null };
    tableResults.body_measurements = { data: [], error: null };

    mockGenerateObject.mockResolvedValue({ object: SCRIPTED_OBJECT });
    mockRpc.mockResolvedValue({ data: { success: false, error: 'evidence_required' }, error: null });

    const result = await computeRetroactiveProfile('user-4', 'token-4');

    expect(result).toEqual({ success: false, error: 'evidence_required' });
  });

  it('throws when the supabase client returns a non-null error on the RPC call', async () => {
    singleResults.athlete_state = { data: null, error: null };
    singleResults.user_profiles = { data: { onboarding_done: true }, error: null };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.nutrition_logs = { data: [], error: null };
    tableResults.cardio_sessions = { data: [], error: null };
    tableResults.body_measurements = { data: [], error: null };

    mockGenerateObject.mockResolvedValue({ object: SCRIPTED_OBJECT });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

    await expect(computeRetroactiveProfile('user-5', 'token-5')).rejects.toThrow(
      /record_athlete_decision failed:/,
    );
  });

  it('throws when the athlete_state guard read itself errors', async () => {
    singleResults.athlete_state = { data: null, error: { message: 'permission denied' } };

    await expect(computeRetroactiveProfile('user-6', 'token-6')).rejects.toThrow(
      /athlete_state guard read failed:/,
    );
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
