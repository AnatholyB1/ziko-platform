# Ziko Platform

## What This Is

The Ziko fitness platform — a fully-extensible React Native / Expo mobile app with 17 plugins, AI coaching, GPS cardio tracking, and a Supabase backend. The `.planning` folder also tracks the Next.js marketing website (`ziko-app.com`) that launched as milestone v1.0.

## Core Value

A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and now shows them exactly what's in their food.

## Current Milestone: v1.3 Security + Cloud Infrastructure

**Goal:** Sécuriser le backend contre les abus et gérer les assets media via Supabase Storage avec lifecycle policies.

**Target features:**
- Rate limiting sur les endpoints Hono (AI chat, barcode scan, auth) — per-user + per-IP, headers standards
- Supabase Storage — buckets pour profil photos, photos de scan repas, et exports/PDF
- Lifecycle policies — nettoyage auto des assets anciens via Supabase Storage policies
- Sécurisation API — CORS strict, validation inputs, protection contre les abus
- Monitoring de base — alertes sur limites dépassées

---

## Previous: v1.2 Barcode Enrichment + Tech Debt — SHIPPED 2026-04-02

**What shipped:**
- Barcode scan tab in nutrition log screen — Open Food Facts product card with photo, name, brand, macros per 100g, Nutri-Score + Eco-Score badges, serving size adjuster
- `food_products` shared catalogue table (migration 024) + `offApi.ts` caching utility
- Nutri-Score + Eco-Score badges on journal entries (barcode-logged meals only)
- Daily average Nutri-Score widget on nutrition dashboard (hidden when no scanned meals)
- SHOP-03 fix: quantity prompt Modal before any shopping list check-off (recipe or low-stock)
- `pantry_log_recipe_cooked` registered as proper AI tool; RecipeConfirm.tsx migrated to `/ai/tools/execute`
- Nyquist VALIDATION.md written for phases 07 and 09

## Requirements

### Validated

- [x] FR/EN i18n routing with `next-intl` — FR clean URLs, EN `/en/` prefix (Validated in Phase 1: foundation)
- [x] Ziko design tokens applied globally via Tailwind v4 `@theme` — matches brand identity (Validated in Phase 1: foundation)
- [x] All pages statically generated — `generateStaticParams` + `setRequestLocale` pattern (Validated in Phase 1: foundation)
- [x] Fonts self-hosted via `next/font` — CNIL-compliant, no Google CDN (Validated in Phase 1: foundation)
- [x] Supabase admin client uses `SUPABASE_SERVICE_ROLE_KEY` with `server-only` guard (Validated in Phase 1: foundation)
- [x] Footer visible on every page with links to all 3 legal pages (Validated in Phase 1: foundation)
- [x] Self-service account deletion — IP rate-limited server action, anti-enumeration, high-friction UX (Validated in Phase 2: rgpd-compliance)
- [x] Mentions légales — LCEN-compliant, BRICON Anatholy as publication director, Vercel hosting (Validated in Phase 2: rgpd-compliance)
- [x] Politique de confidentialité — Anthropic named as AI data processor, health/GPS/AI data documented (Validated in Phase 2: rgpd-compliance)
- [x] CGU — AI health liability disclaimer, French law applicable (Validated in Phase 2: rgpd-compliance)

### Validated (continued)

- [x] Hero section with real app screenshot and download CTAs — App Store / Play Store stubs visible (Validated in Phase 3: hero-features)
- [x] Features showcase presenting all 17 plugins with icons and descriptions (Validated in Phase 3: hero-features)
- [x] Pricing section — free tier with "Download free" CTA (Validated in Phase 3: hero-features)
- [x] OG metadata with metadataBase + generateMetadata on all pages (Validated in Phase 4: seo-perf)
- [x] Deployed on Vercel at https://ziko-app.com — custom domain, HTTPS, all routes static (Validated in Phase 5: launch)
- [x] Plausible cookieless analytics active — no cookie banner required (Validated in Phase 5: launch)
- [x] Google Search Console sitemap submitted — site discoverable by Google (Validated in Phase 5: launch)

### Validated (v1.1 — Smart Pantry Plugin)

- ✓ Smart inventory — pantry items with qty, unit, expiration, category — v1.1
- ✓ AI recipe suggestions — from pantry contents + remaining daily macros — v1.1
- ✓ Calorie tracker sync — confirm cooked → auto-log macros to nutrition plugin — v1.1
- ✓ Smart shopping list — rule-based from low-stock items + recipe ingredients — v1.1

### Validated (v1.2 — Barcode Enrichment + Tech Debt)

- ✓ `food_products` shared-catalogue table + `offApi.ts` cache utility — v1.2
- ✓ Barcode scan tab in nutrition plugin — product card with Nutri-Score, Eco-Score, macros, photo — v1.2
- ✓ Nutri-Score + Eco-Score badges on journal entries; daily average widget on dashboard — v1.2
- ✓ SHOP-03 fix: quantity prompt Modal before shopping list check-off — v1.2
- ✓ `pantry_log_recipe_cooked` AI tool registered; RecipeConfirm.tsx migrated — v1.2
- ✓ Nyquist VALIDATION.md written for phases 07 and 09 — v1.2

### Active (v1.3 — Security + Cloud Infrastructure)

- [ ] Rate limiting per-user + per-IP sur les endpoints Hono sensibles (AI chat, barcode scan, auth)
- [ ] Supabase Storage buckets pour profil photos, scan photos, exports/PDF
- [ ] Lifecycle policies Supabase Storage (nettoyage assets anciens)
- [ ] Sécurisation API — CORS strict, validation inputs, protection abus
- [ ] Monitoring de base — alertes sur limites dépassées

### Deferred

**Coach Platform (future web milestone)**
- [ ] Authenticated `/coach` section (ERP/CRM for coaches)
- [ ] Coach dashboard, client management, session tracking

### Out of Scope

- Native mobile integration into the landing page — marketing site only
- Backend changes to the existing Hono API — account deletion calls Supabase directly
- Dark mode — matches Ziko light sport theme only
- Blog / content management system — static content for v1
- Coach ERP/CRM — deferred to Milestone 2

## Context

- **Shipped milestones**: v1.0 (landing page at ziko-app.com), v1.1 (Smart Pantry Plugin — 18th plugin), v1.2 (Barcode Enrichment — Nutri-Score/Eco-Score in nutrition plugin)
- **Mobile app state**: 18 plugins (17 original + pantry), 24 Supabase migrations, React Native / Expo SDK 54, NativeWind v4, Zustand v5, TanStack Query v5
- **Backend state**: Hono v4 at `https://ziko-api-lilac.vercel.app`, AI orchestrator with 6 pantry tools + nutrition tools, `food_products` shared catalogue table
- **Design system**: Light sport theme — primary `#FF5C1A` (orange), background `#F7F6F3`, text `#1C1A17`, border `#E2E0DA`. No dark mode.
- **Legal jurisdiction**: French law — RGPD, mentions légales mandatory, CGU required.
- **Existing infrastructure**: API + web marketing site on Vercel, Supabase for DB + Auth.

## Constraints

- **Tech Stack**: Next.js 14+ (App Router), Vercel deployment — non-negotiable, chosen for coach dashboard extensibility
- **i18n**: French + English from day one — routing via `next-intl` or similar
- **Legal**: All RGPD/French legal pages mandatory before launch — not optional
- **Security**: Account deletion must use server-side Supabase admin client — service role key never in client bundle
- **Design**: Must match Ziko brand (orange #FF5C1A, light sport aesthetic) — no separate design system

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| New repo (not monorepo) | Cleaner separation, independent deploy, different audience from mobile | — Pending |
| Same Next.js app for coach CRM | Avoid managing two deploys; /coach grows naturally from the marketing site | — Pending |
| Self-service deletion (not email) | RGPD requires accessible deletion; form is better UX than asking users to email | — Pending |
| `next-intl` for i18n | Industry standard for Next.js App Router i18n | — Pending |
| Vercel deployment | Already using Vercel for API; same team, same billing, easy CI | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-02 — milestone v1.3 started*
