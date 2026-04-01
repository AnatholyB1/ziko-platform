# Barcode Enrichment & Nutrition Barcode Scan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich Open Food Facts barcode lookups with macros, Nutri-Score, NOVA score, composition and product photo; store the new fields in `pantry_items`; add a barcode scan sub-flow to the Nutrition Scan tab.

**Architecture:** A single shared `BarcodeProduct` type is defined in `plugins/pantry/src/utils/barcode.ts` and exported via the pantry package. `PantryItemForm` receives the full product on scan, stores all fields. `LogMealScreen` imports `BarcodeScanner` + `BarcodeProduct` from `@ziko/plugin-pantry` and shows an enriched card before logging.

**Tech Stack:** React Native, Expo SDK 54, Supabase, Open Food Facts API v2, TypeScript, NativeWind tokens (inline styles), `expo-camera` (CameraView already used by BarcodeScanner).

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `supabase/migrations/024_pantry_macros_scores.sql` | Create | 8 nullable columns on `pantry_items` |
| `plugins/pantry/src/utils/barcode.ts` | Modify | `BarcodeProduct` type + enriched `lookupBarcode` |
| `plugins/pantry/package.json` | Modify | Export `./utils/barcode` and `./screens/BarcodeScanner` |
| `plugins/pantry/src/screens/BarcodeScanner.tsx` | Modify | `onScan` callback type: `string` → `BarcodeProduct` |
| `plugins/pantry/src/screens/PantryItemForm.tsx` | Modify | New state, save payload, UI (photo + macros + scores) |
| `plugins/nutrition/src/screens/LogMealScreen.tsx` | Modify | Barcode sub-flow in Scan tab |
| `packages/plugin-sdk/src/i18n.ts` | Modify | New i18n keys (pantry + nutrition) |
| `plugins/pantry/src/i18n/fr.ts` | Modify | Reference copy FR |
| `plugins/pantry/src/i18n/en.ts` | Modify | Reference copy EN |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/024_pantry_macros_scores.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/024_pantry_macros_scores.sql
-- Add macros, scores, photo URL to pantry_items
-- All columns nullable — existing items (manual entries) are unaffected

ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS calories_per_100g  NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS protein_per_100g   NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS carbs_per_100g     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS fat_per_100g       NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS ingredients_text   TEXT,
  ADD COLUMN IF NOT EXISTS nutriscore_grade   CHAR(1),
  ADD COLUMN IF NOT EXISTS nova_group         SMALLINT,
  ADD COLUMN IF NOT EXISTS product_image_url  TEXT;
```

- [ ] **Step 2: Apply migration**

```bash
cd C:/ziko-platform
npx supabase db push
```

Expected: `Applied 1 migration(s)` (or equivalent success output). If using Supabase Studio, paste the SQL in the SQL Editor and run it.

- [ ] **Step 3: Commit**

```bash
rtk git add supabase/migrations/024_pantry_macros_scores.sql
rtk git commit -m "feat(db): add macros + scores columns to pantry_items (024)"
```

---

## Task 2: Enrich barcode.ts + add package exports

**Files:**
- Modify: `plugins/pantry/src/utils/barcode.ts`
- Modify: `plugins/pantry/package.json`

- [ ] **Step 1: Replace barcode.ts with enriched version**

```typescript
// plugins/pantry/src/utils/barcode.ts

export interface BarcodeProduct {
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

const OFF_FIELDS = [
  'product_name',
  'product_name_fr',
  'nutriments',
  'ingredients_text_fr',
  'ingredients_text',
  'nutriscore_grade',
  'nova_group',
  'image_front_url',
].join(',');

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=${OFF_FIELDS}`;

function parseNutriscoreGrade(raw: unknown): BarcodeProduct['nutriscore_grade'] {
  if (typeof raw !== 'string') return null;
  const upper = raw.toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
    return upper as BarcodeProduct['nutriscore_grade'];
  }
  return null;
}

function parseNovaGroup(raw: unknown): BarcodeProduct['nova_group'] {
  const n = Number(raw);
  if ([1, 2, 3, 4].includes(n)) return n as BarcodeProduct['nova_group'];
  return null;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const res = await fetch(OFF_URL(barcode));
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const n = p.nutriments ?? {};

    return {
      name: (p.product_name_fr ?? p.product_name ?? '').trim() || null as unknown as string,
      image_url: typeof p.image_front_url === 'string' ? p.image_front_url : null,
      calories_per_100g: n['energy-kcal_100g'] != null ? Number(n['energy-kcal_100g']) : null,
      protein_per_100g: n['proteins_100g'] != null ? Number(n['proteins_100g']) : null,
      carbs_per_100g: n['carbohydrates_100g'] != null ? Number(n['carbohydrates_100g']) : null,
      fat_per_100g: n['fat_100g'] != null ? Number(n['fat_100g']) : null,
      ingredients_text:
        typeof p.ingredients_text_fr === 'string' && p.ingredients_text_fr.trim()
          ? p.ingredients_text_fr.trim()
          : typeof p.ingredients_text === 'string' && p.ingredients_text.trim()
          ? p.ingredients_text.trim()
          : null,
      nutriscore_grade: parseNutriscoreGrade(p.nutriscore_grade),
      nova_group: parseNovaGroup(p.nova_group),
    };
  } catch {
    return null;
  }
}
```

Note: the `name` field coerces to `string` — if OFF returns an empty product name, the caller (BarcodeScanner) should treat it as `null` and call `onNotFound()`.

- [ ] **Step 2: Update barcode.ts to handle empty name**

Adjust the return to guard on name:

```typescript
// Replace the return statement with:
    const name = (p.product_name_fr ?? p.product_name ?? '').trim();
    if (!name) return null;   // treat nameless products as not found

    return {
      name,
      image_url: typeof p.image_front_url === 'string' ? p.image_front_url : null,
      calories_per_100g: n['energy-kcal_100g'] != null ? Number(n['energy-kcal_100g']) : null,
      protein_per_100g: n['proteins_100g'] != null ? Number(n['proteins_100g']) : null,
      carbs_per_100g: n['carbohydrates_100g'] != null ? Number(n['carbohydrates_100g']) : null,
      fat_per_100g: n['fat_100g'] != null ? Number(n['fat_100g']) : null,
      ingredients_text:
        typeof p.ingredients_text_fr === 'string' && p.ingredients_text_fr.trim()
          ? p.ingredients_text_fr.trim()
          : typeof p.ingredients_text === 'string' && p.ingredients_text.trim()
          ? p.ingredients_text.trim()
          : null,
      nutriscore_grade: parseNutriscoreGrade(p.nutriscore_grade),
      nova_group: parseNovaGroup(p.nova_group),
    };
```

The full final `barcode.ts` with both steps applied:

```typescript
// plugins/pantry/src/utils/barcode.ts

export interface BarcodeProduct {
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

const OFF_FIELDS = [
  'product_name',
  'product_name_fr',
  'nutriments',
  'ingredients_text_fr',
  'ingredients_text',
  'nutriscore_grade',
  'nova_group',
  'image_front_url',
].join(',');

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.net/api/v2/product/${barcode}?fields=${OFF_FIELDS}`;

function parseNutriscoreGrade(raw: unknown): BarcodeProduct['nutriscore_grade'] {
  if (typeof raw !== 'string') return null;
  const upper = raw.toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
    return upper as BarcodeProduct['nutriscore_grade'];
  }
  return null;
}

function parseNovaGroup(raw: unknown): BarcodeProduct['nova_group'] {
  const n = Number(raw);
  if ([1, 2, 3, 4].includes(n)) return n as BarcodeProduct['nova_group'];
  return null;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const res = await fetch(OFF_URL(barcode));
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const n = p.nutriments ?? {};
    const name = (p.product_name_fr ?? p.product_name ?? '').trim();
    if (!name) return null;

    return {
      name,
      image_url: typeof p.image_front_url === 'string' ? p.image_front_url : null,
      calories_per_100g: n['energy-kcal_100g'] != null ? Number(n['energy-kcal_100g']) : null,
      protein_per_100g: n['proteins_100g'] != null ? Number(n['proteins_100g']) : null,
      carbs_per_100g: n['carbohydrates_100g'] != null ? Number(n['carbohydrates_100g']) : null,
      fat_per_100g: n['fat_100g'] != null ? Number(n['fat_100g']) : null,
      ingredients_text:
        typeof p.ingredients_text_fr === 'string' && p.ingredients_text_fr.trim()
          ? p.ingredients_text_fr.trim()
          : typeof p.ingredients_text === 'string' && p.ingredients_text.trim()
          ? p.ingredients_text.trim()
          : null,
      nutriscore_grade: parseNutriscoreGrade(p.nutriscore_grade),
      nova_group: parseNovaGroup(p.nova_group),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Add exports to plugins/pantry/package.json**

Current exports block:
```json
"exports": {
  ".": "./src/index.ts",
  "./manifest": "./src/manifest.ts",
  "./store": "./src/store.ts",
  "./screens/PantryDashboard": "./src/screens/PantryDashboard.tsx",
  "./screens/PantryItemForm": "./src/screens/PantryItemForm.tsx",
  "./screens/PantryRecipes": "./src/screens/PantryRecipes.tsx",
  "./screens/RecipeDetail": "./src/screens/RecipeDetail.tsx",
  "./screens/RecipeConfirm": "./src/screens/RecipeConfirm.tsx",
  "./screens/ShoppingList": "./src/screens/ShoppingList.tsx"
}
```

Add two new entries (after `"./screens/ShoppingList"`):
```json
    "./screens/BarcodeScanner": "./src/screens/BarcodeScanner.tsx",
    "./utils/barcode": "./src/utils/barcode.ts"
```

Full updated exports block:
```json
"exports": {
  ".": "./src/index.ts",
  "./manifest": "./src/manifest.ts",
  "./store": "./src/store.ts",
  "./screens/PantryDashboard": "./src/screens/PantryDashboard.tsx",
  "./screens/PantryItemForm": "./src/screens/PantryItemForm.tsx",
  "./screens/PantryRecipes": "./src/screens/PantryRecipes.tsx",
  "./screens/RecipeDetail": "./src/screens/RecipeDetail.tsx",
  "./screens/RecipeConfirm": "./src/screens/RecipeConfirm.tsx",
  "./screens/ShoppingList": "./src/screens/ShoppingList.tsx",
  "./screens/BarcodeScanner": "./src/screens/BarcodeScanner.tsx",
  "./utils/barcode": "./src/utils/barcode.ts"
}
```

- [ ] **Step 4: Type-check**

```bash
cd C:/ziko-platform && rtk npm run type-check 2>&1 | tail -5
```

Expected: `Tasks: N successful, N total` with 0 errors. The only expected TypeScript error at this point is in `BarcodeScanner.tsx` because `onScan` still expects `string` — that's fixed in the next task.

- [ ] **Step 5: Commit**

```bash
rtk git add plugins/pantry/src/utils/barcode.ts plugins/pantry/package.json
rtk git commit -m "feat(pantry): BarcodeProduct type + enriched lookupBarcode, export barcode utils"
```

---

## Task 3: Update BarcodeScanner.tsx callback type

**Files:**
- Modify: `plugins/pantry/src/screens/BarcodeScanner.tsx`

- [ ] **Step 1: Update BarcodeScanner props interface and onScan callback**

Change `onScan: (name: string) => void` to `onScan: (product: BarcodeProduct) => void` and import `BarcodeProduct`.

Full updated file:

```typescript
// plugins/pantry/src/screens/BarcodeScanner.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { lookupBarcode, type BarcodeProduct } from '../utils/barcode';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (product: BarcodeProduct) => void;
  onNotFound: () => void;
}

export default function BarcodeScanner({ visible, onClose, onScan, onNotFound }: BarcodeScannerProps) {
  const [, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setScanning(false);
    }
  }, [visible]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanning(true);

    try {
      const product = await lookupBarcode(data);
      if (product) {
        onScan(product);
        onClose();
      } else {
        onNotFound();
        onClose();
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
          }}
        />

        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF', fontSize: 14, fontWeight: '400',
              marginBottom: 16, textAlign: 'center', paddingHorizontal: 32,
            }}
          >
            Placez le code-barres dans le cadre
          </Text>

          <View
            style={{
              width: 250, height: 250,
              borderWidth: 2, borderColor: '#FFFFFF',
              borderRadius: 8, backgroundColor: 'transparent',
            }}
          />

          {scanning && (
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '400', marginTop: 8 }}>
                Recherche du produit...
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={onClose}
          accessibilityLabel="Fermer le scanner"
          style={{ position: 'absolute', top: 48, right: 16, padding: 10 }}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd C:/ziko-platform && rtk npm run type-check 2>&1 | tail -5
```

Expected: Errors only in `PantryItemForm.tsx` (onScan type mismatch `(string) => void` vs `(BarcodeProduct) => void`) — fixed in the next task.

- [ ] **Step 3: Commit**

```bash
rtk git add plugins/pantry/src/screens/BarcodeScanner.tsx
rtk git commit -m "feat(pantry): BarcodeScanner onScan passes BarcodeProduct instead of string"
```

---

## Task 4: PantryItemForm.tsx — full update

**Files:**
- Modify: `plugins/pantry/src/screens/PantryItemForm.tsx`

- [ ] **Step 1: Add Image import + BarcodeProduct import**

At the top of the file, update the react-native import and add the barcode import:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCameraPermissions } from 'expo-camera';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { usePantryStore } from '../store';
import BarcodeScanner from './BarcodeScanner';
import type { BarcodeProduct } from '../utils/barcode';
```

- [ ] **Step 2: Add badge color constants (after imports, before component)**

```typescript
const NUTRISCORE_COLORS: Record<string, string> = {
  A: '#0D7C3A', B: '#85BB2F', C: '#FFCA02', D: '#EE8100', E: '#E63312',
};

const NOVA_COLORS: Record<number, string> = {
  1: '#0D7C3A', 2: '#85BB2F', 3: '#FFCA02', 4: '#E63312',
};
```

- [ ] **Step 3: Add new state variables (inside the component, after existing state)**

Add after `const [loadingItem, setLoadingItem] = useState(false);`:

```typescript
  // ── Macros state (per 100g) ─────────────────────────
  const [calories100g, setCalories100g] = useState('');
  const [protein100g, setProtein100g] = useState('');
  const [carbs100g, setCarbs100g] = useState('');
  const [fat100g, setFat100g] = useState('');

  // ── Product info state ──────────────────────────────
  const [nutriscoreGrade, setNutriscoreGrade] = useState<string | null>(null);
  const [novaGroup, setNovaGroup] = useState<number | null>(null);
  const [ingredientsText, setIngredientsText] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [showFullIngredients, setShowFullIngredients] = useState(false);
```

- [ ] **Step 4: Update edit mode useEffect to populate new fields**

Find the `.then(({ data, error }) => {` block inside the edit useEffect and add these lines after `setLowStockThreshold(...)`:

```typescript
          setCalories100g(data.calories_per_100g != null ? String(data.calories_per_100g) : '');
          setProtein100g(data.protein_per_100g != null ? String(data.protein_per_100g) : '');
          setCarbs100g(data.carbs_per_100g != null ? String(data.carbs_per_100g) : '');
          setFat100g(data.fat_per_100g != null ? String(data.fat_per_100g) : '');
          setNutriscoreGrade(data.nutriscore_grade ?? null);
          setNovaGroup(data.nova_group ?? null);
          setIngredientsText(data.ingredients_text ?? '');
          setProductImageUrl(data.product_image_url ?? '');
```

- [ ] **Step 5: Update handleSave to include new columns in payload**

Inside `handleSave`, find the `const payload = { ... };` block and add the new fields:

```typescript
      const payload = {
        name: name.trim(),
        quantity: qty,
        unit,
        storage_location: storageLocation,
        food_category: foodCategory,
        expiration_date: expirationDate
          ? expirationDate.toISOString().split('T')[0]
          : null,
        low_stock_threshold: lowStockThreshold ? parseFloat(lowStockThreshold) : 1,
        calories_per_100g: calories100g ? parseFloat(calories100g) : null,
        protein_per_100g: protein100g ? parseFloat(protein100g) : null,
        carbs_per_100g: carbs100g ? parseFloat(carbs100g) : null,
        fat_per_100g: fat100g ? parseFloat(fat100g) : null,
        nutriscore_grade: nutriscoreGrade ?? null,
        nova_group: novaGroup ?? null,
        ingredients_text: ingredientsText || null,
        product_image_url: productImageUrl || null,
      };
```

- [ ] **Step 6: Update BarcodeScanner onScan callback**

Find the `<BarcodeScanner` usage at the bottom of the JSX and replace `onScan={(scannedName) => setName(scannedName)}`:

```typescript
      <BarcodeScanner
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onScan={(product) => {
          setName(product.name);
          setCalories100g(product.calories_per_100g != null ? String(product.calories_per_100g) : '');
          setProtein100g(product.protein_per_100g != null ? String(product.protein_per_100g) : '');
          setCarbs100g(product.carbs_per_100g != null ? String(product.carbs_per_100g) : '');
          setFat100g(product.fat_per_100g != null ? String(product.fat_per_100g) : '');
          setNutriscoreGrade(product.nutriscore_grade ?? null);
          setNovaGroup(product.nova_group ?? null);
          setIngredientsText(product.ingredients_text ?? '');
          setProductImageUrl(product.image_url ?? '');
        }}
        onNotFound={() =>
          showAlert(t('pantry.barcode_not_found_title'), t('pantry.barcode_not_found'))
        }
      />
```

- [ ] **Step 7: Add product photo preview before the name field**

In the ScrollView, just before the `{/* 2. Nom */}` comment:

```typescript
          {/* Product photo preview — shown only when image_url was retrieved */}
          {productImageUrl ? (
            <Image
              source={{ uri: productImageUrl }}
              style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 16 }}
              resizeMode="cover"
            />
          ) : null}
```

- [ ] **Step 8: Add macros section before the CTA button**

Just before `{/* CTA button */}`:

```typescript
          {/* ── Macros (pour 100g) ── */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, marginBottom: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('pantry.macros_section')}
          </Text>
          {([
            { key: 'cal', label: t('pantry.field_calories_100g'), value: calories100g, setter: setCalories100g },
            { key: 'pro', label: t('pantry.field_protein_100g'), value: protein100g, setter: setProtein100g },
            { key: 'car', label: t('pantry.field_carbs_100g'), value: carbs100g, setter: setCarbs100g },
            { key: 'fat', label: t('pantry.field_fat_100g'), value: fat100g, setter: setFat100g },
          ] as const).map(({ key, label, value, setter }) => (
            <View key={key}>
              <Text style={fieldLabelStyle}>{label}</Text>
              <TextInput
                value={value}
                onChangeText={setter as (v: string) => void}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.muted}
                style={textInputStyle}
              />
            </View>
          ))}
```

- [ ] **Step 9: Add quality scores section after macros, before CTA button**

```typescript
          {/* ── Qualité produit — only shown when at least one field is present ── */}
          {(nutriscoreGrade || novaGroup || ingredientsText) ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.muted, marginBottom: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('pantry.quality_section')}
              </Text>

              {/* Score badges row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {nutriscoreGrade ? (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: NUTRISCORE_COLORS[nutriscoreGrade] ?? '#999' }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                      {t('pantry.nutriscore_label')} {nutriscoreGrade}
                    </Text>
                  </View>
                ) : null}
                {novaGroup ? (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: NOVA_COLORS[novaGroup] ?? '#999' }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                      NOVA {novaGroup}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Expandable composition */}
              {ingredientsText ? (
                <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}>
                  <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                    {t('pantry.ingredients_label')}
                  </Text>
                  <Text
                    numberOfLines={showFullIngredients ? undefined : 3}
                    style={{ color: theme.text, fontSize: 13, lineHeight: 18 }}
                  >
                    {ingredientsText}
                  </Text>
                  {ingredientsText.length > 120 ? (
                    <TouchableOpacity
                      onPress={() => setShowFullIngredients((v) => !v)}
                      style={{ marginTop: 6 }}
                    >
                      <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                        {showFullIngredients ? t('pantry.ingredients_show_less') : t('pantry.ingredients_show_more')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
```

- [ ] **Step 10: Type-check**

```bash
cd C:/ziko-platform && rtk npm run type-check 2>&1 | tail -5
```

Expected: 0 errors across all packages.

- [ ] **Step 11: Commit**

```bash
rtk git add plugins/pantry/src/screens/PantryItemForm.tsx
rtk git commit -m "feat(pantry): PantryItemForm stores macros, Nutri-Score, NOVA, photo from barcode"
```

---

## Task 5: LogMealScreen.tsx — barcode sub-flow

**Files:**
- Modify: `plugins/nutrition/src/screens/LogMealScreen.tsx`

- [ ] **Step 1: Add imports at the top of LogMealScreen.tsx**

After the existing imports, add:

```typescript
import BarcodeScanner from '@ziko/plugin-pantry/screens/BarcodeScanner';
import type { BarcodeProduct } from '@ziko/plugin-pantry/utils/barcode';
```

- [ ] **Step 2: Add badge color constants (before the component function)**

```typescript
const NUTRISCORE_COLORS: Record<string, string> = {
  A: '#0D7C3A', B: '#85BB2F', C: '#FFCA02', D: '#EE8100', E: '#E63312',
};

const NOVA_COLORS: Record<number, string> = {
  1: '#0D7C3A', 2: '#85BB2F', 3: '#FFCA02', 4: '#E63312',
};
```

- [ ] **Step 3: Add new state variables (inside the component, after existing scan state)**

Add after `const [scanDescription, setScanDescription] = useState('');`:

```typescript
  // ── Barcode sub-flow state ───────────────────────────
  const [scanSubMode, setScanSubMode] = useState<'choice' | 'photo' | 'barcode'>('choice');
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [barcodeIngredientExpanded, setBarcodeIngredientExpanded] = useState(false);
  const barcodeResultReceivedRef = React.useRef(false);
```

- [ ] **Step 4: Add logBarcodeProduct and editBarcodeProduct functions**

Add after the `logScanResult` function:

```typescript
  const logBarcodeProduct = () => {
    if (!barcodeProduct) return;
    saveLog({
      food_name: barcodeProduct.name,
      calories: barcodeProduct.calories_per_100g ?? 0,
      protein_g: barcodeProduct.protein_per_100g ?? 0,
      carbs_g: barcodeProduct.carbs_per_100g ?? 0,
      fat_g: barcodeProduct.fat_per_100g ?? 0,
      serving_g: 100,
    });
  };

  const editBarcodeProduct = () => {
    if (!barcodeProduct) return;
    setCustom({
      name: barcodeProduct.name,
      calories: String(barcodeProduct.calories_per_100g ?? 0),
      protein_g: String(barcodeProduct.protein_per_100g ?? 0),
      carbs_g: String(barcodeProduct.carbs_per_100g ?? 0),
      fat_g: String(barcodeProduct.fat_per_100g ?? 0),
      serving_g: '100',
    });
    setTab('custom');
    setScanSubMode('choice');
    setBarcodeProduct(null);
    setBarcodeNotFound(false);
  };
```

- [ ] **Step 5: Replace the scan tab render block**

Find the `tab === 'scan' ?` ternary. Replace the entire scan tab block (the `<ScrollView>...</ScrollView>`) with:

```typescript
        ) : tab === 'scan' ? (
          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>

            {/* ── Choice screen ── */}
            {scanSubMode === 'choice' && (
              <View style={{ paddingTop: 40 }}>
                <TouchableOpacity
                  onPress={() => setScanSubMode('photo')}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 16,
                    backgroundColor: theme.surface, borderRadius: 16, padding: 20,
                    borderWidth: 1, borderColor: theme.border, marginBottom: 12,
                  }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="camera-outline" size={24} color={theme.primary} />
                  </View>
                  <Text style={{ flex: 1, color: theme.text, fontWeight: '700', fontSize: 15 }}>
                    {t('nutrition.scan_choice_photo')}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    barcodeResultReceivedRef.current = false;
                    setScanSubMode('barcode');
                    setShowBarcodeCamera(true);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 16,
                    backgroundColor: theme.surface, borderRadius: 16, padding: 20,
                    borderWidth: 1, borderColor: theme.border,
                  }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barcode-outline" size={24} color={theme.primary} />
                  </View>
                  <Text style={{ flex: 1, color: theme.text, fontWeight: '700', fontSize: 15 }}>
                    {t('nutrition.scan_choice_barcode')}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.muted} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Photo sub-flow: camera/gallery picker ── */}
            {scanSubMode === 'photo' && !scanImage && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <TouchableOpacity
                  onPress={() => setScanSubMode('choice')}
                  style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 24 }}
                >
                  <Ionicons name="chevron-back" size={20} color={theme.muted} />
                  <Text style={{ color: theme.muted, fontSize: 14, marginLeft: 4 }}>Retour</Text>
                </TouchableOpacity>

                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
                  <Ionicons name="camera-outline" size={44} color={theme.primary} />
                </View>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{t('nutrition.scanMeal')}</Text>
                <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 }}>
                  {t('nutrition.scanDesc')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                  <TouchableOpacity onPress={() => pickImage('camera')}
                    style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('nutrition.camera')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => pickImage('gallery')}
                    style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.border }}>
                    <Ionicons name="images" size={20} color={theme.primary} />
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{t('nutrition.gallery')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Photo sub-flow: image preview + AI results ── */}
            {scanImage && (
              <View>
                <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                  <Image source={{ uri: scanImage }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => { setScanImage(null); setScanResults(null); setScanSubMode('choice'); }}
                    style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 13 }}>{t('nutrition.newScan')}</Text>
                  </TouchableOpacity>
                </View>

                {analyzing ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>{t('nutrition.analyzing')}</Text>
                  </View>
                ) : scanResults ? (
                  <View>
                    {scanDescription ? (
                      <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 12, fontStyle: 'italic' }}>{scanDescription}</Text>
                    ) : null}

                    {scanResults.length === 0 ? (
                      <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>{t('nutrition.noFood')}</Text>
                    ) : (
                      scanResults.map((food, i) => (
                        <View key={i} style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{food.food_name}</Text>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: food.confidence === 'high' ? '#dcfce7' : food.confidence === 'medium' ? '#fef3c7' : '#fee2e2' }}>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: food.confidence === 'high' ? '#16a34a' : food.confidence === 'medium' ? '#d97706' : '#dc2626' }}>{food.confidence}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>{food.calories} kcal</Text>
                            <Text style={{ color: theme.muted, fontSize: 12 }}>{food.serving_g}g serving</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                            {[
                              { label: t('macro.protein'), val: food.protein_g, color: '#3b82f6' },
                              { label: t('macro.carbs'), val: food.carbs_g, color: '#f59e0b' },
                              { label: t('macro.fat'), val: food.fat_g, color: '#ef4444' },
                            ].map((m) => (
                              <View key={m.label} style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                                <Text style={{ color: m.color, fontWeight: '700', fontSize: 14 }}>{m.val}g</Text>
                                <Text style={{ color: theme.muted, fontSize: 10 }}>{m.label}</Text>
                              </View>
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => logScanResult(food)}
                              style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('nutrition.logThis')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => editScanResult(food)}
                              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{t('nutrition.editThis')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            )}

            {/* ── Barcode sub-flow: product not found ── */}
            {scanSubMode === 'barcode' && barcodeNotFound && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="barcode-outline" size={48} color={theme.muted} />
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
                  {t('nutrition.barcode_not_found')}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 }}>
                  {t('nutrition.barcode_not_found_body')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setBarcodeNotFound(false);
                    setScanSubMode('choice');
                  }}
                  style={{ backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{t('nutrition.barcode_rescan')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setTab('custom'); setBarcodeNotFound(false); setScanSubMode('choice'); }}
                  style={{ backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('nutrition.barcode_manual')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Barcode sub-flow: product card ── */}
            {scanSubMode === 'barcode' && barcodeProduct && (
              <View style={{ paddingTop: 16 }}>
                {barcodeProduct.image_url ? (
                  <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                    <Image source={{ uri: barcodeProduct.image_url }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
                  </View>
                ) : null}

                <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}>
                  {/* Name + scores row */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
                    <Text style={{ flex: 1, color: theme.text, fontWeight: '700', fontSize: 16 }}>
                      {barcodeProduct.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {barcodeProduct.nutriscore_grade ? (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: NUTRISCORE_COLORS[barcodeProduct.nutriscore_grade] ?? '#999' }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
                            {t('nutrition.nutriscore_label')} {barcodeProduct.nutriscore_grade}
                          </Text>
                        </View>
                      ) : null}
                      {barcodeProduct.nova_group ? (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: NOVA_COLORS[barcodeProduct.nova_group] ?? '#999' }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
                            {t('nutrition.nova_label')} {barcodeProduct.nova_group}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Macros row */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 16 }}>
                        {barcodeProduct.calories_per_100g ?? '—'}
                      </Text>
                      <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>kcal</Text>
                    </View>
                    {[
                      { label: t('macro.protein'), val: barcodeProduct.protein_per_100g, color: '#3b82f6' },
                      { label: t('macro.carbs'), val: barcodeProduct.carbs_per_100g, color: '#f59e0b' },
                      { label: t('macro.fat'), val: barcodeProduct.fat_per_100g, color: '#ef4444' },
                    ].map((m) => (
                      <View key={m.label} style={{ flex: 1, backgroundColor: theme.background, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ color: m.color, fontWeight: '700', fontSize: 14 }}>
                          {m.val != null ? `${m.val}g` : '—'}
                        </Text>
                        <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{m.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Composition expandable */}
                  {barcodeProduct.ingredients_text ? (
                    <View style={{ backgroundColor: theme.background, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                      <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                        {t('nutrition.composition_label')}
                      </Text>
                      <Text
                        numberOfLines={barcodeIngredientExpanded ? undefined : 3}
                        style={{ color: theme.text, fontSize: 12, lineHeight: 17 }}
                      >
                        {barcodeProduct.ingredients_text}
                      </Text>
                      {barcodeProduct.ingredients_text.length > 120 ? (
                        <TouchableOpacity onPress={() => setBarcodeIngredientExpanded((v) => !v)} style={{ marginTop: 4 }}>
                          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>
                            {barcodeIngredientExpanded ? t('pantry.ingredients_show_less') : t('pantry.ingredients_show_more')}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {/* CTA buttons */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={logBarcodeProduct}
                      style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('nutrition.logThis')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={editBarcodeProduct}
                      style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{t('nutrition.editThis')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Rescan link */}
                  <TouchableOpacity
                    onPress={() => { setBarcodeProduct(null); setScanSubMode('choice'); }}
                    style={{ alignItems: 'center', marginTop: 12 }}
                  >
                    <Text style={{ color: theme.muted, fontSize: 13 }}>{t('nutrition.barcode_rescan')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </ScrollView>
```

- [ ] **Step 6: Add BarcodeScanner modal at the end of the component**

Just before the closing `</SafeAreaView>`, add:

```typescript
        <BarcodeScanner
          visible={showBarcodeCamera}
          onClose={() => {
            setShowBarcodeCamera(false);
            if (!barcodeResultReceivedRef.current) {
              setScanSubMode('choice');
            }
            barcodeResultReceivedRef.current = false;
          }}
          onScan={(product) => {
            barcodeResultReceivedRef.current = true;
            setBarcodeProduct(product);
            setBarcodeNotFound(false);
          }}
          onNotFound={() => {
            barcodeResultReceivedRef.current = true;
            setBarcodeNotFound(true);
            setBarcodeProduct(null);
          }}
        />
```

- [ ] **Step 7: Type-check**

```bash
cd C:/ziko-platform && rtk npm run type-check 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
rtk git add plugins/nutrition/src/screens/LogMealScreen.tsx
rtk git commit -m "feat(nutrition): barcode scan sub-flow in Scan tab with enriched product card"
```

---

## Task 6: i18n keys

**Files:**
- Modify: `packages/plugin-sdk/src/i18n.ts`
- Modify: `plugins/pantry/src/i18n/fr.ts`
- Modify: `plugins/pantry/src/i18n/en.ts`

- [ ] **Step 1: Add pantry keys to packages/plugin-sdk/src/i18n.ts — FR block**

In the FR locale block, find `'pantry.tab_shopping': 'Courses',` and add the new pantry keys AFTER the existing shopping keys (after `'pantry.shop_from_recipe': 'Depuis : {name}',`):

```typescript
  // ── Pantry macros & scores ──
  'pantry.macros_section': 'Macros (pour 100g)',
  'pantry.quality_section': 'Qualité produit',
  'pantry.field_calories_100g': 'Calories (kcal/100g)',
  'pantry.field_protein_100g': 'Protéines (g/100g)',
  'pantry.field_carbs_100g': 'Glucides (g/100g)',
  'pantry.field_fat_100g': 'Lipides (g/100g)',
  'pantry.nutriscore_label': 'Nutri-Score',
  'pantry.nova_label': 'Score NOVA',
  'pantry.ingredients_label': 'Composition',
  'pantry.ingredients_show_more': 'Voir plus',
  'pantry.ingredients_show_less': 'Voir moins',
```

- [ ] **Step 2: Add nutrition barcode keys to FR block**

In the FR locale block, find the existing `nutrition.*` keys and add AFTER the last nutrition key:

```typescript
  // ── Nutrition barcode scan ──
  'nutrition.scan_choice_photo': 'Photographier mon plat',
  'nutrition.scan_choice_barcode': 'Scanner un code-barres',
  'nutrition.barcode_not_found': 'Produit introuvable',
  'nutrition.barcode_not_found_body': "Ce produit n'est pas dans notre base.",
  'nutrition.barcode_manual': 'Saisir manuellement',
  'nutrition.barcode_rescan': 'Scanner à nouveau',
  'nutrition.nutriscore_label': 'Nutri-Score',
  'nutrition.nova_label': 'NOVA',
  'nutrition.composition_label': 'Composition',
```

- [ ] **Step 3: Add pantry keys to EN block**

In the EN locale block, after `'pantry.shop_from_recipe': 'From: {name}',`:

```typescript
  // ── Pantry macros & scores ──
  'pantry.macros_section': 'Macros (per 100g)',
  'pantry.quality_section': 'Product quality',
  'pantry.field_calories_100g': 'Calories (kcal/100g)',
  'pantry.field_protein_100g': 'Protein (g/100g)',
  'pantry.field_carbs_100g': 'Carbs (g/100g)',
  'pantry.field_fat_100g': 'Fat (g/100g)',
  'pantry.nutriscore_label': 'Nutri-Score',
  'pantry.nova_label': 'NOVA Score',
  'pantry.ingredients_label': 'Composition',
  'pantry.ingredients_show_more': 'Show more',
  'pantry.ingredients_show_less': 'Show less',
```

- [ ] **Step 4: Add nutrition barcode keys to EN block**

After the last `nutrition.*` key in the EN block:

```typescript
  // ── Nutrition barcode scan ──
  'nutrition.scan_choice_photo': 'Take a meal photo',
  'nutrition.scan_choice_barcode': 'Scan a barcode',
  'nutrition.barcode_not_found': 'Product not found',
  'nutrition.barcode_not_found_body': 'This product is not in our database.',
  'nutrition.barcode_manual': 'Enter manually',
  'nutrition.barcode_rescan': 'Scan again',
  'nutrition.nutriscore_label': 'Nutri-Score',
  'nutrition.nova_label': 'NOVA',
  'nutrition.composition_label': 'Composition',
```

- [ ] **Step 5: Add reference copies to plugins/pantry/src/i18n/fr.ts**

After the `// ── Shopping List ──` section, add:

```typescript
  // ── Macros & Scores ──
  'pantry.macros_section': 'Macros (pour 100g)',
  'pantry.quality_section': 'Qualité produit',
  'pantry.field_calories_100g': 'Calories (kcal/100g)',
  'pantry.field_protein_100g': 'Protéines (g/100g)',
  'pantry.field_carbs_100g': 'Glucides (g/100g)',
  'pantry.field_fat_100g': 'Lipides (g/100g)',
  'pantry.nutriscore_label': 'Nutri-Score',
  'pantry.nova_label': 'Score NOVA',
  'pantry.ingredients_label': 'Composition',
  'pantry.ingredients_show_more': 'Voir plus',
  'pantry.ingredients_show_less': 'Voir moins',
```

- [ ] **Step 6: Add reference copies to plugins/pantry/src/i18n/en.ts**

After the `// ── Shopping List ──` section, add:

```typescript
  // ── Macros & Scores ──
  'pantry.macros_section': 'Macros (per 100g)',
  'pantry.quality_section': 'Product quality',
  'pantry.field_calories_100g': 'Calories (kcal/100g)',
  'pantry.field_protein_100g': 'Protein (g/100g)',
  'pantry.field_carbs_100g': 'Carbs (g/100g)',
  'pantry.field_fat_100g': 'Fat (g/100g)',
  'pantry.nutriscore_label': 'Nutri-Score',
  'pantry.nova_label': 'NOVA Score',
  'pantry.ingredients_label': 'Composition',
  'pantry.ingredients_show_more': 'Show more',
  'pantry.ingredients_show_less': 'Show less',
```

- [ ] **Step 7: Type-check**

```bash
cd C:/ziko-platform && rtk npm run type-check 2>&1 | tail -5
```

Expected: 0 errors across all 20 packages.

- [ ] **Step 8: Commit**

```bash
rtk git add packages/plugin-sdk/src/i18n.ts plugins/pantry/src/i18n/fr.ts plugins/pantry/src/i18n/en.ts
rtk git commit -m "feat(i18n): add pantry macros/scores and nutrition barcode scan keys (FR + EN)"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Migration ✓, barcode.ts enrichment ✓, BarcodeScanner type ✓, PantryItemForm (state + payload + UI) ✓, LogMealScreen scan sub-flow ✓, i18n ✓
- [x] **Placeholder scan**: No TBD/TODO. All code blocks complete.
- [x] **Type consistency**: `BarcodeProduct` defined in Task 2, imported with `type` keyword in Tasks 3–5. `onScan: (product: BarcodeProduct) => void` consistent across BarcodeScanner, PantryItemForm, LogMealScreen. `saveLog` call in `logBarcodeProduct` matches existing `saveLog` signature. `barcodeResultReceivedRef` ref used consistently in open + close handlers.
- [x] **Migration number**: 022 and 023 already exist — using 024. ✓
- [x] **BarcodeScanner in LogMealScreen**: uses Modal (always visible in component tree) — placed before `</SafeAreaView>`. ✓
- [x] **React state closure issue in onClose**: handled via `barcodeResultReceivedRef` (same pattern as `scannedRef` in BarcodeScanner). ✓
