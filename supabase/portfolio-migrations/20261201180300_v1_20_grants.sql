-- v1.20 UAT run2 (defaut 3) : GRANT explicites pour les tables v1.20 creees SANS GRANT.
--
-- Contexte : le schema portfolio a retire les privileges par defaut (cf. 20261107170000_ziko_revoke_client_dml).
-- Une table creee sans GRANT repond "permission denied" a l'ouverture de l'ecran (stretching, reglages
-- hydratation) : la RLS ne s'applique qu'APRES le controle des privileges de table.
-- Regle : on n'ouvre que ce que la RLS ET le code client utilisent ; service_role pour le backend.
-- Idempotent (GRANT deja detenu = no-op), gardes to_regclass (table absente = ignoree).
-- Les tables creees plus tard dans la serie (complements, atelier, suites) sont couvertes par
-- 202612012504_v1_20_grants_late.sql (ce fichier precede leur creation dans l'ordre de rejeu).

DO $$
BEGIN
  -- Reglages hydratation : SELECT + upsert (INSERT/UPDATE) par le client, pas de DELETE.
  IF to_regclass('public.ziko_hydration_settings') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.ziko_hydration_settings TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_hydration_settings TO service_role;
  END IF;

  -- Catalogue stretching : lecture + creation d'exercices perso (pas d'UPDATE/DELETE cote client).
  IF to_regclass('public.ziko_stretching_exercises') IS NOT NULL THEN
    GRANT SELECT, INSERT ON TABLE public.ziko_stretching_exercises TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_stretching_exercises TO service_role;
  END IF;

  -- Revisions d'objectifs de mesures (ecritures via fonctions SECURITY DEFINER) : SELECT seul.
  IF to_regclass('public.ziko_goal_revisions') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.ziko_goal_revisions TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_goal_revisions TO service_role;
  END IF;
END
$$;
