# Phase 3: Merge (Human-Approved Write) - Research

**Researched:** 2026-08-15
**Domain:** Node.js/TypeScript batch data-migration script writing to Supabase Postgres + Storage
**Confidence:** HIGH (schema, existing pipeline code, and Supabase/sharp APIs all directly inspected in-repo or against installed package source; a few dataset-content specifics remain MEDIUM/LOW since `.dataset-cache/` is not present on this machine)

## Summary

Phase 3 adds one new entrypoint, `scripts/exercise-import/merge.ts`, to the existing three-file pipeline (`fetch.ts` → `match.ts` → **`merge.ts`**). It reads the human-approved `.planning/workstreams/image-exo/reports/match-report.json` (1,318 matched / 6 unmatched-new / 0 unmatched-legacy / 0 ambiguous), re-joins each row against the full dataset record it came from (the report itself only carries `dataset_id`/`dataset_name` + a few attributes — **not** the media paths or bilingual instructions merge needs), resizes/caps media with `sharp`, uploads to the existing `exercise-media` bucket, snapshots the pre-UPDATE row into a new `exercises_merge_backup` table, and writes/updates a row in `exercise_import_log` — all after a single live interactive terminal confirmation (no `--yes` flag, no persisted "approved" field).

Three things this research resolved that CONTEXT.md flagged as open:
1. **D-03 (instructions schema):** the dataset's `instructions`/`instruction_steps` fields are keyed `en`/`fr` — verified directly against Phase 2's own test fixture (`lib/types.test.ts`, comment: "Real shape verified live against exercises.schema.json"). Recommendation: add `instructions_fr TEXT` (mirrors the existing `name`/`name_fr` split) + `instruction_steps JSONB` (stores the dataset's `{en: string[], fr: string[]}` shape verbatim) in **this phase's** migration, populated in the same UPDATE/INSERT that overwrites `instructions`.
2. **The report does not carry enough data to merge.** `ReportMatchedRowSchema` and `ReportUnmatchedNewRowSchema` (`lib/types.ts`) omit `image`, `gif_url`, `instructions`, `instruction_steps`, `media_id`, `attribution`, `category`, `muscle_group`. `merge.ts` **must** re-load `data/exercises.json` from the cloned dataset (via `loadDatasetJson`, already in `lib/verify.ts`) and index it by `dataset_id` to get the full record for every row it processes.
3. **`.dataset-cache/` does not currently exist on disk** (gitignored, and evidently not persisted between sessions/machines). `merge.ts` must treat a missing/stale cache as a hard failure (instructing the operator to re-run `fetch.ts`) and must verify the cloned commit SHA matches `report.dataset_commit` before proceeding — otherwise the media/instructions written could silently drift from what the human approved.

**Primary recommendation:** Build `merge.ts` as a sequential (not parallelized) per-row loop over `matched` + `unmatched_new` + `unmatched_legacy` + `ambiguous`, where each row's unit of work is strictly ordered **upload media → backup snapshot (matched only) → DB write → log outcome**, any failure at any step aborts only that row and logs `error_message`, and resumability is computed from `exercise_import_log` by `error_message IS NULL` (done) vs. `error_message IS NOT NULL` or absent (retry), not from the `status` enum alone (Phase 1's `exercise_import_log.status` CHECK constraint has no `'error'` value).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Report parsing & approval gate | Node script (CLI) | — | `merge.ts` is a standalone script, not a backend route — no HTTP surface for this phase |
| Dataset record lookup (image/instructions by `dataset_id`) | Node script (CLI) | Filesystem (`.dataset-cache/`) | Report doesn't carry full records; script re-reads the cloned dataset JSON |
| Media resize/cap (180×180) | Node script (CLI, via `sharp`) | — | Must happen before upload — MEDIA-03 requires the cap enforced "at the upload step" |
| Media upload | Supabase Storage (`exercise-media` bucket) | Node script (write client) | Storage bucket already exists (Phase 1); script is the only writer (service-role) |
| Row UPDATE/INSERT | Database / Postgres (`public.exercises`) | Node script (write client) | FK-safety (UUID preservation) is a DB-level guarantee the script must respect, not re-implement |
| Backup snapshot | Database / Postgres (`exercises_merge_backup`, new table) | Node script | Must be written in the same logical step, immediately before the UPDATE |
| Resumability / audit log | Database / Postgres (`exercise_import_log`, existing) | Node script | Already exists from Phase 1; this phase is its first writer |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full refresh — merge overwrites media (image/gif paths) **and** attributes (body_part, equipment, target_muscle, secondary_muscles, category) **and** instructions text for all 1,318 matched rows. Deliberate full library replacement, not a conservative media-only patch.
- **D-02:** Where `field_conflicts` flags a disagreement, the **dataset wins** — overwrite anyway. Production `name`/`name_fr` are NEVER touched by this (only body_part/equipment/target/etc.).
- **D-03 (Claude's discretion — resolved by this research):** Add `instructions_fr TEXT` + `instruction_steps JSONB` in this phase's migration, populated during the same UPDATE/INSERT that overwrites `instructions`. See "Code Examples" and "Architecture Patterns" below.
- **D-04:** No persistent "approved" field in the report schema. Approval is a **live interactive confirmation at merge run time** — `merge.ts` prints a summary (counts per category, sample rows) and requires the operator to explicitly confirm before any write happens. No code path from fetch/match output straight into merge, regardless of file contents.
- **D-05:** Single, whole-report approval — one confirmation covers matched UPDATEs and unmatched-new INSERTs together. No per-category split.
- **D-06:** On row failure (DB write or either media upload): log the error to `exercise_import_log.error_message` and continue to the next row. Run completes end-to-end; failed rows are visible afterward.
- **D-07 (Claude's discretion — resolved by this research):** Bounded retry (recommend 3 attempts, exponential backoff ~500ms/1000ms/2000ms) for transient/network-class failures specifically, before falling back to log-and-continue. See "Common Pitfalls" and "Code Examples".
- **D-08:** Re-running merge auto-retries previously-errored rows — `exercise_import_log` rows in an error state are treated like unprocessed rows and picked back up automatically. No manual-clear step required.
- **D-09:** Backup table only — `exercises_merge_backup` captures the pre-UPDATE snapshot. No restore/rollback script built or tested this phase.
- **D-10:** Full-row snapshot — every column of the row as it existed immediately before the UPDATE, not just changed columns.

### Claude's Discretion
- D-03: Resolved above (instructions_fr/instruction_steps added this phase).
- D-07: Resolved above (3-attempt bounded retry for transient errors only).
- Media resize/cap mechanics (library choice, source-resolution handling, format) — resolved below: `sharp`, `fit: 'inside'` + `withoutEnlargement: true`, PNG for thumb, GIF for animation.
- Generic `needs_review` handling for the (currently zero) `unmatched_legacy`/`ambiguous` rows — resolved below: route to `exercise_import_log` with `status='needs_review'`, `exercise_id` populated where known, `exercises` table never touched.

### Deferred Ideas (OUT OF SCOPE)
None — Phase 3's CONTEXT.md discussion stayed within phase scope; no scope-creep items were raised.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-03 | Merge only runs on an approved report; UPDATE matched in place (preserve UUID), INSERT unmatched-new, never DELETE | "Architecture Patterns" (per-row loop, ordering), "Code Examples" (readline confirm, UUID-first insert pattern) |
| IMPORT-04 | Idempotent/resumable via `exercise_import_log`; killed/re-run never reprocesses or corrupts already-migrated rows | "Common Pitfalls" (no `'error'` status value — use `error_message IS NULL`), "Code Examples" (`DISTINCT ON` resume query) |
| IMPORT-05 | Legacy exercises with real history but no confident match are left untouched, flagged `needs_review`, never auto-merged/deleted | "Architecture Patterns" (needs_review code path), confirmed 0 such rows in the current approved report but path must exist |
| MEDIA-03 | Media never exceeds 180×180, never upscaled, cap enforced at upload | "Standard Stack" (`sharp`), "Code Examples" (resize snippet with `withoutEnlargement: true`) |
| MEDIA-04 | Every row about to be UPDATEd is snapshotted to `exercises_merge_backup` before the write | "Architecture Patterns", "Code Examples" (`CREATE TABLE ... LIKE ... INCLUDING DEFAULTS`) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `sharp` | 0.34.5 (already resolved at `node_modules/sharp` via `apps/web`'s Next.js dependency; latest on npm is 0.35.3) [VERIFIED: npm registry, slopcheck OK] | Resize + cap media to 180×180, encode PNG (thumb) and GIF (animation) | De facto standard Node image library (libvips-backed); already present in the monorepo, avoids adding a second image toolchain |
| `@supabase/supabase-js` | `^2.99.2` (root) already a dependency [VERIFIED: package.json] | Write-capable Supabase client (service-role) + Storage upload | Same client library Phase 2's read-only client and the backend's admin client both already use — no new dependency |
| `zod` | `^4.3.6` already a dependency [VERIFIED: package.json] | Extend `lib/types.ts` with any merge-specific parsing needs (none strictly required beyond what Phase 2 already defined) | Already the pipeline's validation library |
| `readline/promises` (Node builtin) | Node 18+ | Live interactive confirmation (D-04) | Built into Node — no new dependency, and critically **cannot** be bypassed with a flag, satisfying D-04's "interactive, not a flag" requirement |
| `crypto.randomUUID()` (Node builtin) | Node 14.17+ | Generate the new exercise's UUID client-side before INSERT, so the Storage folder path (`{exercise_id}/...`) is known before upload | Built-in, RFC 4122 v4 UUID — matches Postgres's `uuid_generate_v4()` default already used on `exercises.id` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none additional | — | — | Retry-with-backoff (D-07) is 2-3 call sites and ~15 lines — hand-roll a tiny `withRetry` helper rather than adding `p-retry`/`async-retry` as a dependency (see "Don't Hand-Roll" — this is the deliberate exception) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sharp` | `jimp` (pure JS) | `jimp` has weaker/no animated-GIF support and is slower; `sharp` is already installed transitively, so there's no install-cost argument for `jimp` |
| Sequential per-row processing | `p-limit`/`p-queue` bounded concurrency | Would cut wall-clock time (~1,324 rows × ~1-2s each ≈ 20-45 min sequential) but complicates the log-and-continue error model and Storage rate-limit behavior; not required by any success criterion — recommend sequential for v1, note concurrency as a future optimization |
| Hand-rolled retry | `p-retry` | Unnecessary dependency for 2-3 call sites; see "Don't Hand-Roll" |

**Installation:**
```bash
npm install sharp
```
(Note: `sharp` already resolves in `node_modules/` transitively via `apps/web`'s Next.js dependency, but per the established pipeline precedent — Phase 2 explicitly added `fastest-levenshtein` to root `package.json` even though it could theoretically have been hoisted — add `sharp` as an **explicit** root `dependencies` entry so `scripts/exercise-import/merge.ts` doesn't silently depend on an undeclared transitive package that could disappear if `apps/web`'s Next.js dependency tree changes.)

**Version verification:** `npm view sharp version` → `0.35.3` (checked live 2026-08-15). Installed/hoisted version is `0.34.5` — both support the constructor/resize/output APIs this phase needs; either is fine, but `npm install sharp` will pull the current `0.35.3` unless pinned.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `sharp` | npm | ~8 years (lovell/sharp, longstanding) | very high (tens of millions/week) | github.com/lovell/sharp | [OK] (slopcheck ran successfully, package verified installable and legitimate) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 was installed and run (`slopcheck install sharp`) — result: `[OK] sharp (npm)`, 1/1 packages OK. No other new external packages are recommended for this phase (retry logic is hand-rolled per "Don't Hand-Roll"; interactive confirmation and UUID generation use Node builtins).

## Architecture Patterns

### System Architecture Diagram

```
match-report.json (human-approved, committed)
        │
        ▼
merge.ts preflight
  ├─ assertRunFromRepoRoot()
  ├─ parse report through MatchReportSchema.parse (fail loudly on drift)
  ├─ verify .dataset-cache/exercises-dataset exists AND
  │    `git rev-parse HEAD` === report.dataset_commit   ──fail──▶ exit, instruct: re-run fetch.ts
  ├─ loadDatasetJson(DATASET_JSON_PATH) → Map<dataset_id, DatasetExercise>
  ├─ createWriteClient() (SUPABASE_URL + SUPABASE_SERVICE_KEY)
  ├─ query exercise_import_log, compute per-source_id resume state
  │    (latest row per source_id; error_message IS NOT NULL ⇒ retry;
  │     error_message IS NULL ⇒ already done, log a 'skipped' row and move on)
  └─ print summary (counts per category, N sample rows) via readline/promises
       .question('Proceed with merge? [y/N] ')  ──anything but y──▶ exit 0, no writes
        │
        ▼ (single whole-report confirmation, D-05)
┌───────────────────────────── per-row loop (sequential) ─────────────────────────────┐
│ for each row in [matched, unmatched_new, unmatched_legacy, ambiguous]:               │
│   skip if already-done per resume state                                              │
│   ┌─ matched/unmatched_new row ─────────────────────────────────────────────┐        │
│   │ 1. datasetRecord = datasetById.get(row.dataset_id)                      │        │
│   │ 2. resizedThumb = capImage(datasetRecord.image)   [sharp, ≤180×180]     │        │
│   │    resizedGif   = capGif(datasetRecord.gif_url)   [sharp, animated]     │        │
│   │    (each upload wrapped in withRetry — D-07)                            │        │
│   │ 3. exerciseId = row.exercise_id (matched) | crypto.randomUUID() (new)   │        │
│   │ 4. upload thumb → exercise-media/{exerciseId}/thumb.png  {upsert:true}  │        │
│   │    upload gif   → exercise-media/{exerciseId}/animation.gif {upsert:true}│       │
│   │ 5. [matched only] INSERT exercises_merge_backup snapshot of current row │        │
│   │ 6. UPDATE (matched) or INSERT (unmatched_new) public.exercises          │        │
│   │      body_part/equipment/target_muscle/secondary_muscles/category ←dataset│      │
│   │      instructions ← dataset.instructions.en                             │        │
│   │      instructions_fr ← dataset.instructions.fr                          │        │
│   │      instruction_steps ← dataset.instruction_steps  (JSONB, verbatim)   │        │
│   │      image ← '{exerciseId}/thumb.png', gif ← '{exerciseId}/animation.gif'│       │
│   │      name/name_fr ← UNTOUCHED (D-02)                                    │        │
│   │ 7. INSERT exercise_import_log {source_id: dataset_id, exercise_id,      │        │
│   │      status: 'matched'|'inserted', error_message: null}                 │        │
│   │ ON ANY STEP FAILURE → catch, INSERT exercise_import_log                 │        │
│   │      {status: <best-effort prior status>, error_message: <msg>},        │        │
│   │      continue to next row (D-06) — no partial write to exercises        │        │
│   └───────────────────────────────────────────────────────────────────────┘         │
│   ┌─ unmatched_legacy / ambiguous row ──────────────────────────────────────┐        │
│   │ never touch public.exercises                                            │        │
│   │ INSERT exercise_import_log {source_id, exercise_id (if known),          │        │
│   │   status: 'needs_review', error_message: null}                          │        │
│   └───────────────────────────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
print run summary (succeeded / errored / needs_review counts) — operator inspects
exercise_import_log for error_message IS NOT NULL rows, re-runs merge.ts to retry
```

### Recommended Project Structure
```
scripts/exercise-import/
├── merge.ts                    # new entrypoint — run via tsx only, never imported by tests
├── lib/
│   ├── paths.ts                 # extend: no new constants strictly required (DATASET_ROOT/DATASET_JSON_PATH/REPORT_JSON_PATH already exist)
│   ├── supabase-write-client.ts # new — service-role client (mirrors supabase-client.ts's shape)
│   ├── media.ts                 # new — pure functions: capImage(buffer) -> Buffer, capGif(buffer) -> Buffer (sharp calls, no I/O)
│   ├── retry.ts                 # new — withRetry(fn, { attempts: 3, baseDelayMs: 500 })
│   ├── import-log.ts            # new — pure functions: computeResumeState(logRows) -> Map<source_id, ResumeState>
│   └── merge.test.ts / media.test.ts / import-log.test.ts / retry.test.ts
supabase/migrations/
└── 20260815_exercises_merge_backup_and_i18n.sql   # exercises_merge_backup table + instructions_fr + instruction_steps columns
```

### Pattern 1: Client-side UUID generation before INSERT (unmatched_new rows)
**What:** Generate the new exercise's UUID in application code before any write, so the Storage folder path is known ahead of the DB INSERT.
**When to use:** Every `unmatched_new` row (the 6 INSERTs).
**Example:**
```typescript
// merge.ts — per unmatched_new row
import { randomUUID } from 'crypto';

const exerciseId = randomUUID(); // client-generated, matches Postgres uuid_generate_v4() shape
const thumbPath = `${exerciseId}/thumb.png`;
const gifPath = `${exerciseId}/animation.gif`;

// upload media to thumbPath/gifPath BEFORE the insert...
// then:
const { error } = await writeClient.from('exercises').insert({
  id: exerciseId, // explicit — overrides the DEFAULT uuid_generate_v4()
  name: datasetRecord.name,
  category: datasetRecord.category,
  body_part: datasetRecord.body_part,
  equipment: datasetRecord.equipment,
  target_muscle: datasetRecord.target,
  secondary_muscles: datasetRecord.secondary_muscles,
  instructions: datasetRecord.instructions.en,
  instructions_fr: datasetRecord.instructions.fr,
  instruction_steps: datasetRecord.instruction_steps,
  image: thumbPath,
  gif: gifPath,
  is_custom: false,
});
```

### Pattern 2: Resize + cap media with sharp (MEDIA-03)
**What:** Never exceed 180×180 in either dimension, never upscale, for both static thumbnail and animated GIF.
**When to use:** Every matched (D-01 full refresh) and unmatched_new row's media upload.
**Example:**
```typescript
// Source: https://sharp.pixelplumbing.com/api-constructor, https://sharp.pixelplumbing.com/api-output
// (Cross-checked live against sharp docs 2026-08-15; sharp 0.34.5 installed in this monorepo.)
import sharp from 'sharp';

const CAP = 180;

export async function capImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({ width: CAP, height: CAP, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

export async function capGif(input: Buffer): Promise<Buffer> {
  // { animated: true } reads ALL frames (equivalent to pages: -1) — without it,
  // sharp only processes the first frame and silently produces a static image
  // with a .gif extension (see Common Pitfalls).
  return sharp(input, { animated: true })
    .resize({ width: CAP, height: CAP, fit: 'inside', withoutEnlargement: true })
    .gif()
    .toBuffer();
}
```
`fit: 'inside'` guarantees both output dimensions are `<= 180` (aspect-ratio preserved, so a non-square source won't be forced to exactly 180×180 — this is correct per MEDIA-03's "never exceed 180×180", which is a ceiling, not a fixed canvas requirement). `withoutEnlargement: true` guarantees a smaller source is never upscaled.

### Pattern 3: Idempotent Storage upload
**What:** Re-running merge.ts on a row already uploaded must overwrite, not throw.
**Example:**
```typescript
// Source: node_modules/@supabase/storage-js/src/lib/types.ts (FileOptions.upsert),
// installed version — verified directly against package source, 2026-08-15.
const { error } = await writeClient.storage
  .from('exercise-media')
  .upload(thumbPath, thumbBuffer, { contentType: 'image/png', upsert: true });
if (error) throw error; // caught by the per-row try/catch, logged, row skipped this run
```

### Pattern 4: Live interactive confirmation (D-04) — no flag bypass
**What:** A single whole-report confirmation (D-05) that cannot be automated around.
**Example:**
```typescript
import { createInterface } from 'readline/promises';

async function confirmOrExit(report: MatchReport): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error(
      'merge.ts requires an interactive terminal to confirm the merge. ' +
        'Do not pipe input or run this in CI — run it directly from a terminal.',
    );
    process.exit(1);
  }

  console.log(`About to merge: ${report.counts.matched} UPDATE, ` +
    `${report.counts.unmatched_new} INSERT, ` +
    `${report.counts.unmatched_legacy + report.counts.ambiguous} flagged needs_review.`);
  // ... print N sample rows per category ...

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Proceed with merge? Type "yes" to continue: ');
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted — no writes made.');
    process.exit(0);
  }
}
```

### Pattern 5: Resumability without a status-enum "error" value
**What:** `exercise_import_log.status` CHECK constraint (Phase 1, locked) only allows `matched`/`inserted`/`skipped`/`needs_review` — there is no `'error'` value. The resume signal must be `error_message`, not `status`.
**Example:**
```sql
-- Latest log entry per source_id (source_id has an index but NOT a unique
-- constraint — multiple log rows per source_id accumulate across re-runs).
SELECT DISTINCT ON (source_id) *
FROM public.exercise_import_log
ORDER BY source_id, processed_at DESC;
```
```typescript
// merge.ts resume logic
type ResumeState = 'done' | 'retry' | 'unprocessed';

function computeResumeState(latestLogRow: ImportLogRow | undefined): ResumeState {
  if (!latestLogRow) return 'unprocessed';
  if (latestLogRow.error_message !== null) return 'retry'; // D-08
  return 'done'; // status was matched/inserted/needs_review with no error — skip
}
```
When `computeResumeState` returns `'done'`, `merge.ts` writes a fresh `exercise_import_log` row with `status: 'skipped'` (Phase 1 D-06's documented meaning: "already processed in a prior run") rather than silently doing nothing — this keeps the log a complete audit trail of every run's pass over every row.

### Pattern 6: Backup-then-UPDATE ordering (MEDIA-04)
**What:** The snapshot MUST exist before the UPDATE runs, and a failed snapshot must abort the UPDATE for that row.
**Example:**
```typescript
// Only for matched rows (unmatched_new has no "before" state to back up)
const { data: currentRow, error: readError } = await writeClient
  .from('exercises')
  .select('*')
  .eq('id', row.exercise_id)
  .single();
if (readError || !currentRow) throw readError ?? new Error('row vanished before backup');

const { error: backupError } = await writeClient
  .from('exercises_merge_backup')
  .insert({ ...currentRow, import_log_id: null }); // linked after the log row is written, or omit the FK if not needed
if (backupError) throw backupError; // abort this row — never UPDATE without a successful backup

// ... only now perform the UPDATE ...
```

### Anti-Patterns to Avoid
- **Trusting the report's row shape as complete:** `ReportMatchedRow`/`ReportUnmatchedNewRow` are thin (dataset_id, name, tier/score, or body_part/equipment/target only) — do not try to write `image`/`gif`/`instructions` straight from the report object. Always re-join against `loadDatasetJson()` output by `dataset_id`.
- **Bulk `UPDATE ... WHERE id IN (...)`:** Not viable here — each row needs a distinct per-row media upload result (Storage path) written into the same row, and per-row error isolation (D-06). A single bulk SQL statement can't partially fail-and-continue per row the way this phase requires.
- **Skipping the `dataset_commit` consistency check:** if an operator re-runs `fetch.ts --refetch` between `match.ts` and `merge.ts` (e.g. weeks later, upstream dataset changed), the images/instructions merge.ts would upload could silently differ from what the human reviewed in `match-report.md`. Always assert `git -C DATASET_ROOT rev-parse HEAD === report.dataset_commit` before any write.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image/GIF resize + cap to 180×180 | A manual canvas/pixel-buffer resizer | `sharp` (`fit: 'inside'`, `withoutEnlargement: true`) | Correct aspect-ratio-preserving resize, animated-GIF-aware, is exactly what a mature native binding does well; hand-rolling risks silently violating the "never upscale" license constraint |
| Full-row table snapshot schema | Manually enumerating all ~20 `exercises` columns in a `CREATE TABLE` | `CREATE TABLE exercises_merge_backup (LIKE public.exercises INCLUDING DEFAULTS)` | Avoids column-list drift if a future migration adds a column to `exercises` — the backup table's shape stays in lockstep automatically at creation time (though it does NOT auto-track *future* `ALTER TABLE`s on `exercises` after backup-table creation — that's an accepted limitation, not a full mirror) |
| UUID generation | A custom UUID v4 generator | `crypto.randomUUID()` (Node builtin) | RFC 4122 compliant, zero dependencies, matches the format Postgres's `uuid_generate_v4()` already produces |

**Key insight:** The one deliberate exception is retry-with-backoff (D-07) — with only 2-3 call sites (row DB write, thumb upload, gif upload) a ~15-line hand-rolled `withRetry(fn, attempts, baseDelayMs)` helper is simpler and has less blast radius than adding `p-retry`/`async-retry` as a new dependency for this single phase. This is a scale judgment, not a blanket "retry logic is fine to hand-roll" rule — larger retry needs (rate-limit-aware, jittered, circuit-breaker) should use a library.

## Common Pitfalls

### Pitfall 1: Report rows are missing the fields merge.ts actually needs
**What goes wrong:** Writing `image`/`gif`/`instructions` straight from `match-report.json` — these fields don't exist on `ReportMatchedRow` or `ReportUnmatchedNewRow`.
**Why it happens:** Phase 2's report schema was deliberately thin (dataset_id/name/tier/score for matched rows) — it's a *decision* artifact, not a full data export.
**How to avoid:** Always re-load `data/exercises.json` from the cloned dataset via `loadDatasetJson()` and build a `Map<dataset_id, DatasetExercise>` once at the start of `merge.ts`; look up every row's full record from that map.
**Warning signs:** TypeScript errors accessing `row.image` on a `ReportMatchedRow` — the type system will actually catch this early since the schemas are `.strict()`.

### Pitfall 2: `.dataset-cache/` may not exist when merge.ts runs
**What goes wrong:** `merge.ts` assumes the same machine/session that ran `match.ts` still has the clone on disk. Confirmed on this research pass: `.dataset-cache/` does **not** currently exist in the working tree.
**Why it happens:** It's gitignored (correctly — it's ~1,324 images + GIFs) and there's no guarantee merge.ts runs on the same machine/session as the original `fetch.ts`/`match.ts` run.
**How to avoid:** `merge.ts` must check `existsSync(DATASET_ROOT)` and fail loudly with "run `fetch.ts` first" if absent — never attempt an implicit re-clone (keeps the fetch/match/merge stage boundaries clean, matches the existing `assertRunFromRepoRoot()`-style loud-failure convention).
**Warning signs:** `ENOENT` reading `DATASET_JSON_PATH` — should never surface as a raw stack trace; wrap in the loud, actionable error above.

### Pitfall 3: Dataset drift between match-time and merge-time
**What goes wrong:** If the dataset is re-cloned (e.g. `fetch.ts --refetch`) between when `match.ts` produced the approved report and when `merge.ts` runs, the images/instructions actually uploaded could differ from what a human reviewed.
**Why it happens:** `report.dataset_commit` is recorded but nothing currently re-checks it before a write.
**How to avoid:** `merge.ts` preflight: `git -C DATASET_ROOT rev-parse HEAD` must equal `report.dataset_commit`, or hard-exit.
**Warning signs:** None automatically visible without the check — this is a silent-drift risk, which is exactly why the check must be explicit.

### Pitfall 4: `exercise_import_log` has no `'error'` status — don't invent one
**What goes wrong:** Trying to `INSERT ... status: 'error'` will violate the existing `CHECK (status IN ('matched','inserted','skipped','needs_review'))` constraint from Phase 1's locked migration.
**Why it happens:** D-06/D-08 talk about "error rows" conversationally, but Phase 1's schema (already shipped, not renegotiable this phase) never added an error status value.
**How to avoid:** Use the row's *intended* status (`matched`/`inserted`/`needs_review`) alongside a non-null `error_message` to represent a failed attempt; the resume logic keys off `error_message IS NOT NULL`, never off a specific status string. If a specific status can't even be determined before the failure (e.g., the row's DB write itself failed), still write *some* row with a non-null `error_message` — pick the closest available status label (e.g. `'matched'` for a matched-row failure) since the CHECK constraint requires one of the four values.
**Warning signs:** A Postgres `23514` (check_violation) error on the log INSERT itself — would be a very confusing failure mode if it happened inside the failure-handling path.

### Pitfall 5: `source_id` has no unique constraint — don't naively upsert
**What goes wrong:** Assuming `ON CONFLICT (source_id) DO UPDATE` works — there's no unique index on `source_id`, only a plain btree index for lookup speed.
**Why it happens:** Phase 1's `exercise_import_log` was designed as an **append-only audit log** (every run's outcome is a new row), not a keyed state table.
**How to avoid:** Compute resume state via `SELECT DISTINCT ON (source_id) ... ORDER BY source_id, processed_at DESC` (or equivalent in-memory reduction after a full read), never `ON CONFLICT`.
**Warning signs:** A `42P10` Postgres error ("there is no unique or exclusion constraint matching the ON CONFLICT specification") if `ON CONFLICT` is attempted.

### Pitfall 6: sharp silently drops GIF animation without `{ animated: true }`
**What goes wrong:** `sharp(gifBuffer).resize(...).gif().toBuffer()` (without the constructor option) reads only the first frame — output is a single-frame "GIF" that looks static in the app.
**Why it happens:** sharp's default page-reading behavior is single-page; animated reading is opt-in.
**How to avoid:** Always construct with `sharp(input, { animated: true })` when processing `gif_url` sources. [CITED: sharp.pixelplumbing.com/api-constructor]
**Warning signs:** Uploaded `animation.gif` files with a suspiciously small file size relative to the source; visual QA in Phase 4 would catch this but it's much cheaper to get right in this phase.

### Pitfall 7: `category` dataset values may not satisfy production's CHECK constraint
**What goes wrong:** `public.exercises.category` has `CHECK (category IN ('strength','cardio','flexibility','balance','sports','stretching'))` (migration 004). The dataset's `category` field is validated only as `z.string().min(1)` (any non-empty string) — there's no guarantee every dataset category value is one of those six.
**Why it happens:** The Phase 2 matcher's `field_conflicts` reporting covers body_part/equipment/target, not `category` — this wasn't cross-checked against the CHECK constraint enum during Phase 2.
**How to avoid:** Before the merge run (or as part of the preflight step), enumerate the distinct `category` values present across all 1,324 dataset records and diff against the six allowed values; any mismatch should either be mapped to an allowed value or explicitly logged as a per-row `error_message` (via the existing per-row try/catch — a `23514` check_violation on the `exercises` UPDATE/INSERT will already be caught and logged, so this fails safely even if not pre-checked, but pre-checking surfaces it during planning/dry-run instead of mid-batch).
**Warning signs:** A batch of `23514` check_violation errors clustered in `exercise_import_log.error_message` after a run — would indicate this wasn't caught ahead of time.

### Pitfall 8: Backup table constraint duplication
**What goes wrong:** `CREATE TABLE exercises_merge_backup (LIKE public.exercises INCLUDING ALL)` would also copy `exercises`' PRIMARY KEY on `id` — but a backup table needs to store the *same* `id` value across potentially multiple snapshot events without a uniqueness violation (e.g. `needs_review` corrections re-processed later, or, defensively, any accidental re-snapshot).
**How to avoid:** Use `INCLUDING DEFAULTS` only (not `INCLUDING ALL`/`INCLUDING CONSTRAINTS`/`INCLUDING INDEXES`), and add a synthetic surrogate PK (`backup_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`) plus a `backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` column. Note per Postgres docs, `NOT NULL` constraints on source columns are copied unconditionally by `LIKE` regardless of `INCLUDING` options — this is fine since a full-row snapshot of a real existing row will always already satisfy them.

## Code Examples

### Migration: exercises_merge_backup + instructions i18n columns
```sql
-- supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql
-- image-exo Phase 3: instructions i18n columns (D-03) + backup snapshot table (D-09/D-10)

-- ─────────────────────────────────────────────────────────
-- Section 1: instructions i18n columns (D-03)
-- Mirrors the existing name/name_fr split (031_exercises_name_fr.sql).
-- instruction_steps stores the dataset's {en: string[], fr: string[]} shape verbatim.
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS instructions_fr TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS instruction_steps JSONB;

-- ─────────────────────────────────────────────────────────
-- Section 2: exercises_merge_backup (D-09, D-10)
-- Full-row snapshot, no restore tooling this phase. INCLUDING DEFAULTS only
-- (not ALL/CONSTRAINTS/INDEXES) — a backup table must not inherit exercises'
-- PRIMARY KEY, since the same exercise id may legitimately be snapshotted
-- across multiple merge runs.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercises_merge_backup (
  LIKE public.exercises INCLUDING DEFAULTS
);

ALTER TABLE public.exercises_merge_backup
  ADD COLUMN IF NOT EXISTS backup_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_exercises_merge_backup_id ON public.exercises_merge_backup(id);

-- No policies: service-role (merge.ts) writes only, mirrors exercise_import_log.
ALTER TABLE public.exercises_merge_backup ENABLE ROW LEVEL SECURITY;
```
Note: `id` on `exercises_merge_backup` is inherited from `LIKE public.exercises` as a plain `UUID` column (no PK/FK on it) — it stores the original exercise's id for later manual lookup, not as a constraint.

### Write-capable Supabase client (mirrors backend's admin-client pattern)
```typescript
// scripts/exercise-import/lib/supabase-write-client.ts
// Source pattern: backend/api/src/middleware/auth.ts (adminClient construction)
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

### Retry helper (D-07)
```typescript
// scripts/exercise-import/lib/retry.ts
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
Apply `withRetry` only around the two Storage uploads and the DB write calls (transient/network-class failure surface) — not around pure in-memory `sharp` resize calls (a resize failure is deterministic/terminal, retrying won't help and would just burn time).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is this monorepo's first data-merge pipeline of this shape | Sequential per-row loop with backup-then-write ordering, append-only audit log | This phase (2026-08) | Establishes the pattern for any future bulk-import/merge phase in this codebase |

No deprecated/outdated findings apply — `sharp`, `@supabase/supabase-js`, and `readline/promises` are all current, actively maintained as of this research date.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exercisedb-sourced dataset source images (`images/*.jpg`) are typically already at or near 180×180 or smaller | Summary/Pitfalls (implicit) | Low — `withoutEnlargement: true` + `fit: 'inside'` handles any source size correctly regardless of this assumption; flagged only because `.dataset-cache/` isn't present to directly inspect actual pixel dimensions on this research pass |
| A2 | Merge run wall-clock time of roughly 20-45 minutes for ~1,324 sequential rows (2 media uploads + 1 backup insert + 1 DB write each, ~1-2s/row) | Standard Stack / Alternatives Considered | Low — affects only UX expectations (how long the operator waits at the confirmation prompt before completion), not correctness; if wildly off, bounded concurrency (noted as a future optimization) becomes worth reconsidering |
| A3 | No `NOTICE.md` file exists yet in the repo despite being referenced in `REQUIREMENTS.md`'s "Out of Scope" table as the source of the 180×180 licensing constraint | Common Pitfalls / general awareness | Low for Phase 3 (the 180×180 cap is already a locked requirement regardless of whether the file exists) — worth flagging to the planner in case a `NOTICE.md` creation task belongs in this phase or Phase 4 |

## Open Questions (RESOLVED)

1. **Exact distinct `category` values across all 1,324 dataset records** — **RESOLVED:** adopted as recommended. Plan 03-03 builds `lib/category.ts` with `collectUnmappableCategories(records)` (diffing distinct dataset `category` values against the CHECK constraint's 6 allowed values), and plan 03-05 Task 1 calls it as preflight step 6 of `merge.ts`, surfacing any unmappable value in the pre-confirmation summary rather than as a mid-batch `23514`. Non-empty results do not exit — the operator decides at the confirmation prompt. Per-row try/catch (Pitfall 7) remains the backstop.
   - What we know: the dataset's `category` field is free-text per the zod schema (`z.string().min(1)`), and production's CHECK constraint only allows 6 specific values.
   - What's unclear: whether every dataset category value happens to already match one of the 6 (matcher fixture used `'strength'`, which does match) — not verified across the full dataset since `.dataset-cache/` isn't present on this machine.
   - Recommendation: the planner should add a preflight/dry-run step to `merge.ts` (or a small standalone check script) that loads the dataset and diffs distinct `category` values against the CHECK constraint's 6 values, before the interactive confirmation — surfacing any mismatch as part of the pre-merge summary rather than a mid-batch `23514` error. Per-row try/catch already makes this safe either way (Pitfall 7).

2. **`import_log_id` linkage between `exercises_merge_backup` and `exercise_import_log`** — **RESOLVED: omitted, deliberately.** Plan 03-01 Task 1 lists `import_log_id` under "Deliberate exclusions" and grep-asserts its absence from the migration: `backed_up_at` timestamp correlation is sufficient, no success criterion requires the FK, and adding it would couple backup retention to log retention.
   - What we know: D-10 requires full-row snapshots; the log table already tracks per-row outcome.
   - What's unclear: whether the planner wants an explicit FK from `exercises_merge_backup` back to the `exercise_import_log` row that triggered it (useful for "why was this backed up" auditability) or whether `backed_up_at` timestamp correlation is sufficient.
   - Recommendation: lightweight addition (`import_log_id UUID` nullable, no FK constraint to avoid coupling backup retention to log retention) — not required by any success criterion, but cheap to add now if desired; otherwise omit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `sharp` (npm) | MEDIA-03 resize/cap | ✓ (transitively via apps/web; add explicitly per Standard Stack) | 0.34.5 installed / 0.35.3 latest | — |
| `git` CLI | Dataset commit verification, `.dataset-cache/` re-clone via `fetch.ts` | ✓ (used successfully by Phase 2's `fetch.ts`) | — | — |
| `.dataset-cache/exercises-dataset` (local clone) | Full dataset record lookup (image/gif/instructions per `dataset_id`) | ✗ (not present on this machine at research time) | — | Operator must run `fetch.ts` before `merge.ts`; no other fallback — this blocks execution until re-cloned |
| `SUPABASE_SERVICE_KEY` env var | Write-capable Supabase client | Unconfirmed — `.env.example` documents the var (currently blank placeholder, "used ONLY for coach-exercises signed URL generation") but this phase is a *new* consumer | — | Must be populated in `backend/api/.env.local` before merge.ts can run; document this in the phase's README update |

**Missing dependencies with no fallback:**
- `.dataset-cache/exercises-dataset` — must be regenerated via `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts` before `merge.ts` can run. This is expected or normal (ephemeral, gitignored), not a blocker to *planning*, but the plan must include this as an explicit prerequisite step/task.

**Missing dependencies with fallback:**
- none beyond the above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 (root `vitest.config.ts`, already scoped to `scripts/exercise-import/**/*.test.ts`) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npm run test:import` |
| Full suite command | `npm run test:import` (same — this pipeline has no separate integration-test tier) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| IMPORT-03 | UPDATE preserves UUID; INSERT creates new row; never DELETE | unit (pure function: given a row + client stub, assert correct SQL-shape call) | `npx vitest run scripts/exercise-import/lib/merge.test.ts` | ❌ Wave 0 |
| IMPORT-04 | Resume state computed correctly from `exercise_import_log` (`error_message` semantics, `DISTINCT ON` reduction) | unit | `npx vitest run scripts/exercise-import/lib/import-log.test.ts` | ❌ Wave 0 |
| IMPORT-05 | `unmatched_legacy`/`ambiguous` rows never touch `exercises`, always log `needs_review` | unit | `npx vitest run scripts/exercise-import/lib/merge.test.ts` | ❌ Wave 0 |
| MEDIA-03 | `capImage`/`capGif` never exceed 180×180, never upscale | unit (fixture images: a small <180px source, an exactly-180px source, a large >180px source) | `npx vitest run scripts/exercise-import/lib/media.test.ts` | ❌ Wave 0 |
| MEDIA-04 | Backup row is inserted with all columns matching the pre-UPDATE row, before the UPDATE | unit (pure function ordering assertion against a stubbed client recording call order) | `npx vitest run scripts/exercise-import/lib/merge.test.ts` | ❌ Wave 0 |

Real-DB integration testing (actually hitting a live/staging Supabase instance with the 1,324-row report) is out of scope for automated CI per this pipeline's existing precedent (Phase 2's real dry-run was a manual, human-supervised step — see `02-06-PLAN.md`) — the planner should schedule an equivalent manual-supervised real run for Phase 3, not an automated integration test against production.

### Sampling Rate
- **Per task commit:** `npm run test:import` (fast — pure-function unit tests only, no network/DB)
- **Per wave merge:** `npm run test:import`
- **Phase gate:** Full suite green before `/gsd:verify-work`, **plus** a manually-supervised real run against the approved `match-report.json` (mirroring Phase 2's 02-06 plan) before the phase is considered functionally complete — automated tests alone cannot verify actual Supabase Storage/Postgres write behavior without live credentials.

### Wave 0 Gaps
- [ ] `scripts/exercise-import/lib/media.test.ts` — covers MEDIA-03 (fixture images needed: tiny/exact/oversized test PNGs+GIFs, can be generated in-test with `sharp` itself rather than committed binary fixtures)
- [ ] `scripts/exercise-import/lib/import-log.test.ts` — covers IMPORT-04 resume-state logic
- [ ] `scripts/exercise-import/lib/merge.test.ts` — covers IMPORT-03/IMPORT-05 row-processing ordering and needs_review routing (stubbed Supabase client, no real network calls — matches Phase 2's `supabase-client.test.ts` precedent)
- [ ] `scripts/exercise-import/lib/retry.test.ts` — covers D-07's bounded-retry behavior (fake timers, assert attempt count and backoff timing)
- [ ] Framework install: none — vitest already configured and scoped correctly for this directory

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Script-to-DB auth is a static service-role key, not a user-facing auth flow |
| V3 Session Management | No | N/A — one-shot CLI script |
| V4 Access Control | Yes | Service-role key (`SUPABASE_SERVICE_KEY`) bypasses RLS entirely — this is the correct/only way to write to `exercise_import_log`/`exercises_merge_backup` (both RLS-enabled with zero policies, deny-by-default for anon/authenticated per Phase 1's precedent), but the key itself must never be logged, printed, or committed. Mirrors `backend/api/src/middleware/auth.ts`'s existing pattern. |
| V5 Input Validation | Yes | `zod` (`MatchReportSchema.parse`, extended `DatasetExerciseSchema`) — already established in `lib/types.ts`; the dataset's `image`/`gif_url` fields are already regex-validated against path traversal (T-02-01, `lib/types.ts` lines 52-60) — this protection carries forward unchanged into merge.ts's re-use of `loadDatasetJson` |
| V6 Cryptography | No | No cryptographic operations in this phase beyond `crypto.randomUUID()` (not a security-sensitive use) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via dataset `image`/`gif_url` fields | Tampering | Already mitigated by Phase 2's `resolveInsideRoot()` (`lib/verify.ts`) + zod path regexes (`lib/types.ts`) — merge.ts must read media bytes via the same resolved-and-contained path, never re-derive a path from `record.image` with a bare `join()` |
| Service-role key leakage (logs, error messages, committed `.env`) | Information Disclosure | Never `console.log` the key or full env; `.env.local` already gitignored per repo convention; error messages from failed Supabase calls should be logged without dumping request headers |
| Unbounded/uncontrolled write blast radius from a single bad row | Elevation of Privilege / Denial of Service (of data integrity) | D-06's per-row try/catch + log-and-continue is the mitigation — no row's failure can affect any other row's processing; backup-before-UPDATE (MEDIA-04) is the mitigation against an unrecoverable bad write |
| Non-interactive/CI invocation silently bypassing human approval | Tampering (of the approval gate itself) | `process.stdin.isTTY` check + hard-fail (Pattern 4) — this is the concrete mechanism satisfying Phase 3's Success Criterion #1 ("no code path from fetch/match output straight into merge") |

## Sources

### Primary (HIGH confidence)
- In-repo direct file reads: `scripts/exercise-import/lib/types.ts`, `lib/verify.ts`, `lib/report.ts`, `lib/matcher.ts`, `lib/supabase-client.ts`, `lib/paths.ts`, `check-report.ts`, `fetch.ts`, `README.md`, `types.test.ts` (dataset instructions/instruction_steps `en`/`fr` shape confirmed here)
- In-repo direct file reads: `supabase/migrations/001_initial_schema.sql`, `004_exercises_extended.sql`, `20260814_exercise_media_schema.sql`
- In-repo direct file reads: `backend/api/src/middleware/auth.ts` (admin/service-role client pattern), `backend/api/.env.example` (`SUPABASE_SERVICE_KEY` convention)
- `.planning/workstreams/image-exo/reports/match-report.json` — actual approved report, row shapes confirmed directly (`matched[0]`, `unmatched_new[0]`, category counts)
- `node_modules/@supabase/storage-js/src/lib/types.ts` — `FileOptions.upsert` confirmed directly against installed package source
- `slopcheck install sharp` — run live, `[OK]` result
- `npm view sharp version` — run live, confirms `0.35.3` current on registry (2026-08-15)

### Secondary (MEDIUM confidence)
- https://sharp.pixelplumbing.com/api-constructor — `animated: true` constructor option for reading all GIF frames (WebFetch, official docs)
- https://sharp.pixelplumbing.com/api-output — GIF output format support (WebSearch, cross-referenced against official docs page title/content)

### Tertiary (LOW confidence)
- Estimated per-row processing time (~1-2s) and total run duration (~20-45 min) — reasoned estimate, not benchmarked against the real dataset/network in this research pass (flagged as A2 in Assumptions Log)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — sharp/supabase-js/zod all directly verified in-repo or against installed package source; no speculative library choices
- Architecture: HIGH — every pattern derives directly from Phase 1/2's locked, already-implemented conventions (module system, path constants, RLS/service-role split, report schema) rather than novel invention
- Pitfalls: HIGH for schema/API-shape pitfalls (directly verified against code/package source); MEDIUM for the sharp animated-GIF pitfall (CITED, not independently reproduced with real dataset GIFs since `.dataset-cache/` is absent); LOW-confidence caveat on exact dataset `category` value coverage (Open Question #1)

**Research date:** 2026-08-15
**Valid until:** 30 days (stable stack, no fast-moving dependencies) — but re-verify `.dataset-cache/` presence and `report.dataset_commit` freshness at planning/execution time regardless, since that's a per-run check, not a research-validity window
