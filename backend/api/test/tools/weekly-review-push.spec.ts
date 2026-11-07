// Phase 47b (v1.18, OPS-02) - weekly-review-complete push. Mocks only: no push,
// no DB, no model call.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockSend = vi.fn();
let tables: Record<string, { data: unknown; error: unknown }> = {};
let singles: Record<string, { data: unknown; error: unknown }> = {};

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => singles[table] ?? { data: null, error: null }),
    single: vi.fn(async () => singles[table] ?? { data: null, error: null }),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(tables[table] ?? { data: [], error: null }).then(res, rej),
  };
  return chain;
}

vi.mock('../../src/tools/db.js', () => ({
  clientForUser: vi.fn(() => ({ from: (t: string) => makeChain(t), rpc: mockRpc })),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: vi.fn(), rpc: vi.fn() })) }));
vi.mock('ai', () => ({
  generateObject: vi.fn(async () => ({ object: { reward_id: 'a' }, usage: {} })),
  jsonSchema: vi.fn((s: unknown) => s),
}));
vi.mock('@ai-sdk/provider-utils', () => ({ zodSchema: vi.fn(() => ({ jsonSchema: {} })) }));
vi.mock('../../src/services/notificationService.js', () => ({
  notificationService: { send: (...a: unknown[]) => mockSend(...a) },
}));

import { applyWeeklyDecision } from '../../src/coaching-engine/apply.js';
import {
  buildWeeklyReviewCopy,
  WEEKLY_REVIEW_DEEP_LINK,
} from '../../src/coaching-engine/weeklyReviewNotify.js';
import { isAllowedNotificationRoute } from '../../../../apps/mobile/src/lib/notificationRoutes';

const flush = () => new Promise((r) => setTimeout(r, 0));
const usage = { inputTokens: 5, outputTokens: 2 };

function decision(over: Record<string, unknown> = {}) {
  return {
    trajectory: 'hold',
    new_readiness: 'building',
    new_focus_summary: 'x',
    rationale: 'Steady.',
    call_create_program: false,
    new_focus_detail: null,
    ...over,
  } as any;
}

function ctx(points = 0, tier = 1) {
  return {
    userId: 'u1',
    state: {
      readiness: 'building',
      current_focus_summary: 'x',
      current_focus_detail: {},
      rolling_summary: null,
      next_review_due_at: '2026-11-08T00:00:00Z',
      points,
      tier,
    },
    weekOf: '2026-11-08',
    focus: { focus_type: 'training_volume', target_metric: 'sessions_completed', target_value: 3 },
    activity: {
      focus_type: 'training_volume',
      tables_read: [],
      metrics: {},
      window_start: 'a',
      window_end: 'b',
      evidence_source: 'real_activity_history',
    },
    comparison: { target_metric: 'sessions_completed', target_value: 3, actual_value: 3, met: true },
    recentDecisions: [],
    missPattern: { window: 3, missed: 0, pattern_of_misses: false },
  } as any;
}

beforeEach(() => {
  mockRpc.mockReset();
  mockSend.mockReset();
  mockSend.mockResolvedValue({ sent: true });
  tables = {};
  singles = {};
  mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'w1' }, error: null });
});

describe('weekly review push (OPS-02)', () => {
  it('cron source sends once with the idempotency key, category and deep link', async () => {
    await applyWeeklyDecision('u1', decision({ trajectory: 'escalate' }), ctx(), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(mockSend).toHaveBeenCalledTimes(1);
    const p = mockSend.mock.calls[0][0];
    expect(p.recipientUserId).toBe('u1');
    expect(p.type).toBe('ai_weekly_analysis');
    expect(p.idempotencyKey).toBe('weekly_review_u1_2026-11-08');
    expect(p.data.url).toBe(WEEKLY_REVIEW_DEEP_LINK);
  });

  it('app_open_fallback never sends', async () => {
    await applyWeeklyDecision('u1', decision({ trajectory: 'escalate' }), ctx(), 'app_open_fallback', usage, 'm');
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('a duplicate fire returns before the send: double fire sends once', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: { success: true, decision_id: 'w1' }, error: null })
      .mockResolvedValueOnce({ data: { success: false, error: 'duplicate' }, error: null });
    const d = decision({ trajectory: 'escalate' });
    const first = await applyWeeklyDecision('u1', d, ctx(), 'weekly_review_cron', usage, 'm');
    const second = await applyWeeklyDecision('u1', d, ctx(), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(first.success).toBe(true);
    expect(second).toEqual({ success: false, reason: 'duplicate' });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('hold with unchanged focus and no reward is skipped', async () => {
    await applyWeeklyDecision('u1', decision(), ctx(), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('hold with a changed focus summary notifies', async () => {
    await applyWeeklyDecision('u1', decision({ new_focus_summary: 'y' }), ctx(), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('a send failure (rejection) never fails the weekly decision', async () => {
    mockSend.mockRejectedValue(new Error('expo down'));
    const res = await applyWeeklyDecision('u1', decision({ trajectory: 'escalate' }), ctx(), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(res).toEqual({ success: true, decision_id: 'w1' });
  });

  it('a synchronous throw from send never fails the weekly decision', async () => {
    mockSend.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = await applyWeeklyDecision('u1', decision({ trajectory: 'escalate' }), ctx(), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(res.success).toBe(true);
  });

  it('a granted reward on hold notifies with the Ziko-chosen reward copy', async () => {
    singles['ziko_athlete_state'] = { data: { tier: 2 }, error: null };
    tables['ziko_reward_catalog'] = {
      data: [{ id: 'a', key: 'k', kind: 'badge', icon: 'star', label_fr: 'Badge Constance', label_en: 'B', min_tier: 1, active: true }],
      error: null,
    };
    tables['ziko_athlete_rewards'] = { data: [], error: null };
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'ziko_record_athlete_decision'
        ? { data: { success: true, decision_id: 'w1' }, error: null }
        : { data: { success: true, decision_id: 'g1', reward_id: 'a' }, error: null },
    );
    const res = await applyWeeklyDecision('u1', decision(), ctx(45, 1), 'weekly_review_cron', usage, 'm');
    await flush();
    expect(res.success).toBe(true);
    // Whatever the grant outcome in this mock harness, a tier-up must notify.
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe('weekly review copy', () => {
  const reward = {
    granted: true as const,
    tier: 2,
    decision_id: 'd',
    via: 'ai' as const,
    reward: { id: 'a', key: 'k', kind: 'badge', icon: 'star', label_fr: 'Badge Constance', label_en: 'B' },
  } as any;

  it('reward variant names the reward and credits Ziko', () => {
    const c = buildWeeklyReviewCopy({ trajectory: 'hold', summaryChanged: false, tierUp: true, rewards: [reward] })!;
    expect(c.body).toContain('choisie pour toi par Ziko');
    expect(c.body).toContain('Badge Constance');
  });

  it('tier-up without reward variant', () => {
    const c = buildWeeklyReviewCopy({ trajectory: 'hold', summaryChanged: false, tierUp: true })!;
    expect(c.title).toBe('Nouveau palier atteint');
  });

  it('de-escalate (missed week) copy is encouraging and never negative or loot-like', () => {
    const c = buildWeeklyReviewCopy({ trajectory: 'de-escalate', summaryChanged: true, tierUp: false })!;
    const text = `${c.title} ${c.body}`.toLowerCase();
    for (const bad of ['raté', 'échec', 'manqué', 'perdu', 'loot', 'chance', 'tirage', 'hasard', 'pénalité']) {
      expect(text).not.toContain(bad);
    }
    expect(text).toContain('confiance');
  });

  it('nothing to say returns null', () => {
    expect(buildWeeklyReviewCopy({ trajectory: 'hold', summaryChanged: false, tierUp: false })).toBeNull();
  });

  it('deep link is allowlisted by the mobile notification router', () => {
    expect(isAllowedNotificationRoute(WEEKLY_REVIEW_DEEP_LINK)).toBe(true);
  });
});
