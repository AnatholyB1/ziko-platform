# Technology Stack — Barcode Enrichment (v1.2)

**Project:** Ziko Platform — barcode enrichment milestone (nutrition plugin)
**Researched:** 2026-04-02
**Scope:** NEW stack additions only. Everything in the existing app (Expo SDK 54, React Native 0.81,
NativeWind v4, Zustand v5, TanStack Query v5, MMKV v3, Supabase, Vercel AI SDK v6, Ionicons,
`date-fns`, `expo-camera ~17.0.10`, `expo-image ~3.0.11`) is validated and NOT re-researched here.

---

## Executive Summary

The barcode enrichment milestone introduces **zero new npm packages**. Every capability it requires
is either already installed in `apps/mobile/package.json` or is purely server-side configuration and
SQL migration work.

Three technical questions drive this conclusion:

1. **Barcode scanning in the nutrition plugin** — `expo-camera` (`CameraView` + `onBarcodeScanned`)
   is already installed at `~17.0.10`. The pantry plugin already uses it in `BarcodeScanner.tsx`.
   The nutrition plugin needs a new barcode-scanner tab in `LogMealScreen.tsx` that reuses the same
   component pattern — no new package.

2. **Open Food Facts enrichment fields** — the existing `barcode.ts` utility in the pantry plugin
   calls `https://world.openfoodfacts.net/api/v2/product/{barcode}?fields=product_name,product_name_fr`.
   Enrichment requires extending that `fields=` query string to also request
   `nutriscore_grade,ecoscore_grade,nutriments,image_front_url,brands`. Plain `fetch` — no new library.

3. **Nutri-Score and Eco-Score badge display** — both scores are single letters (A–E) with official
   colour conventions (green A → red E for Nutri-Score; dark-green A → black E for Eco-Score).
   These are rendered as inline `View` + `Text` components styled with NativeWind or inline style
   objects. `expo-image` (already installed at `~3.0.11`) handles product photo loading with
   built-in caching, placeholder support, and graceful fallback — no additional image library needed.

---

## Confirmed Existing Dependencies (no version change required)

| Package | Current version | Role in this milestone |
|---------|-----------------|------------------------|
| `expo-camera` | `~17.0.10` | Barcode scanner in LogMealScreen — reuse pantry's `BarcodeScanner.tsx` pattern |
| `expo-image` | `~3.0.11` | Load product photo from `image_front_url` with built-in cache + placeholder |
| `@supabase/supabase-js` | `^2.47.0` | Insert to new `food_products` table; FK join in `nutrition_logs` |
| `date-fns` | `^4.1.0` | Date formatting — already used throughout nutrition plugin |
| `zustand` | `^5.0.0` | Nutrition store extended with Nutri-Score/Eco-Score fields |
| `@tanstack/react-query` | `^5.62.0` | Query cache for `food_products` catalogue lookups |

---

## New Dependencies

**None.** This milestone requires no new npm packages.

---

## What NOT to Add

| Rejected option | Why |
|-----------------|-----|
| `react-native-vision-camera` | Overkill — `expo-camera` covers EAN-13, EAN-8, UPC-A, Code128. No frame-processor pipeline needed for food barcode scanning. |
| `openfoodfacts-js` or any OFF SDK | No official JS SDK worth using. The v2 REST API is a single GET with query params. Adding a library for a 10-line `fetch` call is noise. |
| `react-native-fast-image` | Replaced by `expo-image` in the Expo managed workflow. `expo-image` provides LRU caching, BlurHash placeholder, and `recyclingKey` for list scroll — already installed. |
| Any badge/score component library | Nutri-Score and Eco-Score badges are 5 colour values mapped to a letter — a 15-line inline component. No library justification. |
| `axios` or `react-query` fetcher | Native `fetch` is sufficient. `@tanstack/react-query` is already installed for server-state caching. |

---

## Open Food Facts API — Enrichment Query

**Endpoint (v2 — stable):**
```
GET https://world.openfoodfacts.net/api/v2/product/{barcode}
    ?fields=product_name,product_name_fr,brands,
            nutriscore_grade,ecoscore_grade,
            nutriments,image_front_url
User-Agent: ZikoApp/1.2 (contact@ziko-app.com)
```

**Rate limits:** 100 req/min for product lookup — no concern for a single-user mobile app.

**Key response fields (confidence: HIGH — confirmed from official API docs and community usage):**

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `product.product_name` | string | `"Nutella"` | Falls back to this if `_fr` absent |
| `product.product_name_fr` | string | `"Nutella"` | French name |
| `product.brands` | string | `"Ferrero"` | May be comma-separated |
| `product.nutriscore_grade` | string | `"e"` | Single letter a–e, lowercase. `undefined` if not computed. |
| `product.ecoscore_grade` | string | `"c"` | Single letter a–e, lowercase. `undefined` if not computed. |
| `product.nutriments.energy-kcal_100g` | number | `539` | Key uses hyphen — access as `nutriments['energy-kcal_100g']` |
| `product.nutriments.proteins_100g` | number | `6.3` | — |
| `product.nutriments.carbohydrates_100g` | number | `57.5` | — |
| `product.nutriments.fat_100g` | number | `30.9` | — |
| `product.image_front_url` | string | `"https://images.openfoodfacts.org/..."` | May be absent — handle gracefully |
| `status` | number | `1` | `1` = found, `0` = not found |

**API v3 status:** In active development as of early 2026, subject to frequent changes. Use v2 — it is the current stable version per official OFF docs.

**Extended `barcode.ts` utility — what changes:**

The existing `plugins/pantry/src/utils/barcode.ts` only requests `product_name,product_name_fr`.
For the nutrition plugin enrichment, a new utility (or extended version) must request all enrichment
fields and return a structured `OFFProduct` object:

```ts
export interface OFFProduct {
  name: string;
  brands?: string;
  nutriscore_grade?: 'a' | 'b' | 'c' | 'd' | 'e';
  ecoscore_grade?: 'a' | 'b' | 'c' | 'd' | 'e';
  calories_100g?: number;
  protein_100g?: number;
  carbs_100g?: number;
  fat_100g?: number;
  image_front_url?: string;
}
```

The pantry `barcode.ts` does not change — it is a simpler call site that only needs the name.

---

## Nutri-Score and Eco-Score Display

Both scores are rendered as inline badge components using NativeWind or inline style objects.
No library. The colour conventions are standardised and should be followed exactly:

**Nutri-Score colour map:**
| Grade | Background | Text |
|-------|-----------|------|
| a | `#038141` | `#FFFFFF` |
| b | `#85BB2F` | `#FFFFFF` |
| c | `#FECB02` | `#1C1A17` |
| d | `#EE8100` | `#FFFFFF` |
| e | `#E63312` | `#FFFFFF` |

**Eco-Score colour map:**
| Grade | Background | Text |
|-------|-----------|------|
| a | `#1A7A39` | `#FFFFFF` |
| b | `#52A544` | `#FFFFFF` |
| c | `#D1C51A` | `#1C1A17` |
| d | `#E87618` | `#FFFFFF` |
| e | `#2B2B2B` | `#FFFFFF` |

A grade badge is a small `View` (width 28, height 28, borderRadius 6) with centred uppercase letter.
Display `null` state as a muted grey `?` badge when grade is not computed.

---

## Product Photo Display

`expo-image` (already installed) handles remote product photo loading:

```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: product.image_front_url }}
  style={{ width: 72, height: 72, borderRadius: 8 }}
  contentFit="cover"
  placeholder={blurhash}          // optional — grey placeholder
  transition={200}
/>
```

`expo-image` provides built-in LRU disk + memory cache — product photos scanned once are served
from cache on subsequent views. No additional image caching library needed.

---

## Database Changes Required

Two migrations are needed (no new libraries — pure SQL):

### Migration 024 — `food_products` catalogue

```sql
CREATE TABLE public.food_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode          TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  brands           TEXT,
  nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a','b','c','d','e')),
  ecoscore_grade   TEXT CHECK (ecoscore_grade IN ('a','b','c','d','e')),
  calories_100g    NUMERIC(7, 2),
  protein_100g     NUMERIC(7, 2),
  carbs_100g       NUMERIC(7, 2),
  fat_100g         NUMERIC(7, 2),
  image_url        TEXT,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX food_products_barcode_idx ON public.food_products(barcode);
```

This table has no `user_id` — it is a shared product catalogue (no RLS needed, read-only from
the app after initial population). Products are inserted on first scan and reused on subsequent
scans to avoid redundant OFF API calls.

### Migration 025 — enrich `nutrition_logs`

```sql
ALTER TABLE public.nutrition_logs
  ADD COLUMN food_product_id UUID REFERENCES public.food_products(id) ON DELETE SET NULL,
  ADD COLUMN nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a','b','c','d','e')),
  ADD COLUMN ecoscore_grade   TEXT CHECK (ecoscore_grade IN ('a','b','c','d','e'));
```

The FK is nullable — manually entered logs have no associated `food_products` row. Scores are
denormalised onto `nutrition_logs` so they are available without a join in the daily summary query.

---

## Integration with Existing `expo-camera` Setup

The pantry plugin's `BarcodeScanner.tsx` uses `CameraView` with the correct scan guard pattern
(ref-based dedup to prevent duplicate scans). The nutrition plugin's new barcode tab should
reuse this component or extract it to a shared location in `packages/ui/` to avoid duplication.

**Reuse recommendation:** Extract `BarcodeScanner.tsx` to `packages/ui/src/BarcodeScanner.tsx`,
parameterise the `onBarcodeScanned` callback, and import from `@ziko/ui` in both plugins.

**iOS EAN-13 type normalization** (carry-forward from v1.1 research, still applies):
`result.type` returns `"org.gs1.EAN-13"` on iOS, not `"ean13"`. Normalize at the call site.
The existing pantry implementation handles only `result.data` (the barcode string itself) which
avoids this issue entirely — the nutrition plugin should follow the same pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| `expo-camera` barcode scanning | HIGH | Already working in production in pantry plugin at `~17.0.10` |
| `expo-image` for product photos | HIGH | Already installed; official Expo docs confirm LRU caching and graceful fallback |
| OFF API v2 field names (`nutriscore_grade`, `ecoscore_grade`) | HIGH | Confirmed via official OFF docs, multiple independent sources, and Hugging Face dataset schema |
| OFF API `image_front_url` field | MEDIUM | Field name consistent across sources; not shown in the official tutorial examples but confirmed in community usage |
| OFF API v2 stability | HIGH | Official docs explicitly state v2 is the current stable version; v3 is "in active development and subject to frequent changes" |
| Nutri-Score colour values | MEDIUM | Colours sourced from OFF web implementation; not normatively published as a specification |
| Zero new npm packages | HIGH | All required capabilities confirmed present in `apps/mobile/package.json` |

---

## Sources

- [Open Food Facts API — Introduction (official)](https://openfoodfacts.github.io/openfoodfacts-server/api/) — v2 stable, v3 in development, rate limits (100 req/min product lookup)
- [Open Food Facts API — Tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/) — `nutrition_grades` field, barcode lookup URL format, `?fields=` parameter usage
- [Camera — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/camera/) — `CameraView`, `barcodeScannerSettings`, supported barcode types, SDK 54 version `~17.0.7`
- [Image — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/image/) — LRU caching, `contentFit`, `placeholder`, `transition`, `recyclingKey`
- [Open Food Facts product database — Hugging Face](https://huggingface.co/datasets/openfoodfacts/product-database) — confirms `nutriscore_grade`, `ecoscore_grade` field names in dataset schema
- [Building a Professional Barcode & QR Scanner with Expo Camera (January 2026)](https://anytechie.medium.com/building-a-professional-barcode-qr-scanner-with-expo-camera-57e014382000) — confirms `CameraView` + `onBarcodeScanned` pattern in SDK 54
- [Scanbot: React Native barcode scanner libraries comparison](https://scanbot.io/blog/react-native-vision-camera-vs-expo-camera/) — confirms `expo-camera` covers EAN-13/EAN-8/UPC-A; VisionCamera overhead not justified for food scanning
