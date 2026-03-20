-- ============================================================
-- 005 — Extend program_exercises with rep ranges, time, weight
-- ============================================================

-- Add rep range columns (e.g., 8-12 reps)
ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS reps_min INTEGER;
ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS reps_max INTEGER;

-- Add duration columns for timed exercises (e.g., 30-60 seconds)
ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS duration_min INTEGER;
ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS duration_max INTEGER;

-- Add suggested weight
ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,2);

-- Make reps nullable (can use reps OR rep range OR duration)
-- reps is already nullable (no NOT NULL constraint in 001_initial_schema.sql)
