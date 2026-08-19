---
phase: 14-supabase-storage
plan: 01
subsystem: database
tags: [supabase, storage, rls, sql, migration, buckets]

# Dependency graph
requires:
  - phase: 13-api-security-hardening
    provides: Hardened Hono API with CORS, secureHeaders, and Zod validation
provides:
  - Supabase Storage migration 025 with 3 private buckets and 7 RLS policies
  - profile-photos bucket (private writes, public reads via TO public policy)
  - scan-photos bucket (private, authenticated owner-only INSERT/SELECT/DELETE)
  - exports bucket (private, authenticated owner-only SELECT, no mobile INSERT)
affects: [14-02-backend-upload-url, 14-03-mobile-upload, 15-lifecycle-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Storage RLS path-prefix pattern: (storage.foldername(name))[1] = auth.uid()::text"
    - "Idempotent bucket insert: INSERT INTO storage.buckets ON CONFLICT (id) DO NOTHING"
    - "Public read without path-prefix: FOR SELECT TO public USING (bucket_id = 'bucket-id')"

key-files:
  created:
    - supabase/migrations/025_storage_buckets.sql
  modified: []

key-decisions:
  - "profile-photos: public=false in bucket row but SELECT TO public in policy — bucket flag controls Supabase dashboard UI, RLS policy controls actual access"
  - "exports bucket has no INSERT policy — server-side writes only (Phase 15), mobile can only read via signed download URLs"
  - "storage.foldername(name))[1] pattern enforces path-prefix ownership — diverges from all 24 previous migrations which use auth.uid() = user_id (not applicable on storage.objects)"
  - "Existing avatars bucket (migration 017) left untouched — backward compat for existing avatar_url values"

patterns-established:
  - "Storage RLS: always use (storage.foldername(name))[1] = auth.uid()::text for path-prefix enforcement — never copy auth.uid() = user_id from table migrations"
  - "Public read bucket policy: FOR SELECT TO public USING (bucket_id = 'x') — no path restriction needed"

requirements-completed: [STORE-01, STORE-02, STORE-03, STORE-04]

# Metrics
duration: 1min
completed: 2026-04-03
---

# Phase 14 Plan 01: Storage Buckets Migration Summary

**Three private Supabase Storage buckets with 7 RLS policies using path-prefix enforcement — profile-photos (public read), scan-photos (owner-only), exports (read-only, server writes deferred to Phase 15)**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-03T10:33:32Z
- **Completed:** 2026-04-03T10:34:29Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments

- Created `supabase/migrations/025_storage_buckets.sql` with all 3 storage buckets and 7 RLS policies
- Established `profile-photos` bucket with INSERT/UPDATE for authenticated users and SELECT for public (no expiring URLs needed for profile display)
- Established `scan-photos` bucket with INSERT/SELECT/DELETE for authenticated users in their own path prefix (ephemeral meal photos)
- Established `exports` bucket with SELECT-only for authenticated users — no mobile INSERT policy (server-side writes in Phase 15)
- All bucket inserts are idempotent via `ON CONFLICT (id) DO NOTHING`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migration for storage buckets and RLS policies** - `bee0ef7` (feat)

**Plan metadata:** _(to be committed with docs commit)_

## Files Created/Modified

- `supabase/migrations/025_storage_buckets.sql` — 3 storage buckets + 7 RLS policies; idempotent inserts; path-prefix enforcement on all 6 non-public policies

## Decisions Made

- `profile-photos` bucket row uses `public = false` — Supabase dashboard convenience only. Actual public readability is controlled by the `profile_photos_public_read` policy (`FOR SELECT TO public`).
- `exports` bucket intentionally has no INSERT policy from mobile — server-side uploads only (Phase 15 lifecycle cron). Mobile can only receive signed download URLs.
- Used the `storage.foldername(name))[1] = auth.uid()::text` pattern strictly — this is specific to `storage.objects` which has no `user_id` column. Copying any existing table migration would silently block all access.
- Left `avatars` bucket (migration 017) completely untouched — old avatar URLs remain valid.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — migration file is ready to be applied to Supabase. No external service configuration required for this plan.

## Next Phase Readiness

- Storage infrastructure is fully provisioned and ready for Plan 02 (backend `/storage/upload-url` endpoint)
- Plan 02 can immediately reference `profile-photos`, `scan-photos`, and `exports` bucket IDs
- Plan 03 (mobile upload flow) depends on Plan 02's endpoint being live
- Phase 15 (lifecycle cron) can reference the `exports` bucket once Plans 02-03 ship

---
*Phase: 14-supabase-storage*
*Completed: 2026-04-03*
