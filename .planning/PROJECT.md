# Ziko Web

## What This Is

A Next.js marketing website for the Ziko fitness app, targeting French and English audiences. It showcases the app's features and plugins, provides all required French legal pages (RGPD compliance), and offers a self-service account deletion flow. The same codebase will grow to include a coach ERP/CRM dashboard under `/coach` in a future milestone.

## Core Value

A potential user lands on the site and understands what Ziko does, feels compelled to download the app, and trusts it enough to create an account.

## Current Milestone: v1.0 Landing Page

**Goal:** Ship a Next.js marketing site that showcases the Ziko fitness app, drives downloads, and satisfies French legal requirements before launch.

**Target features:**
- Hero section with app screenshots + App Store / Play Store CTAs
- Features showcase presenting all 17 plugins
- Pricing section — free tier with "Download free" CTA
- French + English i18n (FR default, `next-intl`)
- RGPD / Politique de confidentialité page
- Mentions légales page
- CGU (Conditions Générales d'Utilisation) page
- Self-service account deletion (server-side Supabase admin delete)
- Deployed on Vercel, custom domain ready

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Landing Page (Milestone 1)**
- [ ] Hero section with app screenshots and download CTA (App Store / Play Store links)
- [ ] Features showcase presenting all major app capabilities (17 plugins)
- [ ] Pricing section — free tier with "Download free" CTA (no paid tier yet)
- [ ] French + English i18n (FR default)
- [ ] RGPD compliance page (politique de confidentialité)
- [ ] Mentions légales page
- [ ] Conditions Générales d'Utilisation (CGU)
- [ ] Self-service account deletion page — user enters email, confirms, Supabase API deletes account
- [ ] Deployed on Vercel, custom domain ready

**Coach Platform (Milestone 2 — future)**
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
*Last updated: 2026-03-26 — Milestone v1.0 Landing Page started*
