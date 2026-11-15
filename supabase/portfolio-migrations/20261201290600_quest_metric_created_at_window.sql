-- v1.20 UAT run 11 : fenetre des quetes creees en cours de journee, fuseau appareil != Europe/Paris.
-- Fichier SEUL : jamais applique par l'agent. Reprend a l'identique ziko_quest_metric_value de 20261201280100
-- (CREATE OR REPLACE, signature et droits inchanges) ; seules les 4 branches a base de colonne `date` changent.
--
-- Probleme (UAT run 11) : `date` est ecrite par l'app en date de l'APPAREIL (emulateur GMT : 2026-11-14 a 23:36 UTC)
-- alors que v_from_d est la date Paris de period_start (2026-11-15 a 00:31 Paris). Pour une quete NON alignee sur minuit
-- (creee par l'IA / le chat), le filtre `date >= v_from_d` excluait des saisies pourtant faites APRES la creation :
-- quete "Mets a jour : tour de taille" (cible 2) restee a 0 malgre 2 mesures saisies.
--
-- Regle : pour une quete non alignee, seule compte la fenetre d'instants [period_start, expires_at] sur created_at
-- (une saisie anterieure a la quete ne compte jamais, une saisie posterieure compte quelle que soit sa colonne `date`).
-- Pour une quete alignee (modeles de depart, minuit Paris) le comportement reste celui de 2801 : jours calendaires Paris
-- sur `date`.

CREATE OR REPLACE FUNCTION public.ziko_quest_metric_value(p_user_id uuid, p_metric text, p_from timestamptz, p_to timestamptz)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_from_d  date := (p_from AT TIME ZONE 'Europe/Paris')::date;
  v_to_incl date := ((p_to - interval '1 microsecond') AT TIME ZONE 'Europe/Paris')::date;   -- inclus
  v_aligned boolean := ((p_from AT TIME ZONE 'Europe/Paris')::time = time '00:00');
  v_val     numeric := 0;
BEGIN
  IF p_metric = 'workout_sessions' THEN
    -- Seance comptee = au moins une serie enregistree (meme regle que les succes P12 / P6 D-02).
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_workout_sessions ws
    WHERE ws.user_id = p_user_id
      AND ws.started_at >= p_from AND ws.started_at < p_to
      AND EXISTS (SELECT 1 FROM public.ziko_session_sets ss WHERE ss.session_id = ws.id);
  ELSIF p_metric = 'hydration_ml' THEN
    SELECT COALESCE(SUM(h.amount_ml), 0) INTO v_val
    FROM public.ziko_hydration_logs h
    WHERE h.user_id = p_user_id
      AND (CASE WHEN v_aligned THEN h.date >= v_from_d AND h.date <= v_to_incl
                ELSE h.created_at >= p_from AND h.created_at <= p_to END);
  ELSIF p_metric = 'nutrition_logs' THEN
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_nutrition_logs n
    WHERE n.user_id = p_user_id
      AND (CASE WHEN v_aligned THEN n.date >= v_from_d AND n.date <= v_to_incl
                ELSE n.created_at >= p_from AND n.created_at <= p_to END);
  ELSIF p_metric = 'habit_logs' THEN
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_habit_logs hl
    WHERE hl.user_id = p_user_id
      AND (CASE WHEN v_aligned THEN hl.date >= v_from_d AND hl.date <= v_to_incl
                ELSE hl.created_at >= p_from AND hl.created_at <= p_to END);
  ELSIF p_metric = 'measurement_logs' THEN
    -- Une saisie = une ligne ziko_body_measurements (une ligne par saisie).
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_body_measurements bm
    WHERE bm.user_id = p_user_id
      AND (CASE WHEN v_aligned THEN bm.date >= v_from_d AND bm.date <= v_to_incl
                ELSE bm.created_at >= p_from AND bm.created_at <= p_to END);
  END IF;
  RETURN COALESCE(v_val, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_metric_value(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
