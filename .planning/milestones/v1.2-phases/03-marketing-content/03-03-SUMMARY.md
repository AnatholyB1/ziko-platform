---
phase: "03"
plan: "03-03"
subsystem: "marketing-site"
tags: [marketing, plugin-showcase, pricing, homepage, next-intl, react-icons]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [plugin-showcase-section, pricing-section, full-homepage]
  affects: [src/app/[locale]/page.tsx]
tech_stack:
  added: []
  patterns: [server-component-with-translations, react-icons-io5, bilingual-copy]
key_files:
  created:
    - src/components/marketing/PluginShowcase.tsx
    - src/components/marketing/Pricing.tsx
  modified:
    - src/app/[locale]/page.tsx
decisions:
  - "Plugin names use proper French accented characters in component data (Récupération, Communauté, etc.)"
  - "CATEGORIES data structure defined inline in PluginShowcase.tsx — no separate data file"
  - "page.tsx removes getTranslations — each section handles its own translation namespace"
metrics:
  duration: "~10 min"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 3
---

# Phase 3 Plan 03: PluginShowcase + Pricing + Homepage Assembly Summary

**One-liner:** 17-plugin showcase in 5 responsive category grids and a free-tier pricing card assembled into the full homepage using next-intl Server Component pattern.

## What Was Built

### Task 1: PluginShowcase.tsx and Pricing.tsx

**PluginShowcase** (`src/components/marketing/PluginShowcase.tsx`):
- Async Server Component with two translation namespaces: `getTranslations('Home')` and `getTranslations('Plugins')`
- 17 icons imported from `react-icons/io5` (IoTimerOutline through IoPeopleOutline)
- 5 category groups: Training (5), Health (4), Nutrition (2), Coaching (5), Community (1)
- Responsive grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
- Plugin cards: `bg-white border border-border rounded-xl p-4 flex flex-col gap-2`
- Icons at 24px with `text-text` (neutral, not orange — per UI-SPEC accent rules)

**Pricing** (`src/components/marketing/Pricing.tsx`):
- Async Server Component with `getTranslations('Home')`
- Featured card: `bg-white border-2 border-primary rounded-2xl p-8 max-w-sm mx-auto`
- Price display "0€" + "/mois" unit
- 3 value props with `IoCheckmarkCircleOutline` at `text-primary` (orange checkmarks)
- Full-width CTA button `bg-primary text-white` with `href="#"` placeholder

### Task 2: Homepage Assembly

**page.tsx** (`src/app/[locale]/page.tsx`):
- Replaced stub (heading/body keys) with full marketing assembly
- Imports and renders Hero → PluginShowcase → Pricing in sequence
- Removed `getTranslations` from the page itself — each section fetches its own
- Preserved `setRequestLocale(locale)` for static rendering

## Commits

| Task | Commit | Files |
|------|--------|-------|
| T1 | 0193901 | PluginShowcase.tsx, Pricing.tsx |
| T2 | e1e69cd | src/app/[locale]/page.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- All CTA links (`href="#"`) in Pricing.tsx — placeholder until App Store/Play Store URLs are available (documented in STATE.md blockers)

## Self-Check: PASSED

- [x] `C:/ziko-web/src/components/marketing/PluginShowcase.tsx` exists
- [x] `C:/ziko-web/src/components/marketing/Pricing.tsx` exists
- [x] `C:/ziko-web/src/app/[locale]/page.tsx` contains 6 Hero/PluginShowcase/Pricing references
- [x] Commits 0193901 and e1e69cd present in ziko-web repo
