-- v1.20 phase 26 (LEAG-01) : RPC des factions. Fichier SEUL, jamais applique. Depend de 202612012601.
-- Toutes SECURITY DEFINER, search_path fige, REVOKE PUBLIC/anon, GRANT authenticated.

-- 1. Rejoindre / changer de faction. Changement : delai de 30 jours (anti-farm des compteurs, D-02).
--    Erreurs : not_authenticated (28000), unknown_faction (22023), faction_cooldown (P0001, detail = date de fin).
CREATE OR REPLACE FUNCTION public.ziko_join_faction(p_faction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_cur      public.ziko_faction_members%ROWTYPE;
  v_can_at   timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_faction IS NULL OR NOT EXISTS (SELECT 1 FROM public.ziko_factions WHERE key = p_faction) THEN
    RAISE EXCEPTION 'unknown_faction' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_join_faction:' || v_uid::text, 0));
  SELECT * INTO v_cur FROM public.ziko_faction_members WHERE user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.ziko_faction_members (user_id, faction_key) VALUES (v_uid, p_faction);
    RETURN jsonb_build_object('faction', p_faction, 'changed', false, 'can_change_at', now() + interval '30 days');
  END IF;

  IF v_cur.faction_key = p_faction THEN
    RETURN jsonb_build_object('faction', p_faction, 'changed', false, 'can_change_at', v_cur.changed_at + interval '30 days');
  END IF;

  v_can_at := v_cur.changed_at + interval '30 days';
  IF v_can_at > now() THEN
    RAISE EXCEPTION 'faction_cooldown' USING ERRCODE = 'P0001', DETAIL = to_char(v_can_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  END IF;

  UPDATE public.ziko_faction_members SET faction_key = p_faction, changed_at = now() WHERE user_id = v_uid;
  RETURN jsonb_build_object('faction', p_faction, 'changed', true, 'can_change_at', now() + interval '30 days');
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_join_faction(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_join_faction(text) TO authenticated;

-- 2. Vue d'ensemble : ma faction + les 6 factions. Le compteur de membres n'est JAMAIS expose en dessous
--    de 10 ADULTES ; mineurs et ages inconnus ne sont ni comptes ni listes (D-12). Aucune personne n'est listee.
CREATE OR REPLACE FUNCTION public.ziko_get_faction_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_mine jsonb;
  v_list jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;

  SELECT jsonb_build_object('faction', m.faction_key, 'joined_at', m.joined_at, 'can_change_at', m.changed_at + interval '30 days')
    INTO v_mine FROM public.ziko_faction_members m WHERE m.user_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'key', f.key, 'label', f.label, 'icon', f.icon,
           'member_count', CASE WHEN c.n >= 10 THEN c.n ELSE NULL END
         ) ORDER BY f.sort_order), '[]'::jsonb)
    INTO v_list
    FROM public.ziko_factions f
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n
        FROM public.ziko_faction_members fm
        JOIN public.ziko_user_profiles p ON p.id = fm.user_id
       WHERE fm.faction_key = f.key AND p.age IS NOT NULL AND p.age >= 18
    ) c ON true;

  RETURN jsonb_build_object('mine', v_mine, 'factions', v_list);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_get_faction_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_get_faction_overview() TO authenticated;
