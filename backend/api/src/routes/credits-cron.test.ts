/**
 * Unit tests for routes/credits-cron.ts (Phase 4 plan 04-02, v1.16 — CRED-03,
 * T-04-06). Mocks @supabase/supabase-js and ../services/creditService.js,
 * mounts the exported router on a fresh local Hono instance under the same
 * `/credits` prefix app.ts uses, and drives it with constructed Request
 * objects carrying only an authorization header — no Supabase JWT anywhere
 * in this file, which is what makes the first case meaningful.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('../services/creditService.js', () => ({
  grantMonthlyPremiumCredits: vi.fn(),
}));

// Import AFTER the mocks are registered
import { creditsCronRouter } from './credits-cron.js';
import * as creditService from '../services/creditService.js';

const mockGrant = vi.mocked(creditService.grantMonthlyPremiumCredits);

function buildApp() {
  const app = new Hono();
  app.route('/credits', creditsCronRouter);
  return app;
}

function makeChain(finalValue: unknown) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.then = (onResolve: (v: unknown) => unknown, onReject?: (e: unknown) => unknown) =>
    Promise.resolve(finalValue).then(onResolve, onReject);
  return chain;
}

function makeRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/credits/cron/premium-grant', { headers });
}

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
});

afterEach(() => {
  if (ORIGINAL_CRON_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  }
});

describe('GET /credits/cron/premium-grant', () => {
  it('returns 200 for a request whose only credential is the cron bearer token — no Supabase JWT anywhere in this test', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: [], error: null }));
    const app = buildApp();

    const res = await app.fetch(makeRequest({ authorization: 'Bearer test-cron-secret' }));

    expect(res.status).toBe(200);
  });

  it('returns 401 and calls the grant service zero times for a wrong bearer token', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: [{ id: 'u1' }], error: null }));
    const app = buildApp();

    const res = await app.fetch(makeRequest({ authorization: 'Bearer wrong-token' }));

    expect(res.status).toBe(401);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it('with three premium users, the grant wrapper is called exactly three times, once per user id', async () => {
    mockFrom.mockImplementation(() =>
      makeChain({ data: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }], error: null }),
    );
    mockGrant.mockResolvedValue({ granted: true });
    const app = buildApp();

    const res = await app.fetch(makeRequest({ authorization: 'Bearer test-cron-secret' }));
    const json = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(mockGrant).toHaveBeenCalledTimes(3);
    expect(mockGrant).toHaveBeenCalledWith('u1');
    expect(mockGrant).toHaveBeenCalledWith('u2');
    expect(mockGrant).toHaveBeenCalledWith('u3');
    expect(json.granted).toBe(3);
  });

  it('when the middle user rejects, the route still returns 200, still calls the third user, and reports one failure', async () => {
    mockFrom.mockImplementation(() =>
      makeChain({ data: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }], error: null }),
    );
    mockGrant
      .mockResolvedValueOnce({ granted: true })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ granted: true });
    const app = buildApp();

    const res = await app.fetch(makeRequest({ authorization: 'Bearer test-cron-secret' }));
    const json = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(mockGrant).toHaveBeenCalledTimes(3);
    expect(json.failed).toBe(1);
    expect(json.granted).toBe(2);
  });

  it('when a grant resolves falsy, that user is counted as skipped rather than granted or failed', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: [{ id: 'u1' }], error: null }));
    mockGrant.mockResolvedValue({ granted: false });
    const app = buildApp();

    const res = await app.fetch(makeRequest({ authorization: 'Bearer test-cron-secret' }));
    const json = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(json.skipped).toBe(1);
    expect(json.granted).toBe(0);
    expect(json.failed).toBe(0);
  });

  it('when the premium-user query errors, the route returns 500 and calls the grant service for nobody', async () => {
    mockFrom.mockImplementation(() => makeChain({ data: null, error: { message: 'db down' } }));
    const app = buildApp();

    const res = await app.fetch(makeRequest({ authorization: 'Bearer test-cron-secret' }));

    expect(res.status).toBe(500);
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it('structural: the vercel.json cron path equals the app.ts mount prefix joined with the route path this router registers', () => {
    const vercelJson = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf-8'));
    const cronEntry = vercelJson.crons.find((entry: any) => entry.path.includes('premium-grant'));
    expect(cronEntry).toBeDefined();

    const appTs = readFileSync(resolve(__dirname, '../app.ts'), 'utf-8');
    const mountMatch = appTs.match(/app\.route\('([^']+)',\s*creditsCronRouter\)/);
    expect(mountMatch).not.toBeNull();
    const mountPrefix = mountMatch![1];

    const cronTs = readFileSync(resolve(__dirname, './credits-cron.ts'), 'utf-8');
    const routeMatch = cronTs.match(/creditsCronRouter\.get\('([^']+)'/);
    expect(routeMatch).not.toBeNull();
    const routePath = routeMatch![1];

    expect(mountPrefix + routePath).toBe(cronEntry.path);
  });
});
