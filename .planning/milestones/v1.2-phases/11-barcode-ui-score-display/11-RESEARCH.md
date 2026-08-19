# Phase 11: Barcode UI + Score Display - Research

**Researched:** 2026-04-02
**Domain:** React Native camera UI, barcode scanning, inline component design, Zustand state extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add a 4th tab "Barcode" to `LogMealScreen`. Tab order: `search | scan | barcode | custom`.
- **D-02:** Tab label: "Barcode". Icon: `barcode-outline` (Ionicons).
- **D-03:** Barcode tab renders a `CameraView` (expo-camera) filling the tab area. Translucent overlay with rectangular reticle. Text below: "Align barcode to scan" (i18n key).
- **D-04:** Scanning automatic on detection — no tap required. `onBarcodeScanned` fires, camera freezes/hides, loading indicator shows while `getOrFetchProduct()` runs.
- **D-05:** Only EAN-13 barcode type enabled (`barcodeTypes={['ean13']}`).
- **D-06:** "Scan again" button re-enables the camera after a scan to prevent rapid re-fire.
- **D-07:** Camera permission follows expo-location pattern in Cardio plugin — request on tab focus, show permission-denied message if denied.
- **D-08:** Product card appears inline below the scanner (camera hides, card scrolls up). No modal or separate screen.
- **D-09:** Card layout: photo → name + brand → score badges row → macros grid per 100g → serving size adjuster → scaled macros row → "Log this meal" (primary) + "Enter manually" (secondary) + "Scan again" (tertiary text).
- **D-10:** "Enter manually" prefills Custom tab using existing `editScanResult()`, then switches to `custom` tab.
- **D-11:** Serving size adjuster: quick-select chips `[50g][100g][150g][200g]` + `[-5]|TextInput|[+5]` stepper. Pre-filled with `product.serving_size_g` (default 100 if null). Real-time macro rescaling: `(value / 100) * macro_per_100g`.
- **D-12:** Minimum 1g, maximum 1000g. Clamped silently.
- **D-13:** Product not found: inline state with barcode number, "Enter manually" CTA (no prefill), "Scan again" button.
- **D-14:** Score badge color palette — A/A+: `#1A7F37`, B: `#78B346`, C: `#F5A623`, D: `#E3692B`, E: `#CC1F24`. Null/unknown/not-applicable: badge not rendered.
- **D-15:** Badge sizes — lg (product card): h28 px10 fs13; md (dashboard widget): h24 px8 fs12; sm (journal rows): h20 px6 fs11.
- **D-16:** `ScoreBadge` component at `plugins/nutrition/src/components/ScoreBadge.tsx`. Props: `grade: string | null`, `type: 'nutriscore' | 'ecoscore'`, `size: 'sm' | 'md' | 'lg'`. Renders nothing if grade is null.
- **D-17:** Journal entry row layout: `[food_name (flex:1)] [NS badge][ES badge] [460 kcal]`.
- **D-18:** `loadLogs()` already uses `select('*')` — no query change needed.
- **D-19:** Manual log entries (null grades) render no badge — no visual change.
- **D-20:** Dashboard score widget positioned after macros row and before TDEE Calculator link. Hidden when no barcode-scanned meals for `selectedDate`.
- **D-21:** "Barcode-scanned meal" = entry where `nutriscore_grade IS NOT NULL`. Computed client-side from `todayLogs`.
- **D-22:** Average grade: numeric map (A-plus=1, A=1, B=2, C=3, D=4, E=5), mean, round, map back to letter. Display single medium `ScoreBadge` + label "Nutri-Score moyen" + count sub-label.

### Claude's Discretion

- Exact reticle overlay implementation (View-based semi-transparent overlay with transparent cutout, or SVG)
- i18n key naming (follow `nutrition.*` pattern)
- Camera aspect ratio / fill mode for CameraView
- Loading skeleton while `getOrFetchProduct()` fetches (spinner is fine)
- Exact padding/border-radius of product card sections (follow existing surface card style: `borderRadius: 14, padding: 14`)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-02 | User sees "product not found" message and can fall back to manual entry when a barcode is not in Open Food Facts | `getOrFetchProduct()` returns null → inline not-found state with "Enter manually" CTA switching to custom tab |
| SCORE-01 | User sees product card with photo, Nutri-Score badge, Eco-Score badge, macros per 100g, serving size adjuster before confirming a scanned meal log | Full product card inline in Barcode tab post-scan; ScoreBadge component lg size; serving adjuster with real-time rescaling |
| SCORE-02 | User sees Nutri-Score and Eco-Score badges on nutrition journal entries logged via barcode scan | `nutriscore_grade` / `ecoscore_grade` already on `nutrition_logs` (migration 024); badge pills injected into existing entry rows in NutritionDashboard |
| SCORE-03 | User sees their average Nutri-Score for the day on the nutrition dashboard (widget hidden when no barcode-scanned meals exist that day) | Client-side computation from `todayLogs`; ScoreBadge md size; conditional render |
</phase_requirements>

---

## Summary

Phase 11 is a pure UI phase layered on top of the Phase 10 data foundation. All network calls, caching, and database schema are complete. The work is: (1) add a 4th camera-based tab to `LogMealScreen` with a live EAN-13 scanner, an inline product card with serving adjuster, and two fallback flows; (2) create a shared `ScoreBadge` component; (3) inject score badges into existing `NutritionDashboard` journal rows; (4) add a conditional daily average Nutri-Score widget to the dashboard.

The existing pantry `BarcodeScanner.tsx` is a direct, working reference for the `CameraView` + `useCameraPermissions` + `scannedRef` (useRef) pattern in expo-camera v17. The `editScanResult()` function in `LogMealScreen.tsx` already handles the "Enter manually" flow. The `NutritionDashboard.tsx` log entry rows need minimal structural changes — insert a badge container between `food_name` and the calorie value.

The `NutritionEntry` type in `store.ts` does not yet include `nutriscore_grade`, `ecoscore_grade`, or `food_product_id` columns. These fields need to be added to the interface so `todayLogs` carries them when loaded from Supabase.

**Primary recommendation:** Build ScoreBadge first (standalone, no dependencies), then extend the store type, then add the Barcode tab to LogMealScreen, then modify NutritionDashboard last (dashboard widget + journal badges).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-camera | ~17.0.10 | CameraView + useCameraPermissions | Already installed; v17 API confirmed in use by pantry BarcodeScanner |
| @expo/vector-icons (Ionicons) | bundled with Expo SDK 54 | Icons for tab, states, fallbacks | Project convention — no alternatives |
| react-native (core) | 0.81 | View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, ScrollView | Base platform |
| NativeWind v4 | installed | Inline styles only (no StyleSheet) | CLAUDE.md mandate |
| @ziko/plugin-sdk | workspace | useThemeStore, useTranslation, showAlert | All plugins must use these |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| plugins/nutrition/src/utils/offApi.ts | Phase 10 output | `getOrFetchProduct(barcode, supabase): Promise<FoodProduct \| null>` | Call after `onBarcodeScanned` fires |
| zustand v5 | workspace | Extend NutritionEntry type for grade fields | Store type must match DB columns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| View-based semi-transparent overlay | SVG overlay | Both work; View approach avoids extra dependencies; matches CONTEXT.md discretion |
| useRef for scan guard | useState | useRef confirmed in pantry BarcodeScanner and STATE.md — prevents re-render race before async resolves |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
plugins/nutrition/src/
├── components/
│   └── ScoreBadge.tsx        # New — shared by LogMealScreen and NutritionDashboard
├── screens/
│   ├── LogMealScreen.tsx     # Modified — add 4th tab, scanner, product card
│   └── NutritionDashboard.tsx # Modified — journal badges, score widget
├── store.ts                  # Modified — extend NutritionEntry type
└── utils/
    └── offApi.ts             # Unchanged — Phase 10 output
```

### Pattern 1: CameraView + scannedRef Guard
**What:** Use `useRef(false)` to gate `onBarcodeScanned` — prevents re-fire during async lookup.
**When to use:** Any time `onBarcodeScanned` triggers an async operation.
**Example:**
```typescript
// Source: plugins/pantry/src/screens/BarcodeScanner.tsx (working reference)
const scannedRef = useRef(false);

const handleBarcodeScanned = async ({ data }: { data: string }) => {
  if (scannedRef.current) return;
  scannedRef.current = true;
  setScanning(true);
  try {
    const product = await getOrFetchProduct(data, supabase);
    // handle result
  } finally {
    setScanning(false);
  }
};

// "Scan again" resets:
const handleScanAgain = () => {
  scannedRef.current = false;
  setProduct(null);
  setNotFound(false);
};
```

### Pattern 2: useCameraPermissions Hook (expo-camera v17)
**What:** Hook-based permission management from expo-camera v17.
**When to use:** Any screen that needs camera access.
**Example:**
```typescript
// Source: plugins/pantry/src/screens/BarcodeScanner.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

const [permission, requestPermission] = useCameraPermissions();

// On tab focus:
useEffect(() => {
  if (!permission?.granted) {
    requestPermission();
  }
}, []);

// Render guard:
if (permission && !permission.granted) {
  return <PermissionDeniedView />;
}
```

### Pattern 3: CameraView barcodeScannerSettings (expo-camera v17)
**What:** The correct API for restricting barcode types in expo-camera v17.
**When to use:** EAN-13 only per D-05.
```typescript
// Source: verified from pantry BarcodeScanner.tsx — note the nested property:
<CameraView
  style={{ flex: 1 }}
  facing="back"
  onBarcodeScanned={handleBarcodeScanned}
  barcodeScannerSettings={{
    barcodeTypes: ['ean13'],
  }}
/>
```
**Critical note:** The barcode types are nested inside `barcodeScannerSettings`, NOT as a direct `barcodeTypes` prop. The CONTEXT.md D-05 shorthand `barcodeTypes={['ean13']}` is conceptually correct but the actual prop path is `barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}`.

### Pattern 4: Inline Tab State Machine
**What:** `tab` state drives which of 4 content areas renders. Barcode tab has 5 internal sub-states.
**When to use:** Existing pattern in LogMealScreen — extend with 4th item.
```typescript
type Tab = 'search' | 'scan' | 'barcode' | 'custom';
// Barcode tab internal states:
// - 'camera' (initial, no scan yet)
// - 'loading' (scan detected, fetch in progress)
// - 'product' (product found)
// - 'notFound' (product not found)
// - 'permDenied' (camera permission denied)
```

### Pattern 5: ScoreBadge Component
**What:** Stateless display component — renders colored pill or nothing.
**When to use:** Everywhere a Nutri-Score or Eco-Score grade needs displaying.
```typescript
// File: plugins/nutrition/src/components/ScoreBadge.tsx
const GRADE_COLORS: Record<string, string> = {
  'a': '#1A7F37', 'a-plus': '#1A7F37',
  'b': '#78B346', 'c': '#F5A623',
  'd': '#E3692B', 'e': '#CC1F24',
};
const SIZE_MAP = {
  sm: { height: 20, paddingHorizontal: 6, fontSize: 12 },
  md: { height: 24, paddingHorizontal: 8, fontSize: 12 },
  lg: { height: 28, paddingHorizontal: 10, fontSize: 12 },
};
// D-14: null / unknown / 'not-applicable' → return null
// D-15: size differentiation via height and padding only (font stays 12 across all sizes)
// 'a-plus' → label "A+" with dark green
// prefix: "NS" for nutriscore, "ES" for ecoscore
```

### Pattern 6: Store Type Extension
**What:** Add optional grade fields + food_product_id to NutritionEntry so dashboard can filter and display them.
**When to use:** Required before NutritionDashboard can access grade data from todayLogs.
```typescript
// Modified: plugins/nutrition/src/store.ts
interface NutritionEntry {
  id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g?: number;
  food_product_id?: string | null;    // NEW
  nutriscore_grade?: string | null;   // NEW
  ecoscore_grade?: string | null;     // NEW
}
```

### Pattern 7: Real-Time Macro Rescaling
**What:** Derived values computed inline from `servingGrams` state — not stored in state.
**When to use:** Serving size adjuster in product card.
```typescript
const [servingGrams, setServingGrams] = useState(product.serving_size_g ?? 100);
const clamp = (v: number) => Math.max(1, Math.min(1000, v));

// Computed inline, not in state:
const scaledCalories = Math.round((servingGrams / 100) * product.energy_kcal);
const scaledProtein  = +(( servingGrams / 100) * product.proteins_g).toFixed(1);
// etc.
```

### Pattern 8: Dashboard Score Widget (Conditional)
**What:** Compute `scoredMeals` from todayLogs, conditionally render widget.
**When to use:** NutritionDashboard after macros row, before TDEE link.
```typescript
const VALID_GRADES = ['a', 'b', 'c', 'd', 'e', 'a-plus'];
const scoredMeals = todayLogs.filter(l =>
  l.nutriscore_grade && VALID_GRADES.includes(l.nutriscore_grade)
);

if (scoredMeals.length === 0) return null; // widget hidden

// Average calculation (D-22):
const gradeToNum: Record<string, number> = {
  'a-plus': 1, a: 1, b: 2, c: 3, d: 4, e: 5,
};
const numToGrade: Record<number, string> = {
  1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e',
};
const avg = Math.round(
  scoredMeals.reduce((sum, l) => sum + (gradeToNum[l.nutriscore_grade!] ?? 3), 0)
  / scoredMeals.length
);
const avgGrade = numToGrade[avg] ?? 'c';
```

### Anti-Patterns to Avoid
- **`barcodeTypes` as direct prop:** In expo-camera v17 it must be inside `barcodeScannerSettings`. The pantry BarcodeScanner.tsx confirms this.
- **useState for scan guard:** Must use `useRef(false)`. `useState` causes a re-render before the async call resolves, potentially allowing a second scan event to pass the guard. Confirmed by STATE.md accumulated decisions.
- **StyleSheet usage:** CLAUDE.md mandates inline style objects or NativeWind classes only. No `StyleSheet.create`.
- **Alert.alert:** Must use `showAlert` from `@ziko/plugin-sdk`. CLAUDE.md mandate.
- **Storing scaled macros in state:** These are purely derived from `servingGrams` and `product` — computing inline avoids sync issues.
- **Rendering badge for null/not-applicable ecoscore:** Component must return null silently, not show a "?" or empty badge. STATE.md confirms `'not-applicable'` → null.
- **Forgetting `food_product_id` in saveLog payload:** The barcode flow must pass `food_product_id`, `nutriscore_grade`, `ecoscore_grade` to saveLog. Manual/search/scan tabs continue calling saveLog without these (they default to null in DB).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera access + permission | Custom permission flow | `useCameraPermissions()` from expo-camera | Handles iOS/Android permission state machine; pantry plugin already uses this pattern |
| Barcode detection | Manual image processing | `CameraView.onBarcodeScanned` + `barcodeScannerSettings` | Hardware-accelerated; cross-platform |
| Product lookup + caching | Direct OFF API + cache logic | `getOrFetchProduct()` from `offApi.ts` | Phase 10 deliverable; includes Supabase cache, NaN guards, ecoscore normalization |
| Score badge rendering logic | Inline grade-to-color maps scattered across files | `ScoreBadge` component | Single source of truth for grade colors, sizes, null handling, 'a-plus' edge case |

**Key insight:** The entire network/persistence layer is complete from Phase 10. This phase is entirely presentation-layer work.

---

## Common Pitfalls

### Pitfall 1: barcodeScannerSettings vs barcodeTypes Prop
**What goes wrong:** Passing `barcodeTypes={['ean13']}` as a direct prop to `CameraView` — it does nothing silently in expo-camera v17.
**Why it happens:** CONTEXT.md D-05 shorthand looks like a direct prop; older expo-camera docs used different API.
**How to avoid:** Always nest inside `barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}`. Confirmed working in pantry BarcodeScanner.tsx.
**Warning signs:** Scanner accepts QR codes or other formats when it shouldn't.

### Pitfall 2: useState Instead of useRef for Scan Guard
**What goes wrong:** A second `onBarcodeScanned` event fires before `scannedRef.current` is set (re-render delay with useState).
**Why it happens:** React batches state updates; the guard may not be truthy when the second event arrives.
**How to avoid:** `const scannedRef = useRef(false)` — mutations are synchronous, no re-render.
**Warning signs:** `getOrFetchProduct()` called twice for the same scan, producing duplicate product cards or duplicate log entries.

### Pitfall 3: NutritionEntry Type Missing Grade Fields
**What goes wrong:** `todayLogs` items don't have `nutriscore_grade` in TypeScript — accessing `l.nutriscore_grade` causes a type error, and the `select('*')` result silently drops unknown fields from the typed interface.
**Why it happens:** `store.ts` defines `NutritionEntry` without the Phase 10 columns.
**How to avoid:** Extend `NutritionEntry` with optional grade fields before implementing dashboard features.
**Warning signs:** TypeScript error on `l.nutriscore_grade` in NutritionDashboard.

### Pitfall 4: saveLog Not Passing Grade Fields for Barcode Entries
**What goes wrong:** Logs saved from the barcode tab have null `nutriscore_grade` and `ecoscore_grade` in the database even though the product has grades.
**Why it happens:** Existing `saveLog()` call in LogMealScreen does not include these fields.
**How to avoid:** Extend `saveLog()` to accept optional `food_product_id`, `nutriscore_grade`, `ecoscore_grade` and include them in the insert payload when logging from the barcode flow. D-10: "Enter manually" from product card should still pass grades.
**Warning signs:** Score badges never appear on journal entries after scanning.

### Pitfall 5: Android Camera Permission
**What goes wrong:** Camera permission shows on iOS but silently fails on Android — `useCameraPermissions()` returns denied without a visible prompt.
**Why it happens:** Android requires `CAMERA` permission declared in `app.json` `android.permissions`.
**How to avoid:** Verify `android.permission.CAMERA` is in `apps/mobile/app.json`. Currently the file only declares `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` for Android — `CAMERA` is not listed (iOS has `NSCameraUsageDescription` but Android permissions array may need updating).
**Warning signs:** Camera tab shows permission-denied state on all Android devices without ever showing a prompt.

### Pitfall 6: Dashboard Widget Shown for Zero Scored Meals
**What goes wrong:** Widget renders when `scoredMeals.length === 0`, showing a broken ScoreBadge with no grade.
**Why it happens:** Missing null-guard on widget render.
**How to avoid:** `if (scoredMeals.length === 0) return null;` as the first line of the widget render logic. Flagged in STATE.md blockers.
**Warning signs:** Empty widget card visible when no barcode meals logged.

### Pitfall 7: 'a-plus' Not Handled in Average Calculation
**What goes wrong:** Grade averaging breaks when a product has `nutriscore_grade = 'a-plus'` — `gradeToNum['a-plus']` is undefined, Math.round gets NaN.
**Why it happens:** `'a-plus'` is a real value stored in the DB per Phase 10 spec, different from `'a'`.
**How to avoid:** Include `'a-plus': 1` in the gradeToNum mapping. The VALID_GRADES filter must also include `'a-plus'`.

---

## Code Examples

Verified patterns from official sources:

### expo-camera v17 CameraView with barcode scanning
```typescript
// Source: plugins/pantry/src/screens/BarcodeScanner.tsx (working codebase reference)
import { CameraView, useCameraPermissions } from 'expo-camera';

const [permission, requestPermission] = useCameraPermissions();
const scannedRef = useRef(false);

<CameraView
  style={{ flex: 1 }}
  facing="back"
  onBarcodeScanned={handleBarcodeScanned}
  barcodeScannerSettings={{
    barcodeTypes: ['ean13'],  // EAN-13 only per D-05
  }}
/>
```

### Translucent overlay with rectangular reticle (View-based)
```typescript
// View-based overlay — no SVG dependency
<View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
  {/* The overlay itself is not semi-transparent here — the surrounding Views create the darkened border effect */}
  {/* Alternative: wrap with rgba background and use a transparent cutout via nested Views */}
  <View style={{ width: 260, height: 120, borderRadius: 10, borderWidth: 2, borderColor: '#fff' }} />
  <Text style={{ color: '#fff', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
    {t('nutrition.barcodeAlign')}
  </Text>
</View>
```

### ScoreBadge component structure
```typescript
// File: plugins/nutrition/src/components/ScoreBadge.tsx
const GRADE_COLORS: Record<string, string> = {
  'a': '#1A7F37', 'a-plus': '#1A7F37',
  'b': '#78B346', 'c': '#F5A623', 'd': '#E3692B', 'e': '#CC1F24',
};
const GRADE_LABELS: Record<string, string> = {
  'a-plus': 'A+', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E',
};
const PREFIX: Record<'nutriscore' | 'ecoscore', string> = {
  nutriscore: 'NS', ecoscore: 'ES',
};
const SIZE_STYLES = {
  sm: { height: 20, paddingHorizontal: 6, fontSize: 12 },
  md: { height: 24, paddingHorizontal: 8, fontSize: 12 },
  lg: { height: 28, paddingHorizontal: 10, fontSize: 12 },
};

export default function ScoreBadge({
  grade, type, size
}: { grade: string | null; type: 'nutriscore' | 'ecoscore'; size: 'sm' | 'md' | 'lg' }) {
  if (!grade) return null;
  const normalized = grade.toLowerCase();
  const color = GRADE_COLORS[normalized];
  if (!color) return null;  // unknown grade — omit
  const { height, paddingHorizontal, fontSize } = SIZE_STYLES[size];
  return (
    <View style={{ height, paddingHorizontal, backgroundColor: color, borderRadius: height / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize, fontWeight: '700' }}>
        {PREFIX[type]} {GRADE_LABELS[normalized]}
      </Text>
    </View>
  );
}
```

### saveLog extension for barcode fields
```typescript
// Modified: plugins/nutrition/src/screens/LogMealScreen.tsx saveLog()
const saveLog = async (entry: {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g: number;
  food_product_id?: string | null;
  nutriscore_grade?: string | null;
  ecoscore_grade?: string | null;
}) => {
  // ... existing auth check ...
  const { data, error } = await supabase.from('nutrition_logs').insert({
    ...entry,
    user_id: user.id,
    date: selectedDate,
    meal_type: mealType,
  }).select().single();
  // ... existing error/success handling ...
};
```

### Journal entry row badge injection
```typescript
// Modified: NutritionDashboard.tsx meal entry row
<TouchableOpacity key={log.id} onLongPress={() => deleteLog(log.id)}
  style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }}>
  <View style={{ flex: 1 }}>
    <Text style={{ color: theme.text, fontWeight: '500', fontSize: 14 }}>{log.food_name}</Text>
    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>
      P: {log.protein_g}g · C: {log.carbs_g}g · F: {log.fat_g}g
    </Text>
  </View>
  {/* NEW: badge container between name and calories */}
  {(log.nutriscore_grade || log.ecoscore_grade) && (
    <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 6 }}>
      <ScoreBadge grade={log.nutriscore_grade ?? null} type="nutriscore" size="sm" />
      <ScoreBadge grade={log.ecoscore_grade ?? null} type="ecoscore" size="sm" />
    </View>
  )}
  <Text style={{ color: theme.primary, fontWeight: '600' }}>{Math.round(log.calories)} kcal</Text>
</TouchableOpacity>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-camera | Barcode tab CameraView | Yes | ~17.0.10 | — |
| expo-location | Reference only (cardio permission pattern) | Yes | ~19.0.8 | — |
| Node.js | Build tooling | Yes | 25.7.0 | — |
| iOS NSCameraUsageDescription | iOS barcode tab | Yes | set in app.json | — |
| Android CAMERA permission | Android barcode tab | VERIFY | Not seen in app.json android.permissions | Add `android.permission.CAMERA` to app.json if missing |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Android CAMERA permission in `app.json` — currently only `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are listed. expo-camera may request CAMERA permission implicitly via Expo managed workflow, but this must be verified. If absent, Android barcode tab will fail silently on production builds.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in plugins/nutrition/ |
| Config file | None |
| Quick run command | N/A — no test infrastructure |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-02 | Product not found → inline not-found state | manual-only | N/A — requires device + camera | No test infra |
| SCORE-01 | Product card renders with badges and serving adjuster | manual-only | N/A — requires device + barcode | No test infra |
| SCORE-02 | Journal entry rows show score badges when grades present | manual-only | N/A — requires Supabase + logged data | No test infra |
| SCORE-03 | Dashboard widget hidden when no scored meals; visible with correct average | manual-only | N/A — requires Supabase + logged data | No test infra |

**Note:** ScoreBadge grade-to-color logic and average grade calculation are pure functions that could be unit-tested. However, the project has no test infrastructure (no vitest/jest config, no test files in nutrition plugin). Given the UI-dominant nature of this phase, manual device testing is the validation method.

### Sampling Rate
- **Per task commit:** Visual review of affected screen on device/simulator
- **Per wave merge:** Full barcode scan flow with a real EAN-13 product barcode (STATE.md blocker: "validate image_front_small_url vs image_front_url field coverage from a live OFF response before wiring ProductCard")
- **Phase gate:** All 4 requirement behaviors verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- No test framework needs installation — this phase is manual-validation only.
- No Wave 0 test infrastructure to create.

*(If no gaps: "None — manual validation is the established approach for this project's mobile UI phases")*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| No `Alert.alert` — use `showAlert` from `@ziko/plugin-sdk` | Network error in `getOrFetchProduct()` must use `showAlert` |
| No `StyleSheet` — use inline style objects or NativeWind | All product card and badge styles must be inline objects |
| Icons: Ionicons from `@expo/vector-icons` | `barcode-outline`, `nutrition-outline`, `camera-off-outline` for tab, fallback, permission states |
| Light sport theme, no dark mode | All colors from `theme.background`, `theme.surface`, `theme.text`, `theme.muted`, `theme.border`, `theme.primary` |
| `paddingBottom: 100` on scroll containers | Product card ScrollView and NutritionDashboard need this |
| `useTranslation()` from `@ziko/plugin-sdk` | All strings via `t('nutrition.*')` keys |
| Plugin manifest `icon` must be Ionicons name | Not relevant (no manifest changes this phase) |
| `expo-camera` CameraView not old `Camera` | Use `CameraView` from `expo-camera` |

---

## Open Questions

1. **Android CAMERA permission in app.json**
   - What we know: iOS `NSCameraUsageDescription` is set. Android permissions array only shows `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`.
   - What's unclear: Whether Expo managed workflow auto-includes CAMERA permission, or whether it needs explicit declaration.
   - Recommendation: Add `"android.permission.CAMERA"` to `apps/mobile/app.json` `android.permissions` array in Wave 0 or Task 1 to be safe. Cost is zero; risk of omission is silent failure on Android production builds.

2. **image_front_small_url coverage from live OFF responses**
   - What we know: `offApi.ts` fetches `image_front_small_url` and stores as `image_url`. STATE.md blocker notes: "validate image_front_small_url vs image_front_url field coverage from a live OFF response before wiring ProductCard".
   - What's unclear: What percentage of EAN-13 products have `image_front_small_url` populated vs the full-size `image_front_url`.
   - Recommendation: The product card photo slot has an explicit fallback (`nutrition-outline` icon) for null `image_url` — implement the fallback from the start (D-09 already specifies this). The planner should note this as a physical-device validation step.

3. **Tab toggle width with 4 items**
   - What we know: The existing tab toggle has 3 items with `flex: 1` each, and `fontSize: 14`. The UI-SPEC specifies `fontSize: 12` for badge text but tab labels use `fontWeight: '700', fontSize: 12`.
   - What's unclear: Whether 4 `flex: 1` pill tabs at fontSize 12 fit within the available screen width without truncation.
   - Recommendation: Use `fontSize: 12` for all 4 tab labels (UI-SPEC confirmed this) and keep the existing `paddingVertical: 8` — this gives adequate touch target while fitting 4 labels.

---

## Sources

### Primary (HIGH confidence)
- `plugins/pantry/src/screens/BarcodeScanner.tsx` — expo-camera v17 CameraView, useCameraPermissions, scannedRef pattern
- `plugins/nutrition/src/screens/LogMealScreen.tsx` — existing tab structure, saveLog, editScanResult patterns
- `plugins/nutrition/src/screens/NutritionDashboard.tsx` — existing journal row layout, widget positioning
- `plugins/nutrition/src/store.ts` — NutritionEntry type, todayLogs shape
- `plugins/nutrition/src/utils/offApi.ts` — FoodProduct interface, getOrFetchProduct return contract
- `supabase/migrations/024_food_products.sql` — nutrition_logs columns, food_products schema
- `apps/mobile/package.json` — expo-camera ~17.0.10 confirmed
- `apps/mobile/app.json` — iOS NSCameraUsageDescription confirmed
- `packages/plugin-sdk/src/i18n.ts` — existing nutrition.* keys (FR + EN)
- `.planning/STATE.md` — scannedRef pattern, ecoscore null handling, food_products RLS, Android permission concern
- `CLAUDE.md` — showAlert, no StyleSheet, Ionicons, theme conventions

### Secondary (MEDIUM confidence)
- UI-SPEC `11-UI-SPEC.md` — verified all size values, colors, typography scale, copywriting contract

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed in package.json; API confirmed from working pantry code
- Architecture: HIGH — all patterns verified from existing working code in the same codebase
- Pitfalls: HIGH — most sourced from STATE.md accumulated decisions and direct code inspection
- Store extension: HIGH — NutritionEntry type inspected directly; gap confirmed

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable React Native + expo-camera ecosystem)
