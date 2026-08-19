# Phase 19: Backend Routes + AI Integration - Research

**Researched:** 2026-04-05
**Domain:** Hono v4 backend, Vercel AI SDK v6, Supabase, credit system integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Create a separate `backend/api/src/routes/credits.ts` router, mounted at `app.route('/credits', creditsRouter)` in `app.ts`
- **D-02:** Credits router is NOT merged into `ai.ts` — conceptual separation maintained, easier to extend with future endpoints (history, earn-status)
- **D-03:** Log token usage from `/ai/chat`, `/ai/chat/stream`, and `/ai/vision/nutrition` only
- **D-04:** `/ai/tools/execute` is NOT logged — it has zero LLM token cost (pure function dispatch)
- **D-05:** Logging is done via the Vercel AI SDK `onFinish` callback (available in both `generateText` and `streamText`)
- **D-06:** Fields to log: `user_id`, `model`, `input_tokens`, `output_tokens`, logged at the `ai_cost_log` Supabase table via migration 027
- **D-07:** Switch `/ai/vision/nutrition` from `AGENT_MODEL` (Sonnet) to `VISION_MODEL` (Haiku) — already defined in `config/models.ts`
- **D-08:** Add credit gating to `/ai/vision/nutrition` using the existing `creditCheck('scan')` + `creditDeduct('scan')` middleware pattern
- **D-09:** Sonnet fallback triggers on JSON parse failure only (Haiku response not parseable as `{foods:[...]}`) — NOT triggered by `foods:[]` (empty result is valid)
- **D-10:** SC-5 verified via manual calculation documented in VERIFICATION.md — no automated test infrastructure required
- **D-11:** Calculation uses measured avg token counts from credit config constants (CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS in `config/credits.ts`)

### Claude's Discretion
- Migration number (027 is next in sequence — use that)
- RLS policy on `ai_cost_log` (same pattern as other tables — `auth.uid() = user_id`)
- `ai_cost_log` table column types (TEXT for model, INTEGER for tokens, TIMESTAMPTZ for created_at)
- `GET /credits/balance` response field names (follow SC-1 exactly: balance, daily_earned, daily_cap, reset_timestamp)
- Whether to add `X-Request-Id` to vision endpoint for idempotency (follow existing pattern)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COST-02 | Each AI API call's token usage is logged to Supabase for cost tracking | Vercel AI SDK v6 `onFinish` callback provides `usage.inputTokens` + `usage.outputTokens` on both `generateText` and `streamText`; insert into `ai_cost_log` table (migration 027) |
| COST-03 | Monthly cost per active freemium user stays under EUR 0.75 | Manual calculation using CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS from `config/credits.ts` + measured token counts; documented in VERIFICATION.md |
</phase_requirements>

---

## Summary

Phase 19 wires together three distinct but complementary deliverables: (1) a new `/credits` HTTP router exposing the balance endpoint, (2) token-usage telemetry on all LLM-calling AI routes, and (3) an upgrade to the vision route that swaps AGENT_MODEL for VISION_MODEL with a Sonnet fallback.

All Phase 18 infrastructure already exists and is fully tested in `creditService.ts`, `creditGate.ts`, and `config/credits.ts`. The `creditCheck`/`creditDeduct` middleware pair is already wired into `/ai/chat` and `/ai/chat/stream` — the vision route is the only gap. The credits router is a new file with no equivalent predecessor. Token logging requires `onFinish` callbacks added to three `generateText`/`streamText` calls plus a new migration 027.

The Vercel AI SDK v6 (installed version `ai@6.0.116+`) exposes `usage.inputTokens` and `usage.outputTokens` as `number | undefined` on the `OnFinishEvent` `totalUsage` object for both `generateText` and `streamText`. The field names have changed from v3 (`promptTokens`/`completionTokens`) and from the CONTEXT.md's casual mention — the correct field names in this codebase are `inputTokens` and `outputTokens` (not `promptTokens`/`completionTokens`).

**Primary recommendation:** Implement in three focused tasks — (1) migration 027 + `ai_cost_log` table, (2) credits router, (3) vision route upgrade + onFinish telemetry for all three routes.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `hono` | ^4.7.0 | HTTP router, middleware chain | [VERIFIED: package.json] |
| `ai` | ^6.0.116 | Vercel AI SDK — `generateText`, `streamText`, `onFinish` | [VERIFIED: package.json] |
| `@ai-sdk/anthropic` | ^3.0.58 | Anthropic provider for AI SDK | [VERIFIED: package.json] |
| `@supabase/supabase-js` | ^2.50.0 | DB client for cost log inserts | [VERIFIED: package.json] |
| `zod` | ^4.3.6 | Input validation | [VERIFIED: package.json] |
| `@hono/zod-validator` | ^0.7.6 | Hono Zod middleware | [VERIFIED: package.json] |

**Installation:** No new packages required. All dependencies are already in `backend/api/package.json`.

---

## Architecture Patterns

### Existing Route Mounting Pattern (from `app.ts`)

```typescript
// Source: backend/api/src/app.ts (VERIFIED)
import { creditsRouter } from './routes/credits.js';
// ...
app.route('/credits', creditsRouter);
```

All existing routers follow the same import + `app.route()` call pattern. The credits router is the seventh non-AI router to be added.

### Router File Pattern (from existing routes)

Every route file follows this structure:
```typescript
// Source: backend/api/src/routes/ai.ts pattern (VERIFIED)
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);  // auth before all routes

// ... route definitions ...

export { router as creditsRouter };
```

### Credit Check + Deduct Middleware Chain

Both `/ai/chat` and `/ai/chat/stream` already use this exact pattern:
```typescript
// Source: backend/api/src/routes/ai.ts lines 167, 261 (VERIFIED)
router.post('/chat/stream', aiChatLimiter, creditCheck('chat'), creditDeduct('chat'), zValidator('json', chatSchema), async (c) => { ... });
router.post('/chat', aiChatLimiter, creditCheck('chat'), creditDeduct('chat'), zValidator('json', chatSchema), async (c) => { ... });
```

The vision route currently has ONLY `barcodeScanLimiter` — it is missing `creditCheck('scan')` and `creditDeduct('scan')`.

### `GET /credits/balance` Response Shape

Per CONTEXT.md SC-1, the response must be:
```json
{
  "balance": 3,
  "daily_earned": 2,
  "daily_cap": 4,
  "reset_timestamp": "2026-04-06T00:00:00.000Z"
}
```

`creditService.getBalance(userId)` returns `{ balance }`. `creditService.getQuotaStatus(userId, action)` returns `{ withinFreeQuota, dailyUsed, dailyQuota, balance, earnHint }`. The balance endpoint must call both and synthesise the response:
- `balance` — from `getBalance`
- `daily_earned` — sum of today's earn transactions (already computed inside `getQuotaStatus` as `earnCount`)
- `daily_cap` — `DAILY_EARN_CAP` constant from `config/credits.ts` (currently = 4)
- `reset_timestamp` — next UTC midnight

Note: `getQuotaStatus` does not directly expose `earnCount` — the balance endpoint will need to either call `getQuotaStatus` (which runs the earn count query internally) and extract daily_earned separately, or expose a new `getDailyEarnedCount(userId)` helper. The cleanest approach is a single new `getBalanceSummary(userId)` method in `creditService.ts` that returns all four fields in one place.

### Vercel AI SDK v6 — `onFinish` Callback Shape

**Verified against installed `node_modules/ai/dist/index.d.ts`:**

```typescript
// Source: node_modules/ai/dist/index.d.ts lines 267-292, 1063-1067 (VERIFIED)
type LanguageModelUsage = {
  inputTokens: number | undefined;       // NOT "promptTokens"
  outputTokens: number | undefined;      // NOT "completionTokens"
  inputTokenDetails: { ... };
  outputTokenDetails: { ... };
};

type OnFinishEvent<TOOLS> = StepResult<TOOLS> & {
  readonly steps: StepResult<TOOLS>[];
  readonly totalUsage: LanguageModelUsage;  // aggregated across ALL steps
  // ...
};
```

CRITICAL: Use `totalUsage.inputTokens` and `totalUsage.outputTokens` (aggregated), NOT `usage.inputTokens` (single-step). For multi-step agent calls (up to 5 steps via `stopWhen: stepCountIs(5)`), `totalUsage` is the correct field for billing reconciliation.

**`generateText` usage (non-streaming):**
```typescript
// Source: node_modules/ai/dist/index.d.ts line 1517 (VERIFIED)
const result = await generateText({
  model: AGENT_MODEL,
  // ...
  onFinish: async ({ totalUsage }) => {
    // totalUsage.inputTokens, totalUsage.outputTokens
  },
});
```

**`streamText` usage (streaming):**
```typescript
// Source: node_modules/ai/dist/index.d.ts line 2904 (VERIFIED)
const result = streamText({
  model: AGENT_MODEL,
  // ...
  onFinish: async ({ totalUsage }) => {
    // fires after stream completes
    // totalUsage.inputTokens, totalUsage.outputTokens
  },
});
```

For `streamText`, `onFinish` fires AFTER the full stream completes. This is correct for the existing `/ai/chat/stream` route structure where the stream body is exhausted inside the `stream(c, ...)` callback.

### Token Logging Pattern (fire-and-forget)

Following the exact same fire-and-forget pattern already established by `appendMessages` and `creditDeduct`:

```typescript
// Pattern: backend/api/src/middleware/creditGate.ts lines 127-130 (VERIFIED)
creditService
  .deductCredits(userId, action, idempotencyKey)
  .catch((err) => {
    console.error('[creditDeduct] deduction failed:', err);
  });
```

Token logging insert should be:
```typescript
// Fire-and-forget token log insert (same pattern)
supabase
  .from('ai_cost_log')
  .insert({
    user_id: userId,
    model: modelId,           // string — e.g. 'claude-sonnet-4-20250514'
    input_tokens: totalUsage.inputTokens ?? 0,
    output_tokens: totalUsage.outputTokens ?? 0,
  })
  .then(() => {})
  .catch((err) => {
    console.error('[TokenLog] insert failed:', err);
  });
```

### Vision Route Upgrade (D-07, D-08, D-09)

Current state (lines 321-418 of `ai.ts`):
- Route: `router.post('/vision/nutrition', barcodeScanLimiter, async (c) => { ... })`
- Model: `AGENT_MODEL` (Sonnet)
- No credit gating
- No onFinish telemetry
- JSON.parse failure goes to outer catch, returns HTTP 500

Required state:
- Route: `router.post('/vision/nutrition', barcodeScanLimiter, creditCheck('scan'), creditDeduct('scan'), async (c) => { ... })`
- Primary model: `VISION_MODEL` (Haiku)
- Fallback model: `AGENT_MODEL` (Sonnet) on JSON parse failure only
- `onFinish` on both primary and fallback calls

**Fallback logic pattern (D-09):**
```typescript
// Primary attempt with VISION_MODEL (Haiku)
let visionResult: ReturnType<typeof generateText> | undefined;
let text: string;
try {
  const primary = await generateText({
    model: VISION_MODEL,
    // ...
    onFinish: async ({ totalUsage }) => { /* log haiku tokens */ }
  });
  text = primary.text;
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  const result = JSON.parse(cleaned);
  return c.json(result);
} catch (parseErr) {
  // Only fall back on JSON parse failure, not on Anthropic API errors
  if (!(parseErr instanceof SyntaxError)) throw parseErr;
  // Sonnet fallback
  const fallback = await generateText({
    model: AGENT_MODEL,
    // ...
    onFinish: async ({ totalUsage }) => { /* log sonnet tokens */ }
  });
  // parse and return fallback result
}
```

Note: The current code has a single outer `try/catch`. The fallback requires a nested try/catch that distinguishes `SyntaxError` (parse failure → fallback) from Anthropic API errors (let outer catch handle them).

### Migration 027 — `ai_cost_log` Table

Migration numbering confirmed: 026 is the last file (`supabase/migrations/026_ai_credits.sql`). Next is 027. [VERIFIED: migration directory listing]

```sql
-- 027_ai_cost_log.sql
CREATE TABLE IF NOT EXISTS public.ai_cost_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_log_user_created
  ON public.ai_cost_log (user_id, created_at DESC);

-- Index for weekly billing reconciliation queries
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_created
  ON public.ai_cost_log (created_at DESC);

ALTER TABLE public.ai_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_cost_log_own" ON public.ai_cost_log
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

RLS pattern matches migration 026 exactly — uses `(SELECT auth.uid())` sub-select caching pattern. [VERIFIED: 026_ai_credits.sql lines 20-23]

### Recommended Project Structure for New Files

```
backend/api/src/
├── routes/
│   ├── credits.ts           ← NEW: GET /credits/balance
│   └── ai.ts                ← MODIFY: vision upgrade + onFinish telemetry
├── services/
│   └── creditService.ts     ← MODIFY: add getBalanceSummary() helper
├── app.ts                   ← MODIFY: mount creditsRouter
supabase/migrations/
└── 027_ai_cost_log.sql      ← NEW: ai_cost_log table
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer | `onFinish` callback | AI SDK provides exact token counts post-call; pre-counting is inaccurate and wasteful |
| Credit balance query | Custom SQL | `creditService.getBalance()` | Already handles upsert-on-first-access; re-implementing duplicates the default-row logic |
| Authentication on credits router | Custom JWT parsing | `authMiddleware` import from `middleware/auth.js` | Existing middleware handles all edge cases; credits route must use same middleware as AI routes |
| Negative-balance protection | Application-layer check | `deduct_ai_credits` RPC | SECURITY DEFINER + FOR UPDATE row lock — application-layer check-then-deduct produces negative balances under concurrent Vercel Fluid Compute requests |

**Key insight:** All hard problems in this phase are already solved in Phase 17/18. The task is wiring, not inventing.

---

## Common Pitfalls

### Pitfall 1: Wrong `usage` vs `totalUsage` Field
**What goes wrong:** Using `usage.inputTokens` instead of `totalUsage.inputTokens` in `onFinish`. For single-step calls `usage` equals `totalUsage`, but the chat routes use `stopWhen: stepCountIs(5)` — multi-step calls accumulate tokens across steps. `usage` is only the final step; `totalUsage` is the billing total.
**Why it happens:** The field name is non-obvious; single-step tests pass but billing is undercounted on multi-step calls.
**How to avoid:** Always use `totalUsage` in `onFinish`. [VERIFIED: node_modules/ai/dist/index.d.ts line 1067]
**Warning signs:** Token counts that are lower than expected for complex queries.

### Pitfall 2: `onFinish` Position in `streamText`
**What goes wrong:** Placing `onFinish` inside the `stream(c, ...)` callback body instead of in the `streamText()` call options.
**Why it happens:** The streaming pattern in `ai.ts` has a two-level structure: `streamText({...})` returns a result, then `stream(c, async (s) => { for await (part of result.fullStream) ... })`. The `onFinish` option goes on `streamText({})`, not inside the stream consumer.
**How to avoid:** `streamText({ model, ..., onFinish: async ({totalUsage}) => { ... } })` — `onFinish` is a top-level option. It fires automatically when the stream is fully consumed.
**Warning signs:** `onFinish` never fires if placed incorrectly; no log entries appear for streaming calls.

### Pitfall 3: Fallback Swallowing API Errors as Parse Errors
**What goes wrong:** A broad `catch` on the Haiku call triggers Sonnet fallback even when the failure was an Anthropic API error (e.g. 529, timeout), not a JSON parse failure.
**Why it happens:** The current vision route uses a single outer try/catch; splitting the parse failure from API failure requires explicit `instanceof SyntaxError` check.
**How to avoid:** Inner try/catch only around `JSON.parse(cleaned)` — not around the entire `generateText` call. Anthropic API errors bubble to the outer catch and return HTTP 500.
**Warning signs:** Unexpected Sonnet usage in cost logs when Haiku should be handling requests.

### Pitfall 4: Missing `authMiddleware` on Credits Router
**What goes wrong:** Credits router mounts without `router.use('*', authMiddleware)` — balance endpoint returns `c.get('auth')` as undefined, crashes or exposes data to unauthenticated users.
**Why it happens:** New route file, easy to forget the auth guard established in every other router.
**How to avoid:** First line after `const router = new Hono()` must be `router.use('*', authMiddleware)`.
**Warning signs:** `c.get('auth')` is undefined at runtime; TypeScript won't catch this.

### Pitfall 5: `getBalanceSummary` Making N+1 Supabase Queries
**What goes wrong:** Balance endpoint calls `getBalance()` + `getQuotaStatus('chat')` separately — the latter makes 3-4 Supabase queries including `getBalance()` again internally.
**Why it happens:** `getQuotaStatus` was designed for middleware (needs only the balance check for gate logic), not for the summary endpoint.
**How to avoid:** Add a dedicated `getBalanceSummary(userId)` helper to `creditService.ts` that runs the minimum queries: one for balance + one for today's earn count. Avoids the N+1 pattern.

### Pitfall 6: `daily_earned` vs `daily_cap` Confusion
**What goes wrong:** `daily_earned` is the number of credits earned TODAY so far (could be 0-4). `daily_cap` is the fixed maximum (DAILY_EARN_CAP = 4). These are different from `dailyQuota` (which is action-specific free usage quota, not the earn cap).
**Why it happens:** `getQuotaStatus` uses `dailyQuota` to mean "total free uses of this action today" — it conflates earning with free quota.
**How to avoid:** Use `DAILY_EARN_CAP` directly from `config/credits.ts` for the `daily_cap` field. Use the earn transaction count query for `daily_earned`.

---

## Code Examples

### Credits Router Skeleton

```typescript
// backend/api/src/routes/credits.ts
// Source: patterns from existing routes (VERIFIED)
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import * as creditService from '../services/creditService.js';
import { DAILY_EARN_CAP } from '../config/credits.js';

const router = new Hono();

router.use('*', authMiddleware);

router.get('/balance', async (c) => {
  const { userId } = c.get('auth');
  const summary = await creditService.getBalanceSummary(userId);

  // reset_timestamp = next UTC midnight
  const now = new Date();
  const resetTs = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
  )).toISOString();

  return c.json({
    balance: summary.balance,
    daily_earned: summary.dailyEarned,
    daily_cap: DAILY_EARN_CAP,
    reset_timestamp: resetTs,
  });
});

export { router as creditsRouter };
```

### Token Logging Helper (fire-and-forget)

```typescript
// Pattern verified from creditGate.ts lines 127-130 (VERIFIED)
// To be added to ai.ts (or extracted to a shared helper)
function logTokenUsage(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  totalUsage: { inputTokens: number | undefined; outputTokens: number | undefined }
) {
  supabase
    .from('ai_cost_log')
    .insert({
      user_id: userId,
      model: modelId,
      input_tokens: totalUsage.inputTokens ?? 0,
      output_tokens: totalUsage.outputTokens ?? 0,
    })
    .then(() => {})
    .catch((err) => console.error('[TokenLog] insert failed:', err));
}
```

### Vision Route Upgrade Skeleton

```typescript
// Replacement for router.post('/vision/nutrition', ...) in ai.ts
router.post('/vision/nutrition',
  barcodeScanLimiter,
  creditCheck('scan'),
  creditDeduct('scan'),
  async (c) => {
    // ... existing image source resolution (unchanged) ...

    try {
      // Primary: VISION_MODEL (Haiku)
      const { text } = await generateText({
        model: VISION_MODEL,
        messages: [{ role: 'user', content: [imageContent, { type: 'text', text: prompt }] }],
        onFinish: ({ totalUsage }) => {
          logTokenUsage(supabase, userId, 'claude-haiku-4-5-20251001', totalUsage);
        },
      });

      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

      try {
        const result = JSON.parse(cleaned);  // throws SyntaxError on parse failure
        return c.json(result);
      } catch (parseErr) {
        if (!(parseErr instanceof SyntaxError)) throw parseErr;
        // D-09: Fallback to Sonnet only on parse failure
        console.warn('[Vision] Haiku parse failed, falling back to Sonnet');
      }

      // Fallback: AGENT_MODEL (Sonnet)
      const { text: fallbackText } = await generateText({
        model: AGENT_MODEL,
        messages: [{ role: 'user', content: [imageContent, { type: 'text', text: prompt }] }],
        onFinish: ({ totalUsage }) => {
          logTokenUsage(supabase, userId, 'claude-sonnet-4-20250514', totalUsage);
        },
      });
      const fallbackCleaned = fallbackText.replace(/```json\n?|\n?```/g, '').trim();
      const fallbackResult = JSON.parse(fallbackCleaned);
      return c.json(fallbackResult);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Vision Error]', msg);
      return c.json({ error: 'Failed to analyze image' }, 500);
    }
  }
);
```

### onFinish on generateText (non-streaming chat)

```typescript
// Modification to /ai/chat handler in ai.ts
// Source: node_modules/ai/dist/index.d.ts line 1517 (VERIFIED)
const result = await generateText({
  model: AGENT_MODEL,
  system: systemPrompt,
  messages: allMessages,
  tools: buildSDKTools(userId, userToken),
  stopWhen: stepCountIs(5),
  onFinish: ({ totalUsage }) => {           // ADD THIS
    logTokenUsage(supabase, userId, 'claude-sonnet-4-20250514', totalUsage);
  },
});
```

### onFinish on streamText (streaming chat)

```typescript
// Modification to /ai/chat/stream handler in ai.ts
// Source: node_modules/ai/dist/index.d.ts line 2904 (VERIFIED)
const result = streamText({
  model: AGENT_MODEL,
  system: systemPrompt,
  messages: allMessages,
  tools: buildSDKTools(userId, userToken),
  stopWhen: stepCountIs(5),
  onFinish: ({ totalUsage }) => {           // ADD THIS
    logTokenUsage(supabase, userId, 'claude-sonnet-4-20250514', totalUsage);
  },
});
```

### app.ts mount addition

```typescript
// Addition to backend/api/src/app.ts
// Source: existing app.ts pattern (VERIFIED)
import { creditsRouter } from './routes/credits.js';
// ... after existing imports ...
app.route('/credits', creditsRouter);  // after '/ai' route
```

---

## State of the Art

| Old Pattern | Current Pattern | Impact |
|-------------|-----------------|--------|
| `promptTokens` / `completionTokens` (AI SDK v3) | `inputTokens` / `outputTokens` (AI SDK v6) | Field name must match installed version |
| `usage` (per-step) | `totalUsage` (aggregated all steps) | Multi-step agent calls require `totalUsage` for accurate billing |
| `maxSteps: N` | `stopWhen: stepCountIs(N)` | Already correct in this codebase |
| `parameters` in tools | `inputSchema` in tools | Already correct in this codebase |

**No deprecated patterns in use:** The existing `ai.ts` already uses v6 syntax correctly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `model` string for `VISION_MODEL` is `'claude-haiku-4-5-20251001'` and for `AGENT_MODEL` is `'claude-sonnet-4-20250514'` — used as literal strings in `ai_cost_log.model` field | Code Examples | Minor: string would be wrong in cost log, but functionally harmless; correctable by reading `config/models.ts` at task time |
| A2 | `getQuotaStatus` internally calls `getBalance` — extracting a `getBalanceSummary` helper avoids the N+1 | Architecture Patterns | Low: even if wrong, N+1 only affects performance not correctness; fix in the helper implementation |

---

## Open Questions

1. **Should `logTokenUsage` be a shared helper or inline in each handler?**
   - What we know: Three call sites (chat, chat/stream, vision). Pattern is identical.
   - What's unclear: Whether to define `logTokenUsage` at module scope in `ai.ts` or extract to `services/tokenLog.ts`.
   - Recommendation: Module-scope helper in `ai.ts` is sufficient — avoids over-engineering a single-file extraction for 3 call sites. Planner can decide.

2. **`reset_timestamp`: always next UTC midnight or next action-specific reset?**
   - What we know: CONTEXT.md specifies this field in the balance response shape. Chat and scan quotas reset daily (UTC); program resets monthly.
   - What's unclear: Whether to return next midnight (simple, always correct for daily actions) or to make it action-aware.
   - Recommendation: Next UTC midnight. The balance endpoint does not take an action parameter, and daily actions are the primary use case.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is backend code/config changes only. No new external services, CLIs, or tools are required beyond what is already used in Phase 18.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript type-check (`tsc --noEmit`) + manual HTTP testing |
| Config file | `backend/api/tsconfig.json` |
| Quick run command | `cd backend/api && npm run type-check` |
| Full suite command | `cd backend/api && npm run type-check` |

Note: No automated test files exist for the backend (`tests/` directory absent). Phase 19 validation follows the existing project pattern: TypeScript compilation for correctness, manual curl/Postman for integration testing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COST-02 | `ai_cost_log` row inserted after chat call | manual | `curl -X POST /ai/chat` + Supabase dashboard | ❌ no test file |
| COST-02 | `ai_cost_log` row inserted after stream call | manual | `curl -X POST /ai/chat/stream` + Supabase dashboard | ❌ no test file |
| COST-02 | `ai_cost_log` row inserted after vision call | manual | `curl -X POST /ai/vision/nutrition` + Supabase dashboard | ❌ no test file |
| COST-03 | Monthly cost ceiling calculation | manual | VERIFICATION.md calculation document | ❌ manual only |
| SC-1 | `GET /credits/balance` returns correct shape | manual | `curl -H "Authorization: Bearer ..." /credits/balance` | ❌ no test file |
| SC-2 | 402 returned when balance = 0 | manual | Set balance to 0, call `/ai/chat` | ❌ no test file |
| SC-4 | Vision falls back to Sonnet on parse failure | manual | Mock degraded-photo test set | ❌ manual only |

### Sampling Rate
- **Per task commit:** `cd backend/api && npm run type-check`
- **Per wave merge:** `cd backend/api && npm run type-check`
- **Phase gate:** TypeScript clean + manual integration test of all three endpoints before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `supabase/migrations/027_ai_cost_log.sql` — new migration needed before any application code can reference the table
- [ ] `backend/api/src/routes/credits.ts` — new file needed
- [ ] `backend/api/src/services/creditService.ts` — `getBalanceSummary` helper needed

*(No test framework installation required — type-check is already configured)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` on all routes including new `/credits` |
| V3 Session Management | no | Stateless JWT — no server sessions |
| V4 Access Control | yes | RLS on `ai_cost_log` — users read only their own rows |
| V5 Input Validation | yes | Existing `zValidator` on chat routes; vision uses manual null-check |
| V6 Cryptography | no | No new crypto — Supabase handles JWT verification |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated balance query | Information disclosure | `authMiddleware` on credits router |
| Negative balance via concurrent deductions | Tampering | Already mitigated — `deduct_ai_credits` RPC with FOR UPDATE lock (migration 026) |
| Token log as cost oracle | Information disclosure | RLS restricts `ai_cost_log` to row owner only |
| Vision fallback abuse (force Sonnet via corrupt images) | Elevation of privilege | Fallback only triggered by `SyntaxError` on parse — cannot be forced by API error; credit cost is identical for both models from user perspective |

---

## Sources

### Primary (HIGH confidence)
- `backend/api/src/routes/ai.ts` — full source, lines 1-421, verified directly
- `backend/api/src/app.ts` — route mounting pattern, verified directly
- `backend/api/src/middleware/creditGate.ts` — middleware chain pattern, verified directly
- `backend/api/src/services/creditService.ts` — all public API signatures, verified directly
- `backend/api/src/config/credits.ts` — constants values, verified directly
- `backend/api/src/config/models.ts` — model IDs, verified directly
- `node_modules/ai/dist/index.d.ts` lines 267-292, 1063-1067, 1517, 2904 — `LanguageModelUsage`, `OnFinishEvent`, callback signatures, VERIFIED
- `supabase/migrations/026_ai_credits.sql` — RLS pattern, migration numbering, verified directly
- `backend/api/package.json` — dependency versions, verified directly

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01 through D-11 — locked decisions from discuss session
- ROADMAP.md Phase 19 success criteria — SC-1 through SC-5 response shapes

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json and node_modules
- Architecture: HIGH — all patterns read directly from existing source files
- Pitfalls: HIGH — derived from direct reading of SDK type definitions and existing code structure
- SDK onFinish shape: HIGH — verified in installed `node_modules/ai/dist/index.d.ts`

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack — Hono + AI SDK — but verify if AI SDK major version bumped)
