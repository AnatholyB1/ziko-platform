---
phase: 09-smart-shopping-list
verified: 2026-04-01T12:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Visual check — Courses tab is the 3rd tab, active state uses theme.primary color"
    expected: "PantryTabBar shows cart icon + 'Courses' label in orange when active"
    why_human: "Active/inactive color state requires running the app on device"
  - test: "Check-off animation — row disappears immediately on tap (optimistic)"
    expected: "No lag between tap and row removal; item reappears if Supabase fails"
    why_human: "Optimistic UI timing requires runtime observation"
---

# Phase 9: Smart Shopping List Verification Report

**Phase Goal:** Users have a rule-based shopping list automatically populated from low/out-of-stock pantry items and missing recipe ingredients, which they can check off as purchased and export to any app
**Verified:** 2026-04-01T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees shopping list auto-generated from items where `quantity <= low_stock_threshold` — no manual curation | VERIFIED | `ShoppingList.tsx` lines 91-103: queries `pantry_items`, filters `quantity === 0 \|\| quantity <= low_stock_threshold` on every mount |
| 2 | User can add missing recipe ingredients to the shopping list in one tap from RecipeDetail | VERIFIED | `RecipeDetail.tsx` lines 61-113: `handleAddToList` inserts to `shopping_list_items` with `source: 'recipe'`; button always visible (lines 252-272) |
| 3 | User can check off a shopping list item — pantry quantity is restored | VERIFIED | `ShoppingList.tsx` lines 128-138: optimistic remove + `UPDATE pantry_items SET quantity = threshold + 1`; recipe items: lines 142-149: optimistic remove + `DELETE shopping_list_items` |
| 4 | User can export the full shopping list as plain text via the native share sheet | VERIFIED | `ShoppingList.tsx` lines 153-166: alphabetically sorted, `"Liste de courses Ziko\n\n..."` format, `Share.share()` from `react-native` |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mobile/app/(app)/(plugins)/pantry/shopping.tsx` | Expo Router wrapper for ShoppingList screen | VERIFIED | 7 lines, imports `ShoppingList` from `@ziko/plugin-pantry/screens/ShoppingList`, passes `supabase` |
| `plugins/pantry/src/screens/ShoppingList.tsx` | Shopping list screen with two sections, check-off, export | VERIFIED | 300 lines; two sections (low-stock, recipe), optimistic check-off, Share.share export, empty state, PantryTabBar |
| `plugins/pantry/src/screens/RecipeDetail.tsx` | RecipeDetail with "Ajouter à la liste" CTA | VERIFIED | `handleAddToList` function + always-visible outline button; deduplicates against pantry and existing list |
| `plugins/pantry/src/components/PantryTabBar.tsx` | 3-tab shared tab bar (dashboard / recettes / shopping) | VERIFIED | 55 lines; 3 tabs, uses `router.replace`, reads `pantry.tab_shopping` i18n key |
| `plugins/pantry/src/types/shopping.ts` | `ShoppingListItem` interface + `ShoppingItemSource` type | VERIFIED | 16 lines; complete interface with all fields matching DB schema |
| `plugins/pantry/src/store.ts` | Shopping list slice in `usePantryStore` | VERIFIED | Lines 38-84: `shoppingItems`, `setShoppingItems`, `addShoppingItem`, `removeShoppingItem` |
| `supabase/migrations/023_shopping_list.sql` | `shopping_list_items` table + RLS + source enum | VERIFIED | Creates `shopping_item_source` enum, table with FK to `pantry_items`, RLS policy, user_id index |
| `plugins/pantry/src/manifest.ts` | Shopping route registered with `showInTabBar: true` | VERIFIED | Lines 117-122: `{ path: '/(plugins)/pantry/shopping', title: 'Liste de courses', icon: 'cart-outline', showInTabBar: true }` |
| `packages/plugin-sdk/src/i18n.ts` | All `pantry.shop_*` keys in FR and EN locale blocks | VERIFIED | Lines 757-771 (FR), lines 1539-1553 (EN): all 14 keys present in both locales |
| `plugins/pantry/src/i18n/fr.ts` | Reference copy of FR shopping keys | VERIFIED | `// ── Shopping List ──` section with all FR keys confirmed |
| `plugins/pantry/src/i18n/en.ts` | Reference copy of EN shopping keys | VERIFIED | `// ── Shopping List ──` section with all EN keys confirmed |
| `plugins/pantry/package.json` | `ShoppingList` screen export | VERIFIED | `"./screens/ShoppingList": "./src/screens/ShoppingList.tsx"` present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/mobile/app/(app)/(plugins)/pantry/shopping.tsx` | `plugins/pantry/src/screens/ShoppingList.tsx` | `import ShoppingList from '@ziko/plugin-pantry/screens/ShoppingList'` | WIRED | Direct import at line 2, rendered at line 6 |
| `plugins/pantry/src/components/PantryTabBar.tsx` | `apps/mobile/app/(app)/(plugins)/pantry/shopping.tsx` | `router.replace('/(app)/(plugins)/pantry/shopping')` | WIRED | Line 37: `router.replace(tab.path as any)` where tab.path = `'/(app)/(plugins)/pantry/shopping'` |
| `plugins/pantry/src/screens/PantryDashboard.tsx` | `plugins/pantry/src/components/PantryTabBar.tsx` | `import PantryTabBar from '../components/PantryTabBar'` | WIRED | Line 16 import, line 325 render |
| `plugins/pantry/src/screens/ShoppingList.tsx` | `plugins/pantry/src/store.ts` | `usePantryStore()` | WIRED | Line 76: destructures `shoppingItems`, `setShoppingItems`, `setShoppingLoading`, `addShoppingItem`, `removeShoppingItem`, `updateItem` |
| `plugins/pantry/src/screens/RecipeDetail.tsx` | `supabase/shopping_list_items` | `supabase.from('shopping_list_items').insert(rows).select()` | WIRED | Lines 99-103: live insert + returned rows fed into store via `addShoppingItem` |
| `plugins/pantry/src/screens/ShoppingList.tsx` | `supabase/pantry_items` | `supabase.from('pantry_items').select('*')` | WIRED | Lines 91-103: live query for low-stock detection |
| `plugins/pantry/src/screens/ShoppingList.tsx` | `supabase/shopping_list_items` | `supabase.from('shopping_list_items').select('*').eq('source','recipe')` | WIRED | Lines 105-113: live query for recipe items |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ShoppingList.tsx` — Section 1 | `lowStockPantry` | `supabase.from('pantry_items').select('*').eq('user_id', user.id)` filtered client-side | Yes — live DB query, no static fallback | FLOWING |
| `ShoppingList.tsx` — Section 2 | `shoppingItems` (from store) | `supabase.from('shopping_list_items').select('*').eq('source','recipe')` | Yes — live DB query, results fed to store via `setShoppingItems` | FLOWING |
| `RecipeDetail.tsx` — handleAddToList | `toInsert` rows | `recipe.ingredients` filtered against live `pantry_items` (store) and live `shopping_list_items` (fresh Supabase query) | Yes — live deduplication, inserts real rows | FLOWING |
| `ShoppingList.tsx` — handleExport | `allItems` | Combined `lowStockPantry` + `shoppingItems` (both from live Supabase) | Yes — real data from live state | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running Expo dev server. Core logic verified through code tracing and UAT results (6/6 tests passed, commit `8dff195`).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SHOP-01 | 09-01, 09-02 | Shopping list auto-populated from low/out-of-stock pantry items | SATISFIED | `ShoppingList.tsx` load() queries pantry_items and filters by `quantity <= low_stock_threshold` on every mount |
| SHOP-02 | 09-02 | "Ajouter à la liste" CTA on RecipeDetail adds missing ingredients | SATISFIED | `handleAddToList` in RecipeDetail.tsx; button always visible; deduplication against pantry + existing list |
| SHOP-03 | 09-01, 09-02 | Check-off removes item and restores pantry quantity | SATISFIED | `handleCheckOffPantry` and `handleCheckOffRecipe` in ShoppingList.tsx; optimistic removal + Supabase update/delete |
| SHOP-04 | 09-02 | Plain-text export via native share sheet | SATISFIED | `handleExport` in ShoppingList.tsx; `Share.share()` with alphabetically sorted `"Liste de courses Ziko"` format |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ShoppingList.tsx` | 132 | `newQty = (item.low_stock_threshold ?? 0) + 1` vs spec's `low_stock_threshold ?? 1` | Info | Code sets quantity to `threshold + 1` rather than `threshold`. Net effect: item disappears from low-stock list after check-off (correct behavior). Spec's `threshold` value would cause immediate re-appearance on next load. UAT confirmed as passing. Functionally superior to spec. |

No blockers. No stubs. No placeholder returns. No raw i18n key strings. No `console.log`-only implementations.

---

### Human Verification Required

#### 1. Visual Tab Bar State

**Test:** Open the Pantry plugin. Tap each of the 3 tabs in sequence (Garde-Manger, Recettes IA, Courses).
**Expected:** Active tab shows orange icon and bold label (`theme.primary = #FF5C1A`); inactive tabs show muted grey.
**Why human:** Color state transitions require runtime observation.

#### 2. Optimistic Check-off Feel

**Test:** Tap a row in the Courses tab list.
**Expected:** Row disappears instantly with no perceptible lag. If network is offline, row reappears and an alert shows "Impossible de mettre à jour. Réessayez."
**Why human:** Optimistic UI latency and error-recovery require runtime observation.

---

### Gaps Summary

No gaps. All four must-have truths are fully verified:

1. **Auto-population** — live Supabase query on every mount, pure client-side threshold filter, zero manual steps.
2. **Add from recipe** — `handleAddToList` in RecipeDetail inserts to `shopping_list_items` via live query + deduplication; button always visible.
3. **Check-off + restore** — two distinct check-off paths (low-stock pantry item vs. recipe ingredient), both optimistic, both wired to Supabase. Quantity is set to `threshold + 1` (deviates from spec's `threshold` but is functionally correct — UAT confirmed).
4. **Export** — `Share.share` with correct header and alphabetical format, fully wired.

All 15 commits for the phase are present (`433d060` through `8dff195`). TypeScript compilation reported 0 errors (per 09-03-SUMMARY.md). UAT: 6/6 tests passed (per 09-UAT.md).

---

_Verified: 2026-04-01T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
