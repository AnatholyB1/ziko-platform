# Phase 18: Credit Service + Middleware - Research

**Researched:** 2026-04-05
**Domain:** Hono middleware composition, Supabase RPC wrapping, TypeScript service layer, PostgreSQL daily-quota patterns
**Confidence:** HIGH

## Summary

Phase 18 is a pure backend TypeScript phase. It delivers three files: `backend/api/src/config/credits.ts` (cost and quota constants), `backend/api/src/services/creditService.ts` (all credit math), and `backend/api/src/middleware/creditGate.ts` (middleware pair). The DB foundation is already in place from Phase 17 — the `user_ai_credits` table, `ai_credit_transactions` ledger, `deduct_ai_credits` RPC, and `tier` column on `user_profiles` are all live. This phase wraps those DB primitives in TypeScript.

The most important design constraint is the deduction ordering: `creditCheck` must run **before** the handler to gate access (returning 402 if balance is insufficient or quota is exhausted), and `creditDeduct` must run **after** the handler returns a successful status (< 400) to avoid charging for failed AI calls. This is structurally the same pattern already used by `createUserRateLimiter` in `rateLimiter.ts` — the difference is that deduction is not a pre-check but an after-handler side effect.

The first-N-free quota model (CONTEXT.md D-01 through D-03) means balance display in mobile is "earned credits only" — the daily base allocation is a pass-through that does not touch the balance at all. The middleware pair needs to count today's `ai_credit_transactions` of type `deduct` for the requesting action before deciding whether to pass, pass-through, or deduct.

**Primary recommendation:** Model `creditGate.ts` after `rateLimiter.ts` (factory function returning middleware), use `c.set()` for passing credit context to handlers, perform all quota math in `creditService.ts` not inline in middleware, and rely exclusively on the `deduct_ai_credits` RPC for any actual balance change.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Daily base allocation uses first-N-free pass-through — middleware counts today's usage per action type in `ai_credit_transactions`. If usage < quota, the action passes without deduction. No credits are granted upfront, no cron needed.
- **D-02:** Unified pass-through for both base and bonus — total daily quota = base + earned bonus (e.g., scan quota = 1 base + 2 earned = 3 max free). One simple counter per action type. Once total quota exhausted, deduct from credit balance.
- **D-03:** Monthly base (1 program/month) uses the same pattern — count `ai_credit_transactions` WHERE type='deduct' AND source='program' in current calendar month.
- **D-04:** Credit exhaustion returns a rich 402 response: `{ error: 'insufficient_credits', balance, required, daily_used, daily_quota, earn_hint }`. The mobile app gets everything it needs for the CRED-05 exhaustion bottom sheet in a single response, no extra API call.
- **D-05:** `earn_hint` is the next earnable activity suggestion (e.g., "log a workout to earn credits") — computed by creditService from today's earn state.
- **D-06:** `creditService.ts` lives in a new `services/` directory: `backend/api/src/services/creditService.ts`. Establishes the services layer pattern for business logic, separate from routes, middleware, and infrastructure.
- **D-07:** Middleware pair lives at `backend/api/src/middleware/creditGate.ts` — follows the existing `auth.ts` and `rateLimiter.ts` pattern in `middleware/`.
- **D-08:** Per-action costs and daily/monthly quotas defined in `backend/api/src/config/credits.ts` — next to `models.ts`. Exported as `CREDIT_COSTS` and `DAILY_QUOTAS` const objects. creditService imports them.
- **D-09:** Known costs: scan = 3 credits, chat = 4 credits, program = 4 credits. Barcode scan = free (OFF API, no AI).
- **D-10:** Known quotas: base 1 scan + 1 chat/day, 1 program/month. Bonus +2 scan + 2 chat/day, +1 program/month (earned by activity).

### Claude's Discretion

- Exact TypeScript types/interfaces for creditService exports
- Middleware attachment pattern in Hono (wrapper vs afterResponse hook) — as long as SC5 is met (deduct only on handler success)
- Internal helper functions within creditService (query builders, date utilities)
- Error handling patterns for Supabase RPC call failures

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-02 | User receives a daily base allocation (1 photo scan + 1 AI chat) without any activity | D-01/D-02: first-N-free pass-through counts today's `ai_credit_transactions` by action type; quota math in `creditService.getDailyUsage()`; middleware reads result before deducting |
| CRED-03 | User receives 1 free AI program generation per month without any activity | D-03: count `deduct` transactions WHERE source='program' in current calendar month; same pattern as daily but window is `date_trunc('month', NOW())` |
| EARN-07 | User's daily earned credits are capped (bonus max not exceeded) | `creditService.earnCredits()` checks sum of today's earn transactions before inserting; cap enforced by query, not cron |
| EARN-10 | Earned credits are idempotent (mobile retry does not double-credit) | Phase 17 already created `UNIQUE (user_id, source, idempotency_key)` partial index on `ai_credit_transactions`; `earnCredits()` uses `INSERT ... ON CONFLICT DO NOTHING` |
| PREM-02 | Credit gate middleware checks tier before deducting credits | `creditCheck` reads `user_profiles.tier` via `c.get('auth').userId`; if `tier = 'premium'` call `next()` immediately without any query or deduction |
</phase_requirements>

---

## Standard Stack

### Core (verified from `backend/api/package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | ^4.7.0 | Middleware composition | Project standard; `creditGate.ts` follows identical pattern to `auth.ts` + `rateLimiter.ts` |
| `@supabase/supabase-js` | ^2.50.0 | Supabase queries + RPC calls | Project standard; `creditService.ts` calls `.rpc('deduct_ai_credits', ...)` and `.from('ai_credit_transactions').select(...)` |
| `zod` | ^4.3.6 | Runtime validation of RPC response shape | Already present; validate `deduct_ai_credits` JSONB return |
| `typescript` | ^5.7.2 | Static typing for service interfaces | Project standard |

### Supporting (no new installs required)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` (service key) | same | Admin queries for credit balance | `creditService.ts` needs a service-role client to bypass RLS for server-side credit checks; reuse pattern from `auth.ts` |

**Installation:** No new packages needed. Phase 18 uses only existing dependencies.

---

## Architecture Patterns

### New Files to Create

```
backend/api/src/
├── config/
│   ├── models.ts          (exists — do not modify)
│   └── credits.ts         (NEW — D-08: CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS)
├── services/
│   └── creditService.ts   (NEW — D-06: all credit math)
└── middleware/
    ├── auth.ts            (exists — do not modify)
    ├── rateLimiter.ts     (exists — do not modify)
    └── creditGate.ts      (NEW — D-07: creditCheck, creditDeduct)
```

### Pattern 1: Config Constants File (credits.ts)

Follows `models.ts` exactly — exported `const` objects with `UPPER_SNAKE_CASE` naming.

```typescript
// Source: backend/api/src/config/models.ts (project pattern)
// backend/api/src/config/credits.ts

export const CREDIT_COSTS = {
  chat: 4,
  scan: 3,
  program: 4,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const DAILY_QUOTAS = {
  // base = free without any earned bonus
  // bonus = additional quota earned via activity (Phase 18 reads total = base + bonus earned today)
  chat:  { base: 1, bonus: 2 },
  scan:  { base: 1, bonus: 2 },
} as const;

export const MONTHLY_QUOTAS = {
  program: { base: 1, bonus: 1 },
} as const;
```

**Key insight:** `bonus` here represents the *maximum* additional quota that can be granted by activity earn (Phase 20 sets earned state). Phase 18 reads total free passes as `base + bonusEarnedToday` — but in Phase 18 alone, `bonusEarnedToday` will always be 0 until Phase 20 wires earn hooks. The quota math must handle 0 earned bonus correctly without breaking.

### Pattern 2: Service Layer (creditService.ts)

Supabase client usage follows `tools/db.ts` pattern for service-role client. All functions are `async`, return typed results.

```typescript
// Source: project pattern from backend/api/src/middleware/auth.ts + supabase/migrations/026_ai_credits.sql
// backend/api/src/services/creditService.ts

import { createClient } from '@supabase/supabase-js';
import { CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS, type CreditAction } from '../config/credits.js';

// Service-role client (bypasses RLS — safe for server-side balance reads)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Returns balance, creates default row if brand-new user (SC1)
export async function getBalance(userId: string): Promise<{ balance: number }> { ... }

// Enforces daily earn cap; idempotent via ON CONFLICT DO NOTHING (SC2, SC3, EARN-07, EARN-10)
export async function earnCredits(userId: string, source: string, idempotencyKey: string): Promise<void> { ... }

// Wraps deduct_ai_credits RPC — atomic, no negative balance possible (CRED-06 already satisfied by Phase 17)
export async function deductCredits(
  userId: string,
  action: CreditAction,
  idempotencyKey: string
): Promise<{ success: boolean; balance: number; required?: number }> { ... }

// Used by creditCheck to determine pass-through, deduct-from-balance, or 402 (D-01, D-02, D-03)
export async function getQuotaStatus(
  userId: string,
  action: CreditAction
): Promise<{
  withinFreeQuota: boolean;
  dailyUsed: number;
  dailyQuota: number;
  balance: number;
  earnHint: string;
}> { ... }
```

**`getBalance` upsert pattern (SC1):**
```typescript
// Upsert ensures brand-new users (who somehow didn't trigger the welcome trigger) get a row
const { data, error } = await supabase
  .from('user_ai_credits')
  .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
  .select('balance')
  .single();
```

**`earnCredits` daily cap pattern (SC2, SC3, EARN-07, EARN-10):**
```typescript
// 1. Count today's earn transactions for this user
const today = new Date().toISOString().split('T')[0];
const { count } = await supabase
  .from('ai_credit_transactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('type', 'earn')
  .gte('created_at', `${today}T00:00:00Z`);

// 2. If already at cap, return without inserting (SC2)
const EARN_CAP = DAILY_QUOTAS.chat.bonus + DAILY_QUOTAS.scan.bonus; // = 4 total bonus slots
if ((count ?? 0) >= EARN_CAP) return;

// 3. Insert with ON CONFLICT DO NOTHING — idempotency via unique index (SC3, EARN-10)
await supabase.from('ai_credit_transactions').insert({
  user_id: userId,
  type: 'earn',
  amount: EARN_AMOUNT,
  source,
  idempotency_key: idempotencyKey,
}).onConflict('user_id, source, idempotency_key').ignoreDuplicates();

// 4. Increment balance
await supabase.from('user_ai_credits')
  .update({ balance: supabase.raw('balance + ?', [EARN_AMOUNT]) })
  .eq('user_id', userId);
```

**Note:** The Supabase JS v2 client `.ignoreDuplicates()` maps to `ON CONFLICT DO NOTHING`. Confirm exact API: `{ count: 'exact' }` returns the count in the response metadata.

**`getQuotaStatus` daily usage count pattern (D-01, D-02):**
```typescript
// Count today's pass-through usages (type='deduct', source=action, created_at=today)
// If count < total_quota (base + earned_bonus_today), withinFreeQuota = true
const today = new Date().toISOString().split('T')[0];
const { count: dailyUsed } = await supabase
  .from('ai_credit_transactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('source', action)
  .gte('created_at', `${today}T00:00:00Z`);
```

**`earn_hint` computation (D-05):**
```typescript
// Simple lookup: check which earn sources have not yet fired today
// Return the first one that hasn't: "log a workout", "log a meal", etc.
// Phase 18 can return a static hint; Phase 20 wires real earn-source state
const EARN_HINTS: string[] = [
  'log a workout to earn credits',
  'complete your habits to earn credits',
  'log a meal to earn credits',
];
```

### Pattern 3: Hono Middleware Pair (creditGate.ts)

The critical design is that `creditDeduct` must fire **after** the handler returns success. In Hono, middleware can inspect the response status after `await next()`. This is the same mechanism used by logging middleware.

```typescript
// Source: backend/api/src/middleware/auth.ts + rateLimiter.ts (project patterns)
// backend/api/src/middleware/creditGate.ts

import type { Context, Next } from 'hono';
import * as creditService from '../services/creditService.js';
import type { CreditAction } from '../config/credits.js';

// creditCheck — runs BEFORE handler; gates on balance and quota (SC4, SC6)
export function creditCheck(action: CreditAction) {
  return async (c: Context, next: Next) => {
    const { userId } = c.get('auth');

    // PREM-02: premium users bypass all credit checks (SC6)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('user_id', userId)
      .single();
    if (profile?.tier === 'premium') return next();

    const quota = await creditService.getQuotaStatus(userId, action);

    if (quota.withinFreeQuota) {
      // Still within free daily/monthly quota — pass through without deduction
      c.set('creditPassThrough', true);
      return next();
    }

    // Outside free quota — check balance
    const cost = CREDIT_COSTS[action];
    if (quota.balance < cost) {
      // Rich 402 response (D-04)
      return c.json({
        error: 'insufficient_credits',
        balance: quota.balance,
        required: cost,
        daily_used: quota.dailyUsed,
        daily_quota: quota.dailyQuota,
        earn_hint: quota.earnHint,
      }, 402);
    }

    // Has balance — allow handler to run, deduct after
    c.set('creditPassThrough', false);
    return next();
  };
}

// creditDeduct — runs AFTER handler; deducts only on success (SC5)
export function creditDeduct(action: CreditAction) {
  return async (c: Context, next: Next) => {
    await next(); // handler runs first

    // Only deduct on handler success and when not in pass-through mode
    const passThrough = c.get('creditPassThrough');
    if (passThrough) return; // free quota slot used, no deduction
    if (c.res.status >= 400) return; // handler failed — do not charge (SC5)

    const { userId } = c.get('auth');
    const idempotencyKey = c.req.header('X-Request-Id') ?? crypto.randomUUID();

    await creditService.deductCredits(userId, action, idempotencyKey).catch((err) => {
      console.error('[creditDeduct] deduction failed after success:', err);
      // Fire-and-forget: do not fail the response if deduction logging fails
    });
  };
}
```

**SC5 mechanics:** In Hono, calling `await next()` within a middleware suspends until all downstream middleware and the handler complete. The response status is readable from `c.res.status` after `next()` returns. This is the idiomatic Hono pattern — confirmed by `hono/logger` source which uses the same `await next()` + inspect pattern.

**SC6 mechanics:** The `tier` column was added in Phase 17 migration 026 with `DEFAULT 'free'`. Query reads one column from `user_profiles` — extremely fast. No caching needed at Phase 18 scale.

### Pattern 4: Context Variable Extension

`creditPassThrough` is a new context variable. Extend `ContextVariableMap` to keep TypeScript happy — same pattern as `auth.ts`:

```typescript
// In creditGate.ts
declare module 'hono' {
  interface ContextVariableMap {
    creditPassThrough: boolean;
  }
}
```

### Pattern 5: Middleware Chain Insertion in ai.ts

The middleware is applied **per-route** (not globally) so only AI routes that cost credits are gated. The insertion point is after the existing rate limiter and before `zValidator`:

```typescript
// Source: backend/api/src/routes/ai.ts (existing pattern)
// Before (existing):
router.post('/chat', aiChatLimiter, zValidator('json', chatSchema), async (c) => { ... });

// After (Phase 18):
router.post('/chat',
  aiChatLimiter,
  creditCheck('chat'),    // gate before
  zValidator('json', chatSchema),
  creditDeduct('chat'),   // deduct after (wraps handler)
  async (c) => { ... }
);
```

**Note on middleware ordering:** `creditCheck` must come **after** `authMiddleware` (already applied via `router.use('*', authMiddleware)` at top of ai.ts) because it reads `c.get('auth').userId`. `creditDeduct` must wrap the handler. Both are route-level middleware, not global.

### Anti-Patterns to Avoid

- **Deducting before the handler runs:** The pattern `creditCheck → deduct → handler` would charge credits on failed AI calls. Always use the two-middleware split.
- **Storing credit state in Redis:** Per SUMMARY.md and STATE.md accumulated decisions — Redis is rate-limiting only. Credits must persist in Supabase for audit trail.
- **Application-layer check-then-decrement:** Never read the balance in TypeScript and then subtract. The `deduct_ai_credits` RPC with `FOR UPDATE` lock is the only safe deduction path under Vercel Fluid Compute concurrent requests.
- **Global credit middleware:** Apply only to specific AI routes. `/health`, `/plugins`, `/webhooks` must never run credit checks.
- **Calling `deductCredits()` inside `creditCheck`:** Check and deduction are separate operations. Only `creditDeduct` (post-handler) calls the RPC.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic balance deduction | Custom check-then-update | `deduct_ai_credits` RPC (Phase 17) | RPC uses `FOR UPDATE` row lock — eliminates race under Vercel Fluid Compute concurrent requests |
| Idempotency enforcement | In-memory dedup cache | `UNIQUE (user_id, source, idempotency_key)` partial index + `ON CONFLICT DO NOTHING` | DB-level constraint survives serverless cold starts and concurrent instances |
| Daily quota counter | Redis incr with TTL | Supabase `ai_credit_transactions` count query | Credits need audit trail; Redis eviction would lose the quota counter between deploys |
| Tier lookup cache | Module-level Map | Direct Supabase query per request | At Phase 18 scale one column query is <1ms; premature optimization; cache invalidation complexity not worth it |

**Key insight:** Every "performance" shortcut in the credit system trades durability for speed. At freemium scale the database is fast enough; correctness is the only constraint that matters.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 18 is a greenfield service layer addition, not a rename/refactor/migration phase. No stored string keys or registered runtime state are modified.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | TypeScript execution | Yes | 25.7.0 | — |
| Supabase (026 migration applied) | `user_ai_credits`, `deduct_ai_credits` RPC | Must verify | — | Phase 18 cannot run without Phase 17 migration applied |
| `@supabase/supabase-js` | creditService.ts | Yes | ^2.50.0 (package.json) | — |
| `hono` | creditGate.ts middleware | Yes | ^4.7.0 (package.json) | — |
| `zod` | RPC response validation | Yes | ^4.3.6 (package.json) | — |

**Missing dependencies with no fallback:**
- Phase 17 migration `026_ai_credits.sql` must be applied to Supabase before any creditService code can run. The planner should treat this as a verification step in Wave 0 (confirm table exists).

**Missing dependencies with fallback:**
- None.

---

## Common Pitfalls

### Pitfall 1: creditDeduct Firing on Streaming Responses
**What goes wrong:** For `/ai/chat/stream`, the handler returns a `Response` with a readable stream body. The HTTP status is set to 200 before the stream finishes — `c.res.status` is 200 even if the AI later errors mid-stream.
**Why it happens:** SSE streams set status 200 at the start of the response headers; errors are sent as `data: {"type":"error",...}` events inside the stream, not as HTTP 4xx.
**How to avoid:** Accept this behavior for stream routes — if headers are sent with 200, credit is deducted. This matches real-world AI billing (Anthropic charges per token even on partial responses). Document this decision in comments.
**Warning signs:** Users reporting credits deducted on "failed" chats — these are actually successful HTTP responses with error events inside the stream.

### Pitfall 2: Daily Quota Counter Off-By-One at Midnight
**What goes wrong:** UTC midnight reset uses `T00:00:00Z` but the mobile user is in a different timezone — their "day" ends at a different time.
**Why it happens:** The lazy date-keyed query uses `gte('created_at', \`${today}T00:00:00Z\`)` where `today` is computed server-side in UTC.
**How to avoid:** UTC midnight reset is intentional per project decisions (consistent, simple, no timezone table needed). Document clearly in code comments so future developers don't "fix" it to local time.
**Warning signs:** None at Phase 18 — this is an accepted design choice, not a bug.

### Pitfall 3: Premium Tier Query on Every Request
**What goes wrong:** `creditCheck` queries `user_profiles` on every AI request even for free users, adding latency.
**Why it happens:** No caching of tier status — each middleware invocation does a fresh SELECT.
**How to avoid:** The query is a single-column select on a primary-key lookup (`user_id`). PostgreSQL will use the index and return in <1ms. Accept this at Phase 18 scale. If profiling shows it matters, cache in the JWT claims (Phase 21 concern, not Phase 18).
**Warning signs:** Supabase dashboard shows very high `user_profiles` read volume from backend service key.

### Pitfall 4: getQuotaStatus and creditCheck Making Separate Balance Reads
**What goes wrong:** `getQuotaStatus` reads balance from `user_ai_credits`, then if outside free quota, `creditCheck` reads it again — two reads before the handler runs, then `creditDeduct` calls the RPC.
**Why it happens:** Separating quota logic from deduction logic causes redundant reads.
**How to avoid:** Pass balance from `getQuotaStatus` result into context so `creditDeduct` has the pre-call balance without re-reading. Use `c.set('preCallBalance', quota.balance)` for logging purposes. The RPC is still the authoritative deduction.
**Warning signs:** Double Supabase reads visible in request tracing.

### Pitfall 5: earn_hint Returning Stale Suggestions
**What goes wrong:** `earn_hint` suggests "log a workout" even though the user logged three workouts today but hits a different earn cap.
**Why it happens:** Phase 18 builds earn_hint logic without Phase 20's earn hooks in place — no real data to check.
**How to avoid:** In Phase 18, return a static rotation of hints. Phase 20 can update `getQuotaStatus` to query today's earn transactions by source and exclude already-earned sources from the hint list.
**Warning signs:** Users clicking earn_hint CTA and finding no credit awarded.

### Pitfall 6: Monthly Program Quota — Wrong Date Truncation
**What goes wrong:** Monthly quota check uses `>= first-day-of-month` — computed as `new Date().toISOString().substring(0, 7) + '-01T00:00:00Z'`. This is correct for UTC but off by one if server clock is near month boundary.
**Why it happens:** String manipulation of ISO date.
**How to avoid:** Use `date_trunc('month', NOW())` directly in the Supabase query via a raw filter, or compute the first-of-month in UTC consistently: `new Date(Date.UTC(year, month, 1)).toISOString()`.
**Warning signs:** Users getting extra free programs at the month boundary.

---

## Code Examples

Verified patterns from existing project sources:

### Hono Middleware After-Handler Pattern
```typescript
// Source: hono/logger pattern (standard Hono documentation)
export function creditDeduct(action: CreditAction) {
  return async (c: Context, next: Next) => {
    await next(); // handler completes, response is populated
    if (c.res.status < 400) {
      // safe to deduct — handler succeeded
    }
  };
}
```

### Supabase Count Query
```typescript
// Source: @supabase/supabase-js v2 official docs
const { count, error } = await supabase
  .from('ai_credit_transactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('source', action)
  .gte('created_at', `${today}T00:00:00Z`);
// count is number | null
```

### Supabase RPC Call (deduct_ai_credits)
```typescript
// Source: supabase/migrations/026_ai_credits.sql — RPC signature
const { data, error } = await supabase.rpc('deduct_ai_credits', {
  p_user_id: userId,
  p_cost: cost,
  p_action_type: action,
  p_idempotency_key: idempotencyKey,
});
// data: { success: boolean, balance_after?: number, balance?: number, required?: number }
```

### Supabase Upsert (getBalance with missing-row creation)
```typescript
// Source: @supabase/supabase-js v2 official docs — upsert with ignoreDuplicates
const { data, error } = await supabase
  .from('user_ai_credits')
  .upsert(
    { user_id: userId, balance: 0 },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )
  .select('balance')
  .single();
```

### Hono Context Variable Extension (declare module)
```typescript
// Source: backend/api/src/middleware/auth.ts (project pattern)
declare module 'hono' {
  interface ContextVariableMap {
    creditPassThrough: boolean;
  }
}
```

### Route-Level Middleware Pair Attachment
```typescript
// Source: backend/api/src/routes/ai.ts (existing route pattern)
router.post('/chat',
  aiChatLimiter,
  creditCheck('chat'),
  zValidator('json', chatSchema),
  creditDeduct('chat'),
  async (c) => { /* handler */ }
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Check balance in app code, then subtract | `SECURITY DEFINER` RPC with `FOR UPDATE` row lock | Vercel Fluid Compute (early 2025) | Concurrent requests share instance — app-layer guard fails |
| Cron job for daily quota reset | Lazy date-keyed check at earn/deduct time | Phase 17 decision | Eliminates Vercel at-least-once cron delivery double-reset risk |
| Redis for credit balance | Supabase PostgreSQL only for credits | Phase 17 decision | Redis eviction destroys audit trail; credits need durable ledger |

---

## Open Questions

1. **CREDIT_COSTS calibration from Phase 17**
   - What we know: Phase 17 should have run `messages.countTokens` with the actual system prompt to size costs; STATE.md mentions this as a concern
   - What's unclear: Whether Phase 17 actually completed this calibration and what the measured token counts were
   - Recommendation: Planner should include a verification task at Wave 0 to confirm `CREDIT_COSTS` values are calibrated. If Phase 17 did not run calibration, the Phase 18 planner must either (a) accept the D-09 estimates as Phase 17 decisions, or (b) add a calibration task before freezing `credits.ts`.

2. **earnCredits balance increment — relative UPDATE vs RPC**
   - What we know: `deduct_ai_credits` uses `FOR UPDATE` + relative `UPDATE balance = balance - cost` to prevent races. Earn operations could have the same race.
   - What's unclear: Whether `earnCredits` needs the same `FOR UPDATE` protection or if a relative `UPDATE balance = balance + amount` without a lock is sufficient (earn races result in balance being correct, unlike deduct races which can go negative).
   - Recommendation: Relative UPDATE without lock is safe for earn (balance += N cannot go negative); only deduction needs the lock. A simple `UPDATE user_ai_credits SET balance = balance + :amount WHERE user_id = :userId` is sufficient.

3. **Supabase JS upsert `.select()` after `ignoreDuplicates: true`**
   - What we know: When `ignoreDuplicates: true` and the row already exists, the upsert does not modify the row
   - What's unclear: Whether `.select('balance')` after an ignored upsert still returns the existing row's value (it should, since Supabase returns the row regardless)
   - Recommendation: Test this in Wave 0 verification. If `.select()` returns null on conflict-ignored upsert, use a separate `.select()` query after the upsert.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files in `backend/api/` |
| Config file | None — Wave 0 must set up if unit tests are desired |
| Quick run command | `npm run type-check` (type checking is the primary validation mechanism) |
| Full suite command | `npm run type-check` |

**Note:** The project has no test framework configured in `backend/api/`. Given the Phase 18 scope (pure TypeScript service + middleware files), type-checking + manual integration verification is the pragmatic validation approach. Nyquist validation for this phase means: compile cleanly, integration smoke test against Supabase dev, and verified behavior for each success criterion.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-02 | Daily base quota passes 1 chat + 1 scan without deduction | Integration smoke | `npm run type-check` (compile) + manual Postman test | ❌ Wave 0 — manual |
| CRED-03 | Monthly base quota passes 1 program without deduction | Integration smoke | Manual test via `/ai/chat` with program request | ❌ Wave 0 — manual |
| EARN-07 | Daily earn cap enforced after N earn calls | Integration smoke | Manual: call earnCredits 5x, verify balance only increases by cap | ❌ Wave 0 — manual |
| EARN-10 | Duplicate idempotency_key earn call inserts 0 rows | Integration smoke | Manual: POST twice with same key, check `ai_credit_transactions` count | ❌ Wave 0 — manual |
| PREM-02 | Premium user passes creditCheck without 402 | Integration smoke | Manual: set tier='premium', call `/ai/chat`, verify 200 | ❌ Wave 0 — manual |

### Sampling Rate
- **Per task commit:** `npm run type-check` — zero TypeScript errors required
- **Per wave merge:** `npm run type-check` + manual smoke test of all 5 success criteria
- **Phase gate:** All 5 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Confirm Phase 17 migration `026_ai_credits.sql` is applied to dev Supabase instance
- [ ] Confirm `user_profiles.tier` column exists with `DEFAULT 'free'`
- [ ] Confirm `deduct_ai_credits` RPC exists and returns correct JSONB shape
- [ ] Confirm `UNIQUE (user_id, source, idempotency_key)` partial index exists on `ai_credit_transactions`

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on Phase 18 |
|------------|-------------------|
| `SUPABASE_PUBLISHABLE_KEY` not `SERVICE_KEY` in production | `creditService.ts` Supabase client uses the same fallback pattern as `auth.ts`: `process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!` |
| No `StyleSheet` / light sport theme | Not applicable — Phase 18 is backend only |
| `showAlert` not `Alert.alert` | Not applicable — Phase 18 is backend only |
| All screens `paddingBottom: 100` | Not applicable — Phase 18 is backend only |
| Plugin manifest must be `export default` | Not applicable — Phase 18 is backend only |
| `rtk` prefix for all bash commands | Applies to any verification commands run during phase execution |
| `models.ts` is the ONLY file with Anthropic model IDs | `credits.ts` must NOT reference model IDs — costs and quotas only |

---

## Sources

### Primary (HIGH confidence)
- `backend/api/src/middleware/auth.ts` — Hono middleware pattern (`Context`, `Next`, `c.set()`, `declare module 'hono'`)
- `backend/api/src/middleware/rateLimiter.ts` — Factory middleware pattern, after-handler inspection, exempt path pattern
- `backend/api/src/config/models.ts` — Config file pattern (exported const, UPPER_SNAKE_CASE)
- `backend/api/src/routes/ai.ts` — Route-level middleware attachment order, streaming response shape
- `backend/api/src/app.ts` — Global middleware chain order, route mounting
- `backend/api/package.json` — Exact installed package versions
- `supabase/migrations/026_ai_credits.sql` — Full DB schema: table structure, RPC signature, idempotency index, tier column
- `.planning/phases/18-credit-service-middleware/18-CONTEXT.md` — All locked decisions D-01 through D-10
- `.planning/research/SUMMARY.md` — Architecture decisions, pitfall catalog, Vercel Fluid Compute + FOR UPDATE rationale

### Secondary (MEDIUM confidence)
- Hono v4 official documentation — `await next()` after-handler pattern; `ContextVariableMap` declaration merging
- Supabase JS v2 official docs — `.upsert({ onConflict, ignoreDuplicates })`, `.select('*', { count: 'exact', head: true })`, `.rpc()` call shape

### Tertiary (LOW confidence — validate during execution)
- Supabase JS v2 behavior: whether `.select()` after an ignored upsert returns the existing row value — should be tested in Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all existing dependencies verified from `package.json`
- Architecture: HIGH — all three new files follow existing project patterns directly (auth.ts, rateLimiter.ts, models.ts); DB foundation verified from migration 026
- Pitfalls: HIGH — sourced from existing project decisions in STATE.md + SUMMARY.md which already research-backed these risks

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack — no fast-moving dependencies; only risk is Supabase JS API changes)
