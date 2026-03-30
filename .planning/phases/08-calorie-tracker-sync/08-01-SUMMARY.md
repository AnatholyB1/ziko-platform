---
phase: 08-calorie-tracker-sync
plan: "01"
subsystem: pantry-plugin
tags: [calorie-sync, pantry, nutrition, react-native, supabase]
dependency_graph:
  requires:
    - plugins/pantry/src/types/recipe.ts
    - plugins/pantry/src/store.ts
    - "@ziko/plugin-sdk (useThemeStore, useTranslation, showAlert)"
    - supabase nutrition_logs table (migration 003)
    - supabase pantry_items table
  provides:
    - plugins/pantry/src/screens/RecipeConfirm.tsx
  affects:
    - 08-02 (RecipeDetail confirm button navigation target)
    - 08-03 (Expo Router wrapper for confirm screen)
tech_stack:
  added: []
  patterns:
    - JSON route params via useLocalSearchParams (same as RecipeDetail)
    - Per-ingredient best-effort try/catch for pantry decrement
    - router.replace for cross-plugin navigation (confirm not in back-stack)
    - parseInt for INTEGER columns, parseFloat for NUMERIC(6,1) columns
    - Time-of-day meal-type pre-fill
key_files:
  created:
    - plugins/pantry/src/screens/RecipeConfirm.tsx
  modified: []
decisions:
  - "calories uses parseInt(str, 10) — nutrition_logs.calories is INTEGER, not NUMERIC"
  - "Pantry decrement is per-ingredient try/catch — ingredient failures are independent and non-blocking"
  - "router.replace (not push) ensures confirm screen is removed from back-stack post-confirm"
  - "Meal-type pre-filled by time of day via getMealTypeForHour — reduces friction for common meal logging"
  - "showAlert from @ziko/plugin-sdk per CLAUDE.md convention — not Alert from react-native"
metrics:
  duration: "1m 18s"
  completed_date: "2026-03-30"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 08 Plan 01: RecipeConfirm Screen Summary

**One-liner:** Confirm screen that inserts scaled recipe macros to nutrition_logs and decrements matched pantry items best-effort, then navigates cross-plugin via router.replace.

## What Was Built

`plugins/pantry/src/screens/RecipeConfirm.tsx` — a complete standalone React Native screen that:

1. Parses `recipe` (JSON) and `servings` (integer string) from Expo Router route params
2. Pre-fills macro fields (calories, protein, carbs, fat) at the scaled ratio (`servings / base_servings`)
3. Shows a 4-option meal-type segmented selector pre-filled by current time of day (breakfast 6-10, lunch 11-14, dinner 18-22, snack otherwise)
4. On confirm: inserts one row to `nutrition_logs` with `parseInt` for calories and `parseFloat` for gram values
5. Runs per-ingredient pantry decrement — each ingredient has its own try/catch so individual failures are non-blocking
6. On success: `router.replace('/(app)/(plugins)/nutrition/dashboard')` — confirm screen not in back-stack
7. On nutrition insert failure: `showAlert` error shown, stays on screen for retry

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create RecipeConfirm screen | 85f3b82 | plugins/pantry/src/screens/RecipeConfirm.tsx |

## Verification

- `plugins/pantry/src/screens/RecipeConfirm.tsx` exists
- `npx tsc --noEmit` on apps/mobile: no errors referencing RecipeConfirm.tsx
- `calories: parseInt(calories, 10)` — INTEGER column
- `protein_g: parseFloat(protein)`, `carbs_g: parseFloat(carbs)`, `fat_g: parseFloat(fat)` — NUMERIC(6,1) columns
- `router.replace('/(app)/(plugins)/nutrition/dashboard' as any)` — NOT router.push
- Each pantry decrement in its own try/catch — outer catch only handles nutrition insert failure
- `showAlert` from `@ziko/plugin-sdk` — NOT Alert from react-native
- `paddingBottom: 100` on ScrollView contentContainerStyle
- Meal-type segmented selector: 4 options — 'breakfast' | 'lunch' | 'dinner' | 'snack'

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to live Supabase inserts and Zustand store updates.

## Self-Check: PASSED
