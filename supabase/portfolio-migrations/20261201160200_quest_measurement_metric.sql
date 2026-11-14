-- v1.20 phase 16 (MEAS-09) : les objectifs de mesures alimentent les quetes.
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612011301/1302 (dont ce fichier redefinit
-- ziko_quest_metric_value et ziko_create_quests, copies de 1302 + une branche) ; ne touche PAS ziko_sync_quests
-- (redefinie par 1402) ni ziko_create_ai_quests (1401, appelle ziko_create_quests).
--
-- Nouvelle metrique `measurement_logs` : nombre de saisies de mesures corporelles (ziko_body_measurements)
-- sur la periode de la quete. Une quete liee a un objectif porte ai_meta = {goal_id, measure_key}.

-- 1. CHECK de la table des quetes utilisateur (les modeles de depart restent sur 4 metriques).
ALTER TABLE public.ziko_user_quests DROP CONSTRAINT IF EXISTS ziko_user_quests_metric_check;
ALTER TABLE public.ziko_user_quests ADD CONSTRAINT ziko_user_quests_metric_check
  CHECK (metric = ANY (ARRAY['workout_sessions'::text, 'hydration_ml'::text, 'nutrition_logs'::text, 'habit_logs'::text, 'measurement_logs'::text]));

-- 2. Mesure reelle (copie de 1302 + branche measurement_logs)
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
  ELSIF p_metric = 'measurement_logs' THEN
    -- Une saisie = une ligne ziko_body_measurements datee dans la periode (une ligne par jour et par saisie).
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_body_measurements bm
    WHERE bm.user_id = p_user_id AND bm.date >= v_from_d AND bm.date < v_to_d;
  END IF;
  RETURN COALESCE(v_val, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_metric_value(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- 3. Creation par le backend (copie de 1302, liste blanche etendue)
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
    IF v_metric IS NULL OR v_metric <> ALL (ARRAY['workout_sessions', 'hydration_ml', 'nutrition_logs', 'habit_logs', 'measurement_logs']) THEN
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
