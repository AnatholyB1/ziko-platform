# Phase 10: Data Foundation + Tech Debt - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers the data foundation required for barcode-enriched nutrition logs and closes all v1.1 tech debt. No new UI is built in this phase. Specifically:

1. **SCAN data layer** — `food_products` Supabase table (shared catalogue), `offApi.ts` utility with get-or-fetch caching, nullable FK + score columns added to `nutrition_logs`
2. **DEBT-01** — `handleCheckOffRecipe` in ShoppingList: prompt "how much did you buy?", then insert or restock pantry
3. **DEBT-02** — `handleCheckOffPantry` in ShoppingList: prompt for quantity instead of silently restoring to threshold+1
4. **DEBT-03** — Register `pantry_log_recipe_cooked` in `registry.ts`, remove direct Supabase calls from `RecipeConfirm.tsx`
5. **DEBT-04** — Write VALIDATION.md for phases 06–09 (documentation-only; cross-check live state against plans)

Phase 11 builds all UI surfaces on top of this stable foundation.

</domain>

<decisions>
## Implementation Decisions

### Quantity Prompt UX (DEBT-01, DEBT-02)

- **D-01:** Use an inline React Native `Modal` overlay for quantity input — contains a `TextInput` (numeric), unit label, and confirm/cancel buttons. No new screen or navigation required.
- **D-02:** If the user cancels the modal without entering a quantity, the shopping list item stays in the list. No pantry update is made. The item remains available for the user to tap again later.

### DEBT-01 Pantry Update Logic (Recipe Ingredients)

- **D-03:** When a recipe ingredient is checked off and `pantry_item_id` is **not null** (match exists): update the existing pantry item's quantity to `existing_qty + purchased_qty`.
- **D-04:** When a recipe ingredient is checked off and `pantry_item_id` is **null** (no pantry match): insert a new `pantry_items` row using the ingredient name, purchased quantity, and unit from the shopping list item. The user builds their pantry organically from shopping.

### DEBT-02 Low-Stock Pantry Item Restock

- **D-05:** After the user enters purchased quantity for a low-stock pantry item, set the item's quantity to the purchased amount directly (not existing + purchased, not threshold+1). `new_qty = purchased_qty`.

### DEBT-03 RecipeConfirm Migration

- **D-06:** Implement `pantry_log_recipe_cooked` as a function in `backend/api/src/tools/pantry.ts`. It imports `nutrition_log_meal` from `./nutrition.js` — no HTTP round-trip for the inner nutrition log.
- **D-07:** Register the tool in `registry.ts` with three coordinated edits: (1) add import from `./pantry.js`, (2) add executor to `executors` record, (3) add schema to `allToolSchemas` array. All three must be present — missing any one causes silent failure.
- **D-08:** `RecipeConfirm.tsx` calls `POST /ai/tools/execute` with `{ tool: 'pantry_log_recipe_cooked', params: { recipe, servings, meal_type, macros_override } }` — reuses existing infrastructure, no new endpoint.

### Claude's Discretion

- `getOrFetchProduct(barcode, supabase)` utility location: frontend utility in `plugins/nutrition/src/utils/offApi.ts`, following the `barcode.ts` pattern from the pantry plugin. Takes `supabase` as a parameter (standard plugin pattern).
- `food_products` table schema: minimal set sufficient for Phase 11 (SCORE-01) — `barcode`, `name`, `brand`, `macros per 100g` (energy_kcal, proteins_g, carbs_g, fat_g), `nutriscore_grade`, `ecoscore_grade`, `image_url`, `serving_size_g` (parsed integer, default 100). No user_id.
- DEBT-04 VALIDATION.md: read each phase's plan files and cross-check against live app state before writing. Treat as documentation — no code changes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Critical Architecture Notes (v1.2)
- `.planning/STATE.md` §Blockers/Concerns and §Decisions — v1.2 architectural decisions; food_products RLS pattern, pantry_log_recipe_cooked 3-touch-point rule, offApi.ts URL, ecoscore edge cases

### Screens to Modify
- `plugins/pantry/src/screens/ShoppingList.tsx` — existing `handleCheckOffPantry` and `handleCheckOffRecipe` handlers (DEBT-01, DEBT-02)
- `plugins/pantry/src/screens/RecipeConfirm.tsx` — direct Supabase calls to remove (DEBT-03)

### Backend Tools
- `backend/api/src/tools/registry.ts` — 3-touch-point registration pattern; all existing registrations are the model
- `backend/api/src/tools/pantry.ts` — add `pantry_log_recipe_cooked` here
- `backend/api/src/tools/nutrition.ts` — `nutrition_log_meal` function to import (no HTTP round-trip)

### Database Schema
- `supabase/migrations/003_nutrition_schema.sql` — `nutrition_logs` table to extend with nullable `food_product_id`, `nutriscore_grade`, `ecoscore_grade`
- `.planning/STATE.md` — RLS note: `food_products` uses `auth.role() = 'authenticated'` (NOT `auth.uid() = user_id` — shared catalogue pattern)

### Reference Utility
- `plugins/pantry/src/utils/barcode.ts` — existing OFF API utility pattern (uses `.net` staging URL; new `offApi.ts` for nutrition uses `world.openfoodfacts.org` production — intentionally separate, do NOT merge)

### Project Conventions
- `CLAUDE.md` — `showAlert` (never `Alert.alert`), no StyleSheet, NativeWind, Ionicons, plugin-sdk patterns

</canonical_refs>

<specifics>
## Specific Implementation Notes

- `offApi.ts` must point to `https://world.openfoodfacts.org/api/v2/product/{barcode}` — production URL. Fields to request: `product_name,product_name_fr,nutriments,nutriscore_grade,ecoscore_grade,image_front_small_url,serving_size,brands`
- `ecoscore_grade` can return `'a-plus'` and `'not-applicable'` — handle before any render or insert; map `'a-plus'` → store as `'a-plus'`; skip insert for `'not-applicable'` or unknown values (store as null)
- `serving_size` is free text in OFF API — extract grams via regex `/([\d.]+)\s*g/i`, default to `100` on failure; never let NaN reach macro calculation or DB insert
- `nutrition_logs.food_product_id` FK is nullable — manual log entries must continue to work unchanged
- `food_products` RLS: `auth.role() = 'authenticated'` on both SELECT and INSERT — not the standard `auth.uid() = user_id` pattern used in all 23 prior migrations
- The quantity Modal in ShoppingList should show the unit alongside the TextInput (e.g., "100 g" hint) — units come from `shopping_list_items.unit` (recipe items) or `pantry_items.unit` (low-stock items)

</specifics>

<deferred>
## Deferred Ideas

None — PRD covers phase scope.

</deferred>

---

*Phase: 10-data-foundation-tech-debt*
*Context gathered: 2026-04-02 via /gsd:discuss-phase*
