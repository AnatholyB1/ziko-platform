SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 063: coach_metric_thresholds
-- Numeric alert threshold configuration per coach+client+sport.
-- Coach configures thresholds; evaluation happens on dashboard load
-- inside the insights endpoint (Phase 41, AI-04).
-- RLS: coach reads/writes own rows via JWT.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coach_metric_thresholds (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_type       TEXT        NOT NULL,
  metric_key       TEXT        NOT NULL,
  operator         TEXT        NOT NULL CHECK (operator IN ('>', '<')),
  threshold_value  NUMERIC     NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_metric_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_metric_thresholds_own" ON public.coach_metric_thresholds
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Fast lookup on dashboard load (coach+client+sport combo, active only)
CREATE INDEX IF NOT EXISTS idx_coach_metric_thresholds_lookup
  ON public.coach_metric_thresholds(coach_id, client_id, sport_type)
  WHERE is_active = true;

-- End of migration 063.
