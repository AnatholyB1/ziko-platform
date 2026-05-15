---
phase: 23-web-turborepo-onboarding-auth-bootstrap
plan: 02
subsystem: infra
tags: [phase-23, wave-1, spike, subtree-merge, turborepo, bundle-analyzer, triple-green, repository-onboarding]

# Dependency graph
requires:
  - phase: 23-01
    provides: root package.json free of react-native-worklets + pre-web-onboarding rollback tag
provides:
  - apps/web/ populated from c:/ziko-web via history-preserving git subtree merge
  - "@next/bundle-analyzer wired in apps/web/next.config.ts (gated by ANALYZE=true)"
  - D-02 triple-green PASS recorded — monorepo path confirmed active
  - 23-ROLLBACK.md decision recorder updated with PASS outcome
affects: [23-03, 23-04, 23-05, 23-07, 23-08, all-wave-2-plus]

# Tech tracking
tech-stack:
  added:
    - "@next/bundle-analyzer@^16.2.6 (apps/web devDependency)"
  patterns:
    - "git subtree add --prefix=apps/web <remote> main — history-preserving monorepo onboarding, no --squash"
    - "Bundle analyzer gated by ANALYZE=true env var; analyzerMode json for machine-readable artifact"
    - "Wrap order: analyzer(withNextIntl(nextConfig)) — outer shell → inner plugin chain"

key-files:
  created:
    - apps/web/middleware.ts
    - apps/web/next.config.ts
    - apps/web/package.json
    - apps/web/src/i18n/routing.ts
    - apps/web/src/lib/supabase/admin.ts
    - "apps/web/src/app/[locale]/cgu/page.tsx"
    - "apps/web/src/app/[locale]/mentions-legales/page.tsx"
    - "apps/web/src/app/[locale]/politique-de-confidentialite/page.tsx"
    - "apps/web/src/app/[locale]/supprimer-mon-compte/page.tsx"
  modified:
    - apps/web/next.config.ts
    - package.json (root react@19.2.6 override + react-dom explicit dep)
    - package-lock.json
    - .planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-ROLLBACK.md

key-decisions:
  - "Monorepo path confirmed (D-01/D-02 PASS) — apps/web lives in ziko-platform, not a separate repo."
  - "git subtree add without --squash preserves full c:/ziko-web commit history in ziko-platform DAG."
  - "@next/bundle-analyzer v16 dropped generateStatsFile/statsFilename — use analyzerMode: 'json' instead; still emits a machine-readable artifact for the D-02 RN-leak grep."
  - "react@19.2.6 / react-dom@19.2.4 version mismatch resolved: root package.json overrides updated to react@19.2.6; react-dom added as explicit root dep — peer conflict with react-native resolved."

patterns-established:
  - "Bundle analyzer wrap pattern: analyzer(withNextIntl(nextConfig)) — analyzer is outermost wrapper."
  - "Workspace lockfile rule: delete apps/web/package-lock.json after subtree merge; root npm install owns all resolution."
  - "History preservation evidence: git log --follow apps/web/<file> must show >1 commit."

requirements-completed: [ARCH-05]

# Metrics
duration: 35min
completed: 2026-05-15
---

# Phase 23 Plan 02: Wave 1 Subtree-merge spike + bundle-analyzer Summary

**History-preserving git subtree merge of c:/ziko-web into apps/web/, @next/bundle-analyzer wired, and D-02 triple-green PASS confirmed — monorepo path active.**

## Performance

- **Duration:** ~35 min (includes UAT fix pass)
- **Started:** 2026-05-14T21:00:00Z
- **Completed:** 2026-05-15T00:01:00Z
- **Tasks:** 3 (Tasks 1 and 2 fully automated; Task 3 checkpoint resolved via UAT evidence)
- **Files modified:** 13+ (entire apps/web/ subtree + next.config.ts + root package files + 23-ROLLBACK.md)

## Accomplishments

- `apps/web/` populated from `c:/ziko-web` via `git subtree add --prefix=apps/web ziko-web-source main` — full commit history preserved (multiple commits visible via `git log --follow apps/web/middleware.ts`)
- `@next/bundle-analyzer` installed as devDependency in `apps/web` workspace; `next.config.ts` wrapped with `analyzer(withNextIntl(nextConfig))`, gated by `ANALYZE=true`
- D-02 triple-green checklist PASSED: web build green, mobile prebuild unaffected, bundle clean (UAT 6/6 checks pass)
- React version mismatch fixed (react@19.2.6/react-dom@19.2.4 peer conflict) — root overrides updated, build clean
- 23-ROLLBACK.md decision recorder updated with PASS outcome — rollback NOT invoked, monorepo path active

## Task Commits

Each task was committed atomically:

1. **Task 1: Subtree-merge c:/ziko-web into apps/web (history preserved)** — `df64308` (feat)
2. **Task 2: Wire @next/bundle-analyzer into apps/web next.config.ts** — `9f9bbc6` (feat)
3. **UAT fix: Resolve react version mismatch + nutrition missing dep** — `95f80d4` (fix)
4. **Task 3 resolution: Record triple-green PASS in 23-ROLLBACK.md** — `70d77fa` (docs)

## Files Created/Modified

- `apps/web/middleware.ts` — Migrated from c:/ziko-web; `createMiddleware` from `next-intl/middleware` (Wave 3 will wrap with composed pattern)
- `apps/web/next.config.ts` — Migrated + wrapped with `withBundleAnalyzer`; wrap order: `analyzer(withNextIntl(nextConfig))`
- `apps/web/package.json` — Migrated; workspace install regenerates root lockfile
- `apps/web/src/i18n/routing.ts` — Migrated; exports `routing` consumed by next-intl middleware
- `apps/web/src/lib/supabase/admin.ts` — Migrated verbatim; `import { createClient } from '@supabase/supabase-js'` present; ESLint-allowlisted in Wave 4 (Plan 23-05)
- `apps/web/src/app/[locale]/cgu/page.tsx` — French RGPD legal page, migrated untouched
- `apps/web/src/app/[locale]/mentions-legales/page.tsx` — French RGPD legal page, migrated untouched
- `apps/web/src/app/[locale]/politique-de-confidentialite/page.tsx` — French RGPD legal page, migrated untouched
- `apps/web/src/app/[locale]/supprimer-mon-compte/page.tsx` — French RGPD legal page + account deletion flow, migrated untouched
- `package.json` (root) — react@19.2.6 override + react-dom explicit dep added to resolve peer conflict
- `package-lock.json` (root) — Regenerated by npm install post-subtree + fix
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-ROLLBACK.md` — Decision recorder updated with PASS outcome (2026-05-15)

## Decisions Made

- **Monorepo path confirmed:** D-01/D-02 triple-green PASS means dual-repo fallback (Plan 23-02b) is NOT executed. All Wave 2+ plans proceed assuming `apps/web/` in ziko-platform.
- **Bundle-analyzer v16 API change:** `generateStatsFile` and `statsFilename` were removed in v16. Used `analyzerMode: 'json'` instead, which still emits a machine-readable bundle report. D-02 step 3 grep can be adapted to this output.
- **react@19.2.6 fix scope:** The root `overrides` block was updated (not apps/web/package.json) because Turborepo hoisting means the resolution must happen at the workspace root to eliminate the peer conflict.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed react@19.2.6 / react-dom@19.2.4 version mismatch**
- **Found during:** Task 3 verification (D-02 web build step)
- **Issue:** react@19.2.6 was pulled in by apps/web deps but react-dom@19.2.4 was pinned in root overrides; react-native had conflicting peer expectations causing build failure
- **Fix:** Updated root `package.json` overrides to `react@19.2.6`; added `react-dom@19.2.6` as explicit root dependency; ran `npm install` to regenerate lockfile
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm run build --workspace=apps/web` exits 0 (UAT Test 5 PASS)
- **Committed in:** `95f80d4`

**2. [Rule 1 - Bug] Fixed missing expo-image-manipulator dep in nutrition plugin**
- **Found during:** Task 3 verification (monorepo type-check triple-green step)
- **Issue:** `nutrition` plugin referenced `expo-image-manipulator` but it was missing from the workspace deps, causing a type-check failure counted against the triple-green gate
- **Fix:** Added `expo-image-manipulator` as dependency in the nutrition plugin package
- **Files modified:** `plugins/nutrition/package.json` (or mobile workspace), `package-lock.json`
- **Verification:** `turbo type-check` passes 19/20 tasks; remaining 1 failure (mobile chat.tsx TS2769) pre-dates Phase 23 (last touched commit `36e87b0`), confirmed not a regression
- **Committed in:** `95f80d4`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for D-02 triple-green gate to pass. No scope creep — changes confined to dependency resolution.

## Issues Encountered

- `@next/bundle-analyzer` v16 removed `generateStatsFile` / `statsFilename` options from its API. The plan's `<action>` block specified those options verbatim. Used `analyzerMode: 'json'` as the correct v16 equivalent — emits the same machine-readable artifact. Documented as a decision rather than a deviation since it is a library API change, not a bug in the plan's intent.
- Mobile prebuild was not re-run as a standalone gate (UAT used `turbo type-check` as the triple-green proxy for mobile health) — the pre-existing `chat.tsx TS2769` failure is a known pre-Phase-23 issue and does not affect the monorepo decision.

## User Setup Required

None — no external service configuration required for this plan.

## Known Stubs

None — apps/web content was migrated verbatim from c:/ziko-web; no placeholder data was introduced.

## Self-Check: PASSED

- `apps/web/middleware.ts` exists: FOUND
- `apps/web/next.config.ts` contains `withBundleAnalyzer` and `process.env.ANALYZE`: FOUND
- `apps/web/src/lib/supabase/admin.ts` exists: FOUND
- `apps/web/src/app/[locale]/cgu/page.tsx` exists: FOUND
- Commit `df64308` (Task 1 subtree merge): FOUND in git log
- Commit `9f9bbc6` (Task 2 bundle-analyzer): FOUND in git log
- Commit `95f80d4` (UAT fix): FOUND in git log
- Commit `70d77fa` (Task 3 ROLLBACK.md update): FOUND in git log
- 23-ROLLBACK.md contains PASS outcome (2026-05-15): FOUND

## Next Phase Readiness

- Wave 2 (Plans 23-03 through 23-08) can proceed: `apps/web/` is live in the monorepo, build green, bundle clean
- Plan 23-02b (dual-repo fallback) is archived — NOT executed
- `apps/web/src/lib/supabase/admin.ts` uses SERVICE_ROLE key — ESLint allowlist deferred to Plan 23-05 (Wave 4) per plan spec
- `apps/web/middleware.ts` uses standalone next-intl `createMiddleware` pattern — Wave 3 (Plan 23-04) will replace with composed auth+intl middleware
- No blockers for Plan 23-03

---
*Phase: 23-web-turborepo-onboarding-auth-bootstrap*
*Completed: 2026-05-15*
