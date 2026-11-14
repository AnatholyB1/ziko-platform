-- v1.20 UAT run3 (defaut 7) : service_role sans privilege sur des tables que le backend lit/ecrit.
--
-- Contexte : sur une base reconstruite depuis supabase/migrations (branche de test), il n'y a AUCUN privilege par
-- defaut sur le schema public. Les tables anterieures a la serie v1.20 mais ETENDUES par elle
-- (ziko_athlete_goals, ziko_ai_generated_programs, ...) n'ont jamais recu de GRANT dans ces migrations :
-- le backend (client service_role) repondait "permission denied" (UAT run3 : ziko_athlete_goals,
-- ziko_goal_revisions). Voir 202612011803 / 202612012504 pour les tables creees par la serie v1.20.
-- Idempotent (GRANT deja detenu = no-op), gardes to_regclass (table absente = ignoree).
-- NON appliquee par l'agent. N'ouvre rien aux roles clients : service_role seulement (la RLS reste inchangee).
-- Une ecriture explicite par table (et non une boucle) : le test statique v120MigrationGrants les relit.

DO $$
BEGIN
  IF to_regclass('public.ziko_athlete_goals') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_athlete_goals TO service_role;
  END IF;
  IF to_regclass('public.ziko_goal_revisions') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_goal_revisions TO service_role;
  END IF;
  IF to_regclass('public.ziko_ai_generated_programs') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_ai_generated_programs TO service_role;
  END IF;
  IF to_regclass('public.ziko_coach_client_links') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_coach_client_links TO service_role;
  END IF;
  IF to_regclass('public.ziko_sleep_logs') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_sleep_logs TO service_role;
  END IF;
  IF to_regclass('public.ziko_stretching_logs') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_stretching_logs TO service_role;
  END IF;
  IF to_regclass('public.ziko_timer_presets') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_timer_presets TO service_role;
  END IF;
  IF to_regclass('public.ziko_wearable_daily_summary') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ziko_wearable_daily_summary TO service_role;
  END IF;
END
$$;
