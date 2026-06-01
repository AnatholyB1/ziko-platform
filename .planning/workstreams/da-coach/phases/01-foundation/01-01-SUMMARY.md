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
duration: 24min
completed: 2026-05-26
---

# Phase 01 Plan 01: Coach Branding Migration Summary

**Migration 054: `coach_branding` table with hex/tone CHECK constraints, `coach-logos` public bucket, and dual RLS policies (coach ownership + athlete read via `is_coach_of`)**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-26T10:07:17Z
- **Completed:** 2026-05-26T10:31:02Z
- **Tasks:** 2 of 2 completed
- **Files modified:** 1

## Accomplishments

- `supabase/migrations/054_coach_branding.sql` written with all required DDL, RLS policies, and storage bucket creation
- All 9 acceptance criteria verified and passing
- Migration committed to git on branch `dev`
- Migration applied to live Supabase project (slkobhavpwsubnsmuhya) via MCP `apply_migration` — `coach_branding` table and `coach-logos` bucket confirmed live

## Task Commits

1. **Task 1: Write migration 054_coach_branding.sql** — `97417fa` (feat)
2. **Task 2: Push migration to live database** — completed via MCP apply_migration (no separate commit — push is a remote operation)

**Plan metadata:** `6b36743` (docs: SUMMARY + checkpoint) → updated below

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

None - migration applied to live database via MCP apply_migration.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's threat model:
- T-01-01 through T-01-05 all mitigated as specified in the migration
- No new network endpoints, auth paths, or file access patterns introduced

## Known Stubs

None.

## Next Phase Readiness

- `coach_branding` table live with all CHECK constraints, trigger, and RLS
- `coach-logos` public bucket live in Supabase Storage
- Plans 02 and 03 can now proceed — the data layer prerequisite is complete
- No blockers remaining for Phase 1

---
*Phase: 01-foundation*
*Completed: 2026-05-26*
