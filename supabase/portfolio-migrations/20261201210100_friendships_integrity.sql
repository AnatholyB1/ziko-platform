-- ============================================================
-- v1.20 Phase 21 (Social & Amis) - integrite de ziko_friendships (SOC-04, G-03, G-04, Q-P21b)
-- Fichier seulement : applique par l'orchestrateur sur la branche de test d'abord.
-- La production n'est touchee qu'apres accord utilisateur ET comptage des doublons en LECTURE SEULE
-- (requete de comptage ci-dessous, a lancer avant application).
--
-- 1. supprime les doublons de paires croisees (A->B et B->A) : garde l'acceptee, sinon la
--    pending, sinon la plus ancienne ;
-- 2. pose un index unique sur la paire NON ordonnee ;
-- 3. ferme la faille d'auto-acceptation : INSERT impose status = 'pending' ; UPDATE reserve au
--    destinataire (pending -> accepted uniquement) ; un trigger gele requester_id / addressee_id.
--    DELETE reste ouvert aux deux parties (annuler / refuser / retirer un ami).
--
-- Comptage de lecture seule a lancer AVANT application (n'ecrit rien) :
--   SELECT count(*) AS lignes_en_trop FROM (
--     SELECT row_number() OVER (
--       PARTITION BY LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)
--       ORDER BY created_at, id) AS rn
--     FROM public.ziko_friendships) t WHERE rn > 1;
-- ============================================================

-- 1) Dedoublonnage des paires croisees (idempotent : sans doublon, ne supprime rien)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)
           ORDER BY (status = 'accepted') DESC, (status = 'pending') DESC, created_at ASC, id ASC
         ) AS rn
  FROM public.ziko_friendships
)
DELETE FROM public.ziko_friendships f
USING ranked r
WHERE f.id = r.id AND r.rn > 1;

-- 2) Une seule ligne par paire non ordonnee
CREATE UNIQUE INDEX IF NOT EXISTS ziko_friendships_pair_unique
  ON public.ziko_friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- 3) RLS : plus d'auto-acceptation (ni par UPDATE, ni par INSERT direct avec status = 'accepted')
DROP POLICY IF EXISTS "friendships_insert" ON public.ziko_friendships;
CREATE POLICY "friendships_insert" ON public.ziko_friendships
  AS PERMISSIVE FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

DROP POLICY IF EXISTS "friendships_update" ON public.ziko_friendships;
CREATE POLICY "friendships_update" ON public.ziko_friendships
  AS PERMISSIVE FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');

-- Le destinataire ne peut modifier ni les parties ni la date de creation (sinon il pourrait
-- se fabriquer une amitie avec un tiers en changeant requester_id).
CREATE OR REPLACE FUNCTION public.ziko_friendships_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'ziko_friendships: requester_id, addressee_id et created_at sont immuables'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ziko_friendships_guard_update ON public.ziko_friendships;
CREATE TRIGGER trg_ziko_friendships_guard_update
  BEFORE UPDATE ON public.ziko_friendships
  FOR EACH ROW EXECUTE FUNCTION public.ziko_friendships_guard_update();
