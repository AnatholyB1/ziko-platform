# Architecture Research

**Domain:** Open Food Facts barcode enrichment — Ziko nutrition plugin v1.2
**Researched:** 2026-04-02
**Confidence:** HIGH — all integration points verified directly from source files

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                      Mobile (Expo SDK 54)                          │
├─────────────────────┬──────────────────────┬───────────────────────┤
│  NutritionDashboard │  LogMealScreen       │  [NEW] ProductCard    │
│  + score badges on  │  + "Barcode" 4th tab │  photo, name, brand   │
│    log entries      │  + BarcodeScanner    │  Nutri-Score badge    │
│  + daily avg score  │    modal (reused     │  Eco-Score badge      │
│    summary card     │    from pantry)      │  macros/serving adjuster│
└─────────────────────┴────────┬─────────────┴───────────────────────┘
                                │  direct fetch() — no CORS in RN native
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│           Open Food Facts API (world.openfoodfacts.org)            │
│  GET /api/v2/product/{barcode}                                     │
│    ?fields=product_name,product_name_fr,brands,                    │
│            nutriscore_grade,ecoscore_grade,                        │
│            nutriments,image_front_url,serving_size                 │
│                                                                    │
│  Rate limit: 100 req/min per IP (per-user mobile = no contention)  │
│  Auth: none required for reads                                     │
│  Required header: User-Agent: ZikoFitnessApp/1.2 (email)          │
└───────────────────────────────┬────────────────────────────────────┘
                                │  upsert on cache miss
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL + RLS)                       │
├───────────────────────────────┬────────────────────────────────────┤
│  [NEW] food_products          │  [MODIFIED] nutrition_logs         │
│  barcode (UNIQUE index)       │  + food_product_id FK (nullable)   │
│  product_name, brands         │  + nutriscore_grade TEXT (denorm.) │
│  nutriscore_grade             │  + ecoscore_grade  TEXT (denorm.)  │
│  ecoscore_grade               │                                    │
│  calories/protein/carbs/fat   │  Denormalised so loadLogs() needs  │
│    per 100g                   │  zero JOIN changes. Scores survive │
│  nutriments JSONB (full blob) │  food_products cleanup.            │
│  image_url, serving_size      │                                    │
│  created_at, updated_at       │                                    │
└───────────────────────────────┴────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    Hono v4 Backend API                             │
│  NOT involved in barcode lookup (no proxy — see rationale below)   │
│  Unchanged for this milestone.                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `plugins/pantry/src/screens/BarcodeScanner.tsx` | Camera modal, scan guard, delegates result | Exists — reuse as-is with minor callback extension |
| `plugins/pantry/src/utils/barcode.ts` | `lookupBarcode()` — returns product name only | Exists — pantry keeps using it; nutrition supersedes with full fetch |
| `plugins/nutrition/src/utils/offApi.ts` | Full OFF product fetch (all scored fields), Supabase cache upsert | NEW |
| `plugins/nutrition/src/components/ProductCard.tsx` | Photo, name, brand, Nutri-Score badge, Eco-Score badge, macros per 100g, serving weight adjuster, "Log" CTA | NEW |
| `plugins/nutrition/src/components/ScoreBadge.tsx` | Letter grade badge (A–E) with grade-to-color mapping | NEW |
| `plugins/nutrition/src/screens/LogMealScreen.tsx` | Add 4th "Barcode" tab; import BarcodeScanner; show ProductCard on result; extend `saveLog()` with score columns | MODIFY |
| `plugins/nutrition/src/screens/NutritionDashboard.tsx` | Render `<ScoreBadge>` on each log entry; add daily avg score card | MODIFY |
| `plugins/nutrition/src/store.ts` | Extend `NutritionEntry` type with `food_product_id?`, `nutriscore_grade?`, `ecoscore_grade?` | MODIFY |
| `supabase/migrations/024_food_products.sql` | `food_products` table + unique barcode index + RLS policies | NEW |
| `supabase/migrations/025_nutrition_logs_scores.sql` | `food_product_id` FK + `nutriscore_grade` + `ecoscore_grade` cols on `nutrition_logs` | NEW |

## Recommended Project Structure

```
plugins/nutrition/src/
├── screens/
│   ├── NutritionDashboard.tsx    # MODIFY — score badges on entries + avg score card
│   ├── LogMealScreen.tsx         # MODIFY — barcode tab + ProductCard integration
│   └── TDEECalculatorScreen.tsx  # unchanged
├── components/                   # NEW subfolder
│   ├── ProductCard.tsx           # display: photo, scores, macros, serving adjuster
│   └── ScoreBadge.tsx            # reusable letter badge with grade-to-color mapping
├── utils/
│   └── offApi.ts                 # NEW — OFF fetch + Supabase upsert cache
├── store.ts                      # MODIFY — NutritionEntry type extension
├── manifest.ts                   # unchanged
└── index.ts                      # unchanged

supabase/migrations/
├── 024_food_products.sql         # NEW table (follows 023_shopping_list.sql)
└── 025_nutrition_logs_scores.sql # ADD 3 columns to nutrition_logs

plugins/pantry/src/screens/
└── BarcodeScanner.tsx            # unchanged except optional callback signature
```

### Structure Rationale

- **`components/` subfolder in nutrition plugin:** `ProductCard` and `ScoreBadge` are display-only, stateless, and may be used from both `LogMealScreen` (scan result) and potentially `NutritionDashboard` (log entry inline badges). Separating them avoids bloating the screen files and mirrors how other plugins (timer, supplements) organise sub-components.
- **`utils/offApi.ts` in nutrition plugin (not in pantry):** The pantry `barcode.ts` only needed a product name — OFF enrichment is a nutrition-plugin concern. Keeping it in nutrition avoids coupling the pantry plugin to Nutri-Score logic it does not use.
- **Two migrations instead of one:** `food_products` is a new table (migration 024) and the `nutrition_logs` extensions are additive columns (migration 025). Separating them makes rollback safer, matches the established pattern (021/022/023 are all separate schemas), and prevents a single failed migration from blocking both changes.

## Architectural Patterns

### Pattern 1: Direct OFF API Call from Mobile (no backend proxy)

**What:** The mobile app calls `https://world.openfoodfacts.org/api/v2/product/{barcode}` directly using `fetch()`. Supabase acts as a persistent local cache via upsert on `food_products`.

**When to use:** This is the correct choice for Ziko. React Native has no CORS enforcement — direct calls work natively on iOS and Android without any configuration. OFF read operations require no authentication, only a descriptive `User-Agent` header.

**Why not a backend proxy:**
- The Hono backend would add 150–300ms round-trip latency with zero security benefit for a public read-only API.
- OFF rate limit is 100 req/min per IP. Routing through the backend concentrates all users onto the server's IP, turning per-user limits into a shared pool — worse at scale.
- Ziko's existing `plugins/pantry/src/utils/barcode.ts` already calls OFF directly from the mobile app and has worked throughout v1.1 production. The pattern is proven.
- A backend proxy would only be warranted for OFF write operations (contributing product data back to OFF), not for reads.

**Trade-offs:**
- Pro: lower latency, simpler code, no new backend route
- Pro: OFF rate limit is per-client-IP so no user-to-user contention
- Pro: consistent with existing pantry barcode pattern
- Con: OFF API URL is in the mobile bundle — acceptable, it is a public API with no secrets
- Con: No server-side response normalisation — field mapping must be done in `offApi.ts` on mobile

**Example (`plugins/nutrition/src/utils/offApi.ts` core):**
```typescript
const OFF_FIELDS = [
  'product_name', 'product_name_fr', 'brands',
  'nutriscore_grade', 'ecoscore_grade',
  'nutriments', 'image_front_url', 'serving_size',
].join(',');

const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${OFF_FIELDS}`;

const USER_AGENT = 'ZikoFitnessApp/1.2 (contact@ziko-app.com)';

export async function fetchOFFProduct(barcode: string): Promise<OFFProduct | null> {
  const res = await fetch(OFF_URL(barcode), {
    headers: { 'User-Agent': USER_AGENT },
  });
  const json = await res.json();
  if (json.status !== 1 || !json.product) return null;
  const p = json.product;
  const nm = p.nutriments ?? {};
  return {
    barcode,
    product_name: p.product_name_fr ?? p.product_name ?? '',
    brands: p.brands ?? null,
    nutriscore_grade: p.nutriscore_grade?.toLowerCase() ?? null,
    ecoscore_grade: p.ecoscore_grade?.toLowerCase() ?? null,
    calories_100g: nm['energy-kcal_100g'] ?? nm.energy_100g ?? 0,
    protein_100g: nm.proteins_100g ?? 0,
    carbs_100g: nm.carbohydrates_100g ?? 0,
    fat_100g: nm.fat_100g ?? 0,
    nutriments: nm,
    image_url: p.image_front_url ?? null,
    serving_size: p.serving_size ?? null,
  };
}
```

### Pattern 2: Supabase Upsert Cache for food_products

**What:** After a successful OFF lookup, `upsert` the result into `food_products` keyed on barcode. On subsequent scans of the same barcode, check `food_products` first — skip the OFF call if a row exists.

**When to use:** Always. Avoids redundant OFF calls for repeat scans of the same product, survives OFF downtime gracefully for cached products, and enables AI tools or future features to query the product catalogue without any external dependency.

**Trade-offs:**
- Pro: Faster repeat scans (cache hit is a local Supabase call)
- Pro: Offline resilience for previously scanned products
- Pro: `food_products` becomes a local product catalogue usable by AI tools
- Con: Stale data risk if OFF updates a product's Nutri-Score — acceptable since scores change rarely; `updated_at` column allows future staleness logic

**Cache check + upsert flow:**
```typescript
export async function getOrFetchProduct(barcode: string, supabase: any): Promise<OFFProduct | null> {
  // 1. Cache check
  const { data: cached } = await supabase
    .from('food_products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();

  if (cached) return cached as OFFProduct;

  // 2. OFF fetch
  const product = await fetchOFFProduct(barcode);
  if (!product) return null;

  // 3. Cache to Supabase
  const { data } = await supabase
    .from('food_products')
    .upsert({ ...product, updated_at: new Date().toISOString() }, { onConflict: 'barcode' })
    .select()
    .single();

  return data as OFFProduct;
}
```

### Pattern 3: Denormalised Score Columns on nutrition_logs

**What:** Copy `nutriscore_grade` and `ecoscore_grade` from the `food_products` result into `nutrition_logs` at insert time. Keep `food_product_id` as a nullable FK for full product data when needed.

**When to use:** Always. `NutritionDashboard.loadLogs()` reads logs on every screen focus via `useFocusEffect`. Adding a JOIN to `food_products` on this hot path would add query complexity and create a dependency where `food_products` rows cannot safely be cleaned up without nulling historical scores.

**Trade-offs:**
- Pro: `loadLogs()` in `NutritionDashboard.tsx` needs zero query changes — `SELECT *` already returns new columns
- Pro: Log entries are fully self-contained — score preserved even if `food_products` is purged
- Pro: Consistent with how macros are stored (already denormalised from source to log at insert time)
- Con: Score stored twice — accepted; this is fitness tracking, not an audit ledger. Scores change rarely.

**Extended `saveLog()` call in `LogMealScreen.tsx`:**
```typescript
// After user confirms serving size on ProductCard:
saveLog({
  food_name: product.product_name,
  calories: Math.round(product.calories_100g * servingG / 100),
  protein_g: +(product.protein_100g * servingG / 100).toFixed(1),
  carbs_g: +(product.carbs_100g * servingG / 100).toFixed(1),
  fat_g: +(product.fat_100g * servingG / 100).toFixed(1),
  serving_g: servingG,
  food_product_id: product.id,          // FK to food_products
  nutriscore_grade: product.nutriscore_grade,  // denormalised
  ecoscore_grade: product.ecoscore_grade,      // denormalised
});
```

## Data Flow

### Barcode Scan — Happy Path

```
User taps "Barcode" tab in LogMealScreen
    |
    v
BarcodeScanner modal opens
(reused from pantry — expo-camera + camera permission already handled)
    |
    v
Camera reads EAN-13 / EAN-8 / UPC barcode → onBarcodeScanned fires
    |
    v
getOrFetchProduct(barcode, supabase)
    |------ food_products cache HIT -------> return cached row immediately
    |
    v (cache MISS)
fetchOFFProduct(barcode)   →  OFF API call
    |
    |-- status !== 1 / network error ------> onNotFound() → fallback to custom tab
    |
    v (success)
upsert into food_products
    |
    v
ProductCard displayed:
  - product photo (image_url)
  - product name + brand
  - Nutri-Score badge (A–E letter with colour)
  - Eco-Score badge (A–E letter with colour)
  - macros per 100g
  - serving weight input (default: serving_size from OFF or 100g)
  - "Log this meal" button
    |
    v
User adjusts serving weight, taps "Log"
    |
    v
saveLog() inserts into nutrition_logs:
  - scaled macros (×serving/100)
  - food_product_id (FK)
  - nutriscore_grade, ecoscore_grade (denormalised)
    |
    v
router.back() → NutritionDashboard
    |
    v
useFocusEffect triggers loadLogs() → Supabase returns rows with score columns
    |
    v
Score badges visible on entry + daily avg score in summary card
```

### Product Not Found / Offline

```
getOrFetchProduct returns null
    |
    v
Brief toast / inline message "Produit non trouvé"
    |
    v
LogMealScreen switches to "custom" tab, pre-fills food_name if
partial OFF response had a product_name (partial data case)
    |
    v
saveLog() with no food_product_id, null scores — standard manual entry
```

### Score Display in Dashboard

```
NutritionDashboard.loadLogs()
  SELECT * FROM nutrition_logs WHERE user_id = ? AND date = ?
  (returns nutriscore_grade, ecoscore_grade on each row — no JOIN needed)
    |
    v
Each log entry card: <ScoreBadge grade={log.nutriscore_grade} />
                     <ScoreBadge grade={log.ecoscore_grade} type="eco" />
    |
    v
Summary card: daily average Nutri-Score
  - Filter todayLogs where nutriscore_grade IS NOT NULL
  - Map grade to numeric: a=5, b=4, c=3, d=2, e=1
  - Display modal grade (most frequent) or numeric average
```

### State Management

```
useNutritionStore (Zustand v5)
  NutritionEntry type extended:
    + food_product_id?: string
    + nutriscore_grade?: string
    + ecoscore_grade?: string
    |
    v
  addLog(entry) — optimistic update in todayLogs
  setTodayLogs(logs) — replaces state on Supabase refresh
  (no new actions needed — existing interface is sufficient)
```

## Database Schema

### Migration 024 — `food_products` table

Next in sequence after `023_shopping_list.sql`.

```sql
CREATE TABLE IF NOT EXISTS public.food_products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode          TEXT NOT NULL,
  product_name     TEXT NOT NULL,
  brands           TEXT,
  nutriscore_grade TEXT CHECK (nutriscore_grade IN ('a','b','c','d','e')),
  ecoscore_grade   TEXT,                     -- a-plus, a, b, c, d, e (OFF format)
  calories_100g    NUMERIC(7,2) NOT NULL DEFAULT 0,
  protein_100g     NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_100g       NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_100g         NUMERIC(6,2) NOT NULL DEFAULT 0,
  nutriments       JSONB,                    -- full OFF nutriments blob for future use
  image_url        TEXT,
  serving_size     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_products_barcode
  ON public.food_products(barcode);

-- Public catalogue: any authenticated user can read and insert
ALTER TABLE public.food_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_products_select" ON public.food_products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "food_products_insert" ON public.food_products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "food_products_update" ON public.food_products
  FOR UPDATE USING (auth.role() = 'authenticated');
```

**Schema decisions:**
- `nutriments JSONB` stores the full OFF `nutriments` blob. The 4 core macro columns are extracted for query convenience (dashboard score aggregation, AI tool queries) without needing to parse JSON on every read.
- No `user_id` on `food_products` — this is a shared product catalogue, not user-scoped. Any authenticated user can populate and read it.
- `ecoscore_grade` is TEXT without a restrictive CHECK because OFF uses values like `'a-plus'` that would not fit an `('a','b','c','d','e')` constraint.

### Migration 025 — Extend `nutrition_logs`

```sql
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS food_product_id UUID
    REFERENCES public.food_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nutriscore_grade TEXT
    CHECK (nutriscore_grade IN ('a','b','c','d','e')),
  ADD COLUMN IF NOT EXISTS ecoscore_grade TEXT;

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_nutriscore
  ON public.nutrition_logs(user_id, nutriscore_grade)
  WHERE nutriscore_grade IS NOT NULL;
```

**Column decisions:**
- `food_product_id` is nullable — existing rows and manual entries have no product reference.
- `ON DELETE SET NULL` — deleting a `food_products` row nulls the FK on log entries but preserves the denormalised score columns, so historical score data is not lost.
- `nutriscore_grade` inherits the same CHECK as `food_products` for consistency.
- Index on `(user_id, nutriscore_grade)` supports future queries like "show me all B+ or better meals this week" and the daily score aggregation query.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–10k users | Direct OFF calls, Supabase cache — no changes needed |
| 10k–100k users | `food_products` grows; add GIN index on `product_name` for full-text search beyond barcode; `updated_at` staleness check for OFF re-fetch |
| 100k+ users | Consider OFF daily CSV delta-sync via backend cron to pre-populate `food_products`; OFF reads still direct from mobile |

### Scaling Priorities

1. **First bottleneck:** `food_products` name search (ilike scan) once catalogue exceeds ~50k rows. Fix: `CREATE INDEX idx_food_products_name ON food_products USING GIN (product_name gin_trgm_ops)`.
2. **Second bottleneck:** Stale score data for frequently updated products. Fix: check `updated_at < NOW() - INTERVAL '30 days'` and re-fetch from OFF if stale.

## Anti-Patterns

### Anti-Pattern 1: Routing OFF calls through the Hono backend

**What people do:** Add a `GET /nutrition/barcode/:code` route to the Hono API that proxies to OFF and returns a normalised response.

**Why it's wrong:** Adds a gratuitous network hop (~150–300ms extra), concentrates all users onto the server's IP for rate limiting, introduces a new backend route to maintain, and provides no security benefit since OFF is a public read API with no secrets. Ziko's pantry plugin already calls OFF directly from the mobile app without issues.

**Do this instead:** Call OFF directly from the mobile app with `fetch()`. Set a descriptive `User-Agent`. Cache results in Supabase.

### Anti-Pattern 2: JOIN food_products on every NutritionDashboard load

**What people do:** Keep score grades only in `food_products`, then JOIN when loading nutrition logs.

**Why it's wrong:** `NutritionDashboard.loadLogs()` fires on every `useFocusEffect` (returning from LogMealScreen, date change). Adding a JOIN to a foreign table increases query complexity, requires changing the established `SELECT *` query, and creates a hard dependency — deleting a `food_products` row would silently null out historical score data in the journal.

**Do this instead:** Denormalise `nutriscore_grade` and `ecoscore_grade` into `nutrition_logs` at insert time. Keep `food_product_id` FK for full product data on demand (ProductCard, AI tool queries).

### Anti-Pattern 3: Duplicating BarcodeScanner in the nutrition plugin

**What people do:** Copy `plugins/pantry/src/screens/BarcodeScanner.tsx` into `plugins/nutrition/` to avoid a cross-plugin import.

**Why it's wrong:** Duplicates camera permission handling, scan guard (`scannedRef`), and the modal layout. Two files to update when `expo-camera` API changes (it already changed once — EAN type names were renamed in SDK 53→54).

**Do this instead:** Import `BarcodeScanner` directly from `plugins/pantry/src/screens/BarcodeScanner.tsx`. Extend the `onScan` callback to `onScan(name: string, barcode: string)` — a one-line interface change in the pantry component. The nutrition plugin uses `barcode` for `getOrFetchProduct()`; the pantry plugin ignores the new second argument or uses it to pre-fill the item name.

### Anti-Pattern 4: Storing all OFF macro fields as individual columns

**What people do:** Add `fiber_100g`, `saturated_fat_100g`, `sugars_100g`, `salt_100g`, `sodium_100g`... as dedicated columns on `food_products`.

**Why it's wrong:** OFF `nutriments` contains 30+ fields. Expanding to individual columns creates migration sprawl and forces a new migration each time a new nutrient is tracked.

**Do this instead:** Store the full `nutriments` blob as JSONB. Extract only the 4 core macros (calories, protein, carbs, fat) as typed columns for the hot path (macro logging and AI queries). Parse JSONB only when a detailed product view requires additional nutrients.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Open Food Facts API | Direct `fetch()` from mobile, no auth | `User-Agent: ZikoFitnessApp/1.2 (contact@ziko-app.com)` required. Use `world.openfoodfacts.org` for production (`.net` is staging). Rate limit: 100 req/min per IP — per-user mobile calls never approach this. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `nutrition` plugin → pantry `BarcodeScanner` | Direct cross-plugin import | Established precedent in this codebase. Extend `onScan(name, barcode)` callback signature — one-line change in pantry component, backward-compatible (pantry callers can ignore second arg). |
| `nutrition` plugin → Supabase `food_products` | `getOrFetchProduct()` in `offApi.ts` | No RLS user filter — shared catalogue. Uses same `supabase` instance passed via props. |
| `nutrition` plugin → Supabase `nutrition_logs` | Extended `saveLog()` in `LogMealScreen.tsx` | Adds `food_product_id`, `nutriscore_grade`, `ecoscore_grade` to existing insert. No store interface changes required beyond type widening. |
| `NutritionDashboard` → score display | Reads from `todayLogs` in `useNutritionStore` | New columns returned by `SELECT *` — zero query changes. Score rendered via `<ScoreBadge>` component. |

## New vs Modified — Component Inventory

### New (create from scratch)

| File | Purpose |
|------|---------|
| `supabase/migrations/024_food_products.sql` | Shared product catalogue table |
| `supabase/migrations/025_nutrition_logs_scores.sql` | FK + score columns on nutrition_logs |
| `plugins/nutrition/src/utils/offApi.ts` | OFF fetch + Supabase cache logic |
| `plugins/nutrition/src/components/ProductCard.tsx` | Full product display with serving adjuster |
| `plugins/nutrition/src/components/ScoreBadge.tsx` | Reusable letter badge A–E with grade colours |

### Modified (surgical edits only)

| File | Change |
|------|--------|
| `plugins/pantry/src/screens/BarcodeScanner.tsx` | `onScan(name: string, barcode: string)` — add second arg, pass raw `data` alongside resolved name |
| `plugins/nutrition/src/screens/LogMealScreen.tsx` | Add "Barcode" tab; import `BarcodeScanner` + `getOrFetchProduct` + `ProductCard`; extend `saveLog()` payload |
| `plugins/nutrition/src/screens/NutritionDashboard.tsx` | Import `ScoreBadge`; render on log entry cards; add daily score summary |
| `plugins/nutrition/src/store.ts` | Widen `NutritionEntry` type: `+ food_product_id?: string; nutriscore_grade?: string; ecoscore_grade?: string` |

### Not Modified

- `backend/api/` — no changes. Barcode lookup is mobile-only.
- `plugins/pantry/src/utils/barcode.ts` — pantry keeps using its existing lookup; nutrition uses `offApi.ts`.
- All other plugins — unchanged.
- `packages/plugin-sdk/` — no new types needed.
- `apps/mobile/src/lib/PluginLoader.tsx` — pantry is already registered.

## Build Order

Dependencies flow strictly top-to-bottom. Each phase is a prerequisite for the next.

### Phase 1 — Database Migrations

Must go first. All other phases depend on the schema existing in Supabase.

1. `supabase/migrations/024_food_products.sql` — `food_products` table + RLS
2. `supabase/migrations/025_nutrition_logs_scores.sql` — extend `nutrition_logs`

Validation gate: both migrations apply cleanly. `nutrition_logs` SELECT returns `food_product_id`, `nutriscore_grade`, `ecoscore_grade` (null on existing rows).

### Phase 2 — OFF API Utility + Data Layer

Build and test independently before adding any UI.

1. `plugins/nutrition/src/utils/offApi.ts` — `fetchOFFProduct()` + `getOrFetchProduct()` with Supabase cache
2. `plugins/nutrition/src/store.ts` — widen `NutritionEntry` type

Validation gate: scanning a known EAN-13 (e.g. Nutella `3017624010701`) returns a populated `OFFProduct` object with `nutriscore_grade: 'e'`. Cache hit on second scan skips OFF call.

### Phase 3 — Display Components

Pure display components, no network calls. Build with static mock data, testable in isolation.

1. `plugins/nutrition/src/components/ScoreBadge.tsx` — grade-to-colour mapping (a=green, b=light-green, c=yellow, d=orange, e=red)
2. `plugins/nutrition/src/components/ProductCard.tsx` — photo, scores, macros per 100g, serving weight input, "Log" CTA

Validation gate: `ProductCard` renders correctly with a static `OFFProduct` mock. `ScoreBadge` shows correct colours for all 5 grades. Both components handle null/undefined grade gracefully (no badge rendered).

### Phase 4 — LogMealScreen Barcode Tab

Wires Phase 2 and Phase 3 together into the user flow.

1. `plugins/pantry/src/screens/BarcodeScanner.tsx` — extend `onScan` to `onScan(name, barcode)`
2. `plugins/nutrition/src/screens/LogMealScreen.tsx` — add "Barcode" tab; integrate `BarcodeScanner` modal; call `getOrFetchProduct()`; show `ProductCard`; extend `saveLog()`

Validation gate: Full scan-to-log flow works end to end. `nutrition_logs` row has `food_product_id` and `nutriscore_grade` populated. Not-found case falls back to custom tab without crash.

### Phase 5 — NutritionDashboard Score Display

Depends on Phase 4 having logged entries with scores. Can begin implementation in parallel with Phase 4 once types are established (Phase 2 complete).

1. `plugins/nutrition/src/screens/NutritionDashboard.tsx` — render `<ScoreBadge>` on each log entry; add daily average Nutri-Score card in the summary section

Validation gate: Log entries from barcode scan show score badges. Manual entries (null scores) show no badge. Daily score card appears when at least one scanned entry exists for the day.

## Sources

- Open Food Facts API v2 documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
- OFF API tutorial (fields, endpoint format, User-Agent guidance): https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/
- React Native networking — no CORS enforcement in native builds: https://reactnative.dev/docs/network
- Existing `plugins/pantry/src/utils/barcode.ts` — confirms direct OFF call works in production (EAN field subset)
- Existing `plugins/pantry/src/screens/BarcodeScanner.tsx` — `expo-camera` integration pattern, scan guard
- Existing `supabase/migrations/003_nutrition_schema.sql` — `nutrition_logs` baseline schema
- Existing `plugins/nutrition/src/screens/LogMealScreen.tsx` — current `saveLog()` and tab pattern
- Existing `plugins/nutrition/src/store.ts` — `NutritionEntry` interface baseline

---
*Architecture research for: Open Food Facts barcode enrichment — Ziko nutrition plugin v1.2*
*Researched: 2026-04-02*
