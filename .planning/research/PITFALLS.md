# Domain Pitfalls: Barcode Enrichment + Tech Debt (v1.2)

**Domain:** Open Food Facts barcode enrichment added to existing nutrition plugin; v1.1 tech debt (SHOP-03 fix, pantry AI tool, Nyquist VALIDATION.md files)
**Researched:** 2026-04-02
**Confidence:** HIGH — synthesized from Stack/Features/Architecture research outputs + open questions flagged by all three researchers

---

## Summary

The v1.2 feature (barcode enrichment) has three distinct failure surfaces:
1. **OFF API reliability** — missing data, wrong field names, staging vs production URL
2. **Data layer** — food_products RLS is unlike every other table (no user_id), nutrition_logs FK must be nullable, score staleness over time
3. **UI layer** — serving size free-text parsing, ecoscore_grade value format, absent scores must not break the UI

The tech debt items have their own smaller risk surface: the SHOP-03 fix can create duplicate pantry inserts if not deduped, and building `pantry_log_recipe_cooked` as a real AI tool requires three coordinated touch points in `registry.ts`.

---

## Pitfalls by Category

---

### Category 1: Open Food Facts API — Data Reliability

#### Pitfall 1.1 — `.net` vs `.org` Domain (Staging vs Production)

**What goes wrong:** The existing `plugins/pantry/src/utils/barcode.ts` calls `https://world.openfoodfacts.net/api/v2/product/...` — the `.net` domain is the OFF staging environment. The nutrition plugin's new `offApi.ts` utility must use `https://world.openfoodfacts.org/api/v2/product/...` (production). Using `.net` in production returns incomplete or test data.

**Why it happens:** The pantry barcode utility was written against staging for development and never updated. Copying it as a template carries the staging URL forward.

**Prevention:**
- In `plugins/nutrition/src/utils/offApi.ts`, hardcode `.org` explicitly: `const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';`
- Add a code comment: `// NOTE: pantry/barcode.ts uses .net (staging) — this file intentionally uses .org (production)`
- Do not "fix" the pantry utility as part of this milestone — that's a separate change with its own testing surface.

**Phase:** Phase 10 (data layer / OFF API utility).

---

#### Pitfall 1.2 — `image_front_url` Field Name Is MEDIUM Confidence

**What goes wrong:** The OFF API tutorial does not explicitly document `image_front_url` as the canonical field name. Community usage is consistent, but the field could vary by product category. Using the wrong field name returns `undefined` and the product photo is always blank.

**Why it happens:** OFF has inconsistent documentation. Some products expose `image_url`, others `image_front_url`, others `image_front_small_url`. The `image_front_small_url` field has higher coverage than `image_front_url` for food products.

**Prevention:**
- Use `image_front_small_url` as primary, fall back to `image_front_url`, then `image_url`. Store whichever is non-null.
- Validate against a real product on first implementation: `GET .../product/3017624010701.json` (Nutella — high data quality).
- `photo_url` in `food_products` is nullable — always handle `null` gracefully (show a placeholder icon, not a broken image).

**Phase:** Phase 10 (data layer).

---

#### Pitfall 1.3 — Product Not Found (OFF Coverage Gap)

**What goes wrong:** OFF has ~3.5M products, strong EU coverage, but gaps in store brands, fresh produce, and some Asian/US products. When a barcode returns HTTP 404 or `product.status === 0`, the scan appears to do nothing and the user has no fallback.

**Why it happens:** The app assumes every scan returns a product. No "not found" state is designed.

**Prevention:**
- Handle three states explicitly in `offApi.ts`: `{ status: 'found', product }`, `{ status: 'not_found' }`, `{ status: 'error', message }`.
- On `not_found`: show inline message "Product not in Open Food Facts — enter details manually" and open the manual entry form pre-filled with nothing (same form used for non-scanned meals).
- Never throw or crash on a missing product — OFF coverage gaps are expected.

**Phase:** Phase 10 (data layer + product card UI).

---

#### Pitfall 1.4 — `ecoscore_grade` Returns `'a-plus'` and `'not-applicable'`

**What goes wrong:** The `ScoreBadge` component renders grades A–E using a color map keyed by single letter. But `ecoscore_grade` from OFF can return `'a-plus'` (a valid "better than A" grade for some products) and `'not-applicable'` (water, salt, etc.). Neither maps to the A/B/C/D/E palette and the badge renders blank or crashes with a style lookup failure.

**Why it happens:** The OFF Eco-Score specification includes `a-plus` as a distinct grade above A. This is not mentioned in most tutorial examples.

**Prevention:**
- Map `'a-plus'` to the same color as `'a'` (dark green `#1E8348`) and display as "A+" text.
- Map `'not-applicable'` and any unknown value to `null` — hide the Eco-Score badge entirely, don't render a broken chip.
- Do NOT add a `CHECK` constraint on `ecoscore_grade` column — the free-form field needs to store whatever OFF returns.
- Pattern: `const ecoColor = ECOSCORE_COLORS[grade?.toLowerCase()] ?? null; if (!ecoColor) return null;`

**Phase:** Phase 11 (ScoreBadge component).

---

### Category 2: Data Layer — Database and RLS Design

#### Pitfall 2.1 — `food_products` RLS Cannot Use `auth.uid() = user_id` Pattern

**What goes wrong:** Every other table in the project uses `auth.uid() = user_id` for RLS. `food_products` is a shared global catalogue with no `user_id`. Applying the standard pattern blocks all reads — the publishable key returns 0 rows for every SELECT. The product card never loads.

**Why it happens:** Copy-pasting the RLS block from any other migration without adapting it to the shared-catalogue pattern.

**Prevention:**
- RLS policy for `food_products` must allow ANY authenticated user to SELECT, but only authenticated users to INSERT/UPDATE:
  ```sql
  ALTER TABLE public.food_products ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "food_products_read" ON public.food_products
    FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "food_products_insert" ON public.food_products
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  CREATE POLICY "food_products_update" ON public.food_products
    FOR UPDATE USING (auth.role() = 'authenticated');
  ```
- Verify with a SELECT after migration: the mobile client using the publishable key must return rows.

**Phase:** Phase 10 (migration 024).

---

#### Pitfall 2.2 — `nutrition_logs.food_product_id` FK Must Be Nullable

**What goes wrong:** The column is defined as `NOT NULL` (accidentally, or to match the FK convention from other tables). Every existing nutrition log entry has no barcode product — the migration or ALTER TABLE fails, or all existing rows fail the constraint check.

**Why it happens:** FK columns on join tables are often written as NOT NULL by convention. Here the FK is enrichment-only; most logs will never have a product.

**Prevention:**
- Define: `food_product_id UUID REFERENCES public.food_products(id) ON DELETE SET NULL`
- No `NOT NULL` constraint. Existing rows have `food_product_id = NULL` and that is correct.
- All display logic must treat `NULL` food_product_id as "manually entered meal — no scores to show."

**Phase:** Phase 10 (migration 025).

---

#### Pitfall 2.3 — Nutri-Score Grade Staleness (2024 Algorithm Revision)

**What goes wrong:** The Nutri-Score algorithm was revised in 2024, affecting ~40% of products. A product scanned before the revision has a cached grade that no longer matches its current OFF value. The user sees a C where the product is now a B.

**Why it happens:** `food_products` caches the OFF response at scan time. Without a `cached_at` timestamp and refresh logic, the catalogue never updates.

**Prevention:**
- Add `cached_at TIMESTAMPTZ DEFAULT now()` to `food_products`.
- On a scan hit (barcode already in `food_products`), check `cached_at < now() - interval '90 days'`. If stale, re-fetch from OFF and update the row before returning to the UI.
- This is a background concern — implement as a silent re-fetch, not a blocking operation. Show cached data immediately, update if stale.

**Phase:** Phase 10 (data layer — add column; refresh logic can be Phase 11 or deferred).

---

### Category 3: UI Layer — Product Card and Score Display

#### Pitfall 3.1 — Serving Size Is a Free-Text String

**What goes wrong:** OFF `serving_size` is a free-text field: `"1 biscuit (30g)"`, `"250 ml"`, `"1 tranche (35g)"`. The ProductCard serving adjuster tries to parse a gram value from this string. Parsing fails for `"1 biscuit"`, the serving size shows 0g or NaN, and macro calculation divides by zero.

**Why it happens:** OFF provides human-readable labels, not structured numeric data. There is no `serving_size_g` integer field.

**Prevention:**
- Default to 100g serving if `serving_size` parsing fails — OFF macros are per 100g, so 100g is always a valid and meaningful default.
- Parse using regex: extract the first parenthesized number: `/([\d.]+)\s*g/i`. If no match, use 100.
- Display: if serving_size is non-null, show it as a hint label below the stepper. If null, show "per 100g".
- Never crash or show NaN — the 100g fallback must be the failure mode.

**Phase:** Phase 11 (ProductCard component).

---

#### Pitfall 3.2 — Dashboard Score Average Divides by Zero on Days With No Scanned Meals

**What goes wrong:** The nutrition dashboard computes a daily Nutri-Score average. On days where all meals were manually entered (no barcodes), `nutriscore_grade` is null on all `nutrition_logs` rows. Averaging over an empty set returns NaN or crashes.

**Why it happens:** The average score widget assumes at least one scanned meal per day.

**Prevention:**
- Filter `nutrition_logs` rows where `nutriscore_grade IS NOT NULL` before computing the average.
- If no scanned meals exist for the day, hide the average score widget entirely (not show 0 or N/A).
- Pattern: `const scoredMeals = todayLogs.filter(l => l.nutriscore_grade); if (scoredMeals.length === 0) return null;`

**Phase:** Phase 11 (NutritionDashboard score widget).

---

### Category 4: Tech Debt — SHOP-03 Fix

#### Pitfall 4.1 — Recipe Check-Off Creates Duplicate Pantry Inserts

**What goes wrong:** `handleCheckOffRecipe()` is triggered on every tap of the check-off button. If the user taps twice (network latency, optimistic UI), the "how much did you buy?" prompt fires twice and two pantry rows are created for the same ingredient.

**Why it happens:** No in-flight guard on the check-off action.

**Prevention:**
- Disable the check-off button immediately on first tap (set a local loading state) before showing the prompt.
- On pantry insert: use `upsert` with `onConflict: 'user_id,name'` if a unique constraint exists on `(user_id, name)`, OR check for existing pantry item by name before inserting.
- The DB upsert is the safest idempotency guarantee: `supabase.from('pantry_items').upsert({ user_id, name, quantity: bought_qty }, { onConflict: 'user_id,name' })`

**Phase:** Phase 10 (SHOP-03 fix task).

---

### Category 5: Tech Debt — `pantry_log_recipe_cooked` as AI Tool

#### Pitfall 5.1 — Tool in Schema But Missing From `executors` (Silent Failure)

**What goes wrong:** The `pantry_log_recipe_cooked` tool is added to `allToolSchemas` in `registry.ts` but its handler is omitted from the `executors` record. The AI advertises the tool to Claude, but `getToolExecutor('pantry_log_recipe_cooked')` returns `undefined`. The agent silently fails with no visible error.

**Why it happens:** `registry.ts` requires three coordinated changes: import, `executors` entry, `allToolSchemas` entry. Adding to schema (more readable, at top of file) while forgetting `executors` (flat key-value record, further down) is the most common omission.

**Prevention:**
- After adding `pantry_log_recipe_cooked` to `pantry.ts`, verify all three locations in `registry.ts`: import line, `executors` record, `allToolSchemas` array.
- Validate via `POST /ai/tools/execute` with `{ tool: 'pantry_log_recipe_cooked', params: {...} }` before any end-to-end testing.
- The `RecipeConfirm.tsx` direct Supabase call must be REMOVED when the AI tool is added — otherwise both code paths can fire for the same recipe confirmation, resulting in a duplicate nutrition log.

**Phase:** Phase 10 (tech debt task).

---

## Phase Assignments

| Phase | Pitfalls Addressed | Key Actions |
|-------|--------------------|-------------|
| Phase 10 (data + debt) | 1.1, 1.3, 2.1, 2.2, 2.3, 4.1, 5.1 | OFF `.org` URL, product-not-found states, food_products RLS (authenticated read), nullable FK on nutrition_logs, cached_at column, SHOP-03 dedupe upsert, pantry AI tool 3-point registry check |
| Phase 11 (UI layer) | 1.2, 1.4, 3.1, 3.2 | image_front_small_url fallback chain, ecoscore 'a-plus'/'not-applicable' handling, serving size 100g fallback, dashboard score widget null guard |

**Cross-phase dependency:**
- Migration 024 (food_products) and 025 (nutrition_logs columns) must land before any UI work — the ProductCard and score badge components depend on the schema being in place.
- Remove direct Supabase call from RecipeConfirm.tsx in the SAME task that adds `pantry_log_recipe_cooked` to registry.ts — never have both active simultaneously.
