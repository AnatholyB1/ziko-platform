# Milestones

## v1.2 Barcode Enrichment + Tech Debt (Shipped: 2026-04-02)

**Phases completed:** 2 phases, 6 plans (Phases 10–11)

**Key accomplishments:**

1. **Data Foundation** — `food_products` shared-catalogue table (migration 024), `offApi.ts` caching utility (world.openfoodfacts.org, 7-day TTL), `nutrition_logs` extended with `food_product_id` FK + `nutriscore_grade` + `ecoscore_grade`
2. **Barcode Scan UI** — 4th tab in LogMealScreen with inline CameraView, product card (photo, name, brand, macros per 100g, Nutri-Score + Eco-Score badges), serving size adjuster, "product not found" fallback to manual entry
3. **Score Display** — Nutri-Score + Eco-Score pill badges on journal entry rows (barcode-logged meals only); daily average Nutri-Score widget on dashboard (hidden when no scanned meals)
4. **Tech Debt Closed** — SHOP-03 quantity prompt Modal; `pantry_log_recipe_cooked` AI tool registered; Nyquist VALIDATION.md for phases 07 + 09

---

## v1.1 Smart Pantry Plugin (Shipped: 2026-04-02)

**Phases completed:** 4 phases, 14 plans (Phases 6–9)

**Key accomplishments:**

1. **Smart Inventory** — full pantry CRUD with barcode scanner (Open Food Facts auto-fill), low-stock thresholds, storage location grouping (fridge / freezer / pantry), and expiry color indicators; `pantry_get_items` + `pantry_update_item` AI tools registered in backend
2. **AI Recipe Suggestions** — macro-aware recipe generation from pantry contents + remaining daily calorie budget via `generateObject`, serving size adjuster with client-side macro scaling, full recipe detail view
3. **Calorie Tracker Sync** — one-tap "I cooked this" → confirms macros to Nutrition plugin + decrements pantry quantities; nutrition-plugin gate via `.maybeSingle()`, `router.replace` to nutrition dashboard
4. **Smart Shopping List** — auto-populated from low-stock pantry items, recipe ingredient adder from RecipeDetail, optimistic check-off with pantry restore, native share sheet export

**Known tech debt (deferred to v1.2):**

- SHOP-03 recipe check-off does not insert into pantry for non-existing ingredients
- SHOP-03 pantry restore uses threshold+1 (not user-specified quantity)
- Stale/missing Nyquist VALIDATION.md files for phases 06–09

---
