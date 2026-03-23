-- ═══════════════════════════════════════════════════════════
-- 016 — Program Cycling & Progressive Overload
-- ═══════════════════════════════════════════════════════════

-- Add cycling columns to workout_programs
ALTER TABLE public.workout_programs ADD COLUMN IF NOT EXISTS cycle_weeks INTEGER;
ALTER TABLE public.workout_programs ADD COLUMN IF NOT EXISTS progression_type TEXT; -- 'increment' | 'percentage'
ALTER TABLE public.workout_programs ADD COLUMN IF NOT EXISTS progression_value DECIMAL(6,2); -- kg per week (increment) or % per week (percentage)
ALTER TABLE public.workout_programs ADD COLUMN IF NOT EXISTS current_cycle_week INTEGER DEFAULT 1;
ALTER TABLE public.workout_programs ADD COLUMN IF NOT EXISTS cycle_start_date DATE;

-- Constraint: cycle_weeks between 2 and 12
ALTER TABLE public.workout_programs ADD CONSTRAINT cycle_weeks_range
  CHECK (cycle_weeks IS NULL OR (cycle_weeks >= 2 AND cycle_weeks <= 12));

-- Constraint: progression_type must be valid
ALTER TABLE public.workout_programs ADD CONSTRAINT progression_type_valid
  CHECK (progression_type IS NULL OR progression_type IN ('increment', 'percentage'));

-- Constraint: current_cycle_week within range
ALTER TABLE public.workout_programs ADD CONSTRAINT current_cycle_week_range
  CHECK (current_cycle_week IS NULL OR current_cycle_week >= 1);
