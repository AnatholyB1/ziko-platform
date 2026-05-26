---
phase: 43-coach-exercises-backend-ui
plan: 1
subsystem: database
tags: [supabase, postgresql, rls, storage, migration]

# Dependency graph
requires: []
provides:
  - "coach_exercises table with RLS (auth.uid() = coach_id)"
  - "coach-exercises private Storage bucket with 3 per-uid object policies"
  - "ALLOWED_BUCKETS updated in Next.js upload-url route"
  - "ALLOWED_BUCKETS updated in Hono backend storage router"
affects:
  - 43-02
  - 43-03
  - 43-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SET LOCAL lock_timeout = '5s' migration header"
    - "Storage bucket created via INSERT INTO storage.buckets ON CONFLICT DO NOTHING"
    - "Per-uid storage prefix policy: (storage.foldername(name))[1] = auth.uid()::text"
    - "No updated_at trigger — API sets explicitly on PATCH"

key-files:
  created:
    - "supabase/migrations/055_coach_exercises_schema.sql"
  modified:
    - "apps/web/src/app/api/storage/upload-url/route.ts"
    - "backend/api/src/routes/storage.ts"

key-decisions:
  - "Migration numbered 055 (054 already taken by coach_branding)"
  - "No updated_at trigger — consistent with programs module, API sets it explicitly"
  - "video_path and photo_path stored as storage paths, not signed URLs (signed URLs expire)"
  - "category CHECK: Force/Cardio/Mobilité/HIIT/Hyrox/Autre (6 values per UI-SPEC)"
  - "muscle_groups TEXT[] NOT NULL DEFAULT '{}' — optional but never null"

patterns-established:
  - "Pattern: ALLOWED_BUCKETS allowlist must be updated in both Next.js route and Hono router when adding a new storage bucket"
  - "Pattern: Storage RLS via storage.foldername + auth.uid()::text prefix (mirrors 037_coach_kyc_bucket.sql)"

requirements-completed:
  - EXLIB-01
  - EXLIB-02
  - EXLIB-03
  - EXLIB-04

# Metrics
duration: 9min
completed: 2026-05-26
---

# Phase 43 Plan 1: Coach Exercises Backend UI Summary

**PostgreSQL coach_exercises table (RLS + category CHECK) and private coach-exercises Storage bucket provisioned via migration 055, with ALLOWED_BUCKETS updated in both upload-url endpoints**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-26T10:09:20Z
- **Completed:** 2026-05-26T10:18:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created migration 055 with coach_exercises table (10 columns, RLS, category CHECK, muscle_groups array, nullable media paths)
- Provisioned private coach-exercises Storage bucket with insert/select/delete policies scoped to auth.uid() prefix
- Added 'coach-exercises' to ALLOWED_BUCKETS in Next.js upload-url API route
- Added 'coach-exercises' to ALLOWED_BUCKETS in Hono backend storage router

## Task Commits

1. **Task 1: Write migration 055** - `342d7ec` (feat)
2. **Task 2: Add coach-exercises to Next.js allowlist** - `0903448` (feat)
3. **Task 3: Add coach-exercises to Hono backend allowlist** - `7bfa8be` (feat)

## Files Created/Modified
- `supabase/migrations/055_coach_exercises_schema.sql` - coach_exercises table + RLS + coach-exercises storage bucket + 3 storage policies
- `apps/web/src/app/api/storage/upload-url/route.ts` - ALLOWED_BUCKETS extended with 'coach-exercises'
- `backend/api/src/routes/storage.ts` - ALLOWED_BUCKETS extended with 'coach-exercises'

## Decisions Made
- Migration numbered 055 because 054 is already taken by coach_branding (confirmed via ls check before writing)
- No updated_at trigger added — API will set updated_at explicitly on PATCH, consistent with programs module pattern
- video_path and photo_path stored as TEXT storage paths, not signed URLs (signed URLs expire per UI-SPEC design rationale)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-43-01-01: Spoofing coach_exercises.coach_id | Mitigated — RLS FOR ALL USING (auth.uid() = coach_id) |
| T-43-01-02: Cross-coach bucket access | Mitigated — storage policy with uid prefix |
| T-43-01-03: ALLOWED_BUCKETS bypass | Mitigated — both endpoints validate bucket before generating signed URL |

## User Setup Required

**supabase db push** must be run to apply migration 055 before plans 43-02 through 43-04 can be tested end-to-end.

```bash
supabase db push
```

## Next Phase Readiness
- Migration 055 ready for `supabase db push`
- coach-exercises bucket allowlisted in both upload-url endpoints
- Plans 43-02 (Hono CRUD API), 43-03 (Next.js API route + types), 43-04 (Web UI) can proceed

---
*Phase: 43-coach-exercises-backend-ui*
*Completed: 2026-05-26*
