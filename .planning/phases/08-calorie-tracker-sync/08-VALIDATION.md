---
phase: 08-calorie-tracker-sync
verified: pending
status: not_started
score: 0/13 must-haves verified
---

# Phase 8: Calorie Tracker Sync — Validation Report

**Phase Goal:** A user who has cooked a recipe can tap "I cooked this" on RecipeDetail, arrive on a new RecipeConfirm screen with editable macro fields and a meal-type selector pre-filled from time of day, and confirm — which writes a row to `nutrition_logs`, decrements matched `pantry_items` quantities best-effort, and navigates to the Nutrition dashboard via `router.replace`.

**Verified:** pending (Phase 08 not yet executed)
**Status:** not_started — no SUMMARY files exist, all implementation artifacts are absent

---

## Execution Status

| Plan | Wave | SUMMARY | Status |
|------|------|---------|--------|
| 08-01 | 1 | 08-01-SUMMARY.md | MISSING — not executed |
| 08-02 | 2 | 08-02-SUMMARY.md | MISSING — not executed |
| 08-03 | 3 | 08-03-SUMMARY.md | MISSING — not executed |

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `plugins/pantry/src/screens/RecipeConfirm.tsx` exists and is a default-exported React component | NOT VERIFIED | File does not exist in `plugins/pantry/src/screens/` |
| 2 | RecipeConfirm parses `recipe` (JSON string) and `servings` (string) from `useLocalSearchParams` | NOT VERIFIED | File missing |
| 3 | Macro fields are pre-filled with `recipe.macros.* * (servings / recipe.base_servings)` and are editable `TextInput` with `keyboardType="numeric"` | NOT VERIFIED | File missing |
| 4 | Meal-type segmented selector shows exactly 4 options matching DB enum: `breakfast`, `lunch`, `dinner`, `snack` | NOT VERIFIED | File missing |
| 5 | Meal-type is pre-filled by time of day per D-08 brackets (6-10 → breakfast, 11-14 → lunch, 18-22 → dinner, else → snack) | NOT VERIFIED | File missing |
| 6 | `handleConfirm` inserts one row to `nutrition_logs` with correct column types: `calories` as `parseInt`, `protein_g`/`carbs_g`/`fat_g` as `parseFloat`, `date` as `new Date().toISOString().split('T')[0]`, `user_id` from `supabase.auth.getUser()` | NOT VERIFIED | File missing |
| 7 | Navigation after confirm uses `router.replace('/(app)/(plugins)/nutrition/dashboard')` — NOT `router.push` | NOT VERIFIED | File missing |
| 8 | Nutrition insert failure shows `showAlert` from `@ziko/plugin-sdk` and does NOT navigate away | NOT VERIFIED | File missing |
| 9 | Each pantry decrement is wrapped in its own `try/catch` — per-ingredient, non-blocking | NOT VERIFIED | File missing |
| 10 | `plugins/pantry/src/screens/RecipeDetail.tsx` has `nutritionInstalled` state (null/false/true) with `useEffect` querying `user_plugins` via `.maybeSingle()` | NOT VERIFIED | `nutritionInstalled` absent from RecipeDetail.tsx; no `useEffect` for plugin gate present |
| 11 | "I cooked this" CTA on RecipeDetail renders only when `nutritionInstalled === true`; hidden (not disabled) when null or false | NOT VERIFIED | CTA button not present in RecipeDetail.tsx |
| 12 | `apps/mobile/app/(app)/(plugins)/pantry/confirm.tsx` exists as a thin Expo Router wrapper importing `RecipeConfirm` from `@ziko/plugin-pantry/screens/RecipeConfirm` | NOT VERIFIED | File not present in `apps/mobile/app/(app)/(plugins)/pantry/` |
| 13 | `plugins/pantry/src/manifest.ts` has a route entry for `/(plugins)/pantry/confirm` with `showInTabBar: false` | NOT VERIFIED | Route absent from manifest.ts; only 5 routes present (none named `confirm`) |

**Score: 0/13 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `plugins/pantry/src/screens/RecipeConfirm.tsx` | Complete confirm screen — nutrition log insert + pantry decrement | MISSING | File does not exist |
| `plugins/pantry/package.json` | `"./screens/RecipeConfirm"` export entry | MISSING | Current exports: 7 entries; `./screens/RecipeConfirm` absent |
| `plugins/pantry/src/screens/RecipeDetail.tsx` | `nutritionInstalled` state + `useEffect` plugin gate + CTA button | MISSING | File exists but has no CTA or plugin-gate logic |
| `apps/mobile/app/(app)/(plugins)/pantry/confirm.tsx` | Expo Router thin wrapper for RecipeConfirm | MISSING | File does not exist |
| `plugins/pantry/src/manifest.ts` | `confirm` route with `showInTabBar: false` | MISSING | Route absent; 5 existing routes unchanged |
| `packages/plugin-sdk/src/i18n.ts` | All 16 `pantry.confirm_*` and `pantry.cooked_this_cta` keys in both `fr` and `en` sections | MISSING | Zero `pantry.confirm_*` keys present in central i18n dict |
| `plugins/pantry/src/i18n/fr.ts` | Reference copy of 16 new FR pantry.confirm_* keys | MISSING | No confirm keys in reference copy |
| `plugins/pantry/src/i18n/en.ts` | Reference copy of 16 new EN pantry.confirm_* keys | MISSING | No confirm keys in reference copy |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `RecipeDetail.tsx` | `/(plugins)/pantry/confirm` | `router.push` with `JSON.stringify(recipe)` + `String(servings)` params | NOT WIRED | CTA button absent |
| `confirm.tsx` (wrapper) | `RecipeConfirm.tsx` | `import RecipeConfirm from '@ziko/plugin-pantry/screens/RecipeConfirm'` | NOT WIRED | Both files missing |
| `RecipeConfirm.tsx` | `supabase.from('nutrition_logs').insert` | `handleConfirm` async function | NOT WIRED | File missing |
| `RecipeConfirm.tsx` | `usePantryStore.getState().updateItem` | pantry decrement loop after nutrition insert | NOT WIRED | File missing |
| `RecipeConfirm.tsx` | `/(app)/(plugins)/nutrition/dashboard` | `router.replace` after all decrements complete | NOT WIRED | File missing |
| `RecipeDetail.tsx` | `user_plugins` Supabase table | `useEffect` query with `.maybeSingle()` | NOT WIRED | useEffect absent |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| SYNC-01 | 08-01, 08-02, 08-03 | User can confirm a cooked recipe to auto-log its macros to the nutrition plugin | NOT SATISFIED | RecipeConfirm.tsx missing; no nutrition_logs insert path exists |
| SYNC-02 | 08-01, 08-03 | User can edit any macro value and the meal_type before confirming sync | NOT SATISFIED | RecipeConfirm.tsx missing; no editable macro UI |
| SYNC-03 | 08-01, 08-03 | Pantry item quantities are decremented for used ingredients when a recipe is confirmed as cooked | NOT SATISFIED | Pantry decrement logic in RecipeConfirm.tsx missing |

---

## Verification Commands

Commands to run once the phase is executed. All should return clean output.

### Artifact existence checks
```bash
# RecipeConfirm screen exists
ls /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx

# Expo Router wrapper exists
ls /c/ziko-platform/apps/mobile/app/\(app\)/\(plugins\)/pantry/confirm.tsx
```

### TypeScript compilation
```bash
# No errors in RecipeConfirm
cd /c/ziko-platform && npx tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | grep "RecipeConfirm" | head -20

# No errors in RecipeDetail
cd /c/ziko-platform && npx tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | grep "RecipeDetail" | head -20

# Full type-check — expect 0 errors
cd /c/ziko-platform && npx tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | grep -c "error TS" || echo "0 errors"
```

### Behavioral spot-checks
```bash
# router.replace used for post-confirm navigation (not router.push)
grep "router.replace.*nutrition/dashboard" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx

# calories uses parseInt (INTEGER column)
grep "parseInt(calories" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx

# protein/carbs/fat use parseFloat (NUMERIC columns)
grep "parseFloat" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx

# showAlert used — NOT Alert from react-native
grep "showAlert" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx
grep "Alert.alert" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx  # expect no output

# paddingBottom: 100 present
grep "paddingBottom.*100" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx

# Per-ingredient try/catch (not one outer try/catch gating navigation)
grep -c "try {" /c/ziko-platform/plugins/pantry/src/screens/RecipeConfirm.tsx  # expect >= 2

# maybeSingle() used in RecipeDetail plugin gate (not .single())
grep "maybeSingle" /c/ziko-platform/plugins/pantry/src/screens/RecipeDetail.tsx
grep "\.single()" /c/ziko-platform/plugins/pantry/src/screens/RecipeDetail.tsx  # expect no output

# CTA renders only when nutritionInstalled === true
grep "nutritionInstalled === true" /c/ziko-platform/plugins/pantry/src/screens/RecipeDetail.tsx

# confirm route in manifest with showInTabBar: false
grep "pantry/confirm" /c/ziko-platform/plugins/pantry/src/manifest.ts
grep -A3 "pantry/confirm" /c/ziko-platform/plugins/pantry/src/manifest.ts | grep "showInTabBar: false"

# RecipeConfirm export in pantry package.json
grep "RecipeConfirm" /c/ziko-platform/plugins/pantry/package.json
```

### i18n completeness checks
```bash
# All 16 keys present in central dict (French section)
cd /c/ziko-platform && node -e "
const i18n = require('./packages/plugin-sdk/src/i18n');
const fr = i18n.translations?.fr || i18n.default?.fr || {};
const en = i18n.translations?.en || i18n.default?.en || {};
const keys = [
  'pantry.cooked_this_cta',
  'pantry.confirm_title',
  'pantry.confirm_subtitle',
  'pantry.confirm_meal_type',
  'pantry.confirm_meal_breakfast',
  'pantry.confirm_meal_lunch',
  'pantry.confirm_meal_dinner',
  'pantry.confirm_meal_snack',
  'pantry.confirm_macros_title',
  'pantry.confirm_field_calories',
  'pantry.confirm_field_protein',
  'pantry.confirm_field_carbs',
  'pantry.confirm_field_fat',
  'pantry.confirm_cta',
  'pantry.confirm_error_title',
  'pantry.confirm_error'
];
keys.forEach(k => {
  if (!fr[k]) console.error('MISSING FR:', k);
  if (!en[k]) console.error('MISSING EN:', k);
});
console.log('i18n check done');
" 2>&1 | head -40
```

---

## Behavioral Spot-Checks (run after execution)

| Behavior | Command | Expected Result | Status |
|----------|---------|-----------------|--------|
| RecipeConfirm file exists | `ls plugins/pantry/src/screens/RecipeConfirm.tsx` | File listed | PENDING |
| confirm.tsx wrapper exists | `ls apps/mobile/app/(app)/(plugins)/pantry/confirm.tsx` | File listed | PENDING |
| `router.replace` for post-confirm nav | `grep "router.replace.*nutrition/dashboard" RecipeConfirm.tsx` | 1 match | PENDING |
| `calories` uses `parseInt` | `grep "parseInt(calories" RecipeConfirm.tsx` | 1 match | PENDING |
| `parseFloat` for gram values | `grep "parseFloat" RecipeConfirm.tsx` | 3+ matches | PENDING |
| `showAlert` used (not `Alert.alert`) | `grep "showAlert" RecipeConfirm.tsx` | 1 match | PENDING |
| `Alert.alert` absent | `grep "Alert.alert" RecipeConfirm.tsx` | 0 matches | PENDING |
| `paddingBottom: 100` on ScrollView | `grep "paddingBottom.*100" RecipeConfirm.tsx` | 1 match | PENDING |
| Per-ingredient try/catch (non-blocking) | `grep -c "try {" RecipeConfirm.tsx` | >= 2 | PENDING |
| `.maybeSingle()` in RecipeDetail gate | `grep "maybeSingle" RecipeDetail.tsx` | 1 match | PENDING |
| `.single()` absent from RecipeDetail | `grep "\.single()" RecipeDetail.tsx` | 0 matches | PENDING |
| CTA condition guards `=== true` | `grep "nutritionInstalled === true" RecipeDetail.tsx` | 1 match | PENDING |
| Manifest has confirm route | `grep "pantry/confirm" manifest.ts` | 1 match | PENDING |
| Manifest confirm is `showInTabBar: false` | `grep -A3 "pantry/confirm" manifest.ts` | contains `showInTabBar: false` | PENDING |
| `./screens/RecipeConfirm` in package.json | `grep "RecipeConfirm" plugins/pantry/package.json` | 1 match | PENDING |
| All 16 i18n keys in FR+EN | node i18n check script | `i18n check done` with no MISSING lines | PENDING |
| Full type-check passes | `npx tsc --noEmit ...` | 0 errors | PENDING |

---

## Meal-Type Time Bracket Unit Test

The `getMealTypeForHour` function is pure logic and can be verified with a minimal unit test once RecipeConfirm.tsx exists.

**Expected behavior per D-08:**

| Hour | Expected meal_type |
|------|--------------------|
| 5 | snack |
| 6 | breakfast |
| 10 | breakfast |
| 11 | lunch |
| 14 | lunch |
| 15 | snack |
| 17 | snack |
| 18 | dinner |
| 22 | dinner |
| 23 | snack |
| 0 | snack |

**Test command (once RecipeConfirm.tsx exists):**
```bash
cd /c/ziko-platform && node -e "
function getMealTypeForHour(h) {
  if (h >= 6 && h <= 10) return 'breakfast';
  if (h >= 11 && h <= 14) return 'lunch';
  if (h >= 18 && h <= 22) return 'dinner';
  return 'snack';
}
const cases = [[5,'snack'],[6,'breakfast'],[10,'breakfast'],[11,'lunch'],[14,'lunch'],[15,'snack'],[17,'snack'],[18,'dinner'],[22,'dinner'],[23,'snack'],[0,'snack']];
let pass = true;
cases.forEach(([h,want]) => {
  const got = getMealTypeForHour(h);
  if (got !== want) { console.error('FAIL hour=' + h + ' want=' + want + ' got=' + got); pass = false; }
});
if (pass) console.log('All meal-type bracket tests pass');
"
```

---

## D-06 Pantry Decrement Logic Unit Test

The pantry decrement quantity formula is pure arithmetic and testable in isolation.

**Spec (D-06/D-07):** `scaledQty = ingredient.quantity * (servings / recipe.base_servings)`, `newQty = Math.max(0, item.quantity - scaledQty)`

```bash
cd /c/ziko-platform && node -e "
// D-07: scaled qty = ingredient.qty * (servings / base_servings)
// D-06: newQty = Math.max(0, pantryQty - scaledQty)
function computeNewQty(ingredientQty, servings, baseServings, pantryQty) {
  const scaledQty = ingredientQty * (servings / baseServings);
  return Math.max(0, pantryQty - scaledQty);
}
const cases = [
  // [ingQty, servings, base, pantryQty, expected]
  [100, 2, 2, 500, 400],   // 1:1 scale, subtract 100
  [100, 4, 2, 500, 300],   // 2x scale, subtract 200
  [100, 1, 2, 80,  30],    // 0.5x scale, subtract 50
  [100, 2, 2, 50,  0],     // would go negative: floor at 0
  [0,   2, 2, 100, 100],   // zero ingredient: no change
];
let pass = true;
cases.forEach(([iq, sv, bsv, pq, expected], i) => {
  const got = computeNewQty(iq, sv, bsv, pq);
  if (Math.abs(got - expected) > 0.001) { console.error('FAIL case ' + i + ': expected ' + expected + ' got ' + got); pass = false; }
});
if (pass) console.log('All pantry decrement quantity tests pass');
"
```

---

## Human Verification Required (post-execution)

### 1. End-to-End Flow

**Test:** With nutrition plugin installed and at least one recipe generated, tap "J'ai cuisiné ça" on RecipeDetail.
**Steps:**
1. Open Pantry → Recettes IA tab
2. Tap "Suggérer des recettes", wait for 3 recipe cards
3. Tap any recipe card to open RecipeDetail
4. Verify: orange "J'ai cuisiné ça" button visible at bottom
5. Tap it — RecipeConfirm screen opens
6. Verify: recipe name shown as read-only header, 4-option meal-type selector (Matin / Déjeuner / Dîner / Collation), 4 editable macro fields pre-filled
7. Adjust one macro value, change meal type
8. Tap "Confirmer et logger"
9. Verify: navigates to Nutrition dashboard (back-stack goes to Pantry, NOT RecipeConfirm)
10. Verify: today's nutrition dashboard shows the new meal entry
11. Go back to Pantry → Garde-Manger, verify reduced quantities on matched ingredients

**Why human:** Requires live Supabase session, real nutrition_logs write, and visual confirmation of navigation stack and quantity changes.

### 2. CTA Hidden When Nutrition Plugin Not Installed

**Test:** With a test account that has NOT enabled the nutrition plugin, open RecipeDetail.
**Expected:** No "J'ai cuisiné ça" button visible. No console errors from the plugin gate query.
**Why human:** Requires testing with a real account state. The `.maybeSingle()` path must be confirmed not to throw in the absence of the nutrition plugin row.

### 3. Error Path — Network Failure

**Test:** Enable Airplane mode, open RecipeConfirm, fill in values, tap "Confirmer et logger".
**Expected:** Alert dialog appears with error message. User remains on RecipeConfirm screen and can retry.
**Why human:** Requires device-level network control to simulate the error path.

---

## Gaps Summary

Phase 08 has not been executed. All 8 required artifacts are absent and all 13 observable truths are unverified.

**Pre-execution gap list:**

| Gap | Type | Plan Responsible |
|-----|------|-----------------|
| `RecipeConfirm.tsx` not created | no_artifact | 08-01 |
| `./screens/RecipeConfirm` missing from `plugins/pantry/package.json` exports | no_artifact | 08-01 |
| RecipeDetail has no `nutritionInstalled` gate or CTA button | no_artifact | 08-02 |
| `confirm.tsx` Expo Router wrapper not created | no_artifact | 08-02 |
| `manifest.ts` missing `confirm` route | no_artifact | 08-02 |
| 16 `pantry.confirm_*` / `pantry.cooked_this_cta` keys absent from `packages/plugin-sdk/src/i18n.ts` | no_artifact | 08-03 |
| Reference keys absent from `plugins/pantry/src/i18n/fr.ts` | no_artifact | 08-03 |
| Reference keys absent from `plugins/pantry/src/i18n/en.ts` | no_artifact | 08-03 |

---

_Validated: 2026-03-29_
_Validator: Claude (gsd-nyquist-auditor) — pre-execution baseline_
