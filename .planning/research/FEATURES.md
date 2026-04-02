# Feature Landscape — Barcode Enrichment (v1.2)

**Domain:** Barcode scan → Open Food Facts enrichment in a fitness nutrition tracking mobile app
**Researched:** 2026-04-02
**Confidence:** HIGH (Open Food Facts API verified via live call; Nutri-Score/Eco-Score color systems verified against Wikipedia and official OFF documentation; UX patterns cross-validated against Yuka, MyFitnessPal, Cronometer, Open Food Facts app)

---

## Summary

The v1.2 barcode enrichment feature adds a fourth food-entry path to the existing `LogMealScreen` (which already has search, AI photo scan, and manual custom entry). The feature chain is: camera scan → Open Food Facts lookup → product card with Nutri-Score/Eco-Score/photo/macros → serve-size adjustment → log to `nutrition_logs` with a `food_product_id` FK. A `food_products` catalogue table is introduced as a persistent local cache so repeated scans of the same barcode skip the API call.

The core user jobs are:
1. "Log this packaged food without typing anything" — the scan replaces manual macro entry entirely.
2. "Know whether this product is healthy before I eat it" — Nutri-Score shows the nutritional quality; Eco-Score shows the environmental impact.
3. "See quality signals on my daily log and dashboard" — journal entries and dashboard show badges, not just raw numbers.

This feature has high precedent in the ecosystem. Yuka recorded 2.7 billion product scans in 2024. Open Food Facts covers ~3.5 million products with Nutri-Score and ~1 million with Eco-Score. The UX flow is a well-established 3-screen pattern: camera → product card → log confirmation.

---

## Open Food Facts API — Confirmed Fields

These field names are verified via live API call against barcode `3017624010701` (Nutella).

**Request pattern:**
```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}?fields=product_name,brands,quantity,serving_size,nutriscore_grade,ecoscore_grade,nutriments,image_front_url,image_front_small_url,nutrition_grades
```

**Response top-level fields:**
| Field | Type | Notes |
|-------|------|-------|
| `status` | integer | `1` = found, `0` = not found |
| `product_name` | string | May be absent for poorly-documented products |
| `brands` | string | Comma-separated if multiple |
| `product_quantity` | number | Numeric quantity (400) |
| `product_quantity_unit` | string | "g", "ml", etc. |
| `nutriscore_grade` | string | "a" / "b" / "c" / "d" / "e" — lowercase |
| `ecoscore_grade` | string | "a" / "b" / "c" / "d" / "e" or "not-applicable" |
| `nutrition_grades` | string | Alias for nutriscore_grade (same value) |
| `image_front_url` | string | Full-resolution JPEG URL |
| `image_front_small_url` | string | Thumbnail JPEG URL (~200px) |

**Nutriments sub-object (`product.nutriments`):**
| Field | Unit | Notes |
|-------|------|-------|
| `energy-kcal_100g` | kcal | Primary calorie field — prefer over `energy_100g` (kJ) |
| `proteins_100g` | g | Note: plural "proteins" not "protein" |
| `carbohydrates_100g` | g | Total carbs |
| `fat_100g` | g | Total fat |
| `saturated-fat_100g` | g | Available in most EU products |
| `sugars_100g` | g | |
| `salt_100g` | g | |
| `fiber_100g` | g | Often absent |

**Serving-size context:** `nutrition_data_per` field tells whether nutriments are per 100g or per serving. Almost always "100g" for EU products.

**Confidence:** HIGH — verified against live OFF API response.

---

## Nutri-Score Color System (Confirmed)

Nutri-Score is a European front-of-pack label (used heavily in France, where Ziko is positioned). The scoring algorithm subtracts positive points (fiber, protein, fruits/vegetables) from negative points (energy, sugars, saturated fat, salt). The 2024 revised algorithm tightened ratings for ~40% of products.

| Grade | Color | Hex | Meaning |
|-------|-------|-----|---------|
| A | Dark green | `#1E8348` | Excellent nutritional quality |
| B | Light green | `#70AD47` | Good nutritional quality |
| C | Yellow | `#FFC000` | Moderate nutritional quality |
| D | Orange | `#E36C09` | Poor nutritional quality |
| E | Red | `#C00000` | Very poor nutritional quality |

**Confidence:** HIGH — confirmed via [Nutri-Score Wikipedia](https://en.wikipedia.org/wiki/Nutri-Score) and [Open Food Facts Nutri-Score page](https://world.openfoodfacts.org/nutriscore).

---

## Eco-Score Color System (Confirmed)

The Eco-Score (rebranded as "Green-Score" in late 2024 on some packaging, but OFF API still returns `ecoscore_grade`) measures environmental impact on a 0–100 scale, bucketed into A–E.

| Grade | Color | Score Range | Meaning |
|-------|-------|-------------|---------|
| A | Dark green | 80–100 | Very low environmental impact |
| B | Light green | 60–79 | Low environmental impact |
| C | Yellow | 40–59 | Moderate environmental impact |
| D | Orange | 20–39 | High environmental impact |
| E | Red | 0–19 | Very high environmental impact |

Use the same hex values as Nutri-Score for consistency.

Data coverage is lower than Nutri-Score: ~1M products have Eco-Score vs ~3.5M with Nutri-Score. The API returns `"not-applicable"` for some product categories (e.g. water, salt). UI must handle absent Eco-Score gracefully.

**Confidence:** HIGH — confirmed via [Eco-Score Open Food Facts blog](https://blog.openfoodfacts.org/en/news/launch-of-the-eco-score-the-environmental-impact-of-food-products) and [Eco-Score Wikipedia](https://en.wikipedia.org/wiki/Eco-score).

---

## Table Stakes

Features users expect when a nutrition app adds barcode scanning. Missing any of these = the feature feels half-built.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Camera barcode scanner modal | Standard entry point — any app with "scan barcode" needs a camera view with a scan frame. Already exists in pantry plugin; reuse `BarcodeScanner.tsx` pattern | Low | Reuse existing `expo-camera` CameraView + `onBarcodeScanned` guard; EAN-13, EAN-8, UPC-A/E, Code128 |
| Product lookup by barcode → macros | Core output — calories, protein, carbs, fat per 100g is the primary data the user needs. Without this, scanning is useless | Low | `GET /api/v2/product/{barcode}?fields=...` with `?fields` filter; read from `food_products` cache first |
| Product card before logging | User must see what was found before committing — they may have scanned the wrong item or wrong size | Low-Medium | Card shows: product photo, name, brand, Nutri-Score badge, macros per 100g, serving adjustment |
| Serving size adjustment | All OFF nutriments are per 100g. The user ate 30g of crackers, not 100g. Must adjust before logging | Low | Numeric input (default 100g) + calculated macros update live as user types |
| Fallback for missing product | ~30% of barcodes return no result or no macros in OFF. User must not hit a dead end | Low | "Product not found" state → offer "add manually" (pre-fills custom entry tab with product name if partial match) |
| Log to `nutrition_logs` with food_product FK | Once user confirms, the entry must appear in their nutrition journal exactly like any other log entry | Low | `nutrition_logs` row with new `food_product_id` FK column pointing to `food_products.id` |
| Nutri-Score badge visible on product card | Yuka, Cronometer, MyFitnessPal, and the OFF app all show Nutri-Score on the product card. Users who scan know what it is | Low | Letter badge with grade color; show "N/A" if absent. 5 colors defined in spec above |
| Persistent `food_products` catalogue | Users will scan the same yogurt or protein bar repeatedly. Caching avoids repeated API calls and works offline for previously-seen products | Medium | Supabase `food_products` table: `barcode`, `name`, `brand`, `macros`, `nutriscore_grade`, `ecoscore_grade`, `photo_url`, `serving_g`. Upsert on first scan. |

---

## Differentiators

Features that set Ziko's barcode enrichment apart from standard nutrition tracker implementations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Eco-Score badge alongside Nutri-Score | Most nutrition apps (MyFitnessPal, Cronometer) show only nutritional score. Eco-Score is a sustainability signal that resonates with Ziko's European/French audience. Yuka added it in 2021 and it became a retention driver | Low | Second badge on product card; same letter/color system; gracefully absent if `ecoscore_grade` is "not-applicable" |
| Product photo on product card | Confirms the user scanned the right product — crucial when two nearly-identical products have different nutrition profiles. MyFitnessPal does NOT show product photos; Yuka does. The OFF API returns `image_front_small_url` | Low | `<Image source={{ uri: image_front_small_url }} />` in product card. Show placeholder icon if absent. |
| Nutri-Score + Eco-Score visible on journal entry rows | Other apps show scores only at scan time. Showing badges on every past journal entry creates a persistent health signal that changes how users reflect on their day | Medium | Add `nutriscore_grade` column to `nutrition_logs` (populated on insert from `food_products`); render small badge in NutritionDashboard entry rows |
| Daily average Nutri-Score on dashboard | Aggregate daily quality signal — "today's average quality: B". No major nutrition app computes this. Gives users a score to optimize beyond just macros | Medium | Compute from today's `nutrition_logs` entries that have a `nutriscore_grade`; render as a summary badge on NutritionDashboard |
| Score-aware AI coaching hook | Claude Sonnet agent can comment on Nutri-Score patterns: "You've been logging a lot of D-grade products this week." Requires no new AI tooling — `nutrition_get_today` can include avg score in context | Low (prompt only) | Add avg_nutriscore to the user context payload in `context/user.ts`; AI uses it opportunistically |

---

## Anti-Features (Do Not Build in v1.2)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Manual nutrition database contribution (submit corrections) | OFF contributions require moderator review, conflict resolution, photo upload flows — a product in itself. Introduces moderation complexity and user frustration when corrections aren't published | Link to OFF product page for users who want to contribute: `https://world.openfoodfacts.org/product/{barcode}` |
| Allergen / ingredient list display | OFF returns `allergens_tags` and `ingredients_text`, but parsing and rendering them reliably is error-prone (language, formatting, partial data). Creates medical liability if incorrect | Focus on macros + scores only. Ingredients display is a v2 scope expansion |
| NOVA classification (ultra-processing score) | NOVA 1–4 classification is returned by OFF but poorly understood by most users. Adding a third score system alongside Nutri-Score and Eco-Score creates information overload on the product card | Nutri-Score is sufficient for nutritional quality signal. NOVA is v2+ if user research validates demand |
| Barcode scanning during recipe preparation | Scanning ingredients while cooking is a completely different UX context (kitchen mode, hands-free, voice feedback) that conflicts with the log-after-eating flow | Single-context: scan to log consumed food only |
| Per-product "health verdict" text (Yuka-style) | Yuka generates opinion text ("This product is poor for health because..."). Generating medical-adjacent verdicts creates liability and requires NLP quality that OFF scores don't guarantee | Let the user interpret the score. The badge color is already a clear signal. |
| Barcode history / scan log as a separate screen | A "recently scanned" history screen adds a data model, screen, navigation path, and clear/delete logic for marginal UX value | The food product catalogue serves as implicit scan history. The nutrition journal IS the scan history. |

---

## UX Flow: Scan to Log (Concrete Steps)

This is the canonical user flow. Every phase implementation must match this contract.

### Step 1: Entry Point
User is on the `LogMealScreen`, on the "Search" tab (or any tab). A "Scan barcode" button (Ionicons `barcode-outline`) is visible in the tab bar or as a secondary CTA. Taps it.

### Step 2: Camera Modal
Full-screen camera view (reuse existing `BarcodeScanner.tsx` pattern from pantry plugin):
- Black background
- White scan frame (250x150px, landscape-oriented for barcodes — not square like the pantry scanner)
- "Align barcode in frame" instruction text
- Spinner overlay when lookup is in-flight
- Close (X) button top-right

### Step 3: Product Found — Product Card
A bottom sheet slides up (not full-screen nav push — this is a confirmation, not a workflow):
- Product photo left (80x80, rounded corners), placeholder "image-outline" icon if absent
- Product name (bold, 16px), brand (muted, 12px), quantity string (e.g. "400g")
- Nutri-Score badge: colored letter pill (A/B/C/D/E) + label "Nutri-Score"
- Eco-Score badge: same design, shown only if not "not-applicable"
- Macros per 100g: energy (kcal), protein, carbs, fat — same chip layout as existing scan results
- Serving input (numeric, default 100g) + live-updating calculated macros below it
- Meal type selector (chips: Breakfast / Lunch / Dinner / Snack — pre-filled from time of day)
- Primary CTA: "Log [X] kcal" button (orange, full-width) — disabled while serving input is empty/zero
- Secondary: "Edit manually" link → populates custom entry tab with this product's data pre-filled

### Step 4: Not Found
- Scan frame animates red briefly
- Toast or inline message: "Product not found in Open Food Facts"
- Two options: "Try again" (re-opens scanner) and "Enter manually" (closes scanner, focuses custom entry tab with barcode pre-filled in notes field)

### Step 5: Log Confirmed
- Bottom sheet dismisses
- Camera modal closes
- Entry appears in nutrition journal
- Toast: "Added to [meal type]"

**Total taps for happy path: 3** (open scanner, scan barcode auto-triggers, tap Log). More than 3 taps = conversion risk per nutrition logging UX research.

---

## Feature Dependencies

```
food_products table (Supabase migration)
    └── REQUIRED BY: barcode lookup cache, nutrition_logs FK
          └── barcode.ts utility (extended from pantry plugin)
                ├── fetches OFF API with full field set
                └── upserts into food_products on success
                      └── ProductCard component
                            ├── reads food_products row
                            ├── renders Nutri-Score badge
                            ├── renders Eco-Score badge
                            └── serving adjustment → log confirm
                                  └── nutrition_logs INSERT
                                        ├── food_product_id FK (new column)
                                        └── nutriscore_grade column (new column, denormalized for dashboard query perf)

NutritionDashboard
    └── ENHANCED BY: nutriscore_grade on nutrition_logs entries
          └── daily average Nutri-Score summary badge
                └── (optional v1.2) nutrition context in user.ts payload
```

### Dependency Notes

- **`food_products` table requires migration before any UI**: The table must exist before the barcode lookup utility can cache results. Migration is Phase 1 of v1.2.
- **`nutrition_logs.food_product_id` is nullable**: Manual entries, AI photo scan entries, and custom entries have no product FK. The FK is only set for barcode-sourced entries.
- **`nutrition_logs.nutriscore_grade` is denormalized intentionally**: Joining `nutrition_logs → food_products` on every dashboard load to render badges would require schema changes to the existing query. A nullable `nutriscore_grade` column on `nutrition_logs` (populated on insert, null for manual entries) makes the dashboard query trivial.
- **`BarcodeScanner.tsx` in pantry plugin is reusable**: The camera modal component from `plugins/pantry/src/screens/BarcodeScanner.tsx` handles camera permission, scan guard (`scannedRef`), and the full-screen layout. Nutrition plugin needs only to extend the lookup utility (`barcode.ts`), not rebuild the camera UI.
- **Eco-Score enhances Nutri-Score display**: Eco-Score badge is rendered alongside Nutri-Score on the product card. It has no independent data flow — both come from the same `food_products` row. If absent it simply doesn't render.

---

## MVP Definition

### Launch With (v1.2 must-haves)

- [ ] `food_products` Supabase table with migration — barcode, name, brand, macros per 100g, nutriscore_grade, ecoscore_grade, photo_url, serving_g
- [ ] Extended `barcode.ts` utility — fetches full OFF field set, upserts into `food_products`
- [ ] `BarcodeScanner` component in nutrition plugin (reuse pantry pattern, adjust scan frame to landscape for barcodes)
- [ ] `ProductCard` bottom sheet — photo, Nutri-Score badge, Eco-Score badge, serving adjuster, log CTA
- [ ] `nutrition_logs` migration — add `food_product_id` (nullable FK) and `nutriscore_grade` (nullable text) columns
- [ ] "Not found" state with fallback to custom entry
- [ ] Nutri-Score badge on `NutritionDashboard` journal entry rows (small badge, only when grade present)
- [ ] Daily average Nutri-Score summary badge on `NutritionDashboard` header card

### Add After Validation (v1.2+)

- [ ] `nutrition_get_today` context updated to include `avg_nutriscore` for AI coaching awareness
- [ ] Eco-Score badge on journal entry rows (secondary to Nutri-Score, lower priority)
- [ ] "Scan again" quick action from the daily summary badge (tap badge → opens scanner)

### Future Consideration (v2+)

- [ ] NOVA classification (ultra-processing group 1–4) — validate user demand first
- [ ] Allergen / ingredient list display — requires reliable OFF data coverage
- [ ] Link to OFF product page for user contributions
- [ ] Offline-first barcode scan (pre-downloaded product database segment by user's most-scanned categories)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| food_products table + migration | HIGH (foundational) | LOW | P1 |
| Extended barcode.ts utility | HIGH (foundational) | LOW | P1 |
| BarcodeScanner in nutrition plugin | HIGH | LOW (reuse existing) | P1 |
| ProductCard with Nutri-Score | HIGH | MEDIUM | P1 |
| nutrition_logs columns migration | HIGH (foundational) | LOW | P1 |
| Eco-Score badge on ProductCard | MEDIUM | LOW | P1 |
| Product photo on ProductCard | MEDIUM | LOW | P1 |
| Nutri-Score badge on journal entries | MEDIUM | LOW | P1 |
| Daily average Nutri-Score on dashboard | MEDIUM | LOW-MEDIUM | P1 |
| AI coaching hook via avg_nutriscore | LOW | LOW | P2 |
| Eco-Score badge on journal entries | LOW | LOW | P2 |
| NOVA classification display | LOW | MEDIUM | P3 |
| Allergen list display | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | MyFitnessPal | Yuka | Cronometer | Ziko v1.2 |
|---------|--------------|------|------------|-----------|
| Barcode scan | Yes | Yes | Yes | Yes |
| Nutri-Score badge | No | Yes | No | Yes |
| Eco-Score badge | No | Yes (2021+) | No | Yes |
| Product photo | No | Yes | No | Yes |
| Serving adjustment | Yes | No (100g fixed) | Yes | Yes |
| Log to nutrition journal | Yes | No (standalone) | Yes | Yes |
| Score on journal entries | No | N/A | No | Yes (differentiator) |
| Daily avg score on dashboard | No | No | No | Yes (differentiator) |
| AI coaching from scores | No | No | No | Yes (v1.2 hook) |

---

## Sources

- [Open Food Facts API v2 — Live response for barcode 3017624010701](https://world.openfoodfacts.org/api/v2/product/3017624010701.json) — HIGH confidence, live verified
- [Open Food Facts API Tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/) — HIGH confidence, official documentation
- [Nutri-Score — Wikipedia](https://en.wikipedia.org/wiki/Nutri-Score) — HIGH confidence, extensively sourced
- [Open Food Facts — Nutri-Score page](https://world.openfoodfacts.org/nutriscore) — HIGH confidence, official
- [Open Food Facts — Eco-Score launch blog post](https://blog.openfoodfacts.org/en/news/launch-of-the-eco-score-the-environmental-impact-of-food-products) — HIGH confidence, official
- [Eco-Score — Wikipedia](https://en.wikipedia.org/wiki/Eco-score) — HIGH confidence, extensively sourced
- [Scandit / Yuka case study — 2.7 billion scans in 2024](https://www.scandit.com/resources/case-studies/yuka/) — MEDIUM confidence, vendor case study
- [Macro Tracking Apps Explained: Barcode Scanners & Food Data — Apidots](https://apidots.com/blog/macro-tracking-app-barcode-scanners-food-database/) — MEDIUM confidence, industry blog
- [Nutri-Score: Understanding Europe's Controversial Nutrition Labeling (2025)](https://www.castle-group.eu/blog/our-blog-1/nutri-score-understanding-europe-s-controversial-nutrition-labeling-system-in-2025-10) — MEDIUM confidence, industry analysis
- [Mobile apps as a sustainable shopping guide — PubMed (2021)](https://pubmed.ncbi.nlm.nih.gov/34358589/) — HIGH confidence, peer-reviewed study on Eco-Score effectiveness

---
*Feature research for: Ziko Barcode Enrichment (v1.2 milestone)*
*Researched: 2026-04-02*
