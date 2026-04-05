# Project Research Summary

**Project:** Ziko Platform — v1.4 AI Credit System & Monetization
**Domain:** Gamified AI credit/quota system for a freemium fitness mobile app
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

Ziko v1.4 introduces a cost-control layer over the existing Claude Sonnet orchestrator by adding a dual-currency gamification system: cosmetic coins (existing, unlimited) and a new functional AI credit currency (capped, earned by activity). The product pattern is well-established — Duolingo Hearts, Habitica Gold, and Workout Quest XP all follow the same earn-by-doing loop — but the specific combination of activity-gated AI access applied to a fitness app is novel. The recommended approach is a Supabase-native credit ledger with an atomic PostgreSQL RPC for deduction, activity-based earning through existing tool executor hooks, and Haiku as the vision model to cut per-scan costs by approximately 70%. Zero new npm packages are required; all capability exists in the current stack.

The highest-impact architectural decision is how credit deduction is implemented: it must be a single atomic `SECURITY DEFINER` PostgreSQL function with `SELECT ... FOR UPDATE` row locking. Application-layer check-then-deduct patterns will produce negative balances under concurrent serverless invocations — Vercel Fluid Compute (default since early 2025) allows a single function instance to handle multiple concurrent requests, multiplying this risk. A companion `ai_credit_transactions` ledger table with a `UNIQUE` constraint on `(user_id, source, idempotency_key)` eliminates the reward double-crediting risk from mobile retries. Daily earn caps must use a lazy date-keyed reset (no cron) to avoid Vercel's at-least-once cron delivery behavior.

The most time-sensitive risk is a hard breaking change: `claude-3-haiku-20240307` retires April 19, 2026 — less than two weeks from the start of this milestone. Any existing reference to that model ID will start producing API failures on that date. This grep-and-replace must happen in the first deliverable of Phase 1, before any other work. The second key risk is Haiku food-scan quality on degraded real-world photos; a Sonnet fallback path must be designed and tested before Haiku is shipped to production.

## Key Findings

### Recommended Stack

The stack requires zero new npm packages. The existing `@ai-sdk/anthropic ^3.0.58` accepts any Anthropic model ID string — swapping to `claude-haiku-4-5-20251001` for vision is a one-constant change. The Vercel AI SDK v6 `generateText` and `streamText` functions already expose `result.usage.inputTokens` / `result.usage.outputTokens` for cost telemetry via `onFinish`. The existing `@upstash/redis ^1.37.0` supports `pipeline()`, `incr()`, and `expire()` for rate limiting but must NOT serve as the credit balance store — credits require a durable audit trail which only Supabase provides. Redis remains purely for request-rate abuse prevention; the credit system runs on Supabase.

**Core technologies (new configuration only):**
- `@ai-sdk/anthropic ^3.0.58`: vision scan model — swap to `claude-haiku-4-5-20251001`; 70% cost reduction per scan
- `ai ^6.0.116` (Vercel AI SDK): cost telemetry — `result.usage` + `onFinish` → Supabase `ai_cost_log`
- Supabase PostgreSQL: credit balance and transaction ledger — single source of truth; not Redis
- Upstash Redis: rate limiting only (existing role, unchanged) — runs before credit gate
- Hono v4 middleware: two new functions (`creditCheck`, `creditDeduct`) wrapping AI routes

**New SQL schema (1 migration, 2 tables + 1 RPC):**
- `user_ai_credits` — one row per user: `ai_credits INT DEFAULT 5`, `daily_credits_earned INT`, `daily_reset_date DATE`
- `ai_credit_transactions` — ledger: `amount INT`, `type ('earn'|'deduct')`, `source TEXT`
- `deduct_ai_credits(user_id, cost)` — `SECURITY DEFINER` RPC with `FOR UPDATE` row lock

### Expected Features

**Must have — table stakes (v1.4):**
- Visible credit balance in UI — users expect to see remaining credits before acting; without this, 402 errors appear to be bugs
- Daily base allocation — 1 free vision scan + 1 free AI chat/day; 1 program/month; without any free base, free users see zero AI value and churn
- Per-action cost disclosure — show "1 credit" next to each AI button before consumption; surprises cause churn
- Credit exhaustion bottom sheet — 402 response must show WHY and HOW to earn more, not a raw error
- Activity-to-credit earn (6 triggers) — habit, nutrition, measurement, stretching, cardio each award +1 credit (cardio = +2); 2 bonus credit daily cap total from activity
- Idempotent earn ledger — `ai_credit_transactions` with unique constraint on source record UUID prevents double-award on mobile retry
- `user_tier` column (`free` | `premium`) — credit gate skips for premium; 5-minute migration now avoids a breaking schema change when IAP eventually ships
- Haiku vision migration — immediate 70% cost reduction per scan; independent of credit system, can ship first

**Should have — differentiators (v1.4):**
- Credit earn toast on activity save — "+1 AI credit" inline with post-save confirmation (Habitica XP pop-up pattern); immediate positive reinforcement
- In-context credit nudge — "Ask AI (2 credits left)" label inline with AI buttons, not a blocking modal; lower friction than Duolingo Hearts
- Daily earn progress display — "2 more credits available today — log a stretch session to earn"; gives users agency
- "Fast scan" framing for Haiku — positions cost optimization as a user benefit (speed), not a model downgrade

**Defer (v2+):**
- In-app purchases (IAP) — RevenueCat + StoreKit/Google Play Billing; 30% platform cut, 4-6 week integration, RGPD purchase compliance
- Premium subscription tier — needs pricing strategy, cancellation flow, recurring billing compliance
- Streak earn multiplier — requires dedicated streak table, timezone-aware day boundaries, missed-day grace logic
- Credit usage history screen — add when support tickets about balance appear
- Referral credits and credit gifting — abuse vector complexity exceeds v1.4 scope

**Explicit anti-features (never implement):**
- Credit rollover — causes unpredictable API cost spikes from accumulated balances; break cost projection model
- Coins-to-credits bridge — decouples coins from cosmetic purpose; creates arbitrage loops that inflate AI cost
- Retroactive credit award for past activity — one-time welcome bonus (5 credits via migration) for existing users is the correct substitute
- Hard paywall (zero free AI) — kills trial experience and virality; research confirms "selective free access creates conviction to upgrade"
- Energy-style gates on activity logging — never gate the core fitness retention mechanic itself

### Architecture Approach

The credit system integrates into the existing Hono middleware chain at the API layer only — no credit checks in RLS policies (per-row function execution destroys performance). Three new backend files (`middleware/credits.ts`, `lib/creditService.ts`, `routes/credits.ts`) and one new migration (`026_ai_credits.sql`) carry all new logic. Existing tool executors gain a fire-and-forget `creditService.earnCredits()` call after each successful write. The mobile app gains a new `creditStore.ts` (Zustand) and UI updates to the AI chat header, nutrition vision screen, and gamification dashboard.

**Major components:**
1. `src/middleware/credits.ts` — `creditCheck(cost)` blocks before handler if balance is 0; `creditDeduct(cost)` writes deduction after handler only if status < 400
2. `src/lib/creditService.ts` — `deductCredits` via Supabase RPC (atomic), `earnCredits` with lazy daily-reset cap, `getBalance` with missing-row upsert; single source of truth for all credit math
3. `src/routes/credits.ts` — `GET /credits/balance`, `GET /credits/history`, `POST /credits/earn` (covers direct-Supabase mobile writes that bypass tool executors)
4. `supabase/migrations/026_ai_credits.sql` — `user_ai_credits` + `ai_credit_transactions` + RLS + `deduct_ai_credits` RPC function with `FOR UPDATE` lock
5. `apps/mobile/src/stores/creditStore.ts` — Zustand; fetches `/credits/balance` on mount and screen focus

**Middleware chain after changes (AI routes):**
```
logger → cors → secureHeaders → ipRateLimiter
  → authMiddleware → aiChatLimiter → zValidator → creditCheck → handler → creditDeduct
```

**Hard dependency sequence for build order:**
Migration → creditService → credits middleware → routes/credits → app.ts mount → routes/ai modifications → tool executor modifications → mobile creditStore → mobile UI

### Critical Pitfalls

1. **Race condition on credit deduction (concurrent serverless)** — use a `SECURITY DEFINER` PostgreSQL RPC with `SELECT ... FOR UPDATE` and a relative `UPDATE balance = balance - cost`; never check-then-decrement in application code. Add `CHECK (balance >= 0)` as a last-resort database constraint. Under Vercel Fluid Compute, two simultaneous requests on the same instance share module-level state — making application-layer guards meaningless.

2. **Activity reward double-crediting on mobile retry** — `ai_credit_transactions` must have a `UNIQUE (user_id, source, idempotency_key)` constraint where the idempotency key is the source record UUID. Use `INSERT ... ON CONFLICT DO NOTHING` so retries are silently skipped. Stigg documented this as "one of the hardest problems" in usage pipelines.

3. **Deprecated Haiku model ID — hard breaking change April 19, 2026** — `claude-3-haiku-20240307` retires in under two weeks. Grep the entire codebase for this string as the very first task of Phase 1. Zero results required before any deploy.

4. **RLS credit check per row (catastrophic query performance)** — never embed credit balance lookups in RLS policies. RLS on credit tables must only enforce ownership using `(SELECT auth.uid()) = user_id` (sub-select form, not bare `auth.uid()` — the sub-select allows per-statement caching for up to 99.99% improvement per Supabase benchmarks).

5. **Token counting inaccuracy causing cost budget drift** — Vercel AI SDK v6 has documented token normalization inaccuracies (GitHub issue #9921); prompt cache write costs are absent from `usage` totals. Reconcile weekly against the Anthropic usage API during the first month. Use `messages.countTokens` for pre-launch calibration before freezing `CREDIT_COSTS` constants.

6. **Haiku vision quality regression on real-world photos** — build a Sonnet fallback path triggered by structured-output parse failure. Run a 50-photo blind test with degraded images (blurry, dark, off-angle, non-Latin packaging) before shipping Haiku-only to production.

7. **Rate limiter and credit gate confusion** — return distinct HTTP codes (429 for rate limit, 402 for credit exhaustion) with distinct mobile UI flows. The Redis rate limiter is an abuse threshold (high count, short window); the credit system is a business rule (daily quota). These serve different purposes and must never be conflated.

## Implications for Roadmap

### Phase 1: Database Foundation + Deprecated Model Fix

**Rationale:** Everything else in this milestone is blocked on the schema existing. The `deduct_ai_credits` RPC must be implemented correctly here — changing it later risks production incidents with negative balances. The deprecated Haiku model ID (`claude-3-haiku-20240307`) is a time-bomb that must be defused in the first commit — it breaks on April 19, 2026, which is a fixed calendar date, not a priority. Token cost calibration also belongs here because `CREDIT_COSTS` constants in Phase 2 must be based on real measurements, not estimates.

**Delivers:**
- Migration `026_ai_credits.sql`: `user_ai_credits`, `ai_credit_transactions`, RLS policies using `(SELECT auth.uid())` sub-select form, `deduct_ai_credits` RPC with `FOR UPDATE` lock and `CHECK (balance >= 0)` constraint, one-time insert of 5 welcome credits for all existing `auth.users`
- `user_tier TEXT DEFAULT 'free'` column on `user_profiles`
- Model constant replacement: `claude-haiku-4-5-20251001` replaces every occurrence of `claude-3-haiku-20240307` in the codebase
- Token cost calibration: run `messages.countTokens` with actual system prompt and representative user messages; document measured token counts for `CREDIT_COSTS` sizing

**Addresses features:** Credit balance table (prerequisite for all gating), `user_tier` (premium-ready), existing-user welcome bonus

**Avoids pitfalls:** Race condition (RPC with FOR UPDATE), double-crediting (UNIQUE constraint on transactions table), deprecated model ID (immediate grep-and-replace), RLS per-row performance (sub-select auth.uid() pattern from day one)

**Research flag:** Standard patterns — RLS conventions are identical to the 21 existing migrations. The RPC pattern is documented in PostgreSQL and Supabase official sources. Token calibration requires running actual API calls but no additional research. No `/gsd:research-phase` needed.

---

### Phase 2: Credit Service + Middleware

**Rationale:** `creditService.ts` is pure logic with no HTTP surface — it can be built and unit-tested against the migration without touching any routes. Once the service exists, the middleware factory (`withCredits`) is a thin wrapper. Both files are the dependency root for all subsequent backend phases. `CREDIT_COSTS` constants are sized from the Phase 1 calibration measurements.

**Delivers:**
- `src/lib/creditService.ts`: `getBalance` (with missing-row upsert for new users), `deductCredits` (via Supabase RPC), `earnCredits` (with lazy daily-reset cap check), `CREDIT_COSTS`, `EARN_AMOUNTS`, `DAILY_EARN_CAP` constants
- `src/middleware/credits.ts`: `creditCheck(cost)` and `creditDeduct(cost)` factory returning a Hono middleware pair; deduct only fires on status < 400

**Addresses features:** Per-action credit gate (backend middleware), daily earn cap enforcement, lazy reset (no cron dependency)

**Avoids pitfalls:** Deducting before AI call succeeds (deduct runs after handler returns), blocking activity log on credit earn (fire-and-forget with `.catch()` logging), cron reliability (lazy reset checks `daily_reset_date` at earn time)

**Research flag:** Standard patterns — Hono middleware factory matches existing `rateLimiter.ts`. No `/gsd:research-phase` needed.

---

### Phase 3: Backend Routes + AI Route Integration + Haiku Vision

**Rationale:** With `creditService.ts` and middleware ready, the credits router and AI route modifications can proceed in parallel. The Haiku vision model switch is a low-risk one-constant change delivering immediate cost savings independent of credit gating. The `POST /credits/earn` endpoint must be built here to handle direct-Supabase mobile writes that bypass tool executors. Cost telemetry (`onFinish` → `ai_cost_log`) ships here, enabling weekly Anthropic billing reconciliation.

**Delivers:**
- `src/routes/credits.ts`: `GET /credits/balance`, `GET /credits/history`, `POST /credits/earn`
- `app.ts`: mount `creditsRouter` at `/credits`
- `src/routes/ai.ts` modifications: `...withCredits(cost)` on `/chat`, `/chat/stream`, `/tools/execute`; `POST /ai/scan` endpoint using `claude-haiku-4-5-20251001` with `generateText`; `onFinish` cost telemetry logging to `ai_cost_log`
- Distinct error response shapes: `{ error: 'rate_limited', retry_after: 60 }` (429) vs `{ error: 'insufficient_credits', balance: 0, resets_at: '...' }` (402)

**Addresses features:** Haiku vision migration (70% cost reduction), per-action credit gate live on all AI endpoints, cost telemetry for budget monitoring

**Avoids pitfalls:** Rate limiter / credit double-gate confusion (distinct 429 vs 402 shapes defined explicitly), token counting inaccuracy (telemetry enables weekly Anthropic API reconciliation), deducting on failed AI call (creditDeduct checks status)

**Research flag:** The `POST /ai/scan` Haiku vision endpoint requires a quality verification step before shipping to production. Run the 50-photo blind test with degraded images and define the Sonnet fallback trigger (Zod parse failure on `ScanResult` schema). This is a validation task, not a research question — the approach is clear but the specific schema and threshold need a decision during phase planning.

---

### Phase 4: Activity Earn Hooks

**Rationale:** Tool executor modifications are all additive fire-and-forget calls — the lowest-risk changes in the milestone. They depend only on `creditService.earnCredits` existing (Phase 2). The `POST /credits/earn` endpoint from Phase 3 covers the direct-Supabase mobile path. This phase wires all five activity earn triggers and verifies idempotency end-to-end.

**Delivers:**
- `tools/habits.ts`, `tools/nutrition.ts`, `tools/measurements.ts`, `tools/stretching.ts`, `tools/cardio.ts`: fire-and-forget `creditService.earnCredits(userId, source)` after successful Supabase write in each tool executor
- End-to-end idempotency verification: mobile retry simulation confirms `UNIQUE (user_id, source, idempotency_key)` constraint fires and `ON CONFLICT DO NOTHING` skips the duplicate
- Audit of all 17 plugin screens to identify which ones use direct Supabase writes (vs AI tool calls) and must call `POST /credits/earn` from the mobile side

**Addresses features:** Activity-to-credit earn (6 triggers), idempotent earn ledger, daily earn cap enforcement validated end-to-end

**Avoids pitfalls:** Activity reward double-crediting (UNIQUE constraint + ON CONFLICT DO NOTHING), blocking activity log on credit earn (fire-and-forget with error logging)

**Research flag:** Standard patterns — fire-and-forget is already used in `ai.ts` for `updateConversationTitle`. The plugin screen audit is a discovery task (which screens write directly to Supabase), not a research question. No `/gsd:research-phase` needed.

---

### Phase 5: Mobile UI — Credit Display + Exhaustion UX

**Rationale:** Mobile work is blocked until the backend is deployed and `/credits/balance` is accessible. This phase is entirely UI additions — new `creditStore.ts` plus UI changes in three locations. The credit exhaustion bottom sheet is the highest-priority component because a 402 without specific UI looks like a service outage, not a quota limit.

**Delivers:**
- `apps/mobile/src/stores/creditStore.ts`: Zustand store; `GET /credits/balance` on mount and screen focus; exposes `balance`, `dailyEarned`, `dailyCap`, `resetsAt`
- AI chat screen: balance display in header ("X credits left"), "Using 1 credit..." loading state, 402 → credit exhaustion bottom sheet with earn actions list and "Resets in X hours" countdown
- Nutrition vision scan screen: "Fast scan" label, credit indicator, same 402 bottom sheet
- `plugins/gamification/src/screens/GamificationDashboard.tsx`: dual balance card — coins (coin icon, cosmetic) and AI credits (lightning bolt icon, functional); distinct iconography required
- Per-plugin credit earn toast: "+1 AI credit" in post-save success confirmation for habits, nutrition, cardio, measurements, stretching

**Addresses features:** Visible balance widget, credit exhaustion CTA with recovery path, credit earn toast (immediate positive reinforcement), in-context credit nudge, "Fast scan" framing, strict coin/credit visual separation

**Avoids pitfalls:** Generic error for credit exhaustion (specific 402 UI), no balance visible before acting, coins and AI credits visually undifferentiated

**Research flag:** Standard patterns — Zustand store matches existing `authStore.ts`, `aiStore.ts` patterns. The 402 error handling path should be tested across all AI surfaces (chat, vision, tool execute) on both iOS and Android before shipping. No `/gsd:research-phase` needed.

---

### Phase Ordering Rationale

- **Schema first and atomic RPC required before any gating code:** The `deduct_ai_credits` RPC with `FOR UPDATE` is the correctness guarantee for the entire system. It cannot be retrofitted safely after application-layer credit checks are in production.
- **Service before routes:** `creditService.ts` has no HTTP dependency and establishes a single source of truth for credit math before any route or tool executor references it.
- **Backend before mobile:** `creditStore.ts` depends on `/credits/balance` being deployed. Mobile phases cannot start until the backend is shipped (or behind a feature flag).
- **Earn hooks late:** Tool executor modifications are the lowest-risk, most additive changes. Deferring them reduces scope creep risk if early phases surface unexpected complexity.
- **Deprecated model fix is Phase 1 regardless of priority:** The April 19, 2026 deprecation date makes this a time-sensitive correctness fix, not an optimization.

### Research Flags

Phases needing deeper validation or decisions during execution:
- **Phase 1 (token cost calibration):** `CREDIT_COSTS` constants must be sized from `messages.countTokens` API measurements using the actual system prompt, not from SDK `usage` estimates. Run this calibration before Phase 2 freezes the constants. The AI SDK v6 `usage` object has documented inaccuracies for cache write costs.
- **Phase 3 (Haiku vision quality):** Define the `ScanResult` Zod schema and Sonnet fallback trigger before the vision endpoint ships to production. The approach is clear; the threshold is an open decision. Run the 50-photo blind test with degraded images as a go/no-go gate for Haiku-only mode.
- **Phase 4 (plugin screen audit):** Identify which of the 17 plugin screens write directly to Supabase (bypassing tool executors) before implementing earn hooks. These screens must call `POST /credits/earn` from the mobile side after a successful local write.

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1 (migration):** RLS and schema patterns identical to the 21 existing Supabase migrations. `SECURITY DEFINER` RPC pattern documented in official PostgreSQL and Supabase sources.
- **Phase 2 (service + middleware):** Hono middleware factory matches `rateLimiter.ts` exactly. `creditService.ts` is pure TypeScript logic with no novel integration.
- **Phase 4 (tool hooks):** Fire-and-forget pattern already used in `ai.ts` for `updateConversationTitle`.
- **Phase 5 (mobile UI):** Zustand store matches `authStore.ts`, `workoutStore.ts`, `aiStore.ts`. Bottom sheet pattern matches existing `showAlert` from plugin-sdk.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new packages. All capability verified against existing `package.json`. Haiku model ID and pricing confirmed via Anthropic API docs and Helicone. AI SDK v6 `usage` shape confirmed via official ai-sdk.dev reference. |
| Features | HIGH | Cross-verified against Duolingo, Habitica, Workout Quest live systems, game design literature, and RevenueCat freemium research. Anti-features backed by documented failures (OpenRouter quota UX, Duolingo Hearts 2024 controversy). |
| Architecture | HIGH | All integration points verified from actual source files in this repo (`app.ts`, `routes/ai.ts`, `tools/registry.ts`, `middleware/rateLimiter.ts`, `supabase/migrations/007_gamification_schema.sql`). Direct-Supabase mobile write path gap identified and addressed via `POST /credits/earn`. |
| Pitfalls | HIGH | Critical pitfalls sourced from official docs (Supabase RLS performance, Vercel Cron, Vercel Fluid Compute) and authoritative post-mortems (Stigg engineering blog, Vercel AI SDK GitHub issue #9921, EnterpriseDB PostgreSQL anti-patterns). Deprecated model ID retirement date confirmed from Anthropic official docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Token cost calibration:** `CREDIT_COSTS` constants should be validated against actual `messages.countTokens` API calls with the real system prompt before Phase 2 hard-codes them. The AI SDK v6 `usage` object has documented inaccuracies for prompt cache write costs (GitHub issue #9921). Action: run calibration in Phase 1 before freezing constants.
- **Haiku fallback trigger threshold:** Research recommends a Sonnet fallback when Haiku output fails structured-output validation, but the exact `ScanResult` Zod schema and confidence threshold are not yet defined. Action: define the schema and fallback condition during Phase 3 planning before the vision endpoint ships.
- **Direct-Supabase mobile write path completeness:** Plugin screens write to Supabase directly without going through tool executors, bypassing earn hooks. `POST /credits/earn` covers this, but each of the 17 plugin log screens must be audited to identify which ones use direct writes. Action: complete this audit at the start of Phase 4.
- **Welcome bonus for existing users:** Adding `user_ai_credits` with `DEFAULT 5` handles new users, but existing `auth.users` have no row yet. Action: include a one-time bulk insert in `026_ai_credits.sql` to create a row with `ai_credits = 5` for all existing users, sourced via a subquery on `auth.users`.

## Sources

### Primary (HIGH confidence)
- [Anthropic API Docs: Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — `claude-haiku-4-5-20251001` model ID, deprecation date for `claude-3-haiku-20240307` (April 19, 2026)
- [Anthropic API Docs: Vision](https://platform.claude.com/docs/en/build-with-claude/vision) — image input formats, multimodal support
- [AI SDK Docs: generateText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) — `result.usage` shape, `onFinish` callback
- [AI SDK Docs: Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) — model switching pattern, multimodal support
- [Upstash Redis JS SDK](https://github.com/upstash/redis-js) — `pipeline()`, `exec()`, `incr()`, `expire()` API
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — per-row subquery cost, `(SELECT auth.uid())` caching showing up to 99.99% improvement
- [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs) — at-least-once delivery, no timely guarantee, idempotency requirement
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) — concurrent requests on same instance, module-level state sharing risk introduced early 2025
- [EnterpriseDB: PostgreSQL Anti-Patterns Read-Modify-Write Cycles](https://www.enterprisedb.com/blog/postgresql-anti-patterns-read-modify-write-cycles) — `FOR UPDATE` pattern, relative vs. absolute update
- [Vercel AI SDK GitHub issue #9921](https://github.com/vercel/ai/issues/9921) — token usage normalization inaccuracies; cache write costs missing from `usage` totals
- Source files verified directly: `backend/api/src/app.ts`, `middleware/rateLimiter.ts`, `middleware/auth.ts`, `routes/ai.ts`, `tools/registry.ts`, `tools/db.ts`, `supabase/migrations/007_gamification_schema.sql`, `.planning/PROJECT.md`

### Secondary (MEDIUM confidence)
- [Helicone Pricing: claude-haiku-4-5-20251001](https://www.helicone.ai/llm-cost/provider/anthropic/model/claude-haiku-4-5-20251001) — $1.00/$5.00 per 1M tokens confirmed (pricing subject to change)
- [Trophy.so: Why Duolingo's Energy System Works](https://trophy.so/blog/why-duolingos-energy-system-works-and-when-to-copy-it) — earn-by-doing mechanics analysis
- [RevenueCat: AI Subscription App Pricing](https://www.revenuecat.com/blog/growth/ai-subscription-app-pricing/) — "selective free access creates conviction to upgrade"
- Stigg engineering blog: "We've built AI Credits. And it was harder than we expected." — idempotency as hardest problem in usage pipelines (at-least-once delivery)
- [Flexprice: Credit-Based Billing for AI Applications](https://flexprice.io/blog/how-to-implement-credit-based-billing-for-ai-applications) — double-charging, optimistic locking, idempotency keys
- [OpenRouter Daily Quota UX Failure Analysis](https://www.oreateai.com/blog/indepth-analysis-of-openrouters-free-policy-adjustments-daily-quota-changes-and-response-strategies/) — UTC midnight reset failure mode documentation

### Tertiary (LOW confidence — validate during execution)
- Cost projections (€0.40–$0.75/user/month at free tier) — based on published Anthropic pricing and estimated token counts; actual costs will vary ±30% with real prompts. Validate against Anthropic usage API weekly after launch.

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
