# Phase 6: Smart Inventory - Research

**Researched:** 2026-03-29
**Domain:** Expo SDK 54 plugin scaffold, barcode scanning (expo-camera), Open Food Facts API, Supabase migration, Vercel AI SDK v6 tool registration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pantry items have TWO classification fields:
  - `storage_location` (enum): `fridge`, `freezer`, `pantry` — used for list grouping
  - `food_category` (enum): `fruits`, `vegetables`, `meat`, `fish_seafood`, `dairy`, `eggs`, `grains_pasta`, `snacks`, `drinks`, `other`
- **D-02:** Units (8 total): `g`, `kg`, `ml`, `L`, `pieces`, `can`, `box`, `bag`
- **D-03:** Other pantry item fields: `name` (text), `quantity` (number), `unit` (enum), `expiration_date` (date, optional), `low_stock_threshold` (number, optional)
- **D-04:** Full-screen form — navigated to (not a bottom sheet, not inline row expansion). Used for both Add and Edit. The barcode scan button lives on this form.
- **D-05:** Barcode scan opens a camera modal overlay (not a separate screen). On scan success: auto-fills the `name` field. On product not found in Open Food Facts: shows a toast notification ("Product not found — fill in manually"), name field stays empty and focused.
- **D-06:** New `expo-camera` dependency required — not currently installed. Use `CameraView` with `onBarcodeScanned` callback inside a `Modal`.
- **D-07:** Items grouped by `storage_location` (fridge / freezer / pantry) in the dashboard.
- **D-08:** Expiry color indicators: red = expired or expiring today, yellow = within 7 days, green = more than 7 days away, none = no expiration date set.
- **D-09:** Low-stock items visually flagged (per ROADMAP success criterion 3).
- **D-10:** Register two AI tools for Phase 6: `pantry_get_items` and `pantry_update_item`. Follow existing pattern in `backend/api/src/tools/registry.ts`. No `pantry_add_item` or `pantry_delete_item` in Phase 6 — update covers quantity changes which is the primary AI use case ("Add 500g chicken breast").
- **D-11:** Must register in ALL three places atomically:
  1. `apps/mobile/src/lib/PluginLoader.tsx` — static import map
  2. `backend/api/src/tools/registry.ts` — AI tools
  3. Supabase migration `022_pantry_schema.sql`

### Claude's Discretion

- Low-stock threshold default value (suggested: 1 unit — effectively "flag when out of stock")
- Exact layout density and spacing of the item list rows
- Whether the full-screen form uses a `KeyboardAvoidingView` and how fields are ordered
- i18n key naming convention (follow existing plugin patterns)
- How the expiry date picker is implemented (DateTimePicker or text input)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANTRY-01 | User can add a pantry item with name, quantity, unit, category, and optional expiration date | Full-screen PantryItemForm pattern; field schema from D-01–D-03; expo-camera for barcode shortcut |
| PANTRY-02 | User can edit any field of an existing pantry item inline (means: pre-filled form navigation) | Same PantryItemForm in edit mode; `router.push` with item id param |
| PANTRY-03 | User can delete a pantry item with a confirmation prompt | `showAlert` from `@ziko/plugin-sdk`; destructive button in form header |
| PANTRY-04 | User can set a low-stock threshold per item | `low_stock_threshold` column in DB; visual badge logic `qty <= threshold` |
| PANTRY-05 | User can scan a product barcode to auto-fill item name from Open Food Facts API | `CameraView` + `onBarcodeScanned`; Open Food Facts `https://world.openfoodfacts.net/api/v2/product/{barcode}?fields=product_name,product_name_fr` |
| PANTRY-06 | User can view all pantry items grouped by category (storage_location), with low-stock items visually flagged | Group by `storage_location`; expiry dot color logic; low-stock badge |
</phase_requirements>

---

## Summary

Phase 6 creates the `pantry` plugin from scratch as an 18th plugin in the Ziko monorepo. It follows an identical structure to the 17 existing plugins (manifest, store, screens, Expo Router wrappers), adds a new Supabase table via migration 022, and registers two AI tools in the backend registry. The phase has three distinct technical sub-domains: (1) Expo plugin scaffolding, which is 100% pattern-driven from existing plugins; (2) barcode scanning via expo-camera v17 (new dependency for SDK 54); and (3) the Open Food Facts API for name lookup.

The barcode scanning flow is the only genuinely new technical territory. `expo-camera` is not currently installed in `apps/mobile/package.json` and requires `NSCameraUsageDescription` to be added to `app.json` iOS `infoPlist`. The `CameraView` component with `onBarcodeScanned` and `barcodeScannerSettings` is straightforward. The Open Food Facts API is a simple HTTPS GET with no auth, returns `status: 1` on found and `status: 0` on not-found, and provides `product_name` / `product_name_fr` as the usable name fields.

Everything else — plugin package structure, Zustand store, Supabase RLS migration, registry.ts wiring — has direct canonical precedents in the codebase. The planner should produce tasks that copy patterns verbatim and only deviate for pantry-specific fields.

**Primary recommendation:** Structure the phase into 4 plans: (1) Supabase migration + plugin scaffold (package, manifest, store, Expo Router wrappers, PluginLoader registration); (2) PantryDashboard screen (grouped list, expiry indicators, low-stock badges); (3) PantryItemForm screen (full-screen form, barcode scanner modal, Open Food Facts lookup); (4) Backend AI tools (pantry.ts executor + registry.ts wiring + navigation tool screen registration).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-camera | ~17.0.10 | `CameraView` with `onBarcodeScanned` for barcode scanning | Official Expo SDK 54 camera library; `expo-barcode-scanner` is deprecated — migration guide at `expo/fyi` points to `expo-camera` |
| @react-native-community/datetimepicker | ~8.4.4 | Native date picker for expiration date field | Standard Expo-compatible date picker; `npx expo install` resolves to 8.4.4 for SDK 54 |
| @ziko/plugin-sdk | * (workspace) | `showAlert`, `useThemeStore`, `useTranslation` | Used by all 17 existing plugins |
| zustand | ^5.0.0 | Plugin store state | Used by all existing plugin stores |
| @supabase/supabase-js | ^2.47.0 | Database queries | Already in mobile package.json |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Expiry date math (differenceInDays, isToday, isPast) | Already in apps/mobile/package.json; use for expiry color logic |
| expo-router | ~6.0.23 | `router.push` navigation between dashboard and form | Already in mobile; all plugin navigation uses this |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-native-community/datetimepicker | Plain TextInput (ISO date string) | Simpler to implement; acceptable fallback if native picker causes issues on Expo Go; UI-SPEC lists this as a fallback option |
| expo-camera | react-native-vision-camera | Higher quality but much heavier, adds Worklets dependency; expo-camera sufficient for barcode-only use case |

**Installation (new dependencies only):**
```bash
cd apps/mobile && npx expo install expo-camera @react-native-community/datetimepicker
```

**Version verification (confirmed 2026-03-29):**
- `expo-camera`: latest SDK 54 patch is `17.0.10`
- `@react-native-community/datetimepicker`: `8.4.4` for SDK 54 (9.1.0 is current but for SDK 55+)

---

## Architecture Patterns

### Plugin Package Structure (from hydration plugin)

```
plugins/pantry/
├── package.json           # @ziko/plugin-pantry, exports: ., ./manifest, ./store, ./screens/*
├── tsconfig.json          # extends root tsconfig
└── src/
    ├── manifest.ts        # export default pantryManifest (PluginManifest)
    ├── store.ts           # useP antryStore via create<PantryStore>()
    ├── index.ts           # re-exports public API
    └── screens/
        ├── PantryDashboard.tsx
        └── PantryItemForm.tsx
```

### Expo Router Wrapper Files

```
apps/mobile/app/(app)/(plugins)/pantry/
├── dashboard.tsx          # thin wrapper: imports PantryDashboard, passes supabase
├── add.tsx                # thin wrapper: imports PantryItemForm with mode="add"
└── edit.tsx               # thin wrapper: imports PantryItemForm with mode="edit", passes item id from params
```

### Pattern 1: Plugin Manifest (default export)

**What:** Every plugin must use `export default` on the manifest — `PluginLoader.tsx` reads `mod.default`.
**When to use:** Always. Named export causes silent plugin skip.

```typescript
// Source: plugins/nutrition/src/manifest.ts
import type { PluginManifest } from '@ziko/plugin-sdk';

const pantryManifest: PluginManifest = {
  id: 'pantry',
  name: 'Garde-Manger',
  version: '1.0.0',
  icon: 'storefront-outline',   // Ionicons name string — never emoji
  category: 'nutrition',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['pantry'],
  aiSkills: [
    {
      name: 'pantry_management',
      description: 'Read and update pantry item quantities and stock levels',
      triggerKeywords: ['garde-manger', 'frigo', 'stock', 'pantry', 'ingredients', 'ingrédients', 'aliments'],
    },
  ],
  aiTools: [
    { name: 'pantry_get_items', description: '...', parameters: { type: 'object', properties: {} } },
    { name: 'pantry_update_item', description: '...', parameters: { ... } },
  ],
  routes: [
    { path: '/(plugins)/pantry/dashboard', title: 'Garde-Manger', icon: 'storefront-outline', showInTabBar: true },
    { path: '/(plugins)/pantry/add', title: 'Ajouter', icon: 'add-circle-outline', showInTabBar: false },
    { path: '/(plugins)/pantry/edit', title: 'Modifier', icon: 'pencil-outline', showInTabBar: false },
  ],
};
export default pantryManifest;
```

### Pattern 2: Zustand Store

**What:** `create<StoreInterface>()` with Supabase calls inside actions, not in components.
**When to use:** All plugin stores follow this pattern.

```typescript
// Source: plugins/hydration/src/store.ts
import { create } from 'zustand';

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  storage_location: 'fridge' | 'freezer' | 'pantry';
  food_category: string;
  expiration_date: string | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
}

interface PantryStore {
  items: PantryItem[];
  loading: boolean;
  setItems: (items: PantryItem[]) => void;
  setLoading: (loading: boolean) => void;
  addItem: (item: PantryItem) => void;
  updateItem: (id: string, updates: Partial<PantryItem>) => void;
  removeItem: (id: string) => void;
  getItemsByLocation: (location: string) => PantryItem[];
}

export const usePantryStore = create<PantryStore>((set, get) => ({
  items: [],
  loading: false,
  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  updateItem: (id, updates) => set((s) => ({ items: s.items.map(i => i.id === id ? { ...i, ...updates } : i) })),
  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
  getItemsByLocation: (location) => get().items.filter(i => i.storage_location === location),
}));
```

### Pattern 3: Supabase Query in Screen

**What:** Get user from `supabase.auth.getUser()`, then query with `.eq('user_id', user.id)`.
**When to use:** All screens that need user-scoped data.

```typescript
// Source: plugins/hydration/src/screens/HydrationDashboard.tsx
const load = useCallback(async () => {
  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
  } finally {
    setLoading(false);
  }
}, []);
```

### Pattern 4: PluginLoader.tsx Registration

**What:** Literal string key maps to static import function. Metro bundler requires static imports.
**When to use:** Atomically with migration and registry wiring.

```typescript
// Source: apps/mobile/src/lib/PluginLoader.tsx
// ADD THIS LINE to PLUGIN_LOADERS:
pantry: () => import('@ziko/plugin-pantry/manifest') as any,
```

### Pattern 5: Backend Tool Executor

**What:** Export named async functions from `backend/api/src/tools/pantry.ts`, import in `registry.ts`.
**When to use:** One file per plugin's tool collection.

```typescript
// Source: backend/api/src/tools/nutrition.ts (pattern)
import { clientForUser } from './db.js';

export async function pantry_get_items(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);
  const { storage_location } = params as any;

  let query = db.from('pantry_items').select('*').eq('user_id', userId).order('name');
  if (storage_location) query = query.eq('storage_location', storage_location);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { items: data ?? [], count: (data ?? []).length };
}
```

### Pattern 6: Registry Wiring in registry.ts

Three changes needed in `backend/api/src/tools/registry.ts`:

1. Add import at top: `import * as PantryTools from './pantry.js';`
2. Add pantry tool schemas array (after wearablesToolSchemas)
3. Add executors to registry map: `pantry_get_items: PantryTools.pantry_get_items`
4. Spread pantry schemas in `allToolSchemas`

### Pattern 7: expo-camera Barcode Scanning

**What:** `CameraView` inside a `Modal` with `onBarcodeScanned` and `barcodeScannerSettings`. The callback receives `{ type, data, bounds, cornerPoints }`.
**When to use:** Barcode scanner modal on PantryItemForm.

```typescript
// Source: Expo official docs (docs.expo.dev/versions/latest/sdk/camera/)
import { CameraView, useCameraPermissions } from 'expo-camera';

const [permission, requestPermission] = useCameraPermissions();

<CameraView
  style={{ flex: 1 }}
  barcodeScannerSettings={{
    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
  }}
  onBarcodeScanned={({ data }) => {
    // data is the barcode string, e.g. "3017624010701"
    handleBarcodeScan(data);
  }}
/>
```

**Permission request flow:**

```typescript
// Request camera permission before opening modal
if (!permission?.granted) {
  const { granted } = await requestPermission();
  if (!granted) {
    showAlert('Permission requise', 'Autorisez l\'accès à la caméra dans les paramètres.');
    return;
  }
}
setShowCameraModal(true);
```

### Pattern 8: Open Food Facts Lookup

**What:** Single HTTPS GET, no auth, no API key required.
**When to use:** After barcode scan returns a string value.

```typescript
// Source: Open Food Facts API docs (openfoodfacts.github.io)
const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=product_name,product_name_fr`;

async function lookupBarcode(barcode: string): Promise<string | null> {
  try {
    const res = await fetch(OFF_URL(barcode));
    const json = await res.json();
    if (json.status !== 1) return null;                          // product not found
    return json.product?.product_name_fr ?? json.product?.product_name ?? null;
  } catch {
    return null;
  }
}
```

Response shape:
```json
{
  "status": 1,
  "status_verbose": "product found",
  "code": "3017624010701",
  "product": {
    "product_name": "Nutella",
    "product_name_fr": "Nutella"
  }
}
```
When not found: `{ "status": 0, "status_verbose": "product not found" }`.

### Anti-Patterns to Avoid

- **Named manifest export:** `export const manifest = ...` causes `PluginLoader` to read `undefined` from `mod.default`. Always use `export default`.
- **Emoji in `icon` field:** `manifest.icon` is passed directly to `<Ionicons name={...} />`. Use `'storefront-outline'`, not `'🛒'`.
- **Alert from react-native:** Use `showAlert` from `@ziko/plugin-sdk` in all plugin screens.
- **Missing `paddingBottom: 100`:** Every `ScrollView` in plugin screens needs this for tab bar clearance. Project-wide mandate per CLAUDE.md.
- **Barcode scanning without permission check:** `useCameraPermissions()` must be called; permission must be requested before opening the camera modal. Skipping this crashes on first launch.
- **`expo-barcode-scanner` (deprecated):** This package was merged into `expo-camera`. The migration guide explicitly redirects to `CameraView`.
- **Open Food Facts `world.openfoodfacts.org` (v1 path):** Use `world.openfoodfacts.net/api/v2/product/{barcode}` (v2 endpoint on `.net` domain). The v1 endpoint is slower and returns more data than needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera permission flow | Custom permission state machine | `useCameraPermissions()` from `expo-camera` | Handles iOS/Android permission state, rationale, and re-request correctly |
| Barcode format detection | String length/prefix heuristics | `barcodeScannerSettings.barcodeTypes` | Camera hardware handles multi-format decoding; manual detection is unreliable |
| Date math for expiry colors | Custom date comparison logic | `date-fns` (`differenceInDays`, `isToday`, `isPast`) | Already in `apps/mobile/package.json`; edge cases around timezone and "today" boundary are already solved |
| Product name lookup | Custom food database | Open Food Facts API | Free, no auth, covers 3M+ products globally |
| Alert dialogs | `Alert` from `react-native` | `showAlert` from `@ziko/plugin-sdk` | Project-wide contract — native `Alert` breaks custom alert overlay |

**Key insight:** This plugin's complexity is almost entirely structural (connecting things correctly). The only novel logic is the barcode-to-name lookup, and that is a single `fetch` call against a free public API.

---

## Common Pitfalls

### Pitfall 1: Three Registration Touch Points (STATE.md Blocker)

**What goes wrong:** Plugin silently missing from tab bar and/or AI tools not callable. No error thrown.
**Why it happens:** Metro bundler requires static import maps. If `PluginLoader.tsx` entry is missing, the plugin is never loaded even if migration and manifest are perfect. If `registry.ts` is missing, AI tools throw "unknown tool" errors. If migration is missing, all Supabase inserts fail with "relation does not exist".
**How to avoid:** Wire all three in a single plan. Treat them as one atomic operation.
**Warning signs:** Plugin tab not appearing after install; `pantry_get_items` returning "tool not found"; Supabase insert errors on `pantry_items`.

### Pitfall 2: Camera Permission Not Requested

**What goes wrong:** App crashes or camera modal shows black screen on first open.
**Why it happens:** iOS and Android require explicit permission. `CameraView` does not auto-request.
**How to avoid:** Use `useCameraPermissions()` hook; check `permission?.granted` before showing modal; call `requestPermission()` if not granted.
**Warning signs:** Black camera view; `Camera permission was not granted` error in logs.

### Pitfall 3: NSCameraUsageDescription Missing in app.json

**What goes wrong:** iOS build rejects permission request; App Store submission fails; EAS build rejects.
**Why it happens:** iOS requires the info.plist key to explain camera usage. Without it, the permission system throws.
**How to avoid:** Add `"NSCameraUsageDescription": "Ziko utilise la caméra pour scanner les codes-barres de vos aliments."` to `apps/mobile/app.json` under `expo.ios.infoPlist`.
**Warning signs:** iOS simulator: `Could not load NSCameraUsageDescription`. EAS build: ITMS-90683 warning.

### Pitfall 4: expo-camera Version Mismatch

**What goes wrong:** SDK version conflict error in Metro; EAS build fails.
**Why it happens:** `npm install expo-camera` installs v55 (latest) which targets SDK 55, not SDK 54.
**How to avoid:** Always use `npx expo install expo-camera` (not `npm install`) — Expo resolves to the correct SDK-compatible version (~17.0.x for SDK 54).
**Warning signs:** Metro bundler error: "expo-camera requires expo ~55.0.0".

### Pitfall 5: Barcode Scanned Callback Fires Multiple Times

**What goes wrong:** Open Food Facts is called 3–5 times per scan, API call races, name field flickers.
**Why it happens:** `onBarcodeScanned` fires on every frame that detects the barcode — potentially many times per second.
**How to avoid:** Add a `scannedRef = useRef(false)` guard; set to `true` on first callback; ignore subsequent calls until modal closes (reset ref on modal close).
**Warning signs:** Multiple "Recherche du produit..." toasts; duplicate API calls in network inspector.

### Pitfall 6: Open Food Facts Returns product_name but not product_name_fr

**What goes wrong:** French food products have `product_name_fr`; international products only have `product_name`. If you only read one field, many scans return null even for found products.
**How to avoid:** Use `product_name_fr ?? product_name` fallback. Request both fields: `?fields=product_name,product_name_fr`.
**Warning signs:** Scan returns "Product not found" toast for items that exist in the Open Food Facts database.

### Pitfall 7: @react-native-community/datetimepicker Android Behavior

**What goes wrong:** On Android, `DateTimePicker` renders inline (not as a modal) unless `display="default"` or `display="spinner"` is set correctly.
**Why it happens:** iOS and Android have different default rendering modes.
**How to avoid:** Wrap in a `Modal` on Android, or use `display="default"` which shows the native calendar picker on both. Alternatively, use the plain text input fallback (ISO date string) which avoids this complexity entirely.
**Warning signs:** Android date picker renders as a large inline calendar taking up form space.

---

## Code Examples

### Barcode Scanner Modal (complete pattern)

```typescript
// Source: Expo camera docs + project Modal pattern from HydrationDashboard.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const [permission, requestPermission] = useCameraPermissions();
const [showCamera, setShowCamera] = useState(false);
const [scanning, setScanning] = useState(false);
const scannedRef = useRef(false);

const openScanner = async () => {
  if (!permission?.granted) {
    const { granted } = await requestPermission();
    if (!granted) {
      showAlert('Caméra requise', 'Autorisez l\'accès à la caméra dans les réglages.');
      return;
    }
  }
  scannedRef.current = false;
  setShowCamera(true);
};

const handleBarcodeScanned = async ({ data }: { data: string }) => {
  if (scannedRef.current) return;
  scannedRef.current = true;
  setScanning(true);

  const name = await lookupBarcode(data);
  setShowCamera(false);
  setScanning(false);

  if (name) {
    setFieldName(name);  // auto-fill name field
  } else {
    // Toast: "Produit non trouvé — renseignez le nom manuellement"
    showAlert('Produit non trouvé', 'Renseignez le nom manuellement.');
  }
};

// Modal JSX
<Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen">
  <View style={{ flex: 1, backgroundColor: '#000' }}>
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
      onBarcodeScanned={handleBarcodeScanned}
    />
    {scanning && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                     alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', marginTop: 8 }}>Recherche du produit...</Text>
      </View>
    )}
    <TouchableOpacity
      onPress={() => setShowCamera(false)}
      style={{ position: 'absolute', top: 50, right: 20, padding: 10 }}
      accessibilityLabel="Fermer le scanner"
    >
      <Ionicons name="close" size={28} color="#fff" />
    </TouchableOpacity>
  </View>
</Modal>
```

### Expiry Color Logic (using date-fns)

```typescript
// Source: date-fns docs + D-08 decision
import { differenceInDays, isToday, isPast, parseISO, startOfDay } from 'date-fns';

type ExpiryStatus = 'expired' | 'today' | 'soon' | 'ok' | 'none';

function getExpiryStatus(expirationDate: string | null): ExpiryStatus {
  if (!expirationDate) return 'none';
  const date = parseISO(expirationDate);
  if (isPast(startOfDay(date)) && !isToday(date)) return 'expired';
  if (isToday(date)) return 'today';
  const daysUntil = differenceInDays(date, startOfDay(new Date()));
  if (daysUntil <= 7) return 'soon';
  return 'ok';
}

const EXPIRY_COLORS: Record<ExpiryStatus, { dot: string; bg: string }> = {
  expired: { dot: '#F44336', bg: '#F4433608' },
  today:   { dot: '#F44336', bg: '#F4433608' },
  soon:    { dot: '#FF9800', bg: '#FF980008' },
  ok:      { dot: '#4CAF50', bg: 'transparent' },
  none:    { dot: 'transparent', bg: 'transparent' },
};
```

### Supabase Migration 022 (complete template)

```sql
-- supabase/migrations/022_pantry_schema.sql
-- ZIKO PANTRY PLUGIN — Database Schema

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  quantity            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit                TEXT NOT NULL DEFAULT 'pieces'
                        CHECK (unit IN ('g', 'kg', 'ml', 'L', 'pieces', 'can', 'box', 'bag')),
  storage_location    TEXT NOT NULL DEFAULT 'pantry'
                        CHECK (storage_location IN ('fridge', 'freezer', 'pantry')),
  food_category       TEXT NOT NULL DEFAULT 'other'
                        CHECK (food_category IN ('fruits', 'vegetables', 'meat', 'fish_seafood',
                                                  'dairy', 'eggs', 'grains_pasta', 'snacks',
                                                  'drinks', 'other')),
  expiration_date     DATE,
  low_stock_threshold NUMERIC(10, 2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_user
  ON public.pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_location
  ON public.pantry_items(user_id, storage_location);

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pantry_items_own" ON public.pantry_items
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Register in plugins_registry
INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES (
  'pantry',
  '{ "id": "pantry", "name": "Garde-Manger", "version": "1.0.0", ... }'::jsonb,
  NULL, TRUE, '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest = EXCLUDED.manifest, version = EXCLUDED.version;
```

### Backend Tool Schema (pantry_get_items + pantry_update_item)

```typescript
// Source: registry.ts pattern (existing wearables / nutrition schemas)
const pantryToolSchemas: AITool[] = [
  {
    name: 'pantry_get_items',
    description: "Get the user's pantry items. Optionally filter by storage location.",
    parameters: {
      type: 'object',
      properties: {
        storage_location: {
          type: 'string',
          enum: ['fridge', 'freezer', 'pantry'],
          description: 'Filter by storage location (optional)',
        },
      },
    },
  },
  {
    name: 'pantry_update_item',
    description: "Update a pantry item's quantity (and optionally other fields). Use when the user says they added or consumed something from their pantry.",
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'UUID of the pantry item to update' },
        quantity: { type: 'number', description: 'New quantity value' },
        name: { type: 'string', description: 'Item name — used to look up item if item_id is not provided' },
        unit: { type: 'string', description: 'Unit (g, kg, ml, L, pieces, can, box, bag)' },
      },
      required: [],
    },
  },
];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-barcode-scanner` (standalone) | `expo-camera` `CameraView` with `barcodeScannerSettings` | SDK 50 (2023) | `expo-barcode-scanner` deprecated; must use `CameraView` |
| `onBarCodeScanned` (camelCase) | `onBarcodeScanned` (lowercase 'code') | SDK 50 | Prop rename — old spelling is silently ignored |
| AI SDK v3: `parameters`, `maxSteps`, `args`, `result` | AI SDK v6: `inputSchema`, `stopWhen: stepCountIs(n)`, `input`, `output` | SDK v6 (2024) | Already handled in existing backend; new tools follow v6 patterns |

**Deprecated/outdated:**
- `expo-barcode-scanner`: Removed from Expo SDK; migration guide: https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md
- `Alert.alert` from `react-native`: Replaced by `showAlert` from `@ziko/plugin-sdk` in all plugin screens (CLAUDE.md mandate)

---

## Open Questions

1. **pantry_update_item: update by name vs by id**
   - What we know: The AI user says "Add 500g chicken breast" — it won't know the UUID.
   - What's unclear: Should `pantry_update_item` accept `name` as a lookup fallback, or should `pantry_get_items` always be called first to find the id?
   - Recommendation: Support both — if `item_id` provided, use it; else query `name ILIKE` to find the best match. The agent will use `pantry_get_items` first in most flows.

2. **`updated_at` trigger vs application-level update**
   - What we know: Nutrition and hydration tables don't have `updated_at`. Pantry items are mutable (unlike append-only logs).
   - What's unclear: Whether to create a SQL trigger or just `updated_at: new Date().toISOString()` in the upsert call.
   - Recommendation: Set `updated_at` at the application level in the tool executor and screen — simpler, no trigger required.

3. **`plugins/pantry` workspace registration in root `package.json`**
   - What we know: Root `package.json` has `"workspaces": ["apps/*", "packages/*", "plugins/*", "backend/*"]`. The `plugins/*` glob should auto-pick up `plugins/pantry/`.
   - What's unclear: Whether `apps/mobile/package.json` needs an explicit `"@ziko/plugin-pantry": "*"` dependency entry (as other plugins have).
   - Recommendation: Yes, add `"@ziko/plugin-pantry": "*"` to `apps/mobile/package.json` dependencies, consistent with all 17 existing plugins.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Package install | Yes | (monorepo already running) | — |
| expo-camera | Barcode scanner | No (not in package.json) | — | Install: `npx expo install expo-camera` |
| @react-native-community/datetimepicker | Date expiry picker | No (not in package.json) | — | Text input fallback (ISO date string) — acceptable per UI-SPEC |
| Open Food Facts API | Barcode name lookup | Yes (public, no auth) | v2 API | Graceful fallback: show toast, leave name field empty |
| Supabase (pantry_items table) | All pantry CRUD | No (table not yet created) | — | Migration 022 creates it |

**Missing dependencies with no fallback:**
- `expo-camera` is required by D-06 (locked decision). Must install before implementing barcode scanner.
- Supabase `pantry_items` table must be created before any CRUD operations.

**Missing dependencies with fallback:**
- `@react-native-community/datetimepicker` — can fall back to TextInput with ISO date format per UI-SPEC note.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

No test files exist in the project (no `jest.config.*`, `vitest.config.*`, `pytest.ini`, `tests/` directory). This is a React Native / Expo mobile project with no test infrastructure.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANTRY-01 | Add item with all fields saves to Supabase | manual | N/A (no test infra) | N/A |
| PANTRY-02 | Edit existing item pre-fills form correctly | manual | N/A | N/A |
| PANTRY-03 | Delete with confirmation removes item | manual | N/A | N/A |
| PANTRY-04 | Low-stock badge appears when qty <= threshold | manual | N/A | N/A |
| PANTRY-05 | Barcode scan calls Open Food Facts and fills name | manual | N/A | N/A |
| PANTRY-06 | Dashboard groups by storage location with expiry colors | manual | N/A | N/A |

### Sampling Rate

All verification is manual-only given no test infrastructure exists in the project.

### Wave 0 Gaps

No test infrastructure exists. Phase success criteria are verified by manually running the app and exercising each user flow. The AI tool success criterion (SC-5) can be partially verified by calling `POST /ai/chat` with "Add 500g chicken breast to my pantry" and checking the Supabase `pantry_items` table.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Detail |
|------------|--------|
| No StyleSheet | Use inline style objects or NativeWind classes only |
| Icons | `Ionicons` from `@expo/vector-icons`; manifest `icon` must be an Ionicons string name |
| Alert | `showAlert` from `@ziko/plugin-sdk` — never `Alert` from `react-native` |
| Tab bar clearance | Every ScrollView must have `paddingBottom: 100` |
| Plugin manifest export | `export default` only — not named export |
| Supabase key | `EXPO_PUBLIC_SUPABASE_KEY` (publishable, not anon/service) |
| Backend key | `SUPABASE_PUBLISHABLE_KEY` in `backend/api/.env` |
| AI SDK version | v6: `inputSchema` not `parameters`, `stopWhen: stepCountIs(n)`, `input`/`output` not `args`/`result` |
| Theme | Light sport theme only — no dark mode; use `useThemeStore((s) => s.theme)` |
| i18n | `useTranslation()` from `@ziko/plugin-sdk`; `t('pantry.key')` pattern |

---

## Sources

### Primary (HIGH confidence)

- Expo official docs (docs.expo.dev/versions/latest/sdk/camera/) — CameraView API, barcode types, permission hooks
- Open Food Facts API docs (openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/) — endpoint URL, response shape, status field
- Codebase: `apps/mobile/src/lib/PluginLoader.tsx` — exact PLUGIN_LOADERS pattern
- Codebase: `backend/api/src/tools/registry.ts` — tool schema and executor wiring pattern
- Codebase: `backend/api/src/tools/nutrition.ts` + `hydration.ts` — executor function signatures
- Codebase: `plugins/hydration/src/screens/HydrationDashboard.tsx` — Supabase query, Modal, store integration patterns
- Codebase: `plugins/nutrition/src/manifest.ts` — canonical manifest default export pattern
- Codebase: `supabase/migrations/003_nutrition_schema.sql` + `012_new_plugins_schema.sql` — migration SQL pattern with RLS
- Codebase: `apps/mobile/package.json` — confirmed `expo-camera` and `datetimepicker` are NOT installed
- npm registry: `expo-camera` latest SDK 54 patch = `17.0.10` (verified 2026-03-29)

### Secondary (MEDIUM confidence)

- WebSearch: expo-camera ~17.0.x confirmed as SDK 54 version (multiple Expo changelog sources)
- WebSearch: `@react-native-community/datetimepicker` 8.4.4 for SDK 54 (Expo upgrade blog post)
- Expo fyi repo: `expo-barcode-scanner` → `expo-camera` migration confirmed deprecated

### Tertiary (LOW confidence)

- None — all critical claims verified against official sources or codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry and official Expo docs
- Architecture: HIGH — all patterns verified directly from codebase canonical references
- Barcode scanning: HIGH — verified against current Expo camera docs
- Open Food Facts API: MEDIUM — response shape verified from official docs; live API behavior not tested
- Pitfalls: HIGH — verified from official migration guides and known codebase issues

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days — stable libraries)
