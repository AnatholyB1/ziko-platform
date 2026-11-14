-- P24 (ATEL-07) : suite ordonnee de programmes (periodisation). Fichier NON applique par l'agent de phase.
-- Un programme IA/atelier appartient a au plus une suite (sequence_id + sequence_position unique).
-- "Un seul actif" reste garanti par P7 (index uniques + RPC ziko_set_active_program) : rien ici ne
-- change l'activation. Ecriture des suites/resultats : backend (service key) ; le client n'a que SELECT.

CREATE TABLE IF NOT EXISTS public.ziko_program_sequences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  goal        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ziko_program_sequences_user
  ON public.ziko_program_sequences (user_id, created_at DESC);

ALTER TABLE public.ziko_program_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_program_sequences_select_own ON public.ziko_program_sequences;
CREATE POLICY ziko_program_sequences_select_own ON public.ziko_program_sequences
  FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.ziko_program_sequences FROM anon, authenticated;

ALTER TABLE public.ziko_ai_generated_programs
  ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES public.ziko_program_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_position integer CHECK (sequence_position IS NULL OR sequence_position >= 1),
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS results jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ziko_ai_programs_sequence_position
  ON public.ziko_ai_generated_programs (sequence_id, sequence_position)
  WHERE sequence_id IS NOT NULL;

-- started_at : pose a la premiere activation (D-03). Independant de la RPC P7 (non redefinie).
-- Nom du trigger > 'ziko_ai_program_single_active_trg' (ordre alphabetique) : sur INSERT, le trigger P7
-- decide d'abord si la ligne reste active, puis celui-ci n'estampille que si elle l'est.
CREATE OR REPLACE FUNCTION public.ziko_ai_program_stamp_started()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ziko_ai_program_started_at_trg ON public.ziko_ai_generated_programs;
CREATE TRIGGER ziko_ai_program_started_at_trg
  BEFORE INSERT OR UPDATE OF is_active ON public.ziko_ai_generated_programs
  FOR EACH ROW EXECUTE FUNCTION public.ziko_ai_program_stamp_started();
