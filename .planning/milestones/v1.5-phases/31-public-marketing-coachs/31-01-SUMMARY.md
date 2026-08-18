---
phase: 31-public-marketing-coachs
plan: "01"
subsystem: apps/web
tags: [marketing, ssg, i18n, og-image, next-intl]
dependency_graph:
  requires: []
  provides:
    - apps/web/public/og-coachs.png
    - apps/web/messages/fr.json#coachs
    - apps/web/messages/en.json#coachs
    - apps/web/src/app/[locale]/(marketing)/coachs/page.tsx
  affects:
    - Wave 2 plans (31-02, 31-03) — components can now import from coachs namespace and be imported by page.tsx
tech_stack:
  added: []
  patterns:
    - SSG with generateStaticParams + setRequestLocale (Next.js 15 pattern)
    - next-intl getTranslations server-side
    - Raw PNG binary generation via Node.js + zlib (no external image library)
key_files:
  created:
    - apps/web/public/og-coachs.png
    - apps/web/scripts/gen-og-coachs.mjs
    - apps/web/src/app/[locale]/(marketing)/coachs/page.tsx
    - apps/web/src/components/marketing/CoachsHero.tsx
    - apps/web/src/components/marketing/CoachsVideoPlaceholder.tsx
    - apps/web/src/components/marketing/CoachsFeatureBlocks.tsx
    - apps/web/src/components/marketing/CoachsComparisonTable.tsx
    - apps/web/src/components/marketing/CoachsFounderSection.tsx
    - apps/web/src/components/marketing/CoachsFAQ.tsx
    - apps/web/src/components/marketing/CoachsCtaFooter.tsx
  modified:
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
decisions:
  - "Stub components created for all 7 Coachs* components to unblock TypeScript compilation before Wave 2"
  - "PNG generated via raw zlib+PNG binary format (no canvas/sharp/jimp — none available in node_modules)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 10
  files_modified: 2
---

# Phase 31 Plan 01: SSG Foundation — OG Image, i18n Namespace, Page Shell Summary

**One-liner:** Static OG image (1200x630 dark PNG), complete coachs.* i18n namespace (52 keys FR+EN), and Next.js SSG page shell registering /fr/coachs and /en/coachs routes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /public/og-coachs.png static OG image | f7a96c6 | apps/web/public/og-coachs.png, apps/web/scripts/gen-og-coachs.mjs |
| 2 | Add coachs.* i18n namespace to fr.json and en.json | 614c2cb | apps/web/messages/fr.json, apps/web/messages/en.json |
| 3 | Create SSG page shell coachs/page.tsx | e64a133 | apps/web/src/app/[locale]/(marketing)/coachs/page.tsx + 7 stub components |

## What Was Built

### Task 1 — OG Image
- Valid 1200x630 PNG at `apps/web/public/og-coachs.png` (3.6KB)
- Background color: #1C1A17 (solid dark) — matching design spec
- Generated via `apps/web/scripts/gen-og-coachs.mjs` using raw PNG byte format + Node.js zlib (no external image library required)
- TODO comment in script: replace with designed PNG before go-live (ZIKO white 72px + orange subtitle)

### Task 2 — i18n Namespace
- Complete `coachs` top-level namespace added to both `apps/web/messages/fr.json` and `apps/web/messages/en.json`
- 52 keys covering: meta (title, description), hero (5 keys), video (2), features (4 blocks × 4 keys each = 18), comparison (11), founder (5), faq (13), cta (4)
- Both files validated as clean JSON (no parse errors)

### Task 3 — SSG Page Shell
- `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` created
- `generateStaticParams()` returns `[{locale:'fr'},{locale:'en'}]`
- `generateMetadata()` uses `getTranslations({ locale, namespace: 'coachs' })` and emits `/og-coachs.png` in openGraph
- `setRequestLocale(locale)` called as first statement after `await params` in `CoachsPage`
- Assembles 7 section components in order: Hero → VideoPlaceholder → FeatureBlocks → ComparisonTable → FounderSection → FAQ → CtaFooter
- `CoachsHero` and `CoachsCtaFooter` receive `locale` prop for CTA href generation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created 7 stub components to unblock TypeScript compilation**
- **Found during:** Task 3 verification
- **Issue:** page.tsx imports 7 Coachs* components that don't exist yet (Wave 2 deliverables); TypeScript errored with TS2307 on all 7 imports
- **Fix:** Created minimal stub components (each exports a single empty `<section>` element) at `apps/web/src/components/marketing/Coachs*.tsx` — each file has a `// Wave 2 stub` comment and TODO for full implementation
- **Files modified:** 7 new component stubs
- **Commit:** e64a133 (same commit as page.tsx)

## Known Stubs

| File | Stub Type | Reason |
|------|-----------|--------|
| apps/web/src/components/marketing/CoachsHero.tsx | Empty section stub | Wave 2 deliverable — full hero implementation in 31-02 |
| apps/web/src/components/marketing/CoachsVideoPlaceholder.tsx | Empty section stub | Wave 2 deliverable — full video placeholder in 31-02 |
| apps/web/src/components/marketing/CoachsFeatureBlocks.tsx | Empty section stub | Wave 2 deliverable — 4 feature blocks in 31-02 |
| apps/web/src/components/marketing/CoachsComparisonTable.tsx | Empty section stub | Wave 2 deliverable — comparison table in 31-03 |
| apps/web/src/components/marketing/CoachsFounderSection.tsx | Empty section stub | Wave 2 deliverable — founder section in 31-03 |
| apps/web/src/components/marketing/CoachsFAQ.tsx | Empty section stub | Wave 2 deliverable — FAQ accordion in 31-03 |
| apps/web/src/components/marketing/CoachsCtaFooter.tsx | Empty section stub | Wave 2 deliverable — CTA footer in 31-03 |
| apps/web/public/og-coachs.png | Solid dark background, no text | No canvas/sharp/jimp available; designed PNG needed before go-live |

These stubs are intentional — Wave 2 plans (31-02, 31-03) will replace each with full implementations. The page goal (routing + metadata + i18n foundation) is fully achieved.

## Threat Flags

None — all outputs are static public assets with no user input crossing any trust boundary.

## Self-Check: PASSED

- [x] `apps/web/public/og-coachs.png` exists (3632 bytes, valid PNG signature)
- [x] `apps/web/messages/fr.json` parses as valid JSON, contains `"coachs"` key
- [x] `apps/web/messages/en.json` parses as valid JSON, contains `"coachs"` key
- [x] `apps/web/src/app/[locale]/(marketing)/coachs/page.tsx` exists with `generateStaticParams`
- [x] All 3 task commits exist: f7a96c6, 614c2cb, e64a133
- [x] TypeScript reports zero errors on coachs/page.tsx
