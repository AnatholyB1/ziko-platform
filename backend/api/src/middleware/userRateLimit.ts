import { Ratelimit, type Duration } from '@upstash/ratelimit';
import type { Context, Next } from 'hono';
import { redis } from '../lib/redis.js';

/**
 * Limiteur par utilisateur pour les routes qui declenchent un cout IA absorbe ou un travail serveur
 * (audit securite v1.20, constat B : /quests/refresh, /league/refresh, /ai/workshop/relaunch/*, /ai/tools/execute).
 * Fenetre glissante Upstash, cle = userId (authMiddleware doit s'executer avant).
 * Difference avec createUserRateLimiter : FAIL-OPEN si Redis est indisponible (log serveur, la requete passe). Ces routes
 * sont deja bornees par des plafonds en base ; le limiteur n'est qu'un anti-spam, il ne doit pas couper la fonctionnalite
 * sur une panne Redis. Les erreurs en aval (next) ne sont jamais avalees.
 */
export function userRateLimit(maxRequests: number, window: Duration, prefix: string) {
  let limiter: Ratelimit | undefined;
  return async (c: Context, next: Next) => {
    const userId = c.get('auth')?.userId;
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    try {
      limiter ??= new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, window),
        prefix: `rl:${prefix}`,
      });
      const { success, reset } = await limiter.limit(userId);
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        c.header('Retry-After', String(retryAfter));
        return c.json({ error: 'Rate limit exceeded', retryAfter }, 429);
      }
    } catch (err) {
      console.error(`[userRateLimit:${prefix}] limiter unavailable, request allowed:`, err instanceof Error ? err.message : err);
    }
    return next();
  };
}
