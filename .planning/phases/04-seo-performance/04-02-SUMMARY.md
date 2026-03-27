---
phase: 04-seo-performance
plan: 02
subsystem: seo
tags: [next.js, sitemap, robots, seo, metadata, next-intl]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: routing.ts with locales config and localePrefix:always
provides:
  - sitemap.ts at app root generating /sitemap.xml with 8 localized entries
  - robots.ts at app root generating /robots.txt with disallow rules
affects: [04-seo-performance, 05-launch-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 15 file-based metadata: sitemap.ts + robots.ts at app root return MetadataRoute types"
    - "Locale enumeration via routing.locales import — avoids hardcoding locale arrays"
    - "NEXT_PUBLIC_SITE_URL env var pattern for all absolute URL construction"

key-files:
  created:
    - src/app/sitemap.ts
    - src/app/robots.ts
  modified: []

key-decisions:
  - "localePrefix is 'always' in routing.ts — all sitemap URLs include /fr/ and /en/ prefixes"
  - "supprimer-mon-compte excluded from sitemap (D-07), disallowed in robots (D-08) for both locale prefixes"
  - "Both files statically generated at build time (○ in Next.js build output)"

patterns-established:
  - "sitemap.ts: flatMap over pages x locales for O(n*m) entries with alternates"
  - "robots.ts: explicit locale-prefixed disallow paths since localePrefix:always"

requirements-completed: [SEO-03]

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 4 Plan 02: Sitemap + Robots.txt Summary

**Next.js 15 file-based sitemap.ts (8 localized entries, 4 pages x FR+EN) and robots.txt (disallows /supprimer-mon-compte for both locales), both statically generated at build time**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T16:14:53Z
- **Completed:** 2026-03-27T16:16:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/app/sitemap.ts` producing 8 entries (homepage + 3 legal pages x 2 locales) with `alternates.languages` for hreflang support
- Created `src/app/robots.ts` disallowing `/fr/supprimer-mon-compte` and `/en/supprimer-mon-compte`, with sitemap directive
- Build verified: `/sitemap.xml` and `/robots.txt` both show as `○` (Static) in Next.js build output; all `[locale]/*` routes remain `●` (SSG)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sitemap.ts with localized alternates** - `2c08a46` (feat)
2. **Task 2: Create robots.ts with disallow rules** - `f962b7a` (feat)

## Files Created/Modified
- `src/app/sitemap.ts` - Generates /sitemap.xml: 4 pages x 2 locales = 8 entries, each with hreflang alternates
- `src/app/robots.ts` - Generates /robots.txt: allows /, disallows deletion page for both locale prefixes, includes sitemap URL

## Decisions Made
- `localePrefix: 'always'` confirmed in routing.ts — all URLs include locale prefix, so robots.txt disallows both `/fr/supprimer-mon-compte` and `/en/supprimer-mon-compte` explicitly
- `routing.locales` imported dynamically so adding a third locale would auto-include it in both sitemap entries and alternates
- No hardcoded `['fr', 'en']` arrays — single source of truth from routing config

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Build succeeded on first attempt with both static routes confirmed.

## Known Stubs

None — both files are fully functional with real locale enumeration and env var wiring.

## User Setup Required

`NEXT_PUBLIC_SITE_URL` must be set to `https://ziko-app.com` in Vercel environment variables. Without it, sitemap and robots.txt fall back to `http://localhost:3000` which is incorrect in production.

## Next Phase Readiness
- SEO-03 requirement satisfied: /sitemap.xml and /robots.txt will be served correctly in production
- Ready for Phase 4 Plan 03 (OG metadata) — sitemap base URL matches what metadataBase will use
- Pre-launch: Verify NEXT_PUBLIC_SITE_URL is set in Vercel before deploying

---
*Phase: 04-seo-performance*
*Completed: 2026-03-27*
