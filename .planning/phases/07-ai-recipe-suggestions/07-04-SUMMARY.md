---
phase: 07
plan: 04
subsystem: i18n
tags: [i18n, gap-closure, pantry, recipes]
dependency_graph:
  requires: [07-03]
  provides: [RECIPE-01, RECIPE-02, RECIPE-03, RECIPE-04]
  affects: [packages/plugin-sdk, plugins/pantry]
tech_stack:
  added: []
  patterns: [central-i18n-dict, reference-copy-mirror]
key_files:
  created: []
  modified:
    - packages/plugin-sdk/src/i18n.ts
    - plugins/pantry/src/i18n/fr.ts
    - plugins/pantry/src/i18n/en.ts
decisions:
  - "pantry.recipes_retry_btn mirrors pantry.recipes_retry value — both map to Réessayer/Try again for semantic distinction between error state label and button label"
  - "pantry.recipe_detail_back uses standard navigation labels (Retour/Back) consistent with existing back-navigation patterns"
metrics:
  duration: "2m"
  completed: "2026-03-29T10:15:13Z"
  tasks: 1
  files_modified: 3
---

# Phase 7 Plan 4: Missing i18n Keys Gap Closure Summary

**One-liner:** Added two missing pantry i18n keys (`recipes_retry_btn`, `recipe_detail_back`) to central runtime dictionary and both FR/EN reference copies, eliminating raw key string display on retry and back buttons.

## Objective

Close the single verification gap from Phase 07: two i18n keys used by `PantryRecipes.tsx` (line 302) and `RecipeDetail.tsx` (line 60) were missing from the central `plugin-sdk/src/i18n.ts` dictionary and both reference copies, causing buttons to render literal key strings instead of translated labels.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add missing i18n keys to central dict and reference copies | c6ea72c | packages/plugin-sdk/src/i18n.ts, plugins/pantry/src/i18n/fr.ts, plugins/pantry/src/i18n/en.ts |

## Changes Made

### packages/plugin-sdk/src/i18n.ts
- Added `'pantry.recipes_retry_btn': 'Réessayer'` after line 738 in FR dict
- Added `'pantry.recipe_detail_back': 'Retour'` after line 751 in FR dict (end of pantry section)
- Added `'pantry.recipes_retry_btn': 'Try again'` after line 1483 in EN dict
- Added `'pantry.recipe_detail_back': 'Back'` after line 1496 in EN dict (end of pantry section)

### plugins/pantry/src/i18n/fr.ts
- Added `'pantry.recipes_retry_btn': 'Réessayer'` after line 70
- Added `'pantry.recipe_detail_back': 'Retour'` after line 83 (end of file dict)

### plugins/pantry/src/i18n/en.ts
- Added `'pantry.recipes_retry_btn': 'Try again'` after line 70
- Added `'pantry.recipe_detail_back': 'Back'` after line 83 (end of file dict)

## Verification

- `grep "recipes_retry_btn" packages/plugin-sdk/src/i18n.ts` → 2 matches (FR + EN)
- `grep "recipe_detail_back" packages/plugin-sdk/src/i18n.ts` → 2 matches (FR + EN)
- `grep "recipes_retry_btn" plugins/pantry/src/i18n/fr.ts` → 1 match
- `grep "recipe_detail_back" plugins/pantry/src/i18n/fr.ts` → 1 match
- `grep "recipes_retry_btn" plugins/pantry/src/i18n/en.ts` → 1 match
- `grep "recipe_detail_back" plugins/pantry/src/i18n/en.ts` → 1 match
- `npm run type-check` → 20/20 tasks successful, 0 errors

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

Files exist and contain correct keys. Commit c6ea72c verified in git log.
