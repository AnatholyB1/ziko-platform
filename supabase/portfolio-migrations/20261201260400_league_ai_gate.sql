-- v1.20 phase 26 (LEAG-03) : porte de la transition Habitudes -> Performance decidee par l'IA. Fichier SEUL, jamais applique.
-- Depend de 202612012601 / 202612012603. Tout est reserve a service_role (backend) ; aucun droit client.
--
-- Trois temps, tous en base, jamais confies au client ni au modele :
--  1. ziko_league_eligibility : pre-filtre DETERMINISTE (piste habitudes, tier >= 3, 4 semaines cloturees consecutives
--     en piste habitudes avec moyenne >= 70, aucune transition depuis 28 jours). Interne.
--  2. ziko_league_ai_claim : reserve l'appel IA = pre-filtre OK + plafond quotidien (1 appel automatique par jour et par
--     personne, absorbe par la plateforme, journalise cote backend dans ziko_ai_cost_log source league_transition).
--  3. ziko_league_apply_transition : re-verifie le pre-filtre (une reponse "true" du modele ne le saute pas) puis bascule.
--     L'IA ne peut decider QUE habitudes -> performance (CHECK de ziko_league_transitions).

CREATE OR REPLACE FUNCTION public.ziko_league_eligibility(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tier   integer := 1;
  v_ready  text;
  v_onb    jsonb;
  st       public.ziko_league_state%ROWTYPE;
  v_n      integer;
  v_span   integer;
  v_avg    numeric;
  v_weeks  jsonb;
BEGIN
  SELECT COALESCE(tier, 1), readiness, onboarding_profile INTO v_tier, v_ready, v_onb
    FROM public.ziko_athlete_state WHERE user_id = p_user;
  IF NOT FOUND THEN v_tier := 1; END IF;
  SELECT * INTO st FROM public.ziko_league_state WHERE user_id = p_user;
  IF NOT FOUND OR v_tier < 3 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_unlocked');
  END IF;
  IF st.track <> 'habits' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_habits_track');
  END IF;
  IF EXISTS (SELECT 1 FROM public.ziko_league_transitions WHERE user_id = p_user AND created_at > now() - interval '28 days') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'recent_transition');
  END IF;

  SELECT COUNT(*), (MAX(week_start) - MIN(week_start)), AVG(score),
         jsonb_agg(jsonb_build_object('week_start', week_start, 'score', score) ORDER BY week_start DESC)
    INTO v_n, v_span, v_avg, v_weeks
    FROM (SELECT week_start, score FROM public.ziko_league_weeks
           WHERE user_id = p_user AND track = 'habits' ORDER BY week_start DESC LIMIT 4) w;
  IF v_n < 4 OR v_span <> 21 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_enough_weeks');
  END IF;
  IF v_avg < 70 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'below_threshold');
  END IF;

  -- Preuve BORNEE : uniquement des scalaires de ziko_athlete_state et des scores de regularite (aucune donnee de sante).
  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'eligible',
    'evidence', jsonb_build_object(
      'weeks', v_weeks,
      'average_score', round(v_avg, 2),
      'tier', v_tier,
      'readiness', v_ready,
      'experience_level', v_onb->>'experience_level'
    )
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_eligibility(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_league_eligibility(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ziko_league_ai_claim(p_user uuid, p_daily_cap integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_elig  jsonb;
  v_st    public.ziko_league_ai_state%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL OR p_daily_cap IS NULL OR p_daily_cap < 0 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_league_sync:' || p_user::text, 0));

  v_elig := public.ziko_league_eligibility(p_user);
  IF NOT (v_elig->>'eligible')::boolean THEN
    RETURN jsonb_build_object('proceed', false, 'reason', v_elig->>'reason');
  END IF;

  INSERT INTO public.ziko_league_ai_state (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_st FROM public.ziko_league_ai_state WHERE user_id = p_user FOR UPDATE;
  IF v_st.auto_day = v_today AND v_st.auto_count >= p_daily_cap THEN
    RETURN jsonb_build_object('proceed', false, 'reason', 'daily_cap');
  END IF;

  UPDATE public.ziko_league_ai_state
     SET auto_count = CASE WHEN auto_day = v_today THEN auto_count + 1 ELSE 1 END,
         auto_day = v_today, last_checked_at = now()
   WHERE user_id = p_user;
  RETURN jsonb_build_object('proceed', true, 'reason', 'eligible', 'evidence', v_elig->'evidence');
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_ai_claim(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_league_ai_claim(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ziko_league_apply_transition(p_user uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_elig   jsonb;
  v_reason text := left(btrim(COALESCE(p_reason, '')), 300);
  v_id     uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_league_sync:' || p_user::text, 0));

  v_elig := public.ziko_league_eligibility(p_user);
  IF NOT (v_elig->>'eligible')::boolean THEN
    RETURN jsonb_build_object('applied', false, 'reason', v_elig->>'reason');
  END IF;

  UPDATE public.ziko_league_state
     SET track = 'performance', division = 1, start_division = 1, peak_division = 1,
         up_streak = 0, low_streak = 0, track_since = now(), updated_at = now()
   WHERE user_id = p_user;

  INSERT INTO public.ziko_league_transitions (user_id, from_track, to_track, decided_by, reason, evidence)
  VALUES (p_user, 'habits', 'performance', 'ai', v_reason, (v_elig->'evidence') || jsonb_build_object('decided_at', now()))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('applied', true, 'id', v_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_apply_transition(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_league_apply_transition(uuid, text) TO service_role;
