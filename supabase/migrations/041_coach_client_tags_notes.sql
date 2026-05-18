-- ============================================================
-- 041 — Coach Client Tags + Notes (Phase 26, CLIENT-05, CLIENT-06)
-- Migration scope:
--   1. CREATE TABLE coach_client_tags (RLS: auth.uid() = coach_id)
--   2. CREATE TABLE coach_client_notes (RLS: auth.uid() = coach_id)
-- NOTE: These tables use self-ownership RLS (coach owns the row),
--       NOT is_coach_of() — coach_client_tags/notes are private to the coach.
-- IMPORTANT: This migration must NOT touch is_coach_of(), any existing
--            _coach_read policy, or any Phase 22 function/policy.
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- 1. coach_client_tags: free-text labels, multiple per client per coach
CREATE TABLE IF NOT EXISTS public.coach_client_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL CHECK (char_length(tag) <= 50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id, tag)
);
ALTER TABLE public.coach_client_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_client_tags_own" ON public.coach_client_tags
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

-- 2. coach_client_notes: single note per coach-client pair, overwritten on update
CREATE TABLE IF NOT EXISTS public.coach_client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id)
);
ALTER TABLE public.coach_client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_client_notes_own" ON public.coach_client_notes
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
