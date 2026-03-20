-- ============================================================
-- EXERCISES — Extended columns from Kaggle fitness dataset
-- Adds: body_part, equipment, target_muscle, secondary_muscles
-- Updates category CHECK to include new values
-- ============================================================

-- Add new columns
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS body_part TEXT,
  ADD COLUMN IF NOT EXISTS equipment TEXT,
  ADD COLUMN IF NOT EXISTS target_muscle TEXT,
  ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gif_url TEXT;

-- Drop old restrictive category CHECK and replace with broader one
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_category_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_category_check
    CHECK (category IN ('strength','cardio','flexibility','balance','sports','stretching'));

-- Index on new columns for filtering
CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON public.exercises(body_part);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON public.exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_target ON public.exercises(target_muscle);
