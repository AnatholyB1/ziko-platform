-- ============================================================
-- Fix: athlete cannot read their own coach-assigned program
--
-- Migration 045 (20260520214714_coaching_programs_schema.sql) introduced
-- assigned_to_user_id and a "workout_programs_coach_read" policy so the
-- COACH can read programs they assigned (auth.uid() = coach, is_coach_of
-- checks assigned_to_user_id). It never added the symmetric policy for the
-- ATHLETE (auth.uid() = assigned_to_user_id) to read their own assigned
-- program. Since coach-assigned rows have user_id = coach_id (not the
-- athlete's id — see backend/api/src/coach/programs/db.ts assignProgram),
-- the base "own_programs" policy (user_id = auth.uid()) never matches for
-- the athlete either. Net effect: the assigned program is invisible to the
-- athlete's own mobile session — silently filtered out by RLS, no error.
-- ============================================================

SET LOCAL lock_timeout = '5s';

CREATE POLICY "workout_programs_assigned_athlete_read" ON public.workout_programs
  FOR SELECT
  USING (assigned_to_user_id = auth.uid());

-- End of migration.
