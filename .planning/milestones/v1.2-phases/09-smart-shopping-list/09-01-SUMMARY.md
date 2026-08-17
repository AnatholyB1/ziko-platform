---
phase: 09-smart-shopping-list
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, zustand, typescript, pantry, shopping-list]

# Dependency graph
requires:
  - phase: 06-smart-inventory
    provides: pantry_items table + PantryItem type + usePantryStore — shopping list FKs to pantry_items
provides:
  - Supabase migration 023 creating shopping_list_items table with RLS
  - ShoppingListItem TypeScript interface and ShoppingItemSource type
  - Shopping list state slice appended to usePantryStore (shoppingItems, CRUD actions)
affects:
  - 09-02 (ShoppingList UI screen consumes shoppingItems + CRUD from this store)
  - 09-03 (RecipeDetail "Ajouter à la liste" CTA uses addShoppingItem from this store)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Store slice extension pattern: import new type, extend interface, add state+actions to create() call"
    - "Supabase source enum: CREATE TYPE AS ENUM for controlled vocabulary on nullable source column"

key-files:
  created:
    - supabase/migrations/023_shopping_list.sql
    - plugins/pantry/src/types/shopping.ts
  modified:
    - plugins/pantry/src/store.ts

key-decisions:
  - "shopping_list_items uses source enum ('low_stock' | 'recipe') matching D-07 context decision"
  - "pantry_item_id is nullable FK with ON DELETE SET NULL — recipe ingredients without pantry match have null pantry_item_id"
  - "Store slice appended to existing PantryStore — no rewrite, additive only"

patterns-established:
  - "Plugin type files in plugins/<name>/src/types/<feature>.ts — parallel to recipe.ts pattern"
  - "Store shopping slice: shoppingItems array with setShoppingItems, addShoppingItem (prepend), removeShoppingItem (filter)"

requirements-completed:
  - SHOP-01
  - SHOP-02
  - SHOP-03

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 9 Plan 01: Smart Shopping List — Data Foundation Summary

**Supabase migration 023 creates shopping_list_items table with RLS + source enum; TypeScript ShoppingListItem type and Zustand store slice wired into usePantryStore**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-01T10:50:29Z
- **Completed:** 2026-04-01T10:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration 023 defines `shopping_list_items` with FK to `pantry_items`, RLS policy enforcing `user_id = auth.uid()`, and `shopping_item_source` enum
- `plugins/pantry/src/types/shopping.ts` exports `ShoppingListItem` interface and `ShoppingItemSource` union type as the single source of truth for all UI and store code
- `usePantryStore` extended with a complete shopping list slice — any screen can load, add, and remove items without raw Supabase calls

## Task Commits

1. **Task 1: Supabase migration — shopping_list_items table** - `433d060` (feat)
2. **Task 2: TypeScript types and store slice** - `307d7fc` (feat)

## Files Created/Modified
- `supabase/migrations/023_shopping_list.sql` — CREATE TABLE shopping_list_items + shopping_item_source enum + RLS + user_id index
- `plugins/pantry/src/types/shopping.ts` — ShoppingListItem interface + ShoppingItemSource type
- `plugins/pantry/src/store.ts` — import ShoppingListItem, extend PantryStore interface, add shopping slice implementation

## Decisions Made
- Store slice is purely additive — existing pantry item and recipe slices are untouched
- `pantry_item_id` is nullable with `ON DELETE SET NULL` so recipe-ingredient rows survive if their pantry match is later deleted

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Migration must be applied to Supabase (standard deployment process).

## Next Phase Readiness
- Phase 09-02 (ShoppingList screen) can import `ShoppingListItem` from `./types/shopping.js` and `usePantryStore` for all CRUD
- Phase 09-03 (RecipeDetail "Ajouter à la liste") can call `addShoppingItem` directly from `usePantryStore`
- No blockers — data layer complete

---
*Phase: 09-smart-shopping-list*
*Completed: 2026-04-01*
