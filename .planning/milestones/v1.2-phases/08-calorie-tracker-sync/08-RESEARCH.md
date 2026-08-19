# Phase 8: Calorie Tracker Sync — Research

**Researched:** 2026-03-29
**Domain:** Cross-plugin navigation, Supabase direct insert, Expo Router v4 params, React Native form patterns
**Confidence:** HIGH — all findings sourced from direct codebase inspection of canonical reference files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** "I cooked this" is a navigated screen — new `RecipeConfirm` screen, pushed via router from RecipeDetail. Recipe data + serving count passed as JSON route param (same pattern as RecipeDetail). NOT a modal / bottom sheet.

**D-02:** RecipeConfirm layout:
- Recipe name (read-only header)
- Meal-type picker (Picker / segmented selector: `breakfast | lunch | dinner | snack`, pre-filled by time)
- 4 editable macro fields: `calories` (int), `protein_g`, `carbs_g`, `fat_g` (numeric inputs, pre-filled from `adjustedMacros` at the selected serving count)
- [Confirmer] primary button — logs + decrements + navigates

**D-03:** Serving count from RecipeDetail is passed through to RecipeConfirm so macro pre-fill uses the already-scaled values (no re-scaling needed on the confirm screen).

**D-04:** On confirm: insert one row into `nutrition_logs` with:
- `food_name`: recipe name
- `meal_type`: user-selected value (one of `breakfast | lunch | dinner | snack`)
- `calories`, `protein_g`, `carbs_g`, `fat_g`: from editable fields (user may have tweaked them)
- `date`: today (`new Date().toISOString().split('T')[0]`)
- `user_id`: from Supabase auth session

**D-05:** The Supabase insert uses the existing `supabase` client passed as a prop (same pattern as all other plugin screens). No backend endpoint needed — direct client insert with RLS.

**D-06:** After nutrition log insert succeeds, attempt pantry decrement:
- For each recipe ingredient, find a pantry item where `item.name.toLowerCase() === ingredient.name.toLowerCase()`. If no match, skip silently.
- For matched items: `newQty = Math.max(0, item.quantity - scaledIngredientQty)`. Update via `supabase.from('pantry_items').update({ quantity: newQty }).eq('id', item.id)`.
- Also update `usePantryStore.updateItem(id, { quantity: newQty })` for local state sync.
- Decrement failures are non-blocking — if a pantry update fails, log the error but do NOT block navigation.

**D-07:** Scaled ingredient quantity = `ingredient.quantity * (servings / recipe.base_servings)`. Both `servings` and `recipe.base_servings` are in the route param.

**D-08:** Time-of-day brackets (device local time via `new Date().getHours()`):
- 6–10 (inclusive) → `breakfast`
- 11–14 (inclusive) → `lunch`
- 18–22 (inclusive) → `dinner`
- all other hours → `snack`

**D-09:** Meal type is editable on the confirm screen before submitting.

**D-10:** "I cooked this" button on RecipeDetail is hidden entirely when the Nutrition plugin is not installed. Check by reading `userPlugins` from Supabase (`user_plugins` table, `plugin_id = 'nutrition'`, `is_enabled = true`). If not installed/enabled, button does not render — no tooltip, no fallback message.

**D-11:** Plugin check happens when RecipeDetail mounts (one-time query on mount, not polled). Loading state: button hidden until check resolves (avoids flash of CTA).

**D-12:** After successful confirm, navigate to `/(app)/(plugins)/nutrition/dashboard` using `router.replace` (not `push`) — so back-press from Nutrition goes to Pantry, not RecipeConfirm.

**D-13:** If the `nutrition_logs` insert fails (e.g. network error), show `showAlert` error message. Do NOT navigate away. Let user retry.

**D-14:** Pantry decrement errors are silent (logged to console only) — nutrition log is the primary action; pantry sync is best-effort.

### Claude's Discretion

- Exact label/placeholder text for macro input fields (follow existing nutrition plugin patterns)
- Whether macro fields use `TextInput` with `keyboardType="numeric"` or a custom stepper
- Loading/spinner state on the [Confirmer] button during async operations
- i18n key naming for confirm screen (follow `pantry.*` namespace)

### Deferred Ideas (OUT OF SCOPE)

- Shopping list (Phase 9)
- AI-driven cooked-meal logging
- Nutrition goal personalisation
- Ingredient-level pantry editing from confirm screen
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | User can confirm a cooked recipe to auto-log its macros to the nutrition plugin | RecipeConfirm screen creation, `nutrition_logs` insert pattern (D-04/D-05) |
| SYNC-02 | User can edit any macro value and the meal_type before confirming sync | Editable TextInput fields + segmented meal-type selector (D-02/D-09) |
| SYNC-03 | Pantry item quantities are decremented for used ingredients when a recipe is confirmed as cooked | `usePantryStore.updateItem` + Supabase update pattern (D-06/D-07) |
</phase_requirements>

---

## Summary

Phase 8 is a focused feature connecting two existing plugins: pantry and nutrition. The scope is three files to create/modify plus i18n additions. No new dependencies are required — everything uses the established project patterns for navigation, Supabase writes, and local store updates.

The RecipeDetail screen needs a "I cooked this" CTA gated on nutrition plugin installation (one Supabase query on mount). RecipeConfirm is a new navigated screen that receives pre-scaled macro values via JSON route param and writes directly to `nutrition_logs`. After a successful nutrition log insert, pantry quantities are decremented best-effort using the existing `usePantryStore.updateItem` action plus a direct Supabase update.

All architecture is locked in CONTEXT.md decisions. The research below establishes the exact column types, existing code patterns, and i18n gaps so the planner can create precise task instructions without ambiguity.

**Primary recommendation:** Follow PantryItemForm.tsx as the exact template for RecipeConfirm — it shows the complete pattern: `SafeAreaView` + `KeyboardAvoidingView` + `ScrollView`, `supabase.auth.getUser()` for `user_id`, `router.back()` / `router.replace()` navigation, `showAlert` for error handling, `ActivityIndicator` on the submit button, and `paddingBottom: 100` on the scroll container.

---

## Standard Stack

This phase introduces no new libraries. It uses the stack already installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | v4 (installed) | File-based navigation + `useLocalSearchParams` + `router.replace` | Project standard — all screens use it |
| @supabase/supabase-js | installed | Direct Supabase client insert for `nutrition_logs` | Project standard — all plugin screens pass `supabase` as prop |
| zustand | v5 (installed) | `usePantryStore.updateItem` for local state sync | Project standard — pantry store already has `updateItem` |
| @ziko/plugin-sdk | installed | `showAlert`, `useTranslation`, `useThemeStore` | Required by all plugin screens per CLAUDE.md |
| @expo/vector-icons (Ionicons) | installed | Icon for back button | Project standard |

### No New Installations Required

All dependencies are already present. No `npm install` step needed for this phase.

---

## Architecture Patterns

### Recommended File Structure (changes only)

```
plugins/pantry/src/
├── screens/
│   ├── RecipeDetail.tsx          # MODIFY — add CTA + nutrition gate
│   └── RecipeConfirm.tsx         # CREATE — new confirm screen
packages/plugin-sdk/src/
└── i18n.ts                       # MODIFY — add pantry.confirm.* keys (both fr + en)
plugins/pantry/src/
└── manifest.ts                   # MODIFY — add confirm route
apps/mobile/app/(app)/(plugins)/pantry/
└── confirm.tsx                   # CREATE — thin Expo Router wrapper
```

### Pattern 1: Expo Router Thin Wrapper

**What:** Every plugin screen has a one-file wrapper in `apps/mobile/app/(app)/(plugins)/<plugin>/`. The wrapper imports the screen component from the plugin package and injects the `supabase` client.

**When to use:** Every new navigated screen in any plugin.

**Example (from `recipe-detail.tsx`):**
```typescript
// Source: apps/mobile/app/(app)/(plugins)/pantry/recipe-detail.tsx
import React from 'react';
import RecipeDetail from '@ziko/plugin-pantry/screens/RecipeDetail';
import { supabase } from '../../../../src/lib/supabase';

export default function RecipeDetailRoute() {
  return <RecipeDetail supabase={supabase} />;
}
```

New `confirm.tsx` follows this exactly:
```typescript
import React from 'react';
import RecipeConfirm from '@ziko/plugin-pantry/screens/RecipeConfirm';
import { supabase } from '../../../../src/lib/supabase';

export default function RecipeConfirmRoute() {
  return <RecipeConfirm supabase={supabase} />;
}
```

### Pattern 2: JSON Route Param (Recipe Object)

**What:** Complex objects are passed between screens as `JSON.stringify`-encoded route params. The receiving screen calls `JSON.parse` on the param.

**When to use:** When passing a Recipe object (or any object with nested properties) as a route param in Expo Router.

**Navigation call (from PantryRecipes.tsx):**
```typescript
// Source: plugins/pantry/src/screens/PantryRecipes.tsx
router.push({
  pathname: '/(plugins)/pantry/recipe-detail' as any,
  params: { recipe: JSON.stringify(recipe) },
});
```

**RecipeDetail receives it:**
```typescript
// Source: plugins/pantry/src/screens/RecipeDetail.tsx
const { recipe: recipeStr } = useLocalSearchParams<{ recipe: string }>();
const recipe: Recipe = JSON.parse(recipeStr as string);
```

**RecipeDetail will navigate to RecipeConfirm the same way:**
```typescript
router.push({
  pathname: '/(plugins)/pantry/confirm' as any,
  params: {
    recipe: JSON.stringify(recipe),
    servings: String(servings),
  },
});
```

**RecipeConfirm receives both params:**
```typescript
const { recipe: recipeStr, servings: servingsStr } = useLocalSearchParams<{
  recipe: string;
  servings: string;
}>();
const recipe: Recipe = JSON.parse(recipeStr as string);
const servings = parseInt(servingsStr, 10);
```

Note: `servings` must be stringified as Expo Router params are strings. Parse with `parseInt`.

### Pattern 3: Supabase Direct Insert (nutrition_logs)

**What:** Plugin screens insert directly to Supabase using the client prop, retrieving `user_id` from `supabase.auth.getUser()`.

**When to use:** Any write to a table that has a `user_id` RLS policy.

**Example (from PantryItemForm.tsx):**
```typescript
// Source: plugins/pantry/src/screens/PantryItemForm.tsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data, error } = await supabase
  .from('pantry_items')
  .insert({ ...payload, user_id: user.id })
  .select('*')
  .single();
if (error) throw error;
```

**RecipeConfirm nutrition_logs insert:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { error } = await supabase.from('nutrition_logs').insert({
  user_id: user.id,
  date: new Date().toISOString().split('T')[0],
  meal_type: selectedMealType,
  food_name: recipe.name,
  calories: parseInt(caloriesStr, 10),
  protein_g: parseFloat(proteinStr),
  carbs_g: parseFloat(carbsStr),
  fat_g: parseFloat(fatStr),
});
if (error) throw error;
```

### Pattern 4: Nutrition Plugin Gate (user_plugins check)

**What:** Before rendering a CTA that requires the nutrition plugin, query `user_plugins` table for `plugin_id = 'nutrition'` and `is_enabled = true`. Hide the CTA while loading and if not found.

**Canonical reference (from HydrationDashboard.tsx — settings load):**
```typescript
// Source: plugins/hydration/src/screens/HydrationDashboard.tsx
const { data: profile } = await supabase
  .from('user_plugins')
  .select('settings')
  .eq('user_id', user.id)
  .eq('plugin_id', 'hydration')
  .single();
```

**RecipeDetail plugin gate (adapted for boolean check):**
```typescript
// In RecipeDetail useEffect on mount:
const [nutritionInstalled, setNutritionInstalled] = useState<boolean | null>(null);

useEffect(() => {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) { setNutritionInstalled(false); return; }
    supabase
      .from('user_plugins')
      .select('is_enabled')
      .eq('user_id', user.id)
      .eq('plugin_id', 'nutrition')
      .eq('is_enabled', true)
      .maybeSingle()
      .then(({ data }) => {
        setNutritionInstalled(!!data);
      });
  });
}, []);

// In render: only show CTA when nutritionInstalled === true
// nutritionInstalled === null → loading → button hidden (avoids flash)
// nutritionInstalled === false → not installed → button hidden
```

**Key detail:** Use `.maybeSingle()` not `.single()` — `.single()` throws an error if no row found. `.maybeSingle()` returns `null` data safely when plugin not installed.

### Pattern 5: router.replace for Cross-Plugin Navigation

**What:** After a successful action on a confirm screen, use `router.replace` to land on the target screen so the confirm screen is not in the back-stack.

**When to use:** D-12 — after nutrition log success, navigate to `/(app)/(plugins)/nutrition/dashboard` with `replace` not `push`.

**Example (from PantryDashboard.tsx tab bar):**
```typescript
// Source: plugins/pantry/src/screens/PantryDashboard.tsx
router.replace(tab.path as any)
```

**RecipeConfirm success navigation:**
```typescript
router.replace('/(app)/(plugins)/nutrition/dashboard' as any);
```

Note: Use the full path `/(app)/(plugins)/nutrition/dashboard` for cross-plugin navigation. The pantry screens use `/(plugins)/pantry/...` (relative to the `(app)` segment), but cross-plugin navigation needs the full absolute path from the file-system root.

### Pattern 6: Segmented Selector for Meal Type

**What:** Horizontal row of 4 touchable buttons (breakfast / lunch / dinner / snack), each toggling active state with orange background when selected.

**When to use:** D-02 — meal-type picker in RecipeConfirm.

**Reference (from PantryItemForm.tsx storage location picker):**
```typescript
// Source: plugins/pantry/src/screens/PantryItemForm.tsx
<View style={{ flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', marginBottom: 16 }}>
  {(['fridge', 'freezer', 'pantry'] as const).map((loc, idx) => {
    const active = storageLocation === loc;
    return (
      <TouchableOpacity
        key={loc}
        onPress={() => setStorageLocation(loc)}
        style={{
          flex: 1, paddingVertical: 14, alignItems: 'center',
          backgroundColor: active ? theme.primary : theme.surface,
          borderLeftWidth: idx > 0 ? 1 : 0,
          borderLeftColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#FFFFFF' : theme.muted }}>
          {locLabels[loc]}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

For 4 meal types (breakfast / lunch / dinner / snack), this same pattern renders correctly — `flex: 1` distributes evenly across 4 options.

### Pattern 7: Macro TextInput Fields

**What:** `TextInput` with `keyboardType="numeric"` for editable macro values. Pre-filled from the route param's already-scaled macros.

**When to use:** D-02 — the 4 editable fields in RecipeConfirm.

**Reference (from PantryItemForm.tsx quantity field):**
```typescript
// Source: plugins/pantry/src/screens/PantryItemForm.tsx
<TextInput
  value={quantity}
  onChangeText={setQuantity}
  placeholder={t('pantry.field_quantity_placeholder')}
  placeholderTextColor={theme.muted}
  keyboardType="numeric"
  style={textInputStyle}
/>
```

The `textInputStyle` object defined in PantryItemForm is the standard style. Use the same pattern for all 4 macro fields.

**State initialization:**
```typescript
const ratio = servings / recipe.base_servings;
const [calories, setCalories] = useState(String(Math.round(recipe.macros.calories * ratio)));
const [protein, setProtein] = useState(String(Math.round(recipe.macros.protein_g * ratio)));
const [carbs, setCarbs] = useState(String(Math.round(recipe.macros.carbs_g * ratio)));
const [fat, setFat] = useState(String(Math.round(recipe.macros.fat_g * ratio)));
```

### Pattern 8: Submit Button with ActivityIndicator

**What:** Primary CTA button shows `ActivityIndicator` during async operations, disabled state prevents double-submit.

**Reference (from PantryItemForm.tsx save button):**
```typescript
// Source: plugins/pantry/src/screens/PantryItemForm.tsx
<TouchableOpacity
  onPress={handleSave}
  disabled={saving}
  style={{ backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
>
  {saving ? (
    <ActivityIndicator color="#FFFFFF" />
  ) : (
    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
      {t('pantry.save_add')}
    </Text>
  )}
</TouchableOpacity>
```

### Pattern 9: Pantry Decrement (Zustand + Supabase)

**What:** After nutrition log succeeds, iterate recipe ingredients, find matching pantry items by name (case-insensitive), and update both the Supabase row and local Zustand store.

**Zustand updateItem (from store.ts):**
```typescript
// Source: plugins/pantry/src/store.ts
updateItem: (id, updates) =>
  set((s) => ({
    items: s.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  })),
```

**Complete decrement loop:**
```typescript
const pantryItems = usePantryStore.getState().items;
const ratio = servings / recipe.base_servings;

for (const ingredient of recipe.ingredients) {
  const match = pantryItems.find(
    (item) => item.name.toLowerCase() === ingredient.name.toLowerCase()
  );
  if (!match) continue;

  const scaledQty = ingredient.quantity * ratio;
  const newQty = Math.max(0, match.quantity - scaledQty);

  try {
    await supabase
      .from('pantry_items')
      .update({ quantity: newQty })
      .eq('id', match.id);
    usePantryStore.getState().updateItem(match.id, { quantity: newQty });
  } catch (err) {
    console.error('[RecipeConfirm] pantry decrement failed for', match.name, err);
    // Non-blocking — continue to next ingredient
  }
}
```

### Pattern 10: manifest.ts Route Addition

**What:** Add a new route entry to `plugins/pantry/src/manifest.ts` for the confirm screen. Set `showInTabBar: false` so it does not appear in the tab bar.

**Current routes in manifest.ts (verified):**
- `/(plugins)/pantry/dashboard` — showInTabBar: true
- `/(plugins)/pantry/add` — showInTabBar: false
- `/(plugins)/pantry/edit` — showInTabBar: false
- `/(plugins)/pantry/recipes` — showInTabBar: true
- `/(plugins)/pantry/recipe-detail` — showInTabBar: false

**New route to add:**
```typescript
{
  path: '/(plugins)/pantry/confirm',
  title: 'Confirmer la recette',
  icon: 'checkmark-circle-outline',
  showInTabBar: false,
},
```

### Anti-Patterns to Avoid

- **Using `.single()` when checking for optional row:** `.single()` throws an error when the `user_plugins` row does not exist. Use `.maybeSingle()` for the nutrition plugin gate.
- **Using `router.push` instead of `router.replace` after confirm:** The confirm screen must not remain in the back-stack. D-12 mandates `router.replace`.
- **Blocking navigation on pantry decrement failure:** D-14 mandates that pantry errors are non-blocking. Wrap each decrement in individual try/catch, not one outer try/catch that gates navigation.
- **Using `Alert` from `react-native`:** CLAUDE.md forbids `Alert.alert` in plugin screens. Use `showAlert` from `@ziko/plugin-sdk`.
- **Parsing macros with `parseFloat` for calories:** The `nutrition_logs.calories` column is `INTEGER`. Use `parseInt(caloriesStr, 10)` for calories, `parseFloat` for the three macro gram values (which are `NUMERIC(6,1)`).
- **Using `router.push('/(plugins)/pantry/confirm')` from RecipeDetail:** The navigation from RecipeDetail to RecipeConfirm must also work cross-context. Use `'/(plugins)/pantry/confirm' as any` (relative path, consistent with PantryRecipes → RecipeDetail pattern).
- **Missing `paddingBottom: 100` on ScrollView:** Every plugin screen requires this for tab bar clearance (CLAUDE.md).

---

## Database Schema (Verified)

### nutrition_logs (migration 003)

| Column | Type | Constraint |
|--------|------|-----------|
| id | UUID | PK, default uuid_generate_v4() |
| user_id | UUID | NOT NULL, FK auth.users |
| date | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| meal_type | TEXT | NOT NULL, CHECK IN ('breakfast','lunch','dinner','snack') |
| food_name | TEXT | NOT NULL |
| calories | INTEGER | NOT NULL, DEFAULT 0 |
| protein_g | NUMERIC(6,1) | NOT NULL, DEFAULT 0 |
| carbs_g | NUMERIC(6,1) | NOT NULL, DEFAULT 0 |
| fat_g | NUMERIC(6,1) | NOT NULL, DEFAULT 0 |
| serving_g | NUMERIC(6,1) | nullable |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**food_name field:** `TEXT NOT NULL` — no length constraint in the schema. Recipe names from AI generation are typically 2–8 words. No truncation needed.

**meal_type enum:** Exactly `breakfast | lunch | dinner | snack` — must match CONTEXT.md D-08 exactly. Postgres CHECK constraint will reject any other value.

**serving_g:** Nullable — do not write this field in the RecipeConfirm insert. The recipe macro values are already pre-scaled by serving count; `serving_g` is not relevant here.

**RLS:** `nutrition_logs_own` policy uses `auth.uid() = user_id` — the direct client insert pattern (D-05) is safe with this policy.

### pantry_items (migration 022)

| Column | Type | Constraint |
|--------|------|-----------|
| id | UUID | PK |
| user_id | UUID | NOT NULL |
| name | TEXT | NOT NULL |
| quantity | NUMERIC(10,2) | NOT NULL, DEFAULT 0 |
| unit | TEXT | CHECK IN ('g','kg','ml','L','pieces','can','box','bag') |
| storage_location | TEXT | CHECK IN ('fridge','freezer','pantry') |
| food_category | TEXT | CHECK IN (...) |
| expiration_date | DATE | nullable |
| low_stock_threshold | NUMERIC(10,2) | nullable |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL |

**quantity column:** `NUMERIC(10,2)` — supports decimal values. `Math.max(0, item.quantity - scaledQty)` is safe to write back directly (no rounding needed beyond what the DB accepts).

**RLS:** `pantry_items_own` policy — direct update from supabase client prop is safe.

---

## i18n Gap Analysis

The current `pantry.*` namespace in `i18n.ts` (both `fr` and `en`) does **not** include any keys for the confirm screen. The following keys need to be added.

### Missing keys (must add to both fr and en in i18n.ts)

**French additions:**
```typescript
'pantry.confirm_title': 'Confirmer la recette',
'pantry.confirm_subtitle': 'Vérifiez et ajustez les valeurs nutritionnelles',
'pantry.confirm_meal_type': 'Type de repas',
'pantry.confirm_meal_breakfast': 'Matin',
'pantry.confirm_meal_lunch': 'Déjeuner',
'pantry.confirm_meal_dinner': 'Dîner',
'pantry.confirm_meal_snack': 'Collation',
'pantry.confirm_macros_title': 'Valeurs nutritionnelles',
'pantry.confirm_field_calories': 'Calories (kcal)',
'pantry.confirm_field_protein': 'Protéines (g)',
'pantry.confirm_field_carbs': 'Glucides (g)',
'pantry.confirm_field_fat': 'Lipides (g)',
'pantry.confirm_cta': 'Confirmer et logger',
'pantry.confirm_back': 'Retour',
'pantry.confirm_success': 'Repas enregistré !',
'pantry.confirm_error_title': 'Erreur',
'pantry.confirm_error': 'Impossible d\'enregistrer. Vérifiez votre connexion.',
'pantry.cooked_this_cta': 'J\'ai cuisiné ça',
```

**English additions:**
```typescript
'pantry.confirm_title': 'Confirm recipe',
'pantry.confirm_subtitle': 'Review and adjust nutritional values',
'pantry.confirm_meal_type': 'Meal type',
'pantry.confirm_meal_breakfast': 'Breakfast',
'pantry.confirm_meal_lunch': 'Lunch',
'pantry.confirm_meal_dinner': 'Dinner',
'pantry.confirm_meal_snack': 'Snack',
'pantry.confirm_macros_title': 'Nutritional values',
'pantry.confirm_field_calories': 'Calories (kcal)',
'pantry.confirm_field_protein': 'Protein (g)',
'pantry.confirm_field_carbs': 'Carbs (g)',
'pantry.confirm_field_fat': 'Fat (g)',
'pantry.confirm_cta': 'Confirm & log meal',
'pantry.confirm_back': 'Back',
'pantry.confirm_success': 'Meal logged!',
'pantry.confirm_error_title': 'Error',
'pantry.confirm_error': 'Unable to save. Check your connection.',
'pantry.cooked_this_cta': 'I cooked this',
```

**Note on `general.confirm`:** The key `'general.confirm': 'Confirmer'` already exists in i18n.ts but is generic. Use the new `pantry.confirm_cta` key with the full "Confirmer et logger" label so the button is explicit about what it does.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alert/dialog UX | Custom modal component | `showAlert` from `@ziko/plugin-sdk` | CLAUDE.md mandate; consistent with all other plugin screens |
| User ID retrieval | Props/context threading | `supabase.auth.getUser()` inside handler | Established project pattern in PantryItemForm.tsx |
| Meal-type picker | Third-party Picker component | Inline segmented row (same as storage location in PantryItemForm) | No new dependency; identical UI pattern already in project |
| Cross-plugin store access | Import NutritionStore | Don't touch nutrition store at all; write directly to Supabase | Nutrition dashboard reads from DB on mount/refresh — no store sync needed |
| Serving re-calculation | Recalculate ratio in RecipeConfirm | Read pre-scaled values from route param | D-03 explicitly disallows re-scaling on confirm screen |

**Key insight:** Writing to `nutrition_logs` directly via Supabase is sufficient — NutritionDashboard reloads data from Supabase on mount and on `useFocusEffect`. No cross-plugin store access is needed.

---

## Common Pitfalls

### Pitfall 1: `.single()` on Optional Row

**What goes wrong:** `supabase.from('user_plugins').select().eq(...).single()` throws a Supabase error when no row matches (nutrition plugin not installed). This causes an unhandled error in the plugin gate check.

**Why it happens:** `.single()` is designed for queries guaranteed to return exactly one row. For the nutrition plugin gate, the row may not exist at all.

**How to avoid:** Use `.maybeSingle()`. Returns `{ data: null }` when no row found, no error thrown.

**Warning signs:** Console shows `PGRST116` error ("JSON object requested, multiple (or no) rows returned") during the plugin gate check.

### Pitfall 2: Back-Stack Pollution After Confirm

**What goes wrong:** Using `router.push('/(app)/(plugins)/nutrition/dashboard')` instead of `router.replace` leaves RecipeConfirm in the back-stack. The user taps back from Nutrition and lands on RecipeConfirm again, potentially re-submitting.

**Why it happens:** `push` adds to the stack. D-12 explicitly mandates `replace`.

**How to avoid:** Always use `router.replace('/(app)/(plugins)/nutrition/dashboard' as any)` in the confirm handler.

### Pitfall 3: Blocking Pantry Decrement

**What goes wrong:** Wrapping the entire confirm handler (nutrition insert + pantry loop) in one try/catch means a failed pantry decrement prevents navigation to Nutrition dashboard.

**Why it happens:** Single try/catch catches all errors from both operations.

**How to avoid:** Use two separate try/catch blocks. The first (nutrition insert) is blocking — an error shows an alert and returns. The second (pantry loop) is non-blocking — errors are logged to console only, and navigation proceeds regardless.

### Pitfall 4: Integer vs Float Column Types

**What goes wrong:** Inserting a float (e.g., `286.0`) into the `calories INTEGER` column may be silently truncated or may error depending on Supabase/PostgreSQL version.

**Why it happens:** `calories` is `INTEGER NOT NULL` in migration 003. If the TextInput value is used directly as a float, the insert could fail or produce incorrect data.

**How to avoid:** Parse calories with `parseInt(caloriesStr, 10)` before insert. Parse protein/carbs/fat with `parseFloat`.

### Pitfall 5: Cross-Plugin Route Path Format

**What goes wrong:** Using `/(plugins)/pantry/confirm` (relative path) works within the `(app)` group. Using `/(app)/(plugins)/nutrition/dashboard` (absolute path) is needed for cross-plugin navigation. Mixing these up causes "route not found" errors.

**Why it happens:** Expo Router resolves paths relative to the current group. Within the pantry plugin, `/(plugins)/pantry/...` works. But navigating to nutrition requires the full path from the app root.

**How to avoid:**
- Navigate within pantry: `'/(plugins)/pantry/confirm' as any`
- Navigate to nutrition: `'/(app)/(plugins)/nutrition/dashboard' as any`

Verify by checking the actual file system path: `apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx` exists.

### Pitfall 6: Flash of "I cooked this" Button

**What goes wrong:** If `nutritionInstalled` starts as `false` instead of `null`, the button briefly disappears and reappears as the check resolves. If it starts as `true`, the button shows for non-nutrition users.

**Why it happens:** Incorrect initial state for the plugin gate.

**How to avoid:** Initialize `nutritionInstalled` as `null` (not `false`). Render the button only when `nutritionInstalled === true`. During loading (`null`), the button is hidden — no flash.

---

## Code Examples

### RecipeDetail Plugin Gate + CTA (complete addition)

```typescript
// Source: direct codebase pattern from RecipeDetail.tsx + HydrationDashboard.tsx
import type { SupabaseClient } from '@supabase/supabase-js';
import { showAlert } from '@ziko/plugin-sdk';

// In RecipeDetail component:
const [nutritionInstalled, setNutritionInstalled] = useState<boolean | null>(null);

useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNutritionInstalled(false); return; }
    const { data } = await supabase
      .from('user_plugins')
      .select('is_enabled')
      .eq('user_id', user.id)
      .eq('plugin_id', 'nutrition')
      .eq('is_enabled', true)
      .maybeSingle();
    setNutritionInstalled(!!data);
  })();
}, []);

// CTA (render at bottom of ScrollView, before closing tag):
{nutritionInstalled === true && (
  <TouchableOpacity
    onPress={() =>
      router.push({
        pathname: '/(plugins)/pantry/confirm' as any,
        params: {
          recipe: JSON.stringify(recipe),
          servings: String(servings),
        },
      })
    }
    style={{
      backgroundColor: '#FF5C1A',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
    }}
  >
    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
      {t('pantry.cooked_this_cta')}
    </Text>
  </TouchableOpacity>
)}
```

### Confirm Handler (complete)

```typescript
// Source: pattern from PantryItemForm.tsx handleSave, adapted for RecipeConfirm
const handleConfirm = async () => {
  setSaving(true);
  try {
    // Step 1: Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Step 2: Insert nutrition log (blocking)
    const { error: logError } = await supabase.from('nutrition_logs').insert({
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      meal_type: mealType,
      food_name: recipe.name,
      calories: parseInt(calories, 10),
      protein_g: parseFloat(protein),
      carbs_g: parseFloat(carbs),
      fat_g: parseFloat(fat),
    });
    if (logError) throw logError;

    // Step 3: Decrement pantry (non-blocking)
    const ratio = servings / recipe.base_servings;
    const pantryItems = usePantryStore.getState().items;
    for (const ingredient of recipe.ingredients) {
      const match = pantryItems.find(
        (item) => item.name.toLowerCase() === ingredient.name.toLowerCase()
      );
      if (!match) continue;
      const newQty = Math.max(0, match.quantity - ingredient.quantity * ratio);
      try {
        await supabase.from('pantry_items').update({ quantity: newQty }).eq('id', match.id);
        usePantryStore.getState().updateItem(match.id, { quantity: newQty });
      } catch (err) {
        console.error('[RecipeConfirm] decrement failed:', match.name, err);
      }
    }

    // Step 4: Navigate (replace, not push)
    router.replace('/(app)/(plugins)/nutrition/dashboard' as any);
  } catch {
    showAlert(t('pantry.confirm_error_title'), t('pantry.confirm_error'));
  } finally {
    setSaving(false);
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Alert.alert` from react-native | `showAlert` from `@ziko/plugin-sdk` | Phase 6 | All plugin screens must use showAlert — documented in CLAUDE.md Known Bugs Fixed |
| Cross-plugin store import | Direct Supabase write | Phase 6+ | Nutrition dashboard reloads from DB on focus — no store sync needed |

---

## Open Questions

1. **Does NutritionDashboard reload on `useFocusEffect`?**
   - What we know: NutritionDashboard uses `useFocusEffect` (visible in imports at line 7 of NutritionDashboard.tsx) alongside `useEffect`.
   - What's unclear: Whether the `loadLogs` function is called in `useFocusEffect` or only `useEffect`.
   - Recommendation: Check lines 40-80 of NutritionDashboard.tsx. If only in `useEffect`, the new log will still appear because `router.replace` causes a full mount of the destination screen. Either way, the direct Supabase insert pattern is correct — the dashboard will show the new entry.

2. **Does Expo Router encode the JSON recipe param safely?**
   - What we know: This exact pattern (JSON param for recipe) is already proven in PantryRecipes → RecipeDetail navigation and is working in production (Phase 7 complete).
   - What's unclear: Nothing — this is a proven pattern.
   - Recommendation: Use exactly the same approach. No encoding concerns.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is pure code/config changes within the existing project stack. No new npm packages, no new services, no CLI tools beyond what already runs the project.)

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — React Native / Expo project has no automated test infrastructure at project level |
| Config file | None found (no jest.config.*, vitest.config.*, pytest.ini outside node_modules) |
| Quick run command | `npm run type-check` (TypeScript check only) |
| Full suite command | `npm run type-check` |

No unit/integration test files exist at the project level (all test files found are in `node_modules`). This is consistent with a mobile app project where validation is done manually on device/simulator.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Confirm screen visible with editable macros + meal picker | manual-only | `npm run type-check` (TypeScript gate) | N/A |
| SYNC-02 | Macro values and meal_type are editable before confirm | manual-only | `npm run type-check` | N/A |
| SYNC-03 | Pantry quantities decremented after confirm | manual-only | `npm run type-check` | N/A |

**Manual-only justification:** This is a React Native mobile app with no test runner infrastructure. All three SYNC requirements involve UI interaction, Supabase writes, and device navigation — none of which are amenable to automated testing without a full test harness (Detox/Maestro) that does not exist in this project.

### Sampling Rate

- **Per task commit:** `npm run type-check`
- **Per wave merge:** `npm run type-check`
- **Phase gate:** `npm run type-check` passes + manual device verification of all 3 success criteria from ROADMAP.md

### Wave 0 Gaps

None — no test infrastructure needed. The only automated check is TypeScript, which is already configured via `npm run type-check`.

---

## Sources

### Primary (HIGH confidence)
- `plugins/pantry/src/screens/RecipeDetail.tsx` — JSON param parsing pattern, recipe state, adjustedMacros
- `plugins/pantry/src/screens/PantryItemForm.tsx` — form screen template, Supabase write pattern, showAlert, router.back(), ActivityIndicator on button
- `plugins/pantry/src/screens/PantryRecipes.tsx` — router.push with JSON params to recipe-detail
- `plugins/pantry/src/screens/PantryDashboard.tsx` — router.replace pattern, router.push with params
- `plugins/pantry/src/store.ts` — `updateItem` signature and implementation
- `plugins/pantry/src/manifest.ts` — current routes (5 routes confirmed), structure for new route
- `plugins/pantry/src/types/recipe.ts` — Recipe, RecipeIngredient, RecipeMacros interfaces
- `apps/mobile/app/(app)/(plugins)/pantry/recipe-detail.tsx` — thin wrapper pattern
- `apps/mobile/app/(app)/(plugins)/nutrition/dashboard.tsx` — confirmed cross-plugin navigation target exists
- `supabase/migrations/003_nutrition_schema.sql` — nutrition_logs column types (INTEGER for calories, NUMERIC(6,1) for macros)
- `supabase/migrations/022_pantry_schema.sql` — pantry_items column types (NUMERIC(10,2) for quantity)
- `packages/plugin-sdk/src/i18n.ts` — all existing pantry.* keys; confirmed NO confirm screen keys exist
- `plugins/hydration/src/screens/HydrationDashboard.tsx` — user_plugins query pattern

### Secondary (MEDIUM confidence)
- `.planning/phases/08-calorie-tracker-sync/08-CONTEXT.md` — all locked decisions (D-01 through D-14)
- `.planning/REQUIREMENTS.md` — SYNC-01, SYNC-02, SYNC-03 requirements
- `.planning/ROADMAP.md` — Phase 8 success criteria (3 items)

---

## Project Constraints (from CLAUDE.md)

The planner must verify all tasks comply with these directives:

| Constraint | Source | Impact on This Phase |
|------------|--------|---------------------|
| Never use `Alert.alert` in plugins — use `showAlert` from `@ziko/plugin-sdk` | CLAUDE.md Known Bugs Fixed | RecipeConfirm error handling must use `showAlert` |
| All screens use `paddingBottom: 100` for tab bar clearance | CLAUDE.md Known Bugs Fixed | RecipeConfirm ScrollView `contentContainerStyle` must include `paddingBottom: 100` |
| Plugin manifest `icon` field must use Ionicons name (e.g. `'calculator-outline'`) | CLAUDE.md Known Bugs Fixed | New confirm route in manifest.ts must use an Ionicons string |
| Plugin manifests must use `export default` | CLAUDE.md Plugin System Conventions | No change needed — pantryManifest already uses `export default` |
| `routes[].showInTabBar` — boolean field name | CLAUDE.md Plugin System Conventions | New confirm route must use `showInTabBar: false` |
| No dark mode — light sport theme only | CLAUDE.md Design System | RecipeConfirm uses hardcoded `#F7F6F3`, `#FF5C1A`, etc. or theme tokens |
| Inline style objects — no StyleSheet | CLAUDE.md Design System | RecipeConfirm must not use `StyleSheet.create()` |
| `supabase` client passed as prop pattern | CLAUDE.md Backend API | RecipeConfirm receives `supabase: SupabaseClient` prop from wrapper |
| `EXPO_PUBLIC_SUPABASE_KEY` (not ANON_KEY) | CLAUDE.md Known Bugs Fixed | No env var changes needed for this phase |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all packages verified as installed
- Architecture: HIGH — all patterns sourced from direct codebase inspection of existing files
- Database schema: HIGH — read directly from migration files 003 and 022
- i18n gap: HIGH — exhaustive grep of i18n.ts confirmed no confirm-screen keys exist
- Pitfalls: HIGH — derived from direct code inspection + type mismatches in schema

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable codebase — all referenced files are stable post-Phase 7)
