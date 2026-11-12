-- v1.20 phase 13 (QUEST-01 / QUEST-02) : tables de quetes + quetes de depart identiques pour tous.
-- Fichier SEUL : jamais applique par l'agent (l'orchestrateur applique apres approbation).
-- Ordre : apres 202612011201 (qui introduit la source de pieces `achievement`).
--
-- Regle non punitive (v1.18, phases 45/46) : aucune colonne/fonction ne retire XP, pieces ou serie ;
-- une quete non terminee passe simplement `expired` (information neutre).
-- Ecritures : aucune pour les clients (SELECT seul) ; tout passe par les fonctions SECURITY DEFINER de 1302.
-- Stockage prevu pour l'outil IA de P14 : `source = 'ai'`, `template_id` nul, `ai_meta jsonb`.

-- 1. Catalogue (quetes de depart + modeles reutilisables).
CREATE TABLE IF NOT EXISTS public.ziko_quest_templates (
  id            uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  scope         text NOT NULL,
  title         text NOT NULL,
  description   text,
  icon          text NOT NULL,                       -- nom Ionicons, jamais un emoji
  metric        text NOT NULL,
  target        numeric(10,2) NOT NULL,
  unit          text,
  reward_coins  integer NOT NULL DEFAULT 0,
  is_starter    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_quest_templates_scope_check  CHECK (scope = ANY (ARRAY['daily'::text, 'weekly'::text])),
  CONSTRAINT ziko_quest_templates_metric_check CHECK (metric = ANY (ARRAY['workout_sessions'::text, 'hydration_ml'::text, 'nutrition_logs'::text, 'habit_logs'::text])),
  CONSTRAINT ziko_quest_templates_target_check CHECK (target > 0),
  CONSTRAINT ziko_quest_templates_reward_check CHECK (reward_coins >= 0 AND reward_coins <= 500)
);

-- 2. Instances par utilisateur et par periode (copie figee du modele : titre/cible/recompense).
CREATE TABLE IF NOT EXISTS public.ziko_user_quests (
  id            uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id   uuid REFERENCES public.ziko_quest_templates(id) ON DELETE SET NULL,
  slug          text NOT NULL,                       -- slug du modele, ou `ai-<uuid>` pour une quete IA
  source        text NOT NULL DEFAULT 'starter',
  scope         text NOT NULL,
  title         text NOT NULL,
  description   text,
  icon          text NOT NULL,
  metric        text NOT NULL,
  target        numeric(10,2) NOT NULL,
  unit          text,
  reward_coins  integer NOT NULL DEFAULT 0,
  period_start  timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'active',
  progress      numeric(10,2) NOT NULL DEFAULT 0,    -- derniere valeur mesuree (recalculee a chaque sync)
  completed_at  timestamptz,
  rewarded_at   timestamptz,                         -- garde d'idempotence du credit de pieces
  ai_meta       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- P14 : raison, niveau declencheur, identite visee...
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ziko_user_quests_source_check  CHECK (source = ANY (ARRAY['starter'::text, 'ai'::text])),
  CONSTRAINT ziko_user_quests_scope_check   CHECK (scope = ANY (ARRAY['daily'::text, 'weekly'::text])),
  CONSTRAINT ziko_user_quests_metric_check  CHECK (metric = ANY (ARRAY['workout_sessions'::text, 'hydration_ml'::text, 'nutrition_logs'::text, 'habit_logs'::text])),
  CONSTRAINT ziko_user_quests_status_check  CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text])),
  CONSTRAINT ziko_user_quests_target_check  CHECK (target > 0),
  CONSTRAINT ziko_user_quests_reward_check  CHECK (reward_coins >= 0 AND reward_coins <= 500),
  CONSTRAINT ziko_user_quests_period_check  CHECK (expires_at > period_start),
  CONSTRAINT ziko_user_quests_unique_period UNIQUE (user_id, slug, period_start)
);
CREATE INDEX IF NOT EXISTS ziko_idx_user_quests_user_status ON public.ziko_user_quests (user_id, status, expires_at);

-- 3. RLS + grants restreints : lecture seule cote client.
ALTER TABLE public.ziko_quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ziko_user_quests     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ziko_quest_templates_read" ON public.ziko_quest_templates;
CREATE POLICY "ziko_quest_templates_read" ON public.ziko_quest_templates
  FOR SELECT TO authenticated USING (is_active);

DROP POLICY IF EXISTS "ziko_user_quests_select_own" ON public.ziko_user_quests;
CREATE POLICY "ziko_user_quests_select_own" ON public.ziko_user_quests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.ziko_quest_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ziko_user_quests     FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ziko_quest_templates TO authenticated;
GRANT SELECT ON public.ziko_user_quests     TO authenticated;
GRANT ALL ON public.ziko_quest_templates TO service_role;
GRANT ALL ON public.ziko_user_quests     TO service_role;

-- 4. Quetes de depart : identiques pour tous (QUEST-02), exactement la maquette B12.
INSERT INTO public.ziko_quest_templates (slug, scope, title, description, icon, metric, target, unit, reward_coins, is_starter, sort_order) VALUES
  ('starter_daily_workout', 'daily',  'Terminer une séance',  'Termine une séance d''entraînement aujourd''hui.', 'barbell', 'workout_sessions', 1,    'séance', 25, true, 10),
  ('starter_daily_water',   'daily',  'Boire 2 litres d''eau', 'Enregistre 2 litres d''eau dans la journée.',      'water',   'hydration_ml',     2000, 'ml',     15, true, 20),
  ('starter_weekly_train',  'weekly', 'S''entraîner 3 fois',  'Termine 3 séances cette semaine.',                 'trophy',  'workout_sessions', 3,    'séance', 60, true, 30)
ON CONFLICT (slug) DO NOTHING;

-- 5. Source de pieces `quest` (drop/recreate du CHECK, avec toutes les sources connues dont `achievement` de P12).
ALTER TABLE public.ziko_coin_transactions
  DROP CONSTRAINT IF EXISTS ziko_coin_transactions_source_check;
ALTER TABLE public.ziko_coin_transactions
  ADD CONSTRAINT ziko_coin_transactions_source_check
  CHECK (source = ANY (ARRAY['workout'::text, 'habit'::text, 'streak_bonus'::text, 'level_up'::text,
                             'purchase'::text, 'refund'::text, 'achievement'::text, 'quest'::text]));
