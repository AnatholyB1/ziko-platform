-- ============================================================
-- v1.20 / Phase 16 (MEAS-02, MEAS-03, MEAS-07, MEAS-08) -- objectifs de mesures geres par l'IA
-- Fichier SEUL : jamais applique par l'agent de phase. Depend de 202612011501 (colonnes, trigger verrou D-04
-- qui lit ziko.allow_goal_edit) et 202612011502.
--
-- Le backend utilise la cle service (auth.uid() est nul) : ces RPC sont reservees a service_role et recoivent
-- p_user_id (jamais fourni par le client : le backend le prend du jeton). Elles reprennent les validations de
-- ziko_create_measurement_goal (P15, non modifiee).
--  * ziko_ai_create_measurement_goal : onboarding / chat.
--  * ziko_ai_revise_measurement_goal : modification d'un objectif EN COURS, 4 motifs seulement (MEAS-07),
--    1 modification max par objectif tous les 14 jours, sens depart->cible conserve (sauf changement d'objectif
--    principal), depart jamais modifie ; ecrit l'historique ziko_goal_revisions (MEAS-08).
--  * ziko_ack_goal_revision : l'utilisateur acquitte l'information (bandeau de l'onglet Objectifs).
-- ============================================================

-- 1. Metadonnees d'une mesure (miroir de plugins/measurements/src/lib/goals.ts et de la RPC P15)
CREATE OR REPLACE FUNCTION public.ziko_measure_meta(p_key text)
RETURNS TABLE (unit text, label text, min_value numeric, max_value numeric)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT u, l, mn, mx FROM (VALUES
    ('weight_kg',    'kg', 'Poids',          20::numeric,  400::numeric),
    ('waist_cm',     'cm', 'Tour de taille',  40,  250),
    ('arm_cm',       'cm', 'Bras',            10,   80),
    ('chest_cm',     'cm', 'Poitrine',        50,  250),
    ('thigh_cm',     'cm', 'Cuisses',         20,  130),
    ('hip_cm',       'cm', 'Hanches',         50,  250),
    ('body_fat_pct', '%',  'Masse grasse',     2,   70)
  ) AS t(k, u, l, mn, mx)
  WHERE k = p_key;
$function$;
REVOKE ALL ON FUNCTION public.ziko_measure_meta(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_measure_meta(text) TO service_role;

-- 2. Historique des modifications d'objectif par l'IA (MEAS-07/08)
CREATE TABLE IF NOT EXISTS public.ziko_goal_revisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id         uuid NOT NULL REFERENCES public.ziko_athlete_goals(id) ON DELETE CASCADE,
  measure_key     text NOT NULL,
  reason          text NOT NULL,
  reason_detail   text,
  user_statement  text,
  old_target      numeric NOT NULL,
  new_target      numeric NOT NULL,
  old_target_date date,
  new_target_date date,
  acknowledged_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_goal_revisions_reason_check
    CHECK (reason = ANY (ARRAY['stagnation'::text, 'pace'::text, 'injury_pause'::text, 'main_goal_change'::text]))
);
CREATE INDEX IF NOT EXISTS ziko_idx_goal_revisions_user ON public.ziko_goal_revisions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ziko_idx_goal_revisions_goal ON public.ziko_goal_revisions (goal_id, created_at DESC);

ALTER TABLE public.ziko_goal_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ziko_goal_revisions_read_own" ON public.ziko_goal_revisions;
CREATE POLICY "ziko_goal_revisions_read_own" ON public.ziko_goal_revisions
  FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON public.ziko_goal_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ziko_goal_revisions TO authenticated;

-- 3. Creation (service_role)
CREATE OR REPLACE FUNCTION public.ziko_ai_create_measurement_goal(
  p_user_id      uuid,
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
  v_unit  text;
  v_label text;
  v_min   numeric;
  v_max   numeric;
  v_id    uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT m.unit, m.label, m.min_value, m.max_value INTO v_unit, v_label, v_min, v_max
  FROM public.ziko_measure_meta(p_measure_key) m;
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
  IF p_target_date IS NOT NULL AND p_target_date <= CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_date_in_past');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_measurement_goal:' || p_user_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.ziko_athlete_goals
    WHERE user_id = p_user_id AND measure_key = p_measure_key AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'active_goal_exists');
  END IF;

  INSERT INTO public.ziko_athlete_goals
    (user_id, goal_text, target_metric, target_value, target_date, status,
     measure_key, start_value, unit, start_date)
  VALUES
    (p_user_id,
     v_label || ' ' || trim(to_char(p_start_value, 'FM999990.0')) || ' -> ' || trim(to_char(p_target_value, 'FM999990.0')) || ' ' || v_unit,
     p_measure_key, p_target_value, p_target_date, 'active',
     p_measure_key, p_start_value, v_unit, CURRENT_DATE)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'goal_id', v_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_ai_create_measurement_goal(uuid, text, numeric, numeric, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_ai_create_measurement_goal(uuid, text, numeric, numeric, date) TO service_role;

-- 4. Modification encadree (service_role) : la porte du verrou D-04 n'est ouverte que DANS cette fonction.
CREATE OR REPLACE FUNCTION public.ziko_ai_revise_measurement_goal(
  p_user_id         uuid,
  p_goal_id         uuid,
  p_reason          text,
  p_new_target      numeric DEFAULT NULL,
  p_new_target_date date DEFAULT NULL,
  p_reason_detail   text DEFAULT NULL,
  p_user_statement  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  g        public.ziko_athlete_goals%ROWTYPE;
  v_unit   text;
  v_label  text;
  v_min    numeric;
  v_max    numeric;
  v_target numeric;
  v_date   date;
  v_rev    uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_goal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_arguments');
  END IF;
  IF p_reason IS NULL OR p_reason <> ALL (ARRAY['stagnation', 'pace', 'injury_pause', 'main_goal_change']) THEN
    RETURN jsonb_build_object('success', false, 'error', 'reason_not_allowed');
  END IF;
  IF p_reason IN ('injury_pause', 'main_goal_change') AND COALESCE(btrim(p_user_statement), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_statement_required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ziko_measurement_goal:' || p_user_id::text, 0));

  SELECT * INTO g FROM public.ziko_athlete_goals
   WHERE id = p_goal_id AND user_id = p_user_id AND measure_key IS NOT NULL AND status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'goal_not_found_or_inactive');
  END IF;

  v_target := COALESCE(p_new_target, g.target_value);
  v_date   := COALESCE(p_new_target_date, g.target_date);
  IF v_target IS NOT DISTINCT FROM g.target_value AND v_date IS NOT DISTINCT FROM g.target_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_change');
  END IF;

  SELECT m.unit, m.label, m.min_value, m.max_value INTO v_unit, v_label, v_min, v_max
  FROM public.ziko_measure_meta(g.measure_key) m;
  IF v_target < v_min OR v_target > v_max THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_range');
  END IF;
  IF v_target = g.start_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_equals_start');
  END IF;
  -- Le sens (baisse / hausse) ne change que pour un changement d'objectif principal.
  IF p_reason <> 'main_goal_change' AND sign(v_target - g.start_value) <> sign(g.target_value - g.start_value) THEN
    RETURN jsonb_build_object('success', false, 'error', 'direction_change_not_allowed');
  END IF;
  IF v_date IS NOT NULL AND v_date <= CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_date_in_past');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ziko_goal_revisions r
     WHERE r.goal_id = g.id AND r.created_at > now() - interval '14 days'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'revision_too_soon');
  END IF;

  PERFORM set_config('ziko.allow_goal_edit', 'on', true);
  UPDATE public.ziko_athlete_goals
     SET target_value = v_target,
         target_date  = v_date,
         goal_text    = v_label || ' ' || trim(to_char(g.start_value, 'FM999990.0')) || ' -> ' || trim(to_char(v_target, 'FM999990.0')) || ' ' || v_unit
   WHERE id = g.id;
  PERFORM set_config('ziko.allow_goal_edit', 'off', true);

  INSERT INTO public.ziko_goal_revisions
    (user_id, goal_id, measure_key, reason, reason_detail, user_statement,
     old_target, new_target, old_target_date, new_target_date)
  VALUES
    (p_user_id, g.id, g.measure_key, p_reason, left(p_reason_detail, 400), left(p_user_statement, 400),
     g.target_value, v_target, g.target_date, v_date)
  RETURNING id INTO v_rev;

  RETURN jsonb_build_object('success', true, 'revision_id', v_rev, 'goal_id', g.id,
    'old_target', g.target_value, 'new_target', v_target, 'old_target_date', g.target_date, 'new_target_date', v_date);
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_ai_revise_measurement_goal(uuid, uuid, text, numeric, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_ai_revise_measurement_goal(uuid, uuid, text, numeric, date, text, text) TO service_role;

-- 5. Acquittement par l'utilisateur (auth.uid(), jamais un user_id fourni)
CREATE OR REPLACE FUNCTION public.ziko_ack_goal_revision(p_revision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.ziko_goal_revisions
     SET acknowledged_at = now()
   WHERE id = p_revision_id AND user_id = auth.uid() AND acknowledged_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.ziko_ack_goal_revision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ziko_ack_goal_revision(uuid) TO authenticated;
