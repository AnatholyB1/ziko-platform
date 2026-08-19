---
phase: 27-coaching-programs-mobile-mon-coach-full
plan: 04
subsystem: api
tags: [hono, supabase, coach, programs, typescript, zod]

requires:
  - phase: 27-coaching-programs-mobile-mon-coach-full
    plan: 01
    provides: ProgramWeekSchema, ProgramSessionSchema, ProgramExerciseSchema in @ziko/coach-sdk
  - phase: 27-coaching-programs-mobile-mon-coach-full
    plan: 02
    provides: workout_programs table with created_by_coach_id, assigned_to_user_id, is_template, weeks_data JSONB, template_source_id, start_date; coach_program_folders table

provides:
  - programsRouter with 11 routes under /coach/programs
  - backend/api/src/coach/programs/types.ts — CreateProgramBody, UpdateProgramBody, AssignProgramBody, CreateFolderBody, CreateExerciseBody
  - backend/api/src/coach/programs/db.ts — 11 DB functions (listPrograms, createProgram, getProgram, updateProgram, deleteProgram, assignProgram, duplicateProgram, listFolders, createFolder, searchExercises, createExercise)
  - backend/api/src/coach/programs/service.ts — Hono programsRouter
  - backend/api/src/app.ts — mounts programsRouter at /coach/programs

affects:
  - 27-05 (client programs list reads from workout_programs via getProgramsForClient)
  - 28-ui-design-mon-coach (web UI consumes /coach/programs endpoints)

tech-stack:
  added: []
  patterns:
    - "static Hono routes (/exercises, /folders) registered before /:id to prevent param collision"
    - "z.array(ProgramWeekSchema).safeParse() validates weeks_data before any DB write (T-27-04-02, T-27-04-03)"
    - "?confirmed=true query guard on DELETE (T-27-04-05)"
    - "assignProgram WHERE created_by_coach_id=coachId on template SELECT guards IDOR (T-27-04-01)"
    - "RLS on INSERT for assigned_to_user_id enforces is_coach_of() at DB level"
    - "createUserClient(jwt) — never service-role"

key-files:
  created:
    - backend/api/src/coach/programs/types.ts
    - backend/api/src/coach/programs/db.ts
    - backend/api/src/coach/programs/service.ts
  modified:
    - backend/api/src/app.ts
    - packages/coach-sdk/dist/ (rebuilt to expose ProgramWeek type)

key-decisions:
  - "Static routes /exercises and /folders registered before /:id in Hono to prevent param collision"
  - "weeks_data validated with z.array(ProgramWeekSchema).safeParse() at route entry, not just at service level"
  - "assignProgram fetches template with WHERE created_by_coach_id=coachId before INSERT — defense-in-depth beyond RLS"
  - "duplicateProgram appends ' (copie)' suffix to name; is_template=TRUE; coach owns copy"
  - "start_date set to CURRENT_DATE (toISOString().split('T')[0]) on assign fork"
  - "searchExercises uses JS-side prefix-sort since Supabase JS client doesn't support raw CASE ordering"

requirements-completed: [PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, PROG-06, PROG-07, PROG-08]

duration: 12min
completed: 2026-05-20
---

# Phase 27 Plan 04: Programs Router Summary

**Hono programsRouter with 11 routes under /coach/programs — full template lifecycle including exercise search, folder management, assign-to-clients, and duplicate**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-20T22:09:49Z
- **Completed:** 2026-05-20T22:21:57Z
- **Tasks:** 2
- **Files modified:** 4 (3 created + 1 edited)

## Accomplishments

- Created programs/types.ts with 5 body interfaces (CreateProgramBody, UpdateProgramBody, AssignProgramBody, CreateFolderBody, CreateExerciseBody)
- Created programs/db.ts with createUserClient pattern + 11 DB functions covering full program lifecycle
- Created programs/service.ts with 11 Hono routes in correct static-before-param registration order
- Mounted programsRouter at /coach/programs in app.ts
- Rebuilt @ziko/coach-sdk dist to expose ProgramWeek/ProgramWeekSchema (was missing from prior build)
- All threat mitigations from T-27-04-01 through T-27-04-05 implemented

## Task Commits

1. **Task 1: types.ts and db.ts** - `54af0a8` (feat)
2. **Task 2: service.ts and app.ts mount** - `a7eb777` (feat, bundled with fix(31) in same commit)

## Files Created/Modified

- `backend/api/src/coach/programs/types.ts` — 5 request body interfaces
- `backend/api/src/coach/programs/db.ts` — createUserClient + 11 DB query functions
- `backend/api/src/coach/programs/service.ts` — programsRouter with 11 routes
- `backend/api/src/app.ts` — added programsRouter import + app.route('/coach/programs', programsRouter)

## Decisions Made

- Static routes (/exercises, /folders) registered before /:id — critical Hono route ordering
- weeks_data Zod validation at route entry before any DB write (T-27-04-02/T-27-04-03)
- assignProgram uses explicit WHERE created_by_coach_id=coachId on template fetch — defense-in-depth IDOR guard beyond RLS
- searchExercises JS-side prefix sort (Supabase JS client doesn't support raw CASE ordering)
- DELETE /:id requires ?confirmed=true query param (RevokeConfirmModal-style guard, T-27-04-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt @ziko/coach-sdk to expose ProgramWeek type**
- **Found during:** Task 1 (creating types.ts)
- **Issue:** `import type { ProgramWeek } from '@ziko/coach-sdk'` failed with TS2305 — the dist was from before plan 27-01 added the program schemas
- **Fix:** Ran `npm run build` in packages/coach-sdk to regenerate dist including ProgramWeek, ProgramWeekSchema, ProgramSessionSchema, ProgramExerciseSchema
- **Files modified:** packages/coach-sdk/dist/ (gitignored, rebuilt)
- **Verification:** tsc --noEmit exit 0 with 0 errors
- **Committed in:** 54af0a8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Build fix required for type resolution. No scope creep.

## Issues Encountered

- Task 2 service.ts and app.ts were staged and committed as part of an existing `fix(31)` commit (a7eb777) due to RTK auto-stage behavior. Content is correct and fully committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- /coach/programs endpoints ready for web UI consumption (Phase 28)
- assignProgram route enforces is_coach_of() via RLS + explicit WHERE clause
- Exercise search endpoint ready for program builder UI (PROG-08)

---
*Phase: 27-coaching-programs-mobile-mon-coach-full*
*Completed: 2026-05-20*
