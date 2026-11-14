-- v1.20 phase 26 (LEAG-05) : defis collectifs coach + athletes (via ziko_coach_client_links). Fichier SEUL, jamais applique.
-- Pas de classement nominatif : un participant ne voit que le TOTAL du groupe et SA contribution ; aucune RPC ne renvoie
-- la contribution d'une autre personne (D-12). Metriques sans donnee de sante : seances, habitudes, eau.
-- Les tables sont en SELECT seul (policies simples, sans reference croisee : pas de recursion RLS) ; lectures de groupe
-- et ecritures par RPC SECURITY DEFINER.

CREATE TABLE IF NOT EXISTS public.ziko_collective_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  metric       text NOT NULL,
  target_total numeric NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_collective_title_check CHECK (char_length(title) BETWEEN 3 AND 80),
  CONSTRAINT ziko_collective_metric_check CHECK (metric IN ('workout_sessions', 'habit_logs', 'hydration_ml')),
  CONSTRAINT ziko_collective_target_check CHECK (target_total > 0 AND target_total <= 1000000),
  CONSTRAINT ziko_collective_dates_check CHECK (end_date >= start_date AND end_date <= start_date + 31),
  CONSTRAINT ziko_collective_status_check CHECK (status IN ('active', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS ziko_collective_challenges_coach_idx ON public.ziko_collective_challenges (coach_id, status, end_date);

CREATE TABLE IF NOT EXISTS public.ziko_collective_participants (
  challenge_id uuid NOT NULL REFERENCES public.ziko_collective_challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'invited',
  responded_at timestamptz,
  PRIMARY KEY (challenge_id, user_id),
  CONSTRAINT ziko_collective_participant_status_check CHECK (status IN ('invited', 'joined', 'declined'))
);
CREATE INDEX IF NOT EXISTS ziko_collective_participants_user_idx ON public.ziko_collective_participants (user_id, status);

ALTER TABLE public.ziko_collective_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ziko_collective_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_collective_challenges_coach_read ON public.ziko_collective_challenges;
CREATE POLICY ziko_collective_challenges_coach_read ON public.ziko_collective_challenges
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = coach_id);
DROP POLICY IF EXISTS ziko_collective_participants_own_read ON public.ziko_collective_participants;
CREATE POLICY ziko_collective_participants_own_read ON public.ziko_collective_participants
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.ziko_collective_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ziko_collective_participants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ziko_collective_challenges, public.ziko_collective_participants TO authenticated;
GRANT ALL ON TABLE public.ziko_collective_challenges, public.ziko_collective_participants TO service_role;

-- Contribution d'UNE personne sur [p_from, p_to] (interne). Plafonnee par jour : 1 jour-seance, 10 habitudes, 4000 ml.
CREATE OR REPLACE FUNCTION public.ziko_collective_contribution(p_user uuid, p_metric text, p_from date, p_to date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_to    date := LEAST(p_to, v_today);
  v_n     numeric := 0;
BEGIN
  IF p_from IS NULL OR v_to < p_from THEN RETURN 0; END IF;
  IF p_metric = 'workout_sessions' THEN
    SELECT COUNT(DISTINCT (s.started_at AT TIME ZONE 'Europe/Paris')::date) INTO v_n
      FROM public.ziko_workout_sessions s
     WHERE s.user_id = p_user AND s.ended_at IS NOT NULL
       AND s.ended_at - s.started_at >= interval '10 minutes'
       AND (s.started_at AT TIME ZONE 'Europe/Paris')::date BETWEEN p_from AND v_to
       AND (SELECT COUNT(*) FROM public.ziko_session_sets ss WHERE ss.session_id = s.id AND ss.completed) >= 3;
  ELSIF p_metric = 'habit_logs' THEN
    SELECT COALESCE(SUM(LEAST(10, c)), 0) INTO v_n FROM (
      SELECT COUNT(DISTINCT hl.habit_id) AS c FROM public.ziko_habit_logs hl
       WHERE hl.user_id = p_user AND hl.value >= 1 AND hl.date BETWEEN p_from AND v_to GROUP BY hl.date
    ) d;
  ELSIF p_metric = 'hydration_ml' THEN
    SELECT COALESCE(SUM(LEAST(4000, t)), 0) INTO v_n FROM (
      SELECT SUM(h.amount_ml) AS t FROM public.ziko_hydration_logs h
       WHERE h.user_id = p_user AND h.amount_ml > 0 AND h.date BETWEEN p_from AND v_to GROUP BY h.date
    ) d;
  END IF;
  RETURN COALESCE(v_n, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_collective_contribution(uuid, text, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_collective_contribution(uuid, text, date, date) TO service_role;

-- Creation par un coach : invite tous ses liens coach ACTIFS (non revoques, non expires).
CREATE OR REPLACE FUNCTION public.ziko_create_collective_challenge(p_title text, p_metric text, p_target numeric, p_start date, p_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_today   date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_role    text;
  v_clients integer;
  v_id      uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT role INTO v_role FROM public.ziko_user_profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') NOT IN ('coach', 'both') THEN RAISE EXCEPTION 'not_a_coach' USING ERRCODE = '42501'; END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 80
     OR p_metric NOT IN ('workout_sessions', 'habit_logs', 'hydration_ml')
     OR p_target IS NULL OR p_target <= 0 OR p_target > 1000000
     OR p_start IS NULL OR p_end IS NULL OR p_end < p_start OR p_end > p_start + 31 OR p_end < v_today THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_collective:' || v_uid::text, 0));
  IF (SELECT COUNT(*) FROM public.ziko_collective_challenges WHERE coach_id = v_uid AND status = 'active' AND end_date >= v_today) >= 3 THEN
    RAISE EXCEPTION 'too_many_active_challenges' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_clients FROM public.ziko_coach_client_links l
   WHERE l.coach_id = v_uid AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > now());
  IF v_clients = 0 THEN RAISE EXCEPTION 'no_clients' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.ziko_collective_challenges (coach_id, title, metric, target_total, start_date, end_date)
  VALUES (v_uid, btrim(p_title), p_metric, p_target, p_start, p_end) RETURNING id INTO v_id;

  INSERT INTO public.ziko_collective_participants (challenge_id, user_id)
  SELECT v_id, l.client_id FROM public.ziko_coach_client_links l
   WHERE l.coach_id = v_uid AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > now())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('id', v_id, 'invited', v_clients);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_create_collective_challenge(text, text, numeric, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_create_collective_challenge(text, text, numeric, date, date) TO authenticated;

-- Reponse d'un athlete invite. Reversible tant que le defi est actif (autonomie : on peut quitter). Un nouveau
-- consentement remet la date de depart de comptage a aujourd'hui (pas de rattrapage retroactif).
CREATE OR REPLACE FUNCTION public.ziko_respond_collective_challenge(p_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_new   text := CASE WHEN p_accept THEN 'joined' ELSE 'declined' END;
  v_cur   text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_accept IS NULL THEN RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ziko_collective_challenges c WHERE c.id = p_id AND c.status = 'active' AND c.end_date >= v_today) THEN
    RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT status INTO v_cur FROM public.ziko_collective_participants WHERE challenge_id = p_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_cur = v_new THEN RETURN v_new; END IF;
  UPDATE public.ziko_collective_participants SET status = v_new, responded_at = now()
   WHERE challenge_id = p_id AND user_id = v_uid;
  RETURN v_new;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_respond_collective_challenge(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_respond_collective_challenge(uuid, boolean) TO authenticated;

-- Progression : TOTAL du groupe + MA contribution (null pour le coach). Jamais la contribution d'un autre.
CREATE OR REPLACE FUNCTION public.ziko_collective_progress(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  c        public.ziko_collective_challenges%ROWTYPE;
  v_mine   text;
  v_total  numeric := 0;
  v_joined integer := 0;
  v_my     numeric;
  r        record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO c FROM public.ziko_collective_challenges WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT status INTO v_mine FROM public.ziko_collective_participants WHERE challenge_id = p_id AND user_id = v_uid;
  IF c.coach_id <> v_uid AND v_mine IS NULL THEN RAISE EXCEPTION 'challenge_not_found' USING ERRCODE = 'P0002'; END IF;

  FOR r IN SELECT p.user_id, GREATEST(c.start_date, (p.responded_at AT TIME ZONE 'Europe/Paris')::date) AS from_day
             FROM public.ziko_collective_participants p
            WHERE p.challenge_id = p_id AND p.status = 'joined' AND p.responded_at IS NOT NULL
  LOOP
    v_joined := v_joined + 1;
    v_total := v_total + public.ziko_collective_contribution(r.user_id, c.metric, r.from_day, c.end_date);
    IF r.user_id = v_uid THEN
      v_my := public.ziko_collective_contribution(r.user_id, c.metric, r.from_day, c.end_date);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'id', c.id, 'title', c.title, 'metric', c.metric, 'target_total', c.target_total,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'role', CASE WHEN c.coach_id = v_uid THEN 'coach' ELSE 'athlete' END,
    'my_status', v_mine,
    'joined_count', v_joined,
    'total', v_total,
    'my_contribution', CASE WHEN c.coach_id = v_uid THEN NULL ELSE v_my END
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_collective_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_collective_progress(uuid) TO authenticated;

-- Liste : mes defis (coach = les miens ; athlete = invite ou rejoint ; les defis refuses ne reviennent pas).
CREATE OR REPLACE FUNCTION public.ziko_list_collective_challenges()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', c.id, 'title', c.title, 'metric', c.metric, 'target_total', c.target_total,
             'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
             'role', CASE WHEN c.coach_id = v_uid THEN 'coach' ELSE 'athlete' END,
             'my_status', p.status
           ) ORDER BY c.end_date DESC)
      FROM public.ziko_collective_challenges c
      LEFT JOIN public.ziko_collective_participants p ON p.challenge_id = c.id AND p.user_id = v_uid
     WHERE c.status = 'active' AND c.end_date >= v_today - 7
       AND (c.coach_id = v_uid OR p.status IN ('invited', 'joined'))
  ), '[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_list_collective_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_list_collective_challenges() TO authenticated;
