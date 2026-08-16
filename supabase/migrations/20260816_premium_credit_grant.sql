-- ============================================================
-- 20260816 — Premium credit-gate alignment: the monthly grant RPC
-- (Phase 4 plan 02, v1.16, CRED-03)
--
-- Sorts after 20260816_premium_credit_flag.sql (plan 04-01, same date).
-- The two are independent — this file adds a new function, that one added
-- a column and an app_config row — but noting the ordering here saves a
-- future reader from wondering whether one depends on the other.
--
-- This is the function that makes the newly capped premium tier (04-01)
-- generous rather than punitive: once a calendar month, it tops a premium
-- user's AI-credit balance up by a configured allowance. Without it, plan
-- 04-01 alone makes premium strictly worse than free the moment the
-- activation flag flips (CRED-05) — balance-checked but never funded.
--
-- Structurally this mirrors 028_fix_earn_rpc_and_quota_tracking.sql's
-- corrected earn RPC, not 026_ai_credits.sql's deduct_ai_credits or
-- the RPC skeleton in 04-RESEARCH.md/04-PATTERNS.md — both of the latter
-- omit the WHERE predicate the partial unique index requires on ON
-- CONFLICT, and both increment the balance before the idempotency check,
-- which double-funds every retry. See 028's header comment for the
-- production incident that made this the house-corrected shape.
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_premium_credits(
  p_user_id UUID,
  p_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_idempotency_key TEXT := 'premium_grant_' || to_char(now(), 'YYYY-MM');
  v_rows             INTEGER;
BEGIN
  -- Guard: a null, zero, or negative amount is refused before touching
  -- anything. The function is service-role only and always called today
  -- with a constant, but this removes a whole class of accidental
  -- mass-adjustment for one branch.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid_amount');
  END IF;

  -- Ledger claim first. `source` is a hard-coded literal on every call,
  -- never a parameter and never left null — the partial unique index is
  -- composite over (user_id, source, idempotency_key), so a varying or
  -- null source would let the same user be funded twice in one month
  -- (04-RESEARCH.md Pitfall 3). The ON CONFLICT clause carries the same
  -- WHERE predicate as idx_credit_tx_idempotency
  -- (WHERE idempotency_key IS NOT NULL) — without it Postgres cannot infer
  -- the partial index and the whole function throws "no unique or
  -- exclusion constraint matching the ON CONFLICT specification".
  INSERT INTO public.ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  VALUES (p_user_id, 'premium_grant', p_amount, 'premium_grant', v_idempotency_key)
  ON CONFLICT (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Zero rows affected means this user was already granted this calendar
  -- month — return immediately, before touching any balance. This early
  -- return is the entire idempotency guarantee: moving the balance update
  -- above it (as the superseded skeletons do) silently double-funds every
  -- Vercel cron retry.
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'duplicate');
  END IF;

  -- Ensure the user has a credits row. A premium user who somehow lacks
  -- one is funded, not silently skipped by an UPDATE that matches zero
  -- rows.
  INSERT INTO public.user_ai_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Fund. Note: the ledger row's balance_after (stamped by the existing
  -- BEFORE INSERT trigger, 026_ai_credits.sql) records the pre-grant
  -- balance, because the insert above precedes this increment — exactly
  -- what the earn RPC already produces for every earn row in production.
  -- Do not add a corrective UPDATE and do not reorder this function to
  -- "fix" it; the ordering is the correctness property, not a style
  -- choice.
  UPDATE public.user_ai_credits
  SET balance    = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('granted', true, 'amount', p_amount);
END;
$$;

-- This project's `ALTER DEFAULT PRIVILEGES` on schema public grants EXECUTE
-- to anon/authenticated directly at CREATE FUNCTION time — a grant separate
-- from PUBLIC that a PUBLIC-only REVOKE never removes (see STATE.md's
-- open blocker on is_coach_of()/redeem_invitation_code()/peek_invitation(),
-- and 20260812_waitlist_founder_offer.sql's identical note). anon and
-- authenticated must therefore be revoked explicitly, by name, on every
-- new function — this one included.
REVOKE EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) TO service_role;
