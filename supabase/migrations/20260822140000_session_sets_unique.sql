-- supabase/migrations/20260822140000_session_sets_unique.sql
--
-- completeSet() in workoutStore.ts inserts a session_sets row with no guard
-- against re-completing the same set — a double-tap creates two rows for the
-- same (session_id, exercise_id, set_number), double-counting volume in the
-- stats plugin. Add a unique constraint so the client can upsert instead.

ALTER TABLE public.session_sets
  ADD CONSTRAINT session_sets_unique_set
  UNIQUE (session_id, exercise_id, set_number);
