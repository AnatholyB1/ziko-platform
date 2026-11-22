-- Phase 20 (TIMR-02) : echauffement, series par round, repos entre rounds.
-- Defauts 0 / 1 / 0 : les presets existants restent valides (lus comme "1 serie").
-- Aucune suppression de ligne (Q-P20a : pas de DELETE sur le nom 'Exemple'), pas de nouvelle table.

ALTER TABLE public.ziko_timer_presets
  ADD COLUMN IF NOT EXISTS warmup_sec     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sets           integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_rest_sec integer NOT NULL DEFAULT 0;

ALTER TABLE public.ziko_timer_presets
  ADD CONSTRAINT ziko_timer_presets_warmup_nonneg CHECK (warmup_sec >= 0),
  ADD CONSTRAINT ziko_timer_presets_sets_min CHECK (sets >= 1),
  ADD CONSTRAINT ziko_timer_presets_round_rest_nonneg CHECK (round_rest_sec >= 0),
  ADD CONSTRAINT ziko_timer_presets_rounds_min CHECK (rounds >= 1);

COMMENT ON COLUMN public.ziko_timer_presets.warmup_sec IS 'Echauffement avant le premier effort (s).';
COMMENT ON COLUMN public.ziko_timer_presets.sets IS 'Series par round (>= 1).';
COMMENT ON COLUMN public.ziko_timer_presets.round_rest_sec IS 'Repos entre deux rounds (s), applique rounds-1 fois.';
