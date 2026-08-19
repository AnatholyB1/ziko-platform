-- 060 — Allow coaches to UPDATE programs owned by their clients
CREATE POLICY "workout_programs_client_coach_update" ON public.workout_programs
  FOR UPDATE
  USING (public.is_coach_of(auth.uid(), user_id))
  WITH CHECK (public.is_coach_of(auth.uid(), user_id));
