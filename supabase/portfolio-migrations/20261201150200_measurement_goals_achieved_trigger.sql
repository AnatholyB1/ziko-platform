-- ============================================================
-- v1.20 / Phase 15 (MEAS-05, MEAS-06) -- passage automatique a "achieved"
-- Quand une mesure est inseree/modifiee, tout objectif de mesure EN COURS dont la cible est
-- franchie dans le sens voulu passe a status='achieved' (achieved_at, achieved_value).
-- Trigger SECURITY DEFINER : fonctionne meme si la table des objectifs est SELECT-only pour
-- le client, et couvre aussi les mesures ajoutees par l'outil IA ou hors UI.
-- Le pourcentage n'est jamais stocke : il est calcule cote client (computeGoalProgress).
-- Ce fichier n'est PAS applique par l'agent de phase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ziko_mark_measurement_goals_achieved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.ziko_athlete_goals g
  SET status = 'achieved',
      achieved_at = now(),
      achieved_value = m.val
  FROM (
    SELECT g2.id,
           CASE g2.measure_key
             WHEN 'weight_kg'    THEN NEW.weight_kg
             WHEN 'waist_cm'     THEN NEW.waist_cm
             WHEN 'arm_cm'       THEN NEW.arm_cm
             WHEN 'chest_cm'     THEN NEW.chest_cm
             WHEN 'thigh_cm'     THEN NEW.thigh_cm
             WHEN 'hip_cm'       THEN NEW.hip_cm
             WHEN 'body_fat_pct' THEN NEW.body_fat_pct
           END AS val
    FROM public.ziko_athlete_goals g2
    WHERE g2.user_id = NEW.user_id
      AND g2.status = 'active'
      AND g2.measure_key IS NOT NULL
      AND NEW.date >= g2.start_date
  ) m
  WHERE g.id = m.id
    AND m.val IS NOT NULL
    AND (
      (g.target_value < g.start_value AND m.val <= g.target_value)
      OR (g.target_value > g.start_value AND m.val >= g.target_value)
    );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ziko_measurements_mark_goals_achieved ON public.ziko_body_measurements;
CREATE TRIGGER trg_ziko_measurements_mark_goals_achieved
  AFTER INSERT OR UPDATE ON public.ziko_body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.ziko_mark_measurement_goals_achieved();

REVOKE ALL ON FUNCTION public.ziko_mark_measurement_goals_achieved() FROM PUBLIC, anon, authenticated;
