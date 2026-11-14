-- v1.20 UAT run2 (defaut 3, suite) : GRANT des tables v1.20 creees apres 202612011803.
-- Voir 202612011803_v1_20_grants.sql pour le contexte. Idempotent, gardes to_regclass.

DO $$
BEGIN
  -- Pile de complements : lecture, ajout/maj (upsert), retrait (delete cote client).
  IF to_regclass('public.ziko_user_supplement_stack') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_user_supplement_stack TO authenticated, service_role;
  END IF;

  -- Prises : upsert + annulation (delete) cote client.
  IF to_regclass('public.ziko_supplement_intakes') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_supplement_intakes TO authenticated, service_role;
  END IF;

  -- Preferences de rappel : SELECT + upsert, pas de DELETE.
  IF to_regclass('public.ziko_supplement_reminder_prefs') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.ziko_supplement_reminder_prefs TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_supplement_reminder_prefs TO service_role;
  END IF;

  -- Atelier / suites / relances : ecrits par le backend (service_role), lus par le client (SELECT seul).
  IF to_regclass('public.ziko_workshop_drafts') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.ziko_workshop_drafts TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_workshop_drafts TO service_role;
  END IF;
  IF to_regclass('public.ziko_program_sequences') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.ziko_program_sequences TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_program_sequences TO service_role;
  END IF;
  IF to_regclass('public.ziko_program_relaunches') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.ziko_program_relaunches TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_program_relaunches TO service_role;
  END IF;
END
$$;
