---
phase: 31
plan: "03"
subsystem: apps/web
tags: [marketing, components, framer-motion, next-intl, accessibility]
dependency_graph:
  requires: [31-01, 31-02]
  provides: [CoachsComparisonTable, CoachsFounderSection, CoachsFAQ, CoachsCtaFooter]
  affects: [apps/web/src/app/[locale]/(marketing)/coachs/page.tsx]
tech_stack:
  added: []
  patterns: [framer-motion useInView, AnimatePresence accordion, sr-only table caption, aria-expanded]
key_files:
  created: []
  modified:
    - apps/web/src/components/marketing/CoachsComparisonTable.tsx
    - apps/web/src/components/marketing/CoachsFounderSection.tsx
    - apps/web/src/components/marketing/CoachsFAQ.tsx
    - apps/web/src/components/marketing/CoachsCtaFooter.tsx
decisions:
  - "Kept TODO comments in CoachsFounderSection as explicit go-live markers for real founder photo/name/story"
  - "Used FAQ_KEYS const array pattern to map i18n keys cleanly without index arithmetic"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-22"
  tasks_completed: 3
  files_modified: 4
---

# Phase 31 Plan 03: Marketing Components Full Implementation Summary

Four Wave-2 stub components replaced with full, production-ready implementations for the `/coachs` marketing page.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | CoachsComparisonTable | f1b9cb0 | CoachsComparisonTable.tsx |
| 2 | CoachsFounderSection + CoachsCtaFooter | f1b9cb0 | CoachsFounderSection.tsx, CoachsCtaFooter.tsx |
| 3 | CoachsFAQ | f1b9cb0 | CoachsFAQ.tsx |

## What Was Built

**CoachsComparisonTable** — 3-column comparison table (Ziko vs Trainerize vs TrueCoach). Sticky feature-label column, sr-only `<caption>` for accessibility, inView fade-up animation, Ziko column highlighted with orange left border and `bg-primary/5`. Check/close icons with aria-labels.

**CoachsFounderSection** — Quote card with orange left border, inView slide-in animation. Avatar placeholder with initials "FD" and explicit TODO comments marking what must be replaced before go-live (photo, name, story).

**CoachsCtaFooter** — CTA section with heading + subheading + Link button to `/{locale}/coach/onboarding`. Uses `ctaHover` and `ctaTap` from `@/lib/motion` for button interaction feedback. Orange drop shadow on button.

**CoachsFAQ** — Accordion with 6 Q&A items driven by `FAQ_KEYS` const. AnimatePresence height animation on open/close, `aria-expanded` + `aria-controls` for accessibility, chevron rotates 180° when open, per-item staggered inView entrance.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following placeholders in CoachsFounderSection are intentional and marked with TODO comments:
- Avatar initials "FD" (file: CoachsFounderSection.tsx) — placeholder until real founder photo is available
- `{t('founder.name')}` and `{t('founder.title')}` — i18n keys exist but may contain placeholder text until founder info is confirmed

These stubs do NOT prevent the plan's goal (full component implementation) from being achieved — the components render correctly with i18n keys, and the TODOs are content-replacement tasks, not structural ones.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] CoachsComparisonTable.tsx exists and has `caption` element
- [x] CoachsFAQ.tsx has `AnimatePresence` and `aria-expanded`
- [x] CoachsFounderSection.tsx has `TODO` comments
- [x] CoachsCtaFooter.tsx links to `coach/onboarding`
- [x] TypeScript: zero errors (tsc --noEmit clean)
- [x] Commit f1b9cb0 exists
