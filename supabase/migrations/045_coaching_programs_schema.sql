-- ============================================================
-- 045 — Coaching Programs Schema (Phase 27, Plan 02)
-- Adds:
--   1. coach_program_folders — folder organisation per coach
--   2. workout_programs.folder_id — FK to folders
--   3. workout_programs.start_date — program start date (≠ cycle_start_date from 016)
--   4. exercises.is_user_defined — user-created exercises flag (coexists with is_custom)
--   5. coach_client_links.shared_note — optional coach note on the link
--   6. workout_sessions.source_program_id — FK to originating program
--   7. workout_sessions.source_session_id — originating template session identifier (TEXT)
--   8. RLS: workout_programs_coach_read — coach can SELECT assigned programs
--   9. RLS: workout_programs_coach_assign — coach can INSERT programs for clients
--  10. Indexes on folder_id + source_program_id
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. coach_program_folders
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_program_folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, name)
);

ALTER TABLE public.coach_program_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folders_own" ON public.coach_program_folders
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- ───────────────────────────────────────────────────────────
-- 2. workout_programs.folder_id
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_programs
  ADD COLUMN IF NOT EXISTS folder_id UUID
    REFERENCES public.coach_program_folders(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────
-- 3. workout_programs.start_date
--    Distinct from cycle_start_date (added in migration 016).
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_programs
  ADD COLUMN IF NOT EXISTS start_date DATE NULL;

-- ───────────────────────────────────────────────────────────
-- 4. exercises.is_user_defined
--    Coexists with is_custom (migration 001); do NOT touch is_custom.
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_user_defined BOOLEAN NOT NULL DEFAULT FALSE;

-- ───────────────────────────────────────────────────────────
-- 5. coach_client_links.shared_note
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.coach_client_links
  ADD COLUMN IF NOT EXISTS shared_note TEXT NULL;

-- ───────────────────────────────────────────────────────────
-- 6. workout_sessions.source_program_id
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS source_program_id UUID
    REFERENCES public.workout_programs(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────
-- 7. workout_sessions.source_session_id
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS source_session_id TEXT NULL;

-- ───────────────────────────────────────────────────────────
-- 8. RLS: workout_programs_coach_read
--    Coaches can SELECT programs they created-and-assigned,
--    or public templates (is_template=TRUE, no coach author).
--    OR-combined with the existing "own_programs" FOR ALL policy.
-- ───────────────────────────────────────────────────────────
CREATE POLICY "workout_programs_coach_read" ON public.workout_programs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      assigned_to_user_id IS NOT NULL
      AND public.is_coach_of(auth.uid(), assigned_to_user_id)
    )
    OR (
      is_template = TRUE
      AND created_by_coach_id IS NULL
    )
  );

-- ───────────────────────────────────────────────────────────
-- 9. RLS: workout_programs_coach_assign
--    Coach can INSERT a program for an active client only.
-- ───────────────────────────────────────────────────────────
CREATE POLICY "workout_programs_coach_assign" ON public.workout_programs
  FOR INSERT
  WITH CHECK (
    created_by_coach_id = auth.uid()
    AND assigned_to_user_id IS NOT NULL
    AND public.is_coach_of(auth.uid(), assigned_to_user_id)
  );

-- ───────────────────────────────────────────────────────────
-- 10. Indexes
-- ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workout_programs_folder
  ON public.workout_programs(folder_id)
  WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_sessions_source_program
  ON public.workout_sessions(source_program_id)
  WHERE source_program_id IS NOT NULL;

-- End of migration 045.
