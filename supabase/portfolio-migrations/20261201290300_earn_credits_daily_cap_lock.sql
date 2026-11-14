-- UAT run 6 : GET /credits/balance renvoyait daily_earned = 6 pour daily_cap = 4.
-- Cause probable : ziko_earn_ai_credits compte les lignes 'earn' du jour puis insere, SANS verrou. Les outils du
-- chat (habitude, repas, mesure, cardio, etirement) appellent earnCredits() en "fire and forget" : deux appels
-- concurrents lisent tous deux count < cap et inserent tous deux -> plafond depasse.
-- Correctif : verrou consultatif transactionnel par utilisateur avant le comptage (les earn d'un meme utilisateur
-- sont serialises ; les autres utilisateurs ne sont pas bloques). Signature et semantique inchangees.
-- Facturation / debit (ziko_deduct_ai_credits) : NON touches (decision utilisateur : differe).
-- Migration idempotente (CREATE OR REPLACE), NON appliquee par l'agent.

CREATE OR REPLACE FUNCTION public.ziko_earn_ai_credits(p_user_id uuid, p_source text, p_idempotency_key text, p_amount integer DEFAULT 1, p_daily_cap integer DEFAULT 4)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_earn_count  INTEGER;
  v_rows        INTEGER;
  v_day_start   timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  -- Serialise les gains d'un meme utilisateur jusqu'a la fin de la transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_earn_ai_credits:' || p_user_id::text, 0));

  -- Plafond journalier (EARN-07) : compte les gains du jour UTC, sous verrou.
  SELECT COUNT(*) INTO v_earn_count
  FROM public.ziko_ai_credit_transactions
  WHERE user_id = p_user_id
    AND type = 'earn'
    AND created_at >= v_day_start;

  IF v_earn_count >= p_daily_cap THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'daily_cap_reached');
  END IF;

  -- ON CONFLICT doit reprendre le WHERE de l'index unique partiel (user_id, source, idempotency_key).
  INSERT INTO public.ziko_ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  VALUES (p_user_id, 'earn', p_amount, p_source, p_idempotency_key)
  ON CONFLICT (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'duplicate');
  END IF;

  INSERT INTO public.ziko_user_ai_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ziko_user_ai_credits
  SET balance    = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('credited', true);
END;
$function$;

-- Reservee a service_role (comme 202612012701_security_hardening.sql).
REVOKE ALL ON FUNCTION public.ziko_earn_ai_credits(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_earn_ai_credits(uuid, text, text, integer, integer) TO service_role;
