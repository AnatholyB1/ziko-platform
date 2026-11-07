// Phase 45 (v1.18, non-punitive-tiered-rewards) - REWARD-01..05 unit coverage.
//
// Pure unit spec: the Supabase client and the model are mocked, no database
// and no real AI call is ever made, so it runs unconditionally in CI. The
// live-DB counterpart (RLS / RPC) is test/rls/athlete-rewards.spec.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockRpc = vi.fn();
const mockGenerateObject = vi.fn();
let tables: Record<string, { data: unknown; error: unknown }> = {};
let singles: Record<string, { data: unknown; error: unknown }> = {};
let inserts: Array<{ table: string; row: any }> = [];

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn((row: any) => {
      inserts.push({ table, row });
      return chain;
    }),
    maybeSingle: vi.fn(async () => singles[table] ?? { data: null, error: null }),
    single: vi.fn(async () => singles[table] ?? { data: null, error: null }),
    then: (resolveFn: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolveFn, reject),
  };
  return chain;
}

vi.mock('../../src/tools/db.js', () => ({
  clientForUser: vi.fn(() => ({ from: (t: string) => makeChain(t), rpc: mockRpc })),
}));
// Registry import pulls in creditService, which builds a Supabase client at module load.
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: vi.fn(), rpc: vi.fn() })) }));
vi.mock('ai', () => ({
  generateObject: (...a: unknown[]) => mockGenerateObject(...a),
  jsonSchema: vi.fn((s: unknown) => s),
}));
vi.mock('@ai-sdk/provider-utils', () => ({ zodSchema: vi.fn(() => ({ jsonSchema: {} })) }));

import {
  EXCEEDED_MARGIN,
  POINTS,
  TIER_THRESHOLDS,
  computePointsOutcome,
  filterEligiblePool,
  grantRewardForTier,
  nextRewardState,
  owedTiers,
  resolveSelection,
  selectReward,
  tierFromPoints,
  type RewardCatalogRow,
} from '../../src/coaching-engine/rewards.js';
import { create_reward, coachingEngineToolSchemas } from '../../src/coaching-engine/tools.js';
import { applyWeeklyDecision } from '../../src/coaching-engine/apply.js';
import { allToolSchemas, getToolExecutor } from '../../src/tools/registry.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function row(over: Partial<RewardCatalogRow> & { id: string }): RewardCatalogRow {
  return {
    tier: 2,
    key: `k_${over.id}`,
    kind: 'badge',
    icon: 'ribbon-outline',
    label_fr: 'fr',
    label_en: 'en',
    sort_order: 10,
    active: true,
    ...over,
  };
}
const POOL: RewardCatalogRow[] = [
  row({ id: 'c', sort_order: 30 }),
  row({ id: 'a', sort_order: 10 }),
  row({ id: 'b', sort_order: 20 }),
];

beforeEach(() => {
  mockRpc.mockReset();
  mockGenerateObject.mockReset();
  tables = {};
  singles = {};
  inserts = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ─── REWARD-01 / REWARD-02: points ──────────────────────────────────────
describe('computePointsOutcome (D-01, D-02)', () => {
  it('config constants match the locked decisions', () => {
    expect(EXCEEDED_MARGIN).toBe(1.25);
    expect(POINTS).toEqual({ met: 10, exceeded: 15, missed: 0 });
    expect(TIER_THRESHOLDS).toEqual({ 2: 50, 3: 150, 4: 300 });
  });

  it('met exactly at target earns 10', () => {
    expect(computePointsOutcome({ met: true, actual_value: 3, target_value: 3 })).toEqual({ outcome: 'met', points: 10 });
  });

  it('exceeded boundary: exactly 1.25x target earns 15', () => {
    expect(computePointsOutcome({ met: true, actual_value: 5, target_value: 4 })).toEqual({ outcome: 'exceeded', points: 15 });
  });

  it('just below 1.25x target earns only 10', () => {
    expect(computePointsOutcome({ met: true, actual_value: 4.99, target_value: 4 }).points).toBe(10);
  });

  it('decimal targets are not lost to float error at the 1.25x boundary', () => {
    expect(computePointsOutcome({ met: true, actual_value: 3, target_value: 2.4 }).points).toBe(15);
  });

  it('missed earns 0 and is never negative', () => {
    expect(computePointsOutcome({ met: false, actual_value: 0, target_value: 3 })).toEqual({ outcome: 'missed', points: 0 });
  });

  it('no target (met null) earns 0 - not a miss, not a penalty', () => {
    expect(computePointsOutcome({ met: null, actual_value: null, target_value: null })).toEqual({ outcome: 'no_target', points: 0 });
  });

  it('trusts the backend met verdict: met=true with a missing actual is still just met, met=false is never upgraded', () => {
    expect(computePointsOutcome({ met: true, actual_value: null, target_value: 3 }).outcome).toBe('met');
    expect(computePointsOutcome({ met: false, actual_value: 100, target_value: 3 }).outcome).toBe('missed');
  });

  it('a zero or negative target never counts as exceeded', () => {
    expect(computePointsOutcome({ met: true, actual_value: 5, target_value: 0 }).outcome).toBe('met');
  });

  it('points are never negative across a grid of inputs', () => {
    for (const met of [true, false, null] as const) {
      for (const actual of [null, -5, 0, 1, 3, 100, Number.NaN]) {
        for (const target of [null, -1, 0, 3]) {
          expect(computePointsOutcome({ met, actual_value: actual, target_value: target }).points).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ─── REWARD-02 / REWARD-04: tiers ───────────────────────────────────────
describe('tierFromPoints / nextRewardState (D-02, D-07)', () => {
  it.each([
    [0, 1], [49, 1], [50, 2], [149, 2], [150, 3], [299, 3], [300, 4], [100000, 4],
  ])('%i points -> tier %i', (points, tier) => {
    expect(tierFromPoints(points)).toBe(tier);
  });

  it('tier-up is reported when points cross a threshold', () => {
    const next = nextRewardState({ points: 45, tier: 1 }, { met: true, actual_value: 3, target_value: 3 });
    expect(next).toMatchObject({ points: 55, tier: 2, tierUp: true });
  });

  it('a missed week leaves points and tier unchanged (monotonic, nothing lowered)', () => {
    const next = nextRewardState({ points: 160, tier: 3 }, { met: false, actual_value: 0, target_value: 3 });
    expect(next).toMatchObject({ points: 160, tier: 3, tierUp: false });
  });

  it('tier never drops even if stored points imply a lower tier', () => {
    const next = nextRewardState({ points: 10, tier: 3 }, { met: false, actual_value: 0, target_value: 3 });
    expect(next.tier).toBe(3);
    expect(next.points).toBe(10);
  });

  it('absent counters default to points 0 / tier 1', () => {
    expect(nextRewardState({}, { met: true, actual_value: 3, target_value: 3 })).toMatchObject({ points: 10, tier: 1, tierUp: false });
  });

  it('owedTiers lists reached tiers without a reward and never tier 1', () => {
    expect(owedTiers(3, [2])).toEqual([3]);
    expect(owedTiers(4, [])).toEqual([2, 3, 4]);
    expect(owedTiers(1, [])).toEqual([]);
    expect(owedTiers(3, [2, 3])).toEqual([]);
  });
});

// ─── REWARD-03: pool + selection ────────────────────────────────────────
describe('pool filtering and selection validation (D-05)', () => {
  it('filterEligiblePool keeps only active, same-tier, unowned rewards in sort order', () => {
    const catalog = [
      ...POOL,
      row({ id: 'x', tier: 3 }),
      row({ id: 'y', active: false }),
      row({ id: 'z', sort_order: 5 }),
    ];
    const pool = filterEligiblePool(catalog, new Set(['z']), 2);
    expect(pool.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('resolveSelection accepts an id from the pool', () => {
    expect(resolveSelection('b', POOL)).toMatchObject({ via: 'ai', reward: { id: 'b' } });
  });

  it.each([['invented'], [''], [42], [null], [undefined], [{ id: 'a' }]])(
    'resolveSelection falls back to the first by sort_order for invalid output %j',
    (bad) => {
      const sorted = filterEligiblePool(POOL, [], 2);
      expect(resolveSelection(bad, sorted)).toMatchObject({ via: 'fallback', reward: { id: 'a' } });
    },
  );

  it('an already-owned id (duplicate of a previous grant) is not in the pool and falls back', () => {
    const pool = filterEligiblePool(POOL, new Set(['b']), 2);
    expect(resolveSelection('b', pool)).toMatchObject({ via: 'fallback', reward: { id: 'a' } });
  });

  it('an empty pool yields no selection', () => {
    expect(resolveSelection('a', [])).toBeNull();
  });
});

describe('selectReward - model boundary (temperature 0, validation, cost)', () => {
  const db = { from: (t: string) => makeChain(t), rpc: mockRpc } as any;
  const sorted = filterEligiblePool(POOL, [], 2);

  it('calls the model at temperature 0 and uses a valid answer', async () => {
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'b' }, usage: { inputTokens: 12, outputTokens: 3 } });
    const sel = await selectReward(db, 'u1', 2, sorted);
    expect(mockGenerateObject.mock.calls[0]![0].temperature).toBe(0);
    expect(sel).toMatchObject({ via: 'ai', reward: { id: 'b' } });
  });

  it('invalid model output degrades to the deterministic fallback', async () => {
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'not-in-pool' }, usage: {} });
    expect(await selectReward(db, 'u1', 2, sorted)).toMatchObject({ via: 'fallback', reward: { id: 'a' } });
  });

  it('duplicate output (an owned reward) falls back', async () => {
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'a' }, usage: {} });
    const pool = filterEligiblePool(POOL, new Set(['a']), 2);
    expect(await selectReward(db, 'u1', 2, pool)).toMatchObject({ via: 'fallback', reward: { id: 'b' } });
  });

  it('a model error never loses the grant', async () => {
    mockGenerateObject.mockRejectedValue(new Error('provider down'));
    expect(await selectReward(db, 'u1', 2, sorted)).toMatchObject({ via: 'fallback', reward: { id: 'a' } });
  });

  it('logs the cost with source reward_selection and no credit columns', async () => {
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'a' }, usage: { inputTokens: 40, outputTokens: 7 } });
    await selectReward(db, 'u1', 2, sorted);
    await flush();
    const cost = inserts.find((i) => i.table === 'ziko_ai_cost_log');
    expect(cost?.row).toMatchObject({ user_id: 'u1', source: 'reward_selection', input_tokens: 40, output_tokens: 7 });
  });

  it('a single-entry pool skips the model entirely', async () => {
    const one = [POOL[0]!];
    expect(await selectReward(db, 'u1', 2, one)).toMatchObject({ via: 'fallback', reward: { id: 'c' } });
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });
});

// ─── create_reward executor ─────────────────────────────────────────────
describe('create_reward executor (REWARD-03, D-05, D-06)', () => {
  function seedTier2() {
    singles['ziko_athlete_state'] = { data: { tier: 2 }, error: null };
    tables['ziko_reward_catalog'] = { data: POOL, error: null };
    tables['ziko_athlete_rewards'] = { data: [], error: null };
  }

  it('grants through ziko_grant_reward with backend-built evidence and the week anchor', async () => {
    seedTier2();
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'b' }, usage: {} });
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'd1' }, error: null });

    const res = await create_reward({ tier: 2, week_of: '2026-11-08', source: 'weekly_review_cron' }, 'u1');

    expect(res).toMatchObject({ granted: true, tier: 2, decision_id: 'd1', reward: { id: 'b' } });
    const [fn, args] = mockRpc.mock.calls[0]!;
    expect(fn).toBe('ziko_grant_reward');
    expect(args).toMatchObject({ p_user_id: 'u1', p_reward_id: 'b', p_week_of: '2026-11-08', p_source: 'weekly_review_cron' });
    expect(args.p_evidence.evidence_source).toBe('backend_state');
  });

  it('refuses a tier the athlete has not reached', async () => {
    seedTier2();
    expect(await create_reward({ tier: 3, week_of: '2026-11-08' }, 'u1')).toEqual({ granted: false, reason: 'tier_not_reached' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects invalid tier and week_of without touching the database', async () => {
    expect(await create_reward({ tier: 1, week_of: '2026-11-08' }, 'u1')).toMatchObject({ granted: false, reason: 'invalid_tier' });
    expect(await create_reward({ tier: 9, week_of: '2026-11-08' }, 'u1')).toMatchObject({ granted: false, reason: 'invalid_tier' });
    expect(await create_reward({ tier: 2, week_of: 'tomorrow' }, 'u1')).toMatchObject({ granted: false, reason: 'invalid_week_of' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('idempotent: when the tier already has a reward, a second fire writes nothing', async () => {
    seedTier2();
    tables['ziko_athlete_rewards'] = { data: [{ reward_id: 'a', tier: 2 }], error: null };
    expect(await create_reward({ tier: 2, week_of: '2026-11-08' }, 'u1')).toEqual({ granted: false, reason: 'already_granted' });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('idempotent: a concurrent double fire resolves to one grant (the RPC reports duplicate for the loser)', async () => {
    seedTier2();
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'a' }, usage: {} });
    mockRpc
      .mockResolvedValueOnce({ data: { success: true, decision_id: 'd1' }, error: null })
      .mockResolvedValueOnce({ data: { success: false, error: 'duplicate' }, error: null });
    const [first, second] = await Promise.all([
      create_reward({ tier: 2, week_of: '2026-11-08' }, 'u1'),
      create_reward({ tier: 2, week_of: '2026-11-08' }, 'u1'),
    ]);
    expect([first, second].filter((r) => (r as any).granted).length).toBe(1);
    expect([first, second]).toContainEqual({ granted: false, reason: 'duplicate' });
  });

  it('an exhausted pool is a clean non-grant, not a crash', async () => {
    seedTier2();
    tables['ziko_reward_catalog'] = { data: [], error: null };
    expect(await create_reward({ tier: 2, week_of: '2026-11-08' }, 'u1')).toEqual({ granted: false, reason: 'pool_exhausted' });
  });

  it('a database error surfaces as a throw (retryable by the caller)', async () => {
    seedTier2();
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'a' }, usage: {} });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(create_reward({ tier: 2, week_of: '2026-11-08' }, 'u1')).rejects.toThrow(/ziko_grant_reward failed/);
  });

  it('grantRewardForTier never revokes: there is no code path that deletes or updates rewards', () => {
    const src = readFileSync(resolve(__dirname, '../../src/coaching-engine/rewards.ts'), 'utf8');
    expect(src).not.toMatch(/\.delete\(|\.update\(|\.upsert\(/);
    expect(typeof grantRewardForTier).toBe('function');
  });

  it('has no credit gate anywhere in the reward modules (REWARD-03, autonomous spend)', () => {
    for (const f of ['rewards.ts', 'tools.ts', 'apply.ts']) {
      const src = readFileSync(resolve(__dirname, '../../src/coaching-engine', f), 'utf8');
      expect(src).not.toMatch(/import[^;]*(creditGate|creditService)|creditCheck\(|creditDeduct\(/);
    }
  });
});

// ─── Registry ───────────────────────────────────────────────────────────
describe('registry wiring', () => {
  it('create_reward has a schema in coachingEngineToolSchemas and an executor in the registry', () => {
    expect(coachingEngineToolSchemas.some((t) => t.name === 'create_reward')).toBe(true);
    expect(typeof getToolExecutor('create_reward')).toBe('function');
  });

  it('create_reward is not exposed to chat (allToolSchemas) while create_goal/create_program still are', () => {
    const names = allToolSchemas.map((t) => t.name);
    expect(names).not.toContain('create_reward');
    expect(names).toContain('create_goal');
    expect(names).toContain('create_program');
  });
});

// ─── Weekly flow wiring (D-03, D-06, D-07) ──────────────────────────────
describe('applyWeeklyDecision - reward wiring', () => {
  const decision = {
    trajectory: 'hold',
    new_readiness: 'building',
    new_focus_summary: 'Keep going.',
    rationale: 'Steady.',
    call_create_program: false,
    new_focus_detail: null,
  } as any;
  const usage = { inputTokens: 5, outputTokens: 2 };

  function ctx(over: { points?: number; tier?: number; met?: boolean | null; actual?: number | null; target?: number | null }) {
    return {
      userId: 'u1',
      state: {
        readiness: 'building',
        current_focus_summary: 'x',
        current_focus_detail: {},
        rolling_summary: null,
        next_review_due_at: '2026-11-08T00:00:00Z',
        points: over.points ?? 0,
        tier: over.tier ?? 1,
      },
      weekOf: '2026-11-08',
      focus: { focus_type: 'training_volume', target_metric: 'sessions_completed', target_value: 3 },
      activity: {
        focus_type: 'training_volume',
        tables_read: ['ziko_workout_sessions'],
        metrics: {},
        window_start: 'a',
        window_end: 'b',
        evidence_source: 'real_activity_history',
      },
      comparison: {
        target_metric: 'sessions_completed',
        target_value: over.target === undefined ? 3 : over.target,
        actual_value: over.actual === undefined ? 3 : over.actual,
        met: over.met === undefined ? true : over.met,
      },
      recentDecisions: [],
      missPattern: { window: 3, missed: 0, pattern_of_misses: false },
    } as any;
  }

  function rpcByName(name: string) {
    return mockRpc.mock.calls.filter(([fn]) => fn === name);
  }

  it('writes points and tier (never level) in the same patch as the weekly decision', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'w1' }, error: null });
    await applyWeeklyDecision('u1', decision, ctx({ points: 10, tier: 1 }), 'weekly_review_cron', usage, 'm');
    const [, args] = rpcByName('ziko_record_athlete_decision')[0]!;
    expect(args.p_state_patch).toMatchObject({ points: 20, tier: 1 });
    expect(args.p_state_patch).not.toHaveProperty('level');
    expect(args.p_outcome).toMatchObject({ points_earned: 10, points_outcome: 'met', tier_up: false });
  });

  it('tier-up triggers a separate reward_grant step after the weekly decision', async () => {
    singles['ziko_athlete_state'] = { data: { tier: 2 }, error: null };
    tables['ziko_reward_catalog'] = { data: POOL, error: null };
    tables['ziko_athlete_rewards'] = { data: [], error: null };
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'a' }, usage: {} });
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'ziko_record_athlete_decision'
        ? { data: { success: true, decision_id: 'w1' }, error: null }
        : { data: { success: true, decision_id: 'g1' }, error: null },
    );

    const res = await applyWeeklyDecision('u1', decision, ctx({ points: 45, tier: 1 }), 'weekly_review_cron', usage, 'm');

    expect(mockRpc.mock.calls.map(([fn]) => fn)).toEqual(['ziko_record_athlete_decision', 'ziko_grant_reward']);
    expect(rpcByName('ziko_record_athlete_decision')[0]![1].p_state_patch).toMatchObject({ points: 55, tier: 2 });
    expect(res).toMatchObject({ success: true, decision_id: 'w1', rewards: [{ granted: true, tier: 2 }] });
  });

  it('a grant failure never loses the weekly decision', async () => {
    singles['ziko_athlete_state'] = { data: { tier: 2 }, error: null };
    tables['ziko_reward_catalog'] = { data: POOL, error: null };
    tables['ziko_athlete_rewards'] = { data: [], error: null };
    mockGenerateObject.mockResolvedValue({ object: { reward_id: 'a' }, usage: {} });
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'ziko_record_athlete_decision'
        ? { data: { success: true, decision_id: 'w1' }, error: null }
        : { data: null, error: { message: 'grant exploded' } },
    );
    const res = await applyWeeklyDecision('u1', decision, ctx({ points: 45, tier: 1 }), 'weekly_review_cron', usage, 'm');
    expect(res).toEqual({ success: true, decision_id: 'w1' });
  });

  it('a missed week at tier 3 keeps points and tier and grants nothing (reward never revoked)', async () => {
    tables['ziko_athlete_rewards'] = { data: [{ tier: 2 }, { tier: 3 }], error: null };
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'w1' }, error: null });
    const res = await applyWeeklyDecision(
      'u1', decision, ctx({ points: 160, tier: 3, met: false, actual: 0 }), 'weekly_review_cron', usage, 'm',
    );
    const [, args] = rpcByName('ziko_record_athlete_decision')[0]!;
    expect(args.p_state_patch).toMatchObject({ points: 160, tier: 3 });
    expect(args.p_outcome).toMatchObject({ points_earned: 0, points_outcome: 'missed', tier_up: false });
    expect(rpcByName('ziko_grant_reward')).toHaveLength(0);
    expect(res).toEqual({ success: true, decision_id: 'w1' });
  });

  it('a duplicate weekly fire short-circuits: no second points write and no grant', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'duplicate' }, error: null });
    const res = await applyWeeklyDecision('u1', decision, ctx({ points: 45, tier: 1 }), 'weekly_review_cron', usage, 'm');
    expect(res).toEqual({ success: false, reason: 'duplicate' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('weekly cost is logged through the shared helper with the weekly source', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'w1' }, error: null });
    await applyWeeklyDecision('u1', decision, ctx({}), 'app_open_fallback', usage, 'model-x');
    await flush();
    const cost = inserts.find((i) => i.table === 'ziko_ai_cost_log');
    expect(cost?.row).toMatchObject({ source: 'app_open_fallback', model: 'model-x', input_tokens: 5, output_tokens: 2 });
  });
});
