-- ============================================================
-- 027 — AI Cost Log (COST-02)
-- Logs token usage per AI API call for billing reconciliation.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_cost_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for per-user cost queries (balance endpoint, admin dashboard)
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_user_created
  ON public.ai_cost_log (user_id, created_at DESC);

-- Index for weekly billing reconciliation queries (aggregate all users)
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_created
  ON public.ai_cost_log (created_at DESC);

-- RLS: users can only read their own cost log rows
-- Uses (SELECT auth.uid()) sub-select caching pattern from migration 026
ALTER TABLE public.ai_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_cost_log_own" ON public.ai_cost_log
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
