# Roadmap: Ziko Platform — v1.21 Activation du nouvel inscrit

**Workstream:** `activation-inscrit` · **Granularity:** standard · **Phases:** 3 (numbered from 1, workstream-scoped)
**Coverage:** 21/21 requirements mapped, 0 orphans

## Overview

Un compte neuf doit savoir quoi faire dès l'accueil. Le milestone se découpe en trois phases : (1) les quêtes existent et sont utilisables dès l'inscription, avec un bloc Quêtes sur l'accueil ; (2) un chemin clair vers le premier entraînement (carte à 3 chemins) et un parcours sans fausses promesses ; (3) l'UAT par Claude sur émulateur, avec un compte neuf, de l'inscription à la première séance lancée.

## Règles transverses (s'appliquent à toutes les phases)

- **Démarrage conditionné** : l'exécution du milestone commence après l'envoi TestFlight des 4 correctifs de la branche `fix/testflight-4-bugs`. Les maquettes (`/gsd-ui-phase`) peuvent se préparer avant, pas le plan ni l'exécution.
- **UI-design-first** : toute phase marquée `UI hint: yes` exige `/gsd-ui-phase` (UI-SPEC issue d'une maquette Claude Design) AVANT `/gsd-plan-phase` et `/gsd-execute-phase`. Rendu exact de la maquette ; la maquette gagne sur toute divergence.
- **UAT par Claude** sur émulateur Android (harness v1.20), avec captures comme preuves. Jamais par l'utilisateur.
- **Charte** : thème clair, tokens Ziko, Ionicons (jamais d'emoji), inline styles, `showAlert` (jamais `Alert`), `paddingBottom: 100`, tables `ziko_` sur le projet Supabase `portfolio`.
- **Migrations** : nouvelles migrations uniquement, jamais d'édition d'une migration existante.
- **Philosophie non punitive** : aucune quête « échouée » visible. Économie de crédits IA inchangée.

## Phases

- [ ] **Phase 1: Quêtes dès l'inscription** - Quêtes actives dès l'arrivée, bloc Quêtes sur l'accueil, première mission cohérente au niveau 1
- [ ] **Phase 2: Premier entraînement & parcours clarifié** - Carte « Crée ton premier entraînement » à 3 chemins, bouton Entraînement et fin d'onboarding honnêtes
- [ ] **Phase 3: UAT compte neuf** - Claude valide le parcours complet sur émulateur avec un compte neuf

## Dépendances et ordre

| Phase | Dépend de | Raison |
|-------|-----------|--------|
| 1 | Envoi TestFlight des 4 correctifs | Règle transverse |
| 2 | Phase 1 (exécution) | Les deux phases modifient l'accueil (`apps/mobile/app/(app)/index.tsx`, `useHomeData`) ; la carte Phase 2 s'insère au-dessus du bloc Quêtes. Les maquettes des deux phases peuvent être produites en parallèle |
| 3 | Phases 1 et 2 | Valide le parcours bout en bout |

## Migrations par phase

| Phase | Migration | Note |
|-------|-----------|------|
| 1 | Oui, probable | Création des quêtes à l'inscription (ex. déplacer/rendre idempotent `ziko_sync_quests`, contrainte anti-doublon). Nouveau fichier uniquement ; à confirmer au `/gsd-plan-phase` |
| 2 | Non | UI et navigation seulement |
| 3 | Non | Vérification uniquement |

## Phase Details

### Phase 1: Quêtes dès l'inscription
**Goal**: Un compte neuf arrive sur l'accueil avec ses quêtes actives, comprend quoi faire pour chacune et n'est jamais renvoyé vers un écran verrouillé.
**Depends on**: Envoi TestFlight des 4 correctifs (`fix/testflight-4-bugs`)
**Requirements**: QNEW-01, QNEW-02, QNEW-03, QNEW-04, QNEW-05, QNEW-06, QNEW-07, CLAR-03, CLAR-04
**Success Criteria** (what must be TRUE):
  1. Un compte tout juste créé voit au plus 3 quêtes actives sur l'accueil dès son arrivée, sans avoir ouvert l'écran Récompenses, et un second chargement ne crée aucun doublon.
  2. Chaque quête affichée montre son titre, sa progression, son état de complétion et l'action à faire ; un tap mène directement à l'écran concerné, jamais à un écran verrouillé au niveau 1.
  3. Une quête complétée passe à l'état complété sur l'accueil sans relancer l'app, et aucune quête « échouée » n'apparaît.
  4. La première mission assignée à un compte de niveau 1 est l'hydratation, et son bouton ouvre la mission sans être renvoyé à l'accueil par le garde de route.
**Plans**: TBD
**UI hint**: yes — `/gsd-ui-phase` (UI-SPEC depuis une maquette Claude Design, rendu exact) avant plan et exécution
**Migration**: probable (voir tableau)
**Placement de CLAR-03 et CLAR-04** : ils sont ici et non en Phase 2 car ils partagent la même dépendance que les quêtes de niveau 1. CLAR-03 (backend, assignation de la première mission à l'hydratation) relève de la même règle « rien ne mène à un écran verrouillé au niveau 1 » que QNEW-05, et la mission du jour fait partie du contenu d'accueil que cette phase fiabilise. CLAR-04 (garde de route) est le même mécanisme qui bloquerait le tap d'une quête (QNEW-04) ; le corriger ici évite de livrer des quêtes dont le tap est renvoyé à l'accueil.

### Phase 2: Premier entraînement & parcours clarifié
**Goal**: Un compte sans programme ni séance sait immédiatement comment créer son premier entraînement, et rien dans le parcours ne promet ce qui n'existe pas.
**Depends on**: Phase 1 (exécution sur l'accueil ; maquette possible en parallèle)
**Requirements**: FWKO-01, FWKO-02, FWKO-03, FWKO-04, FWKO-05, FWKO-06, FWKO-07, CLAR-01, CLAR-02
**Success Criteria** (what must be TRUE):
  1. Un compte sans programme ni séance voit « Crée ton premier entraînement » en toute première carte de l'accueil, avec 3 chemins (Manuel, IA simple, Atelier IA), chacun avec une phrase d'explication et le coût en crédits pour les deux IA.
  2. Manuel ouvre l'assistant en 4 étapes, IA simple ouvre l'assistant de séance unique, Atelier IA ouvre l'atelier conversationnel.
  3. La carte disparaît dès qu'un programme est actif ou qu'une séance est terminée, et cohabite avec la carte Mission du jour tant qu'elle est affichée.
  4. Crédits épuisés : les chemins IA l'indiquent avant l'ouverture et Manuel reste proposé.
  5. Le bouton de l'onglet Entraînement dit s'il crée une séance unique ou un programme et mène au bon écran ; la fin de l'onboarding ne promet plus de programme ni de « première séance demain matin ».
**Plans**: TBD
**UI hint**: yes — `/gsd-ui-phase` (UI-SPEC depuis une maquette Claude Design, rendu exact) avant plan et exécution
**Migration**: non

### Phase 3: UAT compte neuf
**Goal**: Claude prouve, captures à l'appui, qu'un compte neuf va de l'inscription à une séance lancée sans blocage.
**Depends on**: Phase 1, Phase 2
**Requirements**: UATN-01, UATN-02, UATN-03
**Success Criteria** (what must be TRUE):
  1. Un flow Maestro sur l'émulateur Android parcourt inscription, onboarding, 1re conversation et arrivée sur l'accueil, avec captures conservées comme preuves.
  2. Sur ce compte neuf, les quêtes sont visibles sur l'accueil et au moins une est complétée depuis son action, avec mise à jour visible.
  3. Chacun des 3 chemins (Manuel, IA simple, Atelier IA) aboutit à une séance lancée, les chemins IA étant testés avec un faux Anthropic.
  4. Le rapport UAT de la phase liste les captures et tout écart ; les écarts bloquants sont corrigés ou rouverts en phase décimale.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Quêtes dès l'inscription | 0/? | Not started | - |
| 2. Premier entraînement & parcours clarifié | 0/? | Not started | - |
| 3. UAT compte neuf | 0/? | Not started | - |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QNEW-01..07 | Phase 1 | Pending |
| CLAR-03, CLAR-04 | Phase 1 | Pending |
| FWKO-01..07 | Phase 2 | Pending |
| CLAR-01, CLAR-02 | Phase 2 | Pending |
| UATN-01..03 | Phase 3 | Pending |

**Coverage:** 21/21 (Phase 1: 9, Phase 2: 9, Phase 3: 3)
