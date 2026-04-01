# Barcode Enrichment & Meal Photo Scan

**Date:** 2026-04-01
**Status:** Approved

---

## Overview

Two features in one scope:

1. **Pantry barcode enrichment** — when scanning a barcode in the Garde-Manger, retrieve and store composition, macros, Nutri-Score, NOVA score, and product photo from Open Food Facts. Pre-fill the `PantryItemForm` with all retrieved data.

2. **Nutrition barcode scan** — add a barcode scan option inside the existing Scan tab of `LogMealScreen`, showing an enriched product card (photo + macros + scores) before logging.

---

## Architecture

### Shared utility: `barcode.ts`

`lookupBarcode(code: string): Promise<BarcodeProduct | null>`

Returns a rich `BarcodeProduct` object or `null` if not found.

```ts
interface BarcodeProduct {
  name: string;
  image_url: string | null;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  ingredients_text: string | null;
  nutriscore_grade: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  nova_group: 1 | 2 | 3 | 4 | null;
}
```

Open Food Facts API v2 call:
```
GET https://world.openfoodfacts.net/api/v2/product/{barcode}
  ?fields=product_name,product_name_fr,nutriments,ingredients_text_fr,
          ingredients_text,nutriscore_grade,nova_group,image_front_url
```

Mapping:
- `name` → `product_name_fr ?? product_name`
- `image_url` → `image_front_url ?? null`
- `calories_per_100g` → `nutriments['energy-kcal_100g'] ?? null`
- `protein_per_100g` → `nutriments['proteins_100g'] ?? null`
- `carbs_per_100g` → `nutriments['carbohydrates_100g'] ?? null`
- `fat_per_100g` → `nutriments['fat_100g'] ?? null`
- `ingredients_text` → `ingredients_text_fr ?? ingredients_text ?? null`
- `nutriscore_grade` → uppercase of `nutriscore_grade` field, cast to A–E, or null
- `nova_group` → `nova_group` cast to 1–4, or null

Both pantry and nutrition plugins consume this single function. No duplication.

---

## Database Migration

**File:** `supabase/migrations/022_pantry_macros_scores.sql`

```sql
ALTER TABLE public.pantry_items
  ADD COLUMN calories_per_100g  NUMERIC(7,2),
  ADD COLUMN protein_per_100g   NUMERIC(6,2),
  ADD COLUMN carbs_per_100g     NUMERIC(6,2),
  ADD COLUMN fat_per_100g       NUMERIC(6,2),
  ADD COLUMN ingredients_text   TEXT,
  ADD COLUMN nutriscore_grade   CHAR(1),
  ADD COLUMN nova_group         SMALLINT,
  ADD COLUMN product_image_url  TEXT;
```

All columns are nullable. Existing items (manual entries without barcode) are unaffected. No RLS changes needed.

---

## Pantry: PantryItemForm changes

`PantryItemForm` accepts an optional `barcodeProduct?: BarcodeProduct` prop passed from `BarcodeScanner` after a successful lookup.

### Layout additions (after existing fields, inside the same ScrollView)

**Product photo preview** (only if `image_url` present):
- `Image` component, height 120px, borderRadius 12, resizeMode "cover"
- Shown at the top of the form, above the name field

**Macros section** (always shown when barcodeProduct present, editable):
```
── Macros (pour 100g) ──
Calories (kcal)   [TextInput numeric]
Protéines (g)     [TextInput numeric]
Glucides (g)      [TextInput numeric]
Lipides (g)       [TextInput numeric]
```
Pre-filled from `BarcodeProduct`. User can edit before saving.

**Quality scores section** (read-only, only if at least one score is present):
```
── Qualité produit ──
Nutri-Score  [badge A/B/C/D/E]   (read-only)
NOVA         [badge 1/2/3/4]     (read-only)
Composition  [text, 3 lines, expandable tap]  (read-only)
```

Nutri-Score badge colors: A=#0D7C3A, B=#85BB2F, C=#FFCA02, D=#EE8100, E=#E63312
NOVA badge colors: 1=#0D7C3A (unprocessed), 2=#85BB2F (culinary), 3=#FFCA02 (processed), 4=#E63312 (ultra-processed)

The quality section is entirely hidden if `nutriscore_grade`, `nova_group`, and `ingredients_text` are all null.

### Data stored on save

`pantry_items` insert/update includes all 8 new columns. If a field was not retrieved from OFF (null), it is stored as NULL.

---

## Nutrition: LogMealScreen — Scan tab

### Scan tab initial state (new)

When the user taps the Scan tab and no image/scan is in progress, show two options instead of the current direct camera buttons:

```
[📷]  Photographier mon plat     →  existing AI vision flow (unchanged)
[📦]  Scanner un code-barres     →  new barcode flow
```

Both are full-width tappable cards with icon + label.

### Barcode flow

1. Tap "Scanner un code-barres" → opens Expo `BarCodeScanner` (same component already used in pantry `BarcodeScanner.tsx`)
2. On scan detected → `lookupBarcode(code)` → spinner overlay
3. **Product found** → dismiss scanner → show enriched product card:

```
[Product photo — 160px height, if available]
Product name                    [Nutri-Score badge]  [NOVA badge]
─────────────────────────────────────────────────────
Calories   Protéines   Glucides   Lipides
  XXX kcal   XX g        XX g       XX g
─────────────────────────────────────────────────────
Composition: [3 lines, expandable]
─────────────────────────────────────────────────────
[Ajouter au journal]    [Modifier les valeurs]
```

- "Ajouter au journal" → `saveLog` with macros from `BarcodeProduct` (calories, protein, carbs, fat, serving_g=100)
- "Modifier les valeurs" → populates `custom` state and switches to Custom tab (same as existing `editScanResult` pattern)

4. **Product not found** → inline message "Produit introuvable" + "Saisir manuellement" button → switch to Custom tab empty

### Scores not stored in nutrition_logs

`nutrition_logs` table is unchanged. Nutri-Score and NOVA are shown informatively in the card but not persisted in the log entry.

### Scan tab entry state machine

```
idle
  → tap "Photo plat"     → [existing AI photo flow]
  → tap "Code-barres"    → scanning
scanning
  → barcode detected     → loading
  → cancel               → idle
loading
  → found                → product_card
  → not found            → not_found
product_card
  → log                  → navigate back
  → edit                 → custom tab
  → rescan               → idle
not_found
  → manual               → custom tab
  → rescan               → idle
```

---

## Files Modified

| File | Change |
|------|--------|
| `plugins/pantry/src/utils/barcode.ts` | Returns `BarcodeProduct` instead of `string \| null` |
| `plugins/pantry/src/screens/BarcodeScanner.tsx` | `onScan` callback type changes from `(name: string) => void` to `(product: BarcodeProduct) => void` |
| `plugins/pantry/src/screens/PantryItemForm.tsx` | `onScan` handler receives `BarcodeProduct`, pre-fills all macro/score state fields |
| `plugins/nutrition/src/screens/LogMealScreen.tsx` | Scan tab: add choice screen + barcode sub-flow |
| `supabase/migrations/022_pantry_macros_scores.sql` | 8 new nullable columns on `pantry_items` |
| `packages/plugin-sdk/src/i18n.ts` | New i18n keys for both features |
| `plugins/pantry/src/i18n/fr.ts` + `en.ts` | Reference copies |

---

## i18n Keys (new)

**Pantry form:**
- `pantry.macros_section`: 'Macros (pour 100g)' / 'Macros (per 100g)'
- `pantry.quality_section`: 'Qualité produit' / 'Product quality'
- `pantry.field_calories_100g`: 'Calories (kcal/100g)' / 'Calories (kcal/100g)'
- `pantry.field_protein_100g`: 'Protéines (g/100g)' / 'Protein (g/100g)'
- `pantry.field_carbs_100g`: 'Glucides (g/100g)' / 'Carbs (g/100g)'
- `pantry.field_fat_100g`: 'Lipides (g/100g)' / 'Fat (g/100g)'
- `pantry.nutriscore_label`: 'Nutri-Score' / 'Nutri-Score'
- `pantry.nova_label`: 'Score NOVA' / 'NOVA Score'
- `pantry.ingredients_label`: 'Composition' / 'Composition'
- `pantry.ingredients_show_more`: 'Voir plus' / 'Show more'
- `pantry.ingredients_show_less`: 'Voir moins' / 'Show less'

**Nutrition scan:**
- `nutrition.scan_choice_photo`: 'Photographier mon plat' / 'Take a meal photo'
- `nutrition.scan_choice_barcode`: 'Scanner un code-barres' / 'Scan a barcode'
- `nutrition.barcode_scanning`: 'Scannez un code-barres...' / 'Scan a barcode...'
- `nutrition.barcode_loading`: 'Recherche du produit...' / 'Looking up product...'
- `nutrition.barcode_not_found`: 'Produit introuvable' / 'Product not found'
- `nutrition.barcode_not_found_body`: 'Ce produit n\'est pas dans notre base.' / 'This product is not in our database.'
- `nutrition.barcode_manual`: 'Saisir manuellement' / 'Enter manually'
- `nutrition.barcode_rescan`: 'Scanner à nouveau' / 'Scan again'
- `nutrition.nutriscore_label`: 'Nutri-Score' / 'Nutri-Score'
- `nutrition.nova_label`: 'NOVA' / 'NOVA'
- `nutrition.composition_label`: 'Composition' / 'Composition'

---

## Out of Scope

- Caching scanned products in Supabase (future optimization)
- Editing Nutri-Score/NOVA manually (read-only by design)
- Displaying scores in `NutritionDashboard` history
- Syncing pantry macro data to nutrition logs when cooking a recipe
