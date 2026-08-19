---
phase: 01-schema-storage-foundation
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - supabase/migrations/20260814_exercise_media_schema.sql
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-14
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `supabase/migrations/20260814_exercise_media_schema.sql`, a pure-DDL migration that adds `image`/`gif` columns to `public.exercises`, creates a public `exercise-media` storage bucket with no client-facing write policies, and creates a deny-by-default `exercise_import_log` table. The migration correctly follows the codebase's established idioms (`ADD COLUMN IF NOT EXISTS`, `ON CONFLICT (id) DO NOTHING`, the `exports`-bucket "no write policy, service-role only" pattern, RLS-enabled-with-zero-policies for owner-less tables). No SQL syntax errors, no injection surface (static DDL, no dynamic SQL), and no secrets present.

The most significant finding is not a defect in the SQL syntax itself but a schema-design gap: this migration introduces `exercises.gif`, a second GIF-related column, without acknowledging or reconciling the pre-existing `exercises.gif_url` column (added in `004_exercises_extended.sql` and actively read/written by `backend/api/src/coach/exercises/db.ts` and `apps/mobile/app/(app)/workout/[id].tsx`). This creates two differently-named, differently-semantic columns for the same conceptual data (exercise GIF media) on the same table, which is a real footgun for Phase 4 (mobile rendering) and any future maintainer.

## Warnings

### WR-01: New `exercises.gif` column duplicates/collides with the existing `exercises.gif_url` column

**File:** `supabase/migrations/20260814_exercise_media_schema.sql:8`
**Issue:** `public.exercises` already has a `gif_url TEXT` column, added by `supabase/migrations/004_exercises_extended.sql:13`, and it is not dead — it is actively populated in `supabase/seed_exercises.sql` (27 rows), read by the coach backend (`backend/api/src/coach/exercises/db.ts:39-112`, which resolves a signed `gif_url` for custom exercise media), and consumed by the mobile client (`apps/mobile/app/(app)/workout/[id].tsx:218`, `setMediaGifUrl(json.gif_url ?? null)`).

This migration adds a second, differently-named column (`gif`) for what is conceptually the same data (an animated GIF for an exercise), with a different storage convention (relative path vs. full/signed URL) and a different write path (image-exo import pipeline vs. coach custom-exercise upload). The migration comment/plan documents (`01-CONTEXT.md`) even asserts "current `public.exercises` table definition (no `image`/`gif`/media columns yet)" — which is factually incorrect for `gif_url` and indicates this collision was not caught during design.

Downstream consequences:
- Phase 4 (mobile rendering) must now know to check *both* `gif` and `gif_url` to find an exercise's animation, or risk silently rendering nothing for exercises that only have one of the two populated.
- A future engineer skimming the schema has no way to tell from the migration alone why there are two GIF-ish columns, or which one is authoritative for which row (global library exercises vs. custom/coach exercises).
- No migration-level documentation (comment) calls out the relationship/distinction between `gif` and `gif_url`, unlike the rest of the file which is otherwise well-commented.

**Fix:** At minimum, add a comment in this migration explaining the intentional distinction, e.g.:
```sql
-- NOTE: exercises.gif_url (004_exercises_extended.sql) stores full/signed URLs for
-- coach-authored custom exercise media. exercises.gif (this migration) stores a
-- relative storage path for image-exo dataset import media on global library
-- exercises. These are intentionally separate columns/pipelines — do not conflate.
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS gif TEXT;
```
Longer-term, consider whether `image`/`gif` should instead reuse/rename `gif_url`'s slot (or vice versa) in a follow-up phase, or whether the mobile rendering logic (Phase 4) needs an explicit precedence rule (`gif ?? gif_url`) documented as a requirement now rather than discovered later.

### WR-02: `exercise_import_log.exercise_id` foreign key has no supporting index

**File:** `supabase/migrations/20260814_exercise_media_schema.sql:24`
**Issue:** `exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL` has no index. Postgres does not automatically index foreign key columns. Only `source_id` gets an explicit index (line 30). Phase 3's merge script is expected to query/join on `exercise_id` (per `01-CONTEXT.md`: "which row was touched, if any") in addition to `source_id`, and `ON DELETE SET NULL` triggers a full-table scan of `exercise_import_log` on every `exercises` row delete if unindexed. This is borderline performance (out of strict v1 scope) but is flagged because it is a one-line, low-risk fix directly analogous to the `idx_exercises_user` index already present on `exercises.user_id` (`001_initial_schema.sql:46`) for the same FK-lookup reason.

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_exercise_import_log_exercise_id ON public.exercise_import_log(exercise_id);
```

## Info

### IN-01: No `updated_at`/idempotency-tracking beyond `processed_at`

**File:** `supabase/migrations/20260814_exercise_media_schema.sql:27`
**Issue:** `exercise_import_log` rows are write-once (`processed_at DEFAULT NOW()`) with no way to distinguish an original run from a re-run touching the same `source_id`, beyond the non-unique index. This is consistent with the phase's explicit design decision (D-07, deferring the upsert-vs-append pattern to Phase 3) and is not a defect in this file, but worth flagging as a forward-looking note for whoever designs Phase 3's resumability logic: without a `run_id`/`attempt` column or a unique constraint, detecting "this source_id was already processed in a previous run" requires querying `MAX(processed_at)` per `source_id`, which is workable but should be an explicit decision in Phase 3, not an accidental gap.
**Fix:** No action needed in this migration — carry this forward as a design input to Phase 3.

---

_Reviewed: 2026-08-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
