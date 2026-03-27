---
phase: 04-seo-performance
plan: 03
subsystem: ziko-web/hero
tags: [seo, lcp, next-image, sharp, static-rendering, core-web-vitals]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [hero-lcp-image, placeholder-png, phase4-build-gate]
  affects: [Hero.tsx, public/app-screenshot-placeholder.png]
tech_stack:
  added: []
  patterns: [next-image-fill-priority, getTranslations-multi-namespace, svg-to-png-sharp]
key_files:
  created:
    - /c/ziko-web/scripts/generate-placeholder.js
    - /c/ziko-web/public/app-screenshot-placeholder.png
  modified:
    - /c/ziko-web/src/components/marketing/Hero.tsx
decisions:
  - Hero phone frame inner fill replaced with next/image fill+priority — LCP image served via Next.js image optimization pipeline
  - Parent div requires position:relative and overflow:hidden when using next/image fill prop
  - Alt text sourced from Metadata.appScreenshotAlt i18n key (not hardcoded) — both fr/en translations present from Plan 01
metrics:
  duration: 5
  completed: "2026-03-27T17:25:00Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 4 Plan 03: Hero next/image + Final Build Gate Summary

**One-liner:** CSS gradient div in Hero.tsx replaced with next/image (fill, priority, sizes) using a 220x440 sharp-generated PNG placeholder; final Phase 4 build gate confirms all routes remain static across all three plans.

## What Was Built

### Task 1: Generate placeholder PNG and install sharp as devDependency

Sharp was already an explicit devDependency from Plan 01 — no reinstall needed. Created `scripts/generate-placeholder.js` which uses sharp to convert an inline SVG (orange-to-light gradient matching the previous CSS gradient) to a 220x440 PNG. Ran the script to generate `public/app-screenshot-placeholder.png` (10,282 bytes). Both files committed.

**Commit:** `3c22ade`

### Task 2: Replace Hero CSS gradient with next/image and run final build gate

Updated `src/components/marketing/Hero.tsx`:

1. Added `import Image from 'next/image'` at the top.
2. Added `const tMeta = await getTranslations('Metadata')` alongside the existing `getTranslations('Home')` call.
3. Replaced the CSS `linear-gradient` div with a positioned container (`position: relative`, `overflow: hidden`, `borderRadius: 30`) containing `<Image src="/app-screenshot-placeholder.png" alt={tMeta('appScreenshotAlt')} fill style={{ objectFit: 'cover' }} priority sizes="(max-width: 768px) 100vw, 220px" />`.

Final Phase 4 build gate results:
- `npm run build` exit code 0
- All routes static: `/fr`, `/en`, `/fr/cgu`, `/en/cgu`, `/fr/mentions-legales`, `/en/mentions-legales`, `/fr/politique-de-confidentialite`, `/en/politique-de-confidentialite`, `/fr/supprimer-mon-compte`, `/en/supprimer-mon-compte` — all show `●` (SSG)
- Zero `ƒ` (dynamic) routes
- No TypeScript errors, no missing image warnings

**Commit:** `ed412b5`

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| scripts/generate-placeholder.js exists with require('sharp') | PASS |
| public/app-screenshot-placeholder.png exists > 500 bytes (10,282 bytes) | PASS |
| package.json devDependencies contains "sharp" | PASS |
| Hero.tsx contains `import Image from 'next/image'` | PASS |
| Hero.tsx contains `priority` prop on Image | PASS |
| Hero.tsx contains `sizes="(max-width: 768px) 100vw, 220px"` | PASS |
| Hero.tsx contains `src="/app-screenshot-placeholder.png"` | PASS |
| Hero.tsx does NOT contain `linear-gradient` | PASS |
| `npm run build` exits with code 0 | PASS |
| All /fr/* and /en/* routes show static (●) | PASS |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notable Observations

1. **Sharp already present:** Plan 01 had already added sharp as an explicit devDependency (`^0.34.5`). Task 1 skipped the `npm install --save-dev sharp` step as it was redundant. The package.json already had the correct entry.

2. **Upstash Redis warnings in build output:** During the build, four warnings appear about missing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. These are pre-existing (local dev has no Redis env vars set), are not related to this plan, and do not affect the build result or route static analysis. All routes remain fully static.

## Known Stubs

The `src="/app-screenshot-placeholder.png"` image is a placeholder gradient PNG, not a real app screenshot. This is intentional and documented in STATE.md as a Phase 3 blocker ("Real app screenshots from Expo mobile app must be captured before Hero mockup can be finalized"). The placeholder ensures LCP optimization (next/image with priority) is in place structurally, ready to swap with the real screenshot when available.

## Self-Check

- [x] `scripts/generate-placeholder.js` — exists, contains `require('sharp')`
- [x] `public/app-screenshot-placeholder.png` — exists (10,282 bytes > 500)
- [x] `src/components/marketing/Hero.tsx` — contains `import Image from 'next/image'`
- [x] `src/components/marketing/Hero.tsx` — contains `priority`
- [x] `src/components/marketing/Hero.tsx` — does NOT contain `linear-gradient`
- [x] Commits `3c22ade` and `ed412b5` exist
- [x] Build output: all routes static (●), zero dynamic (ƒ)

## Self-Check: PASSED
