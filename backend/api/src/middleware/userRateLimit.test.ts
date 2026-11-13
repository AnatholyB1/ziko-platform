/**
 * userRateLimit (audit securite v1.20) : 401 sans identite, 429 + Retry-After au-dela du plafond, passage sinon,
 * FAIL-OPEN si Redis est indisponible (anti-spam, pas une barriere), erreurs aval jamais avalees.
 * Ne prouve PAS : le comportement reel d'Upstash (mock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const h = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class { static slidingWindow = vi.fn(() => ({})); limit = h.limit; },
}));
vi.mock('../lib/redis.js', () => ({ redis: {} }));

import { userRateLimit } from './userRateLimit.js';

function app(withAuth = true) {
  const a = new Hono();
  a.use('*', async (c, next) => { if (withAuth) c.set('auth' as never, { userId: 'u1' } as never); return next(); });
  a.post('/x', userRateLimit(2, '1 m', 'test'), (c) => c.json({ ok: true }));
  a.post('/boom', userRateLimit(2, '1 m', 'test'), () => { throw new Error('downstream'); });
  a.onError((_e, c) => c.json({ error: 'downstream-failed' }, 500));
  return a;
}

beforeEach(() => { h.limit.mockReset(); });

describe('userRateLimit', () => {
  it('sans identite : 401', async () => {
    expect((await app(false).request('/x', { method: 'POST' })).status).toBe(401);
    expect(h.limit).not.toHaveBeenCalled();
  });
  it('sous le plafond : passe, cle = userId', async () => {
    h.limit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
    expect((await app().request('/x', { method: 'POST' })).status).toBe(200);
    expect(h.limit).toHaveBeenCalledWith('u1');
  });
  it('au-dela du plafond : 429 avec Retry-After, handler non execute', async () => {
    h.limit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });
    const res = await app().request('/x', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
  });
  it('Redis indisponible : requete autorisee (fail-open), erreur journalisee', async () => {
    h.limit.mockImplementation(async () => { throw new Error('redis down'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await app().request('/x', { method: 'POST' })).status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('une erreur du handler en aval n est pas avalee par le fail-open', async () => {
    h.limit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
    expect((await app().request('/boom', { method: 'POST' })).status).toBe(500);
  });
});
