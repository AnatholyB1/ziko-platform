# Technology Stack — Pantry Plugin (v1.1)

**Project:** Ziko Platform — `pantry` plugin (mobile app milestone)
**Researched:** 2026-03-28
**Scope:** NEW dependencies only. All existing stack (Expo SDK 54, React Native 0.81, NativeWind v4, Zustand v5, TanStack Query v5, MMKV v3, Supabase, Vercel AI SDK v6, Ionicons, `date-fns`) is validated and NOT re-researched here.

---

## Summary

Three technical questions drive the dependency decisions for this plugin:

1. **Barcode scanning** — `expo-barcode-scanner` was fully removed in Expo SDK 52. The correct path for SDK 54 is `expo-camera` (`CameraView` + `barcodeScannerSettings`). It supports EAN-13, EAN-8, Code128, and UPC-A — the formats on food product packaging. `expo-camera` is NOT currently in `apps/mobile/package.json` and must be added.

2. **Expiration date picker** — `@react-native-community/datetimepicker` is the Expo-blessed native date picker (v9.1.0, March 2026 — actively maintained). It uses native UIDatePicker on iOS and DatePickerDialog on Android, `mode="date"` gives date-only input with no time, and is installed via `npx expo install`.

3. **Product data from barcode** — Open Food Facts API provides free barcode lookup (EAN → product name + macros per 100g), no API key, 100 req/min, 4M+ products. Consumed via native `fetch` — zero new library.

Everything else (AI recipe suggestions, calorie tracker sync, shopping list logic) uses existing Vercel AI SDK v6 tools registered in the backend registry, and existing Supabase client. No additional libraries needed.

---

## New Dependencies

### Must Add

| Package | Version pin | Purpose | Why |
|---------|-------------|---------|-----|
| `expo-camera` | `~17.0.7` (SDK 54) | Live camera viewfinder for barcode scanning | The only supported barcode scanning path in SDK 54. `expo-barcode-scanner` was removed in SDK 52. Supports EAN-13, EAN-8, Code128, UPC-A — the symbologies on food products. |
| `@react-native-community/datetimepicker` | via `npx expo install` | Native date picker for expiration date field | Expo-blessed, uses native OS date picker components on both platforms, `mode="date"` for date-only input, v9.1.0 released March 2026 — actively maintained. |

### No New Library (use fetch directly)

| Capability | Approach |
|-----------|---------|
| Open Food Facts product lookup | Plain `fetch('https://world.openfoodfacts.net/api/v2/product/{barcode}')` with `User-Agent: ZikoApp/1.1 (contact@ziko-app.com)` header. Returns `product.product_name`, `product.quantity` (e.g. "500g"), and `product.nutriments` (energy_kcal_100g, proteins_100g, carbohydrates_100g, fat_100g). No SDK. No API key. |

### Conditionally Add (evaluate at screen implementation)

| Package | Version | Purpose | When to add |
|---------|---------|---------|-------------|
| `react-native-modal-datetime-picker` | `^18.0.0` | Modal wrapper around the community datetimepicker | Add if the native inline picker on Android (renders inline by default) creates a layout problem in the add-item form. Wraps the community picker in a familiar dismiss-on-confirm modal. Last release August 2024 — maintenance-mode but stable for date-only use. Requires `@react-native-community/datetimepicker` as peer dep. |

---

## Installation

```bash
# From apps/mobile/ — Expo CLI resolves compatible version for SDK 54 automatically
npx expo install expo-camera
npx expo install @react-native-community/datetimepicker

# Optional — only if modal wrapper is needed at implementation time
npx expo install react-native-modal-datetime-picker @react-native-community/datetimepicker
```

`app.json` plugin entry required for camera permissions — add to the `plugins` array alongside the existing `expo-location` entry:

```json
["expo-camera", { "cameraPermission": "Allow Ziko to scan food barcodes to add items to your pantry." }]
```

---

## What NOT to Add

| Rejected Option | Why |
|----------------|-----|
| `react-native-vision-camera` | Production-grade but adds significant native build complexity (Babel plugin for frame processors, manual pods/gradle config, JSI). Overkill for food barcode scanning — `expo-camera` covers all required symbologies. |
| `expo-barcode-scanner` | Removed from SDK 52+. Cannot be installed on SDK 54. |
| `scanbot-sdk` / `dynamsoft-barcode-reader` | Paid, per-scan pricing, enterprise-grade. No justification for a v1.1 pantry plugin. |
| `react-native-camera` | Legacy, deprecated in favour of VisionCamera. Not Expo-managed-workflow compatible. |
| `react-native-date-picker` (henninghall) | Requires manual native config (pods/gradle), less Expo-friendly than the community picker. No meaningful UX advantage for a simple expiration date input. |
| Scanning barcodes from gallery photos | `expo-image-picker` does not parse barcodes. The only path was `expo-barcode-scanner.scanFromURLAsync` — which is removed in SDK 52+. Not worth implementing in v1.1. |
| `openfoodfacts-js` or any OFF SDK | No official JS SDK worth using. The v2 REST API is a single GET endpoint — plain `fetch` is 5 lines. Adding a library for this is noise. |
| Full calendar / date picker calendar UI | Expiration dates need month + year precision only. The native date picker is sufficient; a calendar view is overkill. |
| Any state management library additions | Pantry state follows the existing plugin pattern: Zustand store in `plugins/pantry/src/store.ts`. Nothing new needed. |

---

## Integration Notes

### expo-camera — what's new in the mobile app

`expo-camera` is NOT currently installed (`apps/mobile/package.json` confirmed). Adding it introduces:
- A new native module — requires an EAS build (or `npx expo prebuild`) before testing on device. Expo Go supports `expo-camera` natively so development iteration works without a full build.
- Camera permission on Android auto-added by the plugin. `NSCameraUsageDescription` on iOS set via the `app.json` plugin config.
- No conflict with `expo-image-picker` (already installed) — both coexist, both use the camera hardware independently.

Barcode scanning API pattern for the pantry scanner screen:

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

const [permission, requestPermission] = useCameraPermissions();

<CameraView
  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'upc_a'] }}
  onBarcodeScanned={(result) => {
    // result.data = barcode string, e.g. "3017620422003"
    // result.type = "ean13" on Android, "org.gs1.EAN-13" on iOS — normalize before use
    const barcode = result.data;
    lookupProduct(barcode);
  }}
/>
```

**Critical iOS quirk:** On iOS, `result.type` for EAN-13 returns `"org.gs1.EAN-13"` instead of `"ean13"`. Normalize at the call site:

```ts
const isEAN13 = (type: string) => type === 'ean13' || type.includes('EAN-13');
```

This was reported as a bug in SDK 51 and was not confirmed fixed in SDK 54 — treat the normalization as required, not optional.

### @react-native-community/datetimepicker — expiration date input

- `mode="date"` — date-only, no time component.
- iOS: renders inline spinner (`display="compact"` recommended for a form field; fits within an add-item row without full-screen takeover).
- Android: opens a native DatePickerDialog (one-shot modal, imperative). `display="default"` on Android.
- Set `minimumDate={new Date()}` to prevent selecting dates in the past as expiration.
- `date-fns` is already installed (`^4.1.0`) — use `format(date, 'yyyy-MM-dd')` for Supabase storage and `format(date, 'dd/MM/yyyy')` for display.

### Open Food Facts — barcode lookup flow

```
Scan barcode → fetch OFF API → pre-fill item name + macros → user confirms/edits → save to pantry_items
```

Endpoint: `GET https://world.openfoodfacts.net/api/v2/product/{barcode}`

Relevant response fields:
- `product.product_name` — item name (pre-fill the name field)
- `product.quantity` — e.g. "500 g" (parse for default quantity)
- `product.nutriments.energy-kcal_100g` — kcal per 100g
- `product.nutriments.proteins_100g`
- `product.nutriments.carbohydrates_100g`
- `product.nutriments.fat_100g`

Fallback: not all products have complete nutrition data. The UI must handle `undefined` nutriments gracefully and allow the user to fill them in manually. If `product.status === 0` the barcode is unknown — show "Product not found, enter details manually."

Rate limit: 100 req/min for product lookups — no concern for a single-user mobile app.

### Supabase — new migration required

New `pantry_items` table following the RLS pattern from `003_nutrition_schema.sql`:

```sql
CREATE TABLE public.pantry_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity decimal NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'units', -- 'g', 'ml', 'units', 'kg', 'L'
  category text,                       -- 'fridge', 'pantry', 'freezer', 'spices'
  expiration_date date,
  barcode text,
  -- per-100g macros (nullable — may not be known)
  per_100g_calories decimal,
  per_100g_protein decimal,
  per_100g_carbs decimal,
  per_100g_fat decimal,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pantry_items_own" ON public.pantry_items
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Number this migration `022_pantry_schema.sql`.

### Backend AI tools — no new library, registration only

Four new tools registered in `backend/api/src/tools/registry.ts` following the existing pattern from `tools/nutrition.ts` and `tools/habits.ts`:

| Tool ID | What it does |
|---------|-------------|
| `pantry_get_items` | Reads `pantry_items` for the authenticated user (optionally filtered by low-stock or expiring soon) |
| `pantry_suggest_recipes` | Claude generates 3 recipes from pantry items + remaining daily macros (calls `nutrition_get_today` internally) |
| `pantry_log_recipe_cooked` | Decrements pantry item quantities consumed + calls `nutrition_log_entry` for each macro set |
| `pantry_get_shopping_list` | Returns items below threshold quantity + ingredients missing for a given recipe |

All tools are server-side only. No new mobile library needed for the AI features.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| `expo-camera` for barcode scanning | HIGH | Official Expo docs confirm EAN-13/EAN-8/Code128 support; SDK 54 ships ~17.x; barcode-scanner removed in SDK 52 confirmed by multiple sources |
| `@react-native-community/datetimepicker` | HIGH | Expo-blessed, v9.1.0 March 2026, actively maintained |
| Open Food Facts API (no library) | HIGH | Official docs, free, no auth, rate limits confirmed |
| iOS EAN-13 type normalization | MEDIUM | Bug reported in SDK 51, not confirmed fixed in SDK 54 — treat normalization as required |
| `react-native-modal-datetime-picker` | MEDIUM | v18.0.0 August 2024, maintenance-mode but functionally stable for date-only picker |

---

## Sources

- [Camera — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/camera/) — barcode types, `CameraView`, `barcodeScannerSettings`, permissions
- [expo/fyi: barcode-scanner-to-expo-camera migration guide](https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md)
- [expo/expo issue #27015: BarCodeScanner deprecated](https://github.com/expo/expo/issues/27015) — removal confirmed SDK 52
- [expo/expo issue #28741: EAN-13 data undefined on iOS in SDK 51](https://github.com/expo/expo/issues/28741) — type normalization caveat
- [@react-native-community/datetimepicker — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/date-time-picker/)
- [datetimepicker releases — v9.1.0 (March 2026)](https://github.com/react-native-datetimepicker/datetimepicker/releases)
- [react-native-modal-datetime-picker releases — v18.0.0 (August 2024)](https://github.com/mmazzarolo/react-native-modal-datetime-picker/releases)
- [Open Food Facts API — Introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Open Food Facts API — Tutorial with endpoint and rate limits](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/)
- [Building a Professional Barcode & QR Scanner with Expo Camera (January 2026)](https://anytechie.medium.com/building-a-professional-barcode-qr-scanner-with-expo-camera-57e014382000)
