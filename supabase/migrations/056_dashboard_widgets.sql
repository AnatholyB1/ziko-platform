SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 056: dashboard_configs + coach_memory
-- Provides the persistence layer for the custom widget dashboard
-- and per-coach memory/preferences (custom-widget workstream).
-- RLS: coach reads/writes own rows via JWT (auth.uid() = coach_id).
-- No updated_at trigger — the API sets it explicitly on upsert.
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. dashboard_configs
-- One row per (coach_id, client_id) pair.
-- Stores the ordered widget layout as a JSONB array.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboard_configs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_configs_unique UNIQUE (coach_id, client_id)
);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_configs_own" ON public.dashboard_configs
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Composite lookup index: coach → client (covers the unique constraint query path)
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_lookup
  ON public.dashboard_configs(coach_id, client_id);

-- ───────────────────────────────────────────────────────────
-- 2. coach_memory
-- One row per coach (UNIQUE on coach_id).
-- Stores reusable widget templates and UI preferences as JSONB.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_memory (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  memory     JSONB       NOT NULL DEFAULT '{"templates":[],"preferences":{}}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_memory_own" ON public.coach_memory
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Direct lookup index for coach upsert / read
CREATE INDEX IF NOT EXISTS idx_coach_memory_coach
  ON public.coach_memory(coach_id);

-- End of migration 056.
