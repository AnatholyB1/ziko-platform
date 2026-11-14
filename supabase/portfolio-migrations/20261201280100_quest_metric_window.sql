-- v1.20 revue B (H1) : fenetre de dates juste pour les quetes IA / chat.
-- Fichier SEUL : jamais applique par l'agent. Depend de 202612011602 (derniere version de ziko_quest_metric_value,
-- dont les 5 branches sont reprises a l'identique : workout_sessions, hydration_ml, nutrition_logs, habit_logs,
-- measurement_logs). Les anciennes migrations ne sont pas modifiees ; CREATE OR REPLACE, signature et droits inchanges.
--
-- Probleme : les metriques a base de colonne `date` (eau, repas, habitudes, mesures) etaient bornees par des jours
-- calendaires Paris [from_d, to_d) alors qu'une quete IA / chat est creee a now() avec une duree en heures :
--  (a) les saisies deja faites AVANT la creation le meme jour comptaient (quete "2 L" creee a 21 h apres 2 L bus = terminee) ;
--  (b) une quete de 24 h creee a 21 h avait to_d = demain, exclusif : les saisies de demain ne comptaient jamais.
--
-- Regle : la progression part de period_start (instant de creation) et s'arrete a expires_at.
--  - fin : dernier jour Paris touche par la fenetre, INCLUS (to_incl = date de (p_to - 1 microseconde)). Pour une quete de
--    depart alignee sur minuit Paris, to_incl = veille du minuit de fin : resultat identique a l'ancien [from_d, to_d) ;
--  - debut : si p_from n'est PAS un minuit Paris (quete creee en cours de journee), seules comptent les lignes dont
--    created_at >= p_from (et <= p_to) ; une saisie anterieure a la quete ne compte jamais. Les quetes de depart
--    (alignees) restent sur le jour calendaire seul, comme en P13.

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
    WHERE h.user_id = p_user_id AND h.date >= v_from_d AND h.date <= v_to_incl
      AND (v_aligned OR (h.created_at >= p_from AND h.created_at <= p_to));
  ELSIF p_metric = 'nutrition_logs' THEN
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_nutrition_logs n
    WHERE n.user_id = p_user_id AND n.date >= v_from_d AND n.date <= v_to_incl
      AND (v_aligned OR (n.created_at >= p_from AND n.created_at <= p_to));
  ELSIF p_metric = 'habit_logs' THEN
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_habit_logs hl
    WHERE hl.user_id = p_user_id AND hl.date >= v_from_d AND hl.date <= v_to_incl
      AND (v_aligned OR (hl.created_at >= p_from AND hl.created_at <= p_to));
  ELSIF p_metric = 'measurement_logs' THEN
    -- Une saisie = une ligne ziko_body_measurements datee dans la periode (une ligne par jour et par saisie).
    SELECT COUNT(*) INTO v_val
    FROM public.ziko_body_measurements bm
    WHERE bm.user_id = p_user_id AND bm.date >= v_from_d AND bm.date <= v_to_incl
      AND (v_aligned OR (bm.created_at >= p_from AND bm.created_at <= p_to));
  END IF;
  RETURN COALESCE(v_val, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_quest_metric_value(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
