# Roadmap: Ziko Platform

## Milestones

- ✅ **v1.0 Landing Page** — Phases 1–5 (shipped 2026-03-28)
- ✅ **v1.1 Smart Pantry Plugin** — Phases 6–9 (shipped 2026-04-02)
- ✅ **v1.2 Barcode Enrichment + Tech Debt** — Phases 10–11 (shipped 2026-04-02)
- ✅ **v1.3 Security + Cloud Infrastructure** — Phases 12–16 (shipped 2026-04-05)
- 🚧 **v1.4 Systeme de Credits IA & Monetisation** — Phases 17–21 (in progress)

## Phases

<details>
<summary>✅ v1.0 Landing Page (Phases 1–5) — SHIPPED 2026-03-28</summary>

Five phases took the Ziko web marketing site from an empty repo to a publicly-launched product. Phase 1 installed the technical foundation — i18n routing, design tokens, and the static rendering architecture. Phase 2 shipped all RGPD and French legal requirements. Phase 3 built the three marketing sections. Phase 4 hardened SEO metadata. Phase 5 threw the switch: custom domain live, site public.

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-26
- [x] Phase 2: RGPD Compliance (3/3 plans) — completed 2026-03-26
- [x] Phase 3: Marketing Content (3/3 plans) — completed 2026-03-27
- [x] Phase 4: SEO + Performance (3/3 plans) — completed 2026-03-27
- [x] Phase 5: Launch (2/2 plans) — completed 2026-03-28

</details>

<details>
<summary>✅ v1.1 Smart Pantry Plugin (Phases 6–9) — SHIPPED 2026-04-02</summary>

Four phases added the Smart Pantry Plugin to the Ziko mobile app — a kitchen brain with inventory tracking, barcode scan for item lookup, AI macro-aware recipe suggestions, automatic calorie logging to the nutrition plugin, and a rule-based shopping list.

- [x] Phase 6: Smart Inventory (4/4 plans) — completed 2026-03-29
- [x] Phase 7: AI Recipe Suggestions (4/4 plans) — completed 2026-03-29
- [x] Phase 8: Calorie Tracker Sync (3/3 plans) — completed 2026-03-30
- [x] Phase 9: Smart Shopping List (3/3 plans) — completed 2026-04-01

</details>

<details>
<summary>✅ v1.2 Barcode Enrichment + Tech Debt (Phases 10–11) — SHIPPED 2026-04-02</summary>

Two phases enriched the nutrition plugin with Open Food Facts barcode scanning — users can scan any food product and see its Nutri-Score, Eco-Score, macros, and photo before logging. All v1.1 tech debt closed: SHOP-03 quantity prompt, AI tool registry migration, Nyquist VALIDATION.md audit.

- [x] Phase 10: Data Foundation + Tech Debt (3/3 plans) — completed 2026-04-02
- [x] Phase 11: Barcode UI + Score Display (3/3 plans) — completed 2026-04-02

</details>

<details>
<summary>✅ v1.3 Security + Cloud Infrastructure (Phases 12–16) — SHIPPED 2026-04-05</summary>

Five phases secured the Hono backend and added cloud storage infrastructure. Phase 12 provisioned Upstash Redis and added distributed rate limiting (IP + per-user). Phase 13 hardened the API with strict CORS, security headers, and Zod input validation. Phase 14 added Supabase Storage buckets with signed URL uploads. Phase 15 added lifecycle cron cleanup. Phase 16 fixed a middleware regression introduced by Phase 15. Full details in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

- [x] Phase 12: Infra + Rate Limiting (2/2 plans) — completed 2026-04-02
- [x] Phase 13: API Security Hardening (1/1 plans) — completed 2026-04-03
- [x] Phase 14: Supabase Storage (3/3 plans) — completed 2026-04-03
- [x] Phase 15: Lifecycle & Cleanup (1/1 plans) — completed 2026-04-05
- [x] Phase 16: Security Middleware Regression Fix (1/1 plans) — completed 2026-04-05

</details>

---

### 🚧 v1.4 Systeme de Credits IA & Monetisation (In Progress)

**Milestone Goal:** Implement a gamified AI credit system that controls API costs (max EUR 0.75/month per user) while rewarding user engagement with activity-based credit earning, a visible dual balance, and a Haiku vision model migration for 70% per-scan cost reduction.

- [ ] **Phase 17: DB Foundation + Model Fix** — Migration 026 (credit tables + atomic RPC) and deprecated Haiku model ID replacement
- [ ] **Phase 18: Credit Service + Middleware** — `creditService.ts` pure logic + Hono middleware pair (creditCheck / creditDeduct)
- [ ] **Phase 19: Backend Routes + AI Integration** — Credits router, AI route credit gating, Haiku vision endpoint, cost telemetry
- [ ] **Phase 20: Activity Earn Hooks** — Fire-and-forget earn triggers on 6 tool executors with idempotency end-to-end
- [ ] **Phase 21: Mobile UI — Credit Display + Exhaustion UX** — creditStore, dual balance card, exhaustion bottom sheet, earn toasts

## Phase Details

### Phase 17: DB Foundation + Model Fix
**Goal**: The credit system's atomic PostgreSQL foundation exists and the deprecated Haiku model ID is eliminated before its April 19 retirement date
**Depends on**: Phase 16 (v1.3 shipped)
**Requirements**: CRED-06, CRED-07, PREM-01, COST-01
**Success Criteria** (what must be TRUE):
  1. A `user_ai_credits` row exists for every user and a `ai_credit_transactions` ledger table exists — both with correct RLS using the `(SELECT auth.uid())` sub-select caching pattern
  2. Calling `deduct_ai_credits(user_id, cost)` with a balance of 0 returns an error and does NOT produce a negative balance — the `CHECK (balance >= 0)` constraint holds under concurrent calls
  3. Every occurrence of `claude-3-haiku-20240307` in the codebase is replaced with `claude-haiku-4-5-20251001` — zero grep results for the old ID
  4. `user_profiles` has a `tier TEXT DEFAULT 'free'` column — existing rows read as `'free'` with no migration data loss
  5. Existing users each have a welcome credit row (5 credits) inserted by the migration's one-time bulk insert
**Plans:** 2 plans
Plans:
- [ ] 17-01-PLAN.md — Grep audit + centralized model constants file (AGENT_MODEL + VISION_MODEL)
- [ ] 17-02-PLAN.md — Migration 026: credit tables, atomic deduct RPC, tier column, welcome credits

### Phase 18: Credit Service + Middleware
**Goal**: A single `creditService.ts` is the authoritative source for all credit math, and a Hono middleware pair can gate any AI route without modifying handler code
**Depends on**: Phase 17
**Requirements**: CRED-02, CRED-03, EARN-07, EARN-10, PREM-02
**Success Criteria** (what must be TRUE):
  1. `creditService.getBalance()` returns the current balance and creates a default row for brand-new users without a prior credit record
  2. `creditService.earnCredits()` enforces the daily cap — after earning up to the cap, subsequent earn calls return without incrementing the balance (lazy date-keyed reset, no cron)
  3. `creditService.earnCredits()` is idempotent — calling it twice with the same source record UUID inserts exactly one transaction row (ON CONFLICT DO NOTHING on the unique constraint)
  4. The `creditCheck(cost)` middleware returns 402 with `{ error: 'insufficient_credits' }` before the handler runs when balance is 0
  5. The `creditDeduct(cost)` middleware only fires when the handler returns status < 400 — a handler error does not consume a credit
  6. Premium users (`tier = 'premium'`) pass through `creditCheck` without deduction
**Plans**: TBD

### Phase 19: Backend Routes + AI Integration
**Goal**: The credits API is mounted and all AI endpoints (chat, stream, tools, vision scan) enforce credit gating and log token usage for cost monitoring
**Depends on**: Phase 18
**Requirements**: COST-02, COST-03
**Success Criteria** (what must be TRUE):
  1. `GET /credits/balance` returns the authenticated user's current balance, daily earned amount, daily cap, and reset timestamp
  2. Calling `POST /ai/chat` or `POST /ai/chat/stream` with 0 credits returns HTTP 402 — distinct from 429 (rate limit) in both status code and response body shape
  3. Every AI API call logs `input_tokens`, `output_tokens`, `model`, and `user_id` to a `ai_cost_log` table via the `onFinish` callback — enabling weekly Anthropic billing reconciliation
  4. `POST /ai/scan` uses `claude-haiku-4-5-20251001` for vision and falls back to Sonnet when structured-output validation fails — confirmed by running a degraded-photo test set
  5. Monthly simulated cost for a free-tier user at maximum daily usage stays within the EUR 0.75 ceiling based on measured token counts
**Plans**: TBD
**UI hint**: yes

### Phase 20: Activity Earn Hooks
**Goal**: Completing any of the six tracked fitness activities automatically awards AI credits with no risk of double-crediting on mobile retry
**Depends on**: Phase 18
**Requirements**: EARN-01, EARN-02, EARN-03, EARN-04, EARN-05, EARN-06
**Success Criteria** (what must be TRUE):
  1. Logging a workout, completing daily habits, logging a meal, logging body measurements, completing a stretching session, or completing a cardio session each triggers a credit earn in the backend tool executor
  2. Simulating a mobile retry (calling the same tool twice with the same record UUID) results in exactly one credit transaction row — the second call hits ON CONFLICT and is silently skipped
  3. A credit earn call that fails (network error, cap already reached) does not prevent the underlying activity log from saving — fire-and-forget with error logging only
  4. All 17 plugin screens that write directly to Supabase (bypassing tool executors) are identified, and those that correspond to earn-eligible activities call `POST /credits/earn` from the mobile side after a successful write
**Plans**: TBD

### Phase 21: Mobile UI — Credit Display + Exhaustion UX
**Goal**: Users can see their credit balance at all times, understand the cost of each AI action before taking it, and know how to earn more credits when their balance is exhausted
**Depends on**: Phase 19, Phase 20
**Requirements**: CRED-01, CRED-04, CRED-05, EARN-08, EARN-09
**Success Criteria** (what must be TRUE):
  1. A credit balance indicator (e.g., "3 credits left") is visible in the AI chat screen header and on the gamification dashboard's dual balance card — without navigating to a separate screen
  2. Each AI action button displays its credit cost before the user taps it (e.g., "Ask AI — 1 credit")
  3. When a user hits 0 credits, a bottom sheet appears explaining why and listing specific activities they can do to earn more — it does not show a generic error
  4. After logging a habit, meal, measurement, stretch, or cardio session, a "+1 AI credit" toast appears in the post-save confirmation — immediately after the save succeeds
  5. The gamification dashboard shows coins and AI credits as visually distinct balances with distinct iconography — coins and credits are never confused
  6. The daily earn progress is visible (e.g., "2 bonus credits earned today — log a stretch to earn more")
**Plans**: TBD
**UI hint**: yes

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-26 |
| 2. RGPD Compliance | v1.0 | 3/3 | Complete | 2026-03-26 |
| 3. Marketing Content | v1.0 | 3/3 | Complete | 2026-03-27 |
| 4. SEO + Performance | v1.0 | 3/3 | Complete | 2026-03-27 |
| 5. Launch | v1.0 | 2/2 | Complete | 2026-03-28 |
| 6. Smart Inventory | v1.1 | 4/4 | Complete | 2026-03-29 |
| 7. AI Recipe Suggestions | v1.1 | 4/4 | Complete | 2026-03-29 |
| 8. Calorie Tracker Sync | v1.1 | 3/3 | Complete | 2026-03-30 |
| 9. Smart Shopping List | v1.1 | 3/3 | Complete | 2026-04-01 |
| 10. Data Foundation + Tech Debt | v1.2 | 3/3 | Complete | 2026-04-02 |
| 11. Barcode UI + Score Display | v1.2 | 3/3 | Complete | 2026-04-02 |
| 12. Infra + Rate Limiting | v1.3 | 2/2 | Complete | 2026-04-02 |
| 13. API Security Hardening | v1.3 | 1/1 | Complete | 2026-04-03 |
| 14. Supabase Storage | v1.3 | 3/3 | Complete | 2026-04-03 |
| 15. Lifecycle & Cleanup | v1.3 | 1/1 | Complete | 2026-04-05 |
| 16. Security Middleware Regression Fix | v1.3 | 1/1 | Complete | 2026-04-05 |
| 17. DB Foundation + Model Fix | v1.4 | 0/2 | Planning | - |
| 18. Credit Service + Middleware | v1.4 | 0/TBD | Not started | - |
| 19. Backend Routes + AI Integration | v1.4 | 0/TBD | Not started | - |
| 20. Activity Earn Hooks | v1.4 | 0/TBD | Not started | - |
| 21. Mobile UI — Credit Display + Exhaustion UX | v1.4 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-26 — Milestone v1.0 Landing Page*
*Updated: 2026-04-05 — v1.4 roadmap added: Systeme de Credits IA & Monetisation (Phases 17–21)*
