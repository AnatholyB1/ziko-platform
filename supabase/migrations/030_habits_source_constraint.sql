-- Extend habits.source CHECK constraint to include hydration_auto and sleep_auto
-- Fixes: crash on first open of Daily Habits for new users (DEFAULT_HABITS insert fails)

ALTER TABLE public.habits
  DROP CONSTRAINT IF EXISTS habits_source_check;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_source_check
    CHECK (source IN ('manual', 'workout_auto', 'nutrition_auto', 'hydration_auto', 'sleep_auto'));
