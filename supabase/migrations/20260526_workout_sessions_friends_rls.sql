-- Phase 37: Allow friends to read each other's workout sessions (required for Community Fil tab)
-- Additive policy — existing 'own_sessions' policy is preserved

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workout_sessions' AND policyname = 'workout_sessions_friends_read'
  ) THEN
    CREATE POLICY "workout_sessions_friends_read" ON public.workout_sessions
      FOR SELECT USING (
        user_id IN (
          SELECT CASE WHEN requester_id = auth.uid() THEN addressee_id ELSE requester_id END
          FROM public.friendships
          WHERE auth.uid() IN (requester_id, addressee_id) AND status = 'accepted'
        )
      );
  END IF;
END $$;
