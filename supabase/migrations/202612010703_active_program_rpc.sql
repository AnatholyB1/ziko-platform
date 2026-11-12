-- P7 (TRAIN-07) etape 3/4 : SEUL chemin d'ecriture client de is_active.
-- SECURITY DEFINER car un athlete n'a que SELECT sur un programme assigne par son coach
-- (policy workout_programs_assigned_athlete_read) : il ne peut pas l'activer/desactiver par UPDATE.
-- Une seule transaction : tout est desactive pour l'appelant (2 tables), puis la cible est activee.
-- Idempotent (CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION public.ziko_set_active_program(p_kind text, p_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('workout', 'ai') THEN
    RAISE EXCEPTION 'invalid program kind' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'workout' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ziko_workout_programs
      WHERE id = p_program_id AND NOT is_template
        AND (user_id = v_uid OR assigned_to_user_id = v_uid)
    ) INTO v_ok;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.ziko_ai_generated_programs
      WHERE id = p_program_id AND user_id = v_uid
    ) INTO v_ok;
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'program not found' USING ERRCODE = 'P0002';
  END IF;

  -- 1) tout desactiver pour l'appelant (progression conservee : seules les lignes is_active changent)
  UPDATE public.ziko_workout_programs
  SET is_active = false
  WHERE is_active AND NOT is_template
    AND (user_id = v_uid OR assigned_to_user_id = v_uid)
    AND NOT (p_kind = 'workout' AND id = p_program_id);
  UPDATE public.ziko_ai_generated_programs
  SET is_active = false
  WHERE is_active AND user_id = v_uid
    AND NOT (p_kind = 'ai' AND id = p_program_id);

  -- 2) activer la cible
  IF p_kind = 'workout' THEN
    UPDATE public.ziko_workout_programs SET is_active = true WHERE id = p_program_id;
  ELSE
    UPDATE public.ziko_ai_generated_programs SET is_active = true WHERE id = p_program_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_set_active_program(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ziko_set_active_program(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ziko_set_active_program(text, uuid) TO authenticated;
