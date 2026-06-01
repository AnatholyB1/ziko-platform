-- Phase 03: Persistence & Memory (retour-vocal workstream)
-- Stores coach vocal feedback cards persisted after [Sauvegarder] is pressed.

CREATE TABLE IF NOT EXISTS public.coach_vocal_feedbacks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript  text NOT NULL,
  card        jsonb NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coach_vocal_feedbacks_lookup
  ON public.coach_vocal_feedbacks (coach_id, athlete_id, created_at DESC);

ALTER TABLE public.coach_vocal_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_vocal_feedbacks_own"
  ON public.coach_vocal_feedbacks
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
