---
phase: 03-marketing-content
plan: 01
subsystem: ui
tags: [react-icons, i18n, next-intl, translations, marketing]

# Dependency graph
requires:
  - phase: 02-rgpd-compliance
    provides: Footer namespace already in fr.json/en.json (preserved unchanged)
provides:
  - react-icons package installed and importable from react-icons/io5
  - Header translation namespace (4 keys) in fr.json and en.json
  - Home.hero, Home.showcase, Home.pricing nested translation namespaces
  - Plugins namespace with 17 plugin description strings per locale (34 total)
affects: [03-02-PLAN, 03-03-PLAN]

# Tech tracking
tech-stack:
  added: [react-icons]
  patterns: [Write tool for JSON files to prevent encoding corruption of accented French characters]

key-files:
  created: []
  modified:
    - messages/fr.json
    - messages/en.json
    - package.json
    - package-lock.json

key-decisions:
  - "react-icons/io5 used for Ionicons v5 parity with mobile app (D-06)"
  - "Footer namespace preserved exactly from existing files — no changes to legal/RGPD copy"
  - "Home.heading/Home.body stubs from Phase 1 replaced with nested hero/showcase/pricing structure"

patterns-established:
  - "JSON files written via Write tool (not bash heredoc) to preserve UTF-8 accented French characters"
  - "FR text sourced verbatim from UI-SPEC Copywriting Contract section for copy accuracy"

requirements-completed: [MKTG-01, MKTG-02, MKTG-03]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 3 Plan 01: Foundation Strings Summary

**react-icons installed and 34 bilingual marketing strings written (Header, Hero, Showcase, Pricing, 17 Plugins) across fr.json and en.json**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T21:00:00Z
- **Completed:** 2026-03-26T21:05:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- react-icons package added to dependencies, verified importable via `require('react-icons/io5')`
- Header namespace added (logo, cta, localeFR, localeEN) in both locales
- Home namespace restructured from Phase 1 stub (heading/body) to nested hero/showcase/pricing with 17 keys
- Plugins namespace added with 17 plugin descriptions in French (accented) and English (34 strings total)
- Footer namespace preserved unchanged from Phase 2 RGPD work

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-icons package** - `ac35d85` (feat)
2. **Task 2: Write all translation strings (FR + EN)** - `862a9f5` (feat)

**Plan metadata:** committed with docs(03) commit after SUMMARY creation

## Files Created/Modified
- `C:/ziko-web/messages/fr.json` - Full bilingual French translations: Header, Home (hero/showcase/pricing), 17 plugin descriptions, Footer
- `C:/ziko-web/messages/en.json` - Full bilingual English translations: same structure, identical key set
- `C:/ziko-web/package.json` - Added react-icons dependency
- `C:/ziko-web/package-lock.json` - Updated lock file for react-icons

## Decisions Made
- react-icons/io5 chosen for Ionicons v5 parity with mobile app per CONTEXT.md D-06
- Footer namespace preserved exactly — RGPD legal copy must not be changed outside Phase 2 scope
- Home stub keys (heading, body) replaced by nested structure — they were placeholder-only, no live usage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- react-icons importable: components in 03-02 and 03-03 can use `import { IoTimerOutline } from 'react-icons/io5'`
- All translation keys ready: Header.tsx, Hero.tsx, PluginShowcase.tsx, Pricing.tsx can all call `t('...')` with defined keys
- 03-02-PLAN (Header + Hero) is unblocked

---
*Phase: 03-marketing-content*
*Completed: 2026-03-26*
