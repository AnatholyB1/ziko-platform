-- ============================================================
-- 006 — Comprehensive session analytics tracking
-- Adds: per-set timestamps, prescribed vs actual values,
--        session_exercises table, enhanced workout_sessions
-- Purpose: Full data capture for analytics, PowerBI, ML models
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ENHANCE session_sets — per-set timing & prescribed values
-- ────────────────────────────────────────────────────────────

-- Precise timestamps for each set
ALTER TABLE public.session_sets
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Actual rest time taken AFTER this set (in seconds)
ALTER TABLE public.session_sets
  ADD COLUMN IF NOT EXISTS rest_seconds_taken INTEGER;

-- Prescribed values from the program (for actual vs prescribed comparison)
ALTER TABLE public.session_sets
  ADD COLUMN IF NOT EXISTS prescribed_reps INTEGER,
  ADD COLUMN IF NOT EXISTS prescribed_weight_kg DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS prescribed_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS prescribed_rest_seconds INTEGER;

-- Exercise order within session (denormalized for easy querying)
ALTER TABLE public.session_sets
  ADD COLUMN IF NOT EXISTS exercise_order INTEGER;

-- Index for time-series analysis
CREATE INDEX IF NOT EXISTS idx_sets_completed_at ON public.session_sets(completed_at);
CREATE INDEX IF NOT EXISTS idx_sets_started_at ON public.session_sets(started_at);

-- ────────────────────────────────────────────────────────────
-- 2. NEW TABLE: session_exercises — exercise-level aggregation
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_exercises (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id                  UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id                 UUID NOT NULL REFERENCES public.exercises(id),
  program_exercise_id         UUID REFERENCES public.program_exercises(id),
  order_index                 INTEGER NOT NULL DEFAULT 0,

  -- Timing
  started_at                  TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,

  -- What the program prescribed
  prescribed_sets             INTEGER,
  prescribed_reps             INTEGER,
  prescribed_reps_min         INTEGER,
  prescribed_reps_max         INTEGER,
  prescribed_duration_seconds INTEGER,
  prescribed_duration_min     INTEGER,
  prescribed_duration_max     INTEGER,
  prescribed_rest_seconds     INTEGER,
  prescribed_weight_kg        DECIMAL(6,2),
  exercise_type               TEXT CHECK (exercise_type IN ('reps', 'repRange', 'time', 'timeRange')),

  -- Actual aggregated results
  sets_completed              INTEGER NOT NULL DEFAULT 0,
  sets_planned                INTEGER NOT NULL DEFAULT 0,
  total_reps                  INTEGER NOT NULL DEFAULT 0,
  total_volume_kg             DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_duration_seconds      INTEGER NOT NULL DEFAULT 0,
  total_rest_seconds          INTEGER NOT NULL DEFAULT 0,
  avg_rpe                     DECIMAL(3,1),

  -- Notes
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_exercises_session ON public.session_exercises(session_id);
CREATE INDEX idx_session_exercises_exercise ON public.session_exercises(exercise_id);
CREATE INDEX idx_session_exercises_started ON public.session_exercises(started_at);

-- RLS
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_exercises_own" ON public.session_exercises
  USING (
    session_id IN (
      SELECT id FROM public.workout_sessions WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.workout_sessions WHERE user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. ENHANCE workout_sessions — aggregated counters
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.workout_programs(id),
  ADD COLUMN IF NOT EXISTS total_sets INTEGER,
  ADD COLUMN IF NOT EXISTS total_reps INTEGER,
  ADD COLUMN IF NOT EXISTS total_exercises INTEGER,
  ADD COLUMN IF NOT EXISTS total_rest_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS total_duration_active_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7);

-- Index for program-level analysis
CREATE INDEX IF NOT EXISTS idx_sessions_program ON public.workout_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON public.workout_sessions(day_of_week);
