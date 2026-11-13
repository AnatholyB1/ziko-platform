-- ============================================================
-- v1.20 - Durcissement securite (audit AUDIT-SECURITY.md, constats 1, 2, 3, 5, 9, 10-inventory)
-- Fichier seulement. IDEMPOTENT (CREATE OR REPLACE / REVOKE / DROP TRIGGER IF EXISTS).
-- Aucune migration existante n'est modifiee. A rejouer sans danger.
--
-- Probleme : des fonctions SECURITY DEFINER anciennes (economie, credits IA, formulaires, communaute)
-- etaient executables par `anon` avec un parametre utilisateur falsifiable et AUCUN controle auth.uid().
-- Strategie par fonction (la signature est conservee) :
--   * reservees a service_role (seul le backend les appelle) : REVOKE PUBLIC/anon/authenticated, GRANT service_role ;
--       ziko_earn_ai_credits, ziko_deduct_ai_credits, ziko_create_form_instances_for_trigger
--   * appelables par le mobile pour SOI-MEME : REVOKE PUBLIC/anon + controle auth.uid() = p_*_id
--     (service_role / appels internes sans JWT restent autorises) :
--       ziko_award_coins, ziko_award_xp (+ plafonds), ziko_ensure_gamification_profile,
--       ziko_purchase_shop_item, ziko_send_coin_gift, ziko_send_xp_gift, ziko_increment_community_stat
--   * ziko_is_coach_of : reste executable (utilisee dans les policies RLS, y compris celles evaluees pour anon) mais ne
--     repond plus que sur la relation de l'appelant (plus d'oracle pour un tiers/anon)
--   * ziko_search_users_fuzzy : authenticated seulement, calling_user_id = auth.uid(), profils prives exclus
-- Les fonctions *internes* ziko_sec_* (corps historiques sans controle) ne sont executables par personne d'autre
-- que le proprietaire : elles servent aux fonctions SECURITY DEFINER ci-dessous (cadeaux : le destinataire n'est pas
-- l'appelant). Les appels internes existants (badges, quetes, niveaux) continuent de passer : l'appelant y est
-- toujours auth.uid() = p_user_id.
-- ============================================================

-- ---- 0. Helpers (non executables par les clients) ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_sec_jwt_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'role', '')
  );
$function$;

-- Appel "de confiance" : service_role, ou connexion directe sans JWT (migrations, crons SQL).
-- Un jeton anon (role = anon) ou un utilisateur (auth.uid() non nul) n'est JAMAIS de confiance.
CREATE OR REPLACE FUNCTION public.ziko_sec_is_trusted()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = public, pg_temp
AS $function$
  SELECT auth.uid() IS NULL AND COALESCE(public.ziko_sec_jwt_role(), 'service_role') = 'service_role';
$function$;

-- Ces helpers sont appeles depuis des fonctions SECURITY DEFINER (proprietaire) ET depuis la policy RLS de
-- ziko_is_coach_of (role de l'appelant) : EXECUTE reste donc ouvert, ils ne revelent rien (booleen / role du JWT).
GRANT EXECUTE ON FUNCTION public.ziko_sec_jwt_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_sec_is_trusted() TO anon, authenticated, service_role;

-- ---- 1a. Reservees a service_role --------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ziko_earn_ai_credits(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_earn_ai_credits(uuid, text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.ziko_deduct_ai_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_deduct_ai_credits(uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.ziko_create_form_instances_for_trigger(text, uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_create_form_instances_for_trigger(text, uuid, uuid, integer, text) TO service_role;

-- ---- 1b. Fonctions internes (corps historiques, sans controle) ----------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_sec_ensure_gamification_profile(p_user_id uuid)
 RETURNS public.ziko_user_gamification
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
$function$;

CREATE OR REPLACE FUNCTION public.ziko_sec_increment_community_stat(p_user_id uuid, p_field text, p_amount integer DEFAULT 1)
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
$function$;

REVOKE ALL ON FUNCTION public.ziko_sec_ensure_gamification_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ziko_sec_increment_community_stat(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_sec_ensure_gamification_profile(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ziko_sec_increment_community_stat(uuid, text, integer) TO service_role;

-- ---- 1c. Pour SOI-MEME : controle auth.uid() ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_ensure_gamification_profile(p_user_id uuid)
 RETURNS public.ziko_user_gamification
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.ziko_sec_is_trusted() OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.ziko_sec_ensure_gamification_profile(p_user_id);
END;
$function$;

-- Attribution de pieces. Le mobile l'appelle pour lui-meme (seance, habitude, serie) ; les fonctions SQL de badges,
-- quetes et niveaux l'appellent avec l'utilisateur courant. Un appelant non fiable est borne : montant 1..1000 par
-- appel (le plus gros palier de niveau vaut 1000) et 10000 pieces positives maximum sur 24 h glissantes
-- (au-dela : aucun effet, sans erreur). Risque residuel documente : l'auto-attribution dans ces bornes reste
-- possible tant que les recompenses de seance/habitude sont declenchees par le client.
CREATE OR REPLACE FUNCTION public.ziko_award_coins(
  p_user_id     uuid,
  p_amount      integer,
  p_source      text,
  p_source_id   uuid,
  p_description text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_24h bigint;
BEGIN
  IF NOT public.ziko_sec_is_trusted() THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000 THEN
      RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(SUM(amount), 0) INTO v_24h
      FROM public.ziko_coin_transactions
     WHERE user_id = p_user_id AND amount > 0 AND created_at > now() - interval '24 hours';
    IF v_24h + p_amount > 10000 THEN
      RETURN;
    END IF;
  END IF;

  PERFORM public.ziko_sec_ensure_gamification_profile(p_user_id);

  INSERT INTO public.ziko_coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  -- Atomic increment — no read-then-write race
  UPDATE public.ziko_user_gamification
  SET coins = coins + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ziko_award_xp(
  p_user_id     uuid,
  p_amount      integer,
  p_source      text,
  p_source_id   uuid,
  p_description text
)
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
  v_24h          bigint;
BEGIN
  IF NOT public.ziko_sec_is_trusted() THEN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_amount IS NULL OR p_amount < 1 OR p_amount > 2000 THEN
      RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(SUM(amount), 0) INTO v_24h
      FROM public.ziko_xp_transactions
     WHERE user_id = p_user_id AND amount > 0 AND created_at > now() - interval '24 hours';
    IF v_24h + p_amount > 20000 THEN
      RETURN jsonb_build_object('leveled_up', false, 'new_level', NULL);
    END IF;
  END IF;

  v_profile := public.ziko_sec_ensure_gamification_profile(p_user_id);

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
$function$;

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
  IF NOT (public.ziko_sec_is_trusted() OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_profile := public.ziko_sec_ensure_gamification_profile(p_user_id);

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
$function$;

CREATE OR REPLACE FUNCTION public.ziko_increment_community_stat(p_user_id uuid, p_field text, p_amount integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.ziko_sec_is_trusted() THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    -- Le mobile n'incremente que de 1. Statistiques cosmetiques : soi-meme (sauf compteurs "recus"), et
    -- l'encouragement recu par un tiers (seul cas legitime d'ecriture sur la ligne d'un autre).
    IF p_amount IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
    END IF;
    IF NOT (
         (p_user_id = auth.uid() AND p_field NOT LIKE '%\_received' ESCAPE '\')
      OR (p_field = 'encouragements_received' AND p_user_id <> auth.uid())
    ) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;
  PERFORM public.ziko_sec_increment_community_stat(p_user_id, p_field, p_amount);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ziko_send_xp_gift(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_amount      integer,
  p_message     text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.ziko_sec_is_trusted() OR auth.uid() = p_sender_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 OR p_amount > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (1-5000)');
  END IF;
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de s''auto-offrir de l''XP');
  END IF;

  INSERT INTO public.ziko_xp_gifts (sender_id, receiver_id, amount, message)
  VALUES (p_sender_id, p_receiver_id, p_amount, p_message);

  PERFORM public.ziko_sec_increment_community_stat(p_sender_id, 'xp_gifted', p_amount);
  PERFORM public.ziko_sec_increment_community_stat(p_receiver_id, 'xp_received', p_amount);

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ziko_send_coin_gift(
  p_sender_id   uuid,
  p_receiver_id uuid,
  p_amount      integer,
  p_message     text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT (public.ziko_sec_is_trusted() OR auth.uid() = p_sender_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 OR p_amount > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (1-1000)');
  END IF;
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de s''auto-offrir des pièces');
  END IF;

  PERFORM public.ziko_sec_ensure_gamification_profile(p_sender_id);
  PERFORM public.ziko_sec_ensure_gamification_profile(p_receiver_id);

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

  PERFORM public.ziko_sec_increment_community_stat(p_sender_id, 'coins_gifted', p_amount);
  PERFORM public.ziko_sec_increment_community_stat(p_receiver_id, 'coins_received', p_amount);

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.ziko_ensure_gamification_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_award_coins(uuid, integer, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_award_xp(uuid, integer, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_purchase_shop_item(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_increment_community_stat(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_send_xp_gift(uuid, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ziko_send_coin_gift(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_ensure_gamification_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_award_coins(uuid, integer, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_award_xp(uuid, integer, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_purchase_shop_item(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_increment_community_stat(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_send_xp_gift(uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ziko_send_coin_gift(uuid, uuid, integer, text) TO authenticated, service_role;

-- ---- 9. ziko_is_coach_of : plus d'oracle pour un tiers ---------------------------------------------------------
-- Reste executable par tous les roles (les policies RLS l'evaluent aussi pour anon : un REVOKE ferait echouer ces
-- requetes en "permission denied" au lieu de renvoyer 0 ligne). Les usages legitimes (policies, RPC) passent
-- toujours auth.uid() comme coach ou comme client ; tout autre appel renvoie false.
CREATE OR REPLACE FUNCTION public.ziko_is_coach_of(coach uuid, client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(public.ziko_sec_is_trusted() OR auth.uid() IN (coach, client), false)
     AND EXISTS (
    SELECT 1 FROM public.ziko_coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$function$;

-- ---- 2. ziko_search_users_fuzzy : authentifie, calling_user_id = auth.uid(), profils prives exclus ------------
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
    auth.uid() IS NOT NULL
    AND auth.uid() = calling_user_id
    AND p.id <> calling_user_id
    AND COALESCE(p.is_public, true)
    AND unaccent(lower(p.name)) LIKE '%' || unaccent(lower(search_query)) || '%'
  ORDER BY
    -- Exact match (after normalization) ranked first
    CASE WHEN unaccent(lower(p.name)) = unaccent(lower(search_query)) THEN 0 ELSE 1 END,
    -- Prefix match ranked second
    CASE WHEN unaccent(lower(p.name)) LIKE unaccent(lower(search_query)) || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 20), 1), 50);
$function$;
REVOKE ALL ON FUNCTION public.ziko_search_users_fuzzy(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_search_users_fuzzy(text, uuid, integer) TO authenticated, service_role;

-- ---- 3. ziko_user_profiles : tier / subscription_tier / is_lifetime_premium non modifiables par le client ------
-- Le trigger est SECURITY INVOKER (comme ziko_guard_email_verified_at) : current_user = role reel de la requete.
-- Les ecritures backend (service_role), webhooks et fonctions SECURITY DEFINER passent. `role` reste modifiable
-- par l'utilisateur (client -> both/coach) : le parcours d'onboarding coach l'ecrit avec le JWT utilisateur, et
-- les droits coach reels viennent de ziko_coach_client_links (CHECK role IN client/coach/both).
CREATE OR REPLACE FUNCTION public.ziko_guard_profile_privileged_cols()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.tier IS DISTINCT FROM 'free'
         OR NEW.subscription_tier IS DISTINCT FROM 'free'
         OR COALESCE(NEW.is_lifetime_premium, false) THEN
        RAISE EXCEPTION 'tier, subscription_tier and is_lifetime_premium are write-protected' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.tier IS DISTINCT FROM OLD.tier
       OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.is_lifetime_premium IS DISTINCT FROM OLD.is_lifetime_premium THEN
      RAISE EXCEPTION 'tier, subscription_tier and is_lifetime_premium are write-protected' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ziko_guard_profile_privileged_cols ON public.ziko_user_profiles;
CREATE TRIGGER trg_ziko_guard_profile_privileged_cols
  BEFORE INSERT OR UPDATE ON public.ziko_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ziko_guard_profile_privileged_cols();

-- ---- 5. ziko_ai_cost_log : lecture seule pour les clients ---------------------------------------------------
-- Les plafonds d'appels IA absorbes (recherche web atelier, relance programme, quetes, ligue) se comptent ici :
-- l'utilisateur ne doit pouvoir ni supprimer ni falsifier ses lignes. Le backend ecrit avec service_role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ziko_ai_cost_log FROM authenticated, anon;

-- ---- ziko_user_inventory : seul is_equipped est modifiable par le client (pas d'echange d'article) ------------
REVOKE UPDATE ON public.ziko_user_inventory FROM authenticated, anon;
GRANT UPDATE (is_equipped) ON public.ziko_user_inventory TO authenticated;
