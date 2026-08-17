---
phase: 42-audit-client-programs-visibility
plan: "01"
subsystem: api
tags: [supabase, hono, typescript, coach, programs]

requires:
  - phase: coach-clients
    provides: getProgramsForClient function and GET /:id/programs route

provides:
  - "getProgramsForClient returns { active: Program | null, history: Program[] } — removes created_by_coach_id filter"

affects:
  - coach-programs-ui
  - ClientProgramsContent

tech-stack:
  added: []
  patterns:
    - "active/history split: find first enriched program with start_date <= todayStr as active; remainder as history"

key-files:
  created: []
  modified:
    - backend/api/src/coach/clients/db.ts

key-decisions:
  - "Remove .eq('created_by_coach_id', coachId) app-layer filter — RLS policy workout_programs_coach_read enforces coach-to-athlete link at DB level"
  - "Active program = first enriched entry (sorted start_date DESC NULLS LAST) with start_date != null and start_date <= todayStr"
  - "compliance_pct remains computed only at i===0 (first in sorted order); after split this naturally aligns with activeProgram"
  - "coachId kept in function signature for future IDOR audit usage even though no longer used in query"

requirements-completed: [AUDIT-01]

duration: 8min
completed: 2026-05-26
---

# Phase 42 Plan 01: Fix getProgramsForClient — Remove Coach Filter, Return { active, history } Summary

**getProgramsForClient rewritten to drop the created_by_coach_id filter and return { active: Program | null, history: Program[] } with today-based active/history split**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed `.eq('created_by_coach_id', coachId)` from the Supabase query so programs created by any coach but assigned to the athlete are returned
- Changed return type from `Promise<{ programs: any[] }>` to `Promise<{ active: any | null; history: any[] }>`
- Changed early-return guard from `return { programs: [] }` to `return { active: null, history: [] }`
- Added `todayStr` computation and active/history split after enrichment loop
- TypeScript compiles cleanly across backend/api

## Task Commits

1. **Task 1: Fix getProgramsForClient — remove coach filter, return { active, history }** - `4128dac` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/api/src/coach/clients/db.ts` — modified `getProgramsForClient`: removed `created_by_coach_id` filter, updated return type, changed early-return guard, added todayStr + active/history split replacing `return { programs: enriched }`

## Decisions Made

- RLS policy `workout_programs_coach_read` already enforces the coach-to-athlete link at the database level (T-42-01 in threat model), so the app-layer `created_by_coach_id` filter was redundant and incorrect — removing it is safe
- Active program selection uses `start_date <= todayStr` (string comparison on ISO date format), consistent with existing `start_date` field type in the DB schema
- `activeProgram ?? null` is redundant (`.find()` returns `undefined` which we already coerce via `?? null`) but kept for explicitness as specified in the plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Results

TypeScript check (`rtk tsc --noEmit`): **PASSED** — no errors.

service.ts line 397 confirmed unchanged: `return c.json(result)` — the new `{ active, history }` shape flows through to the HTTP response without any service-layer changes.

Acceptance criteria checklist:
- [x] Function signature: `Promise<{ active: any | null; history: any[] }>`
- [x] No `.eq('created_by_coach_id', coachId)` in query
- [x] `.eq('assigned_to_user_id', clientId)` present
- [x] `todayStr` declared with `new Date().toISOString().split('T')[0]`
- [x] Final return: `return { active: activeProgram ?? null, history }`
- [x] Early-return guard: `return { active: null, history: [] }`
- [x] TypeScript compiles cleanly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GET /coach/clients/:id/programs now returns the shape `{ active: ActiveProgram | null, history: HistoryProgram[] }` that `ClientProgramsContent.tsx` expects
- The Programs tab in the coach client detail view should now render the active program card and history list correctly
- No further backend changes needed for this bug fix

---
*Phase: 42-audit-client-programs-visibility*
*Completed: 2026-05-26*
