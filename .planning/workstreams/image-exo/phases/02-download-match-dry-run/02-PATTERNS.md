# Phase 2: Download & Match (Dry-Run) - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 8 (2 entry scripts, 3 lib modules, 2 test files, 1 supporting doc/config)
**Analogs found:** 6 / 8 (2 are net-new pattern categories with no direct in-repo precedent — noted below with the nearest partial match)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `scripts/exercise-import/fetch.ts` | script (entrypoint) | file-I/O (git clone + fs verify) | `scripts/food-data/import-foods.mjs` | role-match |
| `scripts/exercise-import/match.ts` | script (entrypoint) | transform (read → categorize → write report) | `scripts/food-data/import-foods.mjs` (structure) + `backend/api/src/coach/exercises/db.ts` (Supabase read pattern) | role-match |
| `scripts/exercise-import/lib/supabase-client.ts` | utility (client factory) | request-response | `backend/api/src/coach/exercises/db.ts` (`createUserClient`) | exact (pattern), role-match (file granularity) |
| `scripts/exercise-import/lib/types.ts` | model (zod schemas + types) | transform | `backend/api/src/coach/dashboards/schemas.ts` | exact |
| `scripts/exercise-import/lib/normalize.ts` | utility (pure functions) | transform | none in-repo (net-new: string-normalization utility) — nearest partial: `scripts/csv-to-seed.js` `esc()`/dedup helpers | no-analog (nearest partial noted) |
| `scripts/exercise-import/lib/normalize.test.ts` | test | — | `backend/api/src/coach/dashboards/tools.test.ts` | role-match |
| `scripts/exercise-import/match.test.ts` | test | — | `backend/api/src/coach/dashboards/tools.test.ts` (pure-function fixture style) + `backend/api/src/coach/videos/service.test.ts` (vi.mock of `@supabase/supabase-js`) | role-match |
| `scripts/exercise-import/README.md` | config/doc | — | `backend/api/.env.example` (env var doc convention) | partial |

## Pattern Assignments

### `scripts/exercise-import/fetch.ts` (script, file-I/O)

**Analog:** `scripts/food-data/import-foods.mjs`

**Imports + env-var config pattern** (lines 1-23):
```javascript
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}
```
**Adapt for this phase:** Copy the "check required env vars, print a clear message, `process.exit(1)`" shape exactly, but swap `SUPABASE_SERVICE_KEY` for `SUPABASE_PUBLISHABLE_KEY` (per RESEARCH.md Pattern 3 — no service-role key needed for this read-only phase). `fetch.ts` itself needs no Supabase client at all (it only clones + verifies the filesystem); reserve this env-check block for `match.ts`.

**Hard-exit-on-verification-failure pattern** (structural precedent, same file's `main()` error handling at lines 405-414 — batch error accumulation with a final summary print) combined with RESEARCH.md's own worked example (already verified against real GitHub API data, use verbatim as the core of `fetch.ts`):
```typescript
// From RESEARCH.md Pattern 1 (Architecture Patterns) — verified against real dataset shape
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const datasetRoot = 'scripts/exercise-import/.dataset-cache/exercises-dataset';
const exercises = JSON.parse(readFileSync(join(datasetRoot, 'data/exercises.json'), 'utf-8'));

const imageFiles = readdirSync(join(datasetRoot, 'images'));
const videoFiles = readdirSync(join(datasetRoot, 'videos'));

const mismatches: string[] = [];
if (imageFiles.length !== exercises.length) {
  mismatches.push(`images/ has ${imageFiles.length} files, exercises.json has ${exercises.length} records`);
}
// ... (see RESEARCH.md Pattern 1 for full per-record path-existence loop)
if (mismatches.length > 0) {
  console.error('MANIFEST VERIFICATION FAILED:\n' + mismatches.join('\n'));
  process.exit(1); // hard exit, no report generated — per D-11
}
```

**Progress logging pattern** (lines 371-379, `import-foods.mjs`):
```javascript
async function main() {
  console.log('=== Food Database Import ===\n');
  // 1. Load data
  const usdaFoods = loadUSDA();
  ...
}
main().catch(console.error);
```
Copy this `async function main() { ... } main().catch(console.error);` shape verbatim for both `fetch.ts` and `match.ts` — it's the established entrypoint convention for standalone scripts in this repo (also seen implicitly in the synchronous top-level style of `csv-to-seed.js`/`json-to-seed.js`, but `import-foods.mjs`'s async `main()` is the closer match since fetch/match are both async, git-clone/network-involving).

**Clone-reuse pattern (new — no in-repo precedent):** Use Node's `child_process.execSync`/`spawnSync` to shell out to `git clone --depth 1`, gated by an `existsSync(datasetRoot)` check (skip clone if cache dir already exists, per D-12), with a `--refetch` CLI flag (parse `process.argv`) to force re-clone. No analog exists in-repo for shelling out to `git`; this is genuinely new — write it as a small isolated function so it's easy to unit-test-stub in `fetch.test.ts` if the planner chooses to test it.

---

### `scripts/exercise-import/match.ts` (script, transform)

**Analog (Supabase read):** `backend/api/src/coach/exercises/db.ts` + RESEARCH.md Pattern 2/3

**Read-only client factory pattern** (`db.ts` lines 9-18, adapted — no JWT needed since this is an unauthenticated script context, not a per-request handler):
```typescript
// backend/api/src/coach/exercises/db.ts:9-18 — adapt by removing the JWT/Authorization header,
// since match.ts runs unauthenticated (publishable key + RLS's is_custom=FALSE branch, not a user session)
import { createClient } from '@supabase/supabase-js';

export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}
```
**Use directly (RESEARCH.md Pattern 3, verified against `read_exercises` RLS policy) for `lib/supabase-client.ts`:**
```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!, // NOT SUPABASE_SERVICE_KEY — read-only, RLS already scopes correctly
  { auth: { persistSession: false, autoRefreshToken: false } }
);
```

**Pagination pattern (RESEARCH.md Pattern 2 — mandatory, no in-repo precedent for pagination past 1000 rows; every existing Supabase read in the repo uses `.eq()`/`.single()` on small result sets, none paginate):**
```typescript
async function fetchAllExercises(supabase: SupabaseClient) {
  const pageSize = 1000;
  let from = 0;
  const all: ProductionExercise[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, name_fr, category, body_part, equipment, target_muscle, secondary_muscles, is_custom')
      .eq('is_custom', false)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

**Error handling pattern** (`db.ts` lines 43-52, `getMediaUrls` — the repo's consistent `{ data, error }` destructure + early-return-on-error convention):
```typescript
const { data: exercise, error: exerciseErr } = await adminDb
  .from('coach_exercises')
  .select('coach_id, video_path, photo_path')
  .eq('id', exerciseId)
  .maybeSingle();

if (exerciseErr) {
  console.warn('[coach/exercises] getMediaUrls exercise fetch error:', exerciseErr.message);
  return { video_url: null, photo_url: null, gif_url: null };
}
```
**Adapt for this phase:** Since `match.ts` is a script (not a request handler returning JSON to a client), replace the `console.warn` + graceful fallback with `throw error` (matches RESEARCH.md Pattern 2's `if (error) throw error;`) — a dry-run script should fail loudly on any Supabase read error, not silently degrade, per IMPORT-01's "failing loudly" mandate extended to this phase's read path.

**Batch/progress pattern** (`import-foods.mjs` lines 417-436 — adapt the `\r` progress line + final summary print for the 3-tier categorization loop instead of a batch insert loop):
```javascript
const BATCH_SIZE = 500;
let inserted = 0;
let errors = 0;
for (let i = 0; i < allFoods.length; i += BATCH_SIZE) {
  ...
  const pct = Math.round(((i + batch.length) / allFoods.length) * 100);
  process.stdout.write(`\rInserting... ${pct}% (${inserted} inserted, ${errors} errors)`);
}
console.log(`\n\n=== Done! ===`);
```
**Adapt:** No DB writes happen in this phase, so replace "inserted/errors" counters with per-tier counters (`matched`, `unmatchedLegacy`, `unmatchedNew`, `ambiguous`) and print the same kind of running/final summary — directly reusable for the companion Markdown report's top-line counts (D-06).

---

### `scripts/exercise-import/lib/types.ts` (model, transform)

**Analog:** `backend/api/src/coach/dashboards/schemas.ts`

**Zod schema pattern with `.strict()` for external/untrusted input** (lines 1-25):
```typescript
import { z } from 'zod'

export const GridPosSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1),
}).strict()

export const PeriodEnum = z.enum(['7d', '30d', '90d', 'all'])

export const LineChartWidgetSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('line_chart'),
  title: z.string().min(1).max(100),
  period: PeriodEnum.default('30d'),
  gridPos: GridPosSchema,
  config: z.object({
    dataKey: z.string(),
    color: z.string().optional(),
    unit: z.string().optional(),
  }).strict(),
}).strict()
```
**Adapt for this phase:** Use the same `z.object({...}).strict()` composition style to build `DatasetExerciseSchema` mirroring `exercises.schema.json`'s `$defs.exercise` (per RESEARCH.md's "Don't Hand-Roll" section — zod validation of the parsed `exercises.json`, turning upstream schema drift into a loud `ZodError` at load time, consistent with this repo's existing "validate external input strictly" convention). Do **not** use `.strict()` on the raw dataset schema if the upstream repo is known to sometimes add benign extra fields — the planner should decide based on `exercises.schema.json`'s own `additionalProperties` setting (verified in RESEARCH.md as JSON Schema Draft 2020-12); default to non-strict parsing for the external/mutable dataset input and strict only for this pipeline's own internal report-row schema.

---

### `scripts/exercise-import/lib/normalize.ts` (utility, transform) — NO DIRECT ANALOG

No in-repo precedent for name-normalization/fuzzy-matching utilities exists (RESEARCH.md confirms zero fuzzy-match libraries anywhere in the dependency tree). The closest partial precedent is the lowercase-dedup logic already used twice for exercise name deduplication:

**Partial analog — `scripts/json-to-seed.js` lines 39-47 (lowercase-key dedup, same domain: exercise names):**
```javascript
const seen = new Set();
const unique = [];
for (const ex of exercises) {
  const key = (ex.name || '').toLowerCase();
  if (!key || seen.has(key)) continue;
  seen.add(key);
  unique.push(ex);
}
```
**Use for:** The Pitfall-4 runtime duplicate-name safety check in `match.ts` (group production rows by normalized name, warn on any group size > 1) — same `Map`/`Set`-by-lowercased-key idiom this repo already uses twice for the same underlying data (production `exercises.name`).

**For the normalization function itself and Tier 2 fuzzy match, use RESEARCH.md's Code Examples verbatim (already vetted, no better in-repo source exists):**
```typescript
function normalizeExerciseName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

import { distance } from 'fastest-levenshtein';
function similarityRatio(a: string, b: string): number {
  const d = distance(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}
const TIER2_THRESHOLD = 0.87;
function tier2Match(prodName: string, datasetName: string): boolean {
  return similarityRatio(normalizeExerciseName(prodName), normalizeExerciseName(datasetName)) >= TIER2_THRESHOLD;
}
```

---

### `scripts/exercise-import/lib/normalize.test.ts` and `scripts/exercise-import/match.test.ts` (test)

**Analog:** `backend/api/src/coach/dashboards/tools.test.ts` (pure-function fixture style, no mocking needed)

**Structure pattern** (lines 1-25, 36-49):
```typescript
import { describe, test, expect } from 'vitest'
import { ZodError } from 'zod'
import { applyAddWidget, ... } from './tools.js'
import { WidgetSchema } from './schemas.js'
import type { Widget } from './types.js'

// ─── Fixtures ────────────────────────────────────────────
const SAMPLE_KPI: Widget = { id: '...', type: 'kpi_tile', ... }

describe('applyAddWidget', () => {
  test('appends a valid widget to an empty array', () => {
    const result = applyAddWidget([], SAMPLE_KPI as unknown as Record<string, unknown>)
    expect(result.length).toBe(1)
  })
  test('throws on unknown widget type (ZodError)', () => {
    expect(() => applyAddWidget([], { ...SAMPLE_KPI, type: 'unknown_type' })).toThrow(ZodError)
  })
})
```
**Adapt for `normalize.test.ts`:** Same `describe`/`test`/`expect` shape, fixture arrays for accent-stripping, "3/4 sit-up" punctuation-preservation, whitespace-collapse edge cases (per RESEARCH.md Wave 0 Gaps). Pure functions, no mocking needed — directly mirrors this file's style exactly.

**For `match.test.ts` (needs to stub Supabase since Tier 1-3 decision logic should be tested independent of live DB/network, per RESEARCH.md's test-strategy note):** use the `vi.mock('@supabase/supabase-js', ...)` pattern from `backend/api/src/coach/videos/service.test.ts` (lines 12-50) — hoisted `vi.mock` factory returning a stub client, so `tier1Match`/`tier2Match`/`tier3Match`/report-shape functions can be tested against small hand-written fixture arrays without a real Supabase connection.

---

## Shared Patterns

### Supabase client instantiation (read-only, no service key)
**Source:** `backend/api/src/coach/exercises/db.ts:9-18` (`createUserClient`) + RESEARCH.md Pattern 3
**Apply to:** `lib/supabase-client.ts`, `match.ts`
```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
```
Never introduce `SUPABASE_SERVICE_KEY` anywhere in this phase's code (V4 Access Control / least-privilege, per RESEARCH.md Security Domain) — this is a hard constraint, not a style preference, since the existing `read_exercises` RLS policy already grants everything this phase's read path needs.

### Async entrypoint + error propagation
**Source:** `scripts/food-data/import-foods.mjs:371-444`
**Apply to:** `fetch.ts`, `match.ts`
```javascript
async function main() {
  console.log('=== <script name> ===\n');
  // ... steps
}
main().catch(console.error);
```

### Env var required-check with loud exit
**Source:** `scripts/food-data/import-foods.mjs:16-23`
**Apply to:** `fetch.ts`, `match.ts`, `lib/supabase-client.ts`
```javascript
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY env vars');
  process.exit(1);
}
```

### Zod `.strict()` schema composition for validated data
**Source:** `backend/api/src/coach/dashboards/schemas.ts:1-25`
**Apply to:** `lib/types.ts`
Use `z.object({...}).strict()` for the report-row output schema (this pipeline's own contract with Phase 3); use non-strict `z.object({...})` for the external `exercises.json` dataset schema to tolerate benign upstream additions without breaking the pipeline (only reject missing/malformed required fields).

### `{ data, error }` destructure + explicit error handling
**Source:** `backend/api/src/coach/exercises/db.ts` (all functions), RESEARCH.md Pattern 2
**Apply to:** `match.ts`
```typescript
const { data, error } = await supabase.from('exercises').select(...);
if (error) throw error; // scripts fail loudly — no graceful degrade like request handlers
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/exercise-import/lib/normalize.ts` (git-clone-reuse + fuzzy-match logic specifically) | utility | transform | No fuzzy-matching or git-shell-out precedent exists anywhere in the monorepo (confirmed via RESEARCH.md's dependency-tree grep and this pattern search). Use RESEARCH.md's Code Examples section verbatim — it is already vetted against real dataset field names, not a placeholder. |
| `scripts/exercise-import/README.md` | doc | — | No existing per-script README precedent in `scripts/` (only inline top-of-file comments, e.g. `csv-to-seed.js:1-5`, `import-foods.mjs:1-7`). Follow that inline-comment-block convention instead of a separate README if the planner prefers consistency over RESEARCH.md's suggested structure — either is acceptable since no directory-level README exists elsewhere in `scripts/` to contradict it. |

## Metadata

**Analog search scope:** `scripts/**`, `backend/api/src/**` (routes, coach/*, tools, middleware), root `package.json`/`.gitignore`/`.env.example`
**Files scanned:** `scripts/csv-to-seed.js`, `scripts/json-to-seed.js`, `scripts/food-data/import-foods.mjs`, `backend/api/src/tools/db.ts`, `backend/api/src/coach/exercises/db.ts`, `backend/api/src/coach/exercises/service.ts`, `backend/api/src/coach/dashboards/schemas.ts`, `backend/api/src/coach/dashboards/tools.test.ts`, `backend/api/src/coach/videos/service.test.ts`, `backend/api/package.json`, `backend/api/.env.example`, root `package.json`, root `.gitignore`
**Pattern extraction date:** 2026-08-15
