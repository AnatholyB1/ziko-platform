-- ============================================================
-- Phase 44 — Weekly Adaptive Decision Engine (ENGINE-06, D-09)
-- Adds: athlete_goals — dedicated table for the athlete's broader,
--       multi-week outcome goal.
-- Purpose: D-09 requires a real, dedicated table (not a JSONB blob) for
--          goal text/target/target_date/status. The week's concrete
--          training targets stay in athlete_state.current_focus_detail
--          (D-10) and are deliberately NOT duplicated here.
-- Write path: the ONLY writer of this table is the SECURITY DEFINER RPC
--          public.record_athlete_decision()'s p_new_goal parameter,
--          extended in migration 20260902100200_record_athlete_decision_v2.sql.
--          No client of any kind (including service_role) writes this
--          table directly — see the SELECT-only RLS policy and the
--          table-level REVOKE below.
-- ============================================================

CREATE TABLE public.athlete_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_text      TEXT NOT NULL,
  target_metric  TEXT,
  target_value   NUMERIC,
  target_date    DATE,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexed "current active goal" lookup used by create_program
CREATE INDEX idx_athlete_goals_user_active
  ON public.athlete_goals (user_id, status, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- RLS — athlete reads their own goals only. Deliberately zero write
-- policies: the explicit FOR SELECT command restriction below is
-- load-bearing — omitting it would silently re-open write access via
-- RLS's default permissiveness on other commands (same mistake
-- 20260831120000_athlete_state.sql's own comment warns about).
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.athlete_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_goals_select_own" ON public.athlete_goals
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- updated_at trigger — reuses public.handle_updated_at(), already shipped
-- in supabase/migrations/001_initial_schema.sql. Do NOT redefine it here.
CREATE TRIGGER trg_athlete_goals_updated
  BEFORE UPDATE ON public.athlete_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Write-lockdown (threat T-44-01) — REVOKE from ALL THREE roles in this
-- SAME migration (the athlete_state gap that 20260831213147 had to fix as
-- a follow-up — do not repeat that omission here). A bare
-- REVOKE ... FROM PUBLIC is proven insufficient on this project: its
-- ALTER DEFAULT PRIVILEGES materializes per-role grants at CREATE time.
REVOKE INSERT, UPDATE, DELETE ON public.athlete_goals FROM anon, authenticated, service_role;

COMMENT ON TABLE public.athlete_goals IS
  'Dedicated table (D-09) for the athlete''s broader, multi-week outcome goal — goal text, target, target_date, status. The only write path is public.record_athlete_decision()''s p_new_goal parameter (migration 20260902100200_record_athlete_decision_v2.sql). Week-scoped concrete training targets live in athlete_state.current_focus_detail (D-10) and are deliberately NOT duplicated here.';
