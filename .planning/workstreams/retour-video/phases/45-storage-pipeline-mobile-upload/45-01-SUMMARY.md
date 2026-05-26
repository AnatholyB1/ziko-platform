# 45-01 SUMMARY — DB Migration + coach-videos Bucket

**Status:** Complete
**Completed:** 2026-05-26
**Commit:** feat(45-01): add migration 057 — coach_client_videos, annotations, RLS, storage policies

## What Was Built

- **coach-videos private bucket** created in Supabase Storage via MCP (bucket was absent; created directly via SQL insert into storage.buckets)
- **Migration 057** (`supabase/migrations/057_coach_videos_schema.sql`) applied to the live Supabase database via MCP apply_migration

## Schema Delivered

### coach_client_videos
8 columns: id (UUID PK), athlete_id (FK auth.users), coach_id (FK auth.users), storage_path (TEXT), title (TEXT, max 200, required), duration_s (INTEGER nullable), status (TEXT CHECK uploading/ready/annotated, default ready), created_at (TIMESTAMPTZ)

3 RLS policies:
- `coach_client_videos_athlete` — FOR ALL: athlete owns their rows
- `coach_client_videos_coach_read` — FOR SELECT: `public.is_coach_of(auth.uid(), athlete_id)`
- `coach_client_videos_coach_update` — FOR UPDATE: coach updates status

### coach_video_annotations
8 columns: id (UUID PK), video_id (FK coach_client_videos), coach_id (FK auth.users), timestamp_s (NUMERIC(10,3)), type (TEXT CHECK text/voice), content (TEXT nullable), audio_path (TEXT nullable), created_at (TIMESTAMPTZ)

2 RLS policies:
- `coach_video_annotations_coach` — FOR ALL: coach owns their annotations
- `coach_video_annotations_athlete_read` — FOR SELECT: athlete reads annotations on their own videos

### storage.objects — coach-videos bucket
3 policies:
- `coach_videos_athlete_upload` — FOR INSERT: athlete uploads to their own subfolder (foldername[1] = auth.uid())
- `coach_videos_athlete_read` — FOR SELECT: athlete reads their own subfolder
- `coach_videos_coach_read` — FOR SELECT: coach reads via is_coach_of()

## Verification

- Both tables confirmed in information_schema.tables ✓
- All 8 policies confirmed in pg_policies ✓
- Bucket coach-videos: private (public=false), created_at confirmed ✓

## Deviations

- Task 1 (bucket creation): Done via MCP SQL insert into storage.buckets instead of Supabase CLI or Dashboard — bucket did not exist
- Task 3 (db push): Applied via MCP apply_migration instead of `supabase db push` CLI — result identical
