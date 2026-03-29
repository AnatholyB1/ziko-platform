---
phase: 07-ai-recipe-suggestions
verified: 2026-03-29T14:00:00Z
status: gaps_found
score: 13/15 must-haves verified
gaps:
  - truth: "All pantry.recipes_* and pantry.recipe_detail_* i18n keys resolve in both French and English"
    status: failed
    reason: "Two i18n keys are used in screen components but missing from packages/plugin-sdk/src/i18n.ts and both reference copies"
    artifacts:
      - path: "plugins/pantry/src/screens/PantryRecipes.tsx"
        issue: "Line 302 uses t('pantry.recipes_retry_btn') — only 'pantry.recipes_retry' exists in i18n.ts"
      - path: "plugins/pantry/src/screens/RecipeDetail.tsx"
        issue: "Line 60 uses t('pantry.recipe_detail_back') — key not defined anywhere in i18n.ts"
    missing:
      - "Add 'pantry.recipes_retry_btn' key to FR and EN dicts in packages/plugin-sdk/src/i18n.ts (FR: 'Réessayer', EN: 'Try again')"
      - "Add 'pantry.recipe_detail_back' key to FR and EN dicts in packages/plugin-sdk/src/i18n.ts (FR: 'Retour', EN: 'Back')"
      - "Mirror both keys to reference copies plugins/pantry/src/i18n/fr.ts and en.ts"
human_verification:
  - test: "Tap 'Suggérer des recettes' with a valid session and verify 3 recipe cards appear"
    expected: "Three recipe cards appear with name, description, prep time, ingredient count, calories"
    why_human: "Requires live Anthropic API call with valid JWT — cannot mock from static codebase check"
  - test: "Tap a recipe card and verify serving stepper recalculates macros"
    expected: "Incrementing servings from 2 to 4 doubles all macro values displayed"
    why_human: "Runtime behavior of React state + arithmetic — visual verification needed"
  - test: "Verify 'Recettes IA' tab is visible in the pantry plugin tab bar"
    expected: "A tab labeled 'Recettes IA' with restaurant-outline icon appears in the pantry plugin's bottom tab bar"
    why_human: "Requires running Expo app — tab bar rendering depends on PluginLoader registration"
---

# Phase 7: AI Recipe Suggestions — Verification Report

**Phase Goal:** Implement AI-powered recipe suggestions feature for the pantry plugin — backend endpoint generating macro-aware French recipes from pantry contents, two frontend screens (PantryRecipes + RecipeDetail), serving adjustment, and full i18n wiring.
**Verified:** 2026-03-29
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /pantry/recipes/suggest returns `{ recipes: Recipe[], remaining_macros }` on success | VERIFIED | `pantry-recipes.ts` line 112: `return c.json({ recipes: object.recipes, remaining_macros })` |
| 2 | Each recipe has id, name, description, prep_time_min, base_servings, ingredients[], macros, steps[] | VERIFIED | `RecipeSchema` Zod definition covers all fields; `Recipe` interface mirrors exactly |
| 3 | remaining_macros reflects today's consumed nutrition subtracted from 2000/150/250/65 defaults | VERIFIED | Lines 66-78: parallel fetch + `Math.max(0, DAILY_TARGETS.x - consumed.x)` per field |
| 4 | Endpoint returns 500 with user-friendly message if AI generation fails | VERIFIED | `NoObjectGeneratedError` catch returns 500 with French message (line 114-117) |
| 5 | Endpoint is protected — unauthenticated requests return 401 | VERIFIED | `router.use('*', authMiddleware)` — same auth pattern as all other protected routes |
| 6 | PantryRecipes screen shows 'Suggérer des recettes' button and calls POST /pantry/recipes/suggest on tap | VERIFIED | Button at line 223-237; `fetchSuggestions` at line 156 fetches `EXPO_PUBLIC_API_URL/pantry/recipes/suggest` with Bearer token |
| 7 | PantryRecipes shows macro budget banner with remaining cal/protein/carbs/fat from API response | VERIFIED | Lines 239-256: `remainingMacros !== null` guard + 4 `MacroPill` components with API response data |
| 8 | PantryRecipes shows 3 recipe cards after successful API call, each with name, description, prep time, ingredient count, calories | VERIFIED | `RecipeCard` component lines 78-122: all 5 data points rendered |
| 9 | Tapping a recipe card navigates to RecipeDetail, passing the full recipe as a JSON-encoded route param | VERIFIED | `navigateToDetail` at lines 185-190: `router.push` with `pathname: '/(plugins)/pantry/recipe-detail'` and `params: { recipe: JSON.stringify(recipe) }` |
| 10 | RecipeDetail shows full ingredient list with quantities, macro breakdown, and cooking steps | VERIFIED | RecipeDetail.tsx: ingredients section lines 204-241, macros 148-202, steps 243-291 |
| 11 | RecipeDetail serving stepper (1–8) recalculates displayed macros client-side | VERIFIED | `ratio = servings / recipe.base_servings`; `adjustedMacros` recomputes on every render (lines 29-35); stepper range enforced at 1/8 (lines 25-26) |
| 12 | Loading state shows animated skeleton cards; error state shows message with retry button | VERIFIED | `SkeletonCard` with `Animated.loop` (lines 23-56); error branch lines 285-305 |
| 13 | The pantry plugin has a 'Recettes IA' tab visible in the plugin tab bar (showInTabBar: true) | VERIFIED | `manifest.ts` line 99-103: `path: '/(plugins)/pantry/recipes'`, `showInTabBar: true`, `icon: 'restaurant-outline'` |
| 14 | Expo Router can navigate to /(plugins)/pantry/recipes and /(plugins)/pantry/recipe-detail | VERIFIED | Both wrapper files exist at `apps/mobile/app/(app)/(plugins)/pantry/recipes.tsx` and `recipe-detail.tsx`; package.json exports map includes both entries |
| 15 | All pantry.recipes_* and pantry.recipe_detail_* i18n keys resolve in both French and English | FAILED | Two keys used by screens are absent from i18n.ts: `pantry.recipes_retry_btn` and `pantry.recipe_detail_back` — at runtime these render as raw key strings |

**Score: 13/15 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/api/src/routes/pantry-recipes.ts` | POST /recipes/suggest Hono route | VERIFIED | 122 lines, exports `pantryRecipesRouter`, real DB queries + `generateObject` |
| `backend/api/src/app.ts` | Route mount at /pantry | VERIFIED | Line 10: import; line 48: `app.route('/pantry', pantryRecipesRouter)` |
| `backend/api/package.json` | zod dependency | VERIFIED | `"zod": "^4.3.6"` in dependencies |
| `plugins/pantry/src/types/recipe.ts` | RecipeIngredient, RecipeMacros, Recipe, MacroBudget | VERIFIED | 30 lines, all 4 interfaces exported |
| `plugins/pantry/src/store.ts` | Extended PantryStore with recipe state | VERIFIED | `recipes: Recipe[]`, `recipesLoading`, `recipesError`, 3 setters |
| `plugins/pantry/src/screens/PantryRecipes.tsx` | Recipe suggestions screen (280+ lines) | VERIFIED | 332 lines, fully implemented with all required UI states |
| `plugins/pantry/src/screens/RecipeDetail.tsx` | Recipe detail + serving adjuster (230+ lines) | VERIFIED | 295 lines, full implementation |
| `plugins/pantry/package.json` | Exports map with PantryRecipes and RecipeDetail | VERIFIED | 7 exports total; `./screens/PantryRecipes` and `./screens/RecipeDetail` present |
| `plugins/pantry/src/manifest.ts` | Two new routes: recipes + recipe-detail | VERIFIED | 5 routes total; recipes (showInTabBar: true, restaurant-outline), recipe-detail (showInTabBar: false, book-outline) |
| `apps/mobile/app/(app)/(plugins)/pantry/recipes.tsx` | Expo Router wrapper for PantryRecipes | VERIFIED | Imports `PantryRecipes` from `@ziko/plugin-pantry/screens/PantryRecipes`, passes supabase |
| `apps/mobile/app/(app)/(plugins)/pantry/recipe-detail.tsx` | Expo Router wrapper for RecipeDetail | VERIFIED | Imports `RecipeDetail` from `@ziko/plugin-pantry/screens/RecipeDetail`, passes supabase |
| `packages/plugin-sdk/src/i18n.ts` | All pantry.recipes_* and pantry.recipe_detail_* keys in fr and en | PARTIAL | 19/21 defined keys present in both dicts; missing `pantry.recipes_retry_btn` and `pantry.recipe_detail_back` |
| `plugins/pantry/src/i18n/fr.ts` | Reference copy of recipe FR keys | PARTIAL | Same 19/21 keys present; `pantry.recipes_retry_btn` and `pantry.recipe_detail_back` absent |
| `plugins/pantry/src/i18n/en.ts` | Reference copy of recipe EN keys | PARTIAL | Same 19/21 keys present; `pantry.recipes_retry_btn` and `pantry.recipe_detail_back` absent |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pantry-recipes.ts` | `tools/db.js` | `clientForUser` import | WIRED | Line 6: `import { clientForUser } from '../tools/db.js'`; line 51: `clientForUser(userToken)` |
| `pantry-recipes.ts` | `claude-sonnet-4-20250514` | `generateObject` call | WIRED | Lines 104-111: `generateObject({ model: anthropic('claude-sonnet-4-20250514'), schema: ResponseSchema, ... })` |
| `app.ts` | `routes/pantry-recipes.js` | `app.route('/pantry', pantryRecipesRouter)` | WIRED | Line 10 import + line 48 mount confirmed |
| `PantryRecipes.tsx` | `POST /pantry/recipes/suggest` | fetch with Authorization header | WIRED | Lines 156-166: `fetch(EXPO_PUBLIC_API_URL/pantry/recipes/suggest, { method: 'POST', headers: { Authorization: Bearer... } })` |
| `PantryRecipes.tsx` | `RecipeDetail.tsx` | `router.push` with JSON.stringify(recipe) param | WIRED | Lines 186-190: `router.push({ pathname: '/(plugins)/pantry/recipe-detail', params: { recipe: JSON.stringify(recipe) } })` |
| `RecipeDetail.tsx` | `types/recipe.ts` | Recipe interface import | WIRED | Line 7: `import type { Recipe } from '../types/recipe.js'`; used at line 20 |
| `recipes.tsx` (wrapper) | `PantryRecipes.tsx` | `import PantryRecipes from '@ziko/plugin-pantry/screens/PantryRecipes'` | WIRED | Package exports map confirmed; wrapper passes supabase prop |
| `recipe-detail.tsx` (wrapper) | `RecipeDetail.tsx` | `import RecipeDetail from '@ziko/plugin-pantry/screens/RecipeDetail'` | WIRED | Package exports map confirmed; wrapper passes supabase prop |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PantryRecipes.tsx` | `recipes` (from Zustand store) | `setRecipes(data.recipes)` after `fetch POST /pantry/recipes/suggest` | Yes — fetched from live AI generation endpoint with auth | FLOWING |
| `PantryRecipes.tsx` | `remainingMacros` | `setRemainingMacros(data.remaining_macros)` from same fetch response | Yes — computed server-side from real Supabase nutrition_logs query | FLOWING |
| `RecipeDetail.tsx` | `recipe` (from route param) | `JSON.parse(recipeStr)` from `useLocalSearchParams` | Yes — passed as JSON from PantryRecipes navigation | FLOWING |
| `RecipeDetail.tsx` | `adjustedMacros` | `servings / recipe.base_servings * macros` client-side | Yes — pure math from real recipe data | FLOWING |
| `pantry-recipes.ts` | `pantryItems` | `db.from('pantry_items').select(...)` | Yes — real Supabase query with RLS via `clientForUser(userToken)` | FLOWING |
| `pantry-recipes.ts` | `meals` (nutrition) | `db.from('nutrition_logs').select(...)` | Yes — real Supabase query filtered by userId + today | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pantryRecipesRouter` exports from pantry-recipes.ts | `grep "export { router as pantryRecipesRouter }" pantry-recipes.ts` | Found at line 122 | PASS |
| Route mounted in app.ts | `grep "app.route.*pantry" app.ts` | `app.route('/pantry', pantryRecipesRouter)` at line 48 | PASS |
| zod resolves in backend | `node -e "require('zod')"` | exits 0, "zod ok" | PASS |
| pantry package.json has 7 exports | node -e inspect exports | 7 exports confirmed | PASS |
| Full monorepo type-check | `npm run type-check` | 20 successful, 0 errors | PASS |
| i18n key `pantry.recipes_retry_btn` present | `grep "recipes_retry_btn" i18n.ts` | Not found | FAIL |
| i18n key `pantry.recipe_detail_back` present | `grep "recipe_detail_back" i18n.ts` | Not found | FAIL |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| RECIPE-01 | 07-01, 07-02, 07-03 | User can request AI recipe suggestions based on available pantry items | SATISFIED | Backend fetches `pantry_items` and passes to Claude; PantryRecipes screen calls endpoint and displays cards |
| RECIPE-02 | 07-01, 07-02, 07-03 | User can request macro-gap-filling recipe suggestions based on remaining daily macros + pantry | SATISFIED | `remaining_macros` computed from `nutrition_logs` vs DAILY_TARGETS; injected into Claude prompt; returned and displayed as macro budget banner |
| RECIPE-03 | 07-02, 07-03 | User can view a suggested recipe's full details — ingredients, macro breakdown, cooking steps | SATISFIED | RecipeDetail.tsx renders all fields: ingredients with scaled quantities, 4-chip macro card, numbered steps |
| RECIPE-04 | 07-02, 07-03 | User can adjust serving size and see recalculated macros before logging | SATISFIED | Serving stepper 1–8 in RecipeDetail; `ratio = servings / base_servings`; all macro values and ingredient quantities recomputed inline on every state change |

All 4 requirement IDs from REQUIREMENTS.md Phase 7 mapping are accounted for. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `plugins/pantry/src/screens/PantryRecipes.tsx` | 302 | `t('pantry.recipes_retry_btn')` — key missing from i18n | Warning | Retry button displays raw key string `pantry.recipes_retry_btn` instead of translated text |
| `plugins/pantry/src/screens/RecipeDetail.tsx` | 60 | `t('pantry.recipe_detail_back')` — key missing from i18n | Warning | Back button label displays raw key string `pantry.recipe_detail_back` instead of "Retour"/"Back" |

No structural stubs, placeholder components, or empty API returns. Both screens are substantively implemented with real data flows.

---

## Human Verification Required

### 1. AI Recipe Generation Live Test

**Test:** With a valid authenticated session and at least 3–5 items in the pantry, tap "Suggérer des recettes" on the Recettes IA tab.
**Expected:** Loading skeleton appears for 3–8 seconds, then 3 recipe cards render with distinct names, prep times, descriptions, and calories. The macro budget banner shows 4 non-zero values.
**Why human:** Requires a live Anthropic API call (`claude-sonnet-4-20250514`) with real credentials — cannot be simulated from static code inspection.

### 2. Serving Stepper Macro Recalculation

**Test:** Navigate to any recipe detail screen. Note the displayed calorie value at `base_servings`. Tap the increment (+) button to increase servings by 1, then again to 4 servings total.
**Expected:** Calorie and macro values update immediately on each tap. At 2× `base_servings`, all values should be approximately doubled. At 1 serving on a 2-serving base recipe, values should be halved.
**Why human:** Arithmetic is correct in code (`servings / base_servings * macro`) but visual correctness and UX smoothness of the stepper require runtime confirmation.

### 3. 'Recettes IA' Tab Visibility in Pantry Plugin

**Test:** Open the pantry plugin. Verify the bottom tab bar shows a "Recettes IA" tab alongside the existing "Garde-Manger" tab.
**Expected:** Two tab bar items visible: "Garde-Manger" (storefront icon) and "Recettes IA" (restaurant/fork icon).
**Why human:** Tab bar rendering depends on PluginLoader reading the manifest routes array and filtering `showInTabBar: true` at runtime — cannot be verified from static analysis alone.

---

## Gaps Summary

The phase is structurally complete and functionally correct: the backend endpoint is fully implemented with real Supabase queries and AI generation, both frontend screens are substantive (332 and 295 lines respectively) with proper data flows, all Expo Router wiring is in place, and the monorepo type-checks clean.

One gap blocks full i18n correctness: two translation keys used in screen components (`pantry.recipes_retry_btn` in `PantryRecipes.tsx` line 302, and `pantry.recipe_detail_back` in `RecipeDetail.tsx` line 60) are absent from the central i18n dictionary and both reference copies. The `useTranslation` hook falls back to rendering the raw key name as text, so at runtime both strings display as identifiers rather than translated labels. This is a minor but visible UX defect — the retry button on the error state and the back button on the detail screen will show raw i18n key strings.

The fix is two key additions: `pantry.recipes_retry_btn` (mapped to existing `pantry.recipes_retry` value: FR "Réessayer", EN "Try again") and a new `pantry.recipe_detail_back` (FR "Retour", EN "Back") to `packages/plugin-sdk/src/i18n.ts` (both FR and EN dicts) and the reference copies `plugins/pantry/src/i18n/fr.ts` and `en.ts`.

---

_Verified: 2026-03-29_
_Verifier: Claude (gsd-verifier)_
