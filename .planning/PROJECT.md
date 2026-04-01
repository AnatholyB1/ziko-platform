# Ziko Platform

## What This Is

The Ziko fitness platform — a fully-extensible React Native / Expo mobile app with 17 plugins, AI coaching, GPS cardio tracking, and a Supabase backend. The `.planning` folder also tracks the Next.js marketing website (`ziko-app.com`) that launched as milestone v1.0.

## Core Value

A fitness user has a single app that coaches them, tracks everything, and now tells them what to cook based on what's in their kitchen.

## Current Milestone: v1.1 Smart Pantry Plugin

**Goal:** Add a `pantry` plugin to the Ziko mobile app that turns the phone into a kitchen brain — inventory tracking, AI recipe suggestions, automatic calorie logging, and a rule-based shopping list.

**Target features:**
- Smart inventory — track pantry items (name, qty, unit, expiration date, category), auto-decrement on cook
- AI recipe suggestions — based on available pantry items + remaining daily macros + user cravings
- Calorie tracker sync — confirm recipe cooked → macros auto-logged to nutrition plugin
- Smart shopping list — rule-based: low/out-of-stock items + missing recipe ingredients, exportable checklist

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

### Active (v1.1 — Smart Pantry Plugin)

- [x] Smart inventory — pantry items with qty, unit, expiration, category (Validated in Phase 6: smart-inventory)
- [x] AI recipe suggestions — from pantry contents + remaining daily macros (Validated in Phase 7: ai-recipe-suggestions)
- [x] Calorie tracker sync — confirm cooked → auto-log macros to nutrition plugin (Validated in Phase 8: calorie-tracker-sync)
- [x] Smart shopping list — rule-based from low-stock items + recipe ingredients (Validated in Phase 9: smart-shopping-list)

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

- **Existing app**: Ziko is a fully-built React Native / Expo fitness app with 17 plugins, AI coaching, GPS cardio tracking, and a Supabase backend. The landing page presents this product.
- **Design system**: Ziko uses a light sport theme — primary `#FF5C1A` (orange), background `#F7F6F3`, text `#1C1A17`, border `#E2E0DA`. The landing page should match this identity.
- **Backend**: Supabase (PostgreSQL + Auth). Account deletion requires calling `supabase.auth.admin.deleteUser()` from a secure server action — needs `SUPABASE_SERVICE_ROLE_KEY` (never expose in client).
- **Legal jurisdiction**: French law — RGPD (GDPR equivalent enforcement in France), mentions légales mandatory for commercial sites, CGU required.
- **Existing infrastructure**: API lives at `https://ziko-api-lilac.vercel.app`, already on Vercel — easy to add another Vercel project.

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
*Last updated: 2026-04-01 — Phase 9 complete: Smart Pantry Plugin v1.1 milestone fully shipped (all 4 phases: inventory, AI recipes, calorie sync, shopping list)*
