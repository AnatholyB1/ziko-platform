-- 061 — Coach can read program_workouts + program_exercises for their clients
CREATE POLICY "program_workouts_coach_read" ON public.program_workouts
  FOR SELECT
  USING (
    program_id IN (
      SELECT id FROM public.workout_programs
      WHERE public.is_coach_of(auth.uid(), user_id)
    )
  );

CREATE POLICY "program_exercises_coach_read" ON public.program_exercises
  FOR SELECT
  USING (
    workout_id IN (
      SELECT pw.id FROM public.program_workouts pw
      JOIN public.workout_programs wp ON wp.id = pw.program_id
      WHERE public.is_coach_of(auth.uid(), wp.user_id)
    )
  );
