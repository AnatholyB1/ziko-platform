-- P7 (TRAIN-07) etape 2/4 : filet par table (l'unicite inter-tables = ziko_set_active_program, 0703).
-- Prerequis : 0701 (dedupe) applique. Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS ziko_workout_programs_one_active_per_athlete
  ON public.ziko_workout_programs ((COALESCE(assigned_to_user_id, user_id)))
  WHERE is_active AND NOT is_template;

CREATE UNIQUE INDEX IF NOT EXISTS ziko_ai_generated_programs_one_active_per_user
  ON public.ziko_ai_generated_programs (user_id)
  WHERE is_active;
