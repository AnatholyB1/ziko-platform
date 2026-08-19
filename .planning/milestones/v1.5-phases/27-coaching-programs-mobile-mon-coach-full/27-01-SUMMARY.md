---
phase: 27-coaching-programs-mobile-mon-coach-full
plan: "01"
subsystem: api
tags: [zod, typescript, coach-sdk, schemas, coaching-programs]

requires: []
provides:
  - ProgramExerciseSchema (D-04 field list, .strict()) in packages/coach-sdk/src/schemas/program-exercise.ts
  - ProgramSessionSchema (D-05: session_id, session_name, day_of_week 1-7, exercises array) in program-session.ts
  - ProgramWeekSchema (D-05: week_number, sessions array) in program-week.ts
  - All three schemas re-exported from packages/coach-sdk/src/schemas/index.ts
affects:
  - 27-02 (programsRouter imports ProgramWeekSchema for JSONB validation)
  - 27-03 (web editor imports types for TypeScript safety)
  - Any downstream plan that reads @ziko/coach-sdk schemas

tech-stack:
  added: []
  patterns:
    - "Zod .strict() schema hierarchy: ProgramExercise → ProgramSession → ProgramWeek (leaf to root composition)"
    - "Named + type re-exports on separate lines in index.ts following existing coach-sdk pattern"
    - "ESM .js extension on relative imports in packages/coach-sdk/src/schemas/"

key-files:
  created:
    - packages/coach-sdk/src/schemas/program-exercise.ts
    - packages/coach-sdk/src/schemas/program-session.ts
    - packages/coach-sdk/src/schemas/program-week.ts
  modified:
    - packages/coach-sdk/src/schemas/index.ts

key-decisions:
  - "ProgramExerciseSchema uses exercise_name (not name) with reps max 100 — deliberately distinct from imported-program.ts ExerciseSchema to avoid field-name collision in downstream consumers"
  - "target_rpe is z.number() (float, not int) per D-03 — allows 7.5 RPE granularity in coaching programs"
  - "All nullable fields omit .optional() — callers must explicitly pass null rather than omitting the key, ensuring strict JSONB shape at API boundaries"

patterns-established:
  - "D-04/D-05 schema hierarchy is the single source of truth for coaching program shape — downstream plans import from @ziko/coach-sdk, never redeclare"

requirements-completed:
  - PROG-01
  - PROG-02

duration: 5min
completed: 2026-05-20
---

# Phase 27 Plan 01: Coaching Program Zod Schema Hierarchy Summary

**Three strict Zod schemas (ProgramExercise, ProgramSession, ProgramWeek) implementing D-04/D-05 field contracts, exported from @ziko/coach-sdk as the single source of truth for all downstream coaching program work.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-20T09:45:36Z
- **Completed:** 2026-05-20T09:50:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `ProgramExerciseSchema` with all 9 D-04 fields: exercise_id (uuid nullable), exercise_name (min 1/max 100), sets (1-20), reps (nullable int 1-100), duration_seconds (nullable int min 1), target_rpe (nullable float 1-10), target_rir (nullable int 0-5), rest_seconds (nullable int 0-600), notes (nullable max 300). Schema uses `.strict()` per threat T-27-01-01.
- Created `ProgramSessionSchema` (session_id uuid, session_name, day_of_week int 1-7, exercises array of ProgramExerciseSchema) and `ProgramWeekSchema` (week_number int min 1, sessions array of ProgramSessionSchema) — both `.strict()`.
- Appended 6 lines to `packages/coach-sdk/src/schemas/index.ts` to re-export all three schemas and their inferred types, preserving all existing exports untouched.
- TypeScript compiles with zero errors across the entire coach-sdk package.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ProgramExerciseSchema (D-04)** - `631e3d0` (feat)
2. **Task 2: Create ProgramSessionSchema and ProgramWeekSchema (D-05)** - `bdec2ca` (feat)

**Plan metadata:** (docs: complete plan — see final commit)

## Files Created/Modified

- `packages/coach-sdk/src/schemas/program-exercise.ts` — ProgramExerciseSchema + ProgramExercise type (D-04, 9 fields, .strict())
- `packages/coach-sdk/src/schemas/program-session.ts` — ProgramSessionSchema + ProgramSession type (D-05)
- `packages/coach-sdk/src/schemas/program-week.ts` — ProgramWeekSchema + ProgramWeek type (D-05)
- `packages/coach-sdk/src/schemas/index.ts` — 6 lines appended (schema + type re-exports for all three)

## Decisions Made

- `exercise_name` field (not `name`) used to prevent name collision with `imported-program.ts` ExerciseSchema in consumers that import from both
- `target_rpe` kept as `z.number()` (float, not `z.number().int()`) to allow 7.5 RPE precision per D-03
- All nullable fields use `.nullable()` without `.optional()` — callers must explicitly pass `null`, enforcing strict JSONB shape at all API boundaries where the schema is applied

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three schemas exported from `@ziko/coach-sdk` and TypeScript-verified
- Ready for Plan 27-02 (programsRouter) which imports `ProgramWeekSchema` for JSONB column validation
- Ready for Plan 27-03 (web editor) which imports `ProgramExercise`, `ProgramSession`, `ProgramWeek` types

---
*Phase: 27-coaching-programs-mobile-mon-coach-full*
*Completed: 2026-05-20*
