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
// Records rows passed to `.insert(...)` per table — used by apply.ts's
// ai_cost_log fire-and-forget insert assertions (plan 44-04, ENGINE-05).
let insertedRows: Record<string, unknown[]> = {};

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn((row: unknown) => {
      (insertedRows[table] ??= []).push(row);
      return chain;
    }),
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

// ─── Mocks for the ENGINE-02 (decide.ts) and ENGINE-06 (tools.ts) blocks ──
// decide.ts and tools.ts do not exist yet at this task. Their imports below
// are deliberately dynamic (inside beforeEach, not a static top-level
// import) so that filtering on `-t "activity aggregation"` never touches
// them — a static top-level import of a nonexistent module would fail
// Vitest's module collection for the WHOLE file, breaking the
// already-passing activity-aggregation block above. Dynamic import scopes
// the RED failure to only the describe blocks that exercise it.
const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  jsonSchema: vi.fn((schema: unknown) => schema),
}));

// A realistic "raw" JSON Schema carrying every one of the eleven
// Anthropic-banned keywords, so the banned-keyword assertion below
// genuinely exercises decide.ts's own stripUnsupportedKeywords copy
// rather than trivially passing against an empty object.
const RAW_ZOD_SCHEMA_WITH_BANNED_KEYWORDS = {
  type: 'object',
  $schema: 'http://json-schema.org/draft-07/schema#',
  format: 'weekly-decision',
  properties: {
    trajectory: { type: 'string', enum: ['escalate', 'hold', 'de-escalate'] },
    new_readiness: { type: 'string', enum: ['fragile', 'building', 'ready'] },
    new_focus_summary: { type: 'string', minLength: 1, maxLength: 300 },
    rationale: { type: 'string', minLength: 1 },
    call_create_program: { type: 'boolean' },
    new_focus_detail: {
      type: ['object', 'null'],
      properties: {
        focus_type: { type: 'string' },
        target_metric: { type: 'string' },
        target_value: {
          type: 'number',
          minimum: 0,
          maximum: 10000,
          exclusiveMinimum: -1,
          exclusiveMaximum: 10001,
          multipleOf: 1,
        },
      },
      minItems: 1,
      maxItems: 1,
    },
  },
  required: ['trajectory', 'new_readiness', 'new_focus_summary', 'rationale', 'call_create_program', 'new_focus_detail'],
};

vi.mock('@ai-sdk/provider-utils', () => ({
  zodSchema: vi.fn(() => ({ jsonSchema: RAW_ZOD_SCHEMA_WITH_BANNED_KEYWORDS })),
}));

const ANTHROPIC_BANNED_KEYWORDS = [
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
  'multipleOf', '$schema', 'format',
];

function findBannedKeywords(node: unknown, found: string[] = []): string[] {
  if (node === null || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const item of node) findBannedKeywords(item, found);
    return found;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (ANTHROPIC_BANNED_KEYWORDS.includes(key)) found.push(key);
    findBannedKeywords(value, found);
  }
  return found;
}

function buildReviewContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    state: {
      readiness: 'building',
      current_focus_summary: 'Train 3x this week',
      current_focus_detail: {
        focus_type: 'training_volume',
        target_metric: 'sessions_completed',
        target_value: 3,
      },
      rolling_summary: 'Consistent effort over the last month.',
      next_review_due_at: '2026-08-21T00:00:00Z',
    },
    weekOf: '2026-08-21',
    focus: {
      focus_type: 'training_volume',
      target_metric: 'sessions_completed',
      target_value: 3,
    },
    activity: {
      focus_type: 'training_volume',
      tables_read: ['workout_sessions'],
      metrics: { sessions_completed: 4, total_volume_kg: 800 },
      window_start: '2026-08-14T00:00:00Z',
      window_end: '2026-08-21T00:00:00Z',
      evidence_source: 'real_activity_history',
    },
    comparison: {
      target_metric: 'sessions_completed',
      target_value: 3,
      actual_value: 4,
      met: true,
    },
    recentDecisions: [
      {
        decision_type: 'weekly_focus',
        week_of: '2026-08-14',
        summary: 'Held steady',
        outcome: { met: true },
        created_at: '2026-08-14T00:00:00Z',
      },
    ],
    missPattern: { window: 3, missed: 1, pattern_of_misses: false },
    ...overrides,
  } as any;
}

const SCRIPTED_WEEKLY_DECISION = {
  trajectory: 'escalate',
  new_readiness: 'building',
  new_focus_summary: 'Add one more session this week.',
  rationale: 'Hit 4 of 3 target sessions — ready for more.',
  call_create_program: true,
  new_focus_detail: {
    focus_type: 'training_volume',
    target_metric: 'sessions_completed',
    target_value: 4,
  },
};

function resetTableScripts() {
  for (const key of Object.keys(tableResults)) delete tableResults[key];
  singleResults = {};
  insertedRows = {};
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

describe('coaching-engine — decision schema (ENGINE-02)', () => {
  let decideWeeklyFocus: typeof import('../../src/coaching-engine/decide.js').decideWeeklyFocus;

  beforeEach(async () => {
    mockGenerateObject.mockReset();
    mockGenerateObject.mockResolvedValue({
      object: SCRIPTED_WEEKLY_DECISION,
      usage: { inputTokens: 512, outputTokens: 128 },
    });
    ({ decideWeeklyFocus } = await import('../../src/coaching-engine/decide.js'));
  });

  it('the JSON schema handed to generateObject contains none of the eleven Anthropic-banned keywords', async () => {
    await decideWeeklyFocus(buildReviewContext());

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const schemaArg = mockGenerateObject.mock.calls[0][0].schema;
    expect(findBannedKeywords(schemaArg)).toEqual([]);
  });

  it('decideWeeklyFocus returns the structured object plus token usage from exactly one single-shot generateObject call', async () => {
    const result = await decideWeeklyFocus(buildReviewContext());

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('tools');
    expect(callArgs).not.toHaveProperty('stopWhen');
    expect(callArgs).not.toHaveProperty('maxSteps');

    expect(result.decision).toMatchObject({
      trajectory: SCRIPTED_WEEKLY_DECISION.trajectory,
      new_readiness: SCRIPTED_WEEKLY_DECISION.new_readiness,
      new_focus_summary: SCRIPTED_WEEKLY_DECISION.new_focus_summary,
      rationale: SCRIPTED_WEEKLY_DECISION.rationale,
    });
    expect(result.usage).toEqual({ inputTokens: 512, outputTokens: 128 });
    expect(typeof result.modelId).toBe('string');
  });

  it('the prompt built from a WeeklyReviewContext includes the backend-computed verdict and the miss pattern', async () => {
    const context = buildReviewContext();
    await decideWeeklyFocus(context);

    const promptArg = mockGenerateObject.mock.calls[0][0].prompt as string;
    expect(promptArg).toContain(String(context.comparison.actual_value));
    expect(promptArg).toContain(String(context.comparison.target_value));
    expect(promptArg).toContain('met');
    expect(promptArg).toContain(String(context.missPattern.pattern_of_misses));
  });

  it('the prompt states the athlete tables_read so the model can see which sources the verdict came from', async () => {
    const context = buildReviewContext();
    await decideWeeklyFocus(context);

    const promptArg = mockGenerateObject.mock.calls[0][0].prompt as string;
    for (const table of context.activity.tables_read) {
      expect(promptArg).toContain(table);
    }
  });
});

describe('coaching-engine — goal and program tools (ENGINE-06)', () => {
  let create_goal: typeof import('../../src/coaching-engine/tools.js').create_goal;
  let create_program: typeof import('../../src/coaching-engine/tools.js').create_program;

  const VALID_ALLOWED_SOURCES = ['weekly_review_cron', 'onboarding_tool', 'app_open_fallback', 'manual_admin'];

  beforeEach(async () => {
    mockFrom.mockClear();
    mockRpc.mockReset();
    mockGenerateObject.mockReset();
    resetTableScripts();

    // No pre-existing goal — the fixture used by create_goal cases 5-8b.
    singleResults.athlete_state = {
      data: {
        current_focus_detail: {
          focus_type: 'training_volume',
          target_metric: 'sessions_completed',
          target_value: 3,
        },
      },
      error: null,
    };
    tableResults.workout_sessions = {
      data: [{ started_at: '2026-08-18T10:00:00Z', total_volume_kg: 100 }],
      error: null,
    };

    mockRpc.mockResolvedValue({
      data: { success: true, decision_id: 'decision-1', goal_id: 'goal-new' },
      error: null,
    });

    ({ create_goal, create_program } = await import('../../src/coaching-engine/tools.js'));
  });

  it('create_goal calls record_athlete_decision once with goal_created, a non-null p_new_goal, and p_week_of null', async () => {
    await create_goal(
      {
        goal_text: 'Build a base fitness habit by December',
        target_metric: 'sessions_completed',
        target_value: 4,
        target_date: '2026-12-01',
      },
      'athlete-1',
      'token-1',
    );

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, args] = mockRpc.mock.calls[0];
    expect(rpcName).toBe('record_athlete_decision');
    expect(args.p_decision_type).toBe('goal_created');
    expect(args.p_week_of).toBeNull();
    expect(args.p_new_goal).toMatchObject({
      goal_text: 'Build a base fitness habit by December',
      target_metric: 'sessions_completed',
      target_value: 4,
      target_date: '2026-12-01',
      status: 'active',
    });
  });

  it('create_goal uses the userId argument for p_user_id and ignores any user_id present in params', async () => {
    await create_goal(
      { user_id: 'attacker-uuid', goal_text: 'Sneaky goal', target_date: '2026-12-01' },
      'athlete-1',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_user_id).toBe('athlete-1');
  });

  it('create_goal never forwards a model-supplied evidence field — evidence is always server-derived', async () => {
    await create_goal(
      {
        goal_text: 'Sneaky evidence',
        target_date: '2026-12-01',
        evidence: { fabricated: true },
      },
      'athlete-1',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_evidence.evidence_source).toBe('real_activity_history');
    expect(args.p_evidence).not.toHaveProperty('fabricated');
  });

  it('create_goal passes a p_state_patch.current_focus_detail with no goal_id key and no $NEW_GOAL_ID placeholder', async () => {
    await create_goal(
      { goal_text: 'First goal', target_date: '2026-12-01' },
      'athlete-1',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_state_patch.current_focus_detail).not.toHaveProperty('goal_id');
    expect(JSON.stringify(args.p_state_patch.current_focus_detail)).not.toContain('$NEW_GOAL_ID');
  });

  it('create_goal sends p_rationale on every call, including when the model omits it', async () => {
    await create_goal(
      { goal_text: 'Explicit rationale', target_date: '2026-12-01', rationale: 'Explicit reason from the model' },
      'athlete-1',
      'token-1',
    );
    let [, args] = mockRpc.mock.calls[0];
    expect(args.p_rationale).toBe('Explicit reason from the model');

    mockRpc.mockClear();
    await create_goal(
      { goal_text: 'Omitted rationale', target_date: '2026-12-01' },
      'athlete-1',
      'token-1',
    );
    [, args] = mockRpc.mock.calls[0];
    expect('p_rationale' in args).toBe(true);
    expect(typeof args.p_rationale).toBe('string');
    expect((args.p_rationale as string).length).toBeGreaterThan(0);
  });

  it('create_program merges its new targets over the existing current_focus_detail, preserving goal_id', async () => {
    singleResults.athlete_state = {
      data: {
        current_focus_detail: {
          focus_type: 'training_volume',
          target_metric: 'sessions_completed',
          target_value: 3,
          goal_id: 'g-1',
        },
      },
      error: null,
    };

    await create_program(
      {
        focus_summary: 'Push volume this week',
        focus_type: 'training_volume',
        target_metric: 'sessions_completed',
        target_value: 4,
        session_type: 'strength',
      },
      'athlete-1',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_decision_type).toBe('program_created');
    expect(args.p_state_patch.current_focus_detail.goal_id).toBe('g-1');
    expect(args.p_state_patch.current_focus_detail.target_value).toBe(4);
  });

  it('create_program sends both p_rationale and p_source on every call, normalising an invalid source rather than forwarding it', async () => {
    // (a) rationale supplied
    await create_program(
      {
        focus_summary: 'x',
        focus_type: 'training_volume',
        target_metric: 'sessions_completed',
        target_value: 4,
        rationale: 'Explicit program rationale',
      },
      'athlete-1',
      'token-1',
    );
    let [, args] = mockRpc.mock.calls[0];
    expect(args.p_rationale).toBe('Explicit program rationale');

    // (b) rationale absent — key must still be present with a non-empty string
    mockRpc.mockClear();
    await create_program(
      { focus_summary: 'x', focus_type: 'training_volume', target_metric: 'sessions_completed', target_value: 4 },
      'athlete-1',
      'token-1',
    );
    [, args] = mockRpc.mock.calls[0];
    expect('p_rationale' in args).toBe(true);
    expect(typeof args.p_rationale).toBe('string');
    expect((args.p_rationale as string).length).toBeGreaterThan(0);

    // (c) p_source present and a member of the allowed enum
    expect(VALID_ALLOWED_SOURCES).toContain(args.p_source);

    // (d) an invalid source value is never forwarded
    mockRpc.mockClear();
    await create_program(
      {
        focus_summary: 'x',
        focus_type: 'training_volume',
        target_metric: 'sessions_completed',
        target_value: 4,
        source: 'not_an_enum_value',
      },
      'athlete-1',
      'token-1',
    );
    [, args] = mockRpc.mock.calls[0];
    expect(args.p_source).not.toBe('not_an_enum_value');
    expect(VALID_ALLOWED_SOURCES).toContain(args.p_source);
  });

  it('create_program never calls /ai/programs/generate or generateObject — it never triggers full program generation', async () => {
    const fetchSpy =
      typeof globalThis.fetch === 'function' ? vi.spyOn(globalThis, 'fetch') : null;

    await create_program(
      { focus_summary: 'x', focus_type: 'training_volume', target_metric: 'sessions_completed', target_value: 4 },
      'athlete-1',
      'token-1',
    );

    if (fetchSpy) {
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    }
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('both executors throw when the RPC returns a success:false payload rather than returning it silently', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'evidence_required' }, error: null });

    await expect(
      create_goal({ goal_text: 'x', target_date: '2026-12-01' }, 'athlete-1', 'token-1'),
    ).rejects.toThrow();

    await expect(
      create_program(
        { focus_summary: 'x', focus_type: 'training_volume', target_metric: 'sessions_completed', target_value: 4 },
        'athlete-1',
        'token-1',
      ),
    ).rejects.toThrow();
  });
});

// ─── Mock for ENGINE-05: apply.ts must never touch the credit-gate surface ──
// A hoisted, file-wide mock — nothing in this file ever legitimately imports
// creditGate.ts, so the factory only fires (and fails the triggering test)
// if apply.ts's dependency graph reaches for it, which the weekly engine
// must never do (opex, not user-credit-deducted).
vi.mock('../../src/middleware/creditGate.js', () => {
  throw new Error(
    'apply.ts (and its dependency graph) must never import creditGate.ts — ENGINE-05 opex isolation',
  );
});

// ─── Blocks C & D: apply.ts does not exist yet at this task — both dynamic
// imports below fail to resolve, which is the intended RED state for Task 1.
describe('coaching-engine — trajectory application (ENGINE-03)', () => {
  let applyWeeklyDecision: typeof import('../../src/coaching-engine/apply.js').applyWeeklyDecision;

  beforeEach(async () => {
    mockFrom.mockClear();
    mockRpc.mockReset();
    mockGenerateObject.mockReset();
    resetTableScripts();

    mockRpc.mockResolvedValue({
      data: { success: true, decision_id: 'decision-weekly-1', goal_id: null },
      error: null,
    });

    ({ applyWeeklyDecision } = await import('../../src/coaching-engine/apply.js'));
  });

  function buildDecision(overrides: Record<string, unknown> = {}) {
    return {
      trajectory: 'escalate',
      new_readiness: 'ready',
      new_focus_summary: 'Add one more session this week.',
      rationale: 'Hit 4 of 3 target sessions — ready for more.',
      call_create_program: true,
      new_focus_detail: {
        focus_type: 'training_volume',
        target_metric: 'sessions_completed',
        target_value: 4,
      },
      ...overrides,
    } as any;
  }

  it('an escalate decision sets readiness and current_focus_summary in p_state_patch', async () => {
    const context = buildReviewContext();
    const decision = buildDecision();

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 500, outputTokens: 100 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_state_patch.readiness).toBe(decision.new_readiness);
    expect(args.p_state_patch.current_focus_summary).toBe(decision.new_focus_summary);
  });

  it('the p_state_patch never carries level, points or tier keys (Open Question 1 resolution)', async () => {
    const context = buildReviewContext();
    const decision = buildDecision();

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 500, outputTokens: 100 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_state_patch).not.toHaveProperty('level');
    expect(args.p_state_patch).not.toHaveProperty('points');
    expect(args.p_state_patch).not.toHaveProperty('tier');
  });

  it('a de-escalate decision lowering readiness from ready to building is applied without a ratchet guard', async () => {
    const context = buildReviewContext();
    const decision = buildDecision({
      trajectory: 'de-escalate',
      new_readiness: 'building',
      call_create_program: true,
    });

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 500, outputTokens: 100 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_state_patch.readiness).toBe('building');
  });

  it('p_decision_type is always weekly_focus and p_week_of equals context.weekOf exactly, never today', async () => {
    const pastWeekOf = '2026-01-05';
    const context = buildReviewContext({ weekOf: pastWeekOf });
    const decision = buildDecision();

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 500, outputTokens: 100 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_decision_type).toBe('weekly_focus');
    expect(args.p_week_of).toBe(pastWeekOf);
    expect(args.p_week_of).not.toBe(new Date().toISOString().slice(0, 10));
  });

  it('p_evidence is built from context.activity/comparison and never carries a model-fabricated field', async () => {
    const context = buildReviewContext();
    // Simulates a model whose structured output smuggled in an extra field —
    // decision is what apply.ts receives as the model's structured output.
    const decision = buildDecision({ fabricated_evidence: 'should never reach the RPC' });

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 500, outputTokens: 100 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_evidence.evidence_source).toBe('real_activity_history');
    expect(args.p_evidence.tables_read).toEqual(context.activity.tables_read);
    expect(args.p_evidence).not.toHaveProperty('fabricated_evidence');
  });

  it('p_outcome records trajectory, new_readiness and the comparison met boolean', async () => {
    const context = buildReviewContext();
    const decision = buildDecision();

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 500, outputTokens: 100 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const [, args] = mockRpc.mock.calls[0];
    expect(args.p_outcome.trajectory).toBe(decision.trajectory);
    expect(args.p_outcome.new_readiness).toBe(decision.new_readiness);
    expect(args.p_outcome.met).toBe(context.comparison.met);
  });
});

describe('coaching-engine — shared apply path (ENGINE-06)', () => {
  let applyWeeklyDecision: typeof import('../../src/coaching-engine/apply.js').applyWeeklyDecision;
  let runWeeklyReview: typeof import('../../src/coaching-engine/apply.js').runWeeklyReview;

  beforeEach(async () => {
    mockFrom.mockClear();
    mockRpc.mockReset();
    mockGenerateObject.mockReset();
    resetTableScripts();

    mockGenerateObject.mockResolvedValue({
      object: SCRIPTED_WEEKLY_DECISION,
      usage: { inputTokens: 512, outputTokens: 128 },
    });
    mockRpc.mockResolvedValue({
      data: { success: true, decision_id: 'decision-weekly-1', goal_id: null },
      error: null,
    });

    ({ applyWeeklyDecision, runWeeklyReview } = await import('../../src/coaching-engine/apply.js'));
  });

  function buildDecision(overrides: Record<string, unknown> = {}) {
    return {
      trajectory: 'escalate',
      new_readiness: 'ready',
      new_focus_summary: 'Add one more session this week.',
      rationale: 'Hit 4 of 3 target sessions — ready for more.',
      call_create_program: true,
      new_focus_detail: {
        focus_type: 'training_volume',
        target_metric: 'sessions_completed',
        target_value: 4,
      },
      ...overrides,
    } as any;
  }

  it('on escalate, applyWeeklyDecision invokes the shared create_program executor once, forwarding rationale and source into its own record_athlete_decision call', async () => {
    const context = buildReviewContext();
    const decision = buildDecision({ trajectory: 'escalate', call_create_program: true });

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 512, outputTokens: 128 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    // create_program is imported by name from tools.js (not reimplemented),
    // so its own RPC call is observable on the same shared mockRpc — this is
    // what makes "one shared write path" (ENGINE-06) provable end-to-end.
    const programCalls = mockRpc.mock.calls.filter(([, args]) => args.p_decision_type === 'program_created');
    expect(programCalls.length).toBe(1);
    const [, programArgs] = programCalls[0];
    expect(programArgs.p_user_id).toBe('athlete-1');
    expect(programArgs.p_rationale).toBe(decision.rationale);
    expect(programArgs.p_source).toBe('weekly_review_cron');
  });

  it('on de-escalate, create_program is likewise invoked once', async () => {
    const context = buildReviewContext();
    const decision = buildDecision({
      trajectory: 'de-escalate',
      new_readiness: 'building',
      call_create_program: true,
    });

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 512, outputTokens: 128 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const programCalls = mockRpc.mock.calls.filter(([, args]) => args.p_decision_type === 'program_created');
    expect(programCalls.length).toBe(1);
  });

  it('on hold, create_program is NOT invoked at all (D-11)', async () => {
    const context = buildReviewContext();
    const decision = buildDecision({
      trajectory: 'hold',
      call_create_program: false,
      new_focus_detail: null,
    });

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 512, outputTokens: 128 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const programCalls = mockRpc.mock.calls.filter(([, args]) => args.p_decision_type === 'program_created');
    expect(programCalls.length).toBe(0);
  });

  it('when the RPC returns duplicate, applyWeeklyDecision returns an unsuccessful result before any program write', async () => {
    mockRpc.mockResolvedValueOnce({ data: { success: false, error: 'duplicate' }, error: null });
    const context = buildReviewContext();
    const decision = buildDecision({ trajectory: 'escalate', call_create_program: true });

    const result = await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 512, outputTokens: 128 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    expect(result.success).toBe(false);
    // Exactly the one (duplicate) weekly_focus RPC call — create_program's
    // own RPC call never fires because applyWeeklyDecision short-circuited.
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('a successful apply inserts exactly one ai_cost_log row with the real token counts and the trigger source', async () => {
    const context = buildReviewContext();
    const decision = buildDecision({
      trajectory: 'hold',
      call_create_program: false,
      new_focus_detail: null,
    });

    await applyWeeklyDecision(
      'athlete-1',
      decision,
      context,
      'weekly_review_cron',
      { inputTokens: 777, outputTokens: 333 },
      'claude-sonnet-4-20250514',
      'token-1',
    );

    const rows = insertedRows.ai_cost_log ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      user_id: 'athlete-1',
      model: 'claude-sonnet-4-20250514',
      source: 'weekly_review_cron',
      input_tokens: 777,
      output_tokens: 333,
    });
  });

  it('never imports or invokes creditCheck/creditDeduct — the weekly engine is opex, not credit-gated (ENGINE-05)', async () => {
    const context = buildReviewContext();
    const decision = buildDecision({ trajectory: 'escalate', call_create_program: true });

    await expect(
      applyWeeklyDecision(
        'athlete-1',
        decision,
        context,
        'weekly_review_cron',
        { inputTokens: 512, outputTokens: 128 },
        'claude-sonnet-4-20250514',
        'token-1',
      ),
    ).resolves.toMatchObject({ success: true });
  });

  it('runWeeklyReview short-circuits before any model call when fetchWeeklyReviewContext returns null', async () => {
    // No athlete_state singleResult scripted — fetchWeeklyReviewContext
    // resolves the row as null, matching an athlete who has never onboarded.
    const result = await runWeeklyReview('athlete-1', 'weekly_review_cron', 'token-1');

    expect(result.ran).toBe(false);
    expect((result as any).reason).toBe('no_state');
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('runWeeklyReview short-circuits before any model call when a weekly_focus decision already exists for context.weekOf', async () => {
    singleResults.athlete_state = {
      data: {
        next_review_due_at: '2020-01-01T00:00:00Z',
        last_review_at: '2019-12-25T00:00:00Z',
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
    tableResults.workout_sessions = { data: [], error: null };
    // The pre-check's own maybeSingle() read finds an existing weekly_focus
    // row for this week — the cost-efficiency guard this task requires.
    singleResults.athlete_decisions = { data: { id: 'existing-decision' }, error: null };

    const result = await runWeeklyReview('athlete-1', 'weekly_review_cron', 'token-1');

    expect(result.ran).toBe(false);
    expect((result as any).reason).toBe('already_recorded');
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });
});
