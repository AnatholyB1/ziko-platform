---
phase: 08-calorie-tracker-sync
plan: 02
subsystem: ui
tags: [expo-router, react-native, supabase, plugin-system, navigation]

# Dependency graph
requires:
  - phase: 08-01
    provides: RecipeConfirm screen with supabase prop and route param contracts
provides:
  - RecipeDetail CTA button gated on nutrition plugin installation check
  - confirm.tsx Expo Router thin wrapper for the RecipeConfirm route
  - pantry manifest route registration for /(plugins)/pantry/confirm
  - package.json export for @ziko/plugin-pantry/screens/RecipeConfirm
affects:
  - 08-03 (i18n keys — pantry.cooked_this_cta must resolve at runtime)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nutrition plugin gate: query user_plugins with .maybeSingle() — renders nothing when null (loading) or false (not installed)"
    - "CTA only renders when nutritionInstalled === true — no disabled state, no flash"

key-files:
  created:
    - apps/mobile/app/(app)/(plugins)/pantry/confirm.tsx
  modified:
    - plugins/pantry/src/screens/RecipeDetail.tsx
    - plugins/pantry/src/manifest.ts
    - plugins/pantry/package.json

key-decisions:
  - "Use .maybeSingle() not .single() for nutrition plugin check — .single() throws PGRST116 when row absent, producing console errors for users without nutrition plugin"
  - "CTA hidden (not disabled) when nutritionInstalled is null or false — prevents CTA flash during async load"
  - "Added ./screens/RecipeConfirm export to package.json — was missing from Plan 01 and blocked confirm.tsx import resolution"

patterns-established:
  - "Plugin gate pattern: useState<boolean | null>(null) with useEffect querying user_plugins — null=loading, true=installed, false=not installed"

requirements-completed:
  - SYNC-01

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 08 Plan 02: Calorie Tracker Sync — CTA Gate + Routing Summary

**RecipeDetail gated CTA wiring: nutrition-plugin check via .maybeSingle(), confirm.tsx thin wrapper, and manifest route registration completing recipe-to-confirm navigation path**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T00:00:00Z
- **Completed:** 2026-03-30T00:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `nutritionInstalled` state to RecipeDetail with async `user_plugins` check using `.maybeSingle()` — no PGRST116 errors for users without nutrition plugin
- CTA "J'ai cuisiné ca" button renders only when `nutritionInstalled === true`, preventing loading flash
- Created `confirm.tsx` thin Expo Router wrapper following the `recipe-detail.tsx` pattern exactly
- Registered `/(plugins)/pantry/confirm` route in pantry manifest with `showInTabBar: false`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add nutrition plugin gate and CTA to RecipeDetail** - `5cd5b00` (feat)
2. **Task 2: Expo Router wrapper + manifest route** - `8fc86a3` (feat)

**Plan metadata:** (in final docs commit)

## Files Created/Modified
- `plugins/pantry/src/screens/RecipeDetail.tsx` - Added nutritionInstalled state, useEffect gate query, and CTA button navigating to confirm route
- `apps/mobile/app/(app)/(plugins)/pantry/confirm.tsx` - New thin Expo Router wrapper rendering RecipeConfirm
- `plugins/pantry/src/manifest.ts` - Added confirm route entry with showInTabBar: false
- `plugins/pantry/package.json` - Added ./screens/RecipeConfirm export entry

## Decisions Made
- Used `.maybeSingle()` not `.single()` for nutrition plugin check — `.single()` throws PGRST116 error when the row does not exist (nutrition plugin not installed), which would log an error on every RecipeDetail mount for users without the plugin
- CTA is hidden (not disabled) during loading — `nutritionInstalled` starts as `null`, renders nothing until resolved to `true`; no CTA flash when plugin check resolves to `false`
- Added `./screens/RecipeConfirm` export to `plugins/pantry/package.json` — this export was missing from Plan 01 and was blocking TypeScript module resolution for `confirm.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing RecipeConfirm export to package.json**
- **Found during:** Task 2 (Expo Router wrapper + manifest route)
- **Issue:** `plugins/pantry/package.json` did not have `./screens/RecipeConfirm` in its exports map; TypeScript error TS2307 "Cannot find module '@ziko/plugin-pantry/screens/RecipeConfirm'" blocked confirm.tsx compilation
- **Fix:** Added `"./screens/RecipeConfirm": "./src/screens/RecipeConfirm.tsx"` to the exports field
- **Files modified:** `plugins/pantry/package.json`
- **Verification:** `npx tsc --noEmit -p apps/mobile/tsconfig.json` exits 0 after fix
- **Committed in:** `8fc86a3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to resolve TypeScript module resolution. No scope creep — the file existed, only the package.json export entry was missing.

## Issues Encountered
None beyond the auto-fixed export entry.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Navigation path from RecipeDetail → confirm route is fully wired
- Plan 03 (i18n keys) must add `pantry.cooked_this_cta` to both FR and EN sections of plugin-sdk/src/i18n.ts before the CTA label resolves at runtime
- All three files compile without TypeScript errors — ready for Plan 03

## Known Stubs
None — CTA button is fully wired to navigation. The `pantry.cooked_this_cta` translation key is intentionally absent until Plan 03 adds it to the central i18n dictionary.

---
*Phase: 08-calorie-tracker-sync*
*Completed: 2026-03-30*
