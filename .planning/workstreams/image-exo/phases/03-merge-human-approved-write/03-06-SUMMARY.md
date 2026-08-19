---
phase: 03-merge-human-approved-write
plan: 06
subsystem: database
tags: [supabase, postgres, storage, exercise-library, merge, production]

# Dependency graph
requires:
  - phase: 03-merge-human-approved-write (03-01, 03-05)
    provides: "exercises_merge_backup table + i18n columns (03-01), merge.ts entrypoint with TTY-only approval gate (03-05)"
provides:
  - "Live production merge of the approved exercise library import — 1318/1318 matched exercises UPDATEd in place with new media paths and bilingual instructions, backed up 1:1 to exercises_merge_backup"
  - "merge-run.md — Preflight, Run output (2 operator-run summaries), Post-run verification (9 live checks), Roadmap success criteria mapping, Errors and triage"
  - "Identified follow-up: 6 unmatched-new exercises blocked on a genuine dataset-category (muscle-group) vs production-category (training-modality) taxonomy mismatch, not yet resolved"
affects: ["04-mobile-consumption-attribution — depends on real production media/instructions now being live"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only exercise_import_log across resumed runs — per-attempt logging (including skips), not per-report-row; verification must reconcile on latest-status-per-source-id, not raw row count"

key-files:
  created: []
  modified:
    - .planning/workstreams/image-exo/reports/merge-run.md

key-decisions:
  - "6 unmatched-new INSERTs left unresolved rather than force-mapped — category.ts deliberately has no fuzzy/default fallback (an unrecognized value must fail loudly, never be silently guessed); recommended follow-up is an explicit muscle-group-to-modality alias addition, not an executor-side workaround"

patterns-established: []

requirements-completed: [IMPORT-03, IMPORT-04, MEDIA-03, MEDIA-04]

# Metrics
duration: ~2h (across two human-action checkpoint round-trips — env-file path correction, then the ~30min supervised merge run itself)
completed: 2026-08-16
---

# Phase 3 Plan 6: Real Human-Supervised Merge Run Summary

**Ran the approved exercise-library merge against production for real — 1318/1318 matched exercises UPDATEd in place with new media paths, bilingual instructions, and 1:1 backup snapshots; 6 unmatched-new INSERTs deterministically blocked on a dataset-category taxonomy mismatch, logged and left for follow-up.**

## Performance

- **Duration:** ~2h total, spanning two human-action checkpoint round-trips (an env-file path mistake needed correcting before Task 1 could even run `fetch.ts`, then the ~20-45 min supervised `merge.ts` run itself across two operator invocations)
- **Started:** 2026-08-16 (Task 1)
- **Completed:** 2026-08-16 (Task 3 verification)
- **Tasks:** 3 of 3 completed
- **Files modified:** 1 (`merge-run.md`, built up across all three tasks)

## Accomplishments
- Restored the dataset clone via `fetch.ts` and verified the resolved commit SHA (`7455efae41b330c265e7cd4b78dfa848e7ce5ebd`) matches the approved `match-report.json`'s `dataset_commit` exactly — the report's authorization stayed valid, no re-approval needed
- Operator ran `merge.ts` interactively from a real terminal, reviewed the pre-confirmation summary (1318 UPDATE / 6 INSERT / 0 needs_review), and typed `yes` — the TTY-only gate (03-05) worked as designed, no bypass attempted
- All 1318 matched exercises UPDATEd in place with preserved UUIDs, new `image`/`gif` Storage paths, and bilingual `instructions_fr`/`instruction_steps` — confirmed via 9 live PostgREST/Storage checks (exercises count, media-path coverage, backup reconciliation, UUID spot-check, FK integrity, media-cap spot-check)
- Resumability proven live: a second `merge.ts` run correctly skipped all 1318 already-done rows and retried the 6 errored rows, producing byte-identical failures (deterministic, no reprocessing or corruption)
- `exercises_merge_backup` reconciles exactly 1:1 with the UPDATE tally (1318 = 1318); sampled media objects confirmed at or under the 180×180 cap with GIF animation intact (12 frames)
- All 5 Phase 3 roadmap success criteria mapped to specific verification evidence in `merge-run.md`

## Task Commits

Each task was committed atomically:

1. **Task 1: Restore the dataset clone at the approved commit** - `8f5fc93` (feat)
2. **[BLOCKING] Task 2: Supervised interactive merge run against production** - COMPLETED via operator action (ran `merge.ts` twice from a real terminal; summaries recorded in `8f2951a`) — no code commit for the merge action itself, run output committed separately
3. **Task 2 run output recording** - `8f2951a` (docs)
4. **Task 3: Verify the production result and record the run** - `ebaff2a` (docs)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `.planning/workstreams/image-exo/reports/merge-run.md` - Preflight (SHA match, credential re-check), Run output (2 verbatim operator summaries), Post-run verification (9-check table), Roadmap success criteria mapping, Errors and triage

## Decisions Made
- Did not attempt to auto-fix or work around the 6 category-mapping failures — `category.ts`'s no-fallback design is intentional (silently guessing a category would corrupt data more quietly than failing the row), so this was documented as a follow-up decision for a human, not treated as a Rule 1/2/3 auto-fix
- Verification check 4 (`exercise_import_log` row count) initially looked inconsistent with the two reported run summaries (3498 total rows vs. 2×1324 expected); investigated and determined the log is genuinely append-only per attempt (including skips) across possibly more than the two runs reported to this session — reconciled on latest-status-per-source-id instead of raw row count, and documented the reasoning inline rather than treating it as an anomaly

## Deviations from Plan

None — plan executed exactly as written. Task 2 was correctly handed off to the operator and not attempted from the agent shell.

**Process note (not a plan deviation):** an early attempt to resume Task 1 was blocked because `backend/api/.env.local` was completely absent from the main working tree — the credential provisioned in plan 03-01 lived only inside that plan's isolated worktree, and gitignored files don't propagate across worktrees or to the main checkout. This was raised as a human-action checkpoint; the team lead traced it to their own earlier `cd backend/api` leaving a stale shell state that caused the file to be copied to the wrong nested path (`backend/api/backend/api/.env.local`) and their verification grep to check that same wrong path. Once corrected to the right location, Task 1 proceeded normally with no further issues.

## Issues Encountered
- Node's `--env-file` flag hard-fails (rather than warning) when the target file doesn't exist at all, which is what surfaced the misplaced-credential issue immediately rather than silently — `fetch.ts` itself makes zero Supabase calls but still couldn't run without the file present at the exact invoked path.
- `node scripts/exercise-import/.tmp-media-check.js` needed to be written and run from the repo root (not the scratchpad temp directory) so Node could resolve the root `node_modules/sharp` — the scratchpad directory has no `node_modules`. Temp script was deleted immediately after use; nothing was committed.

## User Setup Required

None beyond what Task 2 already required and the operator already completed: the operator ran `merge.ts` interactively twice from a real terminal at the repo root and pasted back both `=== Merge Complete ===` summaries.

## Next Phase Readiness
- Production `public.exercises` now serves real Storage-hosted media (`{exercise_id}/thumb.png`, `{exercise_id}/animation.gif`) and bilingual instructions for all 1318 matched exercises — Phase 4 (Mobile Consumption & Attribution) can build against real URLs
- `exercises_merge_backup` and `exercise_import_log` are populated and reconciled — rollback/audit data exists if needed
- **Open follow-up (non-blocking for Phase 3 completion, but tracked):** 6 unmatched-new exercises (dataset ids 1371, 1394, 1628, 1766, 0576, 0656) remain un-inserted — their dataset `category` values (`lower legs`, `upper arms`, `chest`, `upper legs`) don't map onto production's training-modality CHECK constraint. A human decision is needed: extend `lib/category.ts` with an explicit muscle-group→modality alias (recommended: all four → `'strength'`) and re-run `merge.ts` a third time (resume mechanism will pick up just these 6 rows automatically), or INSERT them manually. Non-custom `exercises` count will read 1318 (not 1324) until this is resolved.
- Phase 3's roadmap checkbox can be marked complete — all 5 success criteria are evidenced in `merge-run.md`, and the plan's own scope never required 100% of unmatched-new rows to succeed (D-06 log-and-continue is the designed behavior for exactly this scenario)

---
*Phase: 03-merge-human-approved-write*
*Completed: 2026-08-16*
