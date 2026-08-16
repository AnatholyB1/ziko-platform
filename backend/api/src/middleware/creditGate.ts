import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';
import * as creditService from '../services/creditService.js';
import { CREDIT_COSTS, type CreditAction } from '../config/credits.js';

// ─── Supabase Client ─────────────────────────────────────────
// Same pattern as middleware/auth.ts — service key for server-side queries
const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Context Variable Extension ──────────────────────────────
// Same augmentation pattern as auth.ts.
// creditPassThrough=true  → free quota slot (D-01/D-02), or the legacy premium
//   pass-through while the activation flag (CRED-05) is off — no deduction
// creditPassThrough=false → balance confirmed; creditDeduct will deduct after handler success
declare module 'hono' {
  interface ContextVariableMap {
    creditPassThrough: boolean;
  }
}

// ─── Ordering notes ──────────────────────────────────────────
// creditCheck MUST run AFTER authMiddleware (reads c.get('auth').userId)
// creditCheck MUST run BEFORE the handler (gates access, returns 402 if needed)
// creditDeduct MUST be placed after creditCheck in the middleware chain.
//   It calls await next() first, letting zValidator + the handler execute,
//   then inspects c.res.status once all downstream middleware has completed.
//
// Streaming note (/ai/chat/stream):
//   HTTP 200 is sent before the stream body completes — status is set when the
//   stream response object is created, not when the last SSE event is written.
//   Errors within the stream are SSE events (type:'error'), not HTTP 4xx/5xx.
//   creditDeduct will therefore see status 200 and charge credit.
//   This matches Anthropic's billing model: tokens are counted per request
//   even on partial/interrupted streams.

/**
 * creditCheck(action) — factory returning a Hono middleware.
 *
 * Gate logic (in order):
 *  1. CRED-05: read the activation flag from app_config. A missing/errored read,
 *     or any value that is not the JS boolean `true`, is treated as flag-off —
 *     the failure mode always degrades to the more permissive legacy behavior,
 *     never to a stricter one.
 *  2. Flag off: run the legacy tier read and pass through premium users
 *     unconditionally (today's shipped behavior, reproduced exactly). Flag on:
 *     skip the tier read entirely — premium and free users run identical code
 *     from here down, and the premium advantage is balance size alone (D-03),
 *     funded by the separate monthly grant.
 *  3. D-01/D-02: first-N-free daily quota pass-through (withinFreeQuota=true)
 *  4. D-04: insufficient balance → 402 with rich JSON body
 *  5. Otherwise: balance sufficient, set creditPassThrough=false, continue
 */
export function creditCheck(action: CreditAction) {
  return async (c: Context, next: Next) => {
    const userId = c.get('auth').userId;

    // ── CRED-05: activation flag read ────────────────────────
    // Re-read on every request — no module-level cache, no env var, no
    // build-time constant. Optional chaining means an errored or missing
    // read (or any non-boolean-true value, e.g. the JSONB trap of a JS
    // string 'true') evaluates to flag-off, the fail-safe direction.
    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'premium_credit_cap_enabled')
      .single();

    const capEnabled = config?.value === true;

    if (!capEnabled) {
      // ── Legacy path: reproduces today's premium pass-through exactly ──
      // Rule-1 fix (04-01): user_profiles' PK column is `id`, not `user_id`
      // (verified against 001_initial_schema.sql and context/user.ts:49's
      // correct `.eq('id', userId)` read of this same table). The prior
      // `.eq('user_id', userId)` filtered on a nonexistent column, which
      // PostgREST rejects — profile always came back null, so the tier
      // condition below never actually resolved true in production,
      // regardless of tier.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      if (profile?.tier === 'premium') {
        c.set('creditPassThrough', true);
        return next();
      }
    }

    // ── D-01/D-02: Free quota pass-through ──────────────────
    const quota = await creditService.getQuotaStatus(userId, action);

    if (quota.withinFreeQuota) {
      c.set('creditPassThrough', true);
      return next();
    }

    // ── D-04: Check balance ──────────────────────────────────
    const cost = CREDIT_COSTS[action];

    if (quota.balance < cost) {
      // D-09: Add earned_today sources for exhaustion sheet
      const todayUTC = new Date().toISOString().split('T')[0];
      const { data: earnedRows } = await supabase
        .from('ai_credit_transactions')
        .select('source')
        .eq('user_id', userId)
        .eq('type', 'earn')
        .gte('created_at', `${todayUTC}T00:00:00Z`);

      // Deduplicate sources (Pitfall 4 from RESEARCH.md)
      const earned_today = [...new Set((earnedRows ?? []).map((r: any) => r.source))];

      // Reset timestamp = next UTC midnight
      const now = new Date();
      const reset_timestamp = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      )).toISOString();

      return c.json(
        {
          error: 'insufficient_credits',
          balance: quota.balance,
          required: cost,
          daily_used: quota.dailyUsed,
          daily_quota: quota.dailyQuota,
          earn_hint: quota.earnHint,
          earned_today,
          reset_timestamp,
        },
        402,
      );
    }

    // Balance confirmed — creditDeduct will charge after handler success
    c.set('creditPassThrough', false);
    return next();
  };
}

/**
 * creditDeduct(action) — factory returning a Hono middleware.
 *
 * Runs AFTER the handler (calls await next() first so the full downstream chain executes).
 * Only deducts when:
 *  - creditPassThrough is false (not a free-quota slot, and not the legacy
 *    premium pass-through while the activation flag is off)
 *  - Handler responded with status < 400 (SC5: no charge on failure)
 *
 * Uses X-Request-Id header as idempotency key when provided by the client,
 * otherwise generates a UUID. Fire-and-forget — deduction errors do NOT fail
 * the HTTP response.
 */
export function creditDeduct(action: CreditAction) {
  return async (c: Context, next: Next) => {
    // Handler (and all downstream middleware including zValidator) runs first
    await next();

    // Free-quota slot, or the legacy premium pass-through while the activation
    // flag is off — track usage so getQuotaStatus advances, then skip deduction
    if (c.get('creditPassThrough') === true) {
      const userId = c.get('auth').userId;
      const idempotencyKey = c.req.header('X-Request-Id') ?? crypto.randomUUID();
      creditService
        .trackQuotaUsage(userId, action, idempotencyKey)
        .catch(() => {});
      return;
    }

    // SC5: Do not charge on handler failure
    if (c.res.status >= 400) {
      return;
    }

    const userId = c.get('auth').userId;
    const idempotencyKey = c.req.header('X-Request-Id') ?? crypto.randomUUID();

    // Fire-and-forget: deduction errors must not fail the response the client already received
    creditService
      .deductCredits(userId, action, idempotencyKey)
      .catch((err) => {
        console.error('[creditDeduct] deduction failed:', err);
      });
  };
}
