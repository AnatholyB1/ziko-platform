-- ============================================================
-- v1.20 - Respect du reglage "profil public" (audit AUDIT-SECURITY.md constat 7)
-- Fichier seulement. IDEMPOTENT (CREATE OR REPLACE). Depend de 202612012102 et 202612012103 (ordre : apres).
-- Decision Q-P21a conservee : profil COMPLET pour tout utilisateur connecte quand is_public = true (defaut).
-- Nouveau : si is_public = false, un non-ami (ni soi-meme) ne recoit que nom / identifiant / avatar / relation
-- (memes cles que le contrat, valeurs neutres, is_private = true) ; la recherche d'amis n'affiche pas ces profils
-- tant qu'aucune relation n'existe. Utilisateur inexistant : NULL (inchange). Il n'existe aucun mecanisme de blocage
-- d'utilisateur dans le schema : rien a filtrer de ce cote.
-- Les corps ci-dessous sont ceux de 2103 / 2102, a l'identique hors les ajouts marques "audit constat 7".
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

  -- Securite (audit constat 7) : un profil prive (is_public = false) n'est lisible en entier que par lui-meme et par
  -- ses amis. Les autres utilisateurs connectes recoivent le contrat complet mais VIDE (memes cles, valeurs neutres) :
  -- seuls nom, identifiant, avatar et relation sont renseignes. Decision Q-P21a conservee pour les profils publics.
  IF v_relation NOT IN ('self', 'friend') AND v_profile.is_public IS NOT DISTINCT FROM false THEN
    RETURN jsonb_build_object(
      'id',               v_profile.id,
      'name',             v_profile.name,
      'handle',           v_profile.handle,
      'avatar_url',       v_profile.avatar_url,
      'goal',             NULL,
      'relation',         v_relation,
      'friendship_id',    v_fr_id,
      'friends_count',    0,
      'followers_count',  0,
      'level',            NULL,
      'xp',               NULL,
      'next_level',       NULL,
      'xp_to_next',       NULL,
      'streak',           0,
      'badges',           '[]'::jsonb,
      'badges_total',     0,
      'recent_workouts',  '[]'::jsonb,
      'records',          '[]'::jsonb,
      'common_challenges', '[]'::jsonb,
      'is_private',       true
    );
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
    'avatar_url',       v_profile.avatar_url,
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
    'common_challenges', v_challs,
    'is_private',       false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_get_public_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ziko_search_users_with_status(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (
  id            uuid,
  name          text,
  handle        text,
  avatar_url    text,
  goal          text,
  relation      text,    -- none | sent | received | friend
  friendship_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_q   text := trim(coalesce(p_query, ''));
  v_pat text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  -- 2 caracteres minimum (D-01)
  IF char_length(v_q) < 2 THEN
    RETURN;
  END IF;
  -- echappe les jokers LIKE saisis par l'utilisateur
  v_pat := '%' || replace(replace(replace(unaccent(lower(v_q)), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT p.id, p.name, p.handle, p.avatar_url, p.goal,
         CASE
           WHEN fr.status = 'accepted' THEN 'friend'
           WHEN fr.status = 'pending' AND fr.requester_id = v_me THEN 'sent'
           WHEN fr.status = 'pending' THEN 'received'
           ELSE 'none'
         END AS relation,
         fr.id AS friendship_id
  FROM public.ziko_user_profiles p
  LEFT JOIN LATERAL (
    SELECT f.id, f.status, f.requester_id
    FROM public.ziko_friendships f
    WHERE (f.requester_id = v_me AND f.addressee_id = p.id)
       OR (f.requester_id = p.id AND f.addressee_id = v_me)
    ORDER BY (f.status = 'accepted') DESC, (f.requester_id <> v_me) DESC, f.created_at ASC
    LIMIT 1
  ) fr ON true
  WHERE p.id <> v_me
    AND p.name IS NOT NULL
    -- audit constat 7 : un profil prive n'apparait pas dans la recherche, sauf s'il existe deja une relation
    AND (COALESCE(p.is_public, true) OR fr.id IS NOT NULL)
    AND (unaccent(lower(p.name)) LIKE v_pat ESCAPE '\'
         OR (p.handle IS NOT NULL AND unaccent(lower(p.handle)) LIKE v_pat ESCAPE '\'))
  ORDER BY
    CASE WHEN unaccent(lower(p.name)) = unaccent(lower(v_q)) THEN 0 ELSE 1 END,
    CASE WHEN unaccent(lower(p.name)) LIKE unaccent(lower(v_q)) || '%' THEN 0 ELSE 1 END,
    p.name
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_search_users_with_status(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_search_users_with_status(text, integer) TO authenticated, service_role;
