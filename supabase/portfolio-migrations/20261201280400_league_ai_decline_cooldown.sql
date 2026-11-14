-- v1.20 revue B (M3, LEAG-03) : apres un refus de transition, le modele de ligue n'est plus rappele chaque jour.
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612012601 (table ziko_league_ai_state) et 202612012604
-- (ziko_league_ai_claim, redefinie ici par CREATE OR REPLACE a partir de la derniere version : signature, droits et
-- reponses inchanges, une raison `cooldown` en plus). Reserve a service_role.
ALTER TABLE public.ziko_league_ai_state ADD COLUMN IF NOT EXISTS declined_until timestamptz;

-- Memorise un refus : repos de p_days jours (7 par defaut, 1..30). Interne au backend.
CREATE OR REPLACE FUNCTION public.ziko_league_ai_decline(p_user uuid, p_days integer DEFAULT 7)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL THEN RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.ziko_league_ai_state (user_id, declined_until)
  VALUES (p_user, now() + make_interval(days => LEAST(30, GREATEST(1, COALESCE(p_days, 7)))))
  ON CONFLICT (user_id) DO UPDATE SET declined_until = EXCLUDED.declined_until;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_ai_decline(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_league_ai_decline(uuid, integer) TO service_role;

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
  -- Revue B (M3) : apres un refus de transition, le modele n'est pas rappele avant la fin du delai de repos.
  IF v_st.declined_until IS NOT NULL AND v_st.declined_until > now() THEN
    RETURN jsonb_build_object('proceed', false, 'reason', 'cooldown');
  END IF;
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
