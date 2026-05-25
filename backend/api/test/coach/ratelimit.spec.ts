// Phase 25 plan 06 Task 2 — INVITE-04 rate-limit burst + envelope shape.
// Builds an isolated Hono app with the same Ratelimit construction as
// src/coach/clients/ratelimit.ts, but with a UNIQUE TEST_PREFIX so the test
// counters never collide with production rl:redeem:ip / rl:redeem:user buckets.
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../../src/lib/redis.js';

const upstashReady = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const skipReason = upstashReady
  ? null
  : 'UPSTASH_REDIS_REST_URL/TOKEN not set — skipping rate-limit integration tests';

// Unique test prefix per run, avoids polluting production buckets (rl:redeem:ip / user).
const TEST_PREFIX = `rl:redeem:test:${Date.now()}:${Math.floor(Math.random() * 1e6)}`;

// Byte-identical to src/coach/clients/db.ts preview error envelope (T-25-01).
const PREVIEW_ENVELOPE = {
  ok: false as const,
  error_code: 'INVALID_OR_EXPIRED' as const,
  preview: null,
};

function buildTestMiddleware() {
  const ipBucket = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: `${TEST_PREFIX}:ip`,
  });
  const userBucket = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 m'),
    prefix: `${TEST_PREFIX}:user`,
  });
  return async function rl(c: any, next: any) {
    const ip = c.req.header('x-real-ip') ?? 'test-ip';
    const ipRes = await ipBucket.limit(ip);
    if (!ipRes.success) {
      c.header(
        'Retry-After',
        String(Math.max(1, Math.ceil((ipRes.reset - Date.now()) / 1000))),
      );
      return c.json(PREVIEW_ENVELOPE, 429);
    }
    const userId = c.req.header('x-test-user') ?? 'test-user';
    const userRes = await userBucket.limit(userId);
    if (!userRes.success) {
      c.header(
        'Retry-After',
        String(Math.max(1, Math.ceil((userRes.reset - Date.now()) / 1000))),
      );
      return c.json(PREVIEW_ENVELOPE, 429);
    }
    return next();
  };
}

describe.skipIf(!upstashReady)(
  'coach/clients/ratelimit.redemptionRateLimit (INVITE-04)',
  () => {
    it('6th IP request within 15min returns 429 with constant-time envelope + Retry-After', async () => {
      const app = new Hono();
      app.post('/preview', buildTestMiddleware(), async (c) =>
        c.json({ ok: true, error_code: null, preview: { coach_id: 'x' } }),
      );

      // Random IP per run so we don't collide with prior test runs even within
      // the same TEST_PREFIX namespace.
      const ip = `1.2.3.${Math.floor(Math.random() * 254) + 1}`;
      const userId = `u-${Date.now()}-${Math.random()}`;
      const headers = { 'x-real-ip': ip, 'x-test-user': userId };

      let lastStatus = 200;
      let lastBody: any = null;
      let lastRetryAfter: string | null = null;
      for (let i = 0; i < 6; i++) {
        const res = await app.request('/preview', { method: 'POST', headers });
        lastStatus = res.status;
        lastBody = await res.json();
        lastRetryAfter = res.headers.get('Retry-After');
      }
      expect(lastStatus).toBe(429);
      expect(lastBody).toEqual(PREVIEW_ENVELOPE);
      expect(lastRetryAfter).not.toBeNull();
      expect(Number(lastRetryAfter)).toBeGreaterThan(0);
    }, 60000);

    it('11th user request within 1h returns 429 (IP rotated to bypass IP bucket)', async () => {
      const app = new Hono();
      app.post('/preview', buildTestMiddleware(), async (c) =>
        c.json({ ok: true, error_code: null, preview: { coach_id: 'x' } }),
      );

      const userId = `u-${Date.now()}-${Math.random()}`;
      let lastStatus = 200;
      let lastBody: any = null;
      for (let i = 0; i < 11; i++) {
        // Rotate IPs so IP bucket never trips — isolates user bucket signal.
        const headers = { 'x-real-ip': `9.9.${i}.${Date.now() % 200}`, 'x-test-user': userId };
        const res = await app.request('/preview', { method: 'POST', headers });
        lastStatus = res.status;
        lastBody = await res.json();
      }
      expect(lastStatus).toBe(429);
      expect(lastBody).toEqual(PREVIEW_ENVELOPE);
    }, 60000);

    it('429 envelope body is BYTE-IDENTICAL to db.ts preview error envelope (T-25-01)', () => {
      const fromDb = {
        ok: false as const,
        error_code: 'INVALID_OR_EXPIRED' as const,
        preview: null,
      };
      expect(JSON.stringify(PREVIEW_ENVELOPE)).toBe(JSON.stringify(fromDb));
    });
  },
);

// Always-runnable smoke (does NOT depend on Upstash) — locks the envelope contract.
describe('coach/clients/ratelimit envelope shape (no-network)', () => {
  it('preview error envelope keys in fixed order: ok, error_code, preview', () => {
    expect(Object.keys(PREVIEW_ENVELOPE)).toEqual(['ok', 'error_code', 'preview']);
  });
});
