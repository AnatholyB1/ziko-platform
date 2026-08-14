---
phase: 07-ai-recipe-suggestions
plan: 07-03
subsystem: plugins/pantry
tags: [pantry, recipes, expo-router, i18n, typescript, wiring]
dependency_graph:
  requires: [07-02-PLAN.md, plugins/pantry/src/screens/PantryRecipes.tsx, plugins/pantry/src/screens/RecipeDetail.tsx]
  provides: [Expo Router pantry/recipes route, Expo Router pantry/recipe-detail route, all pantry recipe i18n keys, clean full monorepo type-check]
  affects: [apps/mobile app/(app)/(plugins)/pantry/, plugins/pantry/src/manifest.ts, packages/plugin-sdk/src/i18n.ts]
tech_stack:
  added: []
  patterns: [Expo Router thin wrapper pattern, central i18n key insertion, TSConfig JSX override pattern]
key_files:
  created:
    - apps/mobile/app/(app)/(plugins)/pantry/recipes.tsx
    - apps/mobile/app/(app)/(plugins)/pantry/recipe-detail.tsx
    - apps/mobile/src/types/declarations.d.ts
  modified:
    - plugins/pantry/package.json
    - plugins/pantry/src/manifest.ts
    - packages/plugin-sdk/src/i18n.ts
    - plugins/pantry/src/i18n/fr.ts
    - plugins/pantry/src/i18n/en.ts
    - plugins/rpe/tsconfig.json
    - packages/ai-client/tsconfig.json
    - backend/api/src/tools/ai-programs.ts
    - plugins/cardio/src/screens/CardioDetail.tsx
decisions:
  - Expo Router wrapper files use the identical thin-wrapper pattern from dashboard.tsx — imports screen + supabase, returns JSX, no additional logic
  - pantry.recipes_* and pantry.recipe_detail_* keys inserted after camera_required_desc in both FR and EN dicts — follows existing pantry key grouping convention
  - declarations.d.ts module declaration for datetimepicker placed in apps/mobile/src/types/ — picked up by existing src include glob without tsconfig changes
metrics:
  duration: "8 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 4
  files_changed: 9
---

# Phase 7 Plan 3: Route Wiring and i18n Summary

## One-liner

Wired PantryRecipes and RecipeDetail screens into Expo Router file system, registered two new routes in the pantry manifest (recipes tab-visible, recipe-detail hidden), and inserted 21 recipe i18n keys into the central plugin-sdk/src/i18n.ts (FR + EN) and reference copies; resolved 5 pre-existing TypeScript errors across the monorepo to achieve a clean full type-check.

## What Was Built

- `plugins/pantry/package.json` — exports map extended from 5 to 7 entries: `./screens/PantryRecipes` and `./screens/RecipeDetail` added
- `plugins/pantry/src/manifest.ts` — routes array extended from 3 to 5 entries: `recipes` (showInTabBar: true, icon: restaurant-outline) and `recipe-detail` (showInTabBar: false, icon: book-outline)
- `apps/mobile/app/(app)/(plugins)/pantry/recipes.tsx` — Expo Router wrapper: imports PantryRecipes from `@ziko/plugin-pantry/screens/PantryRecipes`, passes supabase client
- `apps/mobile/app/(app)/(plugins)/pantry/recipe-detail.tsx` — Expo Router wrapper: imports RecipeDetail from `@ziko/plugin-pantry/screens/RecipeDetail`, passes supabase client
- `packages/plugin-sdk/src/i18n.ts` — 21 `pantry.recipes_*` and `pantry.recipe_detail_*` keys added to both FR and EN dicts after `pantry.camera_required_desc`
- `plugins/pantry/src/i18n/fr.ts` and `en.ts` — reference copies updated with matching recipe keys

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update package.json exports map | b623f5e | plugins/pantry/package.json |
| 2a | Add routes to manifest.ts | f27ab78 | plugins/pantry/src/manifest.ts |
| 2b | Create Expo Router wrapper files | f27ab78 | apps/mobile/app/(app)/(plugins)/pantry/recipes.tsx, recipe-detail.tsx |
| 3 | Add recipe i18n keys | 0187a6a | packages/plugin-sdk/src/i18n.ts, plugins/pantry/src/i18n/fr.ts, en.ts |
| 4 | Full monorepo type-check (+ 5 pre-existing fixes) | f0a142b | plugins/rpe/tsconfig.json, packages/ai-client/tsconfig.json, backend/api/src/tools/ai-programs.ts, plugins/cardio/src/screens/CardioDetail.tsx, apps/mobile/src/types/declarations.d.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] plugins/rpe/tsconfig.json missing `jsx: react-native`**
- **Found during:** Task 4 (full type-check)
- **Issue:** `plugins/rpe` tsconfig extended base but did not override `jsx` setting. All other plugins had `"jsx": "react-native"` in their own tsconfig. This caused 65 TS17004 errors in RPECalculatorScreen.tsx.
- **Fix:** Added `"jsx": "react-native"` to `plugins/rpe/tsconfig.json`
- **Files modified:** `plugins/rpe/tsconfig.json`
- **Commit:** f0a142b

**2. [Rule 1 - Bug] packages/ai-client/tsconfig.json missing DOM lib**
- **Found during:** Task 4 (full type-check)
- **Issue:** `ai-client` package uses `XMLHttpRequest` for SSE streaming but tsconfig only had `"lib": ["ES2022"]` (from base). DOM types not in scope.
- **Fix:** Added `"lib": ["ES2022", "DOM"]` to `packages/ai-client/tsconfig.json`
- **Files modified:** `packages/ai-client/tsconfig.json`
- **Commit:** f0a142b

**3. [Rule 1 - Bug] ai-programs.ts using `maxTokens` instead of `maxOutputTokens`**
- **Found during:** Task 4 (full type-check)
- **Issue:** AI SDK v6 renamed `maxTokens` to `maxOutputTokens` in CallSettings. The `ai-programs.ts` tool still used the v3 name.
- **Fix:** Changed `maxTokens: 4000` to `maxOutputTokens: 4000`
- **Files modified:** `backend/api/src/tools/ai-programs.ts`
- **Commit:** f0a142b

**4. [Rule 1 - Bug] CardioDetail.tsx null narrowing issue on avg_pace_sec_per_km**
- **Found during:** Task 4 (full type-check)
- **Issue:** TypeScript strict mode could not narrow the null type of `session.avg_pace_sec_per_km` inside the `.every()` callback even though the outer condition checked `!= null`.
- **Fix:** Added `!` non-null assertion operator at the comparison site
- **Files modified:** `plugins/cardio/src/screens/CardioDetail.tsx`
- **Commit:** f0a142b

**5. [Rule 1 - Bug] apps/mobile: datetimepicker module not resolvable under bundler moduleResolution**
- **Found during:** Task 4 (full type-check)
- **Issue:** Mobile tsconfig uses `moduleResolution: bundler` with a `types: ["nativewind/types"]` restriction, which prevented auto-resolution of `@react-native-community/datetimepicker` types even though the package is installed with `src/index.d.ts`.
- **Fix:** Created `apps/mobile/src/types/declarations.d.ts` with a `declare module` block for the datetimepicker package, providing the types needed by PantryItemForm.tsx
- **Files modified:** `apps/mobile/src/types/declarations.d.ts` (created)
- **Commit:** f0a142b

## Known Stubs

None. All wiring is complete and functional:
- Expo Router wrappers import real screen components (PantryRecipes, RecipeDetail) built in plan 07-02
- All i18n keys resolve at runtime via the central plugin-sdk/src/i18n.ts
- Both routes are registered in the pantry manifest with correct showInTabBar values

## Self-Check: PASSED

- [x] `plugins/pantry/package.json` has 7 exports including `./screens/PantryRecipes` and `./screens/RecipeDetail`
- [x] `plugins/pantry/src/manifest.ts` has 5 route entries including `recipes` (showInTabBar: true, restaurant-outline) and `recipe-detail` (showInTabBar: false, book-outline)
- [x] `apps/mobile/app/(app)/(plugins)/pantry/recipes.tsx` exists — default exports PantryRecipesRoute
- [x] `apps/mobile/app/(app)/(plugins)/pantry/recipe-detail.tsx` exists — default exports RecipeDetailRoute
- [x] `packages/plugin-sdk/src/i18n.ts` contains `pantry.recipes_title` in both FR and EN dicts (grep count = 2)
- [x] `plugins/pantry/src/i18n/fr.ts` and `en.ts` reference copies contain matching recipe keys
- [x] `npm run type-check` exits 0 — all 20 packages successful
- [x] Commits b623f5e, f27ab78, 0187a6a, f0a142b exist in git log
