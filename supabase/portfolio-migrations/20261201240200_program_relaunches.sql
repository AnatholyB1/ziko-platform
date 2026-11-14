-- P24 (ATEL-09) : relance automatique de l'atelier en fin de programme. Fichier NON applique par l'agent.
-- program_id UNIQUE = idempotence : un programme termine ne declenche qu'UNE relance (et donc au plus
-- un appel IA automatique). Ecriture : backend (service key) ; le client n'a que SELECT.
-- Aucune table de credits/gamification n'est referencee : la relance ne peut rien penaliser (D-06).

CREATE TABLE IF NOT EXISTS public.ziko_program_relaunches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id     uuid NOT NULL UNIQUE REFERENCES public.ziko_ai_generated_programs(id) ON DELETE CASCADE,
  sequence_id    uuid REFERENCES public.ziko_program_sequences(id) ON DELETE SET NULL,
  draft_id       uuid REFERENCES public.ziko_workshop_drafts(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'proposing', 'proposed', 'dismissed')),
  results        jsonb,
  proposed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ziko_program_relaunches_user_status
  ON public.ziko_program_relaunches (user_id, status, created_at DESC);

ALTER TABLE public.ziko_program_relaunches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_program_relaunches_select_own ON public.ziko_program_relaunches;
CREATE POLICY ziko_program_relaunches_select_own ON public.ziko_program_relaunches
  FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.ziko_program_relaunches FROM anon, authenticated;

-- Le brouillon de relance porte la suite et le programme precedent (rattachement a la publication).
ALTER TABLE public.ziko_workshop_drafts
  ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES public.ziko_program_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_program_id uuid REFERENCES public.ziko_ai_generated_programs(id) ON DELETE SET NULL;
