-- 055 — coach_exercises table + coach-exercises private Storage bucket (Phase 43)
-- Provides the exercise library persistence layer for the custom coach CRM.
-- RLS: coach reads/writes only their own exercises via JWT (auth.uid() = coach_id).
-- Storage: private bucket with per-coach prefix policy (uid/ folder).
-- No updated_at trigger — API sets it explicitly on PATCH (same as programs module).

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. coach_exercises
-- Personal exercise library per coach. Supports optional media
-- attachments (video + photo) stored as storage paths (not signed URLs).
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_exercises (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(name) <= 100),
  description   TEXT        CHECK (description IS NULL OR char_length(description) <= 500),
  category      TEXT        NOT NULL
                  CHECK (category IN ('Force','Cardio','Mobilité','HIIT','Hyrox','Autre')),
  muscle_groups TEXT[]      NOT NULL DEFAULT '{}',
  video_path    TEXT,
  photo_path    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_exercises_own" ON public.coach_exercises
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Fast lookup of all exercises for a given coach
CREATE INDEX IF NOT EXISTS idx_coach_exercises_coach
  ON public.coach_exercises(coach_id);

-- ───────────────────────────────────────────────────────────
-- 2. coach-exercises Storage bucket + RLS policies
-- Private bucket. Each coach stores files under their own uid/ prefix.
-- Pattern mirrors 037_coach_kyc_bucket.sql exactly.
-- ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-exercises', 'coach-exercises', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "coach_exercises_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-exercises'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_exercises_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'coach-exercises'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "coach_exercises_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coach-exercises'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- End of migration 055.
