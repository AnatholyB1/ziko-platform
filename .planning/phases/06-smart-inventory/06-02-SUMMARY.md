---
phase: 06-smart-inventory
plan: "02"
subsystem: pantry-plugin
tags: [plugin, screens, expiry, barcode, zustand, expo-router, camera, open-food-facts]
dependency_graph:
  requires: [pantry_items_table, pantry_plugin_package, pantry_registration]
  provides: [pantry_dashboard_screen, pantry_item_form_screen, barcode_scanner_modal, expiry_utils, barcode_utils]
  affects: [plugins/pantry, packages/plugin-sdk]
tech_stack:
  added: []
  patterns: [inline-styles-theme-tokens, zustand-store-screens, supabase-crud, expo-camera-barcode, datetimepicker-modal]
key_files:
  created:
    - plugins/pantry/src/utils/expiry.ts
    - plugins/pantry/src/utils/barcode.ts
    - plugins/pantry/src/screens/PantryDashboard.tsx
    - plugins/pantry/src/screens/BarcodeScanner.tsx
    - plugins/pantry/src/screens/PantryItemForm.tsx
  modified:
    - packages/plugin-sdk/src/i18n.ts
decisions:
  - "EXPIRY_COLORS uses hex alpha suffix (e.g. #F4433608) for row background tints — avoids opacity affecting child text"
  - "BarcodeScanner uses scannedRef (useRef) not useState for the scan guard — prevents re-render race before async lookup resolves"
  - "PantryItemForm uses inline DateTimePicker (display=default) — native calendar modal on both iOS and Android with single display prop"
  - "showDatePicker closes automatically on Android after selection via Platform.OS check; stays visible on iOS until user picks a date"
  - "Category and unit labels rendered via static maps rather than t() per-chip to avoid key re-evaluation on every render"
  - "Clear expiry date via secondary touch target below date picker — avoids destructive action in main flow"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 06 Plan 02: Pantry Screens Summary

**One-liner:** PantryDashboard (grouped expiry-colored item list) + PantryItemForm (full add/edit with barcode scanner) + utility modules for expiry logic and Open Food Facts barcode lookup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Utility modules + PantryDashboard + i18n keys | f4dcf19 | expiry.ts, barcode.ts, PantryDashboard.tsx, i18n.ts |
| 2 | PantryItemForm + BarcodeScanner | b759f12 | PantryItemForm.tsx, BarcodeScanner.tsx |

## What Was Built

### plugins/pantry/src/utils/expiry.ts
- `getExpiryStatus(expirationDate)` → `'expired' | 'today' | 'soon' | 'ok' | 'none'`
- `EXPIRY_COLORS` map: `#F44336` (expired/today), `#FF9800` (soon ≤7 days), `#4CAF50` (ok), transparent (none)
- `getExpiryLabel(expirationDate, t)` → localized label string for use in row display

### plugins/pantry/src/utils/barcode.ts
- `lookupBarcode(barcode)` → calls `world.openfoodfacts.net/api/v2/product/{barcode}?fields=product_name,product_name_fr`
- Prefers `product_name_fr`, falls back to `product_name`, returns null on not-found or network error

### plugins/pantry/src/screens/PantryDashboard.tsx
- Loads items from `pantry_items` on mount via `supabase.from('pantry_items').select('*').eq('user_id', ...).order('name')`
- Groups items into fridge/freezer/pantry sections via `usePantryStore.getItemsByLocation`
- Expiry dot colored per `EXPIRY_COLORS`, row background tinted for expired/soon items
- Low-stock "Bas" badge visible when `quantity <= low_stock_threshold`
- Category tag displayed on each row
- Pull-to-refresh with `RefreshControl` + `tintColor={theme.primary}`
- Full empty state with `storefront-outline` icon, heading, body text, add CTA
- Header add button (`add-circle`, size 32, theme.primary) navigates to `/pantry/add`
- Row tap navigates to `/pantry/edit` with item id param

### plugins/pantry/src/screens/BarcodeScanner.tsx
- Full-screen `Modal` with `animationType="slide"`, `presentationStyle="fullScreen"`
- `CameraView` with `onBarcodeScanned` callback, barcode types: ean13, ean8, upc_a, upc_e, code128
- `scannedRef = useRef(false)` guard prevents multiple scan firings (reset on `visible=true`)
- After scan: calls `lookupBarcode(data)` → calls `onScan(name)` + `onClose()` on success, or `onNotFound()` + `onClose()` on miss
- Semi-transparent 250×250 scan region overlay
- `ActivityIndicator` + "Recherche du produit..." while API lookup runs
- Close button top-right (`close`, size 28, white, `accessibilityLabel="Fermer le scanner"`)

### plugins/pantry/src/screens/PantryItemForm.tsx
- Supports `mode: 'add' | 'edit'` with `itemId?` prop
- Edit mode pre-loads item from `supabase.from('pantry_items').select('*').eq('id', itemId).single()`
- All 8 fields: barcode scan button, name, quantity, unit chips, category chips, storage location segments, date picker, threshold
- Unit chips: g / kg / ml / L / pièces / canette / boîte / sachet
- Category chips: 10 categories from D-01
- Location: 3-segment row (Réfrigérateur / Congélateur / Placard) with active primary color
- Date picker: `DateTimePicker` (`display="default"`) toggled by touch; clear button below when date set
- Validation: name required + quantity > 0, shown via `showAlert`
- Save: `supabase.from('pantry_items').insert/update` → `usePantryStore.addItem/updateItem` → `router.back()`
- Delete (edit only): `showAlert` confirmation → `delete` → `usePantryStore.removeItem` → `router.back()`
- `KeyboardAvoidingView` wraps form for iOS/Android keyboard handling
- `BarcodeScanner` modal rendered inline, auto-fills name field on successful scan

### packages/plugin-sdk/src/i18n.ts
- Added 55 `pantry.*` keys to both `fr` and `en` translation dictionaries
- Covers: UI strings, field labels, placeholders, error messages, expiry labels, section headers, category names

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all fields are wired to real Supabase data. The screens are fully functional pending:
- `expo-camera` permissions granted by user at runtime (handled with `requestPermission()` flow in BarcodeScanner)
- `@react-native-community/datetimepicker` native module built into the Expo development build (installed in Plan 01)

## Self-Check: PASSED

Files verified:
- FOUND: plugins/pantry/src/utils/expiry.ts
- FOUND: plugins/pantry/src/utils/barcode.ts
- FOUND: plugins/pantry/src/screens/PantryDashboard.tsx
- FOUND: plugins/pantry/src/screens/BarcodeScanner.tsx
- FOUND: plugins/pantry/src/screens/PantryItemForm.tsx

Commits verified:
- FOUND: f4dcf19 (Task 1)
- FOUND: b759f12 (Task 2)
