# Phase 16 - IA des mesures et onboarding objectifs : CONTEXT

Exigences : MEAS-02, MEAS-03, MEAS-07, MEAS-08, MEAS-09 (le ROADMAP ne cite que ces 5 ; MEAS-10/11 n'existent pas dans REQUIREMENTS.md, voir G-8).
Base : `milestone/v1.20` (P14 + P15 mergees). Migrations : bloc `202612011601..1609`, fichiers seuls.

## Decisions verrouillees (heritees)
- D-01 (P15) : objectifs de mesures = `ziko_athlete_goals` etendue (`measure_key` non nul). Verrou D-04 : un objectif actif ne change pas, sauf `set_config('ziko.allow_goal_edit','on',true)` dans une RPC SECURITY DEFINER.
- Credits : appel declenche par l'utilisateur = `creditCheck/creditDeduct` de la route (chat) ; appel automatique = absorbe, plafond/jour, journal `ziko_ai_cost_log`. Onboarding = deja non credite et journalise (`onboarding_assess`).
- Patron P14 : outil = fine fonction dans `tools/`, logique pure dans un dossier de service testable, enregistrement additif dans `registry.ts`.
- Bouton plein = `getActionPrimary(theme)`.
- P14 : `ziko_sync_quests` est redefinie par 1402 ; cette phase ne la redefinit PAS (elle appelle `ziko_quest_metric_value`, redefinie ici depuis 1302).

## Decisions de cette phase
- **D-01 Un seul outil de gestion `measurements_goals`** (actions `list`, `create`, `revise`, `quest`), en plus des 3 outils `measurements_*` existants. `create` / `revise` ne passent PAS par `auth.uid()` (le backend utilise la cle service) : 2 RPC `service_role` seules, `ziko_ai_create_measurement_goal` et `ziko_ai_revise_measurement_goal`, qui reprennent les validations de `ziko_create_measurement_goal` (P15, non modifiee).
- **D-02 Modification encadree, appliquee en base ET cote service.** 4 motifs et seulement ceux-la : `stagnation`, `pace`, `injury_pause`, `main_goal_change`. Regles pures (`backend/api/src/measurements/rules.ts`), verifiees par le service avant l'appel RPC, puis revalides par la RPC (motif dans la liste, intervalle minimal) :
  - `stagnation` : objectif actif depuis >= 28 jours ET mesures sur >= 28 jours ET progression vers la cible sur la fenetre < 5 % de la distance depart-cible ;
  - `pace` : trop rapide = (poids) > 1 % du poids de depart par semaine sur >= 14 jours, ou >= 50 % de la distance en < 25 % de la duree prevue ; trop lent = date cible depassee a >= 50 % de la duree avec < 20 % de progression ;
  - `injury_pause` / `main_goal_change` : declaratifs, exigent `user_statement` (la phrase de l'utilisateur) ; non verifiables par le serveur (G-3) ;
  - toute modification : pas de changement de sens (depart -> cible) sauf `main_goal_change`, cible dans la plage de la mesure, 1 modification max par objectif tous les 14 jours (RPC), depart jamais modifie.
- **D-03 Transparence (MEAS-08) en 3 couches** : (1) le resultat de l'outil impose au modele d'annoncer la modification et sa raison dans sa reponse ; (2) table `ziko_goal_revisions` (historique : ancienne/nouvelle cible et date, motif, detail, `acknowledged_at`) en lecture seule client + RPC `ziko_ack_goal_revision` ; (3) bandeau dans l'onglet Objectifs ("Objectif ajuste par Ziko : <raison>", bouton `Compris`) tant que non acquitte.
- **D-04 Onboarding (MEAS-02)** : la conversation Ziko existante (`/ai/onboarding/stream`) recoit un second outil `set_measure_goal` (ecrit par `ziko_ai_create_measurement_goal`) ; le prompt ajoute une phase "objectifs" (1 a 2 objectifs de mesure, propose puis confirme par l'utilisateur) AVANT `assess_profile`. Un evenement SSE `goal` fait apparaitre une carte dans le chat. `ONBOARDING_MAX_STEPS` passe de 8 a 10 (cout absorbe, deja journalise).
- **D-05 Couplage quetes (MEAS-09)** : nouvelle metrique de quete `measurement_logs` (nombre de saisies de mesures dans la periode) ; l'action `quest` de l'outil cree UNE quete liee a un objectif actif (`ai_meta = {goal_id, measure_key}`), via `createQuestFromChat` donc sous le plafond de 3 actives et la duree limite de P14. Migration : CHECK de `ziko_user_quests`, `ziko_quest_metric_value` et `ziko_create_quests` (whitelist) redefinies depuis 1302 ; l'enum de `quests_create` s'etend (additif).
- **D-06 Credits** : `revise`/`create`/`quest` depuis le chat = couverts par le gate du chat (pas de double debit, aucun appel modele supplementaire). Pas de declenchement automatique de revision (l'IA ne revise que dans une conversation ouverte par l'utilisateur) : aucun cout autonome nouveau hors onboarding.

## Gray areas (reco marquee [A CONFIRMER])
- **G-1 [A CONFIRMER]** RPC service_role dediees plutot que `ziko_create_measurement_goal` (qui exige `auth.uid()`, nul avec la cle service). Reco : oui (retenu). Alternative : appeler la RPC P15 avec le jeton utilisateur (demande de changer `clientForUser`, partage).
- **G-2 [A CONFIRMER]** Seuils (28 j, 5 %, 1 %/semaine, 14 j de delai entre revisions). Reco : retenus tels quels, centralises en constantes.
- **G-3 [A CONFIRMER]** `injury_pause` et `main_goal_change` non verifiables : on exige la citation de l'utilisateur et on journalise. Reco : oui. Pas d'etat "en pause" (le CHECK de `status` n'est pas touche) : une blessure repousse date/cible.
- **G-4 [A CONFIRMER]** Pas de maquette pour la carte d'objectif dans le chat d'onboarding ni pour le bandeau de revision. Reco : reutiliser les patrons existants (carte mission, carte E11), a valider visuellement en UAT.
- **G-5** Mesure d'un `pace` "trop rapide" generalisee : seul le poids a un seuil absolu ; les autres mesures utilisent le critere ">= 50 % en < 25 % du temps" (exige une date cible).
- **G-6** Mesure absente de la derniere ligne : `current_value` nul, aucune revision `stagnation/pace` possible (refus explicite plutot qu'une valeur inventee).
- **G-7** Un objectif cree par `create_goal` (sans `measure_key`) n'est jamais touche par ces outils.
- **G-8** MEAS-10/MEAS-11 absents de REQUIREMENTS : aucun travail ajoute ; a clarifier par l'orchestrateur.
