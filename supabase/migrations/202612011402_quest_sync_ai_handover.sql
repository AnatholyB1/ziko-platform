-- v1.20 phase 14 (QUEST-05 / QUEST-07) : ziko_sync_quests passe le relais a l'IA.
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612011302 (remplace la fonction, CREATE OR REPLACE)
-- et de 202612011401. Signature, droits et forme du retour inchanges (contrat P13 / app mobile).
--
-- Deux changements par rapport a 1302 :
--  1. Les quetes de depart ne se renouvellent plus des qu'une quete IA existe pour l'utilisateur : sinon elles
--     reoccuperaient toujours les 3 places et l'IA ne pourrait jamais creer (QUEST-04/05). Avant la premiere
--     generation IA, comportement P13 inchange.
--  2. Une quete echue (statut neutre `expired`, aucune penalite v1.18) reste visible jusqu'a son remplacement :
--     - depart : remplacee par la meme quete d'une periode suivante (P13) ou, une fois le relais pris, par
--       n'importe quelle quete IA creee apres elle ;
--     - IA : remplacee par toute quete IA plus recente (active ou terminee), quelle que soit sa portee.

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
          PERFORM public.ziko_award_coins(p_user_id, q.reward_coins, 'quest', q.id, 'Quête : ' || q.title);
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
