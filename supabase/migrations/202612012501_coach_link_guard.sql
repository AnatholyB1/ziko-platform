-- P25 (MCOA-03, RLS stricte) etape 1/3 : un lien coach<->athlete ne se modifie que par son retrait.
-- Faille corrigee : la policy participant_revoke autorisait UPDATE de TOUTES les colonnes aux deux
-- parties (athlete : remettre revoked_at a NULL ou changer coach_id ; coach : changer client_id et
-- ainsi obtenir is_coach_of sur un athlete arbitraire). Historique conserve : on ne supprime jamais.
-- Idempotent. Non appliquee par l'agent.

ALTER TABLE public.ziko_coach_client_links ADD COLUMN IF NOT EXISTS revoked_by text;

ALTER TABLE public.ziko_coach_client_links DROP CONSTRAINT IF EXISTS ziko_coach_client_links_revoked_by_check;
ALTER TABLE public.ziko_coach_client_links
  ADD CONSTRAINT ziko_coach_client_links_revoked_by_check
  CHECK (revoked_by IS NULL OR revoked_by IN ('client', 'coach'));

CREATE OR REPLACE FUNCTION public.ziko_coach_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- service_role / postgres / cascade (suppression de compte) : auth.uid() est NULL, pas concerne.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Un lien retire est definitif : plus aucune modification par un client API.
  IF OLD.revoked_at IS NOT NULL THEN
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
      RAISE EXCEPTION 'revoked coach link is immutable' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Identite du lien immuable pour tous.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.coach_id IS DISTINCT FROM OLD.coach_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'coach link identity is immutable' USING ERRCODE = '42501';
  END IF;

  -- L'athlete ne peut que retirer son lien (revoked_at : NULL -> now), rien d'autre.
  IF v_uid = OLD.client_id THEN
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.shared_note IS DISTINCT FROM OLD.shared_note THEN
      RAISE EXCEPTION 'athlete may only revoke the link' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- revoked_by est pose par le trigger (non falsifiable par le client).
  IF NEW.revoked_at IS NOT NULL THEN
    NEW.revoked_by := CASE WHEN v_uid = OLD.client_id THEN 'client' ELSE 'coach' END;
  ELSE
    NEW.revoked_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ziko_coach_link_guard_trg ON public.ziko_coach_client_links;
CREATE TRIGGER ziko_coach_link_guard_trg
  BEFORE UPDATE ON public.ziko_coach_client_links
  FOR EACH ROW EXECUTE FUNCTION public.ziko_coach_link_guard();

-- Policy UPDATE scindee : chaque partie ne touche que ses lignes ACTIVES (un lien retire est fige).
DROP POLICY IF EXISTS "coach_client_links_participant_revoke" ON public.ziko_coach_client_links;
DROP POLICY IF EXISTS "coach_client_links_client_revoke" ON public.ziko_coach_client_links;
DROP POLICY IF EXISTS "coach_client_links_coach_update" ON public.ziko_coach_client_links;

CREATE POLICY "coach_client_links_client_revoke" ON public.ziko_coach_client_links
  FOR UPDATE
  USING (auth.uid() = client_id AND revoked_at IS NULL)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "coach_client_links_coach_update" ON public.ziko_coach_client_links
  FOR UPDATE
  USING (auth.uid() = coach_id AND revoked_at IS NULL)
  WITH CHECK (auth.uid() = coach_id);
