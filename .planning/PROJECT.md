# Ziko Platform

## What This Is

The Ziko fitness platform — a fully-extensible React Native / Expo mobile app with 18 plugins, AI coaching, GPS cardio tracking, and a Supabase backend. The `.planning` folder also tracks the Next.js marketing website (`ziko-app.com`) that launched as milestone v1.0.

## Core Value

A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and controls AI costs through gamified engagement.

---

<details>
<summary>✅ v1.4 Système de Crédits IA & Monétisation — SHIPPED 2026-04-29</summary>

**What shipped:**
- Atomic PostgreSQL credit system — dual-table balance+ledger (`user_ai_credits` + `ai_credit_transactions`) with SECURITY DEFINER `deduct_ai_credits` RPC and SELECT FOR UPDATE row lock
- `creditService.ts` + `creditCheck`/`creditDeduct` Hono middleware pair gating all AI routes; premium tier bypass
- `GET /credits/balance`, `POST /credits/earn` endpoints; AI chat/stream/scan credit-gated; `ai_cost_log` per-call token logging; monthly cost ceiling ≤ €0.75 verified
- Haiku vision migration (`claude-haiku-4-5-20251001`, ~70% cost reduction); centralized `models.ts`
- Fire-and-forget earn hooks in 5 backend tool executors + 6 mobile screens; idempotent via record-UUID
- `CreditEarnToast`, `CreditExhaustionSheet`, balance chip, dual-balance card, cost labels, `/ai/programs/generate` monthly quota route

</details>

<details>
<summary>Previous: v1.2 Barcode Enrichment + Tech Debt — SHIPPED 2026-04-02</summary>

**What shipped:**
- Barcode scan tab in nutrition log screen — Open Food Facts product card with photo, name, brand, macros per 100g, Nutri-Score + Eco-Score badges, serving size adjuster
- `food_products` shared catalogue table (migration 024) + `offApi.ts` caching utility
- Nutri-Score + Eco-Score badges on journal entries (barcode-logged meals only)
- Daily average Nutri-Score widget on nutrition dashboard (hidden when no scanned meals)
- SHOP-03 fix: quantity prompt Modal before any shopping list check-off (recipe or low-stock)
- `pantry_log_recipe_cooked` registered as proper AI tool; RecipeConfirm.tsx migrated to `/ai/tools/execute`
- Nyquist VALIDATION.md written for phases 07 and 09

</details>

## Requirements

### Validated (v1.0 — Landing Page)

- [x] FR/EN i18n routing with `next-intl` — FR clean URLs, EN `/en/` prefix
- [x] Ziko design tokens applied globally via Tailwind v4 `@theme`
- [x] All pages statically generated — `generateStaticParams` + `setRequestLocale`
- [x] Fonts self-hosted via `next/font` — CNIL-compliant
- [x] Supabase admin client uses `SUPABASE_SERVICE_ROLE_KEY` with `server-only` guard
- [x] Footer visible on every page with legal links
- [x] Self-service account deletion — IP rate-limited, anti-enumeration
- [x] Mentions legales, Politique de confidentialite, CGU — all RGPD/LCEN compliant
- [x] Hero section + Features showcase + Pricing section
- [x] OG metadata, Plausible analytics, Google Search Console

### Validated (v1.1 — Smart Pantry Plugin)

- [x] Smart inventory — pantry items with qty, unit, expiration, category
- [x] AI recipe suggestions — from pantry contents + remaining daily macros
- [x] Calorie tracker sync — confirm cooked -> auto-log macros to nutrition plugin
- [x] Smart shopping list — rule-based from low-stock items + recipe ingredients

### Validated (v1.2 — Barcode Enrichment + Tech Debt)

- [x] `food_products` shared-catalogue table + `offApi.ts` cache utility
- [x] Barcode scan tab — product card with Nutri-Score, Eco-Score, macros, photo
- [x] Nutri-Score + Eco-Score badges on journal entries; daily average widget
- [x] SHOP-03 fix: quantity prompt Modal; `pantry_log_recipe_cooked` AI tool registered

### Validated (v1.3 — Security + Cloud Infrastructure)

- [x] Rate limiting per-user + per-IP on sensitive Hono endpoints (AI chat, barcode scan, tools)
- [x] API security hardening — strict CORS, Zod input validation, secureHeaders
- [x] Supabase Storage — 3 private buckets, signed URL upload flow, mobile bypass of Vercel body limit
- [x] Lifecycle cron — daily cleanup of scan-photos (90d) and exports (7d)

### Validated (v1.4 — Système de Crédits IA & Monétisation)

- [x] Atomic PostgreSQL credit deduction via SECURITY DEFINER RPC — no negative balance possible (CRED-06)
- [x] Dual balance — shop coins + AI credits as separate balances (CRED-07)
- [x] Daily base allocation (1 chat + 1 scan) without activity; monthly program quota (1/month) (CRED-02, CRED-03)
- [x] Activity earn hooks — workout, habits, meals, measurements, stretching, cardio → +1 credit (EARN-01–06)
- [x] Idempotent earning — mobile retry does not double-credit (partial unique index + ON CONFLICT) (EARN-10)
- [x] Daily earn cap (EARN-07); earn toast after activity save (EARN-08); daily progress visible (EARN-09)
- [x] Balance chip in AI header; cost labels on action buttons; exhaustion bottom sheet (CRED-01, CRED-04, CRED-05)
- [x] Haiku vision migration — `claude-haiku-4-5-20251001`, ~70% cost reduction; centralized `models.ts` (COST-01)
- [x] Per-call token logging to `ai_cost_log`; monthly cost ≤ €0.75 verified (COST-02, COST-03)
- [x] `user_profiles.tier` column (free/premium); middleware bypasses deduction for premium (PREM-01, PREM-02)

### Deferred

**Coach Platform (future web milestone)**
- [ ] Authenticated `/coach` section (ERP/CRM for coaches)
- [ ] Coach dashboard, client management, session tracking

### Out of Scope

- Dark mode — light sport theme only
- Blog / content management system — static content only
- Coach ERP/CRM — deferred to future milestone
- AWS S3 direct — Supabase Storage (backed by S3) suffices
- In-memory rate limiting — useless on Vercel serverless

## Context

- **Shipped milestones**: v1.0 (landing page), v1.1 (Smart Pantry Plugin), v1.2 (Barcode Enrichment), v1.3 (Security + Cloud Infrastructure)
- **Mobile app state**: 18 plugins, 26 Supabase migrations, React Native / Expo SDK 54, NativeWind v4, Zustand v5, TanStack Query v5
- **Backend state**: Hono v4 at `https://ziko-api-lilac.vercel.app`, Upstash Redis rate limiting, secureHeaders, Zod validation, AI orchestrator with pantry + nutrition tools, Supabase Storage (3 buckets + signed URLs), lifecycle cron cleanup, centralized model config (`backend/api/src/config/models.ts`)
- **Design system**: Light sport theme — primary `#FF5C1A` (orange), background `#F7F6F3`, text `#1C1A17`, border `#E2E0DA`. No dark mode.
- **Legal jurisdiction**: French law — RGPD, mentions legales mandatory, CGU required.
- **Infrastructure**: API + web on Vercel, Supabase (DB + Auth + Storage), Upstash Redis

## Constraints

- **Tech Stack**: Next.js 14+ (App Router), Vercel deployment — non-negotiable
- **i18n**: French + English — routing via `next-intl`
- **Legal**: All RGPD/French legal pages mandatory
- **Security**: Account deletion uses server-side Supabase admin client; service role key never in client bundle
- **Design**: Must match Ziko brand (orange #FF5C1A, light sport aesthetic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Upstash Redis (HTTP) over ioredis | Vercel serverless has no persistent connections; HTTP REST works on cold starts | v1.3 |
| Signed URL upload pattern | Vercel hard limit 4.5 MB; mobile uploads directly to Supabase Storage | v1.3 |
| Path-prefix RLS for storage | `storage.objects` has no `user_id` column; `(storage.foldername(name))[1]` pattern | v1.3 |
| Sliding window over fixed window | Prevents boundary spike traffic in rate limiting | v1.3 |
| Separate AI credits table (not gamification coins) | Dual balance — coins are unlimited reward currency, credits are cost-controlled AI currency (CRED-07) | v1.4 Phase 17 |
| Centralized model constants file | Single file to update when model IDs change; prevents drift across 3+ backend files (COST-01) | v1.4 Phase 17 |
| SECURITY DEFINER + SELECT FOR UPDATE in deduct RPC | Application-layer check-then-deduct races under Vercel Fluid Compute produce negative balances; DB-level lock eliminates it | v1.4 Phase 17 ✓ |
| Partial unique index (WHERE idempotency_key IS NOT NULL) | ON CONFLICT DO NOTHING eliminates double-crediting on mobile retry without requiring all rows to have idempotency keys | v1.4 Phase 17 ✓ |
| Lazy daily-reset (date-keyed check at earn time) | No cron dependency — avoids Vercel at-least-once cron delivery causing double-resets | v1.4 Phase 18 ✓ |
| POST /earn always returns HTTP 200 { credited: boolean } | Mobile client must never crash on earn failure; 4xx would require error handling in fire-and-forget context | v1.4 Phase 20 ✓ |
| AIBridge 402 body slice extended 200→500 chars | earned_today array with ≥1 source exceeds 200 chars; truncation caused silent JSON.parse failure and no exhaustion sheet | v1.4 Phase 21 ✓ |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-29 — v1.4 milestone complete: Système de Crédits IA & Monétisation*
