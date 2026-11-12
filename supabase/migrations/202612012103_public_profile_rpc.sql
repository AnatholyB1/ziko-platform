-- ============================================================
-- v1.20 Phase 21 (Social & Amis) - profil public (SOC-06, SOC-07, G-01, G-06, G-07, Q-P21a, Q-P21c)
-- Fichier seulement.
--
-- ziko_get_public_profile(p_user) : SECURITY DEFINER, identite de l'appelant = auth.uid().
-- Decision Q-P21a : tout utilisateur connecte voit les 9 blocs du contrat de design (lot D, D08-D13).
-- Le jsonb est BORNE aux champs du contrat. JAMAIS de poids, taille, age, mesures corporelles,
-- sommeil, hydratation, nutrition, email ni donnee de sante. Aucune policy SELECT n'est elargie.
--
-- Definitions (documentees) :
--   * abonnes (Q-P21c) = amities acceptees ou le profil est DESTINATAIRE (comme profile/index.tsx) ;
--     amis = total des amities acceptees.
--   * serie (G-06) = jours consecutifs avec une habitude validee (value > 0), en remontant depuis
--     aujourd'hui en date locale Europe/Paris (meme definition que le profil perso). Un jour sans
--     validation aujourd'hui donne 0, comme le profil perso.
--   * records = meilleure charge (weight_kg > 0) par exercice, 3 premiers.
--   * niveau/XP = ziko_user_gamification ; xp_to_next = xp_required du prochain palier - xp.
--   * badges = badges obtenus (jointure ziko_badge_definitions), badges_total = nombre obtenu.
--   * defis en commun = defis ou l'appelant ET le profil sont participants (2 max).
-- Retourne NULL si le profil n'existe pas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ziko_get_public_profile(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me        uuid := auth.uid();
  v_profile   public.ziko_user_profiles%ROWTYPE;
  v_fr        RECORD;
  v_relation  text := 'none';
  v_fr_id     uuid;
  v_gam       public.ziko_user_gamification%ROWTYPE;
  v_next_lvl  integer;
  v_next_xp   integer;
  v_today     date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_day       date;
  v_streak    integer := 0;
  v_friends   integer;
  v_followers integer;
  v_badges    jsonb;
  v_badges_n  integer;
  v_workouts  jsonb;
  v_records   jsonb;
  v_challs    jsonb;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_profile FROM public.ziko_user_profiles WHERE id = p_user;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Relation de l'appelant avec le profil
  IF p_user = v_me THEN
    v_relation := 'self';
  ELSE
    SELECT f.id, f.status, f.requester_id INTO v_fr
    FROM public.ziko_friendships f
    WHERE (f.requester_id = v_me AND f.addressee_id = p_user)
       OR (f.requester_id = p_user AND f.addressee_id = v_me)
    ORDER BY (f.status = 'accepted') DESC, (f.requester_id <> v_me) DESC, f.created_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_fr_id := v_fr.id;
      v_relation := CASE
        WHEN v_fr.status = 'accepted' THEN 'friend'
        WHEN v_fr.status = 'pending' AND v_fr.requester_id = v_me THEN 'sent'
        WHEN v_fr.status = 'pending' THEN 'received'
        ELSE 'none' END;
    END IF;
  END IF;

  -- Compteurs
  SELECT count(*) INTO v_friends
  FROM public.ziko_friendships f
  WHERE f.status = 'accepted' AND (f.requester_id = p_user OR f.addressee_id = p_user);
  SELECT count(*) INTO v_followers
  FROM public.ziko_friendships f
  WHERE f.status = 'accepted' AND f.addressee_id = p_user;

  -- Niveau / XP
  SELECT * INTO v_gam FROM public.ziko_user_gamification WHERE user_id = p_user;
  IF FOUND THEN
    SELECT d.level, d.xp_required INTO v_next_lvl, v_next_xp
    FROM public.ziko_level_definitions d
    WHERE d.xp_required > v_gam.xp
    ORDER BY d.xp_required ASC
    LIMIT 1;
  END IF;

  -- Serie
  v_day := v_today;
  WHILE v_streak < 1000 AND EXISTS (
    SELECT 1 FROM public.ziko_habit_logs h
    WHERE h.user_id = p_user AND h.date = v_day AND h.value > 0
  ) LOOP
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  END LOOP;

  -- Badges obtenus
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'slug', b.slug, 'name', b.name, 'icon', b.icon, 'tier', b.tier, 'earned_at', ub.earned_at)
           ORDER BY ub.earned_at DESC), '[]'::jsonb),
         count(*)::integer
  INTO v_badges, v_badges_n
  FROM public.ziko_user_badges ub
  JOIN public.ziko_badge_definitions b ON b.slug = ub.badge_slug
  WHERE ub.user_id = p_user;

  -- 3 derniers entrainements termines
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'name', w.name, 'started_at', w.started_at, 'duration_min', w.duration_min,
           'total_exercises', w.total_exercises, 'total_sets', w.total_sets)
           ORDER BY w.started_at DESC), '[]'::jsonb)
  INTO v_workouts
  FROM (
    SELECT s.id, s.name, s.started_at, s.total_sets, s.total_exercises,
           GREATEST(round(extract(epoch FROM (s.ended_at - s.started_at)) / 60.0), 0)::integer AS duration_min
    FROM public.ziko_workout_sessions s
    WHERE s.user_id = p_user AND s.ended_at IS NOT NULL
    ORDER BY s.started_at DESC
    LIMIT 3
  ) w;

  -- 3 records (meilleure charge par exercice)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'exercise_id', r.exercise_id, 'exercise_name', r.exercise_name,
           'weight_kg', r.weight_kg, 'achieved_at', r.achieved_at)
           ORDER BY r.weight_kg DESC), '[]'::jsonb)
  INTO v_records
  FROM (
    SELECT t.exercise_id, t.exercise_name, t.weight_kg, t.achieved_at
    FROM (
      SELECT DISTINCT ON (ss.exercise_id)
             ss.exercise_id,
             coalesce(e.name_fr, e.name) AS exercise_name,
             ss.weight_kg,
             coalesce(ss.completed_at, ss.created_at) AS achieved_at
      FROM public.ziko_session_sets ss
      JOIN public.ziko_workout_sessions s ON s.id = ss.session_id
      LEFT JOIN public.ziko_exercises e ON e.id = ss.exercise_id
      WHERE s.user_id = p_user AND ss.weight_kg > 0
      ORDER BY ss.exercise_id, ss.weight_kg DESC, coalesce(ss.completed_at, ss.created_at) ASC
    ) t
    ORDER BY t.weight_kg DESC
    LIMIT 3
  ) r;

  -- Defis en commun (2 max)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'title', c.title, 'status', c.status, 'end_date', c.end_date)
           ORDER BY c.end_date DESC), '[]'::jsonb)
  INTO v_challs
  FROM (
    SELECT ch.id, ch.title, ch.status, ch.end_date
    FROM public.ziko_challenges ch
    WHERE EXISTS (SELECT 1 FROM public.ziko_challenge_participants a
                  WHERE a.challenge_id = ch.id AND a.user_id = v_me)
      AND EXISTS (SELECT 1 FROM public.ziko_challenge_participants b
                  WHERE b.challenge_id = ch.id AND b.user_id = p_user)
    ORDER BY ch.end_date DESC
    LIMIT 2
  ) c;

  RETURN jsonb_build_object(
    'id',               v_profile.id,
    'name',             v_profile.name,
    'handle',           v_profile.handle,
    'goal',             v_profile.goal,
    'relation',         v_relation,
    'friendship_id',    v_fr_id,
    'friends_count',    v_friends,
    'followers_count',  v_followers,
    'level',            CASE WHEN v_gam.user_id IS NULL THEN NULL ELSE v_gam.level END,
    'xp',               CASE WHEN v_gam.user_id IS NULL THEN NULL ELSE v_gam.xp END,
    'next_level',       v_next_lvl,
    'xp_to_next',       CASE WHEN v_next_lvl IS NULL THEN NULL ELSE v_next_xp - v_gam.xp END,
    'streak',           v_streak,
    'badges',           v_badges,
    'badges_total',     v_badges_n,
    'recent_workouts',  v_workouts,
    'records',          v_records,
    'common_challenges', v_challs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_get_public_profile(uuid) TO authenticated, service_role;
