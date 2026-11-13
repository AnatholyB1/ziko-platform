-- P25 (MCOA-03) etape 2/3 : lecture de l'historique des coachs de l'athlete (liens retires).
-- Idempotent. Non appliquee par l'agent.
CREATE INDEX IF NOT EXISTS ziko_coach_client_links_client_history_idx
  ON public.ziko_coach_client_links (client_id, revoked_at DESC)
  WHERE revoked_at IS NOT NULL;
