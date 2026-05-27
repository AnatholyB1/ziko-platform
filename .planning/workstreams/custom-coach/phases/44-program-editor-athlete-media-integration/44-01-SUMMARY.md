---
phase: 44-program-editor-athlete-media-integration
plan: "44-01"
subsystem: backend/coach/programs
tags: [exercises, search, coach_custom, merge]
dependency_graph:
  requires: []
  provides: [searchExercises-merged-results]
  affects: [backend/api/src/coach/programs/db.ts, backend/api/src/coach/programs/service.ts]
tech_stack:
  added: []
  patterns: [dual-query-merge, source-tagging]
key_files:
  modified:
    - backend/api/src/coach/programs/db.ts
    - backend/api/src/coach/programs/service.ts
decisions:
  - searchExercises returns up to 20 items total (10 custom + 10 global, no merged limit)
  - custom items sorted alphabetically; global items use existing prefix-first sort
  - coachId always derived from JWT auth, never client-supplied (IDOR mitigation)
metrics:
  duration: ~5 min
  completed: 2026-05-27
  tasks_completed: 2
  files_modified: 2
---

# Phase 44 Plan 01: Extend searchExercises to merge coach_custom exercises Summary

## One-liner

`searchExercises()` now queries both `exercises` and `coach_exercises` tables, returning merged results with `source: "global" | "coach_custom"` — custom items float first.

## What Was Implemented

### Task 1 — Updated `searchExercises()` in `backend/api/src/coach/programs/db.ts`

- Changed signature from `searchExercises(jwt, query)` to `searchExercises(jwt, coachId: string, query: string)`
- Added a second Supabase query on `coach_exercises` filtered by `coach_id = coachId` and `ilike('name', '%query%')` with `.limit(10)`
- Global results mapped to `{ id, name, category, source: "global", coach_exercise_id: null }`
- Custom results mapped to `{ id: ce.id, name: ce.name, category: ce.category, source: "coach_custom", coach_exercise_id: ce.id }`
- Custom items sorted alphabetically by name; global items retain existing prefix-first then alphabetical sort
- Return shape: `{ exercises: [...customSorted, ...globalSorted] }`

### Task 2 — Updated route handler in `backend/api/src/coach/programs/service.ts`

- Changed `const { userId: _coachId }` to `const { userId: coachId }` (removed underscore prefix)
- Route now calls `searchExercises(jwt, coachId, q.trim())` — `coachId` sourced from `c.get('auth').userId` (JWT)

## Verification Result

`rtk tsc --noEmit` in `backend/api/` exits 0 — TypeScript compilation completed with no errors.

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-44-01-01: IDOR via client-supplied coachId | Mitigated — coachId comes from `c.get('auth').userId` (JWT-derived) |
| T-44-01-02: Injection via `q` param | Mitigated — `.ilike()` uses parameterized query via Supabase JS client |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `backend/api/src/coach/programs/db.ts` — modified and committed (5a34353 / 83beb1a)
- `backend/api/src/coach/programs/service.ts` — modified and committed (83beb1a)
- TypeScript compilation exits 0
