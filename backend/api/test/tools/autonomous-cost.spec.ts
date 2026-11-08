// Phase 47 (v1.18) OPS-03 — logAutonomousCost helper + its two call sites
// (retroactive recompute, onboarding stream). Pure unit spec, no live DB.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const inserts: Array<{ table: string; row: any }> = [];
let insertImpl: (row: any) => unknown = () => Promise.resolve({ error: null });
const mockRpc = vi.fn();
const mockGenerateObject = vi.fn();

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    maybeSingle: vi.fn(async () =>
      table === 'ziko_athlete_state'
        ? { data: null, error: null }
        : { data: { onboarding_done: true }, error: null }),
    insert: vi.fn((row: any) => {
      inserts.push({ table, row });
      return insertImpl(row);
    }),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  return chain;
}

vi.mock('../../src/tools/db.js', () => ({
  clientForUser: vi.fn(() => ({ from: (t: string) => makeChain(t), rpc: mockRpc })),
}));
vi.mock('ai', () => ({
  generateObject: (...a: unknown[]) => mockGenerateObject(...a),
  jsonSchema: vi.fn((s: unknown) => s),
}));
vi.mock('@ai-sdk/provider-utils', () => ({ zodSchema: vi.fn(() => ({ jsonSchema: {} })) }));

import { logAutonomousCost, SOURCES } from '../../src/lib/autonomousCost.js';
import { computeRetroactiveProfile } from '../../src/tools/onboarding-retroactive.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('logAutonomousCost', () => {
  beforeEach(() => {
    inserts.length = 0;
    insertImpl = () => Promise.resolve({ error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  const db = { from: (t: string) => makeChain(t) } as any;

  it('exports the autonomous source constants', () => {
    expect(Object.values(SOURCES)).toEqual(
      expect.arrayContaining([
        'weekly_review_cron', 'app_open_fallback', 'reward_selection',
        'onboarding_assess', 'onboarding_retroactive',
      ]),
    );
  });

  it('inserts one ziko_ai_cost_log row with the given source and token counts', () => {
    logAutonomousCost(db, { userId: 'u', model: 'm', usage: { inputTokens: 5, outputTokens: 7 }, source: SOURCES.rewardSelection });
    expect(inserts).toEqual([
      { table: 'ziko_ai_cost_log', row: { user_id: 'u', model: 'm', input_tokens: 5, output_tokens: 7, source: 'reward_selection' } },
    ]);
  });

  it('defaults missing usage to 0 tokens', () => {
    logAutonomousCost(db, { userId: 'u', model: 'm', usage: undefined, source: SOURCES.weeklyReviewCron });
    expect(inserts[0].row).toMatchObject({ input_tokens: 0, output_tokens: 0 });
  });

  it('swallows a synchronous throw', () => {
    insertImpl = () => { throw new Error('boom'); };
    expect(() => logAutonomousCost(db, { userId: 'u', model: 'm', usage: {}, source: SOURCES.appOpenFallback })).not.toThrow();
  });

  it('swallows an async rejection and a returned error', async () => {
    insertImpl = () => Promise.reject(new Error('net'));
    expect(() => logAutonomousCost(db, { userId: 'u', model: 'm', usage: {}, source: SOURCES.appOpenFallback })).not.toThrow();
    insertImpl = () => Promise.resolve({ error: { message: 'rls' } });
    logAutonomousCost(db, { userId: 'u', model: 'm', usage: {}, source: SOURCES.appOpenFallback });
    await flush();
  });

  it('never imports the credit gate', () => {
    const src = readFileSync(resolve(__dirname, '../../src/lib/autonomousCost.ts'), 'utf8');
    expect(src).not.toMatch(/^\s*import .*(creditGate|creditService)/m);
  });
});

describe('computeRetroactiveProfile cost logging', () => {
  beforeEach(() => {
    inserts.length = 0;
    insertImpl = () => Promise.resolve({ error: null });
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: { success: true, decision_id: 'd1' }, error: null });
    mockGenerateObject.mockReset();
    mockGenerateObject.mockResolvedValue({
      object: {
        experience_level: 'beginner', experience_confidence: 3, adherence_risk: 'low',
        adherence_confidence: 3, readiness: 'fragile', readiness_confidence: 3, profile_summary: 's',
      },
      usage: { inputTokens: 11, outputTokens: 22 },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('logs the call with source onboarding_retroactive and no credit rpc', async () => {
    const res = await computeRetroactiveProfile('u1');
    expect(res).toEqual({ success: true, decision_id: 'd1' });
    const rows = inserts.filter((i) => i.table === 'ziko_ai_cost_log');
    expect(rows).toHaveLength(1);
    expect(rows[0].row).toMatchObject({ user_id: 'u1', source: 'onboarding_retroactive', input_tokens: 11, output_tokens: 22 });
    expect(mockRpc.mock.calls.every((c) => !/credit/i.test(String(c[0])))).toBe(true);
  });

  it('a failing cost insert does not fail the recompute', async () => {
    insertImpl = () => { throw new Error('db down'); };
    await expect(computeRetroactiveProfile('u1')).resolves.toEqual({ success: true, decision_id: 'd1' });
  });
});

describe('onboarding stream cost source', () => {
  it('routes/onboarding.ts logs with SOURCES.onboardingAssess and no credit gate', () => {
    const src = readFileSync(resolve(__dirname, '../../src/routes/onboarding.ts'), 'utf8');
    expect(src).toContain('source: SOURCES.onboardingAssess');
    expect(SOURCES.onboardingAssess).toBe('onboarding_assess');
    expect(src).not.toMatch(/^\s*import .*creditGate/m);
  });
});
