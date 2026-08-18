---
phase: 03-merge-human-approved-write
reviewed: 2026-08-17T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - scripts/exercise-import/README.md
  - scripts/exercise-import/lib/category.ts
  - scripts/exercise-import/lib/category.test.ts
  - scripts/exercise-import/lib/import-log.ts
  - scripts/exercise-import/lib/import-log.test.ts
  - scripts/exercise-import/lib/media.ts
  - scripts/exercise-import/lib/media.test.ts
  - scripts/exercise-import/lib/merge-row.ts
  - scripts/exercise-import/lib/merge-row.test.ts
  - scripts/exercise-import/lib/retry.ts
  - scripts/exercise-import/lib/retry.test.ts
  - scripts/exercise-import/lib/supabase-write-client.ts
  - scripts/exercise-import/lib/supabase-write-client.test.ts
  - scripts/exercise-import/merge.ts
  - supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This is the human-approved write stage of the exercise-import pipeline. The
core invariants the task asked me to scrutinize are mostly sound: the
service-role key is never logged/printed (`createWriteClient` only passes it
to `createClient`, and no call site interpolates it into an error or log
line), there is genuinely no DELETE call anywhere in `merge-row.ts` (backed
by an explicit `deleteSpy` test), production `name`/`name_fr` are never
included in an UPDATE payload, and the backup-row-before-UPDATE ordering for
matched rows is correctly implemented and tested (`select` → `insert` into
`exercises_merge_backup` → `update`, with a test proving a failed backup
insert leaves the UPDATE uncalled). The TTY gate is the very first statement
of `main()`, has no flag/env bypass, and is documented as load-bearing.

However, I found two BLOCKER-level correctness bugs that undermine the
pipeline's core promises, plus several robustness gaps:

1. `merge.ts` completely ignores the `human_decision` field on ambiguous
   rows — the exact mechanism `lib/types.ts` documents as "Phase 3 reads
   this field directly" — and instead routes every ambiguous row to
   `needs_review` unconditionally, silently discarding any human-approved
   `match`/`insert_new`/`skip` decision.
2. `buildExercisePayload` in `merge-row.ts` never writes the production
   `muscle_groups` column. The dataset's required `muscle_group` field is
   read into the parsed record but never used anywhere in the payload —
   confirmed by grep that `muscle_groups` is a live, actively-read/written
   column across mobile, backend coach, and web (`ExercisePicker.tsx`,
   `backend/api/src/coach/exercises/db.ts`, etc.), not a deprecated
   duplicate of `target_muscle`/`secondary_muscles`. Every `unmatched_new`
   INSERT therefore lands with `muscle_groups: '{}'` (the column's
   NOT NULL DEFAULT), and every `matched` UPDATE leaves the old value
   untouched despite this being documented as a "full-refresh" of exercise
   fields.

Both bugs happened to have limited real-world blast radius on the run that
already occurred (the report reportedly had zero `ambiguous` rows this
time, per `merge.ts`'s own comment), but bug #2 affects every row that went
through this pipeline and bug #1 is a latent trap for the next run of this
same script against a report that does contain ambiguous rows.

## Critical Issues

### CR-01: Human-approved decisions on ambiguous rows are silently discarded

**File:** `scripts/exercise-import/merge.ts:267-274`
**Issue:** `lib/types.ts`'s `HumanDecisionSchema`/`AmbiguousRowSchema` and its
own docstring in `lib/category.ts` ("Consumption contract for downstream
plans... plan 03-05's `merge.ts`...") establish that ambiguous rows carry an
operator-edited `human_decision` (`match` / `insert_new` / `skip`) that Phase
3 is supposed to act on. `merge.ts`'s work-item assembly for
`report.ambiguous` never reads `row.human_decision` at all:

```ts
...report.ambiguous.map(
  (row): WorkItem => ({
    kind: 'needs_review',
    sourceId: row.dataset_id,
    exerciseId: null,
    datasetRecord: null,
  }),
),
```

Every ambiguous row is hard-coded to `kind: 'needs_review'` regardless of
whether the human reviewer resolved it with `action: 'match'` (which should
UPDATE a specific `exercise_id`), `action: 'insert_new'` (which should
INSERT like an `unmatched_new` row), or `action: 'skip'` (distinct from "not
yet reviewed"). This means the entire ambiguous-row human-review workflow
(`stale_decision`, `HumanDecisionSchema`, D-10) is dead code from Phase 3's
perspective: an operator can carefully resolve every ambiguous row in the
JSON report and none of those resolutions will ever be applied. The current
production run was unaffected only because the approved report happened to
contain zero ambiguous rows; the very next run that has any will silently
drop every human decision.

**Fix:** Branch on `row.human_decision.action` when building the ambiguous
work items, mirroring the `matched`/`unmatched_new` construction above it:

```ts
...report.ambiguous.map((row): WorkItem => {
  const decision = row.human_decision;
  if (decision?.action === 'match') {
    return {
      kind: 'matched',
      sourceId: row.dataset_id,
      exerciseId: decision.exercise_id,
      datasetRecord: datasetById.get(row.dataset_id) ?? null,
    };
  }
  if (decision?.action === 'insert_new') {
    return {
      kind: 'unmatched_new',
      sourceId: row.dataset_id,
      exerciseId: null,
      datasetRecord: datasetById.get(row.dataset_id) ?? null,
    };
  }
  // decision is null or 'skip' — genuinely needs_review / explicitly skipped.
  return { kind: 'needs_review', sourceId: row.dataset_id, exerciseId: null, datasetRecord: null };
}),
```

### CR-02: `muscle_groups` is never written — silent data loss on every row

**File:** `scripts/exercise-import/lib/merge-row.ts:80-127` (`buildExercisePayload`)
**Issue:** The dataset schema (`lib/types.ts:48`) requires every record to
carry `muscle_group: z.string().min(1)`, and the merge-row test fixture
populates it (`merge-row.test.ts:28`, `muscle_group: 'chest'`). Nothing in
`buildExercisePayload` ever reads `record.muscle_group` or writes it to any
column. The payload only sets `body_part`, `equipment`, `target_muscle`,
`secondary_muscles`, `instructions*`, `image`/`gif`, and (conditionally)
`category` — `muscle_groups` (the plural, `TEXT[] NOT NULL DEFAULT '{}'`
column from `001_initial_schema.sql`) is absent from the "D-01 full-refresh
field list" entirely, with no comment explaining the omission (unlike the
deliberate, documented `name`/`name_fr` omission right below it).

I confirmed `muscle_groups` is a live, actively-consumed field — not a
column superseded by `target_muscle`/`secondary_muscles` — via:
`backend/api/src/coach/exercises/db.ts:50` (`.select('id, name,
muscle_groups, equipment, target_muscle')`, reading both), and
`apps/mobile/src/components/ExercisePicker.tsx` reading `muscle_groups`
independently for grouping.

Consequence:
- Every `unmatched_new` INSERT gets `muscle_groups: '{}'` (the column's
  NOT NULL default) — new exercises are permanently uncategorized by muscle
  group in every screen that groups/filters on it.
- Every `matched` UPDATE leaves the exercise's pre-existing `muscle_groups`
  value untouched, even though this pipeline is documented as a full
  refresh and the dataset's `muscle_group` value for that row is silently
  discarded after being parsed.

This already ran against production for ~1,324 rows; this is not a
theoretical risk.

**Fix:** Map the dataset's `muscle_group` into the production `muscle_groups`
array column (single-element array, or combined with `secondary_muscles` if
that is the intended semantic — needs a product decision, but *some*
non-empty mapping is required):

```ts
const payload: Record<string, unknown> = {
  body_part: record.body_part,
  equipment: record.equipment,
  target_muscle: record.target,
  muscle_groups: [record.muscle_group, ...record.secondary_muscles],
  secondary_muscles: record.secondary_muscles,
  instructions: record.instructions.en,
  instructions_fr: record.instructions.fr,
  instruction_steps: record.instruction_steps,
  image: paths.thumb,
  gif: paths.gif,
};
```

## Warnings

### WR-01: Import-log pagination has no `ORDER BY`, risking an incorrect resume map

**File:** `scripts/exercise-import/merge.ts:130-151` (`readAllImportLogRows`)
**Issue:** The paginated read of `exercise_import_log` uses
`.range(from, from + LOG_PAGE_SIZE - 1)` with no `.order(...)` clause.
PostgREST/Postgres do not guarantee stable row ordering across successive
`range()`-only queries without an explicit sort — rows can be skipped or
duplicated across page boundaries if the underlying scan order isn't fixed.
Because `buildResumeMap`/`reduceLatestBySourceId` depend on having *every*
row for a `source_id` to correctly compute the latest state, a page-boundary
inconsistency here can misclassify an errored row as `'done'` (silently
never retried) or vice versa. The design comment in `lib/import-log.ts`
explicitly relies on seeing every row ("the only safe way to determine
current state is to reduce over every row"), which this call site does not
guarantee.

**Fix:** Add a deterministic sort key to the query, e.g.:

```ts
const { data, error } = await client
  .from('exercise_import_log')
  .select('source_id, exercise_id, status, error_message, processed_at')
  .order('processed_at', { ascending: true })
  .range(from, from + LOG_PAGE_SIZE - 1);
```

(or order by a primary key / `id` column if one exists, which is more
robust than `processed_at` in the presence of ties).

### WR-02: Storage is mutated before the DB backup snapshot, and audit-log inserts in `main()` aren't retried

**File:** `scripts/exercise-import/lib/merge-row.ts:184-222`,
`scripts/exercise-import/merge.ts:329-336`, `357-362`
**Issue:** Two related robustness gaps around the write ordering this review
was specifically asked to scrutinize:

1. In `processRow`, for a `matched` row, both Storage uploads (thumb + gif,
   step 3) happen *before* the `exercises_merge_backup` snapshot and the
   `exercises` UPDATE (steps 4-5). The documented and tested guarantee
   (MEDIA-04) is scoped to "backup precedes UPDATE," which is correctly
   implemented — but if the backup insert or UPDATE subsequently fails, the
   Storage objects at `${exerciseId}/thumb.png` and
   `${exerciseId}/animation.gif` have already been overwritten with the new
   capped media while the DB row (and its would-be backup) still reflect
   the pre-merge state. The row is correctly marked as errored and retried
   next run, but between the failed run and the successful retry, Storage
   and the DB are out of sync for that exercise with no backup of the
   previous media bytes ever taken (only the DB row's `image`/`gif` *path
   strings* are backed up, not the bytes at those paths).
2. In `merge.ts`'s main loop, the `exercise_import_log` insert calls (both
   the "already done → write skip marker" branch and the post-`processRow`
   branch) are awaited directly with only an `if (logError)` check on the
   Supabase-returned `{ error }` field — they are not wrapped in
   `withRetry` and have no `try/catch`. `lib/retry.ts` exists specifically
   for "transient network-class failures... around Storage uploads and
   Supabase writes," and an audit-log insert is exactly that class of
   write. If the underlying `fetch` call itself rejects (rather than
   resolving with `{ error }`) due to a transient network blip, that
   rejection is unhandled inside the loop and will propagate out of
   `main()`, aborting the entire remaining run (all ~1,300 rows) instead of
   just that one log write.

**Fix:** For (1), consider reordering so uploads happen after the backup
snapshot is confirmed (or accept the current ordering but document the
Storage/DB inconsistency window explicitly, since restoring bytes isn't in
scope this phase anyway). For (2), wrap the `exercise_import_log` inserts in
`withRetry` (or at minimum a `try/catch` that logs and continues) so a
single transient log-write failure can't take down the whole run:

```ts
try {
  const { error: logError } = await withRetry(() =>
    client.from('exercise_import_log').insert({ ... }),
  );
  if (logError) console.error(`Failed to write log row for ${result.sourceId}: ${logError.message}`);
} catch (err) {
  console.error(`Failed to write log row for ${result.sourceId} after retries:`, err);
}
```

### WR-03: `instructions`/`instruction_steps` schema doesn't guarantee `en`/`fr` keys, but `buildExercisePayload` assumes them

**File:** `scripts/exercise-import/lib/types.ts:46-47`,
`scripts/exercise-import/lib/merge-row.ts:96-97`
**Issue:** `DatasetExerciseSchema` types `instructions` as
`z.record(z.string(), z.string())` and `instruction_steps` as
`z.record(z.string(), z.array(z.string()))` — a generic string-keyed
record with no guarantee that `'en'`/`'fr'` keys are present.
`buildExercisePayload` unconditionally reads `record.instructions.en` and
`record.instructions.fr`. If a dataset record's `instructions` object were
missing either key, the corresponding payload value would be `undefined`,
which `JSON.stringify` (used internally by the Supabase client) drops
silently rather than sending `null` — so the column would simply be left
unwritten (unchanged on UPDATE, defaulted on INSERT) with no error, log
line, or `categoryOmitted`-style flag surfacing it. This is inconsistent
with the codebase's stated philosophy elsewhere ("An unmappable value is
deliberately NOT coerced to a default — silently relabelling... would
corrupt the library more quietly than failing the row," `category.ts:10-12`).
In practice this is likely mitigated by `fetch.ts`'s manifest verification
against `exercises.schema.json`, but that file is outside this review's
scope and `merge-row.ts` itself has no defensive check.

**Fix:** Either tighten `DatasetExerciseSchema` to require an explicit
`{ en: z.string(), fr: z.string() }` shape for `instructions` (and similarly
for `instruction_steps`), or add an explicit guard in `buildExercisePayload`
that throws (matching the `category` guard's pattern) when `en`/`fr` are
missing, rather than silently omitting the column.

### WR-04: `main().catch()` prints the raw thrown error, which could include a PostgREST/undici error object of unbounded shape

**File:** `scripts/exercise-import/merge.ts:408-411`
**Issue:** The top-level handler does `console.error(err)` for any uncaught
error, including errors thrown from `readFileSync`, `JSON.parse`,
`MatchReportSchema.parse`, or a rejected Supabase call that bypasses the
`{ error }` return convention (see WR-02 item 2). None of the reviewed code
paths interpolate the service-role key into an `Error` message, so this is
not a confirmed key leak, but there is also no explicit redaction/allowlist
at this final catch-all boundary — a future change that throws an error
carrying request metadata (e.g., a raw `fetch` `Response`/`Request` object
attached to an error, which some HTTP client libraries do) could end up
printed to stdout/CI logs without anyone noticing the change violated the
"never logged" invariant. Given how load-bearing this invariant is called
out to be in `README.md` and `supabase-write-client.ts`, a defensive
boundary here (rather than relying on every intermediate call site staying
disciplined forever) would be safer.

**Fix:** At minimum, add a comment at this catch-all documenting the
invariant it must preserve, or scrub known-sensitive fields explicitly:

```ts
main().catch((err) => {
  // Never let this print anything that could carry SUPABASE_SERVICE_KEY —
  // errors are expected to be Error/PostgrestError instances only.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

## Info

### IN-01: `mapDatasetCategory` is computed twice per matched row

**File:** `scripts/exercise-import/lib/merge-row.ts:103` and `:215`
**Issue:** `processRow` calls `mapDatasetCategory(record.category)` once
inside `buildExercisePayload` (to decide whether to include `category` in
the payload) and again immediately before/after to compute
`categoryOmitted`. Both calls are pure and cheap, so this isn't a
correctness issue, just avoidable duplication.
**Fix:** Have `buildExercisePayload` optionally return whether it omitted
`category`, or compute `categoryOmitted` once and pass the mapped value
into `buildExercisePayload` instead of recomputing it.

### IN-02: `collectUnmappableCategories` groups by raw, case-sensitive string

**File:** `scripts/exercise-import/lib/category.ts:59-77`
**Issue:** `idsByValue.get(record.category)` keys the grouping map by the
raw (non-normalized) category string. Two dataset rows with `"Plyometrics"`
and `"plyometrics"` — both unmappable, and `mapDatasetCategory` would treat
them identically (it lowercases before comparing against
`ALLOWED_CATEGORIES`) — will appear as two separate entries in the
pre-confirmation summary the operator reads, rather than one combined entry.
Purely a readability nit for the human-facing summary; does not affect
correctness of the per-row guard.
**Fix:** Group by `mapDatasetCategory`-style normalization
(`record.category.trim().toLowerCase()`) while still displaying one
representative raw value, if de-duplicating the operator-facing summary
matters.

---

_Reviewed: 2026-08-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
