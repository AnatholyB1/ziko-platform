# Ziko Platform

## What This Is

The Ziko fitness platform — a fully-extensible React Native / Expo mobile app with 18 plugins, AI coaching, GPS cardio tracking, and a Supabase backend. The `.planning` folder also tracks the Next.js marketing website (`ziko-app.com`) that launched as milestone v1.0.

## Core Value

A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and now shows them exactly what's in their food.

## Current Milestone: v1.4 Système de Crédits IA & Monétisation

**Goal:** Implémenter un système de crédits IA gamifié qui contrôle les coûts API (€0.75/mois max par utilisateur) tout en récompensant l'engagement utilisateur.

**Target features:**
- Double solde — coins shop (existant, gain illimité) + crédits IA (nouveau, gain plafonné par activité)
- Quotas IA — base gratuite + bonus gagnables par activité (scan photo 1+2/jour, chat 1+2/jour, programme 1+1/mois)
- Gain de crédits IA par activités : log workout, habitudes, repas, mesures, stretching, course/cardio
- Vision Haiku — scan photo migré vers claude-haiku (€0.003/scan au lieu de €0.01)
- Architecture prête pour tier premium futur

---

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-05 — v1.4 Phase 17 complete: DB foundation + model config centralization*
