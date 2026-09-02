// Phase 44 plan 02 (v1.18, weekly-adaptive-decision-engine) — ENGINE-01
// coverage for the coaching-engine module: focus-scoped real-activity
// aggregation (D-08 closed-set table mapping) and the deterministic
// exact-or-exceed "met" verdict (D-07), plus the de-escalation
// pattern-of-misses signal (D-05) and the week_of capture discipline
// (ENGINE-04 idempotency correctness).
//
// Pure unit spec — no database access and no conditional skip guard, so it
// runs unconditionally in CI. Mocks src/tools/db.js so clientForUser
// returns a fake client whose from(...) chains resolve scripted rows.
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
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => singleResults[table] ?? { data: null, error: null }),
    single: vi.fn(async () => singleResults[table] ?? { data: null, error: null }),
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

// ─── Import module under test AFTER mocks are set up ─────────────────────
// NOTE: context.ts does not exist yet at this task — this import fails to
// resolve, which is the intended RED state for this task.
import {
  fetchFocusScopedActivity,
  fetchWeeklyReviewContext,
} from '../../src/coaching-engine/context.js';

function resetTableScripts() {
  for (const key of Object.keys(tableResults)) delete tableResults[key];
  singleResults = {};
}

describe('coaching-engine — activity aggregation (ENGINE-01)', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockRpc.mockReset();
    resetTableScripts();
  });

  it('a training_volume focus queries workout_sessions only, never any other activity table', async () => {
    tableResults.workout_sessions = {
      data: [{ started_at: '2026-08-15T10:00:00Z', total_volume_kg: 100 }],
      error: null,
    };

    const fakeDb = { from: mockFrom };
    const result = await fetchFocusScopedActivity(
      fakeDb as any,
      'user-1',
      'training_volume',
      '2026-08-14',
      '2026-08-21',
    );

    const calledTables = mockFrom.mock.calls.map((c) => c[0]);
    expect(calledTables).toEqual(['workout_sessions']);
    expect(calledTables).not.toContain('nutrition_logs');
    expect(calledTables).not.toContain('habit_logs');
    expect(calledTables).not.toContain('hydration_logs');
    expect(calledTables).not.toContain('sleep_logs');
    expect(calledTables).not.toContain('cardio_sessions');
    expect(result.tables_read).toEqual(['workout_sessions']);
  });

  it('a nutrition focus queries nutrition_logs only and mockFrom is never called with workout_sessions', async () => {
    tableResults.nutrition_logs = { data: [{ date: '2026-08-18' }], error: null };

    const fakeDb = { from: mockFrom };
    const result = await fetchFocusScopedActivity(
      fakeDb as any,
      'user-1',
      'nutrition',
      '2026-08-14',
      '2026-08-21',
    );

    const calledTables = mockFrom.mock.calls.map((c) => c[0]);
    expect(calledTables).toEqual(['nutrition_logs']);
    expect(calledTables).not.toContain('workout_sessions');
    expect(result.tables_read).toEqual(['nutrition_logs']);
  });

  it('a habit_consistency focus queries habit_logs and journal_entries and unions overlapping dates', async () => {
    tableResults.habit_logs = {
      data: [
        { date: '2026-08-18', value: 1 },
        { date: '2026-08-19', value: 1 },
      ],
      error: null,
    };
    tableResults.journal_entries = {
      data: [
        { date: '2026-08-19', mood: 3, energy: 3, stress: 2 }, // overlaps habit_logs' 08-19
        { date: '2026-08-20', mood: 4, energy: 4, stress: 1 },
      ],
      error: null,
    };

    const fakeDb = { from: mockFrom };
    const result = await fetchFocusScopedActivity(
      fakeDb as any,
      'user-1',
      'habit_consistency',
      '2026-08-14',
      '2026-08-21',
    );

    const calledTables = mockFrom.mock.calls.map((c) => c[0]).sort();
    expect(calledTables).toEqual(['habit_logs', 'journal_entries']);
    // Union of {08-18, 08-19, 08-20} = 3 distinct days, not the sum (4).
    expect(result.metrics.distinct_active_days).toBe(3);
  });

  it('exact-target hit is met (D-07): 3 workout_sessions rows against a target of 3', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: '2026-08-14T00:00:00Z',
        current_focus_detail: {
          focus_type: 'training_volume',
          target_metric: 'sessions_completed',
          target_value: 3,
        },
        current_focus_summary: 'Train 3x this week',
        readiness: 'building',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.athlete_decisions = { data: [], error: null };
    tableResults.workout_sessions = {
      data: [
        { started_at: '2026-08-15T10:00:00Z', total_volume_kg: 100 },
        { started_at: '2026-08-17T10:00:00Z', total_volume_kg: 100 },
        { started_at: '2026-08-19T10:00:00Z', total_volume_kg: 100 },
      ],
      error: null,
    };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.comparison.met).toBe(true);
    expect(context?.comparison.actual_value).toBe(3);
  });

  it('exceeding the target is still met (D-07): 4 rows against a target of 3', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: '2026-08-14T00:00:00Z',
        current_focus_detail: {
          focus_type: 'training_volume',
          target_metric: 'sessions_completed',
          target_value: 3,
        },
        current_focus_summary: 'Train 3x this week',
        readiness: 'building',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.athlete_decisions = { data: [], error: null };
    tableResults.workout_sessions = {
      data: [
        { started_at: '2026-08-15T10:00:00Z', total_volume_kg: 100 },
        { started_at: '2026-08-16T10:00:00Z', total_volume_kg: 100 },
        { started_at: '2026-08-17T10:00:00Z', total_volume_kg: 100 },
        { started_at: '2026-08-19T10:00:00Z', total_volume_kg: 100 },
      ],
      error: null,
    };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.comparison.met).toBe(true);
    expect(context?.comparison.actual_value).toBe(4);
  });

  it('a near-miss is NOT met (D-07, no tolerance band): 2 rows against a target of 3', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: '2026-08-14T00:00:00Z',
        current_focus_detail: {
          focus_type: 'training_volume',
          target_metric: 'sessions_completed',
          target_value: 3,
        },
        current_focus_summary: 'Train 3x this week',
        readiness: 'building',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.athlete_decisions = { data: [], error: null };
    tableResults.workout_sessions = {
      data: [
        { started_at: '2026-08-15T10:00:00Z', total_volume_kg: 100 },
        { started_at: '2026-08-17T10:00:00Z', total_volume_kg: 100 },
      ],
      error: null,
    };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.comparison.met).toBe(false);
    expect(context?.comparison.actual_value).toBe(2);
  });

  it('no assigned target yields met null and focus_type unassigned, never a miss', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: null,
        current_focus_detail: {},
        current_focus_summary: null,
        readiness: 'fragile',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.athlete_decisions = { data: [], error: null };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.comparison.met).toBeNull();
    expect(context?.focus.focus_type).toBe('unassigned');
  });

  it('missPattern flags a pattern of misses when 2 of the last 3 weekly_focus decisions were missed', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: null,
        current_focus_detail: {},
        current_focus_summary: null,
        readiness: 'fragile',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.athlete_decisions = {
      data: [
        { decision_type: 'weekly_focus', week_of: '2026-08-21', summary: 's3', outcome: { met: false }, created_at: '2026-08-21T00:00:00Z' },
        { decision_type: 'weekly_focus', week_of: '2026-08-14', summary: 's2', outcome: { met: false }, created_at: '2026-08-14T00:00:00Z' },
        { decision_type: 'weekly_focus', week_of: '2026-08-07', summary: 's1', outcome: { met: true }, created_at: '2026-08-07T00:00:00Z' },
      ],
      error: null,
    };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.missPattern.pattern_of_misses).toBe(true);
    expect(context?.missPattern.missed).toBe(2);
  });

  it('missPattern is false when only 1 of the last 3 weekly_focus decisions was missed', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: null,
        current_focus_detail: {},
        current_focus_summary: null,
        readiness: 'fragile',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.athlete_decisions = {
      data: [
        { decision_type: 'weekly_focus', week_of: '2026-08-21', summary: 's3', outcome: { met: false }, created_at: '2026-08-21T00:00:00Z' },
        { decision_type: 'weekly_focus', week_of: '2026-08-14', summary: 's2', outcome: { met: true }, created_at: '2026-08-14T00:00:00Z' },
        { decision_type: 'weekly_focus', week_of: '2026-08-07', summary: 's1', outcome: { met: true }, created_at: '2026-08-07T00:00:00Z' },
      ],
      error: null,
    };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.missPattern.pattern_of_misses).toBe(false);
  });

  it('missPattern survives interleaved program_created rows — the type filter is applied before slicing to three', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-08-21T00:00:00Z',
        last_review_at: null,
        current_focus_detail: {},
        current_focus_summary: null,
        readiness: 'fragile',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };
    tableResults.athlete_decisions = {
      data: [
        { decision_type: 'weekly_focus', week_of: '2026-08-21', summary: 's', outcome: { met: false }, created_at: '2026-08-21T00:00:00Z' },
        { decision_type: 'program_created', week_of: null, summary: 'p', outcome: {}, created_at: '2026-08-20T00:00:00Z' },
        { decision_type: 'weekly_focus', week_of: '2026-08-14', summary: 's', outcome: { met: false }, created_at: '2026-08-14T00:00:00Z' },
        { decision_type: 'program_created', week_of: null, summary: 'p', outcome: {}, created_at: '2026-08-13T00:00:00Z' },
        { decision_type: 'weekly_focus', week_of: '2026-08-07', summary: 's', outcome: { met: true }, created_at: '2026-08-07T00:00:00Z' },
      ],
      error: null,
    };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    // A read that took only the newest four rows of any type would see just
    // two real weekly_focus entries here and silently under-count.
    expect(context?.missPattern.window).toBe(3);
    expect(context?.missPattern.missed).toBe(2);
    expect(context?.missPattern.pattern_of_misses).toBe(true);
  });

  it('weekOf is derived from the scripted next_review_due_at, never from the system clock', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2026-07-01T00:00:00Z',
        last_review_at: null,
        current_focus_detail: {},
        current_focus_summary: null,
        readiness: 'fragile',
        rolling_summary: null,
      },
      error: null,
    };
    tableResults.athlete_decisions = { data: [], error: null };
    tableResults.workout_sessions = { data: [], error: null };
    tableResults.habit_logs = { data: [], error: null };

    const context = await fetchWeeklyReviewContext('user-1', 'token-1');

    expect(context?.weekOf).toBe('2026-07-01');
    expect(context?.weekOf).not.toBe(new Date().toISOString().slice(0, 10));
  });
});
