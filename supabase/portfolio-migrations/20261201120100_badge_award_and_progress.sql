-- v1.20 phase 12 (REWD-02/03/04) : attribution automatique des succes + progression.
-- Fichier SEUL : jamais applique par l'agent (l'orchestrateur applique apres approbation).
--
-- Causes racines corrigees (la fonction existante n'attribuait jamais rien) :
--   1. `ziko_friendships` n'a pas de colonne `user_id` (requester_id / addressee_id) : l'erreur
--      `undefined_column` n'etait pas rattrapee (seul `undefined_table` l'etait), donc la fonction
--      plantait AVANT toute insertion dans `ziko_user_badges`.
--   2. Les records (`is_pr`) n'existent pas dans le schema : alignement sur la definition du Profil
--      (nombre d'exercices ayant une serie avec charge > 0).
--   3. La serie comptait uniquement `ziko_habit_logs` ; on s'aligne sur la serie visible
--      (`ziko_user_gamification.current_streak / longest_streak`, decision Q8 = A).
--   4. Aucune piece n'etait creditee a l'obtention (decision Q7 = A : par palier, 25 / 50 / 100).
--
-- Regle non punitive (v1.18, phases 45/46) : un succes obtenu n'est JAMAIS retire ; la progression
-- de serie utilise le meilleur de current_streak / longest_streak (pas de remise a zero visible).

-- 1. Nouvelle source de transaction de pieces : `achievement` (drop/recreate du CHECK).
ALTER TABLE public.ziko_coin_transactions
  DROP CONSTRAINT IF EXISTS ziko_coin_transactions_source_check;
ALTER TABLE public.ziko_coin_transactions
  ADD CONSTRAINT ziko_coin_transactions_source_check
  CHECK (source = ANY (ARRAY['workout'::text, 'habit'::text, 'streak_bonus'::text, 'level_up'::text,
                             'purchase'::text, 'refund'::text, 'achievement'::text]));

-- 2. Pieces par palier (source de verite unique, relue par la fiche cote client via la progression).
CREATE OR REPLACE FUNCTION public.ziko_badge_tier_coins(p_tier integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public, pg_temp
AS $function$
  SELECT CASE COALESCE(p_tier, 1) WHEN 1 THEN 25 WHEN 2 THEN 50 ELSE 100 END;
$function$;

-- 3. Compteurs courants, partages par l'attribution et la progression (fonction interne).
CREATE OR REPLACE FUNCTION public.ziko_badge_counters(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sessions     integer := 0;
  v_prs          integer := 0;
  v_friends      integer := 0;
  v_streak       integer := 0;
  v_profile_done integer := 0;
BEGIN
  -- Seance comptee = au moins une serie enregistree (une seance vide ne compte pas, P6 D-02).
  SELECT COUNT(*) INTO v_sessions
  FROM public.ziko_workout_sessions ws
  WHERE ws.user_id = p_user_id
    AND EXISTS (SELECT 1 FROM public.ziko_session_sets ss WHERE ss.session_id = ws.id);

  -- Records = exercices distincts avec une serie a charge > 0 (meme definition que l'ecran Profil).
  SELECT COUNT(DISTINCT ss.exercise_id) INTO v_prs
  FROM public.ziko_session_sets ss
  JOIN public.ziko_workout_sessions ws ON ws.id = ss.session_id
  WHERE ws.user_id = p_user_id
    AND COALESCE(ss.weight_kg, 0) > 0;

  -- Serie visible (Q8 = A).
  SELECT COALESCE(GREATEST(g.current_streak, g.longest_streak), 0) INTO v_streak
  FROM public.ziko_user_gamification g
  WHERE g.user_id = p_user_id;
  v_streak := COALESCE(v_streak, 0);

  SELECT COUNT(*) INTO v_profile_done
  FROM public.ziko_user_profiles
  WHERE id = p_user_id
    AND avatar_url IS NOT NULL
    AND bio IS NOT NULL
    AND goal IS NOT NULL;

  SELECT COUNT(*) INTO v_friends
  FROM public.ziko_friendships
  WHERE status = 'accepted'
    AND (requester_id = p_user_id OR addressee_id = p_user_id);

  RETURN jsonb_build_object(
    'sessions', v_sessions,
    'streak', v_streak,
    'prs', v_prs,
    'profile_complete', v_profile_done,
    'friends', v_friends
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_badge_counters(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_badge_counters(uuid) TO service_role;

-- 4. Attribution : le type de retour change (void -> jsonb), il faut donc DROP puis CREATE.
DROP FUNCTION IF EXISTS public.ziko_check_and_award_badges(uuid);

CREATE FUNCTION public.ziko_check_and_award_badges(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_counters jsonb;
  v_current  integer;
  v_inserted integer;
  v_coins    integer;
  v_awarded  jsonb := '[]'::jsonb;
  rec        record;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_counters := public.ziko_badge_counters(p_user_id);

  FOR rec IN
    SELECT bd.slug, bd.name, bd.condition_type, bd.condition_value, bd.tier
    FROM public.ziko_badge_definitions bd
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ziko_user_badges ub
      WHERE ub.user_id = p_user_id AND ub.badge_slug = bd.slug
    )
    ORDER BY bd.tier, bd.condition_value
  LOOP
    v_current := COALESCE((v_counters ->> rec.condition_type)::integer, 0);
    IF v_current >= rec.condition_value THEN
      INSERT INTO public.ziko_user_badges (user_id, badge_slug)
      VALUES (p_user_id, rec.slug)
      ON CONFLICT (user_id, badge_slug) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;

      -- Pieces creditees seulement si la ligne vient d'etre inseree (idempotent sous concurrence).
      IF v_inserted = 1 THEN
        v_coins := public.ziko_badge_tier_coins(rec.tier);
        PERFORM public.ziko_award_coins(
          p_user_id, v_coins, 'achievement', NULL, 'Succès : ' || rec.name
        );
        v_awarded := v_awarded || jsonb_build_array(
          jsonb_build_object('slug', rec.slug, 'name', rec.name, 'coins', v_coins)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_awarded;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_check_and_award_badges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_check_and_award_badges(uuid) TO authenticated, service_role;

-- 5. Progression (lecture) : compteurs + recompense par succes. Le client calcule min(n, N).
CREATE OR REPLACE FUNCTION public.ziko_get_badge_progress(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_counters jsonb;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_counters := public.ziko_badge_counters(p_user_id);

  RETURN jsonb_build_object(
    'counters', v_counters,
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'slug', bd.slug,
        'current', COALESCE((v_counters ->> bd.condition_type)::integer, 0),
        'reward_coins', public.ziko_badge_tier_coins(bd.tier)
      ) ORDER BY bd.tier, bd.condition_value)
      FROM public.ziko_badge_definitions bd
    ), '[]'::jsonb)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_get_badge_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_get_badge_progress(uuid) TO authenticated, service_role;
