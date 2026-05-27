---
plan: 39-03
phase: 39
subsystem: plugins/rpe + plugins/pantry
tags: [rpe, pantry, zustand, supabase, tanstack-query]
dependency_graph:
  requires: []
  provides: [RPEPlugin, PantryPlugin]
  affects: [apps/mobile/app/(app)/(plugins)/rpe, apps/mobile/app/(app)/(plugins)/pantry]
tech_stack:
  added: [zustand persist + AsyncStorage, @tanstack/react-query]
  patterns: [single-screen (RPE), 3-SubTabs (Pantry), rule-based match%]
key_files:
  created:
    - plugins/rpe/src/screens/RPEPlugin.tsx
    - plugins/rpe/src/store.ts
    - plugins/pantry/src/screens/PantryPlugin.tsx
  modified:
    - plugins/rpe/src/index.ts
    - plugins/rpe/package.json
    - plugins/pantry/src/index.ts
    - plugins/pantry/package.json
    - apps/mobile/app/(app)/(plugins)/rpe/index.tsx
    - apps/mobile/app/(app)/(plugins)/pantry/dashboard.tsx
  deleted:
    - plugins/rpe/src/screens/RPECalculatorScreen.tsx
    - plugins/pantry/src/screens/PantryDashboard.tsx
decisions:
  - "AsyncStorage used for RPE Zustand persist instead of react-native-mmkv (not installed in monorepo)"
  - "PantryPlugin uses storage_location field ('fridge'|'freezer'|'pantry') matching actual DB schema — mapped to Frigo/Congel/Placard labels"
  - "RPE_VALUES not used in RPE_CHIPS; custom RPE_CHIPS array used per mockup spec"
metrics:
  duration: ~30min
  completed: 2026-05-27
  tasks_completed: 3
  tasks_total: 3
  files_changed: 10
---

# Phase 39 Plan 03: RPE + Pantry Plugins Redesign Summary

**One-liner:** Dark 1RM big-number RPE calculator with Zustand persist + 3-tab Pantry plugin with category tiles, rule-based recipe match%, and shopping checklist.

## What Was Built

### Task 1: RPEPlugin.tsx + store.ts
- **RPEPlugin.tsx** — single screen (no SubTabs, per D-16), dark 1RM result card with `#1C1A17` background and `#FF5C1A` 56px fontWeight '900' 1RM number
- Three input rows: weight (±2.5kg), reps (±1 + REPS_CHIPS [1,2,3,4,5,6,8,10,12]), RPE (±0.5 + RPE_CHIPS [5,6,7,7.5,8,8.5,9,9.5,10])
- RPE chip colors: ≤6 `#2E9E5B`, ≤8 `#F59E0B`, >8 `#E94B3C`
- `useMemo` for real-time 1RM via `calc1RM`; `useEffect` to persist to store on every change
- TRAINING_ZONES table with current zone highlight (borderColor = primary when current pct matches zone)
- `useRpeStore` with zustand `persist` middleware using `AsyncStorage`

### Task 2: PantryPlugin.tsx
- 3 SubTabs: `Inventaire` / `Recettes` / `Shopping`
- **Inventaire**: 3 category tiles (Frigo/Congel/Placard) with `useQuery` counts from `pantry_items`, `AISuggestion` at bottom
- **Recettes**: 4 `RECIPE_STUBS` with rule-based match% (ingredient name matching), sorted DESC; chip badges ("Pret a cuisiner" / "Presque" / "-N ingr.")
- **Shopping**: `useQuery` from `shopping_list` table with graceful empty state, toggle-checked checklist, "Vider la liste" with `showAlert` confirmation
- All alerts via `showAlert` from `@ziko/plugin-sdk` (no `Alert.alert`)

### Task 3: Route wrappers + cleanup
- `rpe/index.tsx`: imports `RPEPlugin` (was `RPECalculatorScreen`)
- `pantry/dashboard.tsx`: imports `PantryPlugin` (was `PantryDashboard`)
- Both barrel exports updated; package.json exports updated
- `RPECalculatorScreen.tsx` and `PantryDashboard.tsx` deleted
- `BarcodeScanner.tsx`, `ShoppingList.tsx`, `RecipeDetail.tsx`, `PantryItemForm.tsx`, `PantryRecipes.tsx`, `RecipeConfirm.tsx` all untouched

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | `3629e4f` | feat(39-03): RPEPlugin.tsx — dark big-number 1RM card + Zustand persist |
| 2 | `3c62c53` | feat(39-03): PantryPlugin.tsx — 3 SubTabs Inventaire/Recettes/Shopping |
| 3 | `fa17c7d` | feat(39-03): wire route wrappers, update barrels, delete old dashboards |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AsyncStorage used instead of react-native-mmkv for RPE store persist**
- **Found during:** Task 1
- **Issue:** `react-native-mmkv` is not installed anywhere in the monorepo (checked root, apps/mobile, plugins). Using it would cause `TS2307: Cannot find module 'react-native-mmkv'`.
- **Fix:** Used `@react-native-async-storage/async-storage` (already installed at `apps/mobile/package.json`) with `zustand/middleware` `createJSONStorage`. Semantically equivalent — persists last weight/reps/rpe values between sessions.
- **Files modified:** `plugins/rpe/src/store.ts`
- **Commit:** `3629e4f`

**2. [Rule 2 - Schema mapping] PantryPlugin uses actual DB field `storage_location` not plan's `category`**
- **Found during:** Task 2
- **Issue:** Plan specified `category TEXT ('frigo'|'congelateur'|'placard')` but actual `PantryItem` type uses `storage_location: 'fridge' | 'freezer' | 'pantry'`. Tile IDs mapped to match real schema; both fields queried for backward compat.
- **Fix:** CATEGORIES ids set to `'fridge'`, `'freezer'`, `'pantry'` matching actual DB values; labels remain French (Frigo/Congel/Placard) as specified.
- **Files modified:** `plugins/pantry/src/screens/PantryPlugin.tsx`
- **Commit:** `3c62c53`

## Verification Results

All 10 acceptance criteria passed:
1. RPEPlugin exports default function RPEPlugin — PASS
2. PantryPlugin exports default function PantryPlugin — PASS
3. calc1RM imported in RPEPlugin — PASS
4. TRAINING_ZONES present in RPEPlugin — PASS
5. persist in store.ts — PASS
6. 3 categories (fridge/freezer/pantry) in PantryPlugin — PASS
7. RPECalculatorScreen.tsx deleted — PASS
8. PantryDashboard.tsx deleted — PASS
9. ShoppingList.tsx intact — PASS
10. AISuggestion present in PantryPlugin — PASS

TypeScript: 0 errors.

## Known Stubs

None — all data is either from Zustand (RPE values) or real Supabase queries (pantry_items, shopping_list). RECIPE_STUBS are intentional static fixtures per plan spec (D-19: rule-based match%, no AI call needed).

## Threat Flags

None — queries are scoped by `user_id` (T-39-03-01, T-39-03-02 mitigated). RPE store is local only (T-39-03-03 accepted). Recipe match% is frontend-only computation (T-39-03-04 accepted).

## Self-Check: PASSED

- `/c/ziko-platform/plugins/rpe/src/screens/RPEPlugin.tsx` — FOUND
- `/c/ziko-platform/plugins/rpe/src/store.ts` — FOUND
- `/c/ziko-platform/plugins/pantry/src/screens/PantryPlugin.tsx` — FOUND
- Commit `3629e4f` — FOUND
- Commit `3c62c53` — FOUND
- Commit `fa17c7d` — FOUND
