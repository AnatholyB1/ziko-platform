/**
 * Unit tests for creditGate.ts's creditCheck middleware (Phase 4, v1.16 — CRED-02, CRED-05).
 *
 * Drives creditCheck('chat') through a real Hono app with @supabase/supabase-js and
 * ../services/creditService.js mocked. Mirrors the coach/videos/service.test.ts house
 * pattern: mock external deps, import the module under test after the mocks are
 * registered, drive the router with constructed Request objects.
 *
 * CREDIT_COSTS.chat = 4 (backend/api/src/config/credits.ts) — used throughout to pick
 * balances above/below cost.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ── Mock: @supabase/supabase-js ───────────────────────────────────────────────
// `.from()` is a spy so tests can assert on which tables were queried (and which
// were NOT — the "no tier read on the enforcing path" property). Each table's
// query builder is a thenable chain: `.select().eq().single()` resolves the
// configured value, and awaiting the chain directly (no `.single()`, as the
// insufficient-credits path does for `ai_credit_transactions`) resolves the same
// value.
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

function makeChain(finalValue: unknown) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(finalValue));
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(finalValue).then(resolve, reject);
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// ── Mock: creditService ───────────────────────────────────────────────────────
vi.mock('../services/creditService.js', () => ({
  getQuotaStatus: vi.fn(),
  trackQuotaUsage: vi.fn(),
  deductCredits: vi.fn(),
}));

// Import AFTER mocks are registered
import { creditCheck } from './creditGate.js';
import * as creditService from '../services/creditService.js';

const mockGetQuotaStatus = vi.mocked(creditService.getQuotaStatus);

// ── Test helpers ───────────────────────────────────────────────────────────────

interface MockTables {
  appConfig: { data: { value: unknown } | null; error: unknown };
  userProfile?: { data: { tier: string } | null; error: unknown };
  txRows?: { data: unknown[]; error: unknown };
}

function setupSupabaseMocks({ appConfig, userProfile, txRows }: MockTables) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'app_config') return makeChain(appConfig);
    if (table === 'user_profiles') {
      if (!userProfile) throw new Error('Unexpected query against user_profiles (no tier read expected)');
      return makeChain(userProfile);
    }
    if (table === 'ai_credit_transactions') return makeChain(txRows ?? { data: [], error: null });
    throw new Error(`Unexpected table queried: ${table}`);
  });
}

function buildApp(handlerSpy = vi.fn((c) => c.json({ ok: true }))) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('auth', { userId: 'user-1', email: 'user-1@example.com' });
    await next();
  });
  app.get('/test', creditCheck('chat'), handlerSpy);
  return { app, handlerSpy };
}

const FLAG_OFF = { data: { value: false }, error: null };
const FLAG_ON = { data: { value: true }, error: null };
const FLAG_ERROR = { data: null, error: { message: 'app_config unreachable' } };
const FLAG_STRING_TRUE = { data: { value: 'true' }, error: null };

const PREMIUM = { data: { tier: 'premium' }, error: null };
const FREE = { data: { tier: 'free' }, error: null };

const QUOTA_EXHAUSTED_LOW_BALANCE = {
  withinFreeQuota: false,
  dailyUsed: 5,
  dailyQuota: 5,
  balance: 0,
  earnHint: 'Log a workout to earn credits',
};
const QUOTA_EXHAUSTED_SUFFICIENT_BALANCE = {
  withinFreeQuota: false,
  dailyUsed: 5,
  dailyQuota: 5,
  balance: 10,
  earnHint: 'Log a workout to earn credits',
};
const WITHIN_FREE_QUOTA = {
  withinFreeQuota: true,
  dailyUsed: 0,
  dailyQuota: 5,
  balance: 0,
  earnHint: 'Log a workout to earn credits',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('creditCheck — flag off (legacy path, CRED-05 default)', () => {
  it('premium tier: next() runs, creditPassThrough=true, getQuotaStatus never called', async () => {
    setupSupabaseMocks({ appConfig: FLAG_OFF, userProfile: PREMIUM });
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(mockGetQuotaStatus).not.toHaveBeenCalled();
  });

  it('free tier, quota exhausted, balance below cost: 402 insufficient_credits (anti-regression: flag-off is not a global bypass)', async () => {
    setupSupabaseMocks({ appConfig: FLAG_OFF, userProfile: FREE, txRows: { data: [], error: null } });
    mockGetQuotaStatus.mockResolvedValue(QUOTA_EXHAUSTED_LOW_BALANCE);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(402);
    expect(body.error).toBe('insufficient_credits');
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('free tier, within free quota: next() runs, creditPassThrough=true', async () => {
    setupSupabaseMocks({ appConfig: FLAG_OFF, userProfile: FREE });
    mockGetQuotaStatus.mockResolvedValue(WITHIN_FREE_QUOTA);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });
});

describe('creditCheck — flag on (enforcing path, CRED-02)', () => {
  it('premium tier, quota exhausted, balance below cost: 402 with the same body keys a free user gets', async () => {
    setupSupabaseMocks({ appConfig: FLAG_ON, txRows: { data: [], error: null } });
    mockGetQuotaStatus.mockResolvedValue(QUOTA_EXHAUSTED_LOW_BALANCE);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body).toEqual(
      expect.objectContaining({
        error: 'insufficient_credits',
        balance: expect.any(Number),
        required: expect.any(Number),
        daily_used: expect.any(Number),
        daily_quota: expect.any(Number),
        earn_hint: expect.any(String),
        earned_today: expect.any(Array),
        reset_timestamp: expect.any(String),
      }),
    );
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('premium tier, within free quota: next() runs, creditPassThrough=true', async () => {
    setupSupabaseMocks({ appConfig: FLAG_ON });
    mockGetQuotaStatus.mockResolvedValue(WITHIN_FREE_QUOTA);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });

  it('balance at or above cost, quota exhausted: next() runs, creditPassThrough=false', async () => {
    setupSupabaseMocks({ appConfig: FLAG_ON });
    mockGetQuotaStatus.mockResolvedValue(QUOTA_EXHAUSTED_SUFFICIENT_BALANCE);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });

  it('never queries user_profiles on the enforcing path (no tier read while flag is on)', async () => {
    setupSupabaseMocks({ appConfig: FLAG_ON });
    mockGetQuotaStatus.mockResolvedValue(WITHIN_FREE_QUOTA);
    const { app } = buildApp();

    await app.request('/test');

    expect(mockFrom).not.toHaveBeenCalledWith('user_profiles');
  });
});

describe('creditCheck — app_config failure modes (CRED-05 fail-safe)', () => {
  it('app_config read error: gate behaves as flag-off — premium passes through', async () => {
    setupSupabaseMocks({ appConfig: FLAG_ERROR, userProfile: PREMIUM });
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(mockGetQuotaStatus).not.toHaveBeenCalled();
  });

  it('app_config read error: gate behaves as flag-off — free user with exhausted balance still gets 402', async () => {
    setupSupabaseMocks({ appConfig: FLAG_ERROR, userProfile: FREE, txRows: { data: [], error: null } });
    mockGetQuotaStatus.mockResolvedValue(QUOTA_EXHAUSTED_LOW_BALANCE);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    expect(res.status).toBe(402);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('app_config value is the JS string "true": does not enable the cap — premium still bypasses on a low balance', async () => {
    setupSupabaseMocks({ appConfig: FLAG_STRING_TRUE, userProfile: PREMIUM });
    mockGetQuotaStatus.mockResolvedValue(QUOTA_EXHAUSTED_LOW_BALANCE);
    const { app, handlerSpy } = buildApp();

    const res = await app.request('/test');

    // If the string 'true' incorrectly enabled the cap, the premium user's exhausted
    // quota + zero balance would 402 here. Only the JS boolean `true` may enable it.
    expect(res.status).toBe(200);
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });
});
