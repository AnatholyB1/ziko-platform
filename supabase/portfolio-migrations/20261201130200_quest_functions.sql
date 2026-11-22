-- v1.20 phase 13 (QUEST-01 / QUEST-02) : fonctions de quetes (progression reelle, quetes de depart, API P14).
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612011301.
--
-- Toutes SECURITY DEFINER avec search_path fige. Les fonctions internes (periode, mesure) ne sont
-- appelables par aucun client. `ziko_sync_quests` : p_user_id = auth.uid() ou service_role.
-- `ziko_create_quests` : service_role seul (backend / outil IA de P14).
--
-- Regle non punitive (v1.18) : rien n'est jamais retire. Une quete atteinte pendant sa periode est
-- creditee meme si la synchronisation a lieu apres l'echeance (la mesure est bornee a la periode).

-- 1. Bornes de periode (fuseau Europe/Paris, semaine = lundi 00:00 -> lundi suivant).
CREATE OR REPLACE FUNCTION public.ziko_quest_period(p_scope text, p_now timestamptz DEFAULT now())
 RETURNS TABLE (period_start timestamptz, period_end timestamptz)
 LANGUAGE plpgsql
 STABLE
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_local timestamp := p_now AT TIME ZONE 'Europe/Paris';
  v_start timestamp;
  v_end   timestamp;
BEGIN
  IF p_scope = 'weekly' THEN
    v_start := date_trunc('week', v_local);
    v_end   := v_start + interval '7 days';
  ELSE
    v_start := date_trunc('day', v_local);
    v_end   := v_start + interval '1 day';
  END IF;
  period_start := v_start AT TIME ZONE 'Europe/Paris';
  period_end   := v_end   AT TIME ZONE 'Europe/Paris';
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_period(text, timestamptz) FROM PUBLIC, anon, authenticated;

-- 2. Mesure reelle d'une metrique sur [p_from, p_to[ (donnees reelles uniquement).
CREATE OR REPLACE FUNCTION public.ziko_quest_metric_value(p_user_id uuid, p_metric text, p_from timestamptz, p_to timestamptz)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_from_d date := (p_from AT TIME ZONE 'Europe/Paris')::date;
  v_to_d   date := (p_to   AT TIME ZONE 'Europe/Paris')::date;   -- exclusive
  v_val    numeric := 0;
BEGIN
  IF p_metric = 'workout_sessions' THEN
    -- Seance comptee = au moins une serie enregistree (meme regle que les succes P12 / P6 D-02).
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_workout_sessions ws
    WHERE ws.user_id = p_user_id
      AND ws.started_at >= p_from AND ws.started_at < p_to
      AND EXISTS (SELECT 1 FROM public.ziko_session_sets ss WHERE ss.session_id = ws.id);
  ELSIF p_metric = 'hydration_ml' THEN
    SELECT COALESCE(SUM(h.amount_ml), 0) INTO v_val
    FROM public.ziko_hydration_logs h
    WHERE h.user_id = p_user_id AND h.date >= v_from_d AND h.date < v_to_d;
  ELSIF p_metric = 'nutrition_logs' THEN
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_nutrition_logs n
    WHERE n.user_id = p_user_id AND n.date >= v_from_d AND n.date < v_to_d;
  ELSIF p_metric = 'habit_logs' THEN
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_habit_logs hl
    WHERE hl.user_id = p_user_id AND hl.date >= v_from_d AND hl.date < v_to_d;
  END IF;
  RETURN COALESCE(v_val, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_metric_value(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- 3. Synchronisation : quetes de depart, progression reelle, completion + pieces (une seule fois).
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
BEGIN
  IF p_user_id IS NULL
     OR (p_user_id IS DISTINCT FROM auth.uid() AND COALESCE(auth.role(), '') <> 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Serialise les syncs concurrentes d'un meme utilisateur (double ouverture = pas de double credit).
  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_sync_quests:' || p_user_id::text, 0));

  -- a) Quetes de depart de la periode courante : identiques pour tous, creees si absentes (idempotent).
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
                WHERE n.user_id = uq.user_id AND n.scope = uq.scope AND n.source = uq.source
                  AND n.period_start > uq.period_start AND n.status IN ('active', 'completed')))
        )
    ), '[]'::jsonb),
    'newly_completed', v_completed
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_sync_quests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_sync_quests(uuid) TO authenticated, service_role;

-- 4. Creation de quetes par le backend (outil IA de P14). Valide, ne plafonne PAS a 3 (regle de P14).
--    p_quests : [{ title, description?, icon?, metric, target, unit?, reward_coins?, scope?, duration_hours?, ai_meta? }]
CREATE OR REPLACE FUNCTION public.ziko_create_quests(p_user_id uuid, p_quests jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now     timestamptz := now();
  e         jsonb;
  v_id      uuid;
  v_ids     jsonb := '[]'::jsonb;
  v_scope   text;
  v_hours   numeric;
  v_metric  text;
  v_target  numeric;
  v_reward  integer;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR jsonb_typeof(p_quests) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(p_quests) LOOP
    v_metric := e ->> 'metric';
    v_target := (e ->> 'target')::numeric;
    v_reward := COALESCE((e ->> 'reward_coins')::integer, 0);
    v_scope  := COALESCE(e ->> 'scope', 'weekly');
    v_hours  := COALESCE((e ->> 'duration_hours')::numeric, CASE WHEN v_scope = 'daily' THEN 24 ELSE 168 END);

    IF COALESCE(e ->> 'title', '') = '' THEN RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023'; END IF;
    IF v_metric IS NULL OR v_metric <> ALL (ARRAY['workout_sessions', 'hydration_ml', 'nutrition_logs', 'habit_logs']) THEN
      RAISE EXCEPTION 'invalid_metric' USING ERRCODE = '22023';
    END IF;
    IF v_target IS NULL OR v_target <= 0 THEN RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023'; END IF;
    IF v_reward < 0 OR v_reward > 500 THEN RAISE EXCEPTION 'invalid_reward' USING ERRCODE = '22023'; END IF;
    IF v_scope <> ALL (ARRAY['daily', 'weekly']) THEN RAISE EXCEPTION 'invalid_scope' USING ERRCODE = '22023'; END IF;
    IF v_hours < 1 OR v_hours > 840 THEN RAISE EXCEPTION 'invalid_duration' USING ERRCODE = '22023'; END IF;

    v_id := gen_random_uuid();
    INSERT INTO public.ziko_user_quests
      (id, user_id, template_id, slug, source, scope, title, description, icon, metric, target, unit,
       reward_coins, period_start, expires_at, ai_meta)
    VALUES
      (v_id, p_user_id, NULL, 'ai-' || v_id::text, 'ai', v_scope, e ->> 'title', e ->> 'description',
       COALESCE(NULLIF(e ->> 'icon', ''), 'flag'), v_metric, v_target, e ->> 'unit', v_reward,
       v_now, v_now + make_interval(secs => v_hours * 3600),
       COALESCE(e -> 'ai_meta', '{}'::jsonb));
    v_ids := v_ids || to_jsonb(v_id);
  END LOOP;

  RETURN jsonb_build_object('created', v_ids);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_create_quests(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_create_quests(uuid, jsonb) TO service_role;
