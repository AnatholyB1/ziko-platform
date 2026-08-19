---
phase: 02-download-match-dry-run
plan: 05
subsystem: data-pipeline
tags: [zod, vitest, report-generation, markdown, supabase]

# Dependency graph
requires:
  - phase: 02-02
    provides: "lib/types.ts (MatchReportSchema row schemas), lib/paths.ts (REPORTS_DIR, REPORT_JSON_PATH, REPORT_MD_PATH, DATASET_ROOT, DATASET_JSON_PATH)"
  - phase: 02-03
    provides: "lib/verify.ts (loadDatasetJson), fetch.ts (sibling entrypoint structure/conventions)"
  - phase: 02-04
    provides: "lib/matcher.ts (categorizeAll — the categorization this plan serializes)"
provides:
  - "lib/report.ts — buildReport, mergePriorHumanDecisions, renderMarkdown (pure, no I/O)"
  - "match.ts — dry-run entrypoint that writes match-report.json + match-report.md"
  - "types.ts extension — Phase3StatusEnum + Report*RowSchema variants carrying phase3_status/stale_decision"
affects: [02-06, phase-3-merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Report-row schemas (ReportMatchedRowSchema etc.) are .extend()ed + re-.strict()ed variants of the matcher's own row schemas, kept in types.ts, so the report's phase3_status/stale_decision stamping never touches lib/matcher.ts's internal row shape or its existing tests"
    - "TS property narrowing does not cross a closure boundary — a discriminated-union property narrowed via an outer `if` must be bound to a local const before being read inside a nested arrow function passed to .some()/.map()/etc., or the narrowing is lost and tsc --strict fails"

key-files:
  created:
    - scripts/exercise-import/lib/report.ts
    - scripts/exercise-import/lib/report.test.ts
    - scripts/exercise-import/match.ts
  modified:
    - scripts/exercise-import/lib/types.ts

key-decisions:
  - "Extended (not mutated) the existing MatchedRowSchema/UnmatchedNewRowSchema/UnmatchedLegacyRowSchema/AmbiguousRowSchema via new Report*RowSchema variants, rather than adding phase3_status/stale_decision directly onto the base schemas — the base schemas are what lib/matcher.ts (a completed, tested prior-wave module) produces and type-checks against; extending in a new schema kept that module and its 28 passing tests untouched while still satisfying this plan's interfaces-block contract"
  - "stale_decision is a required (non-optional) boolean on ReportAmbiguousRowSchema, always stamped false by buildReport and only flipped true by mergePriorHumanDecisions — an optional field would have made JSON.stringify key-presence non-deterministic depending on whether a row round-tripped through merge"

patterns-established:
  - "match.ts mirrors fetch.ts's entrypoint conventions exactly: assertRunFromRepoRoot() first, argv-array spawnSync with no shell for git commands, main().catch() unconditional-call-at-module-load pattern, never imported by a test"

requirements-completed: [IMPORT-02]

# Metrics
duration: ~35min (includes worktree base-commit recovery and copying forward wave 1-3 dependency context — see Issues Encountered)
completed: 2026-08-15
---

# Phase 2 Plan 5: Match Report Assembly & Entrypoint Summary

**`lib/report.ts` (buildReport/mergePriorHumanDecisions/renderMarkdown, pure) + `match.ts` (dry-run entrypoint) turn the matcher's categorization into `match-report.json`/`match-report.md` under `.planning/workstreams/image-exo/reports/`, with reviewer `human_decision` values preserved across re-runs — 19 new tests, 88/88 passing across the whole pipeline, zero Supabase writes.**

## Performance

- **Duration:** ~35 min (includes worktree recovery — see Issues Encountered)
- **Started:** 2026-08-15T12:03:00Z (approx., after worktree base-commit correction)
- **Completed:** 2026-08-15T12:20:00Z (approx.)
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 4 (3 new, 1 extended)

## Accomplishments
- `lib/report.ts` — `buildReport` (schema-validated, deterministically sorted: matched by `dataset_id`, `unmatched_legacy` by `production_name`, `ambiguous` by descending top-candidate score; candidates truncated to 3; `phase3_status` stamped from `PHASE3_STATUS_HINT`, never hardcoded), `mergePriorHumanDecisions` (carries forward non-null `human_decision` by `dataset_id`, flags `stale_decision` when a carried `match` decision's `exercise_id` is no longer offered, silently drops phantom rows), `renderMarkdown` (title + counts table + data-quality warnings + full un-truncated ambiguous section with paste-ready `human_decision` JSON snippets + field-conflicts section + 20-row samples for matched/unmatched + how-to-approve block)
- `lib/report.test.ts` — 19 tests: schema validity, per-category `phase3_status` mapping, no row ever carries `skipped`, candidate truncation, byte-identical determinism across two `buildReport` calls, prior-decision carry-forward/stale/phantom-row handling for both `match` and `insert_new` actions, and Markdown completeness (all 4 category counts, every ambiguous name, 20-row truncation line, required substrings, duplicate-name "none" line)
- `match.ts` — thin entrypoint: `assertRunFromRepoRoot()` → dataset-cache existence check (exits 1 naming `fetch.ts` if absent) → `loadDatasetJson` re-validation → `git rev-parse HEAD` via argv-array `spawnSync` (degrades to `'unknown'`, never crashes) → `createReadOnlyClient()` + `fetchAllProductionExercises` → `categorizeAll` → prior-report read (try/catch, corrupt file → `null` + warning) → `buildReport` + `mergePriorHumanDecisions` → writes both fixed-path artifacts → prints category counts, warning/carried-forward/stale counts, both paths, and an explicit `DRY RUN — 0 rows written to Supabase` line
- 88/88 tests passing across the whole `scripts/exercise-import` suite (69 carried over + 19 new), no regressions
- `npx tsc --noEmit --strict` clean on `match.ts` (caught and fixed one real narrowing bug — see Deviations)
- Manually verified: `npx tsx scripts/exercise-import/match.ts` exits 1 naming `fetch.ts` when `DATASET_ROOT` is absent; exits 1 when run from `scripts/exercise-import/` instead of the repo root

## Task Commits

Each task was committed atomically:

1. **Task 1: Report assembly, decision merge, and Markdown rendering (lib/report.ts)** - `03cbc17` (feat)
2. **Task 2: Report module test suite (lib/report.test.ts)** - `bc0c512` (test)
3. **Task 3: Match entrypoint (match.ts)** - `6cad985` (feat) — also includes the narrowing-bug fix in `lib/report.ts` (found via `tsc --strict` while verifying Task 3)

**Plan metadata:** committed together with this SUMMARY.md (docs commit, see below)

## Files Created/Modified
- `scripts/exercise-import/lib/report.ts` - Pure report assembly, prior-decision merge, Markdown rendering
- `scripts/exercise-import/lib/report.test.ts` - 19 tests against hand-built fixtures (no fs/Supabase)
- `scripts/exercise-import/match.ts` - Dry-run entrypoint wiring fetch→verify→match→report
- `scripts/exercise-import/lib/types.ts` - Adds `Phase3StatusEnum` + `ReportMatchedRowSchema`/`ReportUnmatchedNewRowSchema`/`ReportUnmatchedLegacyRowSchema`/`ReportAmbiguousRowSchema` (extended variants of the existing row schemas), and repoints `MatchReportSchema`'s array fields at them

## Decisions Made
- Followed the plan's exact function signatures and 9-step `match.ts` behaviour sequence verbatim.
- Extended rather than mutated the base row schemas in `types.ts` (see key-decisions above) — necessary because the plan's `<interfaces>` block documents `phase3_status` (and, implicitly via the `mergePriorHumanDecisions` spec, `stale_decision`) as part of the report row shape, but the already-committed (02-02) `MatchedRowSchema`/`UnmatchedNewRowSchema`/`UnmatchedLegacyRowSchema`/`AmbiguousRowSchema` are `.strict()` and do not define those fields — `MatchReportSchema.parse` would otherwise throw on every row. `lib/matcher.ts`'s own row types (used internally by `categorizeAll`) are completely untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug/Blocking] Extended types.ts row schemas with phase3_status/stale_decision fields not present in the already-committed 02-02 schema**
- **Found during:** Task 1 (`lib/report.ts`)
- **Issue:** The plan's `<interfaces>` block (and Task 1/3's explicit instructions to "stamp `phase3_status` on every row" and "set `stale_decision` true") document these fields as part of the match-report row shape, but `MatchedRowSchema`/`UnmatchedNewRowSchema`/`UnmatchedLegacyRowSchema`/`AmbiguousRowSchema` in the already-committed `types.ts` (from plan 02-02) are `.strict()` z.objects with no such fields. `MatchReportSchema.parse()` would throw `ZodError: unrecognized key` on every non-empty row array without a schema change.
- **Fix:** Added `Phase3StatusEnum` plus four new `.extend()`ed + re-`.strict()`ed schemas (`ReportMatchedRowSchema`, `ReportUnmatchedNewRowSchema`, `ReportUnmatchedLegacyRowSchema`, `ReportAmbiguousRowSchema`) in `types.ts`, and repointed `MatchReportSchema`'s four array fields at the new variants. The original base schemas (and every type `lib/matcher.ts` exports/consumes) are unchanged.
- **Files modified:** `scripts/exercise-import/lib/types.ts`
- **Verification:** `npx vitest run scripts/exercise-import/lib/types.test.ts scripts/exercise-import/lib/matcher.test.ts` — both still 100% green (38/38) after the change, confirming no impact on prior-wave code; new `report.test.ts` schema-validity tests pass.
- **Committed in:** `03cbc17` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed a TS discriminated-union narrowing bug caught by `tsc --strict`**
- **Found during:** Task 3, while manually type-checking `match.ts` (`npx tsc --noEmit --strict`)
- **Issue:** In `mergePriorHumanDecisions`, `if (prior.human_decision.action === 'match') { ... row.candidates.some((c) => c.exercise_id === prior.human_decision!.exercise_id) ... }` — TypeScript does not carry a property's narrowed type across a closure boundary (the outer `if` narrows `prior.human_decision`, but `prior.human_decision` read again inside the `.some()` callback is a fresh, un-narrowed property access), so `prior.human_decision!.exercise_id` failed to typecheck (`'insert_new'`/`'skip'` branches have no `exercise_id`).
- **Fix:** Bound the narrowed value to a local `const priorDecision = prior.human_decision` before the `if`, and a further `const targetExerciseId = priorDecision.exercise_id` inside the narrowed branch, so the closure only ever reads already-narrowed local bindings.
- **Files modified:** `scripts/exercise-import/lib/report.ts`
- **Verification:** `npx tsc --noEmit --strict --target es2020 --module commonjs --moduleResolution node --esModuleInterop match.ts` returns no errors; `npx vitest run scripts/exercise-import` still 88/88 green.
- **Committed in:** `6cad985` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking schema extension, 1 type-narrowing bug)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own stated interface contract and to pass a strict typecheck; zero functional/behavioral surprises, no scope creep beyond what the plan's `<interfaces>` block already specified.

## Issues Encountered

- **Worktree isolation gap (setup, not a plan deviation):** This worktree's HEAD was on `dev` (a separately-diverged history containing unrelated `main`-workstream commits, e.g. `notificationService` fixes) rather than the wave-4 base commit `57ff38b1a631032bed00393a84b55492d46cc6de` supplied in the task's `<worktree_branch_check>` step. `git merge-base HEAD 57ff38b1a6...` did not equal the expected base, confirming drift per that step's documented check. Additionally, the entire `.planning/workstreams/image-exo/` tree and `scripts/exercise-import/` directory (all of waves 1–3's output) were absent from this worktree at that HEAD. Corrected via `git reset --hard 57ff38b1a631032bed00393a84b55492d46cc6de` — the exact recovery this task's own `<worktree_branch_check>` step specifies for a merge-base mismatch — which brought in all prior-wave commits (`0b2447f`, `4d82898`, `b860f56`, `fdcaf1a`, etc., already merged into that base per its own commit message "update tracking after wave 3"). Not a self-invented recovery; the same pattern is documented in 02-03's SUMMARY.md for an earlier wave's worktree.
- No other issues — once the worktree was on the correct base, all prerequisite files (`lib/types.ts`, `lib/matcher.ts`, `lib/supabase-client.ts`, `lib/verify.ts`, `lib/paths.ts`, `fetch.ts`) were present and matched what the plan's `<context>` block and `02-03`/`02-04` SUMMARY.md files described.

## User Setup Required

None — no external service configuration required for the automated portion of this plan. `match.ts` itself needs `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` (via `backend/api/.env.local`) to run live against production and a prior `fetch.ts` run to populate the dataset cache — neither was exercised in this session (no live credentials/dataset clone available in this worktree), consistent with 02-03's precedent of deferring the live network/DB-dependent run to phase-level manual verification.

## Next Phase Readiness

- All `must_haves.artifacts` exist with every listed export: `lib/report.ts` (`buildReport`, `mergePriorHumanDecisions`, `renderMarkdown`), `match.ts` (132 lines, well above the 50-line floor), `lib/report.test.ts` (313 lines, well above the 100-line floor, 19 tests well above the 12-test floor).
- All `key_links` verified present via grep: `match.ts` → `fetchAllProductionExercises`, `match.ts` → `REPORT_JSON_PATH`/`writeFileSync`, `report.ts` → `PHASE3_STATUS_HINT`.
- `npm run test:import` / `npx vitest run scripts/exercise-import` both green: 88/88 across 6 suites.
- Static verification complete: all of this plan's own grep-based acceptance criteria pass (zero `fs`/`createClient`/`process.env` in `report.ts`; zero `0.87` literal; zero `__dirname`/`import.meta`; zero `insert/update/upsert/delete/rpc/storage` calls and zero `SUPABASE_SERVICE_KEY`/`coach_exercises` references in `match.ts`).
- **Deferred to phase-level (live) verification**, per the same pattern 02-03 established for `fetch.ts`: an actual `npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts` run against a real fetched dataset clone and real Supabase production credentials — this requires a working `fetch.ts` clone (network-dependent) and live DB credentials not available in this execution session. The "running match twice produces no diff other than `generated_at`" phase-level verification item is likewise deferred to that live run.
- No blockers for plan 02-06 or Phase 3 — `match-report.json`'s schema (`MatchReportSchema` including the new `phase3_status`/`stale_decision` fields) is the exact shape Phase 3's merge script should consume.

---
*Phase: 02-download-match-dry-run*
*Completed: 2026-08-15*

## Self-Check: PASSED

- FOUND: scripts/exercise-import/lib/report.ts
- FOUND: scripts/exercise-import/lib/report.test.ts
- FOUND: scripts/exercise-import/match.ts
- FOUND: .planning/workstreams/image-exo/phases/02-download-match-dry-run/02-05-SUMMARY.md
- FOUND: commit 03cbc17 (Task 1: report assembly, decision merge, Markdown rendering)
- FOUND: commit bc0c512 (Task 2: report module test suite)
- FOUND: commit 6cad985 (Task 3: match entrypoint)
