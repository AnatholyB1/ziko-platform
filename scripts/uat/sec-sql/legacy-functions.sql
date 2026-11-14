-- Corps HISTORIQUES (avant 20261201270100) des fonctions durcies, copies de la branche de test (pg_get_functiondef).
-- Prouve que les attaques de l'audit REUSSISSENT avant la migration. Jamais applique hors du PG local jetable.

CREATE OR REPLACE FUNCTION public.ziko_award_coins(p_user_id uuid, p_amount integer, p_source text, p_source_id uuid, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.ziko_ensure_gamification_profile(p_user_id);

  INSERT INTO public.ziko_coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  -- Atomic increment — no read-then-write race
  UPDATE public.ziko_user_gamification
  SET coins = coins + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_award_xp(p_user_id uuid, p_amount integer, p_source text, p_source_id uuid, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile      public.ziko_user_gamification;
  v_new_xp       INTEGER;
  v_new_level    INTEGER;
  v_leveled_up   BOOLEAN;
  v_level_title  TEXT;
  v_reward_coins INTEGER;
BEGIN
  v_profile := public.ziko_ensure_gamification_profile(p_user_id);

  INSERT INTO public.ziko_xp_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  v_new_xp := v_profile.xp + p_amount;

  SELECT level INTO v_new_level
  FROM public.ziko_level_definitions
  WHERE xp_required <= v_new_xp
  ORDER BY level DESC
  LIMIT 1;

  v_new_level := COALESCE(v_new_level, v_profile.level);
  v_leveled_up := v_new_level > v_profile.level;

  UPDATE public.ziko_user_gamification
  SET xp = v_new_xp, level = v_new_level, updated_at = NOW()
  WHERE user_id = p_user_id;

  IF v_leveled_up THEN
    SELECT reward_coins, title INTO v_reward_coins, v_level_title
    FROM public.ziko_level_definitions WHERE level = v_new_level;

    IF v_reward_coins > 0 THEN
      PERFORM public.ziko_award_coins(
        p_user_id, v_reward_coins, 'level_up', NULL,
        format('Niveau %s atteint : %s !', v_new_level, v_level_title)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('leveled_up', v_leveled_up, 'new_level', v_new_level);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_create_form_instances_for_trigger(p_trigger_type text, p_athlete_id uuid, p_coach_id uuid, p_n_sessions integer DEFAULT NULL::integer, p_date text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_form     RECORD;
  v_count    integer := 0;
  v_inserted integer;
BEGIN
  FOR v_form IN
    SELECT id
    FROM public.ziko_coach_forms
    WHERE coach_id = p_coach_id
      AND status = 'active'
      AND trigger_config->>'type' = p_trigger_type
      AND CASE p_trigger_type
            WHEN 'after_n_sessions' THEN
              (trigger_config->>'n_sessions')::integer = p_n_sessions
            WHEN 'fixed_date' THEN
              trigger_config->>'date' <= p_date
            ELSE TRUE
          END
  LOOP
    INSERT INTO public.ziko_form_instances(form_id, athlete_id, status)
    VALUES (v_form.id, p_athlete_id, 'pending')
    ON CONFLICT ON CONSTRAINT form_instances_no_dup_pending DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_form_instances_for_trigger] error for trigger_type=%, athlete=%, coach=%: %',
    p_trigger_type, p_athlete_id, p_coach_id, SQLERRM;
  RAISE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_deduct_ai_credits(p_user_id uuid, p_cost integer, p_action_type text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Row lock prevents concurrent deductions racing
  SELECT balance INTO v_balance
  FROM public.ziko_user_ai_credits
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
  UPDATE public.ziko_user_ai_credits
  SET balance = balance - p_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Ledger row (balance_after set by BEFORE INSERT trigger)
  INSERT INTO public.ziko_ai_credit_transactions
    (user_id, type, amount, source, idempotency_key, metadata)
  VALUES
    (p_user_id, 'deduct', -p_cost, p_action_type, p_idempotency_key, '{}'::jsonb)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance - p_cost);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_earn_ai_credits(p_user_id uuid, p_source text, p_idempotency_key text, p_amount integer DEFAULT 1, p_daily_cap integer DEFAULT 4)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_earn_count  INTEGER;
  v_rows        INTEGER;
BEGIN
  -- Check daily earn cap (EARN-07)
  SELECT COUNT(*) INTO v_earn_count
  FROM public.ziko_ai_credit_transactions
  WHERE user_id = p_user_id
    AND type = 'earn'
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC');

  IF v_earn_count >= p_daily_cap THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'daily_cap_reached');
  END IF;

  -- ON CONFLICT must include the WHERE clause to match the partial unique index
  -- idx_credit_tx_idempotency ON (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL
  INSERT INTO public.ziko_ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  VALUES (p_user_id, 'earn', p_amount, p_source, p_idempotency_key)
  ON CONFLICT (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'duplicate');
  END IF;

  -- Ensure credits row exists
  INSERT INTO public.ziko_user_ai_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Increment balance
  UPDATE public.ziko_user_ai_credits
  SET balance    = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('credited', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_ensure_gamification_profile(p_user_id uuid)
 RETURNS ziko_user_gamification
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.ziko_user_gamification;
BEGIN
  SELECT * INTO v_profile FROM public.ziko_user_gamification WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  INSERT INTO public.ziko_user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_profile FROM public.ziko_user_gamification WHERE user_id = p_user_id;
  RETURN v_profile;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_increment_community_stat(p_user_id uuid, p_field text, p_amount integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_field NOT IN (
    'messages_sent', 'gifs_sent', 'reactions_sent',
    'challenges_won', 'challenges_lost', 'challenges_tied',
    'xp_gifted', 'xp_received', 'coins_gifted', 'coins_received',
    'programs_shared', 'group_workouts_done',
    'encouragements_sent', 'encouragements_received',
    'invites_sent', 'invites_accepted'
  ) THEN
    RAISE EXCEPTION 'increment_community_stat: invalid field %', p_field;
  END IF;

  INSERT INTO public.ziko_community_user_stats (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  EXECUTE format(
    'UPDATE public.ziko_community_user_stats SET %I = %I + $1, updated_at = NOW() WHERE user_id = $2',
    p_field, p_field
  ) USING p_amount, p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_is_coach_of(coach uuid, client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ziko_coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_purchase_shop_item(p_user_id uuid, p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.ziko_user_gamification;
  v_item    public.ziko_shop_items;
  v_rows    INTEGER;
BEGIN
  v_profile := public.ziko_ensure_gamification_profile(p_user_id);

  SELECT * INTO v_item FROM public.ziko_shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Article introuvable');
  END IF;

  IF v_profile.level < v_item.level_required THEN
    RETURN jsonb_build_object('success', false, 'error', format('Niveau %s requis', v_item.level_required));
  END IF;

  IF EXISTS (SELECT 1 FROM public.ziko_user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Déjà possédé');
  END IF;

  -- Atomic guarded deduction — fails (0 rows) if balance is insufficient,
  -- closing the race where two purchases could both pass a stale balance check.
  UPDATE public.ziko_user_gamification
  SET coins = coins - v_item.price, updated_at = NOW()
  WHERE user_id = p_user_id AND coins >= v_item.price;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pas assez de pièces');
  END IF;

  INSERT INTO public.ziko_coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, -v_item.price, 'purchase', p_item_id, format('Achat : %s', v_item.name));

  INSERT INTO public.ziko_user_inventory (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  RETURN jsonb_build_object('success', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_search_users_fuzzy(search_query text, calling_user_id uuid, result_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, name text, avatar_url text, goal text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT
    p.id,
    p.name,
    p.avatar_url,
    p.goal
  FROM public.ziko_user_profiles p
  WHERE
    p.id <> calling_user_id
    AND unaccent(lower(p.name)) LIKE '%' || unaccent(lower(search_query)) || '%'
  ORDER BY
    -- Exact match (after normalization) ranked first
    CASE WHEN unaccent(lower(p.name)) = unaccent(lower(search_query)) THEN 0 ELSE 1 END,
    -- Prefix match ranked second
    CASE WHEN unaccent(lower(p.name)) LIKE unaccent(lower(search_query)) || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT result_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_send_coin_gift(p_sender_id uuid, p_receiver_id uuid, p_amount integer, p_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_amount <= 0 OR p_amount > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (1-1000)');
  END IF;
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de s''auto-offrir des pièces');
  END IF;

  PERFORM public.ziko_ensure_gamification_profile(p_sender_id);
  PERFORM public.ziko_ensure_gamification_profile(p_receiver_id);

  -- Atomic guarded debit — fails (0 rows) if balance is insufficient
  UPDATE public.ziko_user_gamification
  SET coins = coins - p_amount, updated_at = NOW()
  WHERE user_id = p_sender_id AND coins >= p_amount;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pas assez de pièces');
  END IF;

  UPDATE public.ziko_user_gamification
  SET coins = coins + p_amount, updated_at = NOW()
  WHERE user_id = p_receiver_id;

  INSERT INTO public.ziko_coin_gifts (sender_id, receiver_id, amount, message)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_message);

  PERFORM public.ziko_increment_community_stat(p_sender_id, 'coins_gifted', p_amount);
  PERFORM public.ziko_increment_community_stat(p_receiver_id, 'coins_received', p_amount);

  RETURN jsonb_build_object('success', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ziko_send_xp_gift(p_sender_id uuid, p_receiver_id uuid, p_amount integer, p_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_amount <= 0 OR p_amount > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (1-5000)');
  END IF;
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de s''auto-offrir de l''XP');
  END IF;

  INSERT INTO public.ziko_xp_gifts (sender_id, receiver_id, amount, message)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_message);

  PERFORM public.ziko_increment_community_stat(p_sender_id, 'xp_gifted', p_amount);
  PERFORM public.ziko_increment_community_stat(p_receiver_id, 'xp_received', p_amount);

  RETURN jsonb_build_object('success', true);
END;
$function$
;

