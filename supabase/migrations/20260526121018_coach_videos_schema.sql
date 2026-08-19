-- ============================================================
-- 057 — coach_client_videos, coach_video_annotations,
--       RLS policies, storage.objects policies for coach-videos bucket
-- Phase 45, milestone v1.13 (retour-video).
-- Per D-RLS-02: SET LOCAL lock_timeout fails fast on contention.
-- Bucket 'coach-videos' must exist before this migration is applied.
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. coach_client_videos (INFRA-01, INFRA-04 — locked schema)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_client_videos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  title        TEXT        NOT NULL CHECK (char_length(title) <= 200),
  duration_s   INTEGER,
  status       TEXT        NOT NULL DEFAULT 'ready'
                             CHECK (status IN ('uploading', 'ready', 'annotated')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_client_videos_athlete
  ON public.coach_client_videos (athlete_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_client_videos_coach
  ON public.coach_client_videos (coach_id, created_at DESC);

ALTER TABLE public.coach_client_videos ENABLE ROW LEVEL SECURITY;

-- Athlete owns their video rows (read + insert own rows)
CREATE POLICY "coach_client_videos_athlete" ON public.coach_client_videos
  FOR ALL
  USING  (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

-- Coach can read videos for their linked athletes
CREATE POLICY "coach_client_videos_coach_read" ON public.coach_client_videos
  FOR SELECT
  USING (public.is_coach_of(auth.uid(), athlete_id));

-- Coach can update status (e.g., 'annotated') on their athletes' videos
CREATE POLICY "coach_client_videos_coach_update" ON public.coach_client_videos
  FOR UPDATE
  USING  (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- ───────────────────────────────────────────────────────────
-- 2. coach_video_annotations
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_video_annotations (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID           NOT NULL REFERENCES public.coach_client_videos(id) ON DELETE CASCADE,
  coach_id    UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_s NUMERIC(10, 3) NOT NULL,
  type        TEXT           NOT NULL CHECK (type IN ('text', 'voice')),
  content     TEXT,
  audio_path  TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_video_annotations_video
  ON public.coach_video_annotations (video_id, timestamp_s);

ALTER TABLE public.coach_video_annotations ENABLE ROW LEVEL SECURITY;

-- Coach owns their annotations
CREATE POLICY "coach_video_annotations_coach" ON public.coach_video_annotations
  FOR ALL
  USING  (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Athlete can read annotations on their own videos
CREATE POLICY "coach_video_annotations_athlete_read" ON public.coach_video_annotations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_client_videos v
      WHERE v.id = video_id
        AND v.athlete_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────
-- 3. storage.objects policies for bucket 'coach-videos'
--    Path convention: {athleteId}/{videoId}.mp4  (INFRA-01)
--    Uses storage.foldername() — fallback: split_part(name, '/', 1)
-- ───────────────────────────────────────────────────────────

-- Athlete can upload to their own subfolder only (T-45-01 mitigation)
CREATE POLICY "coach_videos_athlete_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Athlete can read objects in their own subfolder
CREATE POLICY "coach_videos_athlete_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'coach-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Coach can read objects for their linked athletes (T-45-02 mitigation)
CREATE POLICY "coach_videos_coach_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'coach-videos'
    AND public.is_coach_of(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- ───────────────────────────────────────────────────────────
-- End of migration 057.
-- ───────────────────────────────────────────────────────────
