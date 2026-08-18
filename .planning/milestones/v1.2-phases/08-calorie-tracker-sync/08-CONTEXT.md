# Phase 8: Calorie Tracker Sync — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A user who has viewed a recipe in RecipeDetail can tap "I cooked this" (if nutrition plugin installed), arrive on a new RecipeConfirm screen with editable macro fields and a meal-type selector pre-filled from time of day, and confirm — which writes a row to `nutrition_logs` and decrements matched `pantry_items` quantities, then navigates to the Nutrition dashboard.

New capabilities NOT in scope: shopping list (Phase 9), AI-driven cooked-meal logging, nutrition goal personalisation, ingredient-level pantry editing from confirm screen.

</domain>

<decisions>
## Implementation Decisions

### Confirm UI Pattern

- **D-01:** "I cooked this" is a navigated screen — **new `RecipeConfirm` screen**, pushed via router from RecipeDetail. Recipe data + serving count passed as JSON route param (same pattern as RecipeDetail). NOT a modal / bottom sheet.
- **D-02:** RecipeConfirm layout:
  - Recipe name (read-only header)
  - Meal-type picker (Picker / segmented selector: `breakfast | lunch | dinner | snack`, pre-filled by time)
  - 4 editable macro fields: `calories` (int), `protein_g`, `carbs_g`, `fat_g` (numeric inputs, pre-filled from `adjustedMacros` at the selected serving count)
  - [Confirmer] primary button — logs + decrements + navigates
- **D-03:** Serving count from RecipeDetail is passed through to RecipeConfirm so macro pre-fill uses the already-scaled values (no re-scaling needed on the confirm screen).

### Nutrition Logging

- **D-04:** On confirm: insert one row into `nutrition_logs` with:
  - `food_name`: recipe name
  - `meal_type`: user-selected value (one of `breakfast | lunch | dinner | snack`)
  - `calories`, `protein_g`, `carbs_g`, `fat_g`: from editable fields (user may have tweaked them)
  - `date`: today (`new Date().toISOString().split('T')[0]`)
  - `user_id`: from Supabase auth session
- **D-05:** The Supabase insert uses the existing `supabase` client passed as a prop (same pattern as all other plugin screens). No backend endpoint needed — direct client insert with RLS.

### Pantry Quantity Decrement

- **D-06:** After nutrition log insert succeeds, attempt pantry decrement:
  - For each recipe ingredient, find a pantry item where `item.name.toLowerCase() === ingredient.name.toLowerCase()`. If no match, skip silently.
  - For matched items: `newQty = Math.max(0, item.quantity - scaledIngredientQty)`. Update via `supabase.from('pantry_items').update({ quantity: newQty }).eq('id', item.id)`.
  - Also update `usePantryStore.updateItem(id, { quantity: newQty })` for local state sync.
  - Decrement failures are non-blocking — if a pantry update fails, log the error but do NOT block navigation.
- **D-07:** Scaled ingredient quantity = `ingredient.quantity * (servings / recipe.base_servings)`. Both `servings` and `recipe.base_servings` are in the route param.

### Meal Type Pre-fill

- **D-08:** Time-of-day brackets (device local time via `new Date().getHours()`):
  - 6–10 (inclusive) → `breakfast`
  - 11–14 (inclusive) → `lunch`
  - 18–22 (inclusive) → `dinner`
  - all other hours → `snack`
- **D-09:** Meal type is **editable** on the confirm screen before submitting.

### Nutrition Plugin Gating

- **D-10:** "I cooked this" button on RecipeDetail is **hidden entirely** when the Nutrition plugin is not installed. Check by reading `userPlugins` from Supabase (`user_plugins` table, `plugin_id = 'nutrition'`, `is_enabled = true`). If not installed/enabled, button does not render — no tooltip, no fallback message.
- **D-11:** Plugin check happens when RecipeDetail mounts (one-time query on mount, not polled). Loading state: button hidden until check resolves (avoids flash of CTA).

### Navigation

- **D-12:** After successful confirm, navigate to `/(app)/(plugins)/nutrition/dashboard` using `router.replace` (not `push`) — so back-press from Nutrition goes to Pantry, not RecipeConfirm.

### Error Handling

- **D-13:** If the `nutrition_logs` insert fails (e.g. network error), show `showAlert` error message. Do NOT navigate away. Let user retry.
- **D-14:** Pantry decrement errors are silent (logged to console only) — nutrition log is the primary action; pantry sync is best-effort.

### Claude's Discretion

- Exact label/placeholder text for macro input fields (follow existing nutrition plugin patterns)
- Whether macro fields use `TextInput` with `keyboardType="numeric"` or a custom stepper
- Loading/spinner state on the [Confirmer] button during async operations
- i18n key naming for confirm screen (follow `pantry.*` namespace)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Screens to modify / create
- `plugins/pantry/src/screens/RecipeDetail.tsx` — add "I cooked this" CTA + nutrition plugin gate
- `plugins/pantry/src/screens/RecipeConfirm.tsx` — NEW screen (create)
- `plugins/pantry/src/store.ts` — `updateItem` already available for local quantity sync

### Navigation & routing
- `apps/mobile/app/(app)/(plugins)/pantry/` — add `confirm.tsx` wrapper (thin pattern from other wrapper files)
- `plugins/pantry/src/manifest.ts` — add RecipeConfirm route (`showInTabBar: false`)

### Database
- `supabase/migrations/003_nutrition_schema.sql` — `nutrition_logs` schema; `meal_type` enum: `breakfast | lunch | dinner | snack`
- `supabase/migrations/022_pantry_schema.sql` — `pantry_items` schema; `quantity` column to decrement

### Reference implementations
- `plugins/pantry/src/screens/PantryItemForm.tsx` — reference for navigated form screen pattern with Supabase write
- `plugins/nutrition/src/screens/NutritionDashboard.tsx` — understand navigation target structure
- `backend/api/src/tools/nutrition.ts` — reference for `nutrition_log_meal` logic (STATE.md note: direct import pattern)

### Plugin-SDK
- `CLAUDE.md` — `showAlert` API, `useTranslation`, paddingBottom: 100, Ionicons naming

### Requirements
- `.planning/REQUIREMENTS.md` — SYNC-01, SYNC-02, SYNC-03
- `.planning/ROADMAP.md` — Phase 8 success criteria (3 items)

</canonical_refs>
