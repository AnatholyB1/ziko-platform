-- ============================================================
-- Phase 44 — Weekly Adaptive Decision Engine (ENGINE-05)
-- Adds: ai_cost_log.source — distinguishes opex-funded autonomous AI
--       cost from user-initiated, credit-gated cost.
-- ============================================================

ALTER TABLE public.ai_cost_log
  ADD COLUMN source TEXT NOT NULL DEFAULT 'user_chat';

COMMENT ON COLUMN public.ai_cost_log.source IS
  'Distinguishes opex-funded autonomous AI calls (weekly_review_cron, app_open_fallback) from user-initiated, credit-gated calls (default user_chat). Added Phase 44 (ENGINE-05); backfills existing rows safely via the DEFAULT. Deliberately no CHECK constraint — Phase 47 (OPS-03) will add more autonomous sources.';
