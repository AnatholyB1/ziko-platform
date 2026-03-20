-- ============================================================
-- ZIKO NUTRITION PLUGIN — Database Schema
-- Run after 002_habits_schema.sql
-- ============================================================

-- ── Nutrition logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type  TEXT NOT NULL DEFAULT 'snack'
               CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name  TEXT NOT NULL,
  calories   INTEGER NOT NULL DEFAULT 0,
  protein_g  NUMERIC(6, 1) NOT NULL DEFAULT 0,
  carbs_g    NUMERIC(6, 1) NOT NULL DEFAULT 0,
  fat_g      NUMERIC(6, 1) NOT NULL DEFAULT 0,
  serving_g  NUMERIC(6, 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date
  ON public.nutrition_logs(user_id, date DESC);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_logs_own" ON public.nutrition_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
