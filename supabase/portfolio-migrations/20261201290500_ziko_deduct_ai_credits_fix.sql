-- v1.20 / facturation IA INACTIVE : correctif de ziko_deduct_ai_credits + interrupteur billing_enabled.
-- NE PAS APPLIQUER sans decision explicite (voir DEPLOY-ORDER.md). Idempotente (CREATE OR REPLACE, INSERT ... DO NOTHING).
--
-- Corrige deux defauts de la definition prod :
--   1. ON CONFLICT (user_id, source, idempotency_key) sans predicat : l'index unique est PARTIEL
--      (ziko_idx_credit_tx_idempotency ... WHERE idempotency_key IS NOT NULL) -> erreur 42P10 a chaque debit.
--   2. Le solde etait decremente AVANT l'INSERT du ledger : un rejeu de la meme cle (DO NOTHING) debitait deux fois.
--      La cle d'idempotence est desormais testee AVANT le debit (verrou de ligne -> pas de course pour un meme utilisateur).
-- Interrupteur : ziko_app_config.billing_enabled (jsonb), FALSE par defaut. Tant qu'il vaut false, la fonction renvoie
-- le meme resultat 'ok' SANS debiter (journalise via RAISE LOG). Activation, plus tard et par l'utilisateur :
--   UPDATE public.ziko_app_config SET value = 'true'::jsonb, updated_at = now() WHERE key = 'billing_enabled';
-- Signature inchangee. Droits : service_role uniquement (comme apres 20261201270100).

INSERT INTO public.ziko_app_config (key, value)
VALUES ('billing_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ziko_deduct_ai_credits(p_user_id uuid, p_cost integer, p_action_type text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance INTEGER;
  v_billing BOOLEAN;
BEGIN
  SELECT (value = 'true'::jsonb) INTO v_billing
  FROM public.ziko_app_config
  WHERE key = 'billing_enabled';
  v_billing := COALESCE(v_billing, false);

  -- Facturation inactive : meme reponse 'ok', aucun debit, aucune ligne de ledger.
  IF NOT v_billing THEN
    SELECT balance INTO v_balance FROM public.ziko_user_ai_credits WHERE user_id = p_user_id;
    RAISE LOG 'ziko_deduct_ai_credits: billing disabled, no debit (user=%, action=%, cost=%, key=%)',
      p_user_id, p_action_type, p_cost, p_idempotency_key;
    RETURN jsonb_build_object('success', true, 'balance_after', COALESCE(v_balance, 0), 'billing', 'disabled');
  END IF;

  -- Row lock prevents concurrent deductions racing (also serialises same-key replays for one user)
  SELECT balance INTO v_balance
  FROM public.ziko_user_ai_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- No credit row found
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'balance', 0, 'required', p_cost);
  END IF;

  -- Idempotent replay: same (user, source, key) already debited -> succeed WITHOUT a second debit
  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ziko_ai_credit_transactions
    WHERE user_id = p_user_id AND source = p_action_type AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'balance_after', v_balance, 'duplicate', true);
  END IF;

  -- Insufficient balance
  IF v_balance < p_cost THEN
    RETURN jsonb_build_object('success', false, 'balance', v_balance, 'required', p_cost);
  END IF;

  -- Deduct
  UPDATE public.ziko_user_ai_credits
  SET balance = balance - p_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Ledger row (balance_after set by BEFORE INSERT trigger); predicate matches the partial unique index
  INSERT INTO public.ziko_ai_credit_transactions
    (user_id, type, amount, source, idempotency_key, metadata)
  VALUES
    (p_user_id, 'deduct', -p_cost, p_action_type, p_idempotency_key, '{}'::jsonb)
  ON CONFLICT (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance - p_cost);
END;
$function$;

REVOKE ALL ON FUNCTION public.ziko_deduct_ai_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_deduct_ai_credits(uuid, integer, text, text) TO service_role;
