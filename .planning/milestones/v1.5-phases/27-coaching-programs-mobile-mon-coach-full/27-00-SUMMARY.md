---
phase: 27-coaching-programs-mobile-mon-coach-full
plan: "00"
subsystem: testing
tags: [vitest, coach, programs, tdd, stubs]

# Dependency graph
requires: []
provides:
  - "programs.spec.ts with 3 it.todo() stubs for PROG-01, PROG-06, PROG-08"
  - "Named test targets for Wave 2 implementors (27-04, 27-05)"
affects: [27-04, 27-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["it.todo() stubs as pre-implementation test scaffolding documenting required behaviors"]

key-files:
  created:
    - backend/api/test/coach/programs.spec.ts
  modified: []

key-decisions:
  - "Stubs use it.todo() (not it.skip) — vitest counts them as 'todo' and exits 0 without any test body"
  - "No imports of DB functions or fixtures added yet — routes don't exist until Wave 2"
  - "Pre-existing coach-profiles.spec.ts failure (RLS data leak) is out-of-scope for this plan"

patterns-established:
  - "Phase-level file comment on line 1 anchors the spec to its plan and wave for navigation"
  - "Stub labels include requirement ID + behavior description to serve as living documentation"

requirements-completed: [PROG-01, PROG-06, PROG-08]

# Metrics
duration: 6min
completed: 2026-05-20
---

# Phase 27 Plan 00: Coaching Programs Test Stubs Summary

**Vitest spec scaffolding with 3 it.todo() stubs for coach programs routes (PROG-01 template creation, PROG-06 fork-on-assign, PROG-08 seed visibility) — picked up by existing vitest config, exits 0**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-20T14:45:22Z
- **Completed:** 2026-05-20T14:51:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `backend/api/test/coach/programs.spec.ts` under `test/coach/` (matches vitest `test/**/*.{spec,test}.ts` glob)
- 3 it.todo() stubs document the three highest-priority behaviors: POST create template (PROG-01), POST fork-on-assign (PROG-06), GET seed templates (PROG-08)
- `npx vitest run test/coach/programs.spec.ts` exits 0 with "3 todo" — no new packages added

## Task Commits

Each task was committed atomically:

1. **Task 1: Create programs.spec.ts with it.todo() stubs** - `c13f262` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/api/test/coach/programs.spec.ts` - 3 it.todo() stubs for PROG-01, PROG-06, PROG-08 behaviors

## Decisions Made
- Used `it.todo()` (not `it.skip()`) — vitest semantics: todo = "planned, not started", which accurately reflects pre-implementation stubs
- No DB/fixture imports added: routes in `src/coach/programs/` do not yet exist; adding imports would cause import errors
- File-level comment on line 1 anchors the stub to its phase/plan/wave per existing pattern in `clients-roster.spec.ts`

## Deviations from Plan

None - plan executed exactly as written.

**Note (out-of-scope observation):** `test/rls/coach-profiles.spec.ts` has a pre-existing failure (expects 1 row, gets 4 — likely stale test data in Supabase). This existed before this plan and was NOT introduced by the new file. Logged to `deferred-items.md`.

## Issues Encountered
- `npm test` exits non-zero due to pre-existing `coach-profiles.spec.ts` failure. The new programs.spec.ts itself exits 0 when run in isolation (`npx vitest run test/coach/programs.spec.ts`). The --passWithNoTests flag applies to "no test files found" not to test failures in other files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test stubs ready for Wave 2 implementors to fill in test bodies once routes exist (27-04, 27-05)
- Wave 1 plans (27-01, 27-02, 27-03) can proceed in parallel — they target schemas and DB layer, not routes

---
*Phase: 27-coaching-programs-mobile-mon-coach-full*
*Completed: 2026-05-20*
