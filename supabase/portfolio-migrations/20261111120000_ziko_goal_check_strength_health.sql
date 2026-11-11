-- Onboarding step 2 offers 'strength' and 'health' goals, which the CHECK rejected (SQLSTATE 23514),
-- blocking onboarding step 7 (Play review rejection 2026-11-10). Widen the allowed set.
ALTER TABLE public.ziko_user_profiles DROP CONSTRAINT IF EXISTS ziko_user_profiles_goal_check;
ALTER TABLE public.ziko_user_profiles ADD CONSTRAINT ziko_user_profiles_goal_check
  CHECK (goal = ANY (ARRAY['muscle_gain'::text, 'fat_loss'::text, 'maintenance'::text, 'endurance'::text, 'strength'::text, 'health'::text]));
