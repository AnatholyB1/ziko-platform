-- Phase 44: add coach_exercise_id to program_exercises
-- Allows tracking custom exercises in athlete assigned programs
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS coach_exercise_id uuid
    REFERENCES public.coach_exercises(id) ON DELETE SET NULL;

-- Index for join performance
CREATE INDEX IF NOT EXISTS idx_program_exercises_coach_exercise_id
  ON public.program_exercises (coach_exercise_id)
  WHERE coach_exercise_id IS NOT NULL;
