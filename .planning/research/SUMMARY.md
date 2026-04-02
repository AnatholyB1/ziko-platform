# Project Research Summary

**Project:** Ziko Platform — v1.2 Barcode Enrichment + Tech Debt
**Domain:** Open Food Facts barcode enrichment in a React Native nutrition plugin; v1.1 tech debt closure
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

Milestone v1.2 adds barcode-driven food logging to the nutrition plugin by integrating the Open Food Facts v2 API. The feature chain is: camera scan → OFF API lookup → product card (Nutri-Score, Eco-Score, photo, macros) → serving adjustment → log. Research confirms this is a well-understood pattern with strong ecosystem precedent (Yuka, Cronometer) and that Ziko's existing code already supplies every primitive required. Zero new npm packages are needed — `expo-camera` (`~17.0.10`) and `expo-image` (`~3.0.11`) are installed, the pantry plugin's `BarcodeScanner.tsx` is reusable with a one-line callback extension, and `fetch()` covers the OFF API call directly from the mobile client.

The recommended implementation splits into two Supabase migrations (024 `food_products` shared catalogue, 025 `nutrition_logs` FK + denormalised score columns), followed by a utility layer (`offApi.ts`), stateless display components (`ScoreBadge`, `ProductCard`), and surgical edits to `LogMealScreen` and `NutritionDashboard`. The Hono backend is not involved — direct mobile-to-OFF calls are already proven by the pantry plugin, avoid the shared-IP rate-limit problem of a proxy, and add no latency. The v1.1 tech debt (SHOP-03, `pantry_log_recipe_cooked` AI tool, Nyquist VALIDATION.md files for phases 06–09) is bundled into Phase 10 alongside the data layer work.

The three highest-risk areas are: (1) `food_products` RLS must use `auth.role() = 'authenticated'` instead of the project-standard `auth.uid() = user_id` — copying any existing migration will silently block all reads; (2) `ecoscore_grade` returns `'a-plus'` and `'not-applicable'` which fall outside the A–E colour map — the `ScoreBadge` component must handle these gracefully before render; (3) `serving_size` is a free-text string — `offApi.ts` must default to 100g on parse failure rather than propagating NaN into macro calculations.

---

## Key Findings

### Recommended Stack

The milestone requires no new npm dependencies. All capabilities are already present in `apps/mobile/package.json`. The OFF API is a single GET with a `?fields=` query string — no SDK is warranted. `expo-image` provides LRU caching and BlurHash placeholders for product photos. Nutri-Score and Eco-Score badge components are 15-line inline `View`+`Text` constructs using NativeWind or inline style objects.

The one critical URL distinction: the existing `plugins/pantry/src/utils/barcode.ts` calls `world.openfoodfacts.net` (OFF staging). The new `plugins/nutrition/src/utils/offApi.ts` must use `world.openfoodfacts.org` (production). These two utilities remain independent — the pantry utility is not modified.

**Core technologies in use:**
- `expo-camera ~17.0.10`: barcode scanning via `CameraView` + `onBarcodeScanned` — reuse pantry's `BarcodeScanner.tsx` with one callback argument added
- `expo-image ~3.0.11`: product photo display with built-in LRU disk/memory cache and graceful null handling
- `fetch()` (built-in): OFF API v2 direct call from mobile — no CORS enforcement in React Native native builds
- `@supabase/supabase-js ^2.47.0`: `food_products` upsert cache + extended `nutrition_logs` insert
- `zustand ^5.0.0`: widen `NutritionEntry` type with `food_product_id?`, `nutriscore_grade?`, `ecoscore_grade?`

**Rejected options (do not revisit):**
- `react-native-vision-camera` — overkill; no frame-processor pipeline needed for EAN-13 food scanning
- Backend proxy for OFF calls — adds latency, concentrates rate-limit onto server IP, no security benefit
- Any OFF SDK or badge library — both are 10–15 line utilities that do not justify a dependency

### Expected Features

**Must have (table stakes):**
- Camera barcode scanner modal (reuse pantry `BarcodeScanner.tsx`, landscape scan frame for linear barcodes)
- OFF API lookup returning calories, protein, carbs, fat per 100g
- Product card shown before logging (photo, name, brand, macros, serving adjuster)
- Serving size adjustment with live-updating macro calculation (default 100g on parse failure)
- Fallback state for products not found in OFF (estimated ~30% gap in non-EU products)
- Log to `nutrition_logs` with nullable `food_product_id` FK
- Nutri-Score badge on product card (A–E letter with standardised colour)
- Persistent `food_products` shared catalogue (Supabase upsert on first scan; skip OFF call on cache hit)

**Should have (differentiators):**
- Eco-Score badge on product card alongside Nutri-Score (gracefully hidden if `'not-applicable'`)
- Product photo confirming correct product was scanned (`expo-image`, placeholder if absent)
- Nutri-Score badge on each `NutritionDashboard` journal entry row (from denormalised column)
- Daily average Nutri-Score summary widget on dashboard header (hidden if no scanned meals that day)
- AI coaching hook: `avg_nutriscore` added to `nutrition_get_today` user context payload (post-launch)

**Defer to v2+:**
- NOVA ultra-processing classification (user demand unvalidated)
- Allergen / ingredient list display (partial OFF data creates medical liability risk)
- Offline-first pre-downloaded product database segment
- Manual contribution of corrections back to OFF

### Architecture Approach

The architecture is strictly mobile-first: the mobile app calls OFF directly, upserts into a Supabase `food_products` shared catalogue, then logs to `nutrition_logs` with denormalised score columns. The Hono backend is untouched. The build order follows a strict dependency graph: migrations → utility + type widening → display components → LogMealScreen barcode tab → NutritionDashboard score display. Tech debt tasks are bundled with the migrations phase.

**Major components:**
1. `supabase/migrations/024_food_products.sql` — shared product catalogue, no `user_id`, RLS uses `auth.role() = 'authenticated'`
2. `supabase/migrations/025_nutrition_logs_scores.sql` — adds nullable FK `food_product_id` + denormalised `nutriscore_grade`, `ecoscore_grade` columns
3. `plugins/nutrition/src/utils/offApi.ts` (NEW) — `fetchOFFProduct()` + `getOrFetchProduct()` cache lookup; uses `.org` production URL; returns structured `OFFProduct | null`
4. `plugins/nutrition/src/components/ScoreBadge.tsx` (NEW) — stateless letter badge A–E with grade-to-colour map; returns `null` for `'a-plus'` (display as "A+" in `'a'` colour), `'not-applicable'`, and any unknown value
5. `plugins/nutrition/src/components/ProductCard.tsx` (NEW) — photo, Nutri-Score + Eco-Score badges, macros per 100g, serving weight input (default 100g), Log CTA
6. `plugins/pantry/src/screens/BarcodeScanner.tsx` (MINOR EDIT) — extend `onScan(name)` to `onScan(name, barcode)` — one argument added, backward-compatible
7. `plugins/nutrition/src/screens/LogMealScreen.tsx` (MODIFY) — add 4th "Barcode" tab; integrate `BarcodeScanner`, `getOrFetchProduct`, `ProductCard`; extend `saveLog()` with score fields
8. `plugins/nutrition/src/screens/NutritionDashboard.tsx` (MODIFY) — `<ScoreBadge>` on each log entry row; daily average Nutri-Score summary widget (null-guarded)
9. `plugins/nutrition/src/store.ts` (MODIFY) — widen `NutritionEntry` type

**Not modified:** `backend/api/`, `plugins/pantry/src/utils/barcode.ts`, `packages/plugin-sdk/`, `apps/mobile/src/lib/PluginLoader.tsx`, all other plugins.

### Critical Pitfalls

1. **`food_products` RLS cannot copy the standard `auth.uid() = user_id` pattern** — this table has no `user_id`. Use `auth.role() = 'authenticated'` for SELECT/INSERT/UPDATE. Applying the standard pattern silently returns 0 rows to the publishable-key client and the product card never loads.

2. **`ecoscore_grade` returns `'a-plus'` and `'not-applicable'`** — these fall outside the A–E colour map. Map `'a-plus'` to `'a'` colour and display "A+"; return `null` (hide badge entirely) for `'not-applicable'` and any unrecognised value. No `CHECK` constraint on `ecoscore_grade` column — store the raw OFF value.

3. **`serving_size` is free text, not a number** — OFF returns strings like `"1 biscuit (30g)"` or `"250 ml"`. Extract grams via regex `/([\d.]+)\s*g/i`, default to 100 on failure. Never let NaN reach the macro calculation or the log insert.

4. **Use `.org` not `.net` for production OFF calls** — `world.openfoodfacts.net` is the staging server. The pantry `barcode.ts` uses `.net`; the new `offApi.ts` must explicitly use `world.openfoodfacts.org` with a code comment explaining the intentional divergence.

5. **`pantry_log_recipe_cooked` AI tool requires three coordinated edits in `registry.ts`** — import, `executors` record entry, `allToolSchemas` array. Missing any one produces a silent failure (agent advertises the tool but execution returns `undefined`). Remove the direct Supabase call from `RecipeConfirm.tsx` in the same task — never have both active simultaneously.

---

## Implications for Roadmap

Research points to two phases for this milestone: one combining the data foundation with tech debt payoff, and one covering all UI work that depends on that foundation.

### Phase 10: Data Foundation + Tech Debt

**Rationale:** Migrations 024 and 025 are hard prerequisites for every UI component in Phase 11. Tech debt items (SHOP-03, `pantry_log_recipe_cooked`, VALIDATION.md files) have no UI dependencies and are cleanest to ship alongside schema work rather than as a separate phase. Bundling avoids a three-phase milestone for two distinct surfaces.

**Delivers:**
- `food_products` shared catalogue table with correct RLS (`auth.role() = 'authenticated'`, no `user_id`)
- `nutrition_logs` extended with nullable `food_product_id` FK + denormalised `nutriscore_grade` + `ecoscore_grade` columns
- `offApi.ts` utility: `fetchOFFProduct()` + `getOrFetchProduct()` with Supabase cache, `.org` production URL, `image_front_small_url ?? image_front_url ?? null` fallback chain
- `NutritionEntry` type widened in `store.ts`
- SHOP-03 fix: `handleCheckOffRecipe()` debounced on first tap + pantry upsert with `onConflict: 'user_id,name'`
- `pantry_log_recipe_cooked` registered as AI tool in `registry.ts` (all 3 touch points verified), direct Supabase call removed from `RecipeConfirm.tsx`
- VALIDATION.md files written for phases 06–09

**Addresses pitfalls:** 1.1 (`.org` URL), 1.3 (not-found handling), 2.1 (food_products RLS), 2.2 (nullable FK), 2.3 (cached_at column), 4.1 (SHOP-03 dedupe), 5.1 (AI tool 3-point registry check)

**Avoids:** Schema work being blocked by UI scope creep; RecipeConfirm double-logging if AI tool and direct Supabase call coexist

### Phase 11: Barcode UI + Score Display

**Rationale:** All UI work depends on the schema and utility established in Phase 10. Building display components before the data layer risks implementing against assumptions that migrations later invalidate. `NutritionDashboard` score display must come last within this phase — it requires logged entries with `nutriscore_grade` populated, which only exist after `LogMealScreen` barcode logging works end-to-end.

**Delivers:**
- `ScoreBadge.tsx` — stateless A–E badge with correct colour map and graceful handling of `'a-plus'` (→ "A+" in green), `'not-applicable'` (→ hidden), and `null` (→ hidden)
- `ProductCard.tsx` — photo, Nutri-Score + Eco-Score badges, macros per 100g, serving adjuster (100g default on parse failure), Log CTA, "Enter manually" fallback link
- `BarcodeScanner.tsx` in pantry — one-line `onScan(name, barcode)` signature extension
- `LogMealScreen.tsx` — 4th "Barcode" tab wired end-to-end: scan → `getOrFetchProduct()` → `ProductCard` → `saveLog()` with scores; not-found state falls back to custom entry tab
- `NutritionDashboard.tsx` — `<ScoreBadge>` on each log entry row (null-guarded); daily average Nutri-Score summary widget (hidden when `scoredMeals.length === 0`)

**Addresses pitfalls:** 1.2 (image field fallback chain), 1.4 (`ecoscore_grade` edge cases), 3.1 (serving size 100g default), 3.2 (dashboard null guard)

### Phase Ordering Rationale

- Migrations first is non-negotiable: `ProductCard.tsx` and the extended `saveLog()` both reference columns that must exist in Supabase before any end-to-end test can pass.
- Tech debt bundled into Phase 10: SHOP-03 and `pantry_log_recipe_cooked` touch `RecipeConfirm.tsx` and `registry.ts` — files that are stable before Phase 11 begins. Doing them later risks merge conflicts with Phase 11 pantry scanner work.
- `ScoreBadge` and `ProductCard` are pure display components that can be built and tested with static mock data in parallel with `LogMealScreen` integration, once the types from Phase 10 (`NutritionEntry` widening) are in place.
- `NutritionDashboard` score display comes last in Phase 11 — requires real logged entries with `nutriscore_grade` populated, which only exist after the barcode log flow is functional.

### Research Flags

Phases with well-documented, established patterns (no additional research needed):

- **Phase 10 migrations:** Supabase migration pattern is established across 23 prior migrations. The `food_products` RLS divergence from `user_id` pattern is fully documented in ARCHITECTURE.md and PITFALLS.md — no ambiguity remains.
- **Phase 10 tech debt:** All three debt items are surgical scope. No external API research required.
- **Phase 11 display components:** `ScoreBadge` and `ProductCard` are stateless UI. Grade colours and badge layout are fully specified in STACK.md and FEATURES.md.
- **Phase 11 dashboard:** `NutritionDashboard` modification is additive — `SELECT *` already returns new columns; no query changes needed.

One item to validate during Phase 11 execution (not a research gap — a code-read task):

- **Phase 11 `LogMealScreen` barcode tab:** Test against a physical device with a real EAN-13 barcode (e.g. Nutella `3017624010701`) to confirm the full scan-to-cache flow before wiring the product card. Validate `image_front_small_url` vs `image_front_url` coverage with a live OFF response during first implementation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new packages — all capabilities confirmed present in package.json. OFF API v2 stable per official docs. `expo-camera` barcode scanning working in production in pantry plugin. |
| Features | HIGH | Core feature set verified via live OFF API call against Nutella barcode. Competitor analysis (Yuka, MFP, Cronometer) cross-validates table stakes. Eco-Score edge cases (`'a-plus'`, `'not-applicable'`) confirmed from live response. |
| Architecture | HIGH | All integration points verified from actual source files (`barcode.ts`, `BarcodeScanner.tsx`, `003_nutrition_schema.sql`, existing `saveLog()` pattern). Direct-to-OFF call confirmed working in production. |
| Pitfalls | HIGH | Synthesized from cross-referencing all three research files and live API behaviour. Every pitfall has a concrete prevention strategy. |

**Overall confidence:** HIGH

### Gaps to Address

- **`image_front_small_url` vs `image_front_url` field coverage:** MEDIUM confidence. Prevention strategy is an explicit fallback chain (`image_front_small_url ?? image_front_url ?? image_url ?? null`). Validate against 2–3 real products during Phase 11 implementation.
- **Nutri-Score 2024 algorithm cache staleness:** The `cached_at` column and 90-day re-fetch logic (pitfall 2.3) are specified in PITFALLS.md. This can be deferred post-launch if it adds Phase 10 complexity — document the deferral decision in the Phase 10 VALIDATION.md.
- **`pantry_log_recipe_cooked` parameter schema:** Must match what `RecipeConfirm.tsx` currently passes to Supabase. Read the existing direct-call code before writing the tool interface — do not invent a new schema.
- **VALIDATION.md content for phases 06–09:** These are Nyquist audit files. Content must reflect what was actually shipped and validated. Requires reading each phase plan and cross-checking against the live app state before writing.

---

## Sources

### Primary (HIGH confidence)
- Open Food Facts API v2 official documentation — https://openfoodfacts.github.io/openfoodfacts-server/api/ — v2 stable, v3 in active development, rate limits (100 req/min)
- OFF API tutorial — https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/ — field names, endpoint format, User-Agent guidance
- OFF live API response for barcode 3017624010701 (Nutella) — https://world.openfoodfacts.org/api/v2/product/3017624010701.json — confirmed `nutriscore_grade`, `ecoscore_grade`, `nutriments` field names and edge-case values
- Expo Camera documentation (SDK 54) — https://docs.expo.dev/versions/latest/sdk/camera/ — `CameraView`, `onBarcodeScanned`, supported barcode types
- Expo Image documentation — https://docs.expo.dev/versions/latest/sdk/image/ — LRU caching, `contentFit`, `placeholder`, `recyclingKey`
- Nutri-Score Wikipedia — https://en.wikipedia.org/wiki/Nutri-Score — grade colours, 2024 algorithm revision affecting ~40% of products
- Eco-Score Wikipedia — https://en.wikipedia.org/wiki/Eco-score — grade colours, `not-applicable` handling, data coverage (~1M products)
- OFF Eco-Score launch blog — https://blog.openfoodfacts.org/en/news/launch-of-the-eco-score-the-environmental-impact-of-food-products — confirms `'a-plus'` grade
- Existing `plugins/pantry/src/utils/barcode.ts` — confirms direct OFF call works in production; identifies `.net` staging URL divergence
- Existing `supabase/migrations/003_nutrition_schema.sql` — `nutrition_logs` baseline schema; confirms additive column strategy is safe

### Secondary (MEDIUM confidence)
- OFF product database on Hugging Face — https://huggingface.co/datasets/openfoodfacts/product-database — confirms `nutriscore_grade`, `ecoscore_grade` field names in dataset schema
- Expo Camera + barcode scanner tutorial (January 2026) — https://anytechie.medium.com/building-a-professional-barcode-qr-scanner-with-expo-camera-57e014382000 — confirms `CameraView` + `onBarcodeScanned` pattern for SDK 54
- Scanbot React Native barcode scanner comparison — https://scanbot.io/blog/react-native-vision-camera-vs-expo-camera/ — confirms `expo-camera` covers EAN-13/EAN-8/UPC-A; VisionCamera not justified
- Yuka case study (Scandit) — https://www.scandit.com/resources/case-studies/yuka/ — 2.7 billion product scans in 2024; validates market demand

### Tertiary (LOW confidence — validate during execution)
- Nutri-Score colour hex values sourced from OFF web implementation — not normatively published as a specification; validate final values against official OFF brand assets before shipping

---

*Research completed: 2026-04-02*
*Ready for roadmap: yes*
