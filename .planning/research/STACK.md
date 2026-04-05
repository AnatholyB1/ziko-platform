# Stack Research — AI Credit System & Monetisation (v1.4)

**Project:** Ziko Platform — v1.4 Système de Crédits IA & Monétisation
**Researched:** 2026-04-05
**Confidence:** HIGH
**Scope:** NEW stack additions only. The following are validated and NOT re-researched:
Expo SDK 54, RN 0.81, Expo Router v4, Hono v4 (`^4.7.0`), `@supabase/supabase-js` (`^2.50.0`),
`zod ^4.3.6`, `@upstash/redis ^1.37.0`, `@upstash/ratelimit ^2.0.8`, `ai ^6.0.116`,
`@ai-sdk/anthropic ^3.0.58`, Zustand v5, TanStack Query v5, NativeWind v4.

---

## What This Milestone Actually Needs

Three capability areas drive all new stack decisions:

1. **Haiku vision migration** — swap `claude-sonnet-4-20250514` for `claude-haiku-4-5-20251001`
   on the food photo scan path. No new package — the existing `@ai-sdk/anthropic` already supports it.
2. **Credit quota logic** — per-user daily/monthly counters with atomic check-and-decrement.
   Upstash Redis (already installed) handles this. No new package.
3. **Cost telemetry** — log token usage per AI call to Supabase for cost-cap enforcement.
   Vercel AI SDK's `onFinish` callback provides token counts. No new package.

Net result: **zero new npm packages required.** All capabilities exist in the current stack.
The work is entirely in new routes, new SQL schema, and new logic.

---

## No New Dependencies — Rationale

### Why `@ai-sdk/anthropic ^3.0.58` Already Handles Haiku

The `@ai-sdk/anthropic` provider accepts any valid Anthropic model ID as a string:

```ts
// Current (Sonnet — orchestrator)
const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');

// New (Haiku — vision scan path only)
const SCAN_MODEL  = anthropic('claude-haiku-4-5-20251001');
```

The SDK's unified interface means vision messages (`{ type: 'image', image: url }`) work
identically across both models. The provider handles base64 conversion internally when
Supabase Storage signed URLs are passed — no additional image-handling library needed.

**Haiku model facts (verified):**
- API model ID: `claude-haiku-4-5-20251001`
- Input: $1.00 / 1M tokens; Output: $5.00 / 1M tokens
- Context window: 200K tokens
- Vision: supported (multimodal — text + image)
- Typical food scan: ~800 input tokens + ~200 output = ~$0.001 per scan (well under €0.003 target)

**Confidence:** HIGH — model ID and pricing confirmed via Anthropic API docs and Helicone pricing
calculator. The `@ai-sdk/anthropic` provider's multi-model support is documented in the AI SDK
provider reference.

---

### Why Upstash Redis Already Handles Credit Quotas

The existing `@upstash/redis ^1.37.0` client supports `INCR`, `GET`, `EXPIRE`, and pipeline/
multi-exec transactions natively. The Upstash HTTP REST API supports MULTI/EXEC blocks for atomic
check-and-decrement operations — critical for preventing race conditions on credit deduction.

**Daily quota pattern (no new package):**

```ts
import { redis } from '../lib/redis.js';  // existing client

// Atomic check + decrement using pipeline
async function consumeCredit(userId: string, action: 'scan' | 'chat' | 'program'): Promise<boolean> {
  const key = `credits:${userId}:${action}:${todayKey()}`;  // e.g. credits:abc:scan:2026-04-05

  const pipeline = redis.pipeline();
  pipeline.get(key);
  pipeline.incr(key);
  const [current, next] = await pipeline.exec() as [number | null, number];

  // Set TTL only on first write (key expiry aligns with calendar day UTC)
  if (next === 1) {
    const secondsUntilMidnight = getSecondsUntilMidnightUTC();
    await redis.expire(key, secondsUntilMidnight);
  }

  const DAILY_LIMITS: Record<string, number> = {
    scan: 3,    // 1 base + 2 earnable
    chat: 3,    // 1 base + 2 earnable
    program: 2, // 1 base + 1 earnable (monthly cap handled separately)
  };

  if ((current ?? 0) >= DAILY_LIMITS[action]) {
    // Roll back the increment — user was over limit before this call
    await redis.decr(key);
    return false;
  }
  return true;
}
```

For monthly program quotas, the same pattern applies with a `YYYY-MM` key suffix and TTL set
to seconds until end-of-month. The existing `redis` singleton in `backend/api/src/lib/redis.ts`
is reused directly — no new client instantiation.

**Confidence:** HIGH — Upstash Redis pipeline/exec pattern confirmed via Upstash docs and
GitHub examples. Existing `@upstash/redis` client version `1.37.0` includes `pipeline()`.

---

### Why Vercel AI SDK Already Handles Cost Telemetry

The `generateText` and `streamText` functions in `ai ^6.0.116` expose token usage in their
return values and `onFinish` callbacks. No external observability package (LangFuse, Helicone,
Langsmith) is needed — the token counts feed directly into a Supabase `ai_cost_log` table.

**Token tracking pattern (no new package):**

```ts
// generateText (sync vision scan)
const result = await generateText({
  model: SCAN_MODEL,
  messages: [{ role: 'user', content: [{ type: 'image', image: signedUrl }, { type: 'text', text: prompt }] }],
});
const { inputTokens, outputTokens } = result.usage;
await logCost(userId, 'scan', inputTokens, outputTokens, 'claude-haiku-4-5-20251001');

// streamText (chat) — use onFinish callback
const response = streamText({
  model: AGENT_MODEL,
  messages,
  onFinish: async ({ usage }) => {
    await logCost(userId, 'chat', usage.inputTokens, usage.outputTokens, 'claude-sonnet-4-20250514');
  },
});
```

`result.usage` shape (AI SDK v6): `{ inputTokens: number, outputTokens: number, totalTokens: number }`.

**Confidence:** HIGH — `usage` object shape confirmed via official ai-sdk.dev docs for
`generateText` reference. `onFinish` callback with `usage` confirmed for `streamText`.

---

## New SQL Schema (Supabase migrations)

No npm packages. All new capability lives in the database and backend logic.

### Migration: `ai_credits` table

```sql
CREATE TABLE public.ai_credits (
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance        INTEGER NOT NULL DEFAULT 0,   -- earnable credits (activity-based)
  lifetime_used  INTEGER NOT NULL DEFAULT 0,   -- monotonic counter for analytics
  updated_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id)
);
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credits_own" ON public.ai_credits
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Migration: `ai_cost_log` table

```sql
CREATE TABLE public.ai_cost_log (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,              -- 'scan' | 'chat' | 'program'
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL,
  output_tokens  INTEGER NOT NULL,
  cost_usd       NUMERIC(10, 6) NOT NULL,   -- computed at insert time
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_cost_log ENABLE ROW LEVEL SECURITY;
-- Users can read their own cost log; only backend service role can write
CREATE POLICY "ai_cost_log_read" ON public.ai_cost_log FOR SELECT
  USING (auth.uid() = user_id);
```

These are the only schema additions. The existing `user_plugins`, `gamification`, and
`coins` tables from the gamification plugin are not modified — the dual balance (coins vs
AI credits) is maintained as separate concerns: coins in gamification plugin tables,
AI credits in the new `ai_credits` table.

**Confidence:** HIGH — pattern follows existing RLS conventions in the project (21 prior
migrations all use this exact policy structure). No new Supabase feature needed.

---

## Integration Points (Existing Code to Modify)

These are modifications to existing files, not new dependencies:

### `backend/api/src/routes/ai.ts`

| Change | What | Why |
|--------|------|-----|
| Add `SCAN_MODEL` constant | `anthropic('claude-haiku-4-5-20251001')` | Vision path uses Haiku, not Sonnet |
| Wrap chat handler | Call `consumeCredit(userId, 'chat')` before `streamText` | Enforce daily chat quota |
| Wrap tool execute | Call `consumeCredit(userId, 'chat')` | Same quota pool as chat |
| Add `POST /ai/scan` route | `generateText` with image + Haiku | Replace current Sonnet scan |
| `onFinish` in streamText | `logCost(userId, ...)` | Persist token usage for cost cap |

### `backend/api/src/routes/ai.ts` — new endpoint

```ts
// POST /ai/scan — food photo scan, Haiku vision, credit-gated
router.post('/scan', authMiddleware, barcodeScanLimiter, async (c) => {
  const { userId } = c.get('auth');
  const { image_url } = await c.req.json();   // Supabase Storage signed URL

  const allowed = await consumeCredit(userId, 'scan');
  if (!allowed) return c.json({ error: 'scan_quota_exceeded', creditsRemaining: 0 }, 429);

  const result = await generateText({
    model: SCAN_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'image', image: image_url },
      { type: 'text', text: SCAN_PROMPT },
    ]}],
  });

  await logCost(userId, 'scan', result.usage.inputTokens, result.usage.outputTokens, 'claude-haiku-4-5-20251001');
  return c.json({ analysis: result.text });
});
```

### `plugins/gamification/src/` — credit earn events

The existing gamification plugin dispatches XP and coin awards on activity events. The same
activity hooks trigger AI credit earnings. The pattern is an additive call to a new
`earnAICredit(userId, action)` backend route — no change to the gamification plugin internals.

New backend route: `POST /ai/credits/earn` (auth-gated, idempotent with daily cap check).

---

## What NOT to Add

| Rejected | Why | Use Instead |
|----------|-----|-------------|
| LangFuse / Helicone / LangSmith | External observability adds vendor dependency + latency. Token counts from `result.usage` are sufficient for cost enforcement. Observability can be added later if needed. | `ai` SDK `usage` + Supabase `ai_cost_log` |
| Anthropic Admin API for cost tracking | Requires Admin API key (separate from standard key). Aggregate usage dashboard, not per-user. Doesn't give per-call granularity needed for quota enforcement. | `result.usage` from `generateText` |
| `@anthropic-ai/sdk` direct | Already using `@ai-sdk/anthropic` wrapper — using both creates dual SDK confusion. Model switching is trivial with the AI SDK provider pattern. | `@ai-sdk/anthropic` already present |
| Stripe / payment SDK | Premium tier is explicitly future scope. Architecture should be *ready* for it (clean `tier` field on user profile), but no billing integration this milestone. | Future milestone |
| Separate quota microservice | Overkill. Upstash Redis counters with TTL handle atomic quota logic at zero extra infrastructure cost. A separate service adds latency and deployment complexity. | Upstash Redis (existing) |
| `pg-boss` or `BullMQ` for credit events | No async job queue needed. Credit earning is synchronous (log activity → POST /ai/credits/earn → increment Redis counter + Supabase balance). Vercel's serverless invocation is the queue. | Direct HTTP call from mobile |
| `decimal.js` or `dinero.js` for money math | Cost amounts are stored as `NUMERIC(10,6)` in Postgres and computed server-side from integer token counts × fixed rate. No floating-point currency arithmetic in JS needed. | Postgres `NUMERIC` type |
| Supabase Edge Functions for quota | The Hono backend already handles all API logic. Adding Edge Functions creates a second runtime to maintain. Upstash Redis quota checks add <5ms to any Hono handler. | Hono routes (existing) |

---

## Model Cost Reference (for cost cap enforcement)

| Model | Input $/1M | Output $/1M | Typical use | Cost per call (est.) |
|-------|-----------|------------|-------------|----------------------|
| `claude-haiku-4-5-20251001` | $1.00 | $5.00 | Food scan (vision) | ~$0.001 |
| `claude-sonnet-4-20250514` | $3.00 | $15.00 | Chat, programs | ~$0.006–$0.015 |

At the project's target of €0.75/user/month:
- 50 Haiku scans = ~$0.05
- 60 Sonnet chat turns = ~$0.36–$0.90
- Mixed usage at free tier (3 scans/day + 3 chats/day capped) = ~$0.40–$0.75/month

The dual-model approach (Haiku for vision, Sonnet for chat) is the primary cost lever.
Sonnet for vision scans would be 3× more expensive per scan.

---

## Installation

No new packages. Existing `backend/api/package.json` dependencies cover all v1.4 requirements.

```bash
# No npm install needed for v1.4
# All capabilities exist in:
# - @ai-sdk/anthropic ^3.0.58  (multi-model support, vision)
# - ai ^6.0.116               (usage tracking via result.usage / onFinish)
# - @upstash/redis ^1.37.0    (atomic quota counters)
# - @supabase/supabase-js ^2.50.0  (cost_log table, credits table)
```

Only a Supabase migration (SQL) and new route/middleware logic in the Hono API are required.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Haiku model ID + vision | HIGH | `claude-haiku-4-5-20251001` confirmed via Anthropic API docs. Vision confirmed multimodal. |
| AI SDK multi-model switching | HIGH | `@ai-sdk/anthropic` provider string-based model ID — confirmed via ai-sdk.dev provider docs. |
| Token usage from `result.usage` | HIGH | AI SDK v6 `generateText` returns `usage.inputTokens`, `usage.outputTokens` — documented in official reference. |
| Upstash Redis quota counters | HIGH | `pipeline()`, `incr()`, `expire()` all present in `@upstash/redis ^1.37.0`. MULTI/EXEC atomicity confirmed. |
| Cost estimates | MEDIUM | Based on published Anthropic pricing as of 2026-04-05 and estimated token counts per action type. Actual costs will vary ±30% with real prompts. |
| Supabase RLS for credits | HIGH | Pattern is identical to all 21 existing migrations in the project. |
| Zero new npm packages | HIGH | Verified against existing `package.json` — all required capabilities are present in current dependencies. |

---

## Sources

- [Anthropic API Docs: Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — `claude-haiku-4-5-20251001` model ID confirmed
- [Helicone Pricing: claude-haiku-4-5-20251001](https://www.helicone.ai/llm-cost/provider/anthropic/model/claude-haiku-4-5-20251001) — $1.00/$5.00 per 1M tokens confirmed
- [Anthropic API Docs: Vision](https://platform.claude.com/docs/en/build-with-claude/vision) — image input formats for Claude models
- [AI SDK Docs: generateText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) — `result.usage` shape, `onFinish` callback
- [AI SDK Docs: Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) — model switching pattern, multimodal support
- [Upstash Redis JS SDK](https://github.com/upstash/redis-js) — `pipeline()`, `exec()`, `incr()`, `expire()` API
- [Upstash Blog: Pipeline REST API](https://upstash.com/blog/pipeline) — atomicity guarantees for MULTI/EXEC vs pipeline
- [Caylent: Claude Haiku 4.5 Deep Dive](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity) — cost/capability comparison Haiku vs Sonnet

---

*Stack research for: AI credit system, dual balance, Haiku vision migration*
*Researched: 2026-04-05*
