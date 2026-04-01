---
phase: 09-smart-shopping-list
plan: 02
subsystem: mobile-ui
tags: [react-native, zustand, supabase, pantry, shopping-list, expo-router]

# Dependency graph
requires:
  - phase: 09-smart-shopping-list
    plan: 01
    provides: shopping_list_items table + ShoppingListItem type + usePantryStore shopping slice
  - phase: 06-smart-inventory
    provides: pantry_items table + PantryItem type + usePantryStore
provides:
  - ShoppingList screen with two sections (low_stock / recipe), check-off, export, empty state
  - PantryTabBar shared component with 3 tabs (dashboard, recipes, shopping)
  - RecipeDetail "Ajouter à la liste" CTA with ingredient deduplication
affects:
  - 09-03 (Expo Router wrapper + tab registration for shopping screen)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared tab bar component pattern: extract inline tab bar to components/ for reuse across screens"
    - "Optimistic check-off: removeShoppingItem in store before async delete, re-add on error"
    - "Auto-populate on mount: low-stock pantry items inserted into shopping_list_items if not already present"

key-files:
  created:
    - plugins/pantry/src/components/PantryTabBar.tsx
    - plugins/pantry/src/screens/ShoppingList.tsx
  modified:
    - plugins/pantry/src/screens/RecipeDetail.tsx
    - plugins/pantry/src/screens/PantryDashboard.tsx
    - plugins/pantry/package.json

key-decisions:
  - "PantryTabBar extracted to shared component — both PantryDashboard and ShoppingList import from ../components/PantryTabBar"
  - "ShoppingList auto-populates low-stock items on every mount — dedup by pantry_item_id presence in existing list"
  - "handleAddToList silently returns when toInsert.length === 0 — no alert when all ingredients already in pantry or list"
  - "ShoppingList package.json export added proactively (Rule 3) — Expo Router wrapper in Plan 03 requires it"

# Metrics
duration: ~3min
completed: 2026-04-01
---

# Phase 9 Plan 02: Smart Shopping List — UI Screens Summary

**ShoppingList screen with two-section layout (low-stock / recipe), optimistic check-off + pantry restore, share export; PantryTabBar extracted as 3-tab shared component; RecipeDetail gets outline-style "Ajouter à la liste" CTA with pantry + list deduplication**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-01T10:54:04Z
- **Completed:** 2026-04-01T10:57:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `PantryTabBar.tsx` extracted from `PantryDashboard.tsx` inline definition into `plugins/pantry/src/components/PantryTabBar.tsx` with 3rd "Courses" tab added (dashboard / recettes / courses)
- `ShoppingList.tsx` created with: auto-population of low-stock pantry items on mount (dedup by `pantry_item_id`), two sections (rupture/bas stock + ingredients manquants), `ShoppingListItemRow` inline component, optimistic check-off with pantry quantity restore, share export (alphabetically sorted, plain text), full empty state with cart icon
- `RecipeDetail.tsx` receives `handleAddToList` function: fetches live shopping list from Supabase, filters out ingredients already in pantry (by name), deduplicates against existing shopping list (case-insensitive), inserts missing rows and updates Zustand store. Button always visible (D-06), outline style with cart icon.
- `package.json` updated with `ShoppingList` export (Rule 3 auto-fix — required for Plan 03 Expo Router wrapper)

## Task Commits

1. **Task 1: ShoppingList screen + shared PantryTabBar** - `220bcd4` (feat)
2. **Task 2: RecipeDetail "Ajouter à la liste" CTA** - `b805b6d` (feat)
3. **Deviation: package.json ShoppingList export** - `2f4894b` (chore)

## Files Created/Modified

- `plugins/pantry/src/components/PantryTabBar.tsx` — shared 3-tab bar component (dashboard, recettes, courses)
- `plugins/pantry/src/screens/ShoppingList.tsx` — shopping list screen with two sections, check-off, export
- `plugins/pantry/src/screens/RecipeDetail.tsx` — added handleAddToList + "Ajouter à la liste" button
- `plugins/pantry/src/screens/PantryDashboard.tsx` — updated to import PantryTabBar from shared component
- `plugins/pantry/package.json` — added ShoppingList screen export

## Decisions Made

- PantryTabBar extracted to shared component rather than duplicated — single source of truth for 3-tab navigation
- ShoppingList auto-populates on every mount (not just first load) — stays current with pantry changes
- `handleAddToList` returns silently when nothing to add — avoids confusing alerts when pantry is well-stocked
- Package.json export added immediately (Rule 3) to unblock Plan 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ShoppingList to pantry package.json exports**
- **Found during:** Task 1 review
- **Issue:** `plugins/pantry/package.json` exports all other screens but not ShoppingList — Plan 03's Expo Router wrapper will fail to import `@ziko/plugin-pantry/screens/ShoppingList` without this entry
- **Fix:** Added `"./screens/ShoppingList": "./src/screens/ShoppingList.tsx"` to exports
- **Files modified:** `plugins/pantry/package.json`
- **Commit:** `2f4894b`

## Known Stubs

None — all data flows are wired to live Supabase queries.

## Self-Check

Files created/modified:
- plugins/pantry/src/components/PantryTabBar.tsx — FOUND
- plugins/pantry/src/screens/ShoppingList.tsx — FOUND
- plugins/pantry/src/screens/RecipeDetail.tsx — FOUND (modified)
- plugins/pantry/src/screens/PantryDashboard.tsx — FOUND (modified)
- plugins/pantry/package.json — FOUND (modified)

Commits:
- 220bcd4 — feat(09-02): ShoppingList screen + shared PantryTabBar
- b805b6d — feat(09-02): add 'Ajouter à la liste' CTA to RecipeDetail
- 2f4894b — chore(09-02): export ShoppingList screen from pantry package.json
