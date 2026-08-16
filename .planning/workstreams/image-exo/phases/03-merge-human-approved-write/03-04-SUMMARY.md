---
phase: 03-merge-human-approved-write
plan: 04
subsystem: database
tags: [supabase, storage, vitest, exercise-import, sharp]

# Dependency graph
requires:
  - phase: 03-merge-human-approved-write (plan 02)
    provides: lib/media.ts (capImage/capGif), lib/retry.ts (withRetry)
  - phase: 03-merge-human-approved-write (plan 03)
    provides: lib/supabase-write-client.ts, lib/import-log.ts, lib/category.ts (mapDatasetCategory)
provides:
  - lib/merge-row.ts — the per-row unit of work merge.ts (plan 03-05) will call 1,324 times
  - processRow(input, deps) — ordered matched/unmatched_new/needs_review flow with never-rethrow error containment
  - buildExercisePayload(record, exerciseId, opts) — D-01 full-refresh field map, D-02 name/name_fr exclusion
  - storagePaths(exerciseId) — folder-per-exercise_id object key derivation
affects: [03-05-merge-entrypoint, 03-06-supervised-run]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-client testable-with-a-stub convention (mirrors lib/supabase-client.ts, not lib/report.ts's pure-function rule)"
    - "Call-recording stub client (calls: string[]) to assert relative ORDER via indexOf(...) < indexOf(...), not just call presence"
    - "processRow never rethrows — every failure resolves to a MergeRowResult with a CHECK-legal status and bounded errorMessage"

key-files:
  created:
    - scripts/exercise-import/lib/merge-row.ts
    - scripts/exercise-import/lib/merge-row.test.ts
  modified: []

key-decisions:
  - "Backup insert (exercises_merge_backup) issued before the UPDATE with no withRetry wrapper — matches the plan's explicit ordered flow, where only uploads and the final write are retry-wrapped"
  - "categoryOmitted computed via a direct mapDatasetCategory(record.category) === null check in processRow, separate from buildExercisePayload's internal re-check, since the MergeRowResult shape has no room to thread that flag back through buildExercisePayload's Record<string, unknown> return type"
  - "Docstring/comments deliberately avoid the literal substrings 'process.env', 'import.meta.url', '__dirname', and 'exercise_import_log' even in prose, since the plan's acceptance criteria grep for forbidden-pattern absence does not specify a comment-stripping filter for those four checks (unlike the delete/name_fr checks, which explicitly do)"

patterns-established:
  - "MergeRowDeps injection point for readMediaBytes/capImage/capGif/withRetry/newId — merge.ts (plan 03-05) supplies all I/O-touching implementations, keeping merge-row.ts a pure-injection-based unit"

requirements-completed: [IMPORT-03, IMPORT-05, MEDIA-03, MEDIA-04]

# Metrics
duration: 45min
completed: 2026-08-16
---

# Phase 03 Plan 04: Merge Row Unit of Work Summary

**`lib/merge-row.ts` — the ordered per-row processor (cap+upload media, snapshot-then-UPDATE, classified outcome) that `merge.ts` will run 1,324 times, proven against a call-recording stub client that asserts operation ORDER, not just presence**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-16T11:15:00Z
- **Completed:** 2026-08-16T11:40:16Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `processRow` implements the full ordered flow for matched/unmatched_new rows (read media → cap → upload thumb → upload gif → [matched: select+backup] → write) and routes needs_review rows away from Storage/`public.exercises` entirely (IMPORT-05)
- `buildExercisePayload` enforces D-01 (full-refresh field list) and D-02 (name/name_fr never written on UPDATE), with a category guard that omits the key on UPDATE but fails the row loudly on INSERT (NOT NULL column, no fallback)
- Backup-before-UPDATE ordering (MEDIA-04) is structurally impossible to violate — the backup insert is unconditionally awaited and thrown-on-error before the UPDATE call is ever reached — and this is proven with an `indexOf(...) < indexOf(...)` assertion against the recorded call sequence, not just a code-review claim
- 17 tests across 9 requirement-grouped `describe` blocks (IMPORT-03 ×3, IMPORT-05, MEDIA-04 ×2, MEDIA-03, D-06 ×4, category guard ×2, FK safety, bucket-name sanity) — every failure-injection scenario (media read, storage upload, backup insert, exercises write) asserts `processRow` resolves, never rejects, with a status that is never the non-existent `'error'` value

## Task Commits

Each task was committed atomically:

1. **Task 1: Build lib/merge-row.ts** - `089f7dc` (feat)
2. **Task 2: Prove the ordering and isolation guarantees in merge-row.test.ts** - `0a410bd` (test)

**Plan metadata:** pending (docs: complete plan — added by orchestrator after wave merge)

## Files Created/Modified
- `scripts/exercise-import/lib/merge-row.ts` - Per-row unit of work: `EXERCISE_MEDIA_BUCKET`, `storagePaths`, `buildExercisePayload`, `processRow` (260 lines)
- `scripts/exercise-import/lib/merge-row.test.ts` - Call-recording stub client + 17 tests grouped by requirement (458 lines)

## Decisions Made
- Backup select+insert steps are NOT wrapped in `withRetry` — only Storage uploads and the final exercises write are, per the plan's explicit step-by-step ordering (a vanished/already-mutated row during backup is a terminal condition, not a transient one worth retrying)
- `categoryOmitted` is computed via an independent `mapDatasetCategory` call in `processRow` rather than threading it out of `buildExercisePayload`'s return value, since the interface contract fixes `buildExercisePayload`'s return type to `Record<string, unknown>`
- Rewrote docstring/comment prose to avoid the literal substrings `process.env`, `import.meta.url`, `__dirname`, and `exercise_import_log` (using paraphrases like "any environment variables", "the import log table") after the first draft's explanatory comments accidentally contained those forbidden-pattern substrings — the plan's grep-based acceptance criteria for those four checks has no comment-stripping filter, unlike the delete/name_fr checks which do

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was rewording comments (see Decisions above) to keep the file grep-clean against the plan's literal acceptance-criteria patterns; this did not change any behavior, only prose.

## Issues Encountered
None. Both tasks passed type-checking, the full `npm run test:import` suite (151/151), and every grep-based acceptance check on the first corrected attempt.

## User Setup Required

None - no external service configuration required. This plan builds a pure, injected-client module with no environment-variable reads and no live Supabase credentials touched during testing.

## Next Phase Readiness
- `lib/merge-row.ts` exports exactly the interface plan 03-05's `merge.ts` consumes (`processRow`, `buildExercisePayload`, `storagePaths`, `EXERCISE_MEDIA_BUCKET`) — ready to be wired into the sequential resumable loop
- No blockers. `merge.ts` (03-05) still owns: report parsing, `dataset_commit` verification, resume-state computation, the interactive confirmation gate, per-row dispatch across all four report categories, and `exercise_import_log` writes (deliberately NOT owned by `merge-row.ts`, so log-write ordering stays observable in `merge.ts`)

---
*Phase: 03-merge-human-approved-write*
*Completed: 2026-08-16*
