import { Ratelimit, type Duration } from '@upstash/ratelimit';
import type { Context, Next } from 'hono';
import { redis } from '../lib/redis.js';

// D-01: 200 requests per 60 seconds per IP, sliding window (D-06)
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '60 s'),
  prefix: 'rl:ip',
});

// D-09: Routes that bypass the global IP rate limiter entirely
const EXEMPT_PATHS = new Set([
  '/health',
  '/plugins',
  '/supplements/categories',
  '/supplements/brands',
  '/supplements/search',
]);
const EXEMPT_PREFIXES = [
  '/webhooks/',
  '/supplements/cron/',
  '/storage/cron/',
];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  return EXEMPT_PREFIXES.some((p) => path.startsWith(p));
}

// D-14: IP key selection — x-real-ip (Vercel) > x-forwarded-for first entry > 'unknown'
function getClientIp(c: Context): string {
  return (
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function ipRateLimiter(c: Context, next: Next) {
  if (isExempt(c.req.path)) {
    return next();
  }

  const ip = getClientIp(c);
  const { success, reset } = await ipLimiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    // D-07: flat JSON body; D-08: Retry-After in seconds
    c.header('Retry-After', String(retryAfter));
    return c.json({ error: 'Rate limit exceeded', retryAfter }, 429);
  }

  return next();
}

// D-02/D-03/D-04: Per-user rate limiter factory with configurable thresholds
export function createUserRateLimiter(maxRequests: number, window: Duration, prefix: string) {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix: `rl:${prefix}`,
  });

  return async (c: Context, next: Next) => {
    // userId must be set by authMiddleware before this runs (per D-13)
    const auth = c.get('auth');
    if (!auth?.userId) {
      // Should not happen — authMiddleware runs first. Fail closed.
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { success, reset } = await limiter.limit(auth.userId);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Rate limit exceeded', retryAfter }, 429);
    }

    return next();
  };
}
