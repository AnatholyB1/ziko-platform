---
phase: 01-foundation
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, storage, migrations, coach-branding]

# Dependency graph
requires:
  - phase: migration-034
    provides: coach_profiles table + handle_updated_at() trigger function
  - phase: migration-035
    provides: is_coach_of(coach UUID, client UUID) SECURITY DEFINER function
provides:
  - coach_branding table with primary_color hex CHECK and tone enum CHECK
  - coach-logos public storage bucket
  - RLS policies for coach ownership and athlete read via is_coach_of()
  - Storage RLS restricting coaches to their own UUID-prefixed paths
affects: [01-02, 01-03, da-coach-api, da-coach-mobile, coach-branding-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SET LOCAL lock_timeout = '5s' on all migrations"
    - "CREATE TABLE IF NOT EXISTS with REFERENCES auth.users(id) ON DELETE CASCADE"
    - "RLS dual-policy pattern: owner ALL + linked-entity SELECT via SECURITY DEFINER function"
    - "Storage bucket RLS: foldername[1] = auth.uid()::text for per-coach path isolation"

key-files:
  created:
    - supabase/migrations/054_coach_branding.sql
  modified: []

key-decisions:
  - "tone stored as TEXT CHECK (not ENUM) for forward-compatible schema evolution — matches migration 034 pattern"
  - "logo_url stores bucket path (not full URL) — avoids URL coupling to Supabase project domain"
  - "coach-logos bucket is public=true (intentional per D-16) — logo images are non-sensitive public assets"
  - "Storage RLS uses (storage.foldername(name))[1] = auth.uid()::text to enforce per-coach path prefix"

patterns-established:
  - "RLS athlete read policy: public.is_coach_of(coach_id, auth.uid()) — coach_id first, client second"

requirements-completed: [FOUND-01, FOUND-04]

# Metrics
duration: 4min
completed: 2026-05-26
---

# Phase 01 Plan 01: Coach Branding Migration Summary

**Migration 054: `coach_branding` table with hex/tone CHECK constraints, `coach-logos` public bucket, and dual RLS policies (coach ownership + athlete read via `is_coach_of`)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-26T10:07:17Z
- **Completed:** 2026-05-26T10:11:27Z
- **Tasks:** 1 of 2 completed (Task 2 is checkpoint:human-verify — awaiting `supabase db push`)
- **Files modified:** 1

## Accomplishments

- `supabase/migrations/054_coach_branding.sql` written with all required DDL, RLS policies, and storage bucket creation
- All 9 acceptance criteria verified and passing
- Migration committed to git on branch `dev`

## Task Commits

1. **Task 1: Write migration 054_coach_branding.sql** — `97417fa` (feat)

**Plan metadata:** pending (after checkpoint resolution)

## Files Created/Modified

- `supabase/migrations/054_coach_branding.sql` — coach_branding table + updated_at trigger + RLS + coach-logos bucket + storage RLS

## Decisions Made

- `tone` uses TEXT CHECK instead of ENUM for forward-compatible schema evolution — consistent with migration 034 pattern
- `logo_url` stores Supabase Storage path (not full URL) to avoid tight coupling with project domain
- `coach-logos` bucket is `public=true` per D-16 — logo images are non-sensitive public branding assets
- Storage RLS enforces `(storage.foldername(name))[1] = auth.uid()::text` to prevent cross-coach path writes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**`supabase db push` required.** Task 2 (checkpoint:human-verify) is blocking. See instructions below.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's threat model:
- T-01-01 through T-01-05 all mitigated as specified in the migration
- No new network endpoints, auth paths, or file access patterns introduced

## Known Stubs

None.

## Next Phase Readiness

- Migration file written and committed — ready for `supabase db push`
- Once pushed, Plans 02 and 03 can proceed (Plan 02 requires the live table for API integration)
- Blocker: Task 2 (push to live database) must complete before Plan 03 can be verified

---
*Phase: 01-foundation*
*Completed: 2026-05-26*
