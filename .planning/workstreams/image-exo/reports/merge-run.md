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

_Pending — Task 2 (supervised interactive merge run) has not yet been performed. This section will be filled in with the operator-pasted `=== Merge Complete ===` summary block(s) once Task 2 completes._

## Post-run verification

_Pending — to be completed in Task 3 after Task 2's run output is recorded._
