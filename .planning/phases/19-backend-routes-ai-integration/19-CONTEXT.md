# Phase 19: Backend Routes + AI Integration - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Mount the credits balance API and complete AI endpoint credit integration: add `GET /credits/balance`, switch `/ai/vision/nutrition` to Haiku with Sonnet fallback, add token usage logging to `ai_cost_log` table for all LLM-calling routes (chat, stream, vision). Cost ceiling verified via manual calculation in VERIFICATION.md.

</domain>

<decisions>
## Implementation Decisions

### Credits Router
- **D-01:** Create a separate `backend/api/src/routes/credits.ts` router, mounted at `app.route('/credits', creditsRouter)` in `app.ts`
- **D-02:** Credits router is NOT merged into `ai.ts` — conceptual separation maintained, easier to extend with future endpoints (history, earn-status)

### Token Usage Logging
- **D-03:** Log token usage from `/ai/chat`, `/ai/chat/stream`, and `/ai/vision/nutrition` only
- **D-04:** `/ai/tools/execute` is NOT logged — it has zero LLM token cost (pure function dispatch)
- **D-05:** Logging is done via the Vercel AI SDK `onFinish` callback (available in both `generateText` and `streamText`)
- **D-06:** Fields to log: `user_id`, `model`, `input_tokens`, `output_tokens`, logged at the `ai_cost_log` Supabase table via migration 027

### Vision Scan Upgrade
- **D-07:** Switch `/ai/vision/nutrition` from `AGENT_MODEL` (Sonnet) to `VISION_MODEL` (Haiku) — already defined in `config/models.ts`
- **D-08:** Add credit gating to `/ai/vision/nutrition` using the existing `creditCheck('scan')` + `creditDeduct('scan')` middleware pattern
- **D-09:** Sonnet fallback triggers on JSON parse failure only (Haiku response not parseable as `{foods:[...]}`) — NOT triggered by `foods:[]` (empty result is valid)

### Cost Ceiling Verification
- **D-10:** SC-5 verified via manual calculation documented in VERIFICATION.md — no automated test infrastructure required
- **D-11:** Calculation uses measured avg token counts from credit config constants (CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS in `config/credits.ts`)

### Claude's Discretion
- Migration number (027 is next in sequence — use that)
- RLS policy on `ai_cost_log` (same pattern as other tables — `auth.uid() = user_id`)
- `ai_cost_log` table column types (TEXT for model, INTEGER for tokens, TIMESTAMPTZ for created_at)
- `GET /credits/balance` response field names (follow SC-1 exactly: balance, daily_earned, daily_cap, reset_timestamp)
- Whether to add `X-Request-Id` to vision endpoint for idempotency (follow existing pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Credit system
- `backend/api/src/services/creditService.ts` — getBalance, getQuotaStatus, deductCredits (Phase 18 implementation)
- `backend/api/src/middleware/creditGate.ts` — creditCheck + creditDeduct middleware (Phase 18 implementation)
- `backend/api/src/config/credits.ts` — CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS, EARN_AMOUNT, DAILY_EARN_CAP
- `backend/api/src/config/models.ts` — AGENT_MODEL, VISION_MODEL

### Existing routes (integration context)
- `backend/api/src/routes/ai.ts` — Full AI router: credit gate already wired into /chat and /chat/stream; /vision/nutrition needs upgrade
- `backend/api/src/app.ts` — Route mounting pattern (app.route calls)

### Database
- `supabase/migrations/026_ai_credits.sql` — user_ai_credits table + ai_credit_transactions + deduct_ai_credits RPC
- `supabase/migrations/025_storage_buckets.sql` — Last migration before 026 (confirm sequence)

### Requirements
- `.planning/REQUIREMENTS.md` §COST-02, §COST-03 — Token logging and cost ceiling requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `creditCheck('action')` + `creditDeduct('action')`: middleware factories already tested in Phase 18 — apply directly to vision route
- `authMiddleware`: already on all `/ai/*` routes — credits router needs to import and use it too
- `createUserRateLimiter`: per-user rate limiter already used on AI routes — vision already has `barcodeScanLimiter`
- `creditService.getBalance(userId)`: returns `{ balance }` — needs to extend the balance response for the API endpoint (add daily_earned, daily_cap, reset_timestamp from getQuotaStatus)

### Established Patterns
- Route files export a named router (`export { router as creditsRouter }`)
- All routes under `/ai/*` apply `router.use('*', authMiddleware)` at top
- Supabase admin client instantiation pattern: same in every route/service file
- onFinish callback in Vercel AI SDK v6 receives `{ usage: { promptTokens, completionTokens } }` + `finishReason`
- Streaming uses `streamText(...)` — `onFinish` fires after stream completes
- Migration file naming: `0NN_snake_case.sql`, RLS with `(SELECT auth.uid())` pattern from migration 026

### Integration Points
- `app.ts` needs `import { creditsRouter }` + `app.route('/credits', creditsRouter)`
- `ai.ts` vision route: replace `AGENT_MODEL` with `VISION_MODEL`, wrap in try/catch for fallback, add `creditCheck('scan')` + `creditDeduct('scan')` to middleware chain
- `onFinish` in generateText/streamText: fire-and-forget insert to `ai_cost_log` (same pattern as appendMessages)
- `GET /credits/balance` reads from `creditService.getBalance` + `creditService.getQuotaStatus` to assemble full response

</code_context>

<specifics>
## Specific Ideas

- SC-1 response shape: `{ balance, daily_earned, daily_cap, reset_timestamp }` — exact field names from ROADMAP success criteria
- SC-2 error body on 402: `{ error: 'insufficient_credits' }` — distinct from 429 rate limit body `{ error: 'too_many_requests' }` (already implemented in creditGate.ts)
- Vision fallback: wrap Haiku call in try/catch, on catch (parse error) retry with AGENT_MODEL; log both attempts to ai_cost_log separately
- Token logging: fire-and-forget insert (don't await) — same fire-and-forget pattern as `appendMessages` and `creditDeduct`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-backend-routes-ai-integration*
*Context gathered: 2026-04-05*
