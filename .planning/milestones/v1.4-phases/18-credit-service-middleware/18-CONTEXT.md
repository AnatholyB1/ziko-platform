# Phase 18: Credit Service + Middleware - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A single `creditService.ts` is the authoritative source for all credit math (balance, earn, daily quotas, idempotency), and a Hono middleware pair (`creditCheck` / `creditDeduct`) can gate any AI route without modifying handler code. Premium users pass through without deduction.

</domain>

<decisions>
## Implementation Decisions

### Base Allocation Model
- **D-01:** Daily base allocation uses **first-N-free pass-through** — middleware counts today's usage per action type in `ai_credit_transactions`. If usage < quota, the action passes without deduction. No credits are granted upfront, no cron needed.
- **D-02:** **Unified pass-through** for both base and bonus — total daily quota = base + earned bonus (e.g., scan quota = 1 base + 2 earned = 3 max free). One simple counter per action type. Once total quota exhausted, deduct from credit balance.
- **D-03:** Monthly base (1 program/month) uses the same pattern — count `ai_credit_transactions` WHERE type='deduct' AND source='program' in current calendar month.

### 402 Response Shape
- **D-04:** Credit exhaustion returns a **rich 402 response**: `{ error: 'insufficient_credits', balance, required, daily_used, daily_quota, earn_hint }`. The mobile app gets everything it needs for the CRED-05 exhaustion bottom sheet (Phase 21) in a single response, no extra API call.
- **D-05:** `earn_hint` is the next earnable activity suggestion (e.g., "log a workout to earn credits") — computed by creditService from today's earn state.

### Service File Organization
- **D-06:** `creditService.ts` lives in a **new `services/` directory**: `backend/api/src/services/creditService.ts`. Establishes the services layer pattern for business logic, separate from routes, middleware, and infrastructure.
- **D-07:** Middleware pair lives at `backend/api/src/middleware/creditGate.ts` — follows the existing `auth.ts` and `rateLimiter.ts` pattern in `middleware/`.

### Credit Cost Constants
- **D-08:** Per-action costs and daily/monthly quotas defined in **`backend/api/src/config/credits.ts`** — next to `models.ts`. Exported as `CREDIT_COSTS` and `DAILY_QUOTAS` const objects. creditService imports them.
- **D-09:** Known costs: scan = 3 credits, chat = 4 credits, program = 4 credits. Barcode scan = free (OFF API, no AI).
- **D-10:** Known quotas: base 1 scan + 1 chat/day, 1 program/month. Bonus +2 scan + 2 chat/day, +1 program/month (earned by activity).

### Claude's Discretion
- Exact TypeScript types/interfaces for creditService exports
- Middleware attachment pattern in Hono (wrapper vs afterResponse hook) — as long as SC5 is met (deduct only on handler success)
- Internal helper functions within creditService (query builders, date utilities)
- Error handling patterns for Supabase RPC call failures

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Foundation (Phase 17)
- `supabase/migrations/026_ai_credits.sql` — Credit tables, deduct RPC, idempotency index, welcome trigger, tier column. The service layer wraps these DB primitives.
- `.planning/phases/17-db-foundation-model-fix/17-CONTEXT.md` — Phase 17 decisions (D-01 through D-14) that constrain this phase

### Backend Patterns
- `backend/api/src/middleware/auth.ts` — Existing Hono middleware pattern (context variable, `c.set()`, `await next()`)
- `backend/api/src/middleware/rateLimiter.ts` — Existing rate limiter pattern (exempt paths, 429 responses)
- `backend/api/src/config/models.ts` — Existing config file pattern (exported constants)
- `backend/api/src/app.ts` — Route mounting and middleware chain order

### Requirements
- `.planning/REQUIREMENTS.md` — CRED-02, CRED-03, EARN-07, EARN-10, PREM-02 requirements for this phase

### Credit Strategy
- `.planning/research/SUMMARY.md` — Credit system research with Anthropic pricing data

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/src/middleware/auth.ts` — Hono middleware pattern with `AuthContext` type augmentation via `declare module 'hono'`
- `backend/api/src/middleware/rateLimiter.ts` — Exempt paths pattern, sliding window, 429 response shape
- `backend/api/src/config/models.ts` — Config file pattern with typed exports
- `backend/api/src/lib/redis.ts` — Infrastructure client pattern (if needed for caching)
- `supabase/migrations/026_ai_credits.sql` — `deduct_ai_credits` RPC already handles atomic deduction; service wraps it

### Established Patterns
- Middleware: `(c: Context, next: Next)` signature, `c.set('auth', ...)` for passing context
- Config: `UPPER_SNAKE_CASE` exported constants
- Supabase calls: `supabase.rpc('function_name', params)` for RPC, `.from('table').select()` for queries
- Error responses: `c.json({ error: 'message' }, statusCode)`

### Integration Points
- `app.ts` L43 — middleware chain: after `ipRateLimiter`, before route handlers (credit middleware inserts here)
- AI routes that need gating: `/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute`, future `/ai/scan`
- `c.get('auth').userId` — creditService receives userId from auth middleware context

</code_context>

<specifics>
## Specific Ideas

- 1 credit = EUR 0.001 (from Phase 17 D-02) — all cost math uses integer credits
- EUR 0.75/month ceiling = 750 credits — the quota system ensures freemium users stay under this
- The first-N-free model means balance display is purely "earned credits remaining" — no daily grants cluttering the balance
- `earn_hint` in the 402 response creates a direct call-to-action for the exhaustion sheet

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-credit-service-middleware*
*Context gathered: 2026-04-05*
