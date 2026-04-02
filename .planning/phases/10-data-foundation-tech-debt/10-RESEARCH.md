# Phase 10: Data Foundation + Tech Debt - Research

**Researched:** 2026-04-02
**Domain:** Supabase schema migration, Open Food Facts API caching, React Native Modal UX, Hono tool registry patterns
**Confidence:** HIGH — all findings sourced directly from live codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Use an inline React Native `Modal` overlay for quantity input — contains a `TextInput` (numeric), unit label, and confirm/cancel buttons. No new screen or navigation required.

**D-02:** If the user cancels the modal without entering a quantity, the shopping list item stays in the list. No pantry update is made. The item remains available for the user to tap again later.

**D-03:** When a recipe ingredient is checked off and `pantry_item_id` is **not null** (match exists): update the existing pantry item's quantity to `existing_qty + purchased_qty`.

**D-04:** When a recipe ingredient is checked off and `pantry_item_id` is **null** (no pantry match): insert a new `pantry_items` row using the ingredient name, purchased quantity, and unit from the shopping list item. The user builds their pantry organically from shopping.

**D-05:** After the user enters purchased quantity for a low-stock pantry item, set the item's quantity to the purchased amount directly (not existing + purchased, not threshold+1). `new_qty = purchased_qty`.

**D-06:** Implement `pantry_log_recipe_cooked` as a function in `backend/api/src/tools/pantry.ts`. It imports `nutrition_log_meal` from `./nutrition.js` — no HTTP round-trip for the inner nutrition log.

**D-07:** Register the tool in `registry.ts` with three coordinated edits: (1) add import from `./pantry.js`, (2) add executor to `executors` record, (3) add schema to `allToolSchemas` array. All three must be present — missing any one causes silent failure.

**D-08:** `RecipeConfirm.tsx` calls `POST /ai/tools/execute` with `{ tool: 'pantry_log_recipe_cooked', params: { recipe, servings, meal_type, macros_override } }` — reuses existing infrastructure, no new endpoint.

**DEBT-04:** VALIDATION.md for phases 06–09: read each phase's plan files and cross-check against live app state before writing. Treat as documentation — no code changes.

### Claude's Discretion

- `getOrFetchProduct(barcode, supabase)` utility location: `plugins/nutrition/src/utils/offApi.ts`, following the `barcode.ts` pattern from the pantry plugin. Takes `supabase` as a parameter.
- `food_products` table schema: minimal — `barcode`, `name`, `brand`, `energy_kcal`, `proteins_g`, `carbs_g`, `fat_g`, `nutriscore_grade`, `ecoscore_grade`, `image_url`, `serving_size_g` (parsed integer, default 100). No user_id.
- DEBT-04 VALIDATION.md: read each phase's plan files and cross-check against live app state before writing. Documentation only — no code changes.

### Deferred Ideas (OUT OF SCOPE)

None — PRD covers phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | User can scan a product barcode in the nutrition plugin to retrieve food data from Open Food Facts | `food_products` table + `offApi.ts` utility + `nutrition_logs` FK columns enable Phase 11 scanner UI |
| SCAN-03 | Scanned product data (Nutri-Score, Eco-Score) is preserved on the nutrition log entry for later display | Nullable `food_product_id` FK + `nutriscore_grade` + `ecoscore_grade` columns on `nutrition_logs` via migration 024 |
| DEBT-01 | Checking off a recipe ingredient from the shopping list prompts "how much did you buy?" and inserts or restocks the ingredient in the pantry | Replace silent `handleCheckOffRecipe` in `ShoppingList.tsx` with Modal prompt + conditional insert/update |
| DEBT-02 | Checking off a low-stock pantry item from the shopping list prompts for quantity instead of auto-restoring to threshold+1 | Replace silent `handleCheckOffPantry` in `ShoppingList.tsx` with Modal prompt + direct qty set |
| DEBT-03 | Recipe cooked confirmation uses `pantry_log_recipe_cooked` AI tool registered in `registry.ts`; direct Supabase call removed from `RecipeConfirm.tsx` | New function in `pantry.ts`, 3-touch-point registry wiring, RecipeConfirm.tsx calls `/ai/tools/execute` |
| DEBT-04 | VALIDATION.md files for phases 06, 07, 08, and 09 accurately reflect post-execution state | Phase 06 VALIDATION.md already exists; phases 07, 08, 09 need VALIDATION.md created |
</phase_requirements>

---

## Summary

Phase 10 is a pure foundation and cleanup phase — no new UI screens, no new user-visible features. It delivers five concrete artefacts: (1) a new Supabase migration that adds `food_products` table and extends `nutrition_logs`, (2) a frontend caching utility `offApi.ts` in the nutrition plugin, (3) a rewritten `ShoppingList.tsx` with quantity Modal replacing two silent check-off handlers, (4) a new `pantry_log_recipe_cooked` AI tool registered in `registry.ts` with direct Supabase removed from `RecipeConfirm.tsx`, and (5) VALIDATION.md documentation for phases 07, 08, 09 (phase 06 already has one).

All implementation targets are already identified through direct codebase inspection. The code to modify is small and precise: two functions in one screen file (ShoppingList), one new function in one backend file (pantry.ts), three additions in registry.ts, one fetch-based frontend utility to create, one SQL migration, and three documentation files. No external library installations are required for any item.

**Primary recommendation:** Deliver in three plans: Plan 1 (DB migration + offApi.ts utility), Plan 2 (DEBT-01 + DEBT-02 ShoppingList Modal), Plan 3 (DEBT-03 registry migration + DEBT-04 VALIDATION.md files). Each plan is independently verifiable and has no circular dependencies.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | existing | DB migrations, cache reads/writes | Project standard for all DB work |
| React Native `Modal` | built-in RN | Inline quantity prompt overlay | Locked by D-01; no new package |
| `fetch` | native | OFF API HTTP call in `offApi.ts` | Same pattern as existing `barcode.ts` |

### No New Dependencies

This phase has zero new npm packages. The `offApi.ts` utility uses native `fetch` (same as `barcode.ts`). The Modal is from React Native core. The tool registration uses the existing Hono + registry pattern.

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: Supabase Migration Numbering

The last migration is `023_shopping_list.sql`. The next migration is **024**.

```
supabase/migrations/
  023_shopping_list.sql     ← last existing
  024_food_products.sql     ← new for this phase
```

Migration 024 must create the `food_products` table and extend `nutrition_logs`. Two things in one migration, or two separate migrations (024 + 025) — both acceptable, but one migration keeps the atomic guarantee.

### Pattern 2: food_products RLS — DIVERGES from all 23 prior migrations

**CRITICAL: `food_products` is a shared product catalogue with no `user_id` column.**

Every prior migration uses `auth.uid() = user_id` in its RLS policy. Copying any existing migration template silently blocks all reads from `food_products`.

Correct RLS for `food_products`:
```sql
-- Source: STATE.md [v1.2 Roadmap] decisions
ALTER TABLE public.food_products ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read the catalogue
CREATE POLICY "food_products_read" ON public.food_products
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: any authenticated user can add a new product (populate from scan)
CREATE POLICY "food_products_insert" ON public.food_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

Do NOT use `auth.uid() = user_id` — there is no `user_id` column on this table.

### Pattern 3: nutrition_logs Extension — nullable FK only

`nutrition_logs` currently has no product link. The migration adds three nullable columns:

```sql
-- Source: 003_nutrition_schema.sql inspection + CONTEXT.md specifics
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS food_product_id UUID REFERENCES public.food_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT,
  ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT;
```

All three columns are nullable — manual entries (no barcode) must continue to work without modification. No existing queries need changing.

### Pattern 4: offApi.ts — Get-or-Fetch Cache Pattern

The utility lives at `plugins/nutrition/src/utils/offApi.ts`. It takes `supabase` as a parameter (standard plugin pattern, same as every plugin screen).

```typescript
// Source: CONTEXT.md specifics + barcode.ts inspection
const OFF_PRODUCTION_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_fr,nutriments,nutriscore_grade,ecoscore_grade,image_front_small_url,serving_size,brands`;

export async function getOrFetchProduct(barcode: string, supabase: any): Promise<FoodProduct | null> {
  // 1. Check Supabase cache first
  const { data: cached } = await supabase
    .from('food_products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  if (cached) return cached;

  // 2. Fetch from Open Food Facts production
  const res = await fetch(OFF_PRODUCTION_URL(barcode));
  const json = await res.json();
  if (json.status !== 1) return null;

  // 3. Parse and normalize
  const p = json.product;
  const servingRaw: string | undefined = p.serving_size;
  const servingMatch = servingRaw?.match(/([\d.]+)\s*g/i);
  const serving_size_g = servingMatch ? Math.round(parseFloat(servingMatch[1])) : 100;

  const ecoscore = p.ecoscore_grade ?? null;
  const ecoscore_grade = (ecoscore === 'not-applicable' || ecoscore === 'unknown') ? null : ecoscore;

  const product: Omit<FoodProduct, 'id' | 'created_at'> = {
    barcode,
    name: p.product_name_fr ?? p.product_name ?? barcode,
    brand: p.brands ?? null,
    energy_kcal: Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
    proteins_g: p.nutriments?.proteins_100g ?? 0,
    carbs_g: p.nutriments?.carbohydrates_100g ?? 0,
    fat_g: p.nutriments?.fat_100g ?? 0,
    nutriscore_grade: p.nutriscore_grade ?? null,
    ecoscore_grade,
    image_url: p.image_front_small_url ?? null,
    serving_size_g,
  };

  // 4. Insert into cache (best-effort, don't throw on conflict)
  const { data: inserted } = await supabase
    .from('food_products')
    .insert(product)
    .select()
    .maybeSingle();

  return inserted ?? (product as FoodProduct);
}
```

**Key parsing rules (from CONTEXT.md specifics):**
- `serving_size` is free text — extract grams via `/([\d.]+)\s*g/i`, default `100` on failure; never let NaN reach DB insert
- `ecoscore_grade` can return `'a-plus'` (valid, store as-is), `'not-applicable'` (store null), `'unknown'` (store null)
- Use `nutriments['energy-kcal_100g']` for calories (not `energy_100g` which is in kJ)

### Pattern 5: Registry 3-Touch-Point Rule

`registry.ts` requires exactly three coordinated edits for any new tool. All existing 25+ tool registrations use this pattern. Missing any one touch point produces silent failure (tool not found returns 404 at runtime).

```typescript
// Touch point 1: Import at top of registry.ts
// (PantryTools is ALREADY imported — no new import line needed)
import * as PantryTools from './pantry.js';  // already present

// Touch point 2: executor record (add to executors object)
const executors: Record<string, ToolExecutor['execute']> = {
  // ... existing entries ...
  pantry_log_recipe_cooked: PantryTools.pantry_log_recipe_cooked,  // NEW
};

// Touch point 3: allToolSchemas array (add a new pantryToolSchemas entry or append to existing)
const pantryToolSchemas: AITool[] = [
  // ... existing pantry_get_items, pantry_update_item schemas ...
  {
    name: 'pantry_log_recipe_cooked',
    description: 'Confirm a cooked recipe: logs macros to nutrition and decrements pantry quantities for used ingredients.',
    parameters: {
      type: 'object',
      properties: {
        recipe: { type: 'string', description: 'JSON-encoded Recipe object' },
        servings: { type: 'integer', description: 'Number of servings cooked' },
        meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        macros_override: { type: 'string', description: 'Optional JSON with override values: {calories, protein_g, carbs_g, fat_g}' },
      },
      required: ['recipe', 'servings', 'meal_type'],
    },
  },
];
```

Note: `import * as PantryTools from './pantry.js'` is ALREADY in registry.ts (line 12). Only touch points 2 and 3 need adding.

### Pattern 6: pantry_log_recipe_cooked Function Implementation

```typescript
// Source: CONTEXT.md D-06, D-08 + nutrition.ts inspection
// In backend/api/src/tools/pantry.ts
import { nutrition_log_meal } from './nutrition.js';  // direct import, no HTTP

export async function pantry_log_recipe_cooked(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { recipe: recipeStr, servings, meal_type, macros_override: overrideStr } = params as {
    recipe: string;
    servings: number;
    meal_type: string;
    macros_override?: string;
  };

  const recipe = JSON.parse(recipeStr);
  const ratio = servings / recipe.base_servings;
  const override = overrideStr ? JSON.parse(overrideStr) : {};

  // 1. Log nutrition (direct function call — no HTTP round-trip)
  await nutrition_log_meal({
    meal_type,
    food_name: recipe.name,
    calories: override.calories ?? Math.round(recipe.macros.calories * ratio),
    protein_g: override.protein_g ?? Math.round(recipe.macros.protein_g * ratio),
    carbs_g: override.carbs_g ?? Math.round(recipe.macros.carbs_g * ratio),
    fat_g: override.fat_g ?? Math.round(recipe.macros.fat_g * ratio),
  }, userId, userToken);

  // 2. Pantry decrement — best-effort per-ingredient (same logic as RecipeConfirm.tsx)
  // ... (mirror existing decrement logic from RecipeConfirm.tsx)

  return { success: true, recipe_name: recipe.name };
}
```

### Pattern 7: RecipeConfirm.tsx Migration to /ai/tools/execute

**CRITICAL: The actual endpoint signature uses `tool_name` and `parameters`, NOT `tool` and `params` as stated in CONTEXT.md D-08.**

Inspecting `backend/api/src/routes/ai.ts` line 115:
```typescript
const { tool_name, parameters = {} } = await c.req.json<{ tool_name: string; parameters?: ... }>();
```

Therefore `RecipeConfirm.tsx` must call:
```typescript
// Source: ai.ts routes inspection — endpoint reads tool_name + parameters
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch(`${apiUrl}/ai/tools/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  },
  body: JSON.stringify({
    tool_name: 'pantry_log_recipe_cooked',
    parameters: {
      recipe: JSON.stringify(recipe),
      servings,
      meal_type: mealType,
      macros_override: JSON.stringify({ calories: parseInt(calories,10), protein_g: parseFloat(protein), carbs_g: parseFloat(carbs), fat_g: parseFloat(fat) }),
    },
  }),
});
if (!res.ok) throw new Error('Tool execution failed');
```

After removing all direct Supabase calls from `handleConfirm`, the function body reduces to: get session, call `/ai/tools/execute`, navigate on success.

### Pattern 8: ShoppingList Modal UX

Both `handleCheckOffPantry` and `handleCheckOffRecipe` need replacement. The new pattern:

1. User taps item → state flag set (`pendingItem` + `pendingType`)
2. Modal renders with `TextInput` (numeric keyboard), unit label from item, Confirm / Cancel buttons
3. Cancel: clear pending state, item stays in list
4. Confirm: validate non-empty non-NaN input, call appropriate Supabase logic, remove item from list

```typescript
// State shape needed in ShoppingList component
const [pendingPantry, setPendingPantry] = useState<PantryItem | null>(null);
const [pendingRecipe, setPendingRecipe] = useState<ShoppingListItem | null>(null);
const [qtyInput, setQtyInput] = useState('');
const [modalVisible, setModalVisible] = useState(false);
```

The Modal must show unit from the item:
- For `PantryItem` (low-stock): `item.unit`
- For `ShoppingListItem` (recipe): `item.unit ?? ''`

### Pattern 9: DEBT-04 VALIDATION.md Scope

Phase 06 already has `06-VALIDATION.md`. Phases 07, 08, 09 need VALIDATION.md files created.

Phase 09 special case: Plan 09-03-PLAN.md exists but has no 09-03-SUMMARY.md (plan is unexecuted per git status). The VALIDATION.md for Phase 09 must accurately reflect that Plan 03 is not yet executed — document what IS live vs what is pending.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| serving_size parsing | Custom parser | Regex `/([\d.]+)\s*g/i` with default 100 | OFF API returns free text like "30g", "1 serving (30 g)", "100ml" |
| ecoscore null handling | Conditional chain | Explicit `null` mapping for `'not-applicable'` and `'unknown'` | OFF returns string values that must not reach ScoreBadge unfiltered |
| Tool registration | Custom discovery mechanism | 3-touch-point manual edit | Registry is explicit by design — no auto-discovery in this codebase |
| Nutrition log in tool | HTTP call to `/ai/chat` | Direct `nutrition_log_meal(params, userId, userToken)` import | No round-trip; same `db.clientForUser` pattern used everywhere |
| Modal quantity validation | Complex form library | `isNaN(parseFloat(input))` guard | Single numeric field; no library needed |

---

## Common Pitfalls

### Pitfall 1: food_products RLS uses wrong pattern
**What goes wrong:** Developer copies any existing migration → RLS uses `auth.uid() = user_id` → all SELECT queries return empty results because `food_products` has no `user_id` column.
**Why it happens:** All 23 prior migrations use the same user-scoped RLS template. `food_products` is the only shared-catalogue table in the project.
**How to avoid:** Use `auth.role() = 'authenticated'` for both SELECT and INSERT. Explicitly document the divergence in the migration comment.
**Warning signs:** `getOrFetchProduct` always hits the network (never returns from cache) — cache INSERT succeeded but SELECT returns nothing due to RLS mismatch.

### Pitfall 2: D-08 parameter name mismatch
**What goes wrong:** CONTEXT.md D-08 says call with `{ tool: '...', params: {...} }` but the actual endpoint (`/ai/tools/execute`) reads `tool_name` and `parameters`. Calling with wrong keys causes a 400 error.
**Why it happens:** D-08 decision was written from memory, not from inspecting the actual route handler.
**How to avoid:** Use `{ tool_name: 'pantry_log_recipe_cooked', parameters: {...} }` — verified from `backend/api/src/routes/ai.ts` line 115.
**Warning signs:** Response is `{ error: 'tool_name is required' }` with HTTP 400.

### Pitfall 3: pantry_log_recipe_cooked missing import in pantry.ts
**What goes wrong:** `pantry_log_recipe_cooked` calls `nutrition_log_meal` but doesn't import it. TypeScript will catch this at compile time, but only if `npm run type-check` is run.
**Why it happens:** `pantry.ts` currently has no imports from other tool files — it only imports `clientForUser`. The new function is the first cross-tool dependency in this file.
**How to avoid:** Add `import { nutrition_log_meal } from './nutrition.js';` at the top of `pantry.ts`.
**Warning signs:** TypeScript error `Cannot find name 'nutrition_log_meal'` in pantry.ts.

### Pitfall 4: registry.ts touch point 1 is already done
**What goes wrong:** Developer adds a NEW `import * as PantryTools` line, creating a duplicate import.
**Why it happens:** The 3-touch-point rule normally requires adding the import. But `import * as PantryTools from './pantry.js'` is already on line 12 of `registry.ts`.
**How to avoid:** Only add touch points 2 (executor) and 3 (schema). Do NOT add another import line.
**Warning signs:** TypeScript error about duplicate identifier `PantryTools`.

### Pitfall 5: NaN from serving_size reaching the database
**What goes wrong:** OFF API returns `serving_size: "1 serving"` with no gram value → regex fails → `parseFloat(null)` → NaN → DB insert rejects NUMERIC column.
**Why it happens:** `serving_size` field in OFF API is undisciplined free text.
**How to avoid:** Always default to `100` when regex returns no match: `const servingMatch = raw?.match(/([\d.]+)\s*g/i); const serving_size_g = servingMatch ? Math.round(parseFloat(servingMatch[1])) : 100;`
**Warning signs:** `food_products` insert fails with column type error on `serving_size_g`.

### Pitfall 6: Phase 09 VALIDATION.md documents unexecuted plan as complete
**What goes wrong:** Plan 09-03 exists but has no SUMMARY.md (git status confirms unexecuted). VALIDATION.md incorrectly marks it as complete.
**Why it happens:** The roadmap shows 3 plans for Phase 9 but only 2 have SUMMARY.md files.
**How to avoid:** For Phase 09 VALIDATION.md, check which plans have SUMMARY.md files before writing. Only validate against plans that have SUMMARY.md.
**Warning signs:** VALIDATION.md claims "09-03 complete" but `09-03-SUMMARY.md` does not exist.

### Pitfall 7: Modal cancel leaves local state inconsistent
**What goes wrong:** User taps item → pending state set → cancels → `pendingRecipe` not cleared → subsequent taps open modal pre-filled with previous item.
**Why it happens:** Cancel handler only hides the modal but doesn't clear `pendingRecipe`/`pendingPantry` and `qtyInput`.
**How to avoid:** Cancel handler must: `setModalVisible(false); setPendingRecipe(null); setPendingPantry(null); setQtyInput('');`

---

## Code Examples

### food_products table definition

```sql
-- Source: CONTEXT.md decisions + STATE.md v1.2 Roadmap notes
-- 024_food_products.sql
CREATE TABLE IF NOT EXISTS public.food_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode         TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  brand           TEXT,
  energy_kcal     INTEGER NOT NULL DEFAULT 0,
  proteins_g      NUMERIC(6, 2) NOT NULL DEFAULT 0,
  carbs_g         NUMERIC(6, 2) NOT NULL DEFAULT 0,
  fat_g           NUMERIC(6, 2) NOT NULL DEFAULT 0,
  nutriscore_grade TEXT,
  ecoscore_grade   TEXT,
  image_url        TEXT,
  serving_size_g   INTEGER NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared catalogue: no user_id — RLS uses auth.role() = 'authenticated'
ALTER TABLE public.food_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_products_read" ON public.food_products
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "food_products_insert" ON public.food_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- nutrition_logs extension (nullable FK, nullable score columns)
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS food_product_id UUID REFERENCES public.food_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT,
  ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT;
```

### handleCheckOffPantry replacement (DEBT-02)

```typescript
// Source: ShoppingList.tsx inspection + CONTEXT.md D-05
// Tap → show modal. Confirm → set new_qty = purchased_qty directly.
function handleCheckOffPantryTap(item: PantryItem) {
  setPendingPantry(item);
  setQtyInput('');
  setModalVisible(true);
}

async function confirmCheckOffPantry(purchased: number) {
  if (!pendingPantry) return;
  const item = pendingPantry;
  setModalVisible(false);
  setPendingPantry(null);
  setQtyInput('');
  setLowStockPantry((prev) => prev.filter((i) => i.id !== item.id));
  try {
    await supabase.from('pantry_items').update({ quantity: purchased }).eq('id', item.id);
    updateItem(item.id, { quantity: purchased });
  } catch {
    setLowStockPantry((prev) => [item, ...prev]);
    showAlert(t('pantry.error_save_title'), t('pantry.shop_error_checkoff'));
  }
}
```

### handleCheckOffRecipe replacement (DEBT-01)

```typescript
// Source: ShoppingList.tsx inspection + CONTEXT.md D-03, D-04
// tap → show modal. Confirm → upsert pantry, then delete shopping item.
async function confirmCheckOffRecipe(purchased: number) {
  if (!pendingRecipe) return;
  const item = pendingRecipe;
  setModalVisible(false);
  setPendingRecipe(null);
  setQtyInput('');
  removeShoppingItem(item.id);
  try {
    if (item.pantry_item_id) {
      // D-03: match exists — add to existing qty
      const { data: existing } = await supabase
        .from('pantry_items').select('quantity').eq('id', item.pantry_item_id).single();
      const newQty = (existing?.quantity ?? 0) + purchased;
      await supabase.from('pantry_items').update({ quantity: newQty }).eq('id', item.pantry_item_id);
      updateItem(item.pantry_item_id, { quantity: newQty });
    } else {
      // D-04: no match — insert new pantry item
      await supabase.from('pantry_items').insert({
        user_id: item.user_id,
        name: item.name,
        quantity: purchased,
        unit: item.unit ?? 'g',
        storage_location: 'pantry',
        food_category: 'other',
        low_stock_threshold: 1,
      });
    }
    await supabase.from('shopping_list_items').delete().eq('id', item.id);
  } catch {
    addShoppingItem(item);
    showAlert(t('pantry.error_save_title'), t('pantry.shop_error_checkoff'));
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Silent threshold+1 restock (SHOP-03 v1.1 spec) | Quantity prompt Modal (DEBT-01/02) | More accurate pantry data; user controls what was actually purchased |
| Direct Supabase in RecipeConfirm.tsx | `/ai/tools/execute` call | AI can trigger same flow; tool testable independently |
| barcode.ts uses `.net` (staging) | offApi.ts uses `.org` (production) | Production data; broader product coverage |
| No product cache | `food_products` Supabase table | Second scan hits DB only; no repeated OFF API calls |

---

## Open Questions

1. **Phase 09 Plan 03 execution status**
   - What we know: `09-03-PLAN.md` exists, `09-03-SUMMARY.md` does NOT exist, git status lists 09-01, 09-02, 09-03 PLAN.md as untracked (newly created).
   - What's unclear: Whether Plan 03 code was executed (Expo Router wrapper + manifest route + i18n keys for shopping list) without a SUMMARY.md being written, or truly not run.
   - Recommendation: Before writing Phase 09 VALIDATION.md (DEBT-04), check whether the shopping list Expo Router wrapper `app/(app)/(plugins)/pantry/shopping.tsx` and manifest route exist in the live codebase. Gate the VALIDATION.md accordingly.

2. **`pantry_log_recipe_cooked` parameters: complex JSON vs flat fields**
   - What we know: The tool receives `recipe` as a JSON string (workaround for AI SDK's lack of nested object support in tool schemas). `nutrition_log_meal` accepts flat fields.
   - What's unclear: Whether the AI would ever invoke `pantry_log_recipe_cooked` directly, or only `RecipeConfirm.tsx` does via `/ai/tools/execute`. If AI-invocable, the JSON string param approach is the right call (consistent with how `app_navigate` handles params).
   - Recommendation: Keep `recipe` as a JSON string param as stated in CONTEXT.md D-08. Document this in the tool schema description.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 10 is code and config changes only. No external CLI tools, services, or runtimes beyond the project's existing Supabase + Node.js + Expo stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc`) via `npm run type-check` |
| Config file | `tsconfig.json` in each package |
| Quick run command | `cd /c/ziko-platform && npm run type-check` |
| Full suite command | `cd /c/ziko-platform && npm run type-check` |

No Jest / Vitest configured in this project. Validation is manual inspection + TypeScript compile + human UAT.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-01 | `food_products` table exists in DB | manual | verify migration file exists | Wave 0 — migration to write |
| SCAN-03 | `nutrition_logs` has nullable FK + score columns | manual | verify migration file exists | Wave 0 — migration to write |
| DEBT-01 | Recipe checkoff shows Modal, inserts/updates pantry | manual UAT | `npm run type-check` | Wave 0 — ShoppingList.tsx to modify |
| DEBT-02 | Low-stock checkoff shows Modal, sets exact qty | manual UAT | `npm run type-check` | Wave 0 — ShoppingList.tsx to modify |
| DEBT-03 | `pantry_log_recipe_cooked` registered in registry.ts | manual + compile | `npm run type-check` | Wave 0 — registry.ts to modify |
| DEBT-04 | VALIDATION.md for phases 07–09 | documentation | N/A — no automated test | Wave 0 — files to write |

### Sampling Rate
- **Per task commit:** `cd /c/ziko-platform && npm run type-check`
- **Per wave merge:** `cd /c/ziko-platform && npm run type-check`
- **Phase gate:** Type-check green + human UAT of Modal prompt + tool execution before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `supabase/migrations/024_food_products.sql` — covers SCAN-01, SCAN-03
- [ ] `plugins/nutrition/src/utils/offApi.ts` — covers SCAN-01 utility layer
- [ ] `plugins/pantry/src/screens/ShoppingList.tsx` (modify) — covers DEBT-01, DEBT-02
- [ ] `backend/api/src/tools/pantry.ts` (modify) — covers DEBT-03
- [ ] `backend/api/src/tools/registry.ts` (modify) — covers DEBT-03
- [ ] `plugins/pantry/src/screens/RecipeConfirm.tsx` (modify) — covers DEBT-03
- [ ] `.planning/phases/07-ai-recipe-suggestions/07-VALIDATION.md` — covers DEBT-04
- [ ] `.planning/phases/08-calorie-tracker-sync/08-VALIDATION.md` — wait, this already exists
- [ ] `.planning/phases/09-smart-shopping-list/09-VALIDATION.md` — covers DEBT-04

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `plugins/pantry/src/screens/ShoppingList.tsx` — current check-off implementation
- Direct codebase inspection: `plugins/pantry/src/screens/RecipeConfirm.tsx` — direct Supabase calls to migrate
- Direct codebase inspection: `backend/api/src/tools/registry.ts` — 3-touch-point pattern, existing PantryTools import
- Direct codebase inspection: `backend/api/src/tools/pantry.ts` — existing tool pattern to extend
- Direct codebase inspection: `backend/api/src/tools/nutrition.ts` — `nutrition_log_meal` function signature
- Direct codebase inspection: `backend/api/src/routes/ai.ts` — `/ai/tools/execute` reads `tool_name` + `parameters`
- Direct codebase inspection: `plugins/pantry/src/utils/barcode.ts` — `offApi.ts` template (uses .net staging)
- Direct codebase inspection: `supabase/migrations/003_nutrition_schema.sql` — `nutrition_logs` columns to extend
- Direct codebase inspection: `supabase/migrations/023_shopping_list.sql` — last migration, next is 024
- `.planning/phases/10-data-foundation-tech-debt/10-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — v1.2 Roadmap decisions: RLS pattern, offApi.ts URL, ecoscore edge cases
- `packages/plugin-sdk/src/i18n.ts` — existing `pantry.shop_*` key namespace (new modal keys need adding)

### Tertiary (LOW confidence — needs human verification)
- Phase 09 execution status: `09-03-PLAN.md` exists without `09-03-SUMMARY.md` — unclear if code was executed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tools already in project
- Architecture: HIGH — all patterns verified by direct source code inspection
- Pitfalls: HIGH — pitfalls sourced from actual code found in the files (D-08 mismatch is a real divergence between CONTEXT.md and live ai.ts)
- Phase 09 status: LOW — needs human confirmation before DEBT-04 VALIDATION.md is written

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable codebase; no external API changes expected within 30 days)
