-- v1.20 revue B (M1, QUEST-04) : le relais quetes de depart -> IA ne depend plus d'une place libre.
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612011401 (CREATE OR REPLACE de ziko_quest_ai_claim et
-- ziko_create_ai_quests : signatures et droits inchanges) et de 202612011402 (ziko_sync_quests).
--
-- Regle non punitive retenue : une quete de depart OUVERTE ne bloque jamais l'IA. Le plafond de 3 quetes actives
-- est conserve ; il se calcule sur les quetes NON starter (IA / chat). Si une creation IA depasse 3 actives au total,
-- les quetes de depart les plus anciennes encore ouvertes passent au statut neutre `expired` (aucune perte de
-- piece : une synchronisation est faite AVANT, une quete deja atteinte est donc creditee d'abord ; progression
-- conservee, aucune penalite v1.18). Les starters ne se renouvellent plus des qu'une quete IA existe (1402).
--
-- Declenchement (hors demande explicite) : `no_quest` (plus aucune active) | `starters_done` (aucune quete IA active et
-- au moins une quete de depart terminee : la personne s'est engagee) | `level_up`. Un nouveau joueur qui n'a rien
-- termine garde ses starters (`not_needed`).

CREATE OR REPLACE FUNCTION public.ziko_quest_ai_claim(p_user_id uuid, p_daily_cap integer DEFAULT 2, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now     timestamptz := now();
  v_today   date := (v_now AT TIME ZONE 'Europe/Paris')::date;
  v_active  integer;
  v_ai_act  integer;
  v_slots   integer;
  v_level   integer;
  v_st      public.ziko_quest_ai_state%ROWTYPE;
  v_any     boolean;
  v_engaged boolean;
  v_reason  text;
  v_levelup boolean;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_sync_quests:' || p_user_id::text, 0));

  -- Actives = en cours ET non echues. Le plafond ne compte que les quetes non starter.
  SELECT COUNT(*), COUNT(*) FILTER (WHERE source <> 'starter') INTO v_active, v_ai_act
    FROM public.ziko_user_quests
   WHERE user_id = p_user_id AND status = 'active' AND expires_at > v_now;
  v_slots := GREATEST(0, 3 - v_ai_act);
  SELECT COALESCE((SELECT level FROM public.ziko_user_gamification WHERE user_id = p_user_id), 1) INTO v_level;
  SELECT EXISTS (SELECT 1 FROM public.ziko_user_quests WHERE user_id = p_user_id) INTO v_any;
  SELECT EXISTS (SELECT 1 FROM public.ziko_user_quests WHERE user_id = p_user_id AND source = 'starter' AND status = 'completed')
    INTO v_engaged;

  INSERT INTO public.ziko_quest_ai_state (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_st FROM public.ziko_quest_ai_state WHERE user_id = p_user_id FOR UPDATE;
  v_levelup := v_st.last_level IS NOT NULL AND v_level > v_st.last_level;

  IF NOT v_any AND NOT p_force THEN
    RETURN jsonb_build_object('proceed', false, 'reason', 'not_initialized', 'slots', v_slots, 'level', v_level, 'active', v_active);
  END IF;

  IF v_slots = 0 THEN
    -- Trois quetes IA actives : le niveau est considere comme vu.
    UPDATE public.ziko_quest_ai_state SET last_level = v_level, updated_at = v_now WHERE user_id = p_user_id;
    RETURN jsonb_build_object('proceed', false, 'reason', 'full', 'slots', 0, 'level', v_level, 'active', v_active);
  END IF;

  IF p_force THEN
    v_reason := 'requested';
  ELSIF v_active = 0 THEN
    v_reason := 'no_quest';
  ELSIF v_ai_act = 0 AND v_engaged THEN
    v_reason := 'starters_done';
  ELSIF v_levelup THEN
    v_reason := 'level_up';
  ELSE
    IF v_st.last_level IS NULL THEN
      UPDATE public.ziko_quest_ai_state SET last_level = v_level, updated_at = v_now WHERE user_id = p_user_id;
    END IF;
    RETURN jsonb_build_object('proceed', false, 'reason', 'not_needed', 'slots', v_slots, 'level', v_level, 'active', v_active);
  END IF;

  IF NOT p_force THEN
    IF v_st.auto_day = v_today AND v_st.auto_count >= p_daily_cap THEN
      RETURN jsonb_build_object('proceed', false, 'reason', 'daily_cap', 'slots', v_slots, 'level', v_level, 'active', v_active);
    END IF;
    UPDATE public.ziko_quest_ai_state
       SET auto_count = CASE WHEN auto_day = v_today THEN auto_count + 1 ELSE 1 END,
           auto_day = v_today
     WHERE user_id = p_user_id;
  END IF;
  UPDATE public.ziko_quest_ai_state SET last_level = v_level, last_generated_at = v_now, updated_at = v_now
   WHERE user_id = p_user_id;

  RETURN jsonb_build_object('proceed', true, 'reason', v_reason, 'slots', v_slots, 'level', v_level, 'active', v_active);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_ai_claim(uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_quest_ai_claim(uuid, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.ziko_create_ai_quests(p_user_id uuid, p_quests jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now     timestamptz := now();
  v_active  integer;
  v_ai_act  integer;
  v_slots   integer;
  v_total   integer;
  v_take    jsonb;
  v_res     jsonb;
  v_over    integer;
  v_freed   integer := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR jsonb_typeof(p_quests) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_sync_quests:' || p_user_id::text, 0));

  -- Credite d'abord ce qui est deja atteint (une quete de depart accomplie ne doit jamais etre ecartee sans recompense).
  PERFORM public.ziko_sync_quests(p_user_id);

  SELECT COUNT(*), COUNT(*) FILTER (WHERE source <> 'starter') INTO v_active, v_ai_act
    FROM public.ziko_user_quests
   WHERE user_id = p_user_id AND status = 'active' AND expires_at > v_now;
  v_slots := GREATEST(0, 3 - v_ai_act);
  v_total := jsonb_array_length(p_quests);

  SELECT COALESCE(jsonb_agg(s.e ORDER BY s.n), '[]'::jsonb) INTO v_take
    FROM (SELECT t.e, t.n FROM jsonb_array_elements(p_quests) WITH ORDINALITY AS t(e, n) ORDER BY t.n LIMIT v_slots) s;

  IF jsonb_array_length(v_take) = 0 THEN
    RETURN jsonb_build_object('created', '[]'::jsonb, 'skipped', v_total, 'slots_before', v_slots, 'starters_retired', 0);
  END IF;

  -- Plafond de 3 actives au total : on libere les quetes de depart ouvertes les plus anciennes (statut neutre).
  v_over := GREATEST(0, v_active + jsonb_array_length(v_take) - 3);
  IF v_over > 0 THEN
    WITH victims AS (
      SELECT id FROM public.ziko_user_quests
       WHERE user_id = p_user_id AND source = 'starter' AND status = 'active' AND expires_at > v_now
       ORDER BY period_start, created_at LIMIT v_over
    )
    UPDATE public.ziko_user_quests uq SET status = 'expired'
      FROM victims WHERE uq.id = victims.id;
    GET DIAGNOSTICS v_freed = ROW_COUNT;
  END IF;

  v_res := public.ziko_create_quests(p_user_id, v_take);
  RETURN jsonb_build_object('created', v_res -> 'created', 'skipped', v_total - jsonb_array_length(v_take),
                            'slots_before', v_slots, 'starters_retired', v_freed);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_create_ai_quests(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_create_ai_quests(uuid, jsonb) TO service_role;
