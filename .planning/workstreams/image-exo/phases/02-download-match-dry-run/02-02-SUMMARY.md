---
phase: 02-download-match-dry-run
plan: 02
subsystem: testing
tags: [zod, fastest-levenshtein, supabase-js, vitest, data-pipeline]

# Dependency graph
requires:
  - phase: 02-01
    provides: "fastest-levenshtein@1.0.16 installed at repo root, root vitest.config.ts scoped to scripts/exercise-import/**/*.test.ts, npm run test:import script, README.md module-system constraint doc"
provides:
  - "lib/paths.ts — repo-root-relative path constants + assertRunFromRepoRoot()"
  - "lib/types.ts — DatasetExerciseSchema (external/tolerant), ProductionExerciseSchema, and the strict internal MatchReportSchema contract (Phase 3's hand-off shape), PHASE3_STATUS_HINT"
  - "lib/normalize.ts — normalizeExerciseName, similarityRatio, TIER2_THRESHOLD=0.87, groupByNormalizedName"
  - "lib/supabase-client.ts — createReadOnlyClient (publishable-key-only), fetchAllProductionExercises (paginated, zero-write, zod-validated)"
affects: [02-03, 02-04, 02-05, 02-06, phase-3-merge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two zod strictness policies: plain z.object() for external/upstream input (tolerates benign field additions), .strict() for this pipeline's internal report contract with Phase 3"
    - "Path-traversal-rejecting regexes built via new RegExp(string) rather than /regex/ literals, so grep-able substrings ('images/', 'videos/') survive in source despite JS regex-literal delimiter escaping"
    - "Comments never restate a literal forbidden-token string (e.g. the elevated Supabase credential name, the excluded table name, __dirname/import.meta) — paraphrase instead, since threat-model/module-system grep gates check for zero occurrences file-wide, including comments"

key-files:
  created:
    - scripts/exercise-import/lib/paths.ts
    - scripts/exercise-import/lib/types.ts
    - scripts/exercise-import/lib/types.test.ts
    - scripts/exercise-import/lib/normalize.ts
    - scripts/exercise-import/lib/normalize.test.ts
    - scripts/exercise-import/lib/supabase-client.ts
    - scripts/exercise-import/lib/supabase-client.test.ts
  modified: []

key-decisions:
  - "image/gif_url regexes built via new RegExp('^images/.+\\\\.(jpg|jpeg|png)$') instead of a /regex/ literal — a JS regex literal must escape its delimiter slash ('images\\/'), which would have broken the acceptance-criteria grep for the literal substring 'images/'"
  - "Doc comments rephrased to avoid literally repeating the tokens their own grep-based acceptance criteria assert are absent (the elevated Supabase credential name, the excluded coach-exercises table name, __dirname/import.meta) — same self-reference trap as the regex-escaping issue above"

patterns-established:
  - "lib/** modules are pure, dependency-injected, and zod-validated at every external boundary (dataset parse, production read) — no lib file performs I/O side effects beyond what its single exported function does"

requirements-completed: [IMPORT-01, IMPORT-02]

# Metrics
duration: 25min
completed: 2026-08-15
---

# Phase 2 Plan 2: Shared Library Contracts Summary

**Three shared lib modules (zod contracts, name-normalization/similarity, and paginated read-only Supabase access) that fetch.ts (02-03) and the matcher (02-04) both build against — 29 passing tests across three test files, zero DB writes, zero admin-credential references.**

## Performance

- **Duration:** 25 min (includes a from-scratch `npm install` in the new worktree — node_modules is gitignored and not present in a fresh worktree checkout)
- **Started:** 2026-08-15T11:00:00Z (approx.)
- **Completed:** 2026-08-15T11:26:18Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 7 (all new)

## Accomplishments
- `lib/paths.ts` — every repo-root-relative path constant this pipeline needs (`DATASET_CACHE_DIR`, `DATASET_ROOT`, `DATASET_JSON_PATH`, `REPORTS_DIR`, `REPORT_JSON_PATH`, `REPORT_MD_PATH`, `DATASET_REPO_URL`) plus `assertRunFromRepoRoot()`; zero `__dirname`/`import.meta` usage
- `lib/types.ts` — `DatasetExerciseSchema` (all 15 upstream fields, tolerant of unknown keys, path-traversal-rejecting regexes on `image`/`gif_url`), `ProductionExerciseSchema`, the `.strict()` `MatchReportSchema` grouped-by-category report contract with Phase 3, `HumanDecisionSchema` (D-10 reviewer-edit field), `CandidateSchema`/`MatchedRowSchema`/`UnmatchedNewRowSchema`/`UnmatchedLegacyRowSchema`/`AmbiguousRowSchema`, and `PHASE3_STATUS_HINT` mapping report categories onto the Phase 1 `exercise_import_log` status enum
- `lib/normalize.ts` — `normalizeExerciseName` (accent/case/whitespace-insensitive, punctuation-preserving), `similarityRatio` (fastest-levenshtein-backed, division-by-zero safe), `TIER2_THRESHOLD = 0.87` as the single tunable constant, `groupByNormalizedName` (Pitfall-4 duplicate-detection primitive)
- `lib/supabase-client.ts` — `createReadOnlyClient()` (publishable-key-only, loud error naming both required env vars), `fetchAllProductionExercises()` (paginated past the 1000-row PostgREST cap, `is_custom=false` filter, zod-validated output, throws loudly on any page error)
- 29 tests total across the three test files, all green under `npm run test:import`

## Task Commits

Each task was committed atomically:

1. **Task 1: Path constants and zod contracts (lib/paths.ts, lib/types.ts)** - `3208c37` (feat)
2. **Task 2: Name normalization and similarity (lib/normalize.ts)** - `8e00f8b` (feat)
3. **Task 3: Read-only Supabase access with pagination (lib/supabase-client.ts)** - `c984662` (feat)

**Plan metadata:** committed together with this SUMMARY.md (docs commit, see below)

## Files Created/Modified
- `scripts/exercise-import/lib/paths.ts` - Repo-root-relative path constants + `assertRunFromRepoRoot()`
- `scripts/exercise-import/lib/types.ts` - Zod v4 contracts: dataset schema (tolerant), production schema, strict internal report schema, `PHASE3_STATUS_HINT`
- `scripts/exercise-import/lib/types.test.ts` - 10 tests: parse, tolerance, missing-field rejection, path-traversal rejection, id-format rejection, report strictness, `PHASE3_STATUS_HINT` shape
- `scripts/exercise-import/lib/normalize.ts` - Name normalization, similarity ratio, tier-2 threshold constant, duplicate-name grouping
- `scripts/exercise-import/lib/normalize.test.ts` - 10 tests: accents, whitespace, punctuation preservation, null handling, threshold boundaries, duplicate grouping
- `scripts/exercise-import/lib/supabase-client.ts` - Read-only client factory + paginated production-exercise read
- `scripts/exercise-import/lib/supabase-client.test.ts` - 9 tests: 2350-row 3-page pagination, `.eq`/`.from` call assertions, error propagation, zero-write assertion, env-var-missing rejection

## Decisions Made
- **Regex-literal-vs-grep conflict:** the plan's own acceptance criteria grep for the literal substrings `images/` and `videos/` in `lib/types.ts`, but a JS `/regex/` literal must escape its delimiter slash (`images\/`), which does not contain the plain substring `images/`. Resolved by building those two regexes via `new RegExp('^images/.+\\.(jpg|jpeg|png)$')` instead of a regex literal — functionally identical, but keeps the literal path-prefix strings grep-able.
- **Self-referential comment tokens:** initial doc comments literally repeated the tokens their own grep-based acceptance criteria assert are *absent* from the file (naming the elevated Supabase credential to say "never use this", naming the excluded table to say "never query this", naming `__dirname`/`import.meta` to say "never use these"). Every such comment was rephrased to describe the constraint without literally spelling out the forbidden token, since the grep checks scan the whole file including comments.
- Followed the plan's exact schema shapes verbatim (all field names, enum values, `.strict()` placement) — no schema-design deviations from the plan text.

## Deviations from Plan

None — plan executed exactly as written. The two items above (RegExp construction, comment rephrasing) are implementation-detail fixes to satisfy the plan's own stated acceptance criteria, not deviations from the plan's intent.

## Issues Encountered
- This worktree was created fresh (per the retry note in the task objective — a prior attempt's uncommitted work in a different worktree was discarded). `node_modules/` is gitignored and did not exist in the new worktree, so `npm install` had to run before any test could execute. This added several minutes to the plan's duration but is expected, one-time worktree setup, not a plan deviation.
- Acceptance-criteria greps for `images/`/`videos/` substrings and for zero occurrences of `__dirname`/`import.meta`/the elevated-credential name/the excluded-table name initially failed due to the two self-referential issues documented above (regex-literal escaping, comment phrasing). Both were caught and fixed via the same "run every acceptance-criteria grep before moving on" loop the plan itself specifies — resolved before committing.

## User Setup Required

None — no external service configuration required. All three modules are pure/dependency-injected; no `.env` values needed to run `npm run test:import`.

## Next Phase Readiness

- All four `must_haves.artifacts` exist with every listed export: `lib/paths.ts`, `lib/types.ts`, `lib/normalize.ts`, `lib/supabase-client.ts`.
- `npm run test:import` is green (29/29 tests, 3/3 files) — the acceptance bar for plan 02-03 (`fetch.ts`, which will consume `lib/paths.ts` + `lib/types.ts`'s `DatasetExerciseArraySchema`) and plan 02-04 (the matcher, which will consume `lib/normalize.ts` + `lib/supabase-client.ts` + `lib/types.ts`'s report schemas).
- The zero-write guarantee (`T-02-03` in the threat model) is enforced by an automated test, not just code inspection — `fetchAllProductionExercises` never calls `insert`/`update`/`upsert`/`delete`/`rpc`, asserted directly in `lib/supabase-client.test.ts`.
- The 1000-row pagination cap is proven past by test with an exact 2350-row 3-page fixture (1000/1000/350) — no downstream plan needs to re-derive or re-verify this.
- `PHASE3_STATUS_HINT` gives plan 02-04/02-05 and Phase 3 a single frozen source of truth for mapping report categories onto the `exercise_import_log` status enum — no plan needs to hardcode that mapping again.
- No blockers for plan 02-03 (`fetch.ts` — dataset clone + manifest verification, consuming `lib/paths.ts`/`lib/types.ts`).

---
*Phase: 02-download-match-dry-run*
*Completed: 2026-08-15*
