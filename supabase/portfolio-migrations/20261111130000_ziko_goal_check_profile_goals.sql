-- goal-edit.tsx (profile) writes weight_loss / body_comp / wellness, rejected by the CHECK (23514).
-- Widen the allowed set so existing builds keep working; app-side normalisation is a later milestone.
ALTER TABLE public.ziko_user_profiles DROP CONSTRAINT IF EXISTS ziko_user_profiles_goal_check;
ALTER TABLE public.ziko_user_profiles ADD CONSTRAINT ziko_user_profiles_goal_check
  CHECK (goal = ANY (ARRAY['muscle_gain'::text, 'fat_loss'::text, 'maintenance'::text, 'endurance'::text, 'strength'::text, 'health'::text, 'weight_loss'::text, 'body_comp'::text, 'wellness'::text]));
