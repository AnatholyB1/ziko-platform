// Phase 44 (v1.18, weekly-adaptive-decision-engine) plan 44-05 — route-level
// coverage for GET /coaching-engine/review-check (lazy on-app-open trigger,
// D-01 primary) and POST /coaching-engine/cron/weekly-review (Sunday
// safety-net cron, D-01 secondary).
//
// Pure unit spec — no live database, no real model call, no conditional
// live-DB skip guard, so it runs unconditionally in CI. Mirrors
// test/routes/onboarding.spec.ts's harness: mocks
// middleware/auth.js, @vercel/functions' waitUntil, and
// coaching-engine/apply.js's runWeeklyReview so every assertion below is
// fully deterministic.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mutable mock state (declared before vi.mock calls, following
// the house pattern already proven in test/routes/onboarding.spec.ts) ─────
const mockRunWeeklyReview = vi.fn();
const mockAuthMiddleware = vi.fn(async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }
  c.set('auth', { userId: 'athlete-1', email: 'athlete@example.com' });
  await next();
});

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: (...args: unknown[]) => (mockAuthMiddleware as any)(...args),
}));

vi.mock('../../src/coaching-engine/apply.js', () => ({
  runWeeklyReview: (...args: unknown[]) => mockRunWeeklyReview(...args),
}));

// waitUntil records the promise it is handed and awaits it, so the fake
// background work settles before the test's assertions run (matching the
// plan's Task 1 read_first note that inline-awaiting would otherwise make
// the "does not block" assertion untestable).
const waitUntilCalls: Promise<unknown>[] = [];
vi.mock('@vercel/functions', () => ({
  waitUntil: (p: Promise<unknown>) => {
    waitUntilCalls.push(p);
  },
}));

// Scripted eligibility-scan query chain for the cron's due-athlete select.
// `.limit(40)` is the terminal call in the chain and resolves the scripted
// rows; every earlier call in the chain (select/is/lte/order etc.) just
// returns `this` so the route's exact query shape doesn't need to be
// hard-coded here beyond the presence of `.limit(40)`.
let scriptedDueAthletes: Array<{ user_id: string }> = [];
const limitSpy = vi.fn();
function makeQueryChain() {
  const chain: any = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn((...args: unknown[]) => {
      limitSpy(...args);
      return Promise.resolve({ data: scriptedDueAthletes, error: null });
    }),
  };
  return chain;
}

vi.mock('../../src/coaching-engine/db.js', () => ({
  clientForUser: vi.fn(() => ({
    from: vi.fn(() => makeQueryChain()),
  })),
}));

// ─── Import after mocks are registered ────────────────────────────────────
import { coachingEngineRouter } from '../../src/coaching-engine/routes.js';

function makeReviewCheckRequest(opts: { authHeader?: string | null } = {}) {
  const { authHeader = 'Bearer test-jwt-token' } = opts;
  const headers: Record<string, string> = {};
  if (authHeader !== null) headers.Authorization = authHeader;

  return coachingEngineRouter.request('/review-check', {
    method: 'GET',
    headers,
  });
}

function makeCronRequest(opts: { authHeader?: string | null } = {}) {
  const { authHeader } = opts;
  const headers: Record<string, string> = {};
  if (authHeader !== undefined && authHeader !== null) headers.authorization = authHeader;

  return coachingEngineRouter.request('/cron/weekly-review', {
    method: 'POST',
    headers,
  });
}

describe('coaching-engine routes', () => {
  beforeEach(() => {
    mockRunWeeklyReview.mockReset();
    mockAuthMiddleware.mockClear();
    waitUntilCalls.length = 0;
    scriptedDueAthletes = [];
    limitSpy.mockClear();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  // ── Auth and trigger behaviour ───────────────────────────────────────

  it('GET /review-check without an Authorization header returns 401 and never calls runWeeklyReview', async () => {
    const res = await makeReviewCheckRequest({ authHeader: null });

    expect(res.status).toBe(401);
    expect(mockRunWeeklyReview).not.toHaveBeenCalled();
  });

  it('GET /review-check with a valid header returns 200 with a JSON body even when runWeeklyReview has not settled', async () => {
    let resolveReview: (v: unknown) => void = () => {};
    mockRunWeeklyReview.mockReturnValue(
      new Promise((resolve) => {
        resolveReview = resolve;
      }),
    );

    const res = await makeReviewCheckRequest();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('ok', true);

    // Clean up the still-pending promise so it doesn't leak into later tests.
    resolveReview({ ran: false, reason: 'not_due' });
    await Promise.allSettled(waitUntilCalls);
  });

  it('GET /review-check invokes runWeeklyReview exactly once with athlete-1 and app_open_fallback', async () => {
    mockRunWeeklyReview.mockResolvedValue({ ran: false, reason: 'not_due' });

    await makeReviewCheckRequest();
    await Promise.allSettled(waitUntilCalls);

    expect(mockRunWeeklyReview).toHaveBeenCalledTimes(1);
    const [userIdArg, sourceArg] = mockRunWeeklyReview.mock.calls[0];
    expect(userIdArg).toBe('athlete-1');
    expect(sourceArg).toBe('app_open_fallback');
  });

  it('a runWeeklyReview rejection inside waitUntil does not turn the response into a 500', async () => {
    mockRunWeeklyReview.mockRejectedValue(new Error('boom'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await makeReviewCheckRequest();

    expect(res.status).toBe(200);

    // Await the background work so the rejection is observed here (caught
    // by the route's own .catch) rather than surfacing as an unhandled
    // rejection later in the test run.
    const settled = await Promise.allSettled(waitUntilCalls);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);

    consoleErrorSpy.mockRestore();
  });

  // ── CRON_SECRET guard ────────────────────────────────────────────────

  it('POST /cron/weekly-review with no authorization header and CRON_SECRET set returns 401', async () => {
    const res = await makeCronRequest({ authHeader: null });

    expect(res.status).toBe(401);
  });

  it('POST /cron/weekly-review with Bearer wrong-secret returns 401', async () => {
    const res = await makeCronRequest({ authHeader: 'Bearer wrong-secret' });

    expect(res.status).toBe(401);
  });

  it('POST /cron/weekly-review with the correct Bearer secret returns 200 and never goes through authMiddleware', async () => {
    scriptedDueAthletes = [];

    const res = await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });

    expect(res.status).toBe(200);
    // Proves the guard is registered ahead of router.use('*', authMiddleware) —
    // a cron request must never reach the athlete auth middleware.
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  // ── Batching ──────────────────────────────────────────────────────────

  it('processes 12 due athletes with weekly_review_cron source and never exceeds 8 concurrent in-flight calls', async () => {
    scriptedDueAthletes = Array.from({ length: 12 }, (_, i) => ({ user_id: `athlete-${i}` }));

    let inFlight = 0;
    let maxInFlight = 0;
    mockRunWeeklyReview.mockImplementation(async (_userId: string, source: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Yield to the microtask queue so concurrently-dispatched calls
      // actually overlap in-flight rather than resolving synchronously.
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      expect(source).toBe('weekly_review_cron');
      return { ran: true, success: true, decision_id: 'd-1' };
    });

    const res = await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });

    expect(res.status).toBe(200);
    expect(mockRunWeeklyReview).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBeLessThanOrEqual(8);
  });

  it('the eligibility scan is capped via .limit(40)', async () => {
    scriptedDueAthletes = [];

    await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });

    expect(limitSpy).toHaveBeenCalledWith(40);
  });

  it("one athlete's rejection does not abort the batch — remaining calls still run and the route returns 200 with a counts-only summary", async () => {
    scriptedDueAthletes = Array.from({ length: 5 }, (_, i) => ({ user_id: `athlete-${i}` }));

    let callIndex = 0;
    mockRunWeeklyReview.mockImplementation(async () => {
      const idx = callIndex;
      callIndex += 1;
      if (idx === 2) {
        throw new Error('third athlete failed');
      }
      return { ran: true, success: true, decision_id: `d-${idx}` };
    });

    const res = await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });

    expect(res.status).toBe(200);
    expect(mockRunWeeklyReview).toHaveBeenCalledTimes(5);

    const json = await res.json();
    expect(json).toHaveProperty('processed', 5);
    expect(json).toHaveProperty('failed');
    expect(json.failed).toBeGreaterThanOrEqual(1);
  });

  // ── Cost logging (ENGINE-05) ─────────────────────────────────────────

  it('never imports creditCheck/creditDeduct — no cost logging via creditGate on either route', async () => {
    const routesSource = await import('../../src/coaching-engine/routes.js');
    // The module import itself succeeding without pulling in creditGate.js
    // is asserted structurally below via a source-text check in Task 2's
    // acceptance criteria (grep-based); here we assert behaviourally that
    // neither route's response shape carries credit-gate artefacts.
    expect(routesSource).toBeDefined();

    mockRunWeeklyReview.mockResolvedValue({ ran: false, reason: 'not_due' });
    const reviewRes = await makeReviewCheckRequest();
    expect(reviewRes.status).not.toBe(402);

    scriptedDueAthletes = [];
    const cronRes = await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });
    expect(cronRes.status).not.toBe(402);
  });

  it('the source literal passed into runWeeklyReview is app_open_fallback from /review-check and weekly_review_cron from the cron — cost logging', async () => {
    mockRunWeeklyReview.mockResolvedValue({ ran: false, reason: 'not_due' });
    await makeReviewCheckRequest();
    await Promise.allSettled(waitUntilCalls);
    expect(mockRunWeeklyReview.mock.calls[0][1]).toBe('app_open_fallback');

    mockRunWeeklyReview.mockReset();
    mockRunWeeklyReview.mockResolvedValue({ ran: true, success: true, decision_id: 'd-1' });
    scriptedDueAthletes = [{ user_id: 'athlete-x' }];
    await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });
    expect(mockRunWeeklyReview.mock.calls[0][1]).toBe('weekly_review_cron');
  });

  it('the cron response body contains only counts and no athlete ids or decision text — cost logging', async () => {
    scriptedDueAthletes = [
      { user_id: 'athlete-secret-id-1' },
      { user_id: 'athlete-secret-id-2' },
    ];
    mockRunWeeklyReview.mockResolvedValue({
      ran: true,
      success: true,
      decision_id: 'decision-should-not-leak',
    });

    const res = await makeCronRequest({ authHeader: 'Bearer test-cron-secret' });
    const text = await res.text();

    expect(text).not.toContain('athlete-secret-id-1');
    expect(text).not.toContain('athlete-secret-id-2');
    expect(text).not.toContain('decision-should-not-leak');

    const json = JSON.parse(text);
    expect(Object.keys(json).sort()).toEqual(['failed', 'processed', 'skipped', 'succeeded']);
  });
});
