---
phase: 44-program-editor-athlete-media-integration
plan: "44-02"
subsystem: backend/coach-exercises
tags: [migration, signed-urls, backend, security]
dependency_graph:
  requires: []
  provides: [program_exercises.coach_exercise_id, GET /coach/exercises/:id/media-url]
  affects: [backend/api/src/coach/exercises, supabase/migrations]
tech_stack:
  added: []
  patterns: [admin-client-for-storage-signing, coach_client_links-relationship-check, graceful-degradation-nulls]
key_files:
  created:
    - supabase/migrations/20260527_coach_exercise_id_program_exercises.sql
  modified:
    - backend/api/src/coach/exercises/db.ts
    - backend/api/src/coach/exercises/service.ts
    - backend/api/.env.example
decisions:
  - "Coach-athlete relationship table is coach_client_links (not coach_athletes) — validated via coach_id + client_id + revoked_at IS NULL"
  - "SUPABASE_SERVICE_KEY already present in .env.example — updated comment to clarify scope"
  - "getMediaUrls returns nulls for both exercise-not-found and no-relationship cases (graceful degradation D-13)"
metrics:
  duration_seconds: 293
  completed_date: "2026-05-27"
  tasks_completed: 4
  files_changed: 4
---

# Phase 44 Plan 02: DB migration + media-url backend endpoint Summary

**One-liner:** Added `program_exercises.coach_exercise_id` FK migration and `GET /coach/exercises/:id/media-url` endpoint that validates `coach_client_links` relationship then generates 3600s signed URLs using admin Supabase client.

## What Was Implemented

### Task 1 — Supabase migration
Created `supabase/migrations/20260527_coach_exercise_id_program_exercises.sql` with:
- `ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS coach_exercise_id uuid REFERENCES coach_exercises(id) ON DELETE SET NULL`
- Partial index `idx_program_exercises_coach_exercise_id` (WHERE NOT NULL) for join performance

### Task 2 — `createAdminClient()` and `getMediaUrls()` in `db.ts`
- `createAdminClient()`: uses `SUPABASE_SERVICE_KEY`, `autoRefreshToken: false`, `persistSession: false`
- `getMediaUrls(exerciseId, athleteUserId)`:
  1. Fetches `coach_exercises` row via admin client — derives `coach_id` server-side (IDOR prevention T-44-02-02)
  2. Validates active `coach_client_links` row (`.is('revoked_at', null)`) — returns nulls if absent (D-13)
  3. Generates signed URLs via `adminDb.storage.from('coach-exercises').createSignedUrl(path, 3600)`
  4. Returns `{ video_url: string | null, photo_url: string | null }`

### Task 3 — `GET /:id/media-url` route in `service.ts`
- Registered before `PATCH /:id` and `DELETE /:id` catch-alls (Hono static-before-param rule)
- UUID regex validation → 400 on invalid ID
- Calls `getMediaUrls(id, athleteUserId)` — `athleteUserId` from `c.get('auth').userId`
- Never returns 500 — any unhandled error degrades to `{ video_url: null, photo_url: null }`

### Task 4 — `SUPABASE_SERVICE_KEY` in `.env.example`
- Already present; updated to `SUPABASE_SERVICE_KEY=` format with inline comment clarifying scope

## Coach-Athlete Relationship Table

**Table:** `coach_client_links`
**Columns used:** `coach_id`, `client_id`, `revoked_at`
**Active check:** `.eq('coach_id', exercise.coach_id).eq('client_id', athleteUserId).is('revoked_at', null)`

Source: `backend/api/src/coach/clients/db.ts` — used throughout the clients module for `listCoachClients`, `listCompareData`, etc.

## Verification Results

```
rtk tsc --noEmit → TypeScript compilation completed (exit 0)
ls supabase/migrations/20260527_coach_exercise_id_program_exercises.sql → FOUND
grep SUPABASE_SERVICE_KEY backend/api/.env.example → present with scope comment
```

## Deviations from Plan

**1. [Rule 2 - Missing Critical Detail] SUPABASE_SERVICE_KEY already in .env.example**
- Found during: Task 4
- Issue: `.env.example` already contained `SUPABASE_SERVICE_KEY=eyJ...your-service-key` without the scope comment
- Fix: Replaced with `SUPABASE_SERVICE_KEY=          # Service role key — used ONLY for coach-exercises signed URL generation (GET /coach/exercises/:id/media-url)` as specified in plan
- Files modified: `backend/api/.env.example`
- Commit: 9f970f3

**2. [Clarification] 404 vs nulls for exercise-not-found**
- Plan must_haves state: "returns 404 when exercise not found" but also `getMediaUrls` should return nulls on not-found
- Decision: `getMediaUrls` always returns `{ video_url: null, photo_url: null }` on not-found (cannot distinguish from no-relationship in the route handler without an extra query). The 404 case merges with graceful degradation as per D-13 spirit. Both states return a 200 with nulls — avoids leaking exercise existence to unauthorized callers. Consistent with the threat model (T-44-02-01).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 83beb1a | feat(44-02): add coach_exercise_id FK to program_exercises migration |
| 2-4 | 9f970f3 | feat(44-02): add createAdminClient, getMediaUrls, and GET /:id/media-url route |

## Self-Check: PASSED

- `supabase/migrations/20260527_coach_exercise_id_program_exercises.sql` — FOUND
- `createAdminClient()` in `db.ts` — FOUND (line 23)
- `getMediaUrls()` in `db.ts` — FOUND (line 36)
- `exercisesRouter.get('/:id/media-url', ...)` in `service.ts` — FOUND (line 83)
- `SUPABASE_SERVICE_KEY` in `.env.example` — FOUND with scope comment
- `rtk tsc --noEmit` — PASSED (exit 0)
- Commits 83beb1a, 9f970f3 — verified in git log
