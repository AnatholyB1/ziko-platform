import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Upstash requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// If those env vars are absent (e.g. local dev using a standard Redis URL instead),
// Redis.fromEnv() would throw "Failed to parse URL from /pipeline" at module load time
// and crash every SSR page that imports this module.
//
// Solution: lazy singletons — instantiate only on first .limit() call, and only when
// the required env vars are present. When they are absent, .limit() returns a no-op
// success so the app still works without Upstash configured.

function isUpstashConfigured(): boolean {
  return (
    typeof process.env.UPSTASH_REDIS_REST_URL === 'string' &&
    process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
    typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string' &&
    process.env.UPSTASH_REDIS_REST_TOKEN.length > 0
  );
}

function makeRatelimit(limiter: ReturnType<typeof Ratelimit.slidingWindow>, prefix: string): Ratelimit {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter,
    prefix,
  });
}

// Lazy singleton pattern — one instance per limiter, created on first use.
let _ratelimit: Ratelimit | null = null;
let _rolePromotionRatelimit: Ratelimit | null = null;
let _kycUploadRatelimit: Ratelimit | null = null;

const noopLimiter = {
  limit: async (_identifier: string) => ({ success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() }),
};

export const ratelimit = {
  limit: async (identifier: string) => {
    if (!isUpstashConfigured()) return noopLimiter.limit(identifier);
    if (!_ratelimit) _ratelimit = makeRatelimit(Ratelimit.slidingWindow(5, '60 s'), 'ziko:delete');
    return _ratelimit.limit(identifier);
  },
};

export const rolePromotionRatelimit = {
  limit: async (identifier: string) => {
    if (!isUpstashConfigured()) return noopLimiter.limit(identifier);
    if (!_rolePromotionRatelimit) _rolePromotionRatelimit = makeRatelimit(Ratelimit.slidingWindow(3, '60 s'), 'ziko:role-promotion');
    return _rolePromotionRatelimit.limit(identifier);
  },
};

export const kycUploadRatelimit = {
  limit: async (identifier: string) => {
    if (!isUpstashConfigured()) return noopLimiter.limit(identifier);
    if (!_kycUploadRatelimit) _kycUploadRatelimit = makeRatelimit(Ratelimit.slidingWindow(10, '60 s'), 'ziko:kyc-upload');
    return _kycUploadRatelimit.limit(identifier);
  },
};
