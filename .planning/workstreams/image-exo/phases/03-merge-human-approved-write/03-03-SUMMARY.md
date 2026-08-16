---
phase: 03-merge-human-approved-write
plan: 03
subsystem: database
tags: [supabase, service-role, vitest, tdd, resumability, check-constraint]

# Dependency graph
requires:
  - phase: 02-download-match-dry-run
    provides: lib/supabase-client.ts read-only client shape to mirror, lib/report.ts pure-reduction pattern, lib/types.ts MatchReportSchema row contracts
provides:
  - "createWriteClient() — service-role Supabase client, the one write-capable client permitted in this pipeline"
  - "computeResumeState/reduceLatestBySourceId/buildResumeMap — pure resume-state reduction over exercise_import_log rows (IMPORT-04)"
  - "ALLOWED_CATEGORIES/mapDatasetCategory/collectUnmappableCategories — guard against 23514 check_violation on exercises.category"
affects: [03-04-merge-row-builder, 03-05-merge-entrypoint, 03-06-real-run]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service-role write client mirrors lib/supabase-client.ts's shape but never falls back to SUPABASE_PUBLISHABLE_KEY — a missing SUPABASE_SERVICE_KEY fails loudly instead of silently downgrading privilege"
    - "Resume state keyed strictly off error_message (never status) — exercise_import_log's locked CHECK constraint has no 'error' value"
    - "In-memory DISTINCT ON (source_id) ORDER BY processed_at DESC equivalent for an append-only, non-unique-keyed audit log"
    - "Unmappable category values are reported, never coerced to a default — silent relabelling is worse than a failed row"

key-files:
  created:
    - scripts/exercise-import/lib/supabase-write-client.ts
    - scripts/exercise-import/lib/supabase-write-client.test.ts
    - scripts/exercise-import/lib/import-log.ts
    - scripts/exercise-import/lib/import-log.test.ts
    - scripts/exercise-import/lib/category.ts
    - scripts/exercise-import/lib/category.test.ts
  modified: []

key-decisions:
  - "createWriteClient never falls back to SUPABASE_PUBLISHABLE_KEY when SUPABASE_SERVICE_KEY is unset, deliberately diverging from backend/api/src/middleware/auth.ts's admin-client pattern"
  - "reduceLatestBySourceId compares processed_at via Date.parse (not lexicographic string comparison) for robustness to differing ISO 8601 fractional-second precision"
  - "collectUnmappableCategories groups by the raw (unnormalized) category string, not the normalized form, so distinct raw spellings each get their own reported entry"

patterns-established:
  - "Pattern: pure resume-state reduction (import-log.ts) — no filesystem/DB access, caller performs I/O and passes rows in, mirrors report.ts's I/O-vs-logic split"
  - "Pattern: guard-before-write pure function (category.ts) — surfaces a constraint violation risk during preflight rather than mid-batch"

requirements-completed: [IMPORT-04, IMPORT-03]

# Metrics
duration: 30min
completed: 2026-08-15
---

# Phase 3 Plan 03: Write Client, Resume-State Reducer, Category Guard Summary

**Service-role Supabase write client with no publishable-key fallback, pure `error_message`-keyed resume-state reduction over `exercise_import_log`, and a category-mapping guard pinned to `exercises_category_check`'s six allowed values — all three built TDD (RED commit → GREEN commit) with full test coverage.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-15T16:16:00Z (context load)
- **Completed:** 2026-08-15T16:45:57Z
- **Tasks:** 3
- **Files modified:** 6 (all newly created)

## Accomplishments
- `createWriteClient()` — the one write-capable, service-role Supabase client permitted in the exercise-import pipeline, throwing loudly (naming both env vars) rather than silently downgrading to the publishable key
- `computeResumeState`/`reduceLatestBySourceId`/`buildResumeMap` — pure, order-independent resume-state reduction over `exercise_import_log` rows, keyed strictly off `error_message` (never the CHECK-constrained `status` enum, which has no `'error'` value)
- `ALLOWED_CATEGORIES`/`mapDatasetCategory`/`collectUnmappableCategories` — guards `public.exercises.category`'s `CHECK (category IN (...))` constraint (migration 004) against a mid-batch `23514` from free-text dataset values, with zero silent coercion to a default

## Task Commits

Each task followed the RED → GREEN TDD cycle with two commits:

1. **Task 1: Build the service-role write client**
   - `3485411` test(03-03): add failing test for createWriteClient (RED)
   - `9083739` feat(03-03): implement createWriteClient service-role client (GREEN)
2. **Task 2: Build lib/import-log.ts resume-state reduction (IMPORT-04)**
   - `2a548de` test(03-03): add failing test for import-log resume-state reduction (RED)
   - `fe0d182` feat(03-03): implement import-log resume-state reduction (IMPORT-04) (GREEN)
3. **Task 3: Build lib/category.ts to guard exercises_category_check**
   - `dacd293` test(03-03): add failing test for category mapping guard (RED)
   - `8956f65` feat(03-03): implement category mapping guard for exercises_category_check (GREEN)

_No REFACTOR commits were needed — each GREEN implementation was already the minimal correct shape after RED._

## Files Created/Modified
- `scripts/exercise-import/lib/supabase-write-client.ts` - `createWriteClient()`, service-role client factory, no publishable-key fallback
- `scripts/exercise-import/lib/supabase-write-client.test.ts` - 6 tests: env-var-required, auth options, no-downgrade rule, no key leak
- `scripts/exercise-import/lib/import-log.ts` - `ImportLogRow`, `ResumeState`, `computeResumeState`, `reduceLatestBySourceId`, `buildResumeMap`
- `scripts/exercise-import/lib/import-log.test.ts` - 12 tests: unprocessed/retry/done transitions, order-independent reduction, mixed-row `buildResumeMap`
- `scripts/exercise-import/lib/category.ts` - `ALLOWED_CATEGORIES`, `mapDatasetCategory`, `collectUnmappableCategories`
- `scripts/exercise-import/lib/category.test.ts` - 10 tests: exact/trim/case-insensitive mapping, no-coercion, deterministic grouping

## Decisions Made
- `createWriteClient` deliberately omits the `?? process.env.SUPABASE_PUBLISHABLE_KEY` fallback that `backend/api/src/middleware/auth.ts`'s admin client has — a merge run silently downgrading to a non-privileged key would fail every write with a confusing RLS-denied error instead of a clear "set SUPABASE_SERVICE_KEY" message.
- `reduceLatestBySourceId` compares `processed_at` via `Date.parse` rather than lexicographic string comparison — correct regardless of differing (but equally valid) ISO 8601 fractional-second precision between rows.
- `collectUnmappableCategories` groups by the **raw** (unnormalized) category string per distinct value present in the input, not by the normalized form — so `'Plyometrics'` and `'plyometrics'` in the same batch would each surface as a separate unmappable entry, giving the preflight summary full visibility into exactly what's in the dataset rather than collapsing case variants.

## Deviations from Plan

None — plan executed exactly as written. All behaviors listed in each task's `<behavior>` block are covered by the corresponding test file; all acceptance criteria (grep-asserted absence of `SUPABASE_PUBLISHABLE_KEY`/`console.*`/`createClient`/`readFileSync`/`import.meta`/the `'error'` literal, `ALLOWED_CATEGORIES` exact match to migration 004, dry-run scripts never importing `supabase-write-client`) were verified directly and pass.

## Issues Encountered

None.

## Self-Check: PASSED

All 6 created lib/test files verified present on disk; all 6 task commits (3 RED + 3 GREEN) plus the SUMMARY.md commit verified present in `git log`.

## User Setup Required

None - no external service configuration required. `SUPABASE_SERVICE_KEY` provisioning for actually *running* `merge.ts` against a live database is a later-plan (03-05/03-06) concern, not required for this plan's pure-function/unit-tested scope.

## Next Phase Readiness

- `createWriteClient`, `computeResumeState`/`reduceLatestBySourceId`/`buildResumeMap`, and `mapDatasetCategory`/`collectUnmappableCategories` are exported exactly per the interfaces plans 03-04 and 03-05 depend on (`scripts/exercise-import/lib/supabase-write-client.ts`, `lib/import-log.ts`, `lib/category.ts`) — ready to be composed into `merge-row.ts` (03-04) and the `merge.ts` entrypoint (03-05).
- **Requirements note:** IMPORT-03 and IMPORT-04 are listed in this plan's frontmatter, but are only *fully* satisfied once sibling plans 03-04/03-05/03-06 land the actual UPDATE/INSERT row-processing loop and the real-run verification — this plan builds the pure building blocks those plans compose over (write client, resume reducer, category guard), it does not itself perform any database write. `REQUIREMENTS.md`'s IMPORT-03/IMPORT-04 checkboxes were deliberately left unchecked by this plan; the orchestrator should mark them complete only once the full phase (all 6 plans) lands.
- No blockers for 03-04/03-05 — all three modules pass `npm run test:import` alongside the full existing 03-01/03-02 suite (118 tests total, 9 files, all green).

---
*Phase: 03-merge-human-approved-write*
*Completed: 2026-08-15*
