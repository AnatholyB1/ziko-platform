# Phase 11: Barcode UI + Score Display - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 builds all UI surfaces for barcode-enriched nutrition logging on top of the Phase 10 data foundation. Specifically:

1. **Barcode tab** — 4th tab added to `LogMealScreen` (search | AI Scan | Barcode | Custom). Live camera scanner → product card → confirm to log.
2. **Product card** — photo, name, brand, macros per 100g, Nutri-Score badge, Eco-Score badge, serving size adjuster. Scales macros in real time.
3. **Product not found** — fallback message + CTA to switch to manual entry.
4. **Score badges on journal entries** — Nutri-Score + Eco-Score compact colored pills inline on log rows that have grades.
5. **Dashboard score widget** — daily average Nutri-Score widget; hidden when no barcode-scanned meals that day.

No new screens or navigation routes. All changes are within existing nutrition plugin screens.

</domain>

<decisions>
## Implementation Decisions

### Tab Structure

- **D-01:** Add a **4th tab** "Barcode" to the existing `LogMealScreen` tab toggle. Existing 3 tabs (Search, AI Scan, Custom) remain unchanged. Tab order: `search | scan | barcode | custom`.
- **D-02:** Tab label: "Barcode". Icon: `barcode-outline` (Ionicons, consistent with existing tab icon style).

### Scanner UX

- **D-03:** The Barcode tab renders a `CameraView` (from `expo-camera`) that fills the tab area. A translucent overlay with a rectangular targeting reticle sits over the camera view. Text below the reticle: "Align barcode to scan" (i18n key).
- **D-04:** Scanning is **automatic on detection** — no tap required. `onBarcodeScanned` fires, camera freezes/hides, and a loading indicator shows while `getOrFetchProduct()` runs.
- **D-05:** Only EAN-13 barcode type enabled (`barcodeTypes={['ean13']}`). No QR or other formats.
- **D-06:** After a scan, if the user wants to scan again, a "Scan again" button re-enables the camera. This prevents rapid re-fire of `onBarcodeScanned`.
- **D-07:** Camera permission request follows the existing `expo-location` pattern in Cardio plugin — request on tab focus, show a permission-denied message with instructions if denied.

### Product Card (post-scan)

- **D-08:** Product card appears **inline below the scanner** (camera hides, card scrolls up) — same pattern as how AI scan results appear in the existing `scan` tab. No separate modal or screen.
- **D-09:** Card layout (top to bottom):
  1. Product photo (if `image_url` present — fallback: placeholder icon `nutrition-outline`)
  2. Name + Brand
  3. Nutri-Score badge [NS A] + Eco-Score badge [ES B] side by side (large size, ~28px height)
  4. Macros grid per 100g (energy kcal, protein, carbs, fat) — same 3-cell layout as existing food items
  5. Serving size adjuster
  6. Scaled macros row (calories for current serving) — updates in real time as serving changes
  7. "Log this meal" button (primary) + "Enter manually" button (secondary)
- **D-10:** "Enter manually" on the product card prefills the Custom tab form with the scanned product's data, then switches to the `custom` tab — same `editScanResult` pattern from the AI scan tab.

### Serving Size Adjuster

- **D-11:** `±` stepper with preset chips. Layout:
  - Quick-select chips row: `[50g] [100g] [150g] [200g]` — tapping a chip sets the value exactly.
  - Below chips: `[-5]` | `[TextInput showing grams]` | `[+5]` buttons.
  - Pre-filled with `product.serving_size_g` (default 100 if null).
  - Macros and calorie total rescale in real time: `(value / 100) * macro_per_100g`.
- **D-12:** Minimum serving: 1g. Maximum: 1000g. Values outside range are clamped silently.

### Product Not Found

- **D-13:** When `getOrFetchProduct()` returns `null` (barcode not in Open Food Facts), show an inline "not found" state within the Barcode tab:
  - Message: "Product not found" + scanned barcode number (i18n key).
  - Single CTA: "Enter manually" — switches to `custom` tab (no prefill since no data available).
  - "Scan again" button to retry.

### Score Badges

- **D-14:** Compact **colored pill** badge used everywhere. Structure: `[NS A]` or `[ES B]`. Colors per grade:
  - A = `#1A7F37` (dark green), B = `#78B346` (light green), C = `#F5A623` (yellow), D = `#E3692B` (orange), E = `#CC1F24` (red)
  - Unknown / null grade → badge not rendered (omit entirely, don't show "?").
- **D-15:** Badge sizes:
  - Product card: large (`height: 28, paddingHorizontal: 10, fontSize: 13`)
  - Journal entry rows: small (`height: 20, paddingHorizontal: 6, fontSize: 11`)
  - Dashboard widget: medium (`height: 24, paddingHorizontal: 8, fontSize: 12`)
- **D-16:** Badge component: a shared inline component `ScoreBadge` in `plugins/nutrition/src/components/ScoreBadge.tsx`. Props: `grade: string | null`, `type: 'nutriscore' | 'ecoscore'`, `size: 'sm' | 'md' | 'lg'`. If `grade` is null, renders nothing.

### Journal Entry Badges (SCORE-02)

- **D-17:** In `NutritionDashboard.tsx`, meal entry rows that have `nutriscore_grade` or `ecoscore_grade` show badge pills inline — positioned **between the food name and the calorie count**. Layout: `[food_name]  [NS A][ES B]  [460 kcal]`.
- **D-18:** `loadLogs` query must `select('*')` (already does) — `nutriscore_grade` and `ecoscore_grade` are now columns on `nutrition_logs` (added in migration 024). No query change needed.
- **D-19:** Manual log entries (no barcode) have `null` grades → badges simply don't render. No visual change for non-barcode entries.

### Dashboard Score Widget (SCORE-03)

- **D-20:** The daily average Nutri-Score widget is a card in `NutritionDashboard.tsx` positioned **after the macro cards row and before the TDEE Calculator link**. Hidden completely (not rendered) when no barcode-scanned meals exist for `selectedDate`.
- **D-21:** "Barcode-scanned meal" = `nutrition_log` entry where `nutriscore_grade IS NOT NULL`. Computed client-side from `todayLogs`.
- **D-22:** Average grade calculation: map grades to numeric (A=1, B=2, C=3, D=4, E=5), compute mean, round, map back to letter. Displayed as a single medium `ScoreBadge` + label "Nutri-Score moyen" + sub-label showing count (e.g., "sur 3 repas scannés").

### Claude's Discretion

- Exact reticle overlay implementation (View-based semi-transparent overlay with a transparent cutout, or an SVG — either is fine)
- i18n key naming (follow `nutrition.*` pattern)
- Camera aspect ratio / fill mode for the CameraView
- Loading skeleton while `getOrFetchProduct()` fetches (spinner is fine)
- Exact padding/border-radius of the product card sections (follow existing surface card style: `borderRadius: 14, padding: 14`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Screens to Modify
- `plugins/nutrition/src/screens/LogMealScreen.tsx` — add 4th Barcode tab; all tab, scanner, product card, serving size adjuster changes
- `plugins/nutrition/src/screens/NutritionDashboard.tsx` — add score badges to journal rows, add daily average widget

### Data Foundation (Phase 10 output — must NOT be re-implemented)
- `plugins/nutrition/src/utils/offApi.ts` — `getOrFetchProduct(barcode, supabase)` ready to use
- `supabase/migrations/024_food_products.sql` — `food_products` table + `nutrition_logs` score columns live

### Camera Library
- `apps/mobile/package.json` — `expo-camera ~17.0.10` installed
- `apps/mobile/app.json` — `NSCameraUsageDescription` already declares barcode scanning usage

### Score Badge Component (new)
- `plugins/nutrition/src/components/ScoreBadge.tsx` — to be created in this phase; shared by LogMealScreen and NutritionDashboard

### Project Conventions
- `CLAUDE.md` — `showAlert` (never `Alert.alert`), no StyleSheet, NativeWind, Ionicons, plugin-sdk patterns
- `.planning/STATE.md` — `food_products` RLS pattern, `ecoscore_grade` edge cases (`'not-applicable'` → null)
- `.planning/phases/10-data-foundation-tech-debt/10-CONTEXT.md` — offApi.ts specifics, ecoscore null handling, serving_size_g parsing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LogMealScreen.tsx` scan tab pattern — `CameraView`-less currently (uses image picker); tab rendering, state management, and `saveLog()` function are the integration point
- `LogMealScreen.tsx:editScanResult()` — existing function that prefills Custom tab from scan result; reuse for "Enter manually" on product card
- `LogMealScreen.tsx:saveLog()` — existing save function; extend to accept `food_product_id`, `nutriscore_grade`, `ecoscore_grade` fields when logging from barcode
- `NutritionDashboard.tsx` macro card row — model for dashboard widget card styling (surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border)

### Established Patterns
- Tab toggle: pill-style `TouchableOpacity` with `backgroundColor: tab === tb ? theme.primary : 'transparent'` — extend with 4th item
- Entry row layout: `flexDirection: 'row', alignItems: 'center'` with flex: 1 for name and right-side value — badges slot in between
- Loading state: `ActivityIndicator` with `color={theme.primary}` — use for `getOrFetchProduct()` fetch
- AI scan tab flow: camera input → analyzing → results shown inline — same pattern for barcode tab

### Integration Points
- `saveLog()` in `LogMealScreen.tsx:78` — needs `food_product_id`, `nutriscore_grade`, `ecoscore_grade` added to the insert payload for barcode-logged entries
- `loadLogs()` in `NutritionDashboard.tsx:43` — already selects `*`; no query change needed for new columns
- `todayLogs` in store — already loaded; filter for `nutriscore_grade !== null` to find barcode-scanned meals

</code_context>

<specifics>
## Specific Implementation Notes

- `expo-camera` v17 uses `CameraView` component (not the old `Camera`). Barcode scanning: `<CameraView onBarcodeScanned={handleScan} barcodeTypes={['ean13']} />`.
- After `onBarcodeScanned` fires, set a `scanned: boolean` state to true to prevent re-fires. Reset to false on "Scan again" tap.
- Grade color mapping is consistent for both NutriScore and EcoScore (A–E use the same palette as defined in D-14).
- Dashboard average: only compute over logs where `nutriscore_grade` is one of `['a','b','c','d','e']` — ignore `'a-plus'` edge case at the display level (treat as 'a' for averaging).
- `'a-plus'` grade stored in DB per Phase 10 spec; display it as `[NS A+]` with the dark green color — the `ScoreBadge` component should handle this label.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-barcode-ui-score-display*
*Context gathered: 2026-04-02*
