---
phase: 02-download-match-dry-run
plan: 04
subsystem: testing
tags: [matcher, fastest-levenshtein, zod, vitest, data-pipeline]

# Dependency graph
requires:
  - phase: 02-02
    provides: "lib/normalize.ts (normalizeExerciseName, similarityRatio, TIER2_THRESHOLD, groupByNormalizedName), lib/types.ts (DatasetExercise, ProductionExercise, MatchedRow/UnmatchedNewRow/UnmatchedLegacyRow/AmbiguousRow/Candidate report-row types)"
provides:
  - "lib/matcher.ts — 3-tier precision-first matching engine: findDuplicateNames, buildNameIndex, tier1Match, tier2Match, tier3Candidates, computeFieldConflicts, categorizeAll"
  - "lib/matcher.test.ts — 28 fixture-based tests locking in tier ordering, precedence, consumption, duplicate-name warning, and completeness invariants"
affects: [02-05, 02-06, phase-3-merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tier functions (tier2Match, tier3Candidates) are pure functions of whatever production array the caller passes — consumption/filtering (excluding rows already claimed by an earlier tier) is the orchestrator's (categorizeAll's) responsibility, not baked into the tier functions themselves. Keeps each tier function trivially unit-testable in isolation."
    - "Array-valued name index (Map<string, ProductionExercise[]>) built via the existing groupByNormalizedName primitive — reused directly for both the Tier 1 lookup index and the duplicate-name safety report, rather than building two separate data structures."

key-files:
  created:
    - scripts/exercise-import/lib/matcher.ts
    - scripts/exercise-import/lib/matcher.test.ts
  modified: []

key-decisions:
  - "tier2Match/tier3Candidates take a production array as-is (no internal consumed-set tracking) — categorizeAll filters to the unconsumed subset before calling them each pass. Simpler signature, easier to unit-test each tier function against a hand-picked production list without needing to fake a consumption state."
  - "Ambiguous-row candidate production ids are never added to the consumed set — a production row offered as a candidate on an ambiguous row remains eligible to be offered again to a later dataset record's Tier 2/3 pass, and is excluded from unmatched_legacy via a separate ambiguousCandidateIds set built after all three passes complete (prevents double-counting between ambiguous candidates and unmatched_legacy per the plan's explicit invariant)."

patterns-established:
  - "Tier 1 runs to completion across the whole dataset before Tier 2 starts (two full passes over the dataset array, not one interleaved pass) — this is what makes the precedence guarantee (exact match always beats a fuzzy candidate for the same production row) structurally true rather than order-dependent on array iteration."

requirements-completed: [IMPORT-02]

# Metrics
duration: 20min
completed: 2026-08-15
---

# Phase 2 Plan 4: 3-Tier Exercise Matcher Summary

**Pure, I/O-free 3-tier precision-first matcher (`categorizeAll`) that resolves exact name matches before fuzzy ones, treats attribute-overlap as permanently unconfident, and reports production name duplicates instead of silently dropping rows — 28 fixture tests, zero DB/filesystem/env dependencies.**

## Performance

- **Duration:** ~20 min (worktree already had `node_modules` from a prior wave's install, no fresh-install overhead this time)
- **Started:** 2026-08-15T09:29:00Z (approx.)
- **Completed:** 2026-08-15T09:49:01Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2 (both new)

## Accomplishments
- `lib/matcher.ts` — all 6 exported functions from the plan's interface contract (`findDuplicateNames`, `buildNameIndex`, `tier1Match`, `tier2Match`, `tier3Candidates`, `computeFieldConflicts`) plus the `categorizeAll` orchestrator, all pure/synchronous/I/O-free
- Tier 1 (exact normalized name against both `name` and `name_fr`) runs to completion across the entire dataset before Tier 2 starts — a fuzzy match can never steal a production row that some other dataset record matches exactly (verified by a dedicated precedence test)
- Tier 3 (body_part/equipment/target attribute overlap, ≥2 of 3 agreeing) is structurally incapable of producing a `matched` row — every code path that consumes a `tier3Candidates()` result feeds `ambiguous`, never `matched`, and a test asserts this directly
- `findDuplicateNames` + array-valued `buildNameIndex` surface production name collisions in `duplicate_production_names` instead of letting a `Map.set()` silently drop a row (Pitfall 4 / threat T-02-10)
- `computeFieldConflicts` distinguishes a genuine value disagreement (`'body_part'`) from a data gap (`'body_part:missing-in-production'`), and per D-02 a conflict never downgrades an otherwise-confident name match to ambiguous
- Completeness invariant (`matched.length + unmatched_new.length + ambiguous.length === dataset.length`) and the no-double-count invariant (no production id in both `matched` and `unmatched_legacy`) are both asserted by tests against a mixed 6-record/8-production fixture exercising all 3 tiers plus a genuinely untouched legacy row

## Task Commits

Each task was committed atomically:

1. **Task 1: 3-tier matching engine (lib/matcher.ts)** - `b860f56` (feat)
2. **Task 2: Matcher fixture test suite (lib/matcher.test.ts)** - `fdcaf1a` (test)

**Plan metadata:** committed together with this SUMMARY.md (docs commit, see below)

## Files Created/Modified
- `scripts/exercise-import/lib/matcher.ts` - 3-tier precision-first matcher; pure functions, no `createClient`/`fs`/`process.env`/`__dirname`/`import.meta`
- `scripts/exercise-import/lib/matcher.test.ts` - 28 tests: per-function unit coverage (`findDuplicateNames`, `tier1Match`, `tier2Match`, `tier3Candidates`, `computeFieldConflicts`) plus a `categorizeAll` integration suite covering every tier-decision scenario, precedence, consumption, duplicate-name warning, `human_decision === null`, empty input, and the two completeness/no-overlap invariants

## Decisions Made
- `tier2Match`/`tier3Candidates` accept a production array as-is rather than tracking consumption internally — `categorizeAll` filters to the unconsumed subset before each call. This keeps the tier functions trivially unit-testable in isolation (no need to fake a consumed-set argument) while still satisfying the plan's "skip production rows already consumed by Tier 1" requirement at the orchestration level.
- Ambiguous-row candidates are never marked consumed — a production row offered on one dataset record's ambiguous candidate list stays eligible for later dataset records, and is excluded from `unmatched_legacy` via a post-pass `ambiguousCandidateIds` set (built once, after all three tier passes), so no production row is ever double-counted between `ambiguous` candidates and `unmatched_legacy`.
- One test fixture (`Tier 2 below-threshold pair does not match`) required explicit non-overlapping `body_part`/`equipment`/`target` attributes on both sides — the fixture factories' shared defaults would otherwise cause an incidental Tier 3 attribute-overlap pickup, moving the row into `ambiguous` instead of the intended `unmatched_new`. Caught by running the test suite before committing, not left as a latent flaky assumption.

## Deviations from Plan

None - plan executed exactly as written. The fixture-attribute-collision fix above is a test-authoring correction (my own fixture default bled into an unrelated test), not a deviation from the plan's specification of `matcher.ts`'s behavior.

## Issues Encountered
- Initial `matcher.test.ts` had one fixture (`Barbell Squat` vs `Barbell Bench Press`, testing the Tier 2 below-threshold path) where both sides inherited identical default `body_part`/`equipment`/`target` values from the fixture factories, causing an unintended Tier 3 attribute-overlap match (`ambiguous` instead of the intended `unmatched_new`). Caught immediately by `npx vitest run` before committing; fixed by giving the production fixture explicitly disagreeing attributes. No change to `matcher.ts` itself was needed — the matcher's behavior was correct; the test fixture was under-specified.

## User Setup Required

None - no external service configuration required. `lib/matcher.ts` and its test suite are pure/dependency-injected; no `.env` values needed to run `npm run test:import`.

## Next Phase Readiness

- All `must_haves.artifacts` exist with every listed export: `lib/matcher.ts` (`buildNameIndex`, `findDuplicateNames`, `tier1Match`, `tier2Match`, `tier3Candidates`, `categorizeAll`) and `lib/matcher.test.ts` (435 lines, well above the 120-line floor).
- `npm run test:import` is green: 57/57 tests across 4 suites (29 carried over from 02-02 + 28 new from this plan), zero regressions.
- Acceptance-criteria greps all pass: zero `createClient`/`fs`/`process.env` occurrences, zero literal `0.87` (threshold always imported), zero `__dirname`/`import.meta`, at least one `from './normalize'` import.
- `categorizeAll`'s return shape (`matched`, `unmatched_new`, `unmatched_legacy`, `ambiguous`, `duplicate_production_names`) is exactly what plan 02-05 (the report writer) and Phase 3 (merge) need to serialize against `lib/types.ts`'s `MatchReportSchema` — no further shape translation required.
- No blockers for plan 02-05 (report generation, which will call `categorizeAll` against the real fetched dataset + live production read and serialize the result through `MatchReportSchema`).

---
*Phase: 02-download-match-dry-run*
*Completed: 2026-08-15*

## Self-Check: PASSED

- FOUND: scripts/exercise-import/lib/matcher.ts
- FOUND: scripts/exercise-import/lib/matcher.test.ts
- FOUND: commit b860f56 (Task 1: 3-tier matching engine)
- FOUND: commit fdcaf1a (Task 2: matcher fixture test suite)
