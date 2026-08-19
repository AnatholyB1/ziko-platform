-- ============================================================
-- 059 — Allow coaches to read programs owned by their clients
-- Without this, programs created by athletes (user_id = athlete_id,
-- assigned_to_user_id = NULL) are invisible to the coach's JWT.
-- ============================================================

SET LOCAL lock_timeout = '5s';

CREATE POLICY "workout_programs_client_own_coach_read" ON public.workout_programs
  FOR SELECT
  USING (
    public.is_coach_of(auth.uid(), user_id)
  );

-- End of migration 059.
