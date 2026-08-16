---
phase: 03-merge-human-approved-write
plan: 05
subsystem: database
tags: [supabase, cli-script, node, typescript, tty-gate, exercise-import, resumable-batch]

# Dependency graph
requires:
  - phase: 03-merge-human-approved-write plan 01
    provides: exercises_merge_backup table + instructions_fr/instruction_steps columns + exercise_import_log
  - phase: 03-merge-human-approved-write plan 02
    provides: lib/media.ts (capImage/capGif) + lib/retry.ts (withRetry)
  - phase: 03-merge-human-approved-write plan 03
    provides: lib/supabase-write-client.ts + lib/import-log.ts + lib/category.ts
  - phase: 03-merge-human-approved-write plan 04
    provides: lib/merge-row.ts (processRow — per-row upload/backup/UPDATE/INSERT unit of work)
provides:
  - scripts/exercise-import/merge.ts — the pipeline's sole write entrypoint, gated by a live TTY confirmation
  - Updated scripts/exercise-import/README.md documenting the three-stage pipeline
affects: [phase-3-plan-06-real-supervised-merge-run, phase-4-mobile-consumption]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "process.stdin.isTTY hard-exit as the literal first statement of main(), before assertRunFromRepoRoot/existsSync/spawnSync/DB calls — so the human-approval gate fires deterministically regardless of environment state (missing dataset cache, missing env vars, etc.)"
    - "Deterministic 4-category work-list assembly (matched -> unmatched_new -> unmatched_legacy -> ambiguous) with the needs_review branches exercised even at zero rows"
    - "Resume-state-driven skip: a 'done' row writes a fresh 'skipped' exercise_import_log row without calling processRow, keeping the log a complete per-run audit trail"

key-files:
  created:
    - scripts/exercise-import/merge.ts
  modified:
    - scripts/exercise-import/README.md

key-decisions:
  - "Combined the whole-report confirmation prompt with a resume-state summary (unprocessed/retry/skip counts) and the unmappable-category warning into one confirmOrExit() call, matching D-05's single-confirmation requirement"
  - "Docstring and comments describing the module-system constraint and the ON CONFLICT prohibition use indirect phrasing (matching lib/*.ts's existing convention) instead of literal `import.meta`/`__dirname`/`ON CONFLICT` substrings, to satisfy the plan's own grep-based negative acceptance criteria without weakening the explanatory comments"

patterns-established:
  - "TTY-gate-first main() ordering for any future human-approved-write CLI entrypoint in this monorepo"

requirements-completed: [IMPORT-03, IMPORT-04, IMPORT-05]

# Metrics
duration: 45min
completed: 2026-08-16
---

# Phase 3 Plan 05: merge.ts entrypoint — preflight, human gate, sequential row loop Summary

**`scripts/exercise-import/merge.ts` — the pipeline's one write-capable entrypoint, hard-gated by a `process.stdin.isTTY` check as the literal first statement of `main()`, running a sequential resumable per-row loop over all four match-report categories with a complete `exercise_import_log` audit trail.**

## Performance

- **Duration:** 45 min
- **Completed:** 2026-08-16T11:58:37Z
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `merge.ts` preflight parses the human-approved `match-report.json` strictly (`MatchReportSchema.parse`, never `safeParse`), hard-exits on a missing/stale dataset cache, and hard-exits on any `dataset_commit` mismatch between the cloned dataset and the approved report
- The interactive TTY confirmation gate (D-04/D-05) is the only path to any write: no `--yes`/`--force`/`--non-interactive` flag, no `process.argv` inspection, no environment-variable escape hatch — verified by piping empty stdin and asserting a non-zero exit with the correct "interactive terminal" message, even with `.dataset-cache/` absent
- The post-confirmation sequential loop (no `Promise.all`/concurrency) processes all four report categories (`matched`, `unmatched_new`, `unmatched_legacy`, `ambiguous`) in deterministic order, writes exactly one `exercise_import_log` row per row per run, and never invents a `'error'` status value
- README now documents the three-stage pipeline (`fetch.ts` → `match.ts` → `merge.ts`), the merge-only `SUPABASE_SERVICE_KEY` exception, the interactive-only invocation, and the `error_message`-based auto-retry resume behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: merge.ts preflight and the human approval gate** - `1048ad5` (feat)
2. **Task 2: merge.ts sequential row loop, audit log, and run summary** - `46165be` (feat)
3. **Task 3: Update the pipeline README for the three-stage pipeline** - `5efb256` (docs)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `scripts/exercise-import/merge.ts` (411 lines) - Merge entrypoint: TTY gate first, preflight (report parse, dataset-cache guard, commit-drift check, category preflight, resume-state read), whole-report confirmation, then the sequential row loop with injected `readMediaBytes` (path-contained via `resolveInsideRoot`), calling `processRow` per row and writing one `exercise_import_log` row per row per run
- `scripts/exercise-import/README.md` - Documents the three-stage pipeline, the per-script env-var split (`fetch.ts`/`match.ts` publishable-key-only vs. `merge.ts` service-role), the interactive-only invocation with no bypass flag, a new "Resuming a merge run" section, and the expanded Folder Layout listing `merge.ts` plus all six new `lib/` modules

## Decisions Made
- Split the single logical `merge.ts` file into two atomic commits (Task 1: preflight+gate ending `main()` right after `confirmOrExit()`; Task 2: extends `main()` with the post-confirmation loop) to honor per-task atomic commits even though both tasks target the same file — matches the plan's own Task 2 instruction ("Extend `main()` ... with the post-confirmation half")
- Rewrote two explanatory comments (module-system constraint docstring, resume-state comment) to avoid literal `import.meta`/`__dirname`/`ON CONFLICT` substrings after the negative grep acceptance criteria caught them as false positives — reworded using the same indirect phrasing already established across every other `lib/*.ts` file in this pipeline ("No CommonJS-directory-global / ESM-module-url-meta usage")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docstring/comment text tripped the plan's own negative grep checks**
- **Found during:** Task 1 verification (running the plan's acceptance-criteria greps against the freshly written file)
- **Issue:** The module docstring literally wrote out `import.meta.url` and `__dirname` while explaining the module-system constraint, and a resume-state comment literally wrote `ON CONFLICT (source_id)` while explaining why it must never be used — both are exactly the strings the acceptance criteria grep for absence of (`grep -c 'import.meta'`, `grep -c '__dirname'`, `grep -c 'ON CONFLICT'` must all return 0), producing false-positive matches on explanatory prose rather than actual usage
- **Fix:** Reworded both comments to use the indirect phrasing already established across every other `lib/*.ts` file in this pipeline ("No CommonJS-directory-global / ESM-module-url-meta usage here") and to describe the ON CONFLICT prohibition without the literal SQL fragment
- **Files modified:** scripts/exercise-import/merge.ts
- **Verification:** Re-ran all three greps (`import.meta`, `__dirname`, `ON CONFLICT`) — each now returns 0; re-ran the non-TTY refusal test to confirm behavior unchanged
- **Committed in:** 1048ad5 (Task 1 commit — fixed before the initial commit, not a follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug — grep-false-positive in documentation text, no behavioral change)
**Impact on plan:** Cosmetic-only fix caught during self-verification before commit; no scope creep, no functional change.

## Issues Encountered
- `backend/api/.env.local` does not exist in this worktree (gitignored, expected — no real Supabase credentials are provisioned here). Verified the `isTTY` guard and its exact error message by running `npx tsx scripts/exercise-import/merge.ts` (without `--env-file`) piped from empty stdin, confirming the guard fires before any env-var read — behavior is identical to the documented invocation since Step 0 runs before any env access either way.

## User Setup Required

None - no external service configuration required for this plan. A real supervised merge run (per 03-RESEARCH.md's Validation Architecture) still requires `SUPABASE_SERVICE_KEY` populated in `backend/api/.env.local` and a populated `.dataset-cache/` — that manual run is scheduled for a later plan in this phase (03-06), not this one.

## Next Phase Readiness
- `merge.ts` is complete, type-checks clean (`npx tsc --noEmit --strict`), and the full `npm run test:import` suite (151 tests, 12 files) passes unchanged
- Ready for 03-06 (or equivalent): the manually-supervised real merge run against the approved `match-report.json` with live Supabase credentials — that run is the first time this script's Storage/Postgres write paths are actually exercised end-to-end
- No blockers identified

---
*Phase: 03-merge-human-approved-write*
*Completed: 2026-08-16*

## Self-Check: PASSED

- FOUND: scripts/exercise-import/merge.ts
- FOUND: scripts/exercise-import/README.md
- FOUND: .planning/workstreams/image-exo/phases/03-merge-human-approved-write/03-05-SUMMARY.md
- FOUND commit: 1048ad5
- FOUND commit: 46165be
- FOUND commit: 5efb256
- FOUND commit: 42cd569
