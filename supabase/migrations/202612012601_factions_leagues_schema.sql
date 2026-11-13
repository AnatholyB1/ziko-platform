-- v1.20 phase 26 (LEAG-01/02/04) : schema Factions & Ligues.
-- Fichier SEUL : jamais applique par l'agent. Idempotent (IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS).
--
-- Principes (voir 26-CONTEXT.md) :
--  * Les clients ne font que LIRE leurs propres lignes. Toute ecriture passe par une fonction SECURITY DEFINER
--    (2602..2605) : aucun score, palier ou piste n'est ecrit par le client (anti-triche, D-11).
--  * Aucune FK ni ecriture vers ziko_user_gamification / ziko_coin_transactions / ziko_athlete_state /
--    ziko_athlete_decisions : une descente de palier ne retire JAMAIS d'XP, de pieces, de serie ni de tier (D-08).
--  * Deux pistes etanches (habits / performance) : toute ligne de semaine porte sa piste ; aucune agregation
--    ne melange les pistes (D-03).

-- 1. Factions (reference statique : taxonomie sport v1.8 + faction de repli, D-01).
CREATE TABLE IF NOT EXISTS public.ziko_factions (
  key        text PRIMARY KEY,
  label      text NOT NULL,
  icon       text NOT NULL,
  sort_order integer NOT NULL,
  CONSTRAINT ziko_factions_key_check CHECK (key ~ '^[a-z_]{3,24}$')
);
INSERT INTO public.ziko_factions (key, label, icon, sort_order) VALUES
  ('powerlifting', 'Powerlifting',        'barbell',       1),
  ('hyrox',        'Hyrox',               'flame',         2),
  ('running',      'Running',             'walk',          3),
  ('bodybuilding', 'Bodybuilding',        'body',          4),
  ('weight_loss',  'Perte de poids',      'trending-down', 5),
  ('wellness',     'Forme et bien-être',  'leaf',          6)
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.ziko_factions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_factions_read ON public.ziko_factions;
CREATE POLICY ziko_factions_read ON public.ziko_factions FOR SELECT TO authenticated USING (true);
REVOKE ALL ON TABLE public.ziko_factions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ziko_factions TO authenticated;
GRANT ALL ON TABLE public.ziko_factions TO service_role;

-- 2. Appartenance : une faction par personne, ecrite par ziko_join_faction seulement.
CREATE TABLE IF NOT EXISTS public.ziko_faction_members (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  faction_key text NOT NULL REFERENCES public.ziko_factions(key),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ziko_faction_members_faction_idx ON public.ziko_faction_members (faction_key);
ALTER TABLE public.ziko_faction_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_faction_members_select_own ON public.ziko_faction_members;
CREATE POLICY ziko_faction_members_select_own ON public.ziko_faction_members
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.ziko_faction_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ziko_faction_members TO authenticated;
GRANT ALL ON TABLE public.ziko_faction_members TO service_role;

-- 3. Etat de ligue : une ligne par personne (piste COURANTE + echelle de paliers).
CREATE TABLE IF NOT EXISTS public.ziko_league_state (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  track            text NOT NULL,
  division         integer NOT NULL DEFAULT 1,
  start_division   integer NOT NULL DEFAULT 1,
  peak_division    integer NOT NULL DEFAULT 1,
  up_streak        integer NOT NULL DEFAULT 0,
  low_streak       integer NOT NULL DEFAULT 0,
  unlocked_at      timestamptz NOT NULL DEFAULT now(),
  track_since      timestamptz NOT NULL DEFAULT now(),
  last_week_closed date NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_league_state_track_check CHECK (track IN ('habits', 'performance')),
  CONSTRAINT ziko_league_state_division_check CHECK (division BETWEEN 1 AND 5),
  CONSTRAINT ziko_league_state_start_check CHECK (start_division BETWEEN 1 AND 5),
  CONSTRAINT ziko_league_state_peak_check CHECK (peak_division BETWEEN division AND 5),
  CONSTRAINT ziko_league_state_streaks_check CHECK (up_streak >= 0 AND low_streak >= 0)
);
ALTER TABLE public.ziko_league_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_league_state_select_own ON public.ziko_league_state;
CREATE POLICY ziko_league_state_select_own ON public.ziko_league_state
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.ziko_league_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ziko_league_state TO authenticated;
GRANT ALL ON TABLE public.ziko_league_state TO service_role;

-- 4. Semaines cloturees (historique, jamais reecrit : PK user_id + week_start => idempotent).
CREATE TABLE IF NOT EXISTS public.ziko_league_weeks (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  track           text NOT NULL,
  asked           numeric NOT NULL,
  done            numeric NOT NULL,
  score           numeric(5,2) NOT NULL,
  division_before integer NOT NULL,
  division_after  integer NOT NULL,
  outcome         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start),
  CONSTRAINT ziko_league_weeks_track_check CHECK (track IN ('habits', 'performance')),
  CONSTRAINT ziko_league_weeks_score_check CHECK (score BETWEEN 0 AND 100),
  CONSTRAINT ziko_league_weeks_outcome_check CHECK (outcome IN ('up', 'down', 'hold', 'neutral')),
  CONSTRAINT ziko_league_weeks_division_check CHECK (division_before BETWEEN 1 AND 5 AND division_after BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS ziko_league_weeks_user_track_idx ON public.ziko_league_weeks (user_id, track, week_start DESC);
ALTER TABLE public.ziko_league_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_league_weeks_select_own ON public.ziko_league_weeks;
CREATE POLICY ziko_league_weeks_select_own ON public.ziko_league_weeks
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.ziko_league_weeks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ziko_league_weeks TO authenticated;
GRANT ALL ON TABLE public.ziko_league_weeks TO service_role;

-- 5. Transitions de piste decidees par l'IA (journal propre a la ligue, D-13 ; celebration, D-10).
CREATE TABLE IF NOT EXISTS public.ziko_league_transitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_track    text NOT NULL,
  to_track      text NOT NULL,
  decided_by    text NOT NULL DEFAULT 'ai',
  reason        text NOT NULL,
  evidence      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  celebrated_at timestamptz,
  CONSTRAINT ziko_league_transitions_tracks_check CHECK (from_track = 'habits' AND to_track = 'performance'),
  CONSTRAINT ziko_league_transitions_decider_check CHECK (decided_by = 'ai'),
  CONSTRAINT ziko_league_transitions_reason_check CHECK (char_length(reason) BETWEEN 1 AND 300),
  CONSTRAINT ziko_league_transitions_evidence_check CHECK (jsonb_typeof(evidence) = 'object')
);
CREATE INDEX IF NOT EXISTS ziko_league_transitions_user_idx ON public.ziko_league_transitions (user_id, created_at DESC);
ALTER TABLE public.ziko_league_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ziko_league_transitions_select_own ON public.ziko_league_transitions;
CREATE POLICY ziko_league_transitions_select_own ON public.ziko_league_transitions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.ziko_league_transitions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ziko_league_transitions TO authenticated;
GRANT ALL ON TABLE public.ziko_league_transitions TO service_role;

-- 6. Quota des appels IA automatiques (service_role seul : aucune policy, aucun droit client).
CREATE TABLE IF NOT EXISTS public.ziko_league_ai_state (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_day        date,
  auto_count      integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  CONSTRAINT ziko_league_ai_state_count_check CHECK (auto_count >= 0)
);
ALTER TABLE public.ziko_league_ai_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ziko_league_ai_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ziko_league_ai_state TO service_role;

-- 7. Utilitaires internes (aucun droit client).
-- Debut de semaine (lundi) d'une date.
CREATE OR REPLACE FUNCTION public.ziko_week_start(p_day date)
 RETURNS date LANGUAGE sql IMMUTABLE
 SET search_path = public, pg_temp
AS $$ SELECT date_trunc('week', p_day::timestamp)::date $$;
REVOKE ALL ON FUNCTION public.ziko_week_start(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ziko_week_start(date) TO service_role;
