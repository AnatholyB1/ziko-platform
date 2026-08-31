-- ============================================================
-- Phase 42 — Decision-System Foundation (FOUND-01, FOUND-04, FOUND-05)
-- Adds: athlete_state — compact current-state row, one per athlete
-- Purpose: the single source of truth for "where is this athlete right
--          now" that every downstream v1.18 phase (43-47) reads. This is
--          deliberately a compact row, never a growing blob — history
--          lives in athlete_decisions (see the companion migration
--          20260831120100_athlete_decisions.sql), not here.
-- Write path: the ONLY writer of this table is the SECURITY DEFINER RPC
--          public.record_athlete_decision(), added in migration
--          20260831120200_athlete_decisions_rpc.sql. No client of any
--          kind (including service_role) writes this table directly —
--          see the SELECT-only RLS policy and the (later) table-level
--          REVOKE below.
-- ============================================================

CREATE TABLE public.athlete_state (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'paused')),
  readiness              TEXT NOT NULL DEFAULT 'fragile' CHECK (readiness IN ('fragile', 'building', 'ready')),
  level                  INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  points                 INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier                   INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1),
  onboarding_profile     JSONB NOT NULL DEFAULT '{}',
  current_focus_summary  TEXT,
  current_focus_detail   JSONB NOT NULL DEFAULT '{}',
  rolling_summary        TEXT,
  last_review_at         TIMESTAMPTZ,
  next_review_due_at     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- RLS — athlete reads their own row only. Deliberately zero write
-- policies: the explicit FOR SELECT command restriction below is
-- load-bearing — omitting it (as 026_ai_credits.sql's USING/WITH CHECK
-- policy does) would silently re-open write access via RLS's default
-- permissiveness on other commands.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.athlete_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_state_select_own" ON public.athlete_state
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- updated_at trigger — reuses public.handle_updated_at(), already shipped
-- in supabase/migrations/001_initial_schema.sql. Do NOT redefine it here.
CREATE TRIGGER trg_athlete_state_updated
  BEFORE UPDATE ON public.athlete_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.athlete_state IS
  'Compact current-state row per athlete — one row per user_id, never a growing blob. History/audit trail lives in public.athlete_decisions. The only write path is public.record_athlete_decision() (migration 20260831120200_athlete_decisions_rpc.sql).';

COMMENT ON COLUMN public.athlete_state.readiness IS
  'Top-level coaching-readiness signal, one of fragile/building/ready (D-01). Defaults to the fail-safe posture ''fragile'' (D-02) — a missing or not-yet-assessed athlete is always treated as needing the gentlest path, never assumed ready.';

COMMENT ON COLUMN public.athlete_state.rolling_summary IS
  'FOUND-05 bounded-context read convention: AI callers must read this column (capped at ~500 tokens / ~2000 characters) plus the last 4 rows of public.athlete_decisions ordered by created_at DESC, and must never replay the full decisions journal. Recompaction of this column is Phase 44''s coaching-engine/context.ts, run as the last step of the weekly review.';
