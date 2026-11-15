-- ============================================================
-- v1.20 / Phase 15 (MEAS-01, MEAS-06) -- objectifs de mesures en base
-- Decision D-01 (15-RESEARCH.md) : on ETEND ziko_athlete_goals (pas de nouvelle table).
--   * colonnes nullables : les lignes creees par l'outil IA create_goal et la RPC
--     ziko_record_athlete_decision restent valides sans aucun changement ;
--   * un objectif de mesure = ligne avec measure_key NOT NULL.
-- Ecriture cliente : UNIQUEMENT via la RPC ziko_create_measurement_goal (la table reste
--   SELECT-only pour anon/authenticated, REVOKE DML existant : 20260902100000 / 20261107170000).
-- Verrou D-04 : trigger BEFORE UPDATE (defense en profondeur) -- un objectif actif ne change
--   ni de mesure, ni de depart, ni de cible, ni d'unite. Porte reservee a l'IA (P16) :
--   set_config('ziko.allow_goal_edit','on',true) depuis une RPC SECURITY DEFINER.
-- Ce fichier n'est PAS applique par l'agent de phase (appliquee par l'orchestrateur).
-- ============================================================

ALTER TABLE public.ziko_athlete_goals
  ADD COLUMN IF NOT EXISTS measure_key    text,
  ADD COLUMN IF NOT EXISTS start_value    numeric,
  ADD COLUMN IF NOT EXISTS unit           text,
  ADD COLUMN IF NOT EXISTS start_date     date,
  ADD COLUMN IF NOT EXISTS achieved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS achieved_value numeric;

ALTER TABLE public.ziko_athlete_goals
  ADD CONSTRAINT ziko_athlete_goals_measure_key_check
    CHECK (measure_key IS NULL OR measure_key IN
      ('weight_kg','waist_cm','arm_cm','chest_cm','thigh_cm','hip_cm','body_fat_pct')),
  ADD CONSTRAINT ziko_athlete_goals_measure_unit_check
    CHECK (unit IS NULL OR unit IN ('kg','cm','%')),
  ADD CONSTRAINT ziko_athlete_goals_measure_shape_check
    CHECK (measure_key IS NULL OR (
      start_value IS NOT NULL
      AND target_value IS NOT NULL
      AND unit IS NOT NULL
      AND start_date IS NOT NULL
      AND start_value <> target_value
    ));

-- Au plus un objectif EN COURS par mesure et par utilisateur (un objectif atteint ne bloque pas le suivant).
CREATE UNIQUE INDEX IF NOT EXISTS ziko_idx_athlete_goals_one_active_per_measure
  ON public.ziko_athlete_goals (user_id, measure_key)
  WHERE status = 'active' AND measure_key IS NOT NULL;

-- ------------------------------------------------------------
-- Verrou : un objectif de mesure en cours n'est pas modifiable (MEAS-06 / D-04)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_guard_active_measurement_goal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.measure_key IS NOT NULL
     AND OLD.status = 'active'
     AND COALESCE(current_setting('ziko.allow_goal_edit', true), '') <> 'on'
     AND (
       NEW.measure_key    IS DISTINCT FROM OLD.measure_key
       OR NEW.start_value IS DISTINCT FROM OLD.start_value
       OR NEW.target_value IS DISTINCT FROM OLD.target_value
       OR NEW.unit        IS DISTINCT FROM OLD.unit
       OR NEW.start_date  IS DISTINCT FROM OLD.start_date
     )
  THEN
    RAISE EXCEPTION 'measurement_goal_locked: un objectif en cours ne se modifie pas'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ziko_guard_active_measurement_goal ON public.ziko_athlete_goals;
CREATE TRIGGER trg_ziko_guard_active_measurement_goal
  BEFORE UPDATE ON public.ziko_athlete_goals
  FOR EACH ROW EXECUTE FUNCTION public.ziko_guard_active_measurement_goal();

REVOKE ALL ON FUNCTION public.ziko_guard_active_measurement_goal() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Creation par l'utilisateur (D-05) : RPC SECURITY DEFINER, auth.uid() uniquement
-- Retourne jsonb {success, goal_id} ou {success:false, error}.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ziko_create_measurement_goal(
  p_measure_key  text,
  p_start_value  numeric,
  p_target_value numeric,
  p_target_date  date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_unit  text;
  v_label text;
  v_min   numeric;
  v_max   numeric;
  v_id    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- unite, libelle et plage plausible imposes par la mesure (miroir de plugins/measurements/src/lib/goals.ts)
  SELECT u, l, mn, mx INTO v_unit, v_label, v_min, v_max
  FROM (VALUES
    ('weight_kg',    'kg', 'Poids',          20::numeric,  400::numeric),
    ('waist_cm',     'cm', 'Tour de taille',  40,  250),
    ('arm_cm',       'cm', 'Bras',            10,   80),
    ('chest_cm',     'cm', 'Poitrine',        50,  250),
    ('thigh_cm',     'cm', 'Cuisses',         20,  130),
    ('hip_cm',       'cm', 'Hanches',         50,  250),
    ('body_fat_pct', '%',  'Masse grasse',     2,   70)
  ) AS t(k, u, l, mn, mx)
  WHERE k = p_measure_key;

  IF v_unit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_measure');
  END IF;
  IF p_start_value IS NULL OR p_target_value IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'value_required');
  END IF;
  IF p_start_value < v_min OR p_start_value > v_max OR p_target_value < v_min OR p_target_value > v_max THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_range');
  END IF;
  IF p_start_value = p_target_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_equals_start');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ziko_athlete_goals
    WHERE user_id = v_uid AND measure_key = p_measure_key AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'active_goal_exists');
  END IF;

  INSERT INTO public.ziko_athlete_goals
    (user_id, goal_text, target_metric, target_value, target_date, status,
     measure_key, start_value, unit, start_date)
  VALUES
    (v_uid,
     v_label || ' ' || trim(to_char(p_start_value, 'FM999990.0')) || ' -> ' || trim(to_char(p_target_value, 'FM999990.0')) || ' ' || v_unit,
     p_measure_key, p_target_value, p_target_date, 'active',
     p_measure_key, p_start_value, v_unit, CURRENT_DATE)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'goal_id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.ziko_create_measurement_goal(text, numeric, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_create_measurement_goal(text, numeric, numeric, date) TO authenticated;

COMMENT ON COLUMN public.ziko_athlete_goals.measure_key IS
  'v1.20 P15 : cle de mesure (colonne de ziko_body_measurements). NULL = objectif libre cree par create_goal. Un objectif de mesure a measure_key, start_value, unit, start_date non nuls.';
