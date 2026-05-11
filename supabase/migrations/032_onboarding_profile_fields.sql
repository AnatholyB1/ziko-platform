-- Migration 032: Add onboarding profile fields
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS workout_frequency TEXT CHECK (workout_frequency IN ('2', '3', '4', '5+')),
  ADD COLUMN IF NOT EXISTS equipment TEXT CHECK (equipment IN ('gym', 'home', 'bodyweight', 'outdoor'));

-- Extend goal CHECK to include new design values
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_goal_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_goal_check
    CHECK (goal IN ('muscle_gain', 'fat_loss', 'maintenance', 'endurance', 'strength', 'health'));
