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

_Pending — Task 3._
