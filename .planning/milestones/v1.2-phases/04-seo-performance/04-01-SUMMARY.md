---
phase: 04-seo-performance
plan: 01
subsystem: ziko-web/seo
tags: [seo, metadata, og, next-intl, static-rendering]
dependency_graph:
  requires: [03-marketing-content]
  provides: [metadataBase, generateMetadata, og-image, metadata-translations]
  affects: [all-locale-pages, root-layout]
tech_stack:
  added: [sharp@0.34.5 (devDependency)]
  patterns: [generateMetadata-with-getTranslations, metadataBase-env-var, og-static-png]
key_files:
  created:
    - /c/ziko-web/public/og-image.png
    - /c/ziko-web/scripts/generate-og-image.js
  modified:
    - /c/ziko-web/src/app/layout.tsx
    - /c/ziko-web/src/app/[locale]/page.tsx
    - /c/ziko-web/src/app/[locale]/mentions-legales/page.tsx
    - /c/ziko-web/src/app/[locale]/politique-de-confidentialite/page.tsx
    - /c/ziko-web/src/app/[locale]/cgu/page.tsx
    - /c/ziko-web/src/app/[locale]/supprimer-mon-compte/page.tsx
    - /c/ziko-web/messages/fr.json
    - /c/ziko-web/messages/en.json
decisions:
  - metadataBase set in root layout via NEXT_PUBLIC_SITE_URL env var (fallback localhost:3000) — no hardcoding of production domain
  - localePrefix 'always' confirmed — all canonical URLs use /fr/* and /en/* prefixes (not clean /*)
  - supprimer-mon-compte gets robots noindex/nofollow per D-07 (excluded from sitemap)
  - sharp added as explicit devDependency — was transitive only, would fail in clean CI installs
metrics:
  duration: 10
  completed: "2026-03-27T16:17:50Z"
  tasks_completed: 2
  files_modified: 10
---

# Phase 4 Plan 01: OG Metadata + metadataBase Summary

**One-liner:** Locale-specific generateMetadata with OG tags, twitter cards, and canonical URLs on all 5 pages; metadataBase wired to NEXT_PUBLIC_SITE_URL; 1200x630 static OG image generated via sharp.

## What Was Built

### Task 1: Metadata translation strings and OG image

Added a `Metadata` namespace to both `messages/fr.json` and `messages/en.json` with 11 keys each covering all page titles, descriptions, OG alt text, and screenshot alt text. Keys added: `homeTitle`, `homeDescription`, `ogImageAlt`, `legalTitle`, `legalDescription`, `privacyTitle`, `privacyDescription`, `cguTitle`, `cguDescription`, `deleteTitle`, `deleteDescription`, `appScreenshotAlt`.

Generated `/c/ziko-web/public/og-image.png` (56,617 bytes, 1200x630px) using a Node.js script (`scripts/generate-og-image.js`) that converts an SVG to PNG via sharp. The design uses brand colors: `#FF5C1A` primary (brand name text, decorative circles, badge), `#F7F6F3` background gradient, `#1C1A17` tagline text. Added sharp as an explicit `devDependency` (was previously only transitive).

**Commit:** `155fe59`

### Task 2: metadataBase and generateMetadata on all pages

**`src/app/layout.tsx`** — Added `export const metadata: Metadata = { metadataBase: new URL(siteUrl) }` where `siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'`. This ensures all OG image URLs and canonical links in child pages resolve to the production domain.

**`src/app/[locale]/page.tsx`** — Added `generateMetadata` with full OG + twitter card + alternates canonical using `getTranslations({ locale, namespace: 'Metadata' })`. Canonical uses `/fr` and `/en` prefixes matching `localePrefix: 'always'`.

**All legal pages** (`mentions-legales`, `politique-de-confidentialite`, `cgu`) — Added identical `generateMetadata` pattern with page-specific title/description keys and correct canonical paths.

**`supprimer-mon-compte`** — Added `generateMetadata` with `robots: { index: false, follow: false }` per D-07 (excluded from sitemap). Page is a utility flow with no SEO value.

**Build verification:** `npm run build` passed with all `[locale]/*` routes showing `●` (SSG/static). Zero `ƒ` (dynamic) routes. The `getTranslations({ locale, namespace })` pattern in `generateMetadata` does not cause dynamic rendering — it resolves at build time against `generateStaticParams`.

**Commit:** `dfae142`

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| messages/fr.json contains Metadata namespace with homeTitle | PASS |
| messages/en.json contains Metadata namespace with homeTitle | PASS |
| public/og-image.png exists and > 1KB (56,617 bytes) | PASS |
| All existing translation keys preserved | PASS |
| src/app/layout.tsx contains metadataBase with NEXT_PUBLIC_SITE_URL | PASS |
| src/app/[locale]/page.tsx exports generateMetadata | PASS |
| mentions-legales/page.tsx exports generateMetadata | PASS |
| politique-de-confidentialite/page.tsx exports generateMetadata | PASS |
| cgu/page.tsx exports generateMetadata | PASS |
| supprimer-mon-compte/page.tsx has robots: { index: false } | PASS |
| npm run build succeeds with exit 0 | PASS |
| All [locale]/* routes show static (●), zero dynamic (ƒ) | PASS |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notable Observations

1. **localePrefix confirmed as 'always':** The RESEARCH.md flagged a discrepancy between CONTEXT.md (which mentioned `as-needed`) and the actual `routing.ts` (which has `always`). Confirmed `localePrefix: 'always'` is active — all canonical URLs correctly use `/fr/*` and `/en/*` prefixes in `generateMetadata` and `alternates.languages`.

2. **sitemap.ts and robots.ts already present:** The build output showed `/robots.txt` and `/sitemap.xml` as existing static routes (commits `f962b7a` and `2c08a46`). These were implemented in a prior session. Plan 04-01 only covers OG metadata; sitemap/robots are covered by a separate plan already done.

## Known Stubs

None — all metadata keys are wired to real translation strings. The `NEXT_PUBLIC_SITE_URL` env var must be set to `https://ziko-app.com` in Vercel project settings before deployment for production OG URLs to resolve correctly (pre-existing deployment task, not a code stub).

## Self-Check

- [x] `public/og-image.png` — exists (56,617 bytes)
- [x] `src/app/layout.tsx` contains `metadataBase`
- [x] `src/app/[locale]/page.tsx` exports `generateMetadata`
- [x] All 5 pages have `generateMetadata`
- [x] Commits `155fe59` and `dfae142` exist
- [x] Build output: all routes static (●)

## Self-Check: PASSED
