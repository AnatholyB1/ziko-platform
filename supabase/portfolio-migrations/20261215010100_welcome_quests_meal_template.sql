-- v1.21 phase 1 (QNEW-01 / QNEW-02 / D-01) : jeu de quetes de bienvenue = eau, repas, seance.
-- Fichier SEUL : jamais applique par l'agent (l'orchestrateur applique apres accord, d'abord sur la branche de test).
-- Aucune fonction n'est modifiee : `ziko_sync_quests` (20261201290400) cree deja, pour tout compte, UNE instance par
-- modele `is_starter AND is_active` et par periode, avec `ON CONFLICT (user_id, slug, period_start) DO NOTHING`
-- (contrainte unique `ziko_user_quests_unique_period`) : l'appel est idempotent, aucun doublon possible.
-- Cette migration ne fait donc que le jeu de donnees (templates), de maniere rejouable (ON CONFLICT / UPDATE).

-- 1. Modele « repas » : metrique `nutrition_logs` deja supportee par ziko_quest_metric_value et par les CHECK.
INSERT INTO public.ziko_quest_templates
  (slug, scope, title, description, icon, metric, target, unit, reward_coins, is_starter, is_active, sort_order)
VALUES
  ('starter_daily_meal', 'daily', 'Ajoute un repas', 'Note ton premier repas dans Nutrition.',
   'restaurant', 'nutrition_logs', 1, 'repas', 15, true, true, 20)
ON CONFLICT (slug) DO NOTHING;

-- 2. Ordre d'affichage de bienvenue : eau, repas, seance (CLAR-03 : la premiere quete est l'hydratation).
--    Les instances d'un compte sont creees dans l'ordre `sort_order` ; les comptes deja initialises ne changent pas.
UPDATE public.ziko_quest_templates SET sort_order = 10 WHERE slug = 'starter_daily_water';
UPDATE public.ziko_quest_templates SET sort_order = 30 WHERE slug = 'starter_daily_workout';

-- 3. Libelles de bienvenue (maquette de la phase 1) pour les NOUVELLES instances ; les instances existantes gardent
--    leur copie figee (le texte de l'accueil est aussi porte cote application pour ces slugs).
UPDATE public.ziko_quest_templates
   SET title = 'Bois 2 litres d''eau', description = 'Ajoute chaque verre dans Hydratation.'
 WHERE slug = 'starter_daily_water';
UPDATE public.ziko_quest_templates
   SET title = 'Termine une séance', description = 'Lance une séance depuis l''onglet Séance.'
 WHERE slug = 'starter_daily_workout';

-- 4. D-11 : la quete hebdomadaire « S'entrainer 3 fois » (`starter_weekly_train`) est CONSERVEE telle quelle
--    (is_starter reste true) : l'accueil plafonne l'affichage a 3 quetes en preferant les quotidiennes (UI, homeQuests.ts).
--    Les comptes existants ne changent pas ; aucune ligne `expired` orpheline n'est creee.
