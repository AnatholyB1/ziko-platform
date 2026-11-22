-- v1.20 UAT run 9 (defaut 1) : une recompense de quete ne doit JAMAIS etre perdue en silence.
-- Fichier SEUL : jamais applique par l'agent. Idempotent (CREATE OR REPLACE + reparation gardee par NOT EXISTS).
-- Part de la DERNIERE definition de ziko_sync_quests (202612011402 ; 1602 et 2801 ne redefinissent que
-- ziko_quest_metric_value, 2802 que ziko_quest_ai_claim / ziko_create_ai_quests).
--
-- Cause : ziko_sync_quests posait rewarded_at puis appelait ziko_award_coins, qui (202612012701) borne un appelant
-- NON fiable (auth.uid() non nul) a 10 000 pieces positives / 24 h glissantes et RETOURNE SANS ERREUR au-dela. La
-- fonction etant SECURITY DEFINER mais appelee par l'athlete, le plafond anti-abus s'appliquait a une recompense
-- calculee cote serveur : quete marquee recompensee, aucune ligne de ledger, aucun retry.
--
-- Choix : chemin interne NON plafonne pour les recompenses systeme (montant fixe par le gabarit/la quete serveur,
-- jamais fourni par le client). ziko_award_coins_system n'est executable par personne (ni anon, ni authenticated, ni
-- service_role) : seules les fonctions SECURITY DEFINER du meme proprietaire l'appellent. Le plafond de
-- ziko_award_coins reste inchange pour les appels du client (seance, habitude, serie). Comme l'attribution et
-- rewarded_at sont dans la meme transaction, une erreur d'attribution annule aussi rewarded_at (quete rejouable).

CREATE OR REPLACE FUNCTION public.ziko_award_coins_system(
  p_user_id     uuid,
  p_amount      integer,
  p_source      text,
  p_source_id   uuid,
  p_description text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ziko_sec_ensure_gamification_profile(p_user_id);

  INSERT INTO public.ziko_coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);

  UPDATE public.ziko_user_gamification
     SET coins = coins + p_amount, updated_at = NOW()
   WHERE user_id = p_user_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_award_coins_system(uuid, integer, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ziko_sync_quests(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now       timestamptz := now();
  t           record;
  q           record;
  v_ps        timestamptz;
  v_pe        timestamptz;
  v_val       numeric;
  v_updated   integer;
  v_completed jsonb := '[]'::jsonb;
  v_ai        boolean;
BEGIN
  IF p_user_id IS NULL
     OR (p_user_id IS DISTINCT FROM auth.uid() AND COALESCE(auth.role(), '') <> 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_sync_quests:' || p_user_id::text, 0));

  SELECT EXISTS (SELECT 1 FROM public.ziko_user_quests WHERE user_id = p_user_id AND source = 'ai') INTO v_ai;

  -- a) Quetes de depart de la periode courante (tant que l'IA n'a pas pris le relais).
  IF NOT v_ai THEN
    FOR t IN SELECT * FROM public.ziko_quest_templates WHERE is_starter AND is_active ORDER BY sort_order LOOP
      SELECT p.period_start, p.period_end INTO v_ps, v_pe FROM public.ziko_quest_period(t.scope, v_now) p;
      INSERT INTO public.ziko_user_quests
        (user_id, template_id, slug, source, scope, title, description, icon, metric, target, unit,
         reward_coins, period_start, expires_at)
      VALUES
        (p_user_id, t.id, t.slug, 'starter', t.scope, t.title, t.description, t.icon, t.metric, t.target, t.unit,
         t.reward_coins, v_ps, v_pe)
      ON CONFLICT (user_id, slug, period_start) DO NOTHING;
    END LOOP;
  END IF;

  -- b) Mesure sur les donnees reelles de la periode de chaque quete active.
  FOR q IN SELECT * FROM public.ziko_user_quests
           WHERE user_id = p_user_id AND status = 'active' ORDER BY created_at FOR UPDATE LOOP
    v_val := public.ziko_quest_metric_value(p_user_id, q.metric, q.period_start, q.expires_at);

    IF v_val >= q.target THEN
      UPDATE public.ziko_user_quests
         SET status = 'completed', progress = v_val, completed_at = v_now, rewarded_at = v_now
       WHERE id = q.id AND rewarded_at IS NULL;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated = 1 THEN
        IF q.reward_coins > 0 THEN
          PERFORM public.ziko_award_coins_system(p_user_id, q.reward_coins, 'quest', q.id, 'Quête : ' || q.title);
        END IF;
        v_completed := v_completed || jsonb_build_array(
          jsonb_build_object('id', q.id, 'title', q.title, 'coins', q.reward_coins));
      END IF;
    ELSIF q.expires_at <= v_now THEN
      -- Echue sans atteindre la cible : statut neutre, aucune penalite (v1.18).
      UPDATE public.ziko_user_quests SET status = 'expired', progress = v_val WHERE id = q.id;
    ELSE
      UPDATE public.ziko_user_quests SET progress = v_val WHERE id = q.id AND progress IS DISTINCT FROM v_val;
    END IF;
  END LOOP;

  -- c) Lecture : en cours + terminees de la periode + echues pas encore remplacees (jamais comptees dans les actives).
  RETURN jsonb_build_object(
    'quests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', uq.id, 'slug', uq.slug, 'source', uq.source, 'scope', uq.scope, 'title', uq.title,
        'description', uq.description, 'icon', uq.icon, 'metric', uq.metric, 'target', uq.target,
        'unit', uq.unit, 'reward_coins', uq.reward_coins, 'period_start', uq.period_start,
        'expires_at', uq.expires_at, 'status', uq.status, 'progress', uq.progress,
        'completed_at', uq.completed_at
      ) ORDER BY CASE uq.scope WHEN 'daily' THEN 0 ELSE 1 END, uq.created_at)
      FROM public.ziko_user_quests uq
      WHERE uq.user_id = p_user_id
        AND (
          (uq.status = 'active')
          OR (uq.status = 'completed' AND uq.expires_at > v_now)
          OR (uq.status = 'expired' AND NOT EXISTS (
                SELECT 1 FROM public.ziko_user_quests n
                WHERE n.user_id = uq.user_id AND n.id <> uq.id AND n.status IN ('active', 'completed')
                  AND (
                    (uq.source = 'starter' AND n.source = 'starter' AND n.scope = uq.scope AND n.period_start > uq.period_start)
                    OR (n.source = 'ai' AND n.created_at > uq.created_at)
                  )))
        )
    ), '[]'::jsonb),
    'newly_completed', v_completed
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_sync_quests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_sync_quests(uuid) TO authenticated, service_role;

-- Reparation (idempotente) : quetes deja marquees recompensees sans ligne de ledger (pertes silencieuses du plafond).
-- Une seule attribution par quete (NOT EXISTS sur source='quest' + source_id) ; rejouable sans double versement.
DO $repair$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT uq.id, uq.user_id, uq.reward_coins, uq.title
      FROM public.ziko_user_quests uq
     WHERE uq.status = 'completed' AND uq.rewarded_at IS NOT NULL AND uq.reward_coins > 0
       AND NOT EXISTS (SELECT 1 FROM public.ziko_coin_transactions t
                        WHERE t.user_id = uq.user_id AND t.source = 'quest' AND t.source_id = uq.id)
  LOOP
    PERFORM public.ziko_award_coins_system(r.user_id, r.reward_coins, 'quest', r.id, 'Quête : ' || r.title);
  END LOOP;
END
$repair$;
