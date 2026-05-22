SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 050: coach_alerts + ai_tool_audit
-- Provides the persistence layer for coach AI monitoring,
-- weekly digest, and tool invocation audit logging (Phase 29).
-- RLS: coach reads own rows via JWT; cron inserts bypass RLS
-- via service key (same pattern as Phase 15 storage cleanup cron).
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1. coach_alerts
-- Haiku-generated coaching nudges surfaced in the coach dashboard.
-- Inserted by monitor-cron (service key); read by coach via RLS JWT.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type  TEXT        NOT NULL
                CHECK (alert_type IN ('missed_sessions','sleep_drop','mood_decline','rpe_inflation')),
  severity    TEXT        NOT NULL
                CHECK (severity IN ('low','medium','high')),
  summary     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_alerts_own" ON public.coach_alerts
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Partial index: fast unread-alert badge count per coach
CREATE INDEX IF NOT EXISTS idx_coach_alerts_coach_unread
  ON public.coach_alerts(coach_id)
  WHERE is_read = false;

-- Full chronological index for alert feed query
CREATE INDEX IF NOT EXISTS idx_coach_alerts_created
  ON public.coach_alerts(coach_id, created_at DESC);

-- ───────────────────────────────────────────────────────────
-- 2. ai_tool_audit
-- Append-only audit log of every AI tool invocation by a coach.
-- args_hash is SHA-256 of the serialised args (computed server-side).
-- conversation_id links back to the ai_conversations row when available.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_tool_audit (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name         TEXT        NOT NULL,
  target_client_id  UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  args_hash         TEXT        NOT NULL,
  result_status     TEXT        NOT NULL
                      CHECK (result_status IN ('success','error')),
  conversation_id   UUID        NULL REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_tool_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_tool_audit_own" ON public.ai_tool_audit
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Chronological index for audit feed query
CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_coach_date
  ON public.ai_tool_audit(coach_id, created_at DESC);

-- End of migration 050.
