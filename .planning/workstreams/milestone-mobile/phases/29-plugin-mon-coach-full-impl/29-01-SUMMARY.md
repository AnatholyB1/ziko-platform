---
phase: 29-plugin-mon-coach-full-impl
plan: 01
subsystem: ui
tags: [plugin-sdk, i18n, typescript, expo-router, react-native]

# Dependency graph
requires: []
provides:
  - UserProfile.role optional field typed as 'client' | 'coach' | 'both' in plugin-sdk/types.ts
  - 22 coach.* i18n keys + store.mandatory_tooltip in both fr and en dictionaries
  - plugins/coach package scaffold with compilable manifest, stub screen, and Expo Router route wrapper
affects:
  - 29-02-PLAN
  - 29-03-PLAN
  - 29-04-PLAN
  - PluginLoader auto-install and settings.tsx coach section gating

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Plugin mandatory:true pattern — coach manifest hardcodes mandatory: true with no runtime override
    - Workspace package registration — @ziko/plugin-coach added to apps/mobile/package.json like other plugins
    - i18n coach.* key namespace — dotted sub-keys (coach.state_a.*, coach.revoke_modal.*, coach.error.*)

key-files:
  created:
    - plugins/coach/package.json
    - plugins/coach/tsconfig.json
    - plugins/coach/src/manifest.ts
    - plugins/coach/src/index.ts
    - plugins/coach/src/screens/CoachScreen.tsx
    - apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx
  modified:
    - packages/plugin-sdk/src/types.ts
    - packages/plugin-sdk/src/i18n.ts
    - apps/mobile/package.json

key-decisions:
  - "CoachScreen stub returns only SafeAreaView + Text — Wave 1 (29-03) replaces it with full implementation"
  - "store.mandatory_tooltip placed adjacent to other store.* keys in both locales, not inside coach.* block"
  - "plugins/coach/tsconfig.json includes only src/ (not creditStore.ts like habits) — no gamification dep needed"

patterns-established:
  - "Pattern 1: Coach plugin package.json omits @tanstack/react-query (hoisted from monorepo workspace)"
  - "Pattern 2: Manifest mandatory:true blocks uninstall; PluginLoader gates the trash button off this flag"

requirements-completed: [COACH-01, COACH-13, COACH-14]

# Metrics
duration: 18min
completed: 2026-05-20
---

# Phase 29 Plan 01: Wave 0 Foundation Summary

**UserProfile.role typed + 24 i18n keys seeded + @ziko/plugin-coach scaffold compiles clean, unblocking all Wave 1-3 imports**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-20T00:00:00Z
- **Completed:** 2026-05-20T00:18:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added `role?: 'client' | 'coach' | 'both'` to UserProfile interface — all downstream coach gating now has proper typing
- Seeded 22 coach.* keys + store.mandatory_tooltip in both fr and en i18n dictionaries — Wave 1 UI can use t() calls immediately
- Scaffolded complete plugins/coach package (package.json, tsconfig, manifest, index, stub screen, route wrapper) — Metro bundler resolves @ziko/plugin-coach/* imports at Wave 1 time

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix UserProfile.role type gap and seed all coach.* i18n keys** - `2605a1e` (feat)
2. **Task 2: Scaffold plugins/coach package and route wrapper** - `8fdb479` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `packages/plugin-sdk/src/types.ts` - Added role?: 'client' | 'coach' | 'both' to UserProfile
- `packages/plugin-sdk/src/i18n.ts` - Added 22 coach.* keys + store.mandatory_tooltip in fr and en
- `plugins/coach/package.json` - @ziko/plugin-coach workspace package with exports map
- `plugins/coach/tsconfig.json` - TypeScript config extending tsconfig.base.json
- `plugins/coach/src/manifest.ts` - PluginManifest default export: id 'coach', mandatory true, person-outline icon
- `plugins/coach/src/index.ts` - Re-exports coachManifest
- `plugins/coach/src/screens/CoachScreen.tsx` - Compilable stub (Wave 1 replaces with full implementation)
- `apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx` - Thin Expo Router wrapper importing CoachScreen
- `apps/mobile/package.json` - Added @ziko/plugin-coach: "*" dependency

## Decisions Made
- Coach plugin has no aiSkills or aiTools in Wave 0 manifest (empty arrays) — those are Wave 3 concerns
- plugins/coach tsconfig.json does not include creditStore.ts — no gamification dependency needed
- store.mandatory_tooltip placed adjacent to other store.* keys (not in coach.* block) per plan spec

## Deviations from Plan

None - plan executed exactly as written.

One note: added `@ziko/plugin-coach: "*"` to `apps/mobile/package.json` (not explicitly listed in the plan's file_modified list but required for Metro bundler to resolve the import in dashboard.tsx — same pattern as all other plugins). This is correctness, not scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `apps/mobile/app/(app)/ai/chat.tsx` (textAlign on View — TS2769) existed before Wave 0 changes and is out of scope. Confirmed by reverting changes and running type-check (same error).

## Known Stubs
- `plugins/coach/src/screens/CoachScreen.tsx` — intentional stub screen returning "Mon coach" text. Plan 29-03 (Wave 1) will replace this with the full implementation. The stub compiles clean and satisfies Wave 0's goal of making @ziko/plugin-coach/* importable.

## Threat Surface Scan
No new network endpoints, auth paths, or schema changes introduced. manifest.ts hardcodes mandatory: true with no mechanism for runtime mutation (T-29-02 mitigated). i18n keys use a single generic error string per the copywriting contract (T-29-01 mitigated).

## Next Phase Readiness
- Wave 1 (Plans 29-02, 29-03) can now import @ziko/plugin-coach/manifest and @ziko/plugin-coach/screens/CoachScreen without Metro resolution errors
- UserProfile.role type is available for PluginLoader auto-install logic and settings.tsx coach section gating
- All i18n keys ready for t() usage in CoachScreen full implementation

## Self-Check: PASSED
- packages/plugin-sdk/src/types.ts: FOUND role field
- packages/plugin-sdk/src/i18n.ts: FOUND 2 occurrences of coach.screen_title, 2 of store.mandatory_tooltip
- plugins/coach/src/manifest.ts: FOUND mandatory: true, id: 'coach'
- plugins/coach/src/screens/CoachScreen.tsx: FOUND
- apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx: FOUND with @ziko/plugin-coach import
- Commits 2605a1e and 8fdb479: FOUND in git log

---
*Phase: 29-plugin-mon-coach-full-impl*
*Completed: 2026-05-20*
