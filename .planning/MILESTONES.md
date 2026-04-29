# Milestones

## v1.4 Système de Crédits IA & Monétisation (Shipped: 2026-04-29)

**Phases completed:** 5 phases, 11 plans (Phases 17–21)

**Key accomplishments:**

1. **Atomic PostgreSQL Credit System** — `user_ai_credits` + `ai_credit_transactions` dual-table architecture; `deduct_ai_credits` SECURITY DEFINER RPC with SELECT FOR UPDATE row lock prevents negative balances under concurrent Vercel Fluid Compute; partial unique index eliminates double-crediting on mobile retry
2. **Credit Service + Middleware** — `creditService.ts` as single authoritative credit logic (getBalance, earnCredits, deductCredits, getQuotaStatus); `creditCheck`/`creditDeduct` Hono middleware pair gates all AI routes; premium tier bypass via `user_profiles.tier`
3. **AI Cost Telemetry + Credit-Gated Routes** — `GET /credits/balance`, `POST /credits/earn`; AI chat/stream/scan credit-gated; `ai_cost_log` per-call token logging for billing reconciliation; monthly cost ceiling ≤ €0.75 verified for freemium
4. **Haiku Vision Migration** — food scan migrated to `claude-haiku-4-5-20251001` (~70% cost reduction vs Sonnet); Sonnet fallback on Zod parse failure; centralized `models.ts` eliminates model ID drift across backend
5. **Fire-and-Forget Activity Earn Hooks** — `POST /credits/earn` with VALID_SOURCES allowlist; idempotent earn hooks in 5 backend tool executors + 6 mobile screens via record-UUID idempotency keys
6. **Gamified Credit UI** — `CreditEarnToast` (MotiView floating pill); `CreditExhaustionSheet` (6-activity checklist + reset countdown); balance chip in AI header; dual-balance card (coins + credits IA) in gamification; cost labels on AI action buttons; `/ai/programs/generate` route with proper monthly quota gate

---

## v1.3 Security + Cloud Infrastructure (Shipped: 2026-04-05)

**Phases completed:** 5 phases, 8 plans (Phases 12-16)

**Key accomplishments:**

1. **Distributed Rate Limiting** — Upstash Redis HTTP client (serverless-safe) with sliding window algorithm; global IP flood protection (200 req/60s) + per-user quotas on AI chat (20/60min), tools (30/60min), barcode scan (20/60min); 429 responses with Retry-After header
2. **API Security Hardening** — CORS locked to explicit origins (no `*.vercel.app` wildcard), `secureHeaders()` on every response, Zod `.strict()` input validation via `@hono/zod-validator` on all AI POST routes, ZodError 400 handler
3. **Supabase Storage** — Three private buckets (profile-photos, scan-photos, exports) with path-prefix RLS; signed URL upload flow bypassing Vercel's 4.5 MB limit; AI vision endpoint accepts `storage_path` for signed URLs to Claude
4. **Lifecycle Cleanup** — Vercel cron (daily 4am UTC) purges scan-photos >90d and exports >7d via Supabase Storage JS client; CRON_SECRET auth; fault-tolerant with Promise.allSettled
5. **Regression Fix** — Phase 15 commit accidentally reverted Phase 12+13 middleware; detected by milestone audit; Phase 16 restored all four items in a targeted edit

---

## v1.2 Barcode Enrichment + Tech Debt (Shipped: 2026-04-02)

**Phases completed:** 2 phases, 6 plans (Phases 10–11)

**Key accomplishments:**

1. **Data Foundation** — `food_products` shared-catalogue table (migration 024), `offApi.ts` caching utility (world.openfoodfacts.org, 7-day TTL), `nutrition_logs` extended with `food_product_id` FK + `nutriscore_grade` + `ecoscore_grade`
2. **Barcode Scan UI** — 4th tab in LogMealScreen with inline CameraView, product card (photo, name, brand, macros per 100g, Nutri-Score + Eco-Score badges), serving size adjuster, "product not found" fallback to manual entry
3. **Score Display** — Nutri-Score + Eco-Score pill badges on journal entry rows (barcode-logged meals only); daily average Nutri-Score widget on dashboard (hidden when no scanned meals)
4. **Tech Debt Closed** — SHOP-03 quantity prompt Modal; `pantry_log_recipe_cooked` AI tool registered; Nyquist VALIDATION.md for phases 07 + 09

---

## v1.1 Smart Pantry Plugin (Shipped: 2026-04-02)

**Phases completed:** 4 phases, 14 plans (Phases 6–9)

**Key accomplishments:**

1. **Smart Inventory** — full pantry CRUD with barcode scanner (Open Food Facts auto-fill), low-stock thresholds, storage location grouping (fridge / freezer / pantry), and expiry color indicators; `pantry_get_items` + `pantry_update_item` AI tools registered in backend
2. **AI Recipe Suggestions** — macro-aware recipe generation from pantry contents + remaining daily calorie budget via `generateObject`, serving size adjuster with client-side macro scaling, full recipe detail view
3. **Calorie Tracker Sync** — one-tap "I cooked this" → confirms macros to Nutrition plugin + decrements pantry quantities; nutrition-plugin gate via `.maybeSingle()`, `router.replace` to nutrition dashboard
4. **Smart Shopping List** — auto-populated from low-stock pantry items, recipe ingredient adder from RecipeDetail, optimistic check-off with pantry restore, native share sheet export

**Known tech debt (deferred to v1.2):**

- SHOP-03 recipe check-off does not insert into pantry for non-existing ingredients
- SHOP-03 pantry restore uses threshold+1 (not user-specified quantity)
- Stale/missing Nyquist VALIDATION.md files for phases 06–09

---
