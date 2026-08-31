-- ============================================================
-- Phase 42 — Decision-System Foundation (FOUND-02, FOUND-04)
-- Adds: athlete_decisions — append-only AI decision journal
-- Purpose: verifiable, grounded audit trail of every decision the AI
--          coaching system makes about an athlete (weekly focus, level
--          change, reward grant, program created, goal created,
--          onboarding profile). Rows are never updated or deleted.
-- Write path: the ONLY insert path is public.record_athlete_decision(),
--          added in migration 20260831120200_athlete_decisions_rpc.sql.
--          No client of any kind (including service_role) inserts into
--          this table directly — see the SELECT-only RLS policy and the
--          (later) table-level REVOKE below.
-- ============================================================

CREATE TABLE public.athlete_decisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_type  TEXT NOT NULL CHECK (decision_type IN ('onboarding_profile', 'weekly_focus', 'level_change', 'reward_grant', 'program_created', 'goal_created')),
  week_of        DATE,
  summary        TEXT NOT NULL,
  rationale      TEXT,
  evidence       JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  outcome        JSONB NOT NULL DEFAULT '{}',
  source         TEXT NOT NULL DEFAULT 'weekly_review_cron' CHECK (source IN ('weekly_review_cron', 'onboarding_tool', 'app_open_fallback', 'manual_admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: at most one weekly_focus decision per athlete per week.
-- Plan 42-02's record_athlete_decision() RPC infers this exact index in
-- its ON CONFLICT clause — column list and predicate must match
-- character-for-character with what that RPC writes.
CREATE UNIQUE INDEX idx_athlete_decisions_week_idempotency
  ON public.athlete_decisions (user_id, decision_type, week_of)
  WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL;

-- Serves the FOUND-05 bounded-context read: ORDER BY created_at DESC LIMIT 4.
CREATE INDEX idx_athlete_decisions_user_created
  ON public.athlete_decisions (user_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- RLS — athlete reads their own rows only. Deliberately zero write
-- policies (append-only, RPC-door idiom).
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.athlete_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_decisions_select_own" ON public.athlete_decisions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.athlete_decisions IS
  'Append-only, immutable AI decision journal — rows are never updated or deleted. The only insert path is public.record_athlete_decision() (migration 20260831120200_athlete_decisions_rpc.sql).';

COMMENT ON COLUMN public.athlete_decisions.evidence IS
  'Mandatory grounding payload (FOUND-02) — the schema enforces that an evidence object is present (jsonb_typeof = ''object'', no DEFAULT), but cannot enforce its truthfulness. Verifying that evidence reflects a real activity query is the calling tool executor''s responsibility, starting Phase 43.';
