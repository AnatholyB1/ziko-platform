# Phase 13 : Quêtes en base, CONTEXT

Écrit avant le code (pas de discuss préalable). Les gray areas portent la réponse recommandée marquée **[A CONFIRMER]** : appliquée par défaut, réversible, à valider par l'utilisateur.
Exigences : QUEST-01 (quêtes en base, progression calculée sur données réelles), QUEST-02 (quêtes de départ identiques pour tous). QUEST-03..08 = P14 (outil IA) : P13 prépare seulement le stockage.

## Sources lues
ROADMAP phase 13/14, REQUIREMENTS QUEST-*, `12-SUMMARY.md` (frontière : `QuestsTab` isolé en tête de `GamificationPlugin.tsx`), `lot-B/DESIGN-CONTRACT.md` + `src/01-recompenses.html` (B12 quêtes, B13 vide : la maquette gagne), v1.18 phases 45/46 (récompenses non punitives : jamais de retrait d'XP/pièces/série, tier/récompense monotone), schéma de référence `supabase/portfolio-migrations/`. Constat : aucune table `ziko_*quest*` n'existe ; le tableau codé en dur a déjà été supprimé par P12 (état vide honnête B13).

## Décisions verrouillées (issues des contrats)
- **D-01** L'onglet Quêtes lit la base (aucun tableau en dur, aucun repli factice : erreur réseau = carte d'erreur B05, REWD-10).
- **D-02** Maquette B12/B13 : sections « Aujourd'hui · se renouvelle dans N h » et « Cette semaine » ; carte avec icône, titre, pièces (puce or), barre 6 px, valeur « 1,3 / 2 L » pour les quêtes mesurées ; quête terminée = coche verte + « Terminé · +N pièces récupérées » ; vide = « Pas de quête active ».
- **D-03** Bouton plein = `getActionPrimary(theme)` (#CF4509), texte blanc (décision orchestrateur, comme P12 Q1). Aucun bouton plein n'est requis par B12 ; « Réessayer » de la carte d'erreur réutilise `PrimaryButton`.
- **D-04** Règle non punitive v1.18 : une quête non terminée à l'échéance passe `expired` ; **aucune** pénalité (XP, pièces, série). Le libellé est neutre (« Non terminée »), jamais « échec ». Les pièces d'une quête terminée ne sont jamais reprises.
- **D-05** Écritures client interdites : `ziko_user_quests` et `ziko_quest_templates` en SELECT seul pour `authenticated` ; toutes les écritures passent par des fonctions SECURITY DEFINER (`search_path` figé, REVOKE PUBLIC/anon, `p_user_id = auth.uid()` ou `service_role`).
- **D-06** Migrations : fichiers seuls, bloc `2026120113NN_*.sql`, jamais appliquées, jamais d'édition d'une migration existante.

## Décisions de conception
- **D-07 Deux tables.** `ziko_quest_templates` (catalogue : quêtes de départ + base pour d'autres) et `ziko_user_quests` (instances par utilisateur et par période, copie figée du titre/cible/récompense : une modification du catalogue ne change pas une quête en cours). Les colonnes `source` (`starter`|`ai`), `template_id` nullable et `ai_meta jsonb` accueillent les quêtes créées par l'outil IA de P14 sans autre migration.
- **D-08 Progression = calculée, pas inventée.** `ziko_quest_metric_value(user, metric, from, to)` lit les tables réelles. Métriques P13 (liste blanche, CHECK) : `workout_sessions` (séances avec ≥ 1 série, même règle que les succès P12 / P6 D-02), `hydration_ml` (somme `ziko_hydration_logs.amount_ml`), `nutrition_logs` (lignes `ziko_nutrition_logs`), `habit_logs` (lignes `ziko_habit_logs`). P14 étend la liste blanche par migration.
- **D-09 Synchronisation à la demande.** `ziko_sync_quests(p_user_id)` : (1) expire les quêtes actives échues, (2) crée les quêtes de départ de la période courante manquantes (idempotent, `UNIQUE(user_id, slug, period_start)`), (3) recalcule la progression des quêtes actives, (4) termine et récompense (une seule fois, `rewarded_at`) celles qui atteignent la cible, (5) renvoie `{quests, newly_completed}`. Appelée à l'ouverture de l'onglet Quêtes, au focus, et en fin de séance (`awardWorkoutXP`, best effort). Pas de cron : la progression est exacte au moment où l'utilisateur regarde (R-4 « évolue quand l'utilisateur fait l'action réelle »).
- **D-10 Récompense en pièces** via `ziko_award_coins` (source `quest`, description « Quête : <titre> »). La contrainte `ziko_coin_transactions_source_check` est recréée avec toutes les sources connues + `quest` (reprend `achievement` de P12 ; la migration 1301 passe après 1201). Historique P12 : libellé de source `quest` ajouté (« Quête »).
- **D-11 API réservée à P14** : `ziko_create_quests(p_user_id, p_quests jsonb)` réservée à `service_role` (backend), valide métrique (liste blanche), cible > 0, récompense bornée, durée 1 h..35 j, source `ai`. **Ne plafonne pas à 3** : le plafond « 3 actives » (QUEST-05) et le déclenchement (niveau/aucune quête) appartiennent à P14. Contrat de lecture figé : P14 lit `ziko_user_quests` (colonnes ci-dessus) et peut appeler `ziko_sync_quests` pour recalculer.

## Gray areas
- **G-1 Fuseau des périodes** : jour/semaine bornés à minuit **Europe/Paris** (région par défaut FR, « se renouvelle dans 6 h » de la maquette). Semaine = lundi 00:00 → lundi suivant. **[A CONFIRMER]** (alternative : fuseau du téléphone, nécessite de le stocker ; non retenue, hors périmètre).
- **G-2 Quêtes de départ** : exactement les 3 de la maquette, identiques pour tous : « Terminer une séance » (jour, 1 séance, 25 pièces), « Boire 2 litres d'eau » (jour, 2000 ml, 15), « S'entraîner 3 fois » (semaine, 3 séances, 60). Elles tiennent dans le plafond de 3 actives de P14. **[A CONFIRMER]** (montants des pièces).
- **G-3 Cible d'eau fixe 2 L** (identique pour tous, QUEST-02) plutôt que l'objectif personnel de P11. **[A CONFIRMER]**
- **G-4 Renouvellement des quêtes de départ** : à chaque nouvelle période (jour/semaine) tant qu'elles sont actives au catalogue (`is_starter`). Une quête terminée reste affichée jusqu'à la fin de sa période. **[A CONFIRMER]** (alternative : quêtes de départ uniques ; non retenue car l'onglet serait vide dès le 2e jour avant P14).
- **G-5 Quête expirée** : conservée en base avec statut `expired`, renvoyée à l'app (rendu neutre « Non terminée », hors compteur) ; la réconciliation complète QUEST-07 reste à trancher en discuss P14. Les quêtes de départ expirées sont remplacées d'office par la période suivante.
- **G-6 Données antérieures à la création de la quête** : comptées (progression = données réelles de la période, pas depuis la création de la ligne). Un utilisateur qui a déjà bu 1,3 L avant d'ouvrir l'onglet voit 1,3 / 2 L.
- **G-7 Date d'hydratation** : `ziko_hydration_logs.date` est une date calendaire écrite par le client ; on la compare à la date Paris de la période (pas à `created_at`).

## Hors périmètre
Outil IA, plafond de 3, création au niveau supérieur, refus interdit/UI de durée limite détaillée (P14) ; notifications ; edit de `workout/session.tsx`, des écrans P11/P3 (les écrans qui journalisent l'eau n'ont pas à être modifiés : la sync lit les tables).
