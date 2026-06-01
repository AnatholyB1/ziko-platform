---
phase: 43-coach-exercises-backend-ui
plan: 2
subsystem: backend/coach-exercises
tags: [hono, supabase, storage, crud, rls]
dependency_graph:
  requires: [43-01]
  provides: [GET /coach/exercises, POST /coach/exercises, PATCH /coach/exercises/:id, DELETE /coach/exercises/:id]
  affects: [backend/api/src/app.ts]
tech_stack:
  added: []
  patterns: [JWT-user-client (ARCH-03), Hono router with authMiddleware, Supabase storage.remove before DB delete]
key_files:
  created:
    - backend/api/src/coach/exercises/types.ts
    - backend/api/src/coach/exercises/db.ts
    - backend/api/src/coach/exercises/service.ts
  modified:
    - backend/api/src/app.ts
decisions:
  - "deleteExercise fetches row first (IDOR guard: coach_id filter) before deleting storage and DB row"
  - "Category validation uses EXERCISE_CATEGORIES const tuple for single source of truth"
  - "PATCH validates category if provided, so partial updates can also be validated"
metrics:
  duration: "13 minutes"
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 3
  files_modified: 1
---

# Phase 43 Plan 2: Coach Exercises Backend — Summary

Hono backend module for coach custom exercises with types, DB CRUD functions (storage cleanup on delete), and HTTP router registered in app.ts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create types.ts | 49cbf5d | backend/api/src/coach/exercises/types.ts |
| 2 | Create db.ts — CRUD + storage cleanup | 37583ee | backend/api/src/coach/exercises/db.ts |
| 3 | Create service.ts — Hono router | bd82bf1 | backend/api/src/coach/exercises/service.ts |
| 4 | Register exercisesRouter in app.ts | a42aae9 | backend/api/src/app.ts |

## Must-Haves Verification

- [x] `types.ts` exports `CoachExercise`, `CreateExerciseBody`, `UpdateExerciseBody`, `EXERCISE_CATEGORIES`
- [x] `CoachExercise` has `video_path` and `photo_path` as `string | null`
- [x] `EXERCISE_CATEGORIES` tuple contains all 6 values (Force/Cardio/Mobilité/HIIT/Hyrox/Autre)
- [x] `db.ts` exports `listExercises`, `createExercise`, `updateExercise`, `deleteExercise`
- [x] All DB functions use `createUserClient(jwt)` pattern (ARCH-03)
- [x] `deleteExercise` calls `supabase.storage.from('coach-exercises').remove(...)` before deleting DB row
- [x] `createExercise` sets `muscle_groups` to `body.muscle_groups ?? []` (never undefined)
- [x] `updateExercise` sets `updated_at` explicitly
- [x] `service.ts` exports `exercisesRouter` with 4 routes: GET /, POST /, PATCH /:id, DELETE /:id
- [x] `authMiddleware` applied via `exercisesRouter.use('*', authMiddleware)`
- [x] POST validates name (required, max 100) and category (EXERCISE_CATEGORIES enum) — returns 400 with `field`
- [x] PATCH/:id returns 404 when not found or not owned
- [x] DELETE/:id removes storage files then DB row, returns `{ deleted: true }`
- [x] `app.ts` imports and registers `app.route('/coach/exercises', exercisesRouter)` after coachAiRouter

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-43-02-01 (IDOR) | Mitigated — all DB queries use `AND coach_id=coachId` explicit filter + RLS |
| T-43-02-02 (Tampering) | Mitigated — category validated against EXERCISE_CATEGORIES enum; name length checked |
| T-43-02-03 (Info Disclosure) | Accepted — video_path/photo_path are storage paths; signed URLs generated client-side |
| T-43-02-SC (Supply Chain) | Accepted — no new npm packages; reuses @supabase/supabase-js and hono |

## Deferred Items

**Pre-existing TypeScript error (out of scope):**
- `backend/api/src/coach/clients/db.ts` L89: TS2741 — Property 'branding' is missing in return type. This error predates this plan and is unrelated to the exercises module.

## Self-Check: PASSED

- [x] `backend/api/src/coach/exercises/types.ts` — exists
- [x] `backend/api/src/coach/exercises/db.ts` — exists
- [x] `backend/api/src/coach/exercises/service.ts` — exists
- [x] `app.ts` contains import and route for exercisesRouter
- [x] Commits 49cbf5d, 37583ee, bd82bf1, a42aae9 — all present in git log
