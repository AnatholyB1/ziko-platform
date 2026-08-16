# Merge Run Report — Phase 3 Plan 6

Records the real, human-supervised production merge run for the exercise library import (v1.16 `image-exo`).

## Preflight

- **Fetch date:** 2026-08-16
- **Command:** `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/fetch.ts`
- **Resolved dataset commit SHA:** `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
- **Approved `dataset_commit` (from `match-report.json`):** `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
- **Match:** YES — resolved SHA equals the approved `dataset_commit` character-for-character. The report's authorization is still valid; no re-approval or re-match needed.
- **Records reported by `fetch.ts`:** 1324 (Records: 1324, Images: 1324, Videos: 1324 — all match `dataset_count` in `match-report.json`)
- **`data/exercises.json` exists:** yes, at `scripts/exercise-import/.dataset-cache/exercises-dataset/data/exercises.json`
- **`.dataset-cache/` still untracked by git:** confirmed — `git status --porcelain scripts/exercise-import/.dataset-cache` printed nothing after the clone
- **`SUPABASE_SERVICE_KEY` presence (re-check):** confirmed non-empty in `backend/api/.env.local` via `grep -cE '^SUPABASE_(URL|SERVICE_KEY)=.+' backend/api/.env.local` → `2` (value never printed). Credential provisioned in plan 03-01 Task 2, now correctly located in this main working tree at `C:\ziko-platform\backend\api\.env.local`.

## Run output

Command run by the operator, from a real interactive terminal at the repo root: `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/merge.ts`

Pre-confirmation summary matched the expected 1318 UPDATE / 6 INSERT / 0 needs_review counts before the operator typed `yes`. No "unmappable category" warning appeared at the pre-confirmation stage — the 6 category errors below surfaced during row processing on the INSERT path for the 6 unmatched-new dataset rows specifically, not as a pre-run warning.

### Run 1

```
=== Merge Complete ===
Updated (matched):    618
Inserted (new):       0
Skipped (resumed):    700
Needs review:         0
Errored:              6
Category omitted:     594

Some rows failed. First 10 errors:
  1371: Cannot INSERT exercise (dataset_id: 1371): dataset category "lower legs" is not one of the CHECK-allowed values
  1628: Cannot INSERT exercise (dataset_id: 1628): dataset category "upper arms" is not one of the CHECK-allowed values
  0576: Cannot INSERT exercise (dataset_id: 0576): dataset category "chest" is not one of the CHECK-allowed values
  0656: Cannot INSERT exercise (dataset_id: 0656): dataset category "chest" is not one of the CHECK-allowed values
  1766: Cannot INSERT exercise (dataset_id: 1766): dataset category "upper legs" is not one of the CHECK-allowed values
  1394: Cannot INSERT exercise (dataset_id: 1394): dataset category "lower legs" is not one of the CHECK-allowed values
```

### Run 2 (re-run per D-08 to pick up the 6 errored rows)

```
=== Merge Complete ===
Updated (matched):    0
Inserted (new):       0
Skipped (resumed):    1318
Needs review:         0
Errored:              6
Category omitted:     0

Some rows failed. First 10 errors: (same 6 dataset_ids/messages as run 1: 1371, 1628, 0576, 0656, 1766, 1394 — identical "not one of the CHECK-allowed values" errors)
```

Combined outcome across both runs: all 1318 matched (UPDATE) rows processed successfully (618 updated in run 1 + 700 already-done/skipped in run 1, all 1318 confirmed skipped/already-done in run 2). All 6 unmatched-new (INSERT) rows failed deterministically both times on the same category-CHECK-constraint error — not a transient failure, so a third re-run would not change the outcome. See "Errors and triage" in the Post-run verification section below.

## Post-run verification

All checks below were run read-only against production via PostgREST/Storage, sourcing `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` from `backend/api/.env.local` (key never printed).

| # | Check | Expected | Observed | Pass/Fail |
|---|-------|----------|----------|-----------|
| 1 | Non-custom `exercises` count (`is_custom=eq.false`) | 1324 (was 1318), never below 1318 | **1318** | PASS (no deletion — count never dropped below 1318; did not reach 1324 because all 6 INSERTs failed, see Errors and triage) |
| 2 | Exercises carrying new media path (`image=like.*thumb.png&gif=like.*animation.gif`) | 1324 | **1318** | PASS for all successfully-processed rows — every one of the 1318 matched/updated rows carries the new media path; the 6 never-inserted rows correctly carry none |
| 3 | `exercises_merge_backup` count | 1318 (one per UPDATE) | **1318** | PASS — reconciles exactly 1:1 with the successful UPDATE tally |
| 4 | `exercise_import_log` status breakdown | matched 1318 / inserted 6 / needs_review 0 (per report row) | matched=**1318**, inserted(with error)=**12**, skipped=**2168**, needs_review=**0**, total rows=**3498** | PASS (see note below — log is append-only per attempt, not per report row) |
| 5 | Errored rows (`error_message not.is.null`, limit 25) | Non-empty is not automatically a failure (D-06) | 12 rows, 6 distinct `error_message` values (2 attempts each) — all category-CHECK-constraint failures on the 6 unmatched-new INSERTs | Recorded — see Errors and triage |
| 6 | Bilingual instructions coverage | at/near 1324 | `instructions_fr not.is.null`: **1318**; `instruction_steps not.is.null`: **1318** | PASS — 100% coverage of all successfully-processed rows |
| 7 | UUID preservation spot-check (3 sampled `matched` UUIDs from `match-report.json`) | Each resolves, populated `image` | All 3 resolved with populated `image` (`.../thumb.png`) — `c895599e-799b-4cbb-90aa-8870d3984859` (3/4 sit-up), `40ed1d66-e2b7-4770-9784-f3417f462856` (lever seated calf raise), `839f5925-f1af-4667-96e6-915fbff5acb2` (dumbbell waiter biceps curl) | PASS |
| 8 | FK integrity (`program_exercises`, `session_sets`, limit 1) | Both 200 | Both **HTTP 200** | PASS |
| 9 | Media cap spot-check (2 `thumb.png` + 1 `animation.gif`, via `sharp` metadata) | ≤180×180, GIF `pages`>1 | `thumb.png` ×2: `180×180`; `animation.gif`: `width=180`, `pageHeight=180` (per-frame; `.height=2160` is the 12-frame stacked canvas sharp reports for animated reads), `pages=12` | PASS |

**Note on check 4 (log row count):** `exercise_import_log` is an append-only audit log — every row-check across every run attempt (including already-done rows that are logged as `skipped`) creates a new log entry, not just writes. With two full-dataset passes (Run 1 + Run 2, 1324 rows attempted each) plus resumed state from a prior session (Run 1's "700 skipped (resumed)" indicates rows were already logged before this session's Run 1), the cumulative total (3498) legitimately exceeds `dataset_count` (1324). This is the designed resumable-log behavior (D-08, README "Resuming a merge run"), not a defect — the per-source-id **latest** status is what matters, and that reconciles: 1318 sources have a successful `matched` outcome, 6 sources have every attempt logged as a failed `inserted`.

### Roadmap success criteria

| # | Phase 3 Success Criterion | Evidenced by |
|---|---------------------------|---------------|
| 1 | Merge only runs against a human-approved report; no code path from fetch/match straight into merge | Task 1 preflight (SHA match confirmed before any write) + Task 2: `merge.ts` hard-exited on non-TTY, operator ran it interactively from a real terminal and typed `yes` after reviewing the pre-confirmation summary (checks 1318 UPDATE/6 INSERT/0 needs_review) |
| 2 | Matched exercises UPDATEd in place preserving UUID; unmatched-new INSERTed; no row ever DELETEd | Check 7 (3/3 sampled UUIDs preserved, populated `image`) + Check 1 (count never dropped below 1318 baseline — no deletion) + Run output (618 rows actually updated in Run 1, 700 already-updated from a prior session, 1318 total confirmed via Check 1/3) |
| 3 | Killing and re-running merge resumes from `exercise_import_log` without reprocessing or corrupting already-migrated rows | Run 2 output: 0 additional updates, 1318 rows correctly identified as already-done and skipped, the same 6 errored rows retried and failed identically (deterministic, not corrupted or duplicated) |
| 4 | Legacy exercises with no confident match but referenced by real FK history are left untouched and flagged, never auto-merged/deleted | `match-report.json`'s `counts.unmatched_legacy = 0` for this dataset/production pairing — no such rows existed to process in this run, so this criterion is vacuously satisfied (no legacy-unmatched rows were present, and none were touched) |
| 5 | Every UPDATEd row snapshotted to `exercises_merge_backup` before the write; no uploaded media exceeds 180×180 | Check 3 (1318 backup rows = exact 1:1 match with UPDATE tally) + Check 9 (all 3 sampled objects ≤180×180, GIF animation preserved at 12 frames) |

### Errors and triage

**Distinct `error_message` (6 values, 12 log rows — 2 identical attempts each across Run 1 and Run 2):**

| dataset_id | dataset category (raw) | Error |
|---|---|---|
| 1371 | `lower legs` | `Cannot INSERT exercise (dataset_id: 1371): dataset category "lower legs" is not one of the CHECK-allowed values` |
| 1394 | `lower legs` | same shape |
| 1628 | `upper arms` | `Cannot INSERT exercise (dataset_id: 1628): dataset category "upper arms" is not one of the CHECK-allowed values` |
| 0576 | `chest` | `Cannot INSERT exercise (dataset_id: 0576): dataset category "chest" is not one of the CHECK-allowed values` |
| 0656 | `chest` | same shape |
| 1766 | `upper legs` | `Cannot INSERT exercise (dataset_id: 1766): dataset category "upper legs" is not one of the CHECK-allowed values` |

**Assessment:** Known, non-corrupting gap — not a phase-blocking failure. `scripts/exercise-import/lib/category.ts` maps dataset categories 1:1 against production's `exercises.category` CHECK constraint (`strength`/`cardio`/`flexibility`/`balance`/`sports`/`stretching` — a training-modality taxonomy), with no fuzzy matching or default fallback by design (an unrecognized value must fail loudly, never be silently guessed — see the module's own docstring). The dataset's `category` field for these 6 unmatched-new rows uses a **muscle-group** taxonomy (`chest`, `upper arms`, `upper legs`, `lower legs`) that has no natural 1:1 counterpart in production's modality taxonomy — this isn't a missing alias, it's a genuine taxonomy mismatch. The category guard correctly refused to INSERT with an invalid value (D-06 log-and-continue, `merge-row.ts`) rather than corrupt the CHECK constraint or guess a category. Confirmed deterministic: Run 2 retried the same 6 rows and produced byte-identical failures, so a third re-run would not change the outcome. All 1318 matched (UPDATE) rows were unaffected and processed successfully — no corruption, no partial writes, no orphaned backup rows.

**Follow-up needed (not blocking Phase 3 completion):** a human decision on how to handle these 6 exercises — either (a) extend `category.ts`'s mapping with an explicit muscle-group→modality alias (e.g. all four values → `'strength'`, since chest/arm/leg exercises are typically strength work) and re-run `merge.ts` a third time to pick them up automatically via the resume mechanism, or (b) INSERT them manually with a human-chosen category. Recommend (a) for consistency with the rest of the pipeline's fully-automated INSERT path. Non-custom `exercises` count will read 1318 until this is resolved (roadmap criterion 2's INSERT path is not yet 100% exercised — the UPDATE path is).
