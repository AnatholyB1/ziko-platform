# Phase 3: Merge (Human-Approved Write) - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 13 (new: 10, modified: 2, migration: 1)
**Analogs found:** 8 / 13 (5 exact/role-match, 3 no-analog — new-capability code backed by RESEARCH.md's fully-specified examples instead)

This is a backend/CLI data-migration phase. There is no UI work and no `backend/api` route work — every new file lives under `scripts/exercise-import/` (Phase 2's existing pipeline) plus one new Supabase migration. The single best analog for almost everything here is Phase 2's own code: `merge.ts` is the third entrypoint in a three-file pipeline (`fetch.ts` → `match.ts` → `merge.ts`), and every `lib/` helper should match the shape, docstring conventions, and module-system constraints Phase 2 already established.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/exercise-import/merge.ts` | script (CLI entrypoint) | batch, event-driven per-row | `scripts/exercise-import/match.ts` | exact |
| `scripts/exercise-import/lib/supabase-write-client.ts` | service (client factory) | CRUD (write) | `scripts/exercise-import/lib/supabase-client.ts` (shape) + `backend/api/src/middleware/auth.ts` (service-role key sourcing) | role-match (composite) |
| `scripts/exercise-import/lib/media.ts` | utility (pure transform) | transform (buffer → buffer) | `scripts/exercise-import/lib/normalize.ts` (module shape only — no image-processing precedent exists) | role-match (shape only) |
| `scripts/exercise-import/lib/retry.ts` | utility (wrapper) | transform | none in-repo | no analog — new capability |
| `scripts/exercise-import/lib/import-log.ts` | service/utility (pure state computation) | CRUD-adjacent (resume-state reduction) | `scripts/exercise-import/lib/report.ts` (`mergePriorHumanDecisions`) | role-match |
| `supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql` | migration | batch/DDL | `supabase/migrations/20260814_exercise_media_schema.sql` | exact |
| `scripts/exercise-import/lib/merge.test.ts` | test | request-response (stubbed client) | `scripts/exercise-import/lib/supabase-client.test.ts` | exact |
| `scripts/exercise-import/lib/media.test.ts` | test | transform | `scripts/exercise-import/lib/supabase-client.test.ts` (vitest conventions only; no image-fixture precedent) | role-match |
| `scripts/exercise-import/lib/import-log.test.ts` | test | transform | `scripts/exercise-import/lib/supabase-client.test.ts` | role-match |
| `scripts/exercise-import/lib/retry.test.ts` | test | transform (fake timers) | none in-repo | no analog — new capability |
| `scripts/exercise-import/lib/supabase-write-client.test.ts` | test | CRUD (stubbed client) | `scripts/exercise-import/lib/supabase-client.test.ts` | exact |
| `scripts/exercise-import/README.md` | docs (modified) | — | itself (existing "Pipeline Order" / "Module System" sections) | exact |
| `scripts/exercise-import/lib/paths.ts` | config (modified, maybe) | — | itself | exact — likely no new constants needed per RESEARCH.md |

## Pattern Assignments

### `scripts/exercise-import/merge.ts` (script, CLI entrypoint, batch/event-driven per-row)

**Analog:** `scripts/exercise-import/match.ts` (the immediately-prior pipeline stage — same author conventions, same constraints)

**Module docstring + zero-write-safety convention** (`match.ts` lines 1-20):
```typescript
/**
 * Match entrypoint for the exercise-import pipeline (IMPORT-02).
 * ...
 * DRY RUN — this file performs zero Supabase writes of any kind (no
 * insert/update/upsert/delete/rpc/storage call anywhere below) and never
 * imports or reads a service-role credential.
 *
 * Run only via
 * `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts`
 * from the repo root — never imported by a test, so it is safe to call
 * main() unconditionally at module load (same convention as fetch.ts and
 * scripts/food-data/import-foods.mjs).
 */
```
`merge.ts` must open with the mirror-image docstring: state plainly that it is the one script in this pipeline **permitted and required** to write (service-role key), and preserve the "never imported by a test, main() called unconditionally" convention.

**Imports pattern** (`match.ts` lines 21-36):
```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import {
  assertRunFromRepoRoot,
  DATASET_ROOT,
  DATASET_JSON_PATH,
  REPORTS_DIR,
  REPORT_JSON_PATH,
  REPORT_MD_PATH,
} from './lib/paths';
import { loadDatasetJson } from './lib/verify';
import { createReadOnlyClient, fetchAllProductionExercises } from './lib/supabase-client';
import { categorizeAll } from './lib/matcher';
import { buildReport, mergePriorHumanDecisions, renderMarkdown } from './lib/report';
import { TIER2_THRESHOLD } from './lib/normalize';
import { MatchReportSchema, type MatchReport } from './lib/types';
```
`merge.ts` swaps `createReadOnlyClient` → `createWriteClient` (from the new `lib/supabase-write-client`), adds `createInterface` from `readline/promises`, `randomUUID` from `crypto`, and the new `lib/media`, `lib/retry`, `lib/import-log` modules — same extensionless-relative-import convention.

**Preflight / repo-root + cache-existence guard pattern** (`match.ts` lines 75-89):
```typescript
assertRunFromRepoRoot();

if (!existsSync(DATASET_ROOT)) {
  console.error(
    `No cached dataset clone found at ${DATASET_ROOT}. Run fetch.ts first: ` +
      'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts',
  );
  process.exit(1);
}

const dataset = loadDatasetJson(DATASET_JSON_PATH);
console.log(`Loaded ${dataset.length} dataset records from ${DATASET_JSON_PATH}`);
```
`merge.ts` reuses this verbatim, then adds the dataset-commit-SHA consistency check (Pitfall 3 in RESEARCH.md) using the same `spawnSync('git', ['-C', DATASET_ROOT, 'rev-parse', 'HEAD'], ...)` call already present at `match.ts` lines 93-98 — copy that block directly, then compare against `report.dataset_commit` and hard-exit on mismatch.

**Graceful-degrade file read pattern** (`match.ts` lines 49-70, `readPriorReport`):
```typescript
function readPriorReport(path: string): MatchReport | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = MatchReportSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(`Warning: existing report at ${path} failed schema validation ...`);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn(`Warning: could not parse existing report at ${path} as JSON ...`);
    return null;
  }
}
```
`merge.ts` uses `MatchReportSchema.parse` (not `safeParse`) on `match-report.json` itself — that file MUST exist and be valid for merge to proceed at all (fail loudly, not degrade), but this same "try JSON.parse, safeParse against a zod schema, warn-and-continue" shape is exactly right for anything merge.ts optionally re-reads (e.g. tolerating a missing `exercises_merge_backup` row).

**Main structure + final summary pattern** (`match.ts` lines 72-137): sequential numbered steps with `console.log` progress lines, ending in a `=== ... Complete ===` summary block and `main().catch((err) => { console.error(err); process.exit(1); });` at file bottom (lines 139-142) — copy this exact bottom-of-file convention into `merge.ts`.

**Live interactive confirmation gate (D-04/D-05):** no in-repo analog exists (Phase 2 is dry-run-only) — use RESEARCH.md's fully-specified "Pattern 4" code verbatim (`readline/promises`, `process.stdin.isTTY` check, `'yes'`-only acceptance, single whole-report confirmation).

---

### `scripts/exercise-import/lib/supabase-write-client.ts` (service, CRUD/write)

**Analog A (client factory shape + throw-loud-on-missing-env convention):** `scripts/exercise-import/lib/supabase-client.ts` lines 15-35:
```typescript
export function createReadOnlyClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing required env vars SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY. ' +
        'Run this script from the repo root as documented in README.md, e.g. ' +
        'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

**Analog B (service-role key sourcing, the one place in the monorepo it already happens):** `backend/api/src/middleware/auth.ts` lines 1-9:
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

**Composite target** — combine A's throw-loud shape with B's service-role env var name into the new file (this exact code is already fully authored in RESEARCH.md's "Write-capable Supabase client" example, sourced from these two files):
```typescript
// scripts/exercise-import/lib/supabase-write-client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createWriteClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing required env vars SUPABASE_URL and/or SUPABASE_SERVICE_KEY. ' +
        'Unlike fetch.ts/match.ts, merge.ts is the one script in this pipeline ' +
        'permitted (and required) to use the service-role key — see README.md.',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```
Note the deliberate divergence from `backend/api/src/middleware/auth.ts`: that file falls back `?? process.env.SUPABASE_PUBLISHABLE_KEY` if the service key is unset. `supabase-write-client.ts` must **not** carry that fallback — a merge run silently downgrading to a non-privileged key would fail every write with a confusing RLS-denied error instead of a clear "set SUPABASE_SERVICE_KEY" message.

---

### `scripts/exercise-import/lib/media.ts` (utility, pure transform)

**Analog (module shape/docstring convention only — no image-processing precedent exists anywhere in the monorepo):** `scripts/exercise-import/lib/normalize.ts` (full file, 40 lines):
```typescript
/**
 * Name normalization and edit-distance similarity for the exercise-import
 * matcher. No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import { distance } from 'fastest-levenshtein';

export function normalizeExerciseName(raw: string | null | undefined): string {
  ...
}

export function similarityRatio(a: string, b: string): number {
  ...
}

export const TIER2_THRESHOLD = 0.87;
```
`media.ts` should match this shape exactly: a top docstring restating the module-system constraint, pure exported functions with no filesystem/network I/O, and any tunable constant (here, `CAP = 180`) declared and exported the same way `TIER2_THRESHOLD` is.

**Actual resize/cap logic** has no in-repo precedent — use RESEARCH.md's "Pattern 2: Resize + cap media with sharp" verbatim (already cites official sharp docs, cross-checked against the installed version):
```typescript
import sharp from 'sharp';
const CAP = 180;

export async function capImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({ width: CAP, height: CAP, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

export async function capGif(input: Buffer): Promise<Buffer> {
  // { animated: true } reads ALL frames — Pitfall 6: omitting this silently
  // produces a static "GIF".
  return sharp(input, { animated: true })
    .resize({ width: CAP, height: CAP, fit: 'inside', withoutEnlargement: true })
    .gif()
    .toBuffer();
}
```

---

### `scripts/exercise-import/lib/import-log.ts` (service/utility, resume-state computation)

**Analog:** `scripts/exercise-import/lib/report.ts` — `mergePriorHumanDecisions` (lines 100-150), the existing "reduce prior persisted state against fresh state, decide what carries forward" pattern:
```typescript
export function mergePriorHumanDecisions(
  newReport: MatchReport,
  priorReport: MatchReport | null,
): MergeResult {
  if (!priorReport) {
    return { report: newReport, carriedForward: 0, stale: 0 };
  }
  const priorByDatasetId = new Map(priorReport.ambiguous.map((row) => [row.dataset_id, row]));
  ...
}
```
`import-log.ts`'s `computeResumeState` follows the same shape: pure function, `Map`-keyed lookup by an id field, no I/O (the caller — `merge.ts` — does the actual `SELECT` and passes rows in). Also note `report.ts`'s own module docstring (lines 1-11) explicitly states the "pure functions only — no filesystem access, no Supabase client construction" rule; `import-log.ts` must follow the same rule, matching RESEARCH.md's fully-specified `computeResumeState` (Pattern 5):
```typescript
type ResumeState = 'done' | 'retry' | 'unprocessed';

function computeResumeState(latestLogRow: ImportLogRow | undefined): ResumeState {
  if (!latestLogRow) return 'unprocessed';
  if (latestLogRow.error_message !== null) return 'retry'; // D-08
  return 'done';
}
```
The `DISTINCT ON (source_id) ... ORDER BY source_id, processed_at DESC` SQL query (RESEARCH.md Pattern 5) that produces `latestLogRow` per `source_id` belongs in `merge.ts`'s Supabase call site, not in `import-log.ts` itself — mirrors `report.ts`/`match.ts`'s I/O-vs-pure-logic split exactly (`report.ts` builds/merges, `match.ts` reads/writes files and calls `report.ts`).

---

### `scripts/exercise-import/lib/retry.ts` (utility, wrapper)

**No analog in-repo** — no retry/backoff helper exists anywhere in the monorepo (confirmed: not in `backend/api/src/`, not in any plugin). RESEARCH.md's "Retry helper (D-07)" code example is the source of truth — already deliberately scoped ("Don't Hand-Roll" table: this is the one explicit exception to "use a library"):
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
```
Follow `lib/normalize.ts`'s module-docstring convention (module-system constraint comment) when creating this file, even though the function body itself has no local precedent.

---

### `supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql` (migration, batch/DDL)

**Analog:** `supabase/migrations/20260814_exercise_media_schema.sql` (Phase 1's migration — same phase family, same author conventions, most recently-modified migration touching `public.exercises`/`exercise_import_log`)

**`ADD COLUMN IF NOT EXISTS` pattern** (lines 7-8):
```sql
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS gif TEXT;
```
Directly reusable for D-03's `instructions_fr TEXT` / `instruction_steps JSONB` columns.

**`CREATE TABLE IF NOT EXISTS` + index + RLS-enable-zero-policies pattern** (lines 21-33):
```sql
CREATE TABLE IF NOT EXISTS public.exercise_import_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id      TEXT NOT NULL,
  exercise_id    UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  status         TEXT NOT NULL CHECK (status IN ('matched', 'inserted', 'skipped', 'needs_review')),
  error_message  TEXT,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_import_log_source_id ON public.exercise_import_log(source_id);

-- No policies: this is a global import-run log with no owner column. RLS enabled
-- with zero policies = deny-by-default for anon/authenticated; service-role
-- (Phase 3 merge script) bypasses RLS.
ALTER TABLE public.exercise_import_log ENABLE ROW LEVEL SECURITY;
```
Directly reusable for `exercises_merge_backup`'s table creation + index + RLS-enable-with-zero-policies pattern (D-09/D-10). RESEARCH.md's "Migration" code example already fully authors this new file end-to-end, sourced from this exact analog — use it verbatim:
```sql
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS instructions_fr TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS instruction_steps JSONB;

CREATE TABLE IF NOT EXISTS public.exercises_merge_backup (
  LIKE public.exercises INCLUDING DEFAULTS
);

ALTER TABLE public.exercises_merge_backup
  ADD COLUMN IF NOT EXISTS backup_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_exercises_merge_backup_id ON public.exercises_merge_backup(id);

ALTER TABLE public.exercises_merge_backup ENABLE ROW LEVEL SECURITY;
```
Note the deliberate divergence from the `exercise_media_schema` analog (Pitfall 8): use `INCLUDING DEFAULTS` only, never `INCLUDING ALL`/`CONSTRAINTS`/`INDEXES` — a backup table must not inherit `exercises`' PRIMARY KEY on `id`, since the same exercise id may legitimately be snapshotted across multiple merge runs.

---

### Test files (`merge.test.ts`, `media.test.ts`, `import-log.test.ts`, `supabase-write-client.test.ts`)

**Analog:** `scripts/exercise-import/lib/supabase-client.test.ts` (full file, 210 lines) — the established stubbed-Supabase-client testing convention for this pipeline.

**Hoisted `vi.mock` pattern** (lines 1-11):
```typescript
// Follows the hoisted vi.mock('@supabase/supabase-js') pattern from
// backend/api/src/coach/videos/service.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}));

import { createClient } from '@supabase/supabase-js';
import { createReadOnlyClient, fetchAllProductionExercises } from './supabase-client';
```
`supabase-write-client.test.ts` reuses this exact hoisting shape, swapping in `createWriteClient`.

**Stub-client builder recording every call** (lines 46-86) — `makeStubClient(pages)` builds a chainable `from().select().eq().order().range()` mock that records every call and exposes `insert`/`update`/`upsert`/`delete`/`rpc` spies. `merge.test.ts` needs an equivalent stub covering `.insert()`, `.update()`, `.eq()`, `.single()`, and `.storage.from().upload()` (the new surface merge.ts actually calls) — same recording-spy shape, different method set.

**Env-var throw tests** (lines 181-193):
```typescript
it('throws when SUPABASE_PUBLISHABLE_KEY is unset', () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  expect(() => createReadOnlyClient()).toThrow(/SUPABASE_PUBLISHABLE_KEY/);
});
```
`supabase-write-client.test.ts` mirrors this for `SUPABASE_SERVICE_KEY`, plus a dedicated test asserting `createWriteClient` never falls back to `SUPABASE_PUBLISHABLE_KEY` (the deliberate divergence noted above).

**Ordering/call-recording assertion pattern** (relevant to `merge.test.ts`'s IMPORT-03/MEDIA-04 requirements — backup-before-UPDATE ordering, needs_review rows never touching `exercises`): reuse the "ZERO-WRITE: never invokes insert/update/upsert/delete/rpc" test shape (lines 144-155) as the template for a `needs_review` row test (assert `exercises` `.insert`/`.update` were never called, only `exercise_import_log` `.insert` was).

---

## Shared Patterns

### CommonJS/ESM dual-runtime constraint
**Source:** `scripts/exercise-import/lib/paths.ts` lines 1-12, `README.md` "Module System" section (lines 72-88)
**Apply to:** every new file under `scripts/exercise-import/` (merge.ts and all new lib/ modules)
```typescript
/**
 * MODULE SYSTEM CONSTRAINT (see README.md "Module System"): this file must
 * never rely on Node's CommonJS current-module-directory global or the ESM
 * current-module-URL meta property.
 */
```
No `import.meta.url`, no `__dirname`, extensionless relative imports, every entrypoint run from repo root via `assertRunFromRepoRoot()`.

### Loud-throw-on-missing-env-var
**Source:** `scripts/exercise-import/lib/supabase-client.ts` lines 24-30
**Apply to:** `lib/supabase-write-client.ts` — throw naming both missing env vars and the documented invocation command, never `process.env.X!` non-null-assertion silently.

### Pure-function-no-I/O module convention
**Source:** `scripts/exercise-import/lib/report.ts` docstring lines 1-11 ("Pure functions only — no filesystem access, no Supabase client construction... this keeps it trivially unit-testable"); `scripts/exercise-import/lib/verify.ts` docstring lines 1-16 (same principle, "every function here testable against a small temp fixture tree")
**Apply to:** `lib/media.ts`, `lib/retry.ts`, `lib/import-log.ts` — all three must be pure (buffer/data in, buffer/data out), with `merge.ts` alone performing file reads, Supabase calls, and Storage uploads.

### Stubbed-Supabase-client vitest convention
**Source:** `scripts/exercise-import/lib/supabase-client.test.ts` (full file)
**Apply to:** every new `*.test.ts` — hoisted `vi.mock('@supabase/supabase-js', ...)`, a `makeStubClient` builder recording calls, no real network/DB access in any unit test (per RESEARCH.md's Validation Architecture, real-DB integration is an explicit manual-supervised step, not automated CI).

### RLS enable-with-zero-policies + service-role-bypass convention
**Source:** `supabase/migrations/20260814_exercise_media_schema.sql` lines 30-33
**Apply to:** the new `exercises_merge_backup` table in `20260815_exercises_merge_backup_and_i18n.sql` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with no policies (deny-by-default for anon/authenticated; only the service-role client in `merge.ts` can write).

### Sequential numbered-step main() + final summary
**Source:** `scripts/exercise-import/match.ts` lines 72-137
**Apply to:** `merge.ts`'s `main()` — numbered `console.log` progress steps, ending in a `=== Merge Complete ===`-style block reporting succeeded/errored/needs_review counts, `main().catch((err) => { console.error(err); process.exit(1); });` at file bottom.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/exercise-import/lib/media.ts` (sharp resize logic itself) | utility | transform | No image-processing code exists anywhere in this monorepo; `normalize.ts` supplies the module-shape convention but not the resize logic — use RESEARCH.md's fully-specified `capImage`/`capGif` (sharp, `fit: 'inside'`, `withoutEnlargement: true`, `{ animated: true }` for GIF) as the source of truth. |
| `scripts/exercise-import/lib/retry.ts` | utility | transform | No retry/backoff helper exists anywhere in the monorepo (checked `backend/api/src/` and all plugins). RESEARCH.md's `withRetry` code example (3 attempts, exponential backoff) is the source of truth — this is the deliberate "Don't Hand-Roll" exception per D-07. |
| `scripts/exercise-import/lib/retry.test.ts` | test | transform (fake timers) | No fake-timer test precedent exists in this pipeline's test suite (`supabase-client.test.ts` uses only async stubs, no `vi.useFakeTimers()`). Planner/implementer should introduce `vi.useFakeTimers()` fresh, asserting attempt count and backoff delays per RESEARCH.md's Validation Architecture table. |

## Metadata

**Analog search scope:** `scripts/exercise-import/**` (all `.ts`/`.md` files), `backend/api/src/middleware/auth.ts`, `supabase/migrations/*.sql` (specifically `20260814_exercise_media_schema.sql`, `004_exercises_extended.sql`, `031_exercises_name_fr.sql`)
**Files scanned:** `scripts/exercise-import/lib/supabase-client.ts`, `lib/supabase-client.test.ts`, `lib/types.ts`, `lib/paths.ts`, `lib/verify.ts`, `lib/normalize.ts`, `lib/report.ts`, `lib/check-report.ts`, `match.ts`, `README.md`, `backend/api/src/middleware/auth.ts`, `supabase/migrations/20260814_exercise_media_schema.sql`, `supabase/migrations/004_exercises_extended.sql`, `supabase/migrations/031_exercises_name_fr.sql`
**Pattern extraction date:** 2026-08-15
