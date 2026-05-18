// Serial IP + user-bucket rate limiter for /coach/clients/links/preview + /links/redeem
// (INVITE-04, T-25-03). Reuses the existing Upstash redis singleton.
// MUST run AFTER authMiddleware in route chain — needs c.get('auth').userId.
import { Ratelimit } from '@upstash/ratelimit';
import type { Context, Next } from 'hono';
import { redis } from '../../lib/redis.js';

// CONTEXT.md D-07: IP 5 / 15min, user 10 / hour (sliding window)
const ipBucket = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:redeem:ip',
});

const userBucket = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 m'),
  prefix: 'rl:redeem:user',
});

// Constant-time envelope shape (T-25-01). Byte-identical to 200 error envelope from db.ts.
// Preview path: { ok: false, error_code: 'INVALID_OR_EXPIRED', preview: null }
// Redeem path:  { ok: false, error_code: 'INVALID_OR_EXPIRED', link: null, preview: null }
function envelopeFor(path: string) {
  if (path.endsWith('/redeem')) {
    return {
      ok: false as const,
      error_code: 'INVALID_OR_EXPIRED' as const,
      link: null,
      preview: null,
    };
  }
  // default = preview shape
  return {
    ok: false as const,
    error_code: 'INVALID_OR_EXPIRED' as const,
    preview: null,
  };
}

function getClientIp(c: Context): string {
  return (
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function redemptionRateLimit(c: Context, next: Next) {
  const ip = getClientIp(c);

  try {
    // Step 1: IP bucket (fail-fast — don't burn user-bucket quota if IP is blown)
    const ipResult = await ipBucket.limit(ip);
    if (!ipResult.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((ipResult.reset - Date.now()) / 1000),
      );
      c.header('Retry-After', String(retryAfter));
      return c.json(envelopeFor(c.req.path), 429);
    }

    // Step 2: user bucket (key on auth.uid())
    const auth = c.get('auth');
    if (!auth?.userId) {
      // Should not happen — authMiddleware runs first. Fail closed.
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const userResult = await userBucket.limit(auth.userId);
    if (!userResult.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((userResult.reset - Date.now()) / 1000),
      );
      c.header('Retry-After', String(retryAfter));
      return c.json(envelopeFor(c.req.path), 429);
    }
  } catch (err) {
    // Redis unavailable — fail open to avoid blocking legitimate requests.
    // Rate limiting is a best-effort defence; losing it temporarily is acceptable.
    console.warn('[redemptionRateLimit] Redis unreachable, skipping rate limit:', (err as Error).message);
  }

  return next();
}
