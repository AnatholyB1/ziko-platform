---
phase: 31-public-marketing-coachs
plan: "02"
subsystem: web-marketing
tags: [marketing, components, framer-motion, i18n, coachs]
dependency_graph:
  requires: ["31-01"]
  provides: ["CoachsHero", "CoachsVideoPlaceholder", "CoachsFeatureBlocks"]
  affects: ["apps/web/src/app/[locale]/(marketing)/coachs/page.tsx"]
tech_stack:
  added: []
  patterns:
    - "useInView scroll-trigger pattern with once:true"
    - "word-stagger animation via containerVariants/wordVariants (mirrors Hero.tsx)"
    - "useScroll/useTransform for parallax scroll on right-column card"
key_files:
  created: []
  modified:
    - apps/web/src/components/marketing/CoachsHero.tsx
    - apps/web/src/components/marketing/CoachsVideoPlaceholder.tsx
    - apps/web/src/components/marketing/CoachsFeatureBlocks.tsx
decisions:
  - "Word-stagger defined locally in CoachsHero (not imported from shared lib) — mirrors Hero.tsx pattern"
  - "CoachsVideoPlaceholder uses aspect-video class with overflow-hidden on motion.div for correct ratio"
  - "ERP feature bullets use text-muted/60 Tailwind fractional opacity for muted roadmap treatment"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-22T17:44:44Z"
  tasks_completed: 3
  files_modified: 3
---

# Phase 31 Plan 02: Coachs Marketing — Hero, Video, Feature Blocks Summary

Wave 2 hero and upper-fold sections for `/coachs` marketing page: animated hero with CRM mock card, video placeholder frame, and 4-card feature grid — all i18n-wired and TypeScript-clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CoachsHero — badge, staggered headline, CTA, CRM mock card | 45bf2ab | CoachsHero.tsx |
| 2 | CoachsVideoPlaceholder — gradient frame with play button | b612956 | CoachsVideoPlaceholder.tsx |
| 3 | CoachsFeatureBlocks — 4-card animated grid with Roadmap tag | b1ab9f9 | CoachsFeatureBlocks.tsx |

## What Was Built

### CoachsHero (`apps/web/src/components/marketing/CoachsHero.tsx`)
- `'use client'` component with `locale: string` prop for dynamic CTA href (`/{locale}/coach/onboarding`)
- Beta badge pill (`bg-primary text-white rounded-full`) via `t('hero.badge')`
- Word-stagger headline using `containerVariants` (staggerChildren: 0.14) and `wordVariants` (defined locally — mirrors Hero.tsx pattern)
- Subtitle with `fadeUp` variant, delay 0.6s
- CTA group with `fadeUp` delay 0.75s — `Link` wrapped in `motion.div` with `ctaHover`/`ctaTap`
- Dark CRM mock card (`bg-gray-900`) with browser chrome dots, orange accent bar, 3 skeleton client rows, and `92% →` accent data point
- Parallax scroll on card via `useTransform(scrollY, [0, 400], [0, -40])`
- Right column hidden below `md:` breakpoint

### CoachsVideoPlaceholder (`apps/web/src/components/marketing/CoachsVideoPlaceholder.tsx`)
- `'use client'` component with `useInView({ once: true })` scroll trigger
- `aspect-video max-w-3xl` frame with `bg-gradient-to-br from-gray-900 to-orange-950`
- Centered ZIKO wordmark, play button circle (`bg-white/10 backdrop-blur-sm`), caption via `t('video.caption')`
- TODO comment for future real video swap (`/demo-coachs.mp4`)
- Scale-in animation: `initial={{ opacity: 0, scale: 0.96 }}` → `{ opacity: 1, scale: 1 }` on inView

### CoachsFeatureBlocks (`apps/web/src/components/marketing/CoachsFeatureBlocks.tsx`)
- `'use client'` component with 4-item config array (`crm`, `ai`, `programs`, `erp`)
- `useInView({ once: true, margin: '-80px' })` stagger trigger
- Each card: `initial={{ opacity: 0, y: 30 }}` with `delay: index * 0.1`
- `whileHover={{ y: -2, boxShadow: '...' }}` lift animation on all cards
- ERP card: Roadmap tag pill via `t('features.erp.tag')` with orange border + `rgba(255,92,26,0.08)` bg
- ERP sub-bullets: `text-muted/60` fractional opacity for visual muted treatment
- All copy via `useTranslations('coachs')` — zero hardcoded strings

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three components are fully implemented with real i18n wiring.

The video placeholder is intentionally a styled gradient frame (not a stub) — it satisfies MKT-03 structurally as documented in D-05. The TODO comment marks the swap location for when a real video is available.

## Threat Flags

No new threat surface introduced. All components are static marketing UI with:
- `locale` prop sourced from `generateStaticParams` (only `'fr'` or `'en'`) — no user-controlled values
- All strings from public `fr.json`/`en.json` translation files — no user input rendered

## Self-Check: PASSED

- `apps/web/src/components/marketing/CoachsHero.tsx` — EXISTS, commit 45bf2ab confirmed
- `apps/web/src/components/marketing/CoachsVideoPlaceholder.tsx` — EXISTS, commit b612956 confirmed
- `apps/web/src/components/marketing/CoachsFeatureBlocks.tsx` — EXISTS, commit b1ab9f9 confirmed
- All 3 files contain `'use client'`
- `CoachsHero.tsx` contains `/${locale}/coach/onboarding` in Link href
- `CoachsVideoPlaceholder.tsx` contains `aspect-video` class
- `CoachsFeatureBlocks.tsx` contains `hasRoadmapTag` config
- TypeScript: no errors on any of the 3 components
