-- UAT run4 P7 : reactiver un programme IA doit remettre `completed_at` a NULL.
-- Sinon un programme actif conserve l'ancien `completed_at` et le bandeau P24 "Programme termine" reste
-- affiche sur un programme en cours (lu via la colonne ajoutee par 202612012401_program_sequences.sql).
--
-- Repart de la DERNIERE version de ziko_set_active_program (202612010703_active_program_rpc.sql) ; seule
-- la branche "activer la cible" change pour p_kind = 'ai'. `results` et `started_at` sont conserves
-- (historique) ; started_at n'est pas retouche (le trigger de 2401 ne l'estampille qu'a la 1re activation).
-- Idempotent (CREATE OR REPLACE + memes GRANT/REVOKE). NON appliquee par l'agent.
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

  -- 2) activer la cible ; un programme IA reactive n'est plus "termine"
  IF p_kind = 'workout' THEN
    UPDATE public.ziko_workout_programs SET is_active = true WHERE id = p_program_id;
  ELSE
    UPDATE public.ziko_ai_generated_programs
    SET is_active = true, completed_at = NULL
    WHERE id = p_program_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_set_active_program(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ziko_set_active_program(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ziko_set_active_program(text, uuid) TO authenticated;
