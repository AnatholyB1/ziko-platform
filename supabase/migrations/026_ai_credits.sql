-- ============================================================
-- 026 — AI Credit System Foundation
-- Adds: user_ai_credits, ai_credit_transactions, deduct RPC,
--        balance_after trigger, new-user credit trigger, tier column
-- Purpose: Atomic credit system for AI cost control (v1.4)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. user_ai_credits — primary balance table (CRED-07, D-02)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_ai_credits (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_ai_credits_own" ON public.user_ai_credits
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- updated_at trigger (reuses handle_updated_at from migration 001)
CREATE TRIGGER trg_user_ai_credits_updated
  BEFORE UPDATE ON public.user_ai_credits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. ai_credit_transactions — audit ledger (D-01, D-03)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('deduct', 'earn', 'welcome', 'daily_base', 'monthly_base', 'admin_adjust', 'premium_grant')),
  amount           INTEGER NOT NULL,
  source           TEXT,
  idempotency_key  TEXT,
  balance_after    INTEGER,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency constraint — prevents double-crediting on mobile retry
-- Partial index: only constrain rows that carry an idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency
  ON public.ai_credit_transactions (user_id, source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON public.ai_credit_transactions (user_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_transactions_own" ON public.ai_credit_transactions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. balance_after BEFORE INSERT trigger (D-04)
--    Reads current balance and stamps it on each ledger row
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_credit_transaction_balance_after()
RETURNS TRIGGER AS $fn$
BEGIN
  SELECT balance INTO NEW.balance_after
  FROM public.user_ai_credits
  WHERE user_id = NEW.user_id;

  IF NEW.balance_after IS NULL THEN
    NEW.balance_after := 0;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_credit_transaction_balance_after
  BEFORE INSERT ON public.ai_credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_credit_transaction_balance_after();

-- ────────────────────────────────────────────────────────────
-- 4. deduct_ai_credits RPC (CRED-06, D-11, D-12, D-13)
--    SECURITY DEFINER + FOR UPDATE row lock prevents negative
--    balances under concurrent Vercel Fluid Compute requests
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_user_id         UUID,
  p_cost            INTEGER,
  p_action_type     TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Row lock prevents concurrent deductions racing
  SELECT balance INTO v_balance
  FROM public.user_ai_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- No credit row found
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'balance', 0, 'required', p_cost);
  END IF;

  -- Insufficient balance
  IF v_balance < p_cost THEN
    RETURN jsonb_build_object('success', false, 'balance', v_balance, 'required', p_cost);
  END IF;

  -- Deduct
  UPDATE public.user_ai_credits
  SET balance = balance - p_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Ledger row (balance_after set by BEFORE INSERT trigger)
  INSERT INTO public.ai_credit_transactions
    (user_id, type, amount, source, idempotency_key, metadata)
  VALUES
    (p_user_id, 'deduct', -p_cost, p_action_type, p_idempotency_key, '{}'::jsonb)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance - p_cost);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 5. New-user welcome credit trigger (D-05)
--    Fires AFTER INSERT ON auth.users — separate from
--    handle_new_user() which creates the user_profiles row
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_welcome INTEGER := 5;
BEGIN
  INSERT INTO public.user_ai_credits (user_id, balance)
  VALUES (NEW.id, v_welcome)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ai_credit_transactions (user_id, type, amount, source)
  VALUES (NEW.id, 'welcome', v_welcome, 'signup');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- ────────────────────────────────────────────────────────────
-- 6. Bulk welcome credits for existing users (D-07)
--    ON CONFLICT DO NOTHING — idempotent re-run safe
-- ────────────────────────────────────────────────────────────

INSERT INTO public.user_ai_credits (user_id, balance)
SELECT id, 5
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.ai_credit_transactions (user_id, type, amount, source)
SELECT id, 'welcome', 5, 'migration_026'
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.ai_credit_transactions
  WHERE type = 'welcome' AND source = 'migration_026'
);

-- ────────────────────────────────────────────────────────────
-- 7. Tier column on user_profiles (PREM-01)
--    Enables premium bypass in Phase 18
--    DEFAULT 'free' — all existing rows migrate automatically
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'premium'));
