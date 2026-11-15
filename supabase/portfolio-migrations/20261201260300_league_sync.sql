-- v1.20 phase 26 (LEAG-02/04/06) : score de regularite relative, paliers amortis, synchronisation paresseuse.
-- Fichier SEUL, jamais applique. Depend de 202612012601 + ziko_athlete_state (lecture seule), ziko_workout_sessions,
-- ziko_session_sets, ziko_habits, ziko_habit_logs. N'ECRIT JAMAIS dans ziko_user_gamification, ziko_coin_transactions,
-- ziko_athlete_state ni ziko_athlete_decisions (non punitif, D-08 / D-13).

-- 1. Score hebdomadaire d'UNE piste (interne : aucun droit client). Renvoie {asked, done, score}.
--    Regularite relative a ce qui etait demande, plafonnee a 100 : jamais de charge, poids, distance ni chrono.
--    Anti-triche : seance valide = terminee, >= 10 min, >= 3 series validees, 1 jour-seance compte au plus par jour ;
--    habitude = value >= 1, date <= aujourd'hui (Europe/Paris), 10 habitudes au plus.
CREATE OR REPLACE FUNCTION public.ziko_league_week_score(p_user uuid, p_track text, p_week_start date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_end    date := p_week_start + 7;
  v_today  date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_asked  numeric;
  v_done   numeric;
  v_focus  jsonb;
  v_target numeric;
  v_n      integer;
BEGIN
  IF p_track = 'performance' THEN
    SELECT current_focus_detail INTO v_focus FROM public.ziko_athlete_state WHERE user_id = p_user;
    IF v_focus IS NOT NULL
       AND v_focus->>'focus_type' = 'training_volume'
       AND v_focus->>'target_metric' IN ('sessions', 'sessions_per_week', 'workout_sessions')
       AND COALESCE(v_focus->>'target_value', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_target := (v_focus->>'target_value')::numeric;
    END IF;
    v_asked := LEAST(7, GREATEST(1, round(COALESCE(v_target, 3))));
    SELECT COUNT(DISTINCT (s.started_at AT TIME ZONE 'Europe/Paris')::date) INTO v_done
      FROM public.ziko_workout_sessions s
     WHERE s.user_id = p_user
       AND s.ended_at IS NOT NULL
       AND s.ended_at - s.started_at >= interval '10 minutes'
       AND (s.started_at AT TIME ZONE 'Europe/Paris')::date >= p_week_start
       AND (s.started_at AT TIME ZONE 'Europe/Paris')::date < v_end
       AND (SELECT COUNT(*) FROM public.ziko_session_sets ss WHERE ss.session_id = s.id AND ss.completed) >= 3;
  ELSIF p_track = 'habits' THEN
    SELECT COUNT(*) INTO v_n FROM (
      SELECT h.id AS hid FROM public.ziko_habits h WHERE h.user_id = p_user AND h.is_active
      UNION
      SELECT hl.habit_id FROM public.ziko_habit_logs hl
       WHERE hl.user_id = p_user AND hl.date >= p_week_start AND hl.date < v_end AND hl.value >= 1
    ) x;
    v_asked := GREATEST(3, LEAST(10, v_n)) * 7;
    SELECT COUNT(*) INTO v_done FROM (
      SELECT DISTINCT hl.habit_id, hl.date FROM public.ziko_habit_logs hl
       WHERE hl.user_id = p_user AND hl.date >= p_week_start AND hl.date < v_end
         AND hl.date <= v_today AND hl.value >= 1
    ) d;
  ELSE
    RAISE EXCEPTION 'invalid_track' USING ERRCODE = '22023';
  END IF;

  v_done := LEAST(COALESCE(v_done, 0), v_asked);
  RETURN jsonb_build_object(
    'asked', v_asked,
    'done',  v_done,
    'score', CASE WHEN v_asked > 0 THEN round(LEAST(100, 100 * v_done / v_asked), 2) ELSE 0 END
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_week_score(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_league_week_score(uuid, text, date) TO service_role;

-- 2. Synchronisation : cree l'etat au premier appel (si tier >= 3), cloture les semaines echues (8 au plus),
--    applique les paliers amortis, renvoie l'etat complet. Idempotente. Appelable par la personne (auth.uid() = p_user)
--    ou par service_role. Sous le palier de deblocage : {unlocked:false} sans rien creer.
--    Regles (D-07) : score >= 80 deux semaines de suite -> +1 ; score < 30 trois semaines de suite -> -1, jamais sous
--    GREATEST(palier_depart, palier_max - 1) ; 30..79 remet les deux compteurs a zero ; asked = 0 -> neutre.
CREATE OR REPLACE FUNCTION public.ziko_league_sync(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_today   date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_cur_ws  date;
  v_tier    integer := 1;
  v_onb     jsonb;
  st        public.ziko_league_state%ROWTYPE;
  w         date;
  v_res     jsonb;
  v_score   numeric;
  v_asked   numeric;
  v_done    numeric;
  v_before  integer;
  v_out     text;
  v_floor   integer;
  v_closed  integer := 0;
  v_cur     jsonb;
BEGIN
  IF p_user IS NULL OR NOT (COALESCE(auth.role(), '') = 'service_role' OR (v_uid IS NOT NULL AND v_uid = p_user)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  v_cur_ws := public.ziko_week_start(v_today);

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_league_sync:' || p_user::text, 0));

  SELECT COALESCE(tier, 1), onboarding_profile INTO v_tier, v_onb
    FROM public.ziko_athlete_state WHERE user_id = p_user;
  IF NOT FOUND THEN v_tier := 1; v_onb := NULL; END IF;
  IF v_tier < 3 THEN
    RETURN jsonb_build_object('unlocked', false, 'required_tier', 3, 'tier', v_tier);
  END IF;

  SELECT * INTO st FROM public.ziko_league_state WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.ziko_league_state (user_id, track, last_week_closed)
    VALUES (
      p_user,
      CASE WHEN COALESCE(v_onb->>'experience_level', '') IN ('intermediate', 'advanced') THEN 'performance' ELSE 'habits' END,
      v_cur_ws - 7
    )
    RETURNING * INTO st;
  END IF;

  -- Arriere borne : les semaines plus anciennes que 8 restent non scorees (neutres), jamais punies.
  IF st.last_week_closed < v_cur_ws - 56 THEN st.last_week_closed := v_cur_ws - 56; END IF;

  w := st.last_week_closed + 7;
  WHILE w < v_cur_ws LOOP
    v_res    := public.ziko_league_week_score(p_user, st.track, w);
    v_asked  := (v_res->>'asked')::numeric;
    v_done   := (v_res->>'done')::numeric;
    v_score  := (v_res->>'score')::numeric;
    v_before := st.division;
    v_out    := 'hold';

    IF v_asked <= 0 THEN
      v_out := 'neutral';
    ELSIF v_score >= 80 THEN
      st.low_streak := 0;
      st.up_streak := st.up_streak + 1;
      IF st.up_streak >= 2 THEN
        IF st.division < 5 THEN st.division := st.division + 1; v_out := 'up'; END IF;
        st.up_streak := 0;
      END IF;
    ELSIF v_score < 30 THEN
      st.up_streak := 0;
      st.low_streak := st.low_streak + 1;
      IF st.low_streak >= 3 THEN
        v_floor := GREATEST(st.start_division, st.peak_division - 1);
        IF st.division > v_floor THEN st.division := st.division - 1; v_out := 'down'; END IF;
        st.low_streak := 0;
      END IF;
    ELSE
      st.up_streak := 0;
      st.low_streak := 0;
    END IF;

    st.peak_division := GREATEST(st.peak_division, st.division);
    INSERT INTO public.ziko_league_weeks (user_id, week_start, track, asked, done, score, division_before, division_after, outcome)
    VALUES (p_user, w, st.track, v_asked, v_done, v_score, v_before, st.division, v_out)
    ON CONFLICT (user_id, week_start) DO NOTHING;
    st.last_week_closed := w;
    v_closed := v_closed + 1;
    w := w + 7;
  END LOOP;

  IF v_closed > 0 THEN
    UPDATE public.ziko_league_state
       SET division = st.division, peak_division = st.peak_division, up_streak = st.up_streak,
           low_streak = st.low_streak, last_week_closed = st.last_week_closed, updated_at = now()
     WHERE user_id = p_user;
  END IF;

  v_cur := public.ziko_league_week_score(p_user, st.track, v_cur_ws);

  RETURN jsonb_build_object(
    'unlocked', true,
    'tier', v_tier,
    'track', st.track,
    'division', st.division,
    'start_division', st.start_division,
    'peak_division', st.peak_division,
    'closed_now', v_closed,
    'faction', (SELECT faction_key FROM public.ziko_faction_members WHERE user_id = p_user),
    'current_week', jsonb_build_object('week_start', v_cur_ws, 'asked', v_cur->'asked', 'done', v_cur->'done'),
    'recent_weeks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('week_start', x.week_start, 'score', x.score, 'outcome', x.outcome) ORDER BY x.week_start DESC)
        FROM (SELECT week_start, score, outcome FROM public.ziko_league_weeks
               WHERE user_id = p_user AND track = st.track ORDER BY week_start DESC LIMIT 4) x
    ), '[]'::jsonb),
    'history_weeks', jsonb_build_object(
      'habits', (SELECT COUNT(*) FROM public.ziko_league_weeks WHERE user_id = p_user AND track = 'habits'),
      'performance', (SELECT COUNT(*) FROM public.ziko_league_weeks WHERE user_id = p_user AND track = 'performance')
    ),
    'pending_celebration', (
      SELECT jsonb_build_object('id', t.id, 'to_track', t.to_track, 'reason', t.reason, 'created_at', t.created_at)
        FROM public.ziko_league_transitions t
       WHERE t.user_id = p_user AND t.celebrated_at IS NULL
       ORDER BY t.created_at DESC LIMIT 1
    )
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_sync(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_league_sync(uuid) TO authenticated, service_role;

-- 3. Acquittement de la celebration : ne peut QUE poser celebrated_at sur SA transition (une seule fois).
CREATE OR REPLACE FUNCTION public.ziko_league_ack_transition(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.ziko_league_transitions SET celebrated_at = now()
   WHERE id = p_id AND user_id = v_uid AND celebrated_at IS NULL;
  RETURN FOUND;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_league_ack_transition(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_league_ack_transition(uuid) TO authenticated;
