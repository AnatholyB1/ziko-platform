-- Migration 028: Fix earn_ai_credits RPC + add quota tracking type
--
-- Fix 1: ON CONFLICT in earn_ai_credits used wrong conflict target.
--   The unique index is PARTIAL (WHERE idempotency_key IS NOT NULL).
--   PostgreSQL requires the WHERE clause in ON CONFLICT to match the partial index.
--   Without it: "no unique or exclusion constraint matching the ON CONFLICT specification"
--   → RPC throws → creditService returns { credited: false } → earn toast never shows.
--
-- Fix 2: Add 'quota' to the type CHECK constraint so free-slot usage can be tracked.
--   getQuotaStatus counts all rows where source = action. When free-quota chats are
--   not recorded, usedToday stays 0 → withinFreeQuota is always true → credits never deducted.

-- ── Fix 1: Add 'quota' to the allowed types ───────────────────────────────────
ALTER TABLE public.ai_credit_transactions
  DROP CONSTRAINT IF EXISTS ai_credit_transactions_type_check;

ALTER TABLE public.ai_credit_transactions
  ADD CONSTRAINT ai_credit_transactions_type_check
  CHECK (type IN ('deduct', 'earn', 'welcome', 'daily_base', 'monthly_base', 'admin_adjust', 'premium_grant', 'quota'));

-- ── Fix 2: Corrected earn_ai_credits RPC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.earn_ai_credits(
  p_user_id         UUID,
  p_source          TEXT,
  p_idempotency_key TEXT,
  p_amount          INTEGER DEFAULT 1,
  p_daily_cap       INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earn_count  INTEGER;
  v_rows        INTEGER;
BEGIN
  -- Check daily earn cap (EARN-07)
  SELECT COUNT(*) INTO v_earn_count
  FROM public.ai_credit_transactions
  WHERE user_id = p_user_id
    AND type = 'earn'
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC');

  IF v_earn_count >= p_daily_cap THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'daily_cap_reached');
  END IF;

  -- ON CONFLICT must include the WHERE clause to match the partial unique index
  -- idx_credit_tx_idempotency ON (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL
  INSERT INTO public.ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  VALUES (p_user_id, 'earn', p_amount, p_source, p_idempotency_key)
  ON CONFLICT (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'duplicate');
  END IF;

  -- Ensure credits row exists
  INSERT INTO public.user_ai_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Increment balance
  UPDATE public.user_ai_credits
  SET balance    = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('credited', true);
END;
$$;
