# Phase 26 : Factions & Ligues (SEED-001), SUMMARY

Branche `phase/26-factions` (base `milestone/v1.20`, merge de `milestone/v1.20` fait sans conflit, gate refaite après merge). Aucun push, aucune écriture prod, aucun appel IA réel ; migrations = fichiers non appliqués. Docs : `26-CONTEXT.md` (décisions D-01..D-16, gray areas `[A CONFIRMER]` G-01..G-07), `26-UI-SPEC.md` (critères mesurables, pas de HTML), `UAT-PLAN.md` (LG-1..LG-25, faux Anthropic).

## Tranche livrée (et non livrée)
**Livré** : factions par sport (5 de la taxonomie v1.8 + `wellness`), deux pistes étanches (Habitudes / Performance), score de régularité relative calculé en base, paliers amortis (5 paliers, plancher `max(départ, pic-1)`), déblocage au tier 3, transition Habitudes -> Performance décidée par l'IA seule (appel absorbé, 1/jour, journalisé `league_transition`) + célébration unique, garde-fous (anti-triche, mineurs, santé), défi collectif coach + athlètes.
**Différé (explicite)** : classement entre joueurs (cohortes), saisons/battle pass, cosmétiques/loot/mascotte, défis collectifs entre amis (hors coach), écran **web** de création de défi par le coach (backend + RPC faits, pas d'écran), pastille de faction sur le profil public (P21), blocage/signalement, notification push de la transition, retour Performance -> Habitudes, trace de la transition dans `athlete_decisions` (G-05), défis de groupe visibles quand la Ligue est verrouillée (le plugin community exige déjà le niveau 3).

## Livrables
- **Migrations (fichiers seuls, idempotentes, rejouées 2 fois en local)** : `20261201260100_factions_leagues_schema` (6 tables + seeds, RLS SELECT-seul, aucune écriture client), `…2602_faction_rpc`, `…2603_league_sync` (score, clôture des semaines, paliers, acquittement), `…2604_league_ai_gate` (pré-filtre, réservation plafonnée, application), `…2605_collective_challenges`. `check-migration-names` OK (38).
- **Backend** : `backend/api/src/league/{rules,service}.ts`, `routes/league.ts` (`POST /league/refresh`, `POST /league/collective`), `app.ts` (+1 route), `lib/autonomousCost.ts` (+ source `league_transition`).
- **Mobile** : `plugins/community/src/league/{rules,api}.ts` + `cards.tsx` (cartes présentationnelles), `screens/LeagueScreen.tsx`, carte d'entrée dans le Fil (`CommunityPlugin.tsx`), route `(plugins)/community/league.tsx`, manifest/exports, `vitest.config.ts` (+ `plugins/community`).
- **Harnais SQL** `scripts/uat/p26-league-sql/` (Postgres 18 local jetable, port 8206, arrêté ensuite ; `P26_PG_URL` absent = SKIP, URL non locale refusée).

## Exigences
| Id | Statut | Preuve / limite |
|---|---|---|
| LEAG-01 factions | VERIFIED (SQL local + rendu DOM) | 6 factions, 1 par personne, suggestion par objectif (pure, testée), délai de changement 30 j, compteur masqué sous 10 adultes (mineurs et âges inconnus exclus). Rendu natif non vu |
| LEAG-02 deux pistes étanches | VERIFIED (SQL local + rendu DOM) | chaque semaine porte sa piste ; historique compté PAR piste ; aucune agrégation inter-pistes ni classement (scan statique + écran n'affiche qu'une piste). Piste de départ lue de `onboarding_profile.experience_level` |
| LEAG-03 transition IA + célébration | VERIFIED (mock + SQL) ; PARTIAL bout en bout | pré-filtre SQL (4 sem. consécutives, moyenne >= 70, tier >= 3, 28 j), plafond 1/jour, hallucination refusée par la base, échec modèle = reste en habitudes, coût journalisé même en échec, célébration unique (acquittement), 1 seul bouton `Continuer`. Qualité de la décision du vrai modèle NON prouvée |
| LEAG-04 garde-fous | VERIFIED (SQL local) | score relatif plafonné 100 ; +1 après 2 semaines pleines (>= 80) ; -1 après 3 basses (< 30) ; plancher `max(départ, pic-1)` ; semaine moyenne remet à zéro ; absence longue = non scorée (jamais punie) ; **XP/pièces/série/tier/journal strictement inchangés après une descente** ; déblocage au tier 3 |
| LEAG-05 défi collectif | VERIFIED (SQL local + mock) ; PARTIAL côté UI | création coach (rôle, liens actifs, 3 défis actifs max, bornes), accepter/quitter, total de groupe + MA contribution, plafonds par jour (1 séance, 10 habitudes, 4000 ml), pas de rattrapage rétroactif, aucune contribution d'un autre renvoyée, RLS simple sans récursion. Écran coach (web) non fait |
| LEAG-06 lecture de l'état athlète | VERIFIED | lit `ziko_athlete_state` (tier, readiness, onboarding_profile, current_focus_detail) ; aucune table/écriture de niveau ; scan statique : aucune migration P26 n'écrit dans `ziko_user_gamification`, `coin_transactions`, `athlete_state`, `athlete_decisions` |

## Garde-fous : preuves
- **Anti-triche** : tables en SELECT seul (INSERT/UPDATE directs refusés, testés), score calculé serveur ; séance valide = terminée, >= 10 min, >= 3 séries validées, 1 jour-séance par jour ; habitude `value >= 1`, pas de date future ; clôture idempotente (PK), arriéré <= 8 semaines ; plafonds de contribution.
- **Mineurs** : jamais comptés ni listés dans les factions ; aucune surface ne liste de personnes ; un mineur n'est invité à un défi que par un lien coach actif existant.
- **Santé** : le score n'utilise que des comptages ; la preuve envoyée au modèle est une liste blanche reconstruite côté backend (test : aucune clé parasite ne passe) ; la raison du modèle est écartée si elle évoque corps/santé (repli neutre) ; aucune table de santé n'est lue par les migrations (scan).
- **Coût IA** : appel seulement si le pré-filtre SQL passe puis 1/jour/personne ; absorbé (0 `creditCheck/Deduct`, testé) ; `ziko_ai_cost_log.source = 'league_transition'`.

## Tests (comptes)
- **Harnais SQL P26 : 114 PASS / 0 FAIL** (droits, factions, déblocage, score/anti-triche, paliers, non-punitif, porte IA, célébration, défis, scans statiques).
- Backend vitest : **40 fichiers / 519 tests verts** (3 skipped, 14 todo préexistants, 8 fichiers distants exclus) dont nouveaux : `league/rules.test.ts`, `league/service.test.ts`, `routes/league.test.ts` (53). `tsc --noEmit` : `backend/api`, `apps/mobile`, `plugins/community` = 0 erreur.
- Vitest racine : **54 fichiers / 917 tests verts** (dont `plugins/community/src/league/rules.test.ts` : 32). Rendu mobile : **9 fichiers / 80 verts** (dont `league.test.tsx` : 18). `check-migration-names` OK.
- Aucun test existant modifié (sauf `vitest.config.ts` : + `plugins/community/src/**/*.test.ts` dans `include`).

## Déviations / choix à noter
1. Transition tracée dans `ziko_league_transitions` et NON dans `athlete_decisions` (CHECK `decision_type` fermé) : G-05.
2. Pas de HTML/Playwright (RAM) ; UI-SPEC en critères mesurables.
3. Fonctions de score/palier **en SQL uniquement** (pas de double implémentation TS) : le mobile ne recalcule jamais ; la contrepartie est que la correction de ces règles n'est prouvée que sur Postgres local + stub.
4. `ziko_league_sync` est appelable par la personne (RPC directe depuis l'app) et par service_role ; elle écrit l'état de ligue de la personne à l'ouverture (clôture paresseuse, pas de cron).
5. Écran en `Modal` pour la célébration (spec : modale pleine page).
6. 6e faction `wellness` = ajout (G-01) ; seuils 80/30, 2/3 semaines, pré-filtre 4 sem./70 : à confirmer (G-02..G-04).

## NON prouvé
- **Les migrations sur la base portfolio/branche réelle** : testées uniquement sur Postgres 18 local avec un **stub** du schéma (colonnes recopiées de `portfolio_ziko_schema.sql`) ; `auth.uid()`/`auth.role()` simulés par `set_config` ; grants par défaut Supabase, données existantes, `ziko_habits`/`ziko_session_sets` réels (colonnes supposées d'après le schéma de référence et `user.ts`) non vérifiés ; `ziko_athlete_state.current_focus_detail` : clés `focus_type`/`target_metric`/`target_value` lues dans `types.ts`, jamais vues dans une vraie ligne (sinon cible par défaut 3).
- Que le vrai modèle décide bien/mal une transition, respecte la consigne de ton, ne cite pas de santé (garde en code, jamais éprouvée contre le vrai modèle).
- Le rendu natif de `LeagueScreen` (l'écran complet n'est pas monté en test : seules les cartes et la logique pure le sont ; câblage vérifié par type-check) : contrastes, tailles tactiles, `Modal`, animation, `RefreshControl`, hors-ligne réel, bandeaux.
- Que les semaines sans activité d'une personne tricheuse déterminée ne puissent pas être gonflées par de fausses habitudes/séances (limite assumée : plafond + relativité, gain = palier cosmétique).
- Le contrat réel de `POST /league/refresh` contre une vraie base (service mocké) ; le fuseau Europe/Paris sur appareil ; la concurrence de deux `ziko_league_sync` simultanés (verrou consultatif écrit, non éprouvé en parallèle) ; spec RLS distant (`backend/api/test/rls`) **non écrit** pour la Ligue (le harnais SQL local le remplace).
- Pas de test sur émulateur (file UAT, `UAT-PLAN.md` prêt).

## Besoins humains
Approbation + application de 2601 -> 2605 sur la branche jetable (après 2503 de P25) ; confirmer G-01..G-07 de `26-CONTEXT.md` (surtout `wellness`, seuils, `hydration_ml` en défi, trace dans `athlete_decisions`) ; UAT LG-1..LG-25 ; décider d'un écran web coach pour créer un défi (sinon l'API `POST /league/collective` seule) ; 1 appel Anthropic réel optionnel ; vérifier en lecture seule en prod que `ziko_habits.is_active` et `ziko_session_sets.completed` existent avant application.

## Fichiers à risque de conflit
`plugins/community/src/screens/CommunityPlugin.tsx` (import + 1 requête + 1 carte en tête du Fil : P21 touche `FriendsScreen`, pas ce fichier), `plugins/community/src/manifest.ts` et `package.json` et `src/index.ts` (ajouts additifs), `vitest.config.ts` (`include`, 1 ligne : conflit trivial avec toute autre phase qui y ajoute un plugin), `backend/api/src/app.ts` (import + 1 route), `backend/api/src/lib/autonomousCost.ts` (1 ligne `SOURCES`).
