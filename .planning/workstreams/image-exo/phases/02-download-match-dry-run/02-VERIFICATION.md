---
phase: 02-download-match-dry-run
verified: 2026-08-15T14:15:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 2: Download & Match (Dry-Run) Verification Report

**Phase Goal:** A human reviewer can see exactly which exercises will be updated, added, or need manual attention — before any database write happens.
**Verified:** 2026-08-15T14:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fetch clones `hasaneyldrm/exercises-dataset` via `git clone --depth 1` and verifies file count against the dataset's own manifest (exercises.json), failing loudly on mismatch (Roadmap SC #1, IMPORT-01) | ✓ VERIFIED | `scripts/exercise-import/fetch.ts` uses `spawnSync('git', ['clone', '--depth', '1', ...])` (argv form, no shell interpolation), calls `verifyDataset()` and `process.exit(1)` with itemized mismatch reasons on failure. `lib/verify.ts` has 12 passing unit tests covering count mismatch, missing media, path-traversal escape, duplicate ids, schema drift. Real run recorded `dataset_commit=7455efae41b330c265e7cd4b78dfa848e7ce5ebd` with 1,324/1,324/1,324 records/images/videos verified. |
| 2 | Match step against production produces a written report categorizing every dataset exercise as matched / unmatched-legacy / unmatched-new / ambiguous via a 3-tier precision-first matcher (Roadmap SC #2, IMPORT-02) | ✓ VERIFIED | `scripts/exercise-import/lib/matcher.ts` `categorizeAll()` implements Tier 1 (exact name/name_fr) → Tier 2 (fuzzy ≥0.87) → Tier 3 (attribute overlap, never `matched`). Real artifact `.planning/workstreams/image-exo/reports/match-report.json` (468KB, git-tracked) + `match-report.md` (human-readable, 76 lines) exist with real counts: matched 1318, unmatched_new 6, unmatched_legacy 0, ambiguous 0, summing to `dataset_count` 1324. 30 matcher unit tests pass. |
| 3 | The match report explicitly excludes `is_custom=true` exercises and all `coach_exercises` rows from matching consideration (Roadmap SC #3) | ✓ VERIFIED | `lib/supabase-client.ts` line 66: `.eq('is_custom', false)`. `grep -rn coach_exercises scripts/exercise-import/ --include=*.ts` returns matches **only** inside `supabase-client.test.ts` asserting `.from` is never called with `'coach_exercises'` — the table is never queried by any production code path (structural exclusion by absence, not just a filter). |
| 4 | Zero rows are written to Supabase (Postgres or Storage) at any point during fetch or match — dry-run only (Roadmap SC #4) | ✓ VERIFIED | `grep -rnE "\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|\.storage\." scripts/exercise-import/ --include=*.ts` (excluding `*.test.ts`) returns **zero matches** across the entire pipeline. `supabase-client.test.ts` asserts none of insert/update/upsert/delete/rpc are ever invoked on the stub client. `fetch.ts` never imports `@supabase/supabase-js`. Human approval checkpoint (02-06 Task 3) independently re-verified via Supabase REST API: `exercises`=1318 (unchanged), `exercise_import_log`=0, `coach_exercises`=0, all matching pre-run expectations. |
| 5 | A real match report generated from the real upstream dataset and real production data exists in the repo, human-approved (IMPORT-02) | ✓ VERIFIED | `match-report.json`/`match-report.md` are git-tracked (`git ls-files` confirms), working tree clean for both files. 02-06-SUMMARY.md documents explicit "approved" response from the developer at the Task 3 checkpoint gate, with independently-verified zero-write row counts. |
| 6 | CR-01 data-integrity bug (matched/ambiguous-candidate `exercise_id` overlap, found during code review) is actually fixed in `matcher.ts`, not just claimed in REVIEW-FIX.md | ✓ VERIFIED | Read `lib/matcher.ts` lines 280-445 directly: all three ambiguous branches (Tier 1 name-collision, Tier 2 multi-candidate, Tier 3 attribute-overlap) now call `consumed.add(candidate.exercise_id)` at push time, establishing `matched ∩ ambiguous[].candidates === ∅` by construction. Regression test `matcher.test.ts:423` ("Regression (CR-01, 02-REVIEW.md)...") reproduces the exact duplicate-name double-claim scenario and asserts the invariant holds. Commit `95843d3` exists in `git log`. Independently confirmed on the real report: `new Set(matched.map(m=>m.exercise_id)).size === 1318 === matched.length` (no duplicates). |
| 7 | A developer can run the exercise-import test suite from the repo root with a single command and it exits 0 | ✓ VERIFIED | `npx vitest run scripts/exercise-import` executed live during this verification: 6 test files, 90 tests, all passed (0 failures). `npm run test:import` script wired in root `package.json`. |
| 8 | The Tier 2 threshold decision is evidence-based, and the structural checker (`check-report.ts`) validates the real report | ✓ VERIFIED | `npx tsx scripts/exercise-import/lib/check-report.ts` executed live: `OK — ... passes all structural checks`, exit 0. 02-06-SUMMARY.md documents the real run produced zero tier2/tier3 matches, so `TIER2_THRESHOLD=0.87` was kept unchanged with recorded rationale (no false positives to raise against, no rescue candidates below threshold). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/exercise-import/fetch.ts` | Clone-or-reuse entrypoint, hard-exits on verification failure | ✓ VERIFIED | 116 lines, `--depth 1`, `--refetch` flag, `assertRunFromRepoRoot()`, no Supabase imports |
| `scripts/exercise-import/lib/verify.ts` | Pure manifest verification | ✓ VERIFIED | `resolveInsideRoot`, `loadDatasetJson`, `verifyDataset` exported; 12 passing tests incl. path-traversal fixture |
| `scripts/exercise-import/lib/matcher.ts` | 3-tier precision-first matcher | ✓ VERIFIED | `buildNameIndex`, `findDuplicateNames`, `tier1Match`, `tier2Match`, `tier3Candidates`, `categorizeAll` all exported and pure (no `createClient`/`fs`/`process.env`); CR-01 reservation fix present in all 3 tiers |
| `scripts/exercise-import/lib/report.ts` | Report assembly + Markdown rendering | ✓ VERIFIED | `buildReport`, `mergePriorHumanDecisions`, `renderMarkdown` exported; WR-03 sort fix present |
| `scripts/exercise-import/match.ts` | Match entrypoint | ✓ VERIFIED | 6200 bytes, `fetchAllProductionExercises`, `REPORT_JSON_PATH`/`REPORT_MD_PATH`, `DRY RUN` line present, no write-method call sites; WR-02 schema-validation fix present |
| `scripts/exercise-import/lib/check-report.ts` | Repeatable structural sanity checker | ✓ VERIFIED | `checkReport` exported; executed live against the real report, exits 0; WR-01 matched-vs-ambiguous-candidate overlap check present |
| `.planning/workstreams/image-exo/reports/match-report.json` | Real, human-approved dry-run output | ✓ VERIFIED | 468,506 bytes, git-tracked, `dataset_commit` present, schema-valid (passes `checkReport`), matched=1318/unmatched_new=6/unmatched_legacy=0/ambiguous=0 summing correctly |
| `.planning/workstreams/image-exo/reports/match-report.md` | Human-reviewable summary | ✓ VERIFIED | 76 lines, git-tracked, counts table, data-quality warnings (11 duplicate name_fr groups), "How to approve" section |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `fetch.ts` | `lib/verify.ts` | `verifyDataset()` call before success | ✓ WIRED | Called at fetch.ts:92, exits non-zero on non-empty mismatch array |
| `fetch.ts` | `git clone --depth 1` | `child_process.spawnSync` | ✓ WIRED | Argv-array form, no `shell: true`, no `execSync` |
| `match.ts` | `lib/supabase-client.ts` | `fetchAllProductionExercises` | ✓ WIRED | `is_custom=false` filter applied, paginated, `coach_exercises` never referenced |
| `match.ts` | `match-report.json` | `writeFileSync` at `REPORT_JSON_PATH` | ✓ WIRED | Fixed path, D-08 overwrite-on-rerun confirmed (re-runs differ only by `generated_at` per 02-06-SUMMARY.md) |
| `lib/matcher.ts` | `lib/normalize.ts` | `TIER2_THRESHOLD` import (not re-literalled) | ✓ WIRED | `grep -c "0.87" matcher.ts` = 0, threshold imported from single source of truth |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite exits 0 | `npx vitest run scripts/exercise-import` | 6 files, 90 tests, all passed | ✓ PASS |
| Structural checker validates the real committed report | `npx tsx scripts/exercise-import/lib/check-report.ts` | `OK — ... passes all structural checks`, exit 0 | ✓ PASS |
| Zero write-method call sites exist anywhere in the pipeline | `grep -rnE "\.insert\(\|\.update\(\|\.upsert\(\|\.delete\(\|\.rpc\(\|\.storage\." scripts/exercise-import/ --include=*.ts` (excl. tests) | No matches | ✓ PASS |
| `coach_exercises` never queried in production code | `grep -rn coach_exercises scripts/exercise-import/ --include=*.ts` | Matches only inside `supabase-client.test.ts` assertions | ✓ PASS |
| No duplicate `exercise_id` in the real `matched` array | `node -e "..."` against `match-report.json` | `matched.length === 1318`, `new Set(...).size === 1318` | ✓ PASS |
| Commits referenced in SUMMARY/REVIEW-FIX actually exist | `git log --oneline --all \| grep -E "73c91cf\|7c79fc0\|95843d3\|4a5214a\|f536182\|cc03d70\|555f3a3"` | All 7 commits found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| IMPORT-01 | 02-01, 02-02, 02-03, 02-06 | Script fetches dataset via `git clone --depth 1`, verified against expected file manifest | ✓ SATISFIED | `fetch.ts` + `lib/verify.ts`, real run verified 1,324/1,324/1,324 |
| IMPORT-02 | 02-01, 02-02, 02-04, 02-05, 02-06 | Dry-run match phase produces human-reviewed report (matched/unmatched-legacy/unmatched-new/ambiguous) via 3-tier precision-first matcher, zero DB writes, excludes `is_custom=true` and `coach_exercises` | ✓ SATISFIED | `lib/matcher.ts` + `lib/report.ts` + real committed report + human approval (02-06 Task 3) + zero-write grep/test evidence |

No orphaned requirements — REQUIREMENTS.md maps only IMPORT-01 and IMPORT-02 to Phase 2, and both appear in plan frontmatter `requirements:` fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `grep -rnE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" scripts/exercise-import/ --include=*.ts` returned no matches | — | None found |

No debt markers, no placeholder returns, no empty handlers found in any file modified by this phase.

### Code Review Findings (02-REVIEW.md / 02-REVIEW-FIX.md)

One CRITICAL (CR-01) and three WARNING (WR-01, WR-02, WR-03) findings were raised during code review after the phase's initial execution and all four were fixed, verified in this pass by reading the actual diffs (not just trusting REVIEW-FIX.md's claims):

- **CR-01** (matched/ambiguous-candidate `exercise_id` overlap) — fixed via reserve-at-push-time in all three matcher tiers, commit `95843d3`, regression test present and passing, independently confirmed no duplicate `exercise_id` in the real 1,318-row `matched` array.
- **WR-01** (checker didn't detect the CR-01 overlap class) — fix present in `check-report.ts`, commit `4a5214a`.
- **WR-02** (prior report trusted without schema validation) — `MatchReportSchema.safeParse` added in `readPriorReport`, commit `f536182`.
- **WR-03** (`unmatched_new` not sorted deterministically) — sort added, commit `cc03d70`.

INFO-level findings (IN-01, IN-02, IN-03) were explicitly out of scope for the fix pass per 02-REVIEW-FIX.md and do not affect goal achievement (candidate-cap visibility, locale-aware sort, schema min-length) — none are correctness or safety issues.

### Human Verification Required

None. The phase's one blocking human-verify gate (02-06 Task 3 — report review and approval) was already resolved during phase execution with an explicit "approved" response and independently-verified zero-write Supabase row counts, documented in 02-06-SUMMARY.md. No `<human-check>` blocks were found deferred in any plan file. No further human verification is needed for this phase's goal to be considered achieved.

### Gaps Summary

None. All roadmap Success Criteria, all plan-level must-haves, both mapped requirements (IMPORT-01, IMPORT-02), and the code-review-identified data-integrity bug fix (CR-01) are verified present and correct in the actual codebase — not merely claimed in SUMMARY.md. The real deliverable (`match-report.json`/`.md`, generated against the live upstream dataset and live production Supabase) exists, is committed, passes its own structural checker, and was explicitly human-approved. Zero database writes occurred, confirmed by static analysis (grep), automated tests (stubbed-client assertions), and live row-count verification at the approval checkpoint.

---

_Verified: 2026-08-15T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
