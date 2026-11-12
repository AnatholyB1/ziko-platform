-- P7 (TRAIN-07) etape 4/4 : un INSERT is_active=true (outil IA backend `ai_programs_generate`)
-- ne doit jamais creer un 2e programme actif ni ecraser SILENCIEUSEMENT un programme coach/perso
-- actif (la regle de conflit exige une confirmation, A08).
--  - si un programme ziko_workout_programs est deja actif pour l'athlete : la ligne est inseree INACTIVE ;
--  - sinon les autres programmes IA actifs de l'athlete sont desactives et la nouvelle ligne reste active.
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
CREATE OR REPLACE FUNCTION public.ziko_ai_program_single_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    IF EXISTS (
      SELECT 1 FROM public.ziko_workout_programs
      WHERE is_active AND NOT is_template
        AND COALESCE(assigned_to_user_id, user_id) = NEW.user_id
    ) THEN
      NEW.is_active := false;
    ELSE
      UPDATE public.ziko_ai_generated_programs
      SET is_active = false
      WHERE user_id = NEW.user_id AND is_active;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ziko_ai_program_single_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ziko_ai_program_single_active() FROM anon;
REVOKE ALL ON FUNCTION public.ziko_ai_program_single_active() FROM authenticated;

DROP TRIGGER IF EXISTS ziko_ai_program_single_active_trg ON public.ziko_ai_generated_programs;
CREATE TRIGGER ziko_ai_program_single_active_trg
  BEFORE INSERT ON public.ziko_ai_generated_programs
  FOR EACH ROW EXECUTE FUNCTION public.ziko_ai_program_single_active();
