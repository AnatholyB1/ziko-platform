-- Migration 027: earn_ai_credits SECURITY DEFINER RPC
--
-- Problem: creditService.earnCredits used a direct INSERT to ai_credit_transactions
-- with the publishable (anon) key. RLS requires auth.uid() = user_id, but the
-- server-side client has no user JWT → INSERT fails silently → credited: false always.
--
-- Fix: SECURITY DEFINER RPC (same pattern as deduct_ai_credits) so the function
-- executes with owner privileges and bypasses RLS.

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

  -- Insert with idempotency — unique index on (user_id, source, idempotency_key)
  -- ON CONFLICT DO NOTHING skips duplicate earn for the same activity
  INSERT INTO public.ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  VALUES (p_user_id, 'earn', p_amount, p_source, p_idempotency_key)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'duplicate');
  END IF;

  -- Ensure credits row exists for this user (idempotent)
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
