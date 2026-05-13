# Architecture Research

**Domain:** AI Credit System & Gamification Integration — Ziko Platform v1.4
**Researched:** 2026-04-05
**Confidence:** HIGH — all integration points verified from source files in this repo

---

## System Overview

The v1.4 credit system integrates at five distinct layers of the existing architecture. No existing components are removed. Three new backend components are added, two existing components are modified, and one new migration extends the database schema.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Mobile App (React Native)                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │  AI Chat UI      │  │  Plugin Screens  │  │ Gamification UI   │   │
│  │ (credit display) │  │ (activity hooks) │  │ (dual balance)    │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘   │
│           │                     │                     │              │
│  ┌────────▼─────────────────────▼─────────────────────▼──────────┐   │
│  │                    Supabase (RLS enforced)                      │   │
│  │  user_gamification (coins) + user_ai_credits (new)             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│           │ (direct Supabase JS calls for reads, API for writes)       │
└───────────┼──────────────────────────────────────────────────────────┘
            │
            ▼ HTTPS (Bearer token)
┌──────────────────────────────────────────────────────────────────────┐
│                     Hono v4 Backend (Vercel)                          │
│                                                                       │
│  logger → cors → secureHeaders → ipRateLimiter → [routes]            │
│                                                                       │
│  /ai/* routes only:                                                   │
│    authMiddleware → userRateLimiter → creditCheckMiddleware(NEW)      │
│      → zValidator → handler → creditDeductMiddleware(NEW)             │
│                                                                       │
│  Plugin tool executors (habits_log, cardio_log_session, etc.):        │
│    [unchanged, but credit earn is triggered as side-effect]           │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │  NEW: src/middleware/credits.ts                             │       │
│  │    creditCheckMiddleware — reads user_ai_credits, blocks    │       │
│  │    creditDeductMiddleware — deducts after successful call   │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │  NEW: src/lib/creditService.ts                             │       │
│  │    getBalance, deductCredits, earnCredits, getDailyCap     │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │  NEW: src/routes/credits.ts                                │       │
│  │    GET /credits/balance — current balance + quota info      │       │
│  │    GET /credits/history — credit transaction log            │       │
│  └────────────────────────────────────────────────────────────┘       │
│                                                                       │
│  MODIFIED: src/routes/ai.ts                                           │
│    /vision/nutrition — switch AGENT_MODEL → claude-haiku-3-5          │
│    All AI routes — wrap with creditCheckMiddleware + deduct after      │
│                                                                       │
│  MODIFIED: src/tools/habits.ts, cardio.ts, nutrition.ts, etc.        │
│    habits_log, cardio_log_session, measurements_log, etc.             │
│    → fire-and-forget creditEarn() after successful write              │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                                 │
│                                                                       │
│  EXISTING tables (unchanged):                                         │
│    user_gamification  — xp, level, coins (shop coins)                 │
│    coin_transactions  — shop coin audit trail                         │
│    xp_transactions    — xp audit trail                                │
│                                                                       │
│  NEW table: user_ai_credits (migration 026)                           │
│    user_id, ai_credits (int), daily_credits_earned (int),             │
│    daily_reset_date (date), updated_at                                │
│                                                                       │
│  NEW table: ai_credit_transactions (migration 026)                    │
│    id, user_id, amount (±int), type, source, created_at               │
│    type: 'earn' | 'deduct'                                            │
│    source: 'activity_habit' | 'activity_cardio' | 'activity_nutrition'│
│           | 'activity_measurement' | 'activity_stretching'            │
│           | 'ai_chat' | 'ai_vision' | 'ai_program' | 'initial_grant'  │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Upstash Redis (existing)                            │
│  Existing: rl:ip:*, rl:ai-chat:*, rl:ai-tools:*, rl:barcode:*        │
│  No Redis changes needed — credit deduction is Supabase-native        │
│  (Redis rate limiters remain; credits are a separate spending layer)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Status | Responsibility |
|-----------|--------|----------------|
| `src/middleware/credits.ts` | NEW | Reads current AI credit balance before request; blocks with 402 if zero; deducts after successful response |
| `src/lib/creditService.ts` | NEW | All credit math: deduct, earn, daily cap enforcement, balance read — single source of truth |
| `src/routes/credits.ts` | NEW | HTTP API for mobile to read balance, history, quota status |
| `src/routes/ai.ts` | MODIFIED | Inserts creditCheckMiddleware on all AI routes; switches `/vision/nutrition` model to claude-haiku-3-5 |
| `src/tools/habits.ts` | MODIFIED | Calls `creditService.earnCredits()` after `habits_log` succeeds |
| `src/tools/cardio.ts` | MODIFIED | Calls `creditService.earnCredits()` after `cardio_log_session` succeeds |
| `src/tools/nutrition.ts` | MODIFIED | Calls `creditService.earnCredits()` after `nutrition_log_meal` succeeds |
| `src/tools/measurements.ts` | MODIFIED | Calls `creditService.earnCredits()` after `measurements_log` succeeds |
| `src/tools/stretching.ts` | MODIFIED | Calls `creditService.earnCredits()` after `stretching_log_session` succeeds |
| `supabase/migrations/026_ai_credits.sql` | NEW | `user_ai_credits` + `ai_credit_transactions` tables with RLS |
| Mobile `gamificationStore` or new `creditStore` | NEW | Reads `/credits/balance`; surfaces dual balance in AI chat header and gamification dashboard |

---

## Recommended Project Structure (new files only)

```
backend/api/src/
├── middleware/
│   ├── auth.ts                    (existing — unchanged)
│   ├── rateLimiter.ts             (existing — unchanged)
│   └── credits.ts                 (NEW — creditCheckMiddleware factory)
├── lib/
│   ├── redis.ts                   (existing — unchanged)
│   └── creditService.ts           (NEW — balance, deduct, earn, cap logic)
├── routes/
│   ├── ai.ts                      (MODIFIED — haiku switch + credit middleware)
│   └── credits.ts                 (NEW — balance and history endpoints)
supabase/migrations/
└── 026_ai_credits.sql             (NEW — credit tables + RLS)
apps/mobile/src/stores/
└── creditStore.ts                 (NEW — Zustand store for credit balance)
plugins/gamification/src/screens/
└── GamificationDashboard.tsx      (MODIFIED — dual balance card)
```

---

## Architectural Patterns

### Pattern 1: Middleware as Guard + Deduction Sandwich

The credit check and deduction are implemented as two separate middlewares wrapping the route handler. This is the same pattern as `authMiddleware` + `userRateLimiter` already in use.

**What:** `creditCheckMiddleware` runs before the handler and reads the current balance. If zero, returns 402. After the handler succeeds, `creditDeductMiddleware` writes the deduction. The cost per endpoint is encoded as a constant in `credits.ts`.

**When to use:** Any AI endpoint that consumes a token budget.

**Trade-offs:** A Vercel cold start between check and deduction could allow a race condition if the same user fires two parallel requests. This is acceptable at current scale — a Redis atomic check-and-decrement (`DECRBY` with floor) would eliminate it but adds complexity. The Upstash sliding window already throttles parallel bursts.

**Example:**

```typescript
// src/middleware/credits.ts
export function withCredits(cost: number) {
  return [creditCheck(cost), creditDeduct(cost)];
}

// Usage in ai.ts
router.post('/chat/stream',
  aiChatLimiter,
  ...withCredits(CREDIT_COSTS.chat),
  zValidator('json', chatSchema),
  chatStreamHandler,
);
```

The `creditDeduct` middleware calls `next()` first, then deducts only if the response status is < 400. This ensures a failed AI call does not consume credits.

### Pattern 2: Fire-and-Forget Earn in Tool Executors

Activity-based credit earning happens as a side-effect inside the tool executor functions. It is deliberately non-blocking — a credit earn failure must never fail the activity log itself.

**What:** After a successful Supabase write, the tool calls `creditService.earnCredits(userId, source)` without `await`. This pattern is already used for `updateConversationTitle` in `ai.ts` (line 192).

**When to use:** All write-path activity tools: `habits_log`, `nutrition_log_meal`, `measurements_log`, `stretching_log_session`, `cardio_log_session`.

**Trade-offs:** Credit earn is best-effort. If the Supabase write in `earnCredits` fails silently, the user loses a credit they earned. Log the error. This is acceptable because the daily cap means a missed earn is never catastrophic.

**Example:**

```typescript
// In habits.ts, after the upsert succeeds
creditService.earnCredits(userId, 'activity_habit').catch((err) =>
  console.error('[Credits] earn failed:', err)
);
return { success: true, habit_name: habit.name };
```

### Pattern 3: Daily Cap Enforcement at Write Time

The `user_ai_credits` table stores `daily_credits_earned` and `daily_reset_date`. On each earn call, `creditService` checks if `daily_reset_date` is today; if not, it resets the counter before adding. If `daily_credits_earned >= DAILY_EARN_CAP`, the earn is a no-op.

**What:** Single-row upsert with conditional logic encapsulated in `creditService.earnCredits`. No cron job needed for cap reset — the reset is lazy (happens on first earn each day).

**When to use:** This pattern avoids a daily reset cron and works correctly on Vercel serverless. It is the same approach used for habit streak resets in the existing codebase.

**Trade-offs:** If a user never earns credits on a given day, the row is never updated. This is fine — the reset check runs when they next earn, not at midnight.

---

## Data Flow

### AI Chat Request (Credit Check + Deduct)

```
Mobile client
    |
    | POST /ai/chat/stream  { messages, conversation_id }
    |   Authorization: Bearer <JWT>
    ▼
[ipRateLimiter] — pass (200/60s window)
    ▼
[authMiddleware] — sets c.get('auth').userId
    ▼
[aiChatLimiter] — pass (20/60min per user)
    ▼
[creditCheck(cost=1)] — reads user_ai_credits WHERE user_id=$1
    |   balance == 0 → 402 { error: 'Insufficient AI credits', balance: 0 }
    |   balance > 0 → continue
    ▼
[zValidator] — validates body schema
    ▼
[chatStreamHandler] — fetchUserContext, streamText, persist messages
    ▼
[creditDeduct(cost=1)] — runs after handler, only if status < 400
    |   UPDATE user_ai_credits SET ai_credits = ai_credits - cost
    |   INSERT INTO ai_credit_transactions (amount=-1, type='deduct', source='ai_chat')
    ▼
SSE stream to client
```

### Activity Log → Credit Earn

```
Mobile client (or AI tool call)
    |
    | habits_log / cardio_log_session / nutrition_log_meal / etc.
    ▼
[Tool executor]
    |   Supabase upsert → success
    |
    +-- return result to caller (sync)
    |
    +-- creditService.earnCredits(userId, source)  [fire-and-forget]
            |
            ▼
            SELECT daily_credits_earned, daily_reset_date
            FROM user_ai_credits WHERE user_id = $1
            |
            | reset_date < today → reset counter first
            | earned >= DAILY_CAP → no-op, return
            | else:
            ▼
            UPDATE user_ai_credits
              SET ai_credits = ai_credits + earn_amount,
                  daily_credits_earned = daily_credits_earned + earn_amount,
                  daily_reset_date = today
            INSERT INTO ai_credit_transactions
              (amount=+earn_amount, type='earn', source=$source)
```

### Mobile Balance Display

```
Mobile app boot / screen focus
    ▼
GET /credits/balance  (authd)
    ▼
creditService.getBalance(userId)
    → { ai_credits: int, daily_earned: int, daily_cap: int, reset_date: date }
    ▼
creditStore.setBalance(...)   [Zustand]
    ▼
AI chat header renders: "12 credits"
Gamification dashboard: dual card — coins | credits
```

---

## Database Schema (Migration 026)

```sql
-- user_ai_credits: one row per user
CREATE TABLE public.user_ai_credits (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_credits           INTEGER NOT NULL DEFAULT 5,   -- starting grant
  daily_credits_earned INTEGER NOT NULL DEFAULT 0,
  daily_reset_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credits_own" ON public.user_ai_credits
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_credit_transactions: audit trail
CREATE TABLE public.ai_credit_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,  -- positive=earn, negative=deduct
  type        TEXT NOT NULL CHECK (type IN ('earn', 'deduct')),
  source      TEXT NOT NULL CHECK (source IN (
    'activity_habit', 'activity_cardio', 'activity_nutrition',
    'activity_measurement', 'activity_stretching',
    'ai_chat', 'ai_vision', 'ai_program', 'initial_grant'
  )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_credit_tx_user ON public.ai_credit_transactions(user_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_tx_own" ON public.ai_credit_transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

The `DEFAULT 5` initial grant on `user_ai_credits` handles new users automatically — no trigger needed. Existing users get no row until their first earn or check; `creditService.getBalance` must handle the missing-row case by upserting a row with defaults.

---

## Integration Points

### What Is New vs Modified

| Component | Type | Change Description |
|-----------|------|--------------------|
| `middleware/credits.ts` | NEW | creditCheck + creditDeduct factory functions |
| `lib/creditService.ts` | NEW | getBalance, earnCredits, deductCredits, CREDIT_COSTS, DAILY_EARN_CAP, EARN_AMOUNTS |
| `routes/credits.ts` | NEW | GET /credits/balance, GET /credits/history |
| `supabase/migrations/026_ai_credits.sql` | NEW | user_ai_credits + ai_credit_transactions + RLS |
| `apps/mobile/src/stores/creditStore.ts` | NEW | Zustand store; fetches /credits/balance on mount |
| `routes/ai.ts` | MODIFIED | Add `...withCredits(cost)` to /chat, /chat/stream, /tools/execute, /vision/nutrition; switch vision model to claude-haiku |
| `tools/habits.ts` | MODIFIED | Fire-and-forget earnCredits after habits_log upsert |
| `tools/nutrition.ts` | MODIFIED | Fire-and-forget earnCredits after nutrition_log_meal upsert |
| `tools/measurements.ts` | MODIFIED | Fire-and-forget earnCredits after measurements_log upsert |
| `tools/stretching.ts` | MODIFIED | Fire-and-forget earnCredits after stretching_log_session upsert |
| `tools/cardio.ts` | MODIFIED | Fire-and-forget earnCredits after cardio_log_session upsert |
| `app.ts` | MODIFIED | Mount credits router: `app.route('/credits', creditsRouter)` |
| `plugins/gamification/src/screens/GamificationDashboard.tsx` | MODIFIED | Add AI credits card alongside coins card |

### Middleware Chain Position (ai routes after change)

```
logger → cors → secureHeaders → ipRateLimiter
  → [route mounted at /ai]
    → authMiddleware            (sets userId)
    → aiChatLimiter             (sliding window per user)
    → creditCheck(cost)         (NEW — reads user_ai_credits)
    → zValidator(schema)
    → handler
    → creditDeduct(cost)        (NEW — writes after handler returns)
```

The `creditCheck` must sit between `aiChatLimiter` and `zValidator`. Placing it after the rate limiter means a user who has hit their rate limit never reaches the credit check (avoids spurious Supabase reads). Placing it before `zValidator` means invalid bodies are rejected before credit check — this is wrong. The correct order is: rate limiter → credit check → schema validation → handler → deduct.

Correction to the above: `zValidator` should stay before the handler but after credit check is acceptable because an invalid body returning 400 won't trigger `creditDeduct` (deduct only fires on status < 400). However, putting `zValidator` before credit check avoids the Supabase read entirely for malformed requests. **Final order: rateLimiter → zValidator → creditCheck → handler → creditDeduct.**

### Credit Cost Constants

```typescript
// src/lib/creditService.ts
export const CREDIT_COSTS = {
  chat: 1,           // /ai/chat and /ai/chat/stream
  tools_execute: 1,  // /ai/tools/execute (used by plugins)
  vision: 1,         // /ai/vision/nutrition (Haiku — cheap enough to cost same)
  program: 1,        // ai_programs_generate tool call (charged at chat level)
} as const;

export const EARN_AMOUNTS = {
  activity_habit: 1,
  activity_cardio: 2,
  activity_nutrition: 1,
  activity_measurement: 1,
  activity_stretching: 1,
} as const;

export const DAILY_EARN_CAP = 5;  // max AI credits earnable per day from activity
export const STARTING_CREDITS = 5; // default on new user row
```

### Which Tool Executors Earn Credits

Not all tool executors earn credits — only writes that represent real user activity. Read-only tools (`habits_get_today`, `cardio_get_history`, `wearables_get_summary`, etc.) do not earn. Logging tools that earn:

| Tool | Earn Amount | Source Label |
|------|-------------|--------------|
| `habits_log` | 1 | `activity_habit` |
| `nutrition_log_meal` | 1 | `activity_nutrition` |
| `measurements_log` | 1 | `activity_measurement` |
| `stretching_log_session` | 1 | `activity_stretching` |
| `cardio_log_session` | 2 | `activity_cardio` |

`journal_log_mood`, `sleep_log`, and `hydration_log` are excluded from earning — these are frequent micro-logs that would trivially saturate the daily cap without meaningful effort.

### Mobile Activity Logging Surface

Plugins log activities through two paths:
1. **Via AI tool call** — user says "j'ai fait 5km" → AI calls `cardio_log_session` → tool executor fires earn
2. **Direct Supabase writes from mobile** — plugin screens call Supabase JS directly without going through the API

Path 2 is the challenge: when a user logs a workout from the cardio screen directly, it bypasses the tool executor entirely. Two options:

- **Option A (recommended):** Add lightweight REST endpoints for each write-path activity (e.g., `POST /activity/log`) that the mobile calls in addition to the Supabase write. The endpoint validates auth, calls `creditService.earnCredits`, and returns quickly. The mobile Supabase write and the credit earn call are fired in parallel.
- **Option B:** Supabase database trigger on `cardio_sessions`, `habit_logs`, etc. that calls a Supabase Edge Function to earn credits. More complex, harder to test.

**Recommendation: Option A** — keep all credit logic in Hono where it is testable, visible, and consistent with the existing backend pattern. Add a single `POST /activity/earn` endpoint that accepts `{ activity_type }` and calls `creditService.earnCredits`. The mobile calls this fire-and-forget from each plugin store after a successful direct Supabase write.

```typescript
// New: src/routes/credits.ts (excerpt)
router.post('/earn', authMiddleware, zValidator('json', earnSchema), async (c) => {
  const { activity_type } = c.req.valid('json');
  const { userId } = c.get('auth');
  await creditService.earnCredits(userId, `activity_${activity_type}`);
  return c.json({ ok: true });
});
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10k users | Current approach is correct. Supabase single-row upsert on user_ai_credits is fast. No caching needed. |
| 10k-100k users | Add Redis cache for balance reads (5s TTL). The creditCheck middleware hits Supabase on every AI request — at 10k DAU this becomes a hot path. |
| 100k+ users | Move to Postgres advisory locks or serializable transactions to prevent double-spend on parallel requests. |

At current Ziko scale (early product), Option A with direct Supabase upserts is correct. The race condition window for parallel requests is ~50ms and rate limiting constrains bursts to 20 AI calls per 60 minutes per user.

---

## Anti-Patterns

### Anti-Pattern 1: Deducting Credits Before the AI Call Succeeds

**What people do:** Deduct credits at the start of the handler, before `streamText` or `generateText` is called.

**Why it's wrong:** If Anthropic returns an error, the user loses a credit for a failed request. This kills trust in the system.

**Do this instead:** Deduct only after the handler returns a successful response status. The `creditDeduct` middleware checks `c.res.status < 400` before writing.

### Anti-Pattern 2: Blocking the Activity Log on Credit Earn

**What people do:** `await creditService.earnCredits(...)` inside the tool executor before returning to the caller.

**Why it's wrong:** A Supabase hiccup in the credit earn path would fail the habit log. The activity log must always succeed independently of the credit system.

**Do this instead:** Fire-and-forget with `.catch()` logging. Credits are a bonus, never a dependency.

### Anti-Pattern 3: Storing Credit Balance Only in Redis

**What people do:** Use Redis INCR/DECR for the credit counter (feels like it matches the rate limiter pattern).

**Why it's wrong:** Redis data is ephemeral on Upstash free tier; credit balances must survive cache evictions. The transaction audit trail requires a persistent store for user trust and potential support requests.

**Do this instead:** Supabase as the source of truth. Redis remains only for rate limiting (time-windowed, expected to expire).

### Anti-Pattern 4: One Daily Cron to Reset Earn Caps

**What people do:** A midnight Vercel cron that sets `daily_credits_earned = 0` for all users.

**Why it's wrong:** At scale this is a large table scan. On Vercel serverless it may hit timeout limits. It requires a cron to be always deployed and monitored.

**Do this instead:** Lazy reset — check `daily_reset_date < CURRENT_DATE` at earn time and reset inline. No cron dependency, works correctly on Vercel serverless.

---

## Build Order

The following order respects data dependencies. Each step can be built and tested independently.

1. **Database migration** (`026_ai_credits.sql`) — must be first; all backend code depends on these tables
2. **`creditService.ts`** — pure logic, no HTTP, testable in isolation; depends on migration being applied
3. **`credits.ts` middleware** — depends on creditService
4. **`routes/credits.ts`** — depends on creditService; adds balance and history endpoints
5. **`app.ts` route mount** — one-line change to mount the credits router
6. **`routes/ai.ts` modifications** — switch vision model to Haiku; insert credit middleware; depends on credits.ts middleware
7. **Tool executor modifications** (habits, nutrition, measurements, stretching, cardio) — fire-and-forget earn; depends on creditService
8. **Mobile `creditStore.ts`** — fetches /credits/balance; depends on routes/credits.ts being deployed
9. **Mobile UI** (AI chat credit display, gamification dual balance) — depends on creditStore

Steps 3-7 can be done in parallel once creditService.ts exists. Steps 8-9 can be done in parallel once the backend is deployed.

---

## Sources

- Verified from source: `backend/api/src/app.ts` — middleware chain order
- Verified from source: `backend/api/src/middleware/rateLimiter.ts` — existing rate limiter pattern
- Verified from source: `backend/api/src/middleware/auth.ts` — auth context pattern
- Verified from source: `backend/api/src/routes/ai.ts` — current AI routes, vision model, limiter placement
- Verified from source: `backend/api/src/tools/registry.ts` — all tool executors and write-path tools
- Verified from source: `backend/api/src/tools/db.ts` — Supabase client pattern used by tools
- Verified from source: `supabase/migrations/007_gamification_schema.sql` — existing coin/xp table structure and RLS pattern
- Verified from source: `.planning/PROJECT.md` — v1.4 feature requirements and cost targets

---
*Architecture research for: AI Credit System & Gamification Integration — Ziko v1.4*
*Researched: 2026-04-05*
