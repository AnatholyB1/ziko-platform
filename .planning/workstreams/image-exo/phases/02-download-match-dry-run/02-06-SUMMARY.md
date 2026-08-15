---
phase: 02-download-match-dry-run
plan: 06
subsystem: data-pipeline
tags: [real-run, supabase, git-clone, matcher-bugfix, checkpoint]

# Dependency graph
requires:
  - phase: 02-03
    provides: "fetch.ts entrypoint, lib/verify.ts manifest verification"
  - phase: 02-05
    provides: "match.ts entrypoint, lib/report.ts buildReport/renderMarkdown"
provides:
  - "lib/check-report.ts — checkReport(report), repeatable structural sanity checker"
  - "A real, committed match-report.json + match-report.md generated from the live hasaneyldrm/exercises-dataset clone and live production Supabase (read-only)"
  - "A Tier 1 double-claim bugfix in lib/matcher.ts's categorizeAll, found only by running against real data"
affects: [phase-3-merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "check-report.ts follows the same CLI-entrypoint convention as fetch.ts/match.ts (main() called unconditionally at module load, never imported by a test) while also exporting a pure checkReport(report) function for structural validation"
    - "checkReport performs every check independently against a defensively-typed view of the raw parsed JSON (UnknownRow helpers), rather than bailing out on the first MatchReportSchema failure — a caller debugging a broken report needs the full problem list in one pass"

key-files:
  created:
    - scripts/exercise-import/lib/check-report.ts
    - .planning/workstreams/image-exo/reports/match-report.json
    - .planning/workstreams/image-exo/reports/match-report.md
  modified:
    - scripts/exercise-import/lib/matcher.ts
    - scripts/exercise-import/lib/matcher.test.ts

key-decisions:
  - "TIER2_THRESHOLD kept at 0.87 (unchanged) — the real run produced zero tier2/tier3 matched rows and zero ambiguous rows, so there was no false positive to raise the threshold against and no unmatched_legacy row for a lower threshold to rescue. Tier 1 exact-name matching alone accounted for all 1318 production rows."
  - "Fixed a Tier 1 double-claim bug in categorizeAll (Rule 1): the name index is built once from the full production array and never shrinks, so two dataset records sharing an identical normalized name both resolved to the same single production row before this fix, producing two matched rows for one production id. Now the check `!consumed.has(tier1.rows[0].id)` routes the second occurrence to Tier 2/3 instead of double-claiming."

requirements-completed: []
requirements-in-progress: [IMPORT-01, IMPORT-02]

# Metrics
duration: ~50min (Tasks 1-2; Task 3 is a blocking human checkpoint, not yet resolved)
completed: 2026-08-15
---

# Phase 2 Plan 6: Real Dry Run, Threshold Confirmation & Matcher Bugfix Summary

**Ran the exercise-import pipeline for real for the first time — cloned `hasaneyldrm/exercises-dataset` (1,324 records) and read live production `public.exercises` (1,318 non-custom rows) — found and fixed a genuine Tier 1 double-claim bug via a `lib/check-report.ts` structural checker, then confirmed `TIER2_THRESHOLD=0.87` needs no adjustment: the real match report has 0 tier2/tier3 rows and 0 ambiguous rows. STOPPED at Task 3's blocking human-approval checkpoint — Phase 2 is not yet complete.**

## STATUS: Tasks 1-2 complete. Task 3 (human review checkpoint) is BLOCKING and unresolved.

This SUMMARY is written now (per worktree-isolation requirements) to avoid losing committed
work when this worktree is torn down. A continuation agent must pick up at Task 3 after the
human's decision is known, and should REPLACE the "STATUS" section above (and this note) once
the checkpoint resolves — do not treat this file as final until Task 3 is checked off.

## Performance

- **Duration:** ~50 min for Tasks 1-2 (includes a ~128MB real git clone and investigating/fixing
  a real matcher bug found only by running against live data)
- **Tasks:** 2 of 3 complete (Task 3 is the blocking checkpoint)
- **Files modified:** 5 (2 created under `lib/`, 2 report artifacts created, 1 matcher module +
  its test file modified)

## Accomplishments

- `lib/check-report.ts` — pure `checkReport(report): string[]` structural checker, run via
  `npx tsx scripts/exercise-import/lib/check-report.ts` against the fixed-path report. Flags:
  `MatchReportSchema` failures, the `matched+unmatched_new+ambiguous === dataset_count` totals
  invariant, `counts.*` vs. array-length disagreement, `production_count === 1000` (pagination
  truncation red flag), `counts.matched === 0`, any row with `phase3_status` missing or
  `"skipped"`, any ambiguous row with >3 candidates, any production `exercise_id` in both
  `matched` and `unmatched_legacy`, and (added during this plan, see Deviations)
  `exercise_id` appearing more than once within `matched`.
- Real pipeline run: `npx tsx scripts/exercise-import/fetch.ts` cloned
  `hasaneyldrm/exercises-dataset` at commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd` —
  1,324 records / 1,324 images / 1,324 videos, all verified.
  `npx tsx --env-file="backend/api/.env.local" scripts/exercise-import/match.ts` read 1,318
  live production `is_custom=false` rows and matched against them.
- **Final real headline numbers** (after the bugfix below): `matched: 1318`,
  `unmatched_new: 6`, `unmatched_legacy: 0`, `ambiguous: 0`. All 1,318 matched rows are Tier 1
  exact-name matches (0 tier2, 0 tier3). `duplicate_production_names` warnings: 11 (all on
  `name_fr`, i.e. shared French translations across otherwise-distinct English exercises —
  informational only, does not affect matching since Tier 1 tries `name` before `name_fr`).
  `field_conflicts`: 0 matched rows carry any (body_part/equipment/target all agree wherever
  matched).
- **10-row hand sample** (spread across the sorted `matched` array, indices 0/100/250/400/550/
  700/850/1000/1150/last — all confirmed to be the identical exercise on both sides since
  `dataset_name === production_name` exactly for every sampled row):
  `3/4 sit-up`, `barbell standing front raise over head`, `dumbbell close-grip press`,
  `ez barbell seated triceps extension`, `reverse grip machine lat pulldown`,
  `band side triceps extension`, `hack calf raise`, `dumbbell reverse spider curl`,
  `cable thibaudeau kayak row`, `dumbbell waiter biceps curl`.
  **`ambiguous` is empty (0 rows) in the real report** — the plan's "5 from matched, 5 from
  ambiguous" hand-sample instruction could not be followed literally for the ambiguous half;
  10 matched rows were sampled instead (see Deviations).
- Reproducibility confirmed: re-ran fetch (cache reuse, no `--refetch`) → match → checker after
  the bugfix — the regenerated `match-report.json`/`.md` differ from the prior run by exactly
  the `generated_at`/`Generated:` timestamp line and nothing else (byte-identical counts, rows,
  and ordering).

## Task Commits

Each task was committed atomically:

1. **Task 1: First real dry run and structural report check** - `73c91cf` (feat) — includes
   the Tier 1 double-claim bugfix in `lib/matcher.ts` and its regression test in
   `lib/matcher.test.ts`, found during this task's real run (see Deviations)
2. **Task 2: Tier 2 threshold tuning iteration** - `7c79fc0` (docs) — confirms `0.87` unchanged;
   only the report artifacts changed (regenerated `generated_at`)

**Task 3 (checkpoint) has NOT been committed** — it is a human-approval gate, not a code change.

## Files Created/Modified

- `scripts/exercise-import/lib/check-report.ts` - Structural report checker (new)
- `.planning/workstreams/image-exo/reports/match-report.json` - Real match report (new, regenerated twice)
- `.planning/workstreams/image-exo/reports/match-report.md` - Real match report, human-readable (new, regenerated twice)
- `scripts/exercise-import/lib/matcher.ts` - Fixed Tier 1 double-claim bug in `categorizeAll`
- `scripts/exercise-import/lib/matcher.test.ts` - Added regression test using the real duplicate names found live

## Decisions Made

- **TIER2_THRESHOLD stays at 0.87.** The real run produced zero tier2 (and zero tier3) matched
  rows and zero ambiguous rows — Tier 1 exact-name matching alone accounted for every one of the
  1,318 production rows. There was no tier2 false positive to raise the threshold against, and
  no `unmatched_legacy` row remaining for a lower threshold to rescue (there are none). This is
  the "keep 0.87, nothing to tune" branch of the plan's decision rule, not a deliberate
  precision/recall tradeoff — the real corpora turned out to overlap almost perfectly on exact
  names, more strongly than 02-RESEARCH.md's MEDIUM-confidence prediction anticipated.
- **Fixed the Tier 1 double-claim bug rather than deferring it** (see Deviations) — it directly
  threatens T-02-09 (a false-positive `matched` row reaching Phase 3): before the fix, 6
  production rows were each claimed by *two* different dataset records, which would have caused
  Phase 3 to `UPDATE` the same production row twice and silently lose one dataset record's
  traceability. This is exactly the kind of blocking bug 02-RESEARCH.md's Open Question 2
  anticipated real data might surface that fixtures couldn't.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tier 1 double-claimed a production row when two dataset records shared an identical name**
- **Found during:** Task 1, inspecting the first real match report (`matched.length` was 1324
  but only 1318 unique `exercise_id` values appeared across those rows)
- **Issue:** `categorizeAll`'s Tier 1 pass (`lib/matcher.ts`) builds the name index once from the
  full production array and iterates the whole dataset against it without checking whether a
  resolved single-row match had already been `consumed` by an earlier dataset record. The real
  upstream dataset genuinely contains 6 pairs of records sharing an identical name (verified
  live, e.g. dataset ids `0088`/`1371` both named "Barbell Seated Calf Raise") — both members of
  each pair independently resolved to the same one production row and both were pushed into
  `matched`, producing two `matched` rows referencing one `exercise_id`. This is a T-02-09-class
  false positive: Phase 3 would `UPDATE` that one production row twice from two different
  dataset records, and the second dataset record's association would be silently lost.
- **Fix:** In the Tier 1 loop, `tier1.rows.length === 1` now additionally requires
  `!consumed.has(tier1.rows[0].id)`. When the single resolved row is already consumed, the
  dataset record falls through to Tier 2/3 against whatever production rows remain (in this real
  case, none — so it ends up correctly in `unmatched_new`) instead of double-claiming.
- **Files modified:** `scripts/exercise-import/lib/matcher.ts`
- **Verification:** New regression test in `lib/matcher.test.ts` using the real names
  ("Barbell Seated Calf Raise", ids `0088`/`1371`) asserts exactly one `matched` row for the
  single production id and that the second dataset record lands in `unmatched_new`. Full suite
  89/89 green (was 88/88 before this test). Re-ran the real pipeline after the fix:
  `matched` dropped from 1324 to 1318 (now equal to `production_count`), `unmatched_new` rose
  from 0 to 6 — the 6 second-occurrences of the duplicate-named pairs. `check-report.ts` (with
  the new duplicate-`exercise_id`-in-`matched` check added in the same commit) exits 0 against
  the corrected report.
- **Committed in:** `73c91cf` (Task 1 commit)

**2. [Rule 2 - Missing critical functionality] Added a duplicate-exercise_id-within-matched check to check-report.ts**
- **Found during:** Task 1, immediately after discovering deviation #1 above
- **Issue:** The plan's explicit checkReport flag list did not include a check for a production
  `exercise_id` appearing more than once *within* `matched` (only "appearing in both `matched`
  and `unmatched_legacy`" was specified) — yet this is precisely the invariant deviation #1's
  bug violated, and the whole point of `check-report.ts` is to make this class of issue
  repeatably catchable on every future tuning iteration or re-run, not just via one-off manual
  inspection of row counts.
- **Fix:** Added a check counting occurrences of each `exercise_id` across `matched` and flagging
  any count > 1.
- **Files modified:** `scripts/exercise-import/lib/check-report.ts`
- **Verification:** Manually verified the check fires against the pre-fix report (would have
  flagged all 6 duplicated ids) and passes clean against the post-fix report.
- **Committed in:** `73c91cf` (Task 1 commit)

### Scope Note (not a deviation, but a plan-instruction gap)

Task 1's instructions asked to hand-verify "5 from `matched` ... and 5 from `ambiguous`". The
real report has **zero** `ambiguous` rows (Tier 1 alone matched every production row that had
any dataset counterpart), so the ambiguous half of that instruction is inapplicable this run.
10 `matched` rows were hand-verified instead (see Accomplishments above for the sampled names).
This is a real-data outcome, not a deviation from any code or process — recorded here per the
plan's SUMMARY-recording requirement.

---

**Total deviations:** 2 auto-fixed (1 real bug found only by running against live data, 1
checker enhancement to make that bug class permanently catchable).
**Impact on plan:** Both were necessary to produce a report that is actually safe to hand to
Phase 3 — a report with a silently double-claimed production row would have caused a real data
integrity issue on the very next phase's production `UPDATE`s. No scope creep beyond what T-02-09's
threat-model mitigation already commits to ("Task 2 requires examining every tier2 pairing...
with each one locked out by a regression test").

## Issues Encountered

- **Worktree isolation gap (setup, not a plan deviation):** This worktree's HEAD was on an
  unrelated, diverged history (`main`'s latest merge commit) rather than the wave-5 base commit
  `d4b0e3bdffd2b1ea4996df3c3d4eadde76a90a79` supplied in this task's `<worktree_branch_check>`
  step. `git merge-base HEAD d4b0e3b...` did not equal the expected base, confirming drift.
  Corrected via `git reset --hard d4b0e3bdffd2b1ea4996df3c3d4eadde76a90a79` — the exact recovery
  this task's own `<worktree_branch_check>` step specifies for a merge-base mismatch, and the
  same pattern documented in every prior plan's SUMMARY.md in this phase (02-03, 02-05).
- **`backend/api/.env.local` does not exist inside this worktree** (it is gitignored and
  worktrees do not inherit gitignored files from the main checkout). Loaded credentials via
  `npx tsx --env-file="C:\ziko-platform\backend\api\.env.local" scripts/exercise-import/match.ts`
  — an absolute path into the main repo checkout, read-only, never copied into or committed from
  this worktree. No credential value was ever printed, echoed, or written to any committed file.
- No other issues. All prerequisite files from waves 1-4 were present and matched what earlier
  SUMMARY.md files described, once the worktree base was corrected.

## User Setup Required

None for the automated portion. **Task 3 (this plan's final task) requires a human decision** —
see "Next Phase Readiness" below and the checkpoint returned alongside this SUMMARY.

## Next Phase Readiness

**BLOCKED on Task 3 — the blocking human-approval checkpoint.** Do not begin Phase 3 and do not
consider Phase 2 complete until a human has reviewed `match-report.md`/`match-report.json` and
responded "approved" (or described what needs to change).

What is ready for that review:
- `.planning/workstreams/image-exo/reports/match-report.json` and `match-report.md` are
  committed (as of `73c91cf`/`7c79fc0`) and reflect a real run against real data:
  `dataset_commit: 7455efae41b330c265e7cd4b78dfa848e7ce5ebd`, `dataset_count: 1324`,
  `production_count: 1318`, `counts: {matched: 1318, unmatched_new: 6, unmatched_legacy: 0,
  ambiguous: 0}`, `thresholds.tier2: 0.87`.
- Zero rows were written to Supabase (publishable-key-only client, no
  insert/update/upsert/delete/rpc/storage call anywhere in `match.ts` or the `lib/` modules it
  calls) — the human still needs to independently confirm this via the Supabase dashboard/SQL
  per the checkpoint's `how-to-verify` steps, since that is the point of this gate.
- `npx tsx scripts/exercise-import/lib/check-report.ts` exits 0, no problems.
- `npx vitest run scripts/exercise-import` — 89/89 tests green.
- `git status --porcelain scripts/exercise-import/.dataset-cache` prints nothing (cache
  correctly gitignored, not staged, not committed).

---
*Phase: 02-download-match-dry-run*
*Completed: 2026-08-15 (Tasks 1-2 only — Task 3 pending)*

## Self-Check: PASSED

- FOUND: scripts/exercise-import/lib/check-report.ts
- FOUND: .planning/workstreams/image-exo/reports/match-report.json
- FOUND: .planning/workstreams/image-exo/reports/match-report.md
- FOUND: commit 73c91cf (Task 1: real dry run + structural checker + Tier 1 bugfix)
- FOUND: commit 7c79fc0 (Task 2: threshold confirmation, kept at 0.87)
