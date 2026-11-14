-- Phase 17 (SLP-01, SLP-03, SLP-04) : saisie manuelle du sommeil + phases fournies par une source connectee.
-- Une ligne par nuit : la saisie reste dans ziko_sleep_logs (UNIQUE(user_id, date)), la nuit connectee reste
-- dans ziko_wearable_daily_summary. Aucune nouvelle table, grants inchanges (les colonnes heritent de la table).
-- Fichier seulement : non applique par l'agent (CI/humain).

ALTER TABLE public.ziko_sleep_logs
  ADD COLUMN IF NOT EXISTS awakenings smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.ziko_sleep_logs
  ADD CONSTRAINT ziko_sleep_logs_awakenings_check CHECK (awakenings BETWEEN 0 AND 20);
ALTER TABLE public.ziko_sleep_logs
  ADD CONSTRAINT ziko_sleep_logs_source_check CHECK (source IN ('manual', 'health'));

-- Phases (minutes) : renseignees uniquement par une source connectee (ecrites cote service, pas par le client).
ALTER TABLE public.ziko_wearable_daily_summary
  ADD COLUMN IF NOT EXISTS sleep_deep_min smallint,
  ADD COLUMN IF NOT EXISTS sleep_light_min smallint,
  ADD COLUMN IF NOT EXISTS sleep_rem_min smallint,
  ADD COLUMN IF NOT EXISTS sleep_awake_min smallint;

COMMENT ON COLUMN public.ziko_sleep_logs.source IS 'manual = saisie par l''utilisateur. Une nuit connectee vit dans ziko_wearable_daily_summary et prime a l''affichage.';
COMMENT ON COLUMN public.ziko_wearable_daily_summary.sleep_deep_min IS 'Minutes de sommeil profond fournies par la source connectee (NULL = non fourni).';
