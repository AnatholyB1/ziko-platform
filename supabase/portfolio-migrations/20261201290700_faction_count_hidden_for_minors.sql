-- v1.20 UAT run 11 (LG-23) : le compteur de faction n'est JAMAIS expose a un mineur ni a un age inconnu.
-- Fichier SEUL : jamais applique par l'agent. Reprend a l'identique ziko_get_faction_overview de 20261201260200
-- (CREATE OR REPLACE, signature et droits inchanges) ; seul `member_count` change.
--
-- UAT-PLAN LG-23 : "mineur ; faction avec >= 10 adultes -> ecran identique ; compteur de faction jamais affiche".
-- Avant : un athlete de 15 ans dans une faction de 10 adultes voyait `10 membres` (D-12 respecte : le mineur n'etait pas
-- compte, mais le compteur lui etait montre). Desormais le compteur est NULL pour tout demandeur dont l'age est
-- inconnu ou < 18 ; pour un adulte le comportement est inchange (compteur seulement a partir de 10 ADULTES).

CREATE OR REPLACE FUNCTION public.ziko_get_faction_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_mine  jsonb;
  v_list  jsonb;
  v_adult boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;

  SELECT COALESCE(p.age >= 18, false) INTO v_adult FROM public.ziko_user_profiles p WHERE p.id = v_uid;
  v_adult := COALESCE(v_adult, false);

  SELECT jsonb_build_object('faction', m.faction_key, 'joined_at', m.joined_at, 'can_change_at', m.changed_at + interval '30 days')
    INTO v_mine FROM public.ziko_faction_members m WHERE m.user_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'key', f.key, 'label', f.label, 'icon', f.icon,
           'member_count', CASE WHEN v_adult AND c.n >= 10 THEN c.n ELSE NULL END
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
