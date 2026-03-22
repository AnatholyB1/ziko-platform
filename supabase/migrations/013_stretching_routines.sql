-- Custom stretching routines
CREATE TABLE IF NOT EXISTS public.stretching_routines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  muscle_groups TEXT[] DEFAULT '{}',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  exercises JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stretching_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stretching_routines_own" ON public.stretching_routines
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_stretching_routines_user ON public.stretching_routines(user_id);
