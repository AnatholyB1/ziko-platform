---
phase: "03"
plan: "02"
subsystem: marketing-site
tags: [header, hero, navigation, layout, server-components]
dependency_graph:
  requires: [03-01]
  provides: [sticky-header, hero-section, locale-switcher]
  affects: [locale-layout, all-pages]
tech_stack:
  added: []
  patterns: [server-component-getTranslations, locale-aware-link, css-phone-frame]
key_files:
  created:
    - C:/ziko-web/src/components/layout/Header.tsx
    - C:/ziko-web/src/components/marketing/Hero.tsx
  modified:
    - C:/ziko-web/src/app/[locale]/layout.tsx
decisions:
  - "Header uses getLocale() to conditionally apply active/inactive styles on locale switcher links — avoids client component"
  - "Phone frame uses CSS inline styles (not Tailwind) for precise pixel dimensions per UI-SPEC"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-26"
  tasks: 2
  files: 3
---

# Phase 3 Plan 02: Header and Hero Section Summary

**One-liner:** Sticky header with FR|EN locale switcher + orange CTA, and split-layout Hero with CSS phone frame and two App Store CTAs wired to translation keys.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T1 | Create Header.tsx and Hero.tsx | ad6438d | src/components/layout/Header.tsx, src/components/marketing/Hero.tsx |
| T2 | Integrate Header into locale layout | 54a3164 | src/app/[locale]/layout.tsx |

## What Was Built

### Header.tsx (`src/components/layout/Header.tsx`)
- Async Server Component matching Footer.tsx pattern exactly
- `sticky top-0 z-50 bg-white border-b border-border`, height `h-14` (56px)
- Logo: "Ziko" in `text-primary font-bold text-xl` (orange)
- FR|EN locale switcher using `Link` with `locale` prop from `@/i18n/navigation`
- Active locale rendered bold/dark; inactive locale muted with hover state
- CTA button: `bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold` linked to `#`
- Translation namespace: `Header` (logo, cta, localeFR, localeEN)

### Hero.tsx (`src/components/marketing/Hero.tsx`)
- Async Server Component
- Split layout: `flex flex-col md:flex-row md:items-center gap-8`
- Left column: headline (`text-3xl md:text-4xl font-bold text-text`), subline (`text-muted`), two CTA buttons (`bg-primary text-white`)
- Right column: CSS-only phone frame — 220x440px, border-radius 32px, `3px solid #1C1A17` border, orange-to-light gradient fill, centered pill notch
- Translation namespace: `Home` (hero.headline, hero.subline, hero.ctaAppStore, hero.ctaPlayStore)

### Layout Update (`src/app/[locale]/layout.tsx`)
- Added `import { Header } from '@/components/layout/Header'`
- Added `<Header />` between root div opening and `<div className="flex-1">`
- Footer, NextIntlClientProvider, generateStaticParams, Inter font all unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Build Note

Pre-existing ESLint lint errors in Phase 2 legal pages (`cgu/page.tsx`, `mentions-legales/page.tsx`, `politique-de-confidentialite/page.tsx`) cause `next build` to fail during the lint step. These errors existed before this plan and are not caused by changes here. Logged to deferred-items.md for Phase 2 follow-up.

## Known Stubs

- All download CTA buttons link to `href="#"` — placeholder pending real App Store / Play Store URLs (pre-launch task, intentional per D-04/D-15)
- Phone frame inner gradient is a CSS placeholder for a real Expo app screenshot (intentional per D-02)

## Self-Check: PASSED

- [x] `C:/ziko-web/src/components/layout/Header.tsx` — exists, 39 lines
- [x] `C:/ziko-web/src/components/marketing/Hero.tsx` — exists, 74 lines
- [x] Commit `ad6438d` — confirmed in git log
- [x] Commit `54a3164` — confirmed in git log
- [x] `grep -c "sticky" Header.tsx` → 1
- [x] `grep -c "Header" layout.tsx` → 2 (import + JSX)
