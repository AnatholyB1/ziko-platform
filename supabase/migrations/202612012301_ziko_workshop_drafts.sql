-- P23 (ATEL-01, ATEL-05) : brouillons de l'atelier IA de creation de programme (D-02).
-- Un brouillon n'est PAS un programme : il n'apparait donc jamais dans la liste P7. "Enregistrer"
-- insere une ligne INACTIVE dans ziko_ai_generated_programs (cote backend) ; l'activation reste le
-- chemin unique de P7 (ziko_set_active_program).
-- Ecriture : uniquement par le backend (service key, filtre user_id explicite). Le client mobile
-- n'a que la lecture de ses propres lignes (RLS). Fichier NON applique par l'agent de phase.
-- Le CHECK de ziko_ai_cost_log.source n'existe pas (voir 20260902100100) : la nouvelle source
-- 'workshop_web_search' n'exige aucune migration.

CREATE TABLE IF NOT EXISTS public.ziko_workshop_drafts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id   uuid REFERENCES public.ziko_ai_conversations(id) ON DELETE SET NULL,
  name              text,
  goal              text,
  program_data      jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision          integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  saved_program_id  uuid REFERENCES public.ziko_ai_generated_programs(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ziko_workshop_drafts_user_status
  ON public.ziko_workshop_drafts (user_id, status, updated_at DESC);

ALTER TABLE public.ziko_workshop_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ziko_workshop_drafts_select_own ON public.ziko_workshop_drafts;
CREATE POLICY ziko_workshop_drafts_select_own ON public.ziko_workshop_drafts
  FOR SELECT USING (auth.uid() = user_id);

-- Pas d'INSERT/UPDATE/DELETE client : le backend ecrit avec la service key.
REVOKE INSERT, UPDATE, DELETE ON public.ziko_workshop_drafts FROM anon, authenticated;
