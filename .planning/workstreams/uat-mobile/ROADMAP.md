# Roadmap: Ziko Platform — v1.20 UAT Mobile (Refonte & corrections)

**Workstream:** `uat-mobile` · **Granularity:** standard · **Phases:** 26 (numbered from 1, workstream-scoped)
**Coverage:** 134/134 requirements mapped, 0 orphans
**Execution:** `/orchestrate-milestone`, maximum parallelization (one git worktree per phase)

## Overview

Ce milestone transforme la revue UAT mobile (~35 captures) en 26 phases. Un harness UAT Android (émulateur + Maestro) est construit en vague 0 pour que Claude valide lui-même chaque phase. Les phases indépendantes (modules plugin) tournent en parallèle ; les phases d'outils IA (quêtes, mesures, atelier) s'enchaînent car elles partagent le registre d'outils et le système de crédits ; les deux seeds (Mon coach complet, Factions & Ligues) sont les phases finales.

## Règles transverses (s'appliquent à toutes les phases)

- **UAT = Claude, sur émulateur Android.** Chaque critère de succès est vérifié par Claude via flows Maestro/adb sur l'AVD, avec captures d'écran et logs conservés comme preuves dans le `VERIFICATION`/`UAT` de la phase (HARN-04). Jamais par l'utilisateur. Les UAT passent en file sur 1-2 émulateurs (16 Go RAM) ; le dev, les migrations et les maquettes restent parallèles.
- **UI-SPEC obligatoire** : toute phase marquée `UI hint: yes` exige `/gsd-ui-phase` (skills `impeccable` + design) AVANT `/gsd-plan-phase` et `/gsd-execute-phase`. Les maquettes canoniques sont celles de la Phase 4 (DSGN-01) ; la maquette gagne sur toute divergence (rendu exact).
- **Charte** : thème clair, tokens Ziko, Ionicons (jamais d'emoji), inline styles, `showAlert` (jamais `Alert`), `paddingBottom: 100`, tables `ziko_` sur le projet Supabase `portfolio`.
- **Migrations** : nouvelles migrations uniquement, jamais d'édition d'une migration existante. Convention anti-collision (à figer en Phase 1, HARN-07) : `20261201PPSS_description.sql`, où `PP` = numéro de phase sur 2 chiffres et `SS` = séquence 01-09. Chaque phase listée "Migrations: oui" dispose ainsi d'un bloc réservé de 9 numéros ; aucune collision possible entre worktrees parallèles.

## Phases

- [ ] **Phase 1: Harness UAT Android** - Émulateur, Maestro, compte de test, preuves, file d'UAT, convention de migrations
- [ ] **Phase 2: Session & authentification robustes** - Refresh au premier plan, expiration détectée, plus de "Utilisateur non connecté"
- [ ] **Phase 3: Crash Habitudes & garde d'erreur modules** - Habitudes s'ouvre ; tout crash de module affiche un écran d'erreur avec retour
- [ ] **Phase 4: Maquettes de référence (DSGN)** - Maquettes impeccable validées pour les 11 surfaces visuelles
- [ ] **Phase 5: Corrections transverses** - Slugs, anglais, safe-area, bouton bug, marges d'onglets, noms d'exercices
- [ ] **Phase 6: Séance d'entraînement fiable** - Bons points d'entrée, séances vides ignorées, semaine type, détail depuis Récent
- [ ] **Phase 7: Programmes : liste, actif unique, menu** - Tous les programmes, un seul actif, assistant 4 étapes -> "Définir comme actif"
- [ ] **Phase 8: Accueil & Quick Log** - Eau cumulée, 1 poids / 1 humeur par jour persistants, tuile repas, carte score
- [ ] **Phase 9: Ajout de repas en un écran** - Écran unique, présélection, récap du jour, toutes méthodes
- [ ] **Phase 10: Pantry utile et en français** - Listes, ajout manuel/scan, recettes IA avec macros restantes, courses dynamiques
- [ ] **Phase 11: Hydratation : boutons et réglages** - Boutons redessinés, 4 réglages éditables, champ objectif au-dessus du clavier
- [ ] **Phase 12: Récompenses : Succès & Boutique** - Onglets, 11 succès réels attribués, boutique complète, historique, aperçu
- [ ] **Phase 13: Quêtes en base** - Quêtes persistées, progression réelle, quêtes de départ identiques
- [ ] **Phase 14: Outil IA de quêtes** - L'agent crée/gère les quêtes (max 3 actives, durée limite, échouées visibles)
- [ ] **Phase 15: Mesures & objectifs en base** - Objectifs persistés, nouvelles mesures, % de complétion, objectif non modifiable
- [ ] **Phase 16: IA des mesures & onboarding objectifs** - Outil IA mesures, objectifs à l'onboarding, modifications IA encadrées, couplage quêtes
- [ ] **Phase 17: Sommeil : saisie manuelle et données réelles** - Saisie, état vide, phases conditionnelles, source connectée prioritaire
- [ ] **Phase 18: Stretching complet** - Bibliothèque, exercices et routines perso, suivi, routine par défaut auto
- [ ] **Phase 19: Compléments : catalogue & comparateur** - 4 onglets, comparateur réaccessible, stack éditable, prix corrects
- [ ] **Phase 20: Timer : presets éditables** - CRUD de presets sur 3 onglets, preset test retiré
- [ ] **Phase 21: Social & Amis** - Ajout d'ami fiable, En attente reçues/envoyées, recherche live, profil public complet
- [ ] **Phase 22: Journal & écran Mon coach** - Journal enregistre, Ionicons d'humeur, profil du coach lié, header cohérent
- [ ] **Phase 23: Atelier IA de création de programme** - Conversation IA avec web, skills, contexte complet, édition live, crédits
- [ ] **Phase 24: Périodisation & relance automatique** - Suite de programmes, programme suivant selon résultats, atelier relancé en fin de programme
- [ ] **Phase 25: Mon coach complet (SEED-002)** - Audit, plugin 3 états, retrait de coach, programme prescrit
- [ ] **Phase 26: Factions & Ligues (SEED-001)** - Factions par sport, deux pistes de ligue, transition IA, garde-fous, défis collectifs

## Wave plan (orchestrate-milestone)

Une vague = ensemble de phases dont toutes les dépendances sont dans les vagues précédentes ; toutes les phases d'une vague s'exécutent en parallèle dans des worktrees séparés. La file d'UAT sur émulateur (Phase 1) sérialise uniquement les validations, pas le développement.

| Wave | Phases (parallèles) | Attend |
|------|---------------------|--------|
| 0 | P1 Harness · P2 Session · P3 Habitudes · P4 Maquettes (DSGN, travail de design par lots, livrés progressivement) | rien |
| 1 | P5 Transverses · P6 Séance · P8 Quick Log · P11 Hydratation · P15 Mesures (base) | P1 pour UAT ; P2/P3 non bloquants ; P11 et P15 font leur propre `/gsd-ui-phase` (hors liste DSGN) |
| 2 | P7 Programmes · P9 Repas · P10 Pantry · P12 Récompenses · P17 Sommeil · P18 Stretching · P19 Compléments · P20 Timer · P21 Social · P22 Journal+Coach | P4 (lot de maquettes correspondant) ; P6 pour P7/P18 ; P8 pour P9/P17 ; P2 pour P21/P22 |
| 3 | P13 Quêtes en base · P23 Atelier IA | P12 (onglet Quêtes) pour P13 ; P4+P6+P7 pour P23 |
| 4 | P14 Outil IA quêtes · P24 Périodisation | P13 pour P14 ; P23 pour P24 |
| 5 | P16 IA mesures · P25 Mon coach complet (seed) | P14+P15 pour P16 ; P7+P22 pour P25 |
| 6 | P26 Factions & Ligues (seed) | P12+P14+P16+P21+P25 |

Règle de fusion : les phases d'une même vague touchent des fichiers disjoints (un plugin chacune) ; les points de contact partagés sont `backend/api/src/tools/registry.ts` (P14, P16, P23) et `plugins/gamification` (P12, P13, P14) — résolus par l'ordre des vagues, plus des merges de registre sans conflit sémantique.

### Migrations par phase (numéros pré-alloués : `20261201PPSS_*`)

| Phase | Migrations | Bloc réservé |
|-------|-----------|--------------|
| P1 | non (seed du compte de test via script, hors migrations) | - |
| P2, P3, P4, P5, P6, P22 | non | - |
| P7 | oui (programme actif unique, règle IA/coach) | 20261201 0701-0709 |
| P8 | oui probable (statut quotidien poids/humeur) | 20261201 0801-0809 |
| P9 | non (réutilise logs repas) sauf préférence "dernière méthode" | 20261201 0901-0909 (réservé) |
| P10 | oui (articles pantry, courses) | 20261201 1001-1009 |
| P11 | oui (réglages hydratation) | 20261201 1101-1109 |
| P12 | oui (attribution succès, historique gains) | 20261201 1201-1209 |
| P13 | oui (tables quêtes) | 20261201 1301-1309 |
| P14 | oui (état échouée, expiration, métadonnées IA) | 20261201 1401-1409 |
| P15 | oui (extension `ziko_athlete_goals` ou table de mesures) | 20261201 1501-1509 |
| P16 | oui (historique de modification d'objectifs) | 20261201 1601-1609 |
| P17 | oui (saisie manuelle, réglages sommeil) | 20261201 1701-1709 |
| P18 | oui (exercices/routines perso, routine par défaut) | 20261201 1801-1809 |
| P19 | oui (stack, rappels) | 20261201 1901-1909 |
| P20 | oui (presets timer) | 20261201 2001-2009 |
| P21 | oui probable (état des demandes d'amis) | 20261201 2101-2109 |
| P23 | oui (conversations/brouillons de programmes) | 20261201 2301-2309 |
| P24 | oui (suite ordonnée de programmes) | 20261201 2401-2409 |
| P25 | oui probable | 20261201 2501-2509 |
| P26 | oui (factions, ligues, défis) | 20261201 2601-2609 |

### Dépendances et recoupements IA (à respecter)

- **Chaîne d'outils IA** : P13 (stockage quêtes) -> P14 (outil quêtes) ; P15 (stockage objectifs) -> P16 (outil mesures, MEAS-09 alimente les quêtes donc après P14) ; P23 (outil atelier) -> P24. Tous s'appuient sur l'orchestrateur existant (`backend/api/src/tools/registry.ts`, `allToolSchemas`/`getToolExecutor`) et `creditGate` (`creditCheck`/`creditDeduct`, journal `ai_cost_log`).
- **Recoupement v1.18 phases 45/46 (récompenses paliers non punitives)** : l'exigence QUEST-07 ("échouée" visible, hors des 3 actives) doit être réconciliée avec la règle non punitive de v1.18. Décision à trancher en discuss-phase de P14 : une quête échouée est affichée neutre (information, pas de pénalité d'XP/pièces, pas de série brisée) et le libellé évite toute connotation punitive. P13/P14 doivent relire les phases 45/46 de v1.18 avant de planifier.
- **Politique des crédits** : tout appel IA nouveau (atelier, outils quêtes/mesures) passe par `creditCheck`/`creditDeduct` ; les appels de maintenance automatique (création de quêtes au passage de niveau, relance d'atelier) sont à classer en discuss-phase (déduction vs coût absorbé).

## Phase Details

### Phase 1: Harness UAT Android
**Goal**: Claude peut exécuter lui-même des UAT reproductibles sur un émulateur Android, avec preuves, sans jamais solliciter l'utilisateur.
**Depends on**: Nothing (first phase)
**Requirements**: HARN-01, HARN-02, HARN-03, HARN-04, HARN-05, HARN-06, HARN-07
**Wave**: 0
**Migrations**: non
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur Android avec captures):
  1. Une commande scriptée crée et démarre un AVD avec services Google, et l'app de dev s'y installe et se lance.
  2. Un flow Maestro de démonstration se connecte avec le compte de test (athlète + coach lié, identifiants hors repo), navigue et produit captures + logs archivés dans un dossier de preuves.
  3. Le jeu de données du compte de test est réinitialisable par un script et redonne le même état à chaque run.
  4. Claude peut simuler expiration de session, mise en arrière-plan, position GPS et caméra virtuelle (code-barres) ; une file d'UAT sérialise les runs sur 1-2 émulateurs.
  5. La convention de numérotation des migrations est documentée et appliquée (bloc réservé par phase).
**Plans**: TBD

### Phase 2: Session & authentification robustes
**Goal**: L'utilisateur ne reste jamais bloqué avec une session morte : l'app se rafraîchit ou le renvoie proprement vers la connexion.
**Depends on**: Phase 1 (pour la validation UAT ; le développement démarre en parallèle)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Wave**: 0
**Migrations**: non
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Après mise en arrière-plan prolongée puis retour, l'app fonctionne sans relance et les actions (Journal, logs, Amis) réussissent.
  2. Avec une session expirée simulée, l'app redirige vers la connexion sans fermeture manuelle.
  3. Aucune action ne montre "Utilisateur non connecté" tant que la session est valide.
  4. La cause racine de l'échec "Impossible d'envoyer la demande" (recherche globale) est documentée et corrigée (ou transmise à P21 avec diagnostic).
**Plans**: TBD

### Phase 3: Crash Habitudes & garde d'erreur modules
**Goal**: Le module Habitudes s'ouvre normalement et aucun module ne peut plus bloquer l'utilisateur sur un écran blanc.
**Depends on**: Phase 1 (validation UAT)
**Requirements**: HABT-01, HABT-02
**Wave**: 0
**Migrations**: non
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Accueil > "Tous mes outils" > Habitudes affiche le module stable (pas d'écran blanc après 0,5 s), à chaque ouverture.
  2. Une erreur de rendu forcée dans un module affiche un écran d'erreur avec bouton retour qui ramène à l'accueil.
**Plans**: TBD

### Phase 4: Maquettes de référence (DSGN)
**Goal**: Les maquettes validées existent pour toutes les surfaces visuelles clés avant leur implémentation.
**Depends on**: Nothing (design pur, parallèle à la vague 0)
**Requirements**: DSGN-01
**Wave**: 0 (livraison par lots : lot A programmes+atelier+repas ; lot B récompenses+pantry ; lot C stretching+compléments+timer+sommeil ; lot D profil public+amis)
**Migrations**: non
**Success Criteria** (what must be TRUE):
  1. Une maquette (skills `impeccable` + design, charte Ziko, Ionicons, thème clair) existe et est validée par l'utilisateur pour chacune des 11 surfaces : liste des programmes, atelier IA, ajout de repas, Récompenses (Succès/Boutique/Quêtes), Pantry, Stretching, Compléments (catalogue/comparateur), presets Timer, saisie de sommeil, profil public, Amis (En attente).
  2. Les questions ouvertes (rappels Compléments par moment de la journée, couleur du Journal) sont tranchées dans les maquettes.
  3. Chaque phase visuelle référence sa maquette canonique dans son UI-SPEC.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Corrections transverses
**Goal**: Les défauts d'affichage communs à tous les écrans (langue, safe-area, bouton bug, marges) disparaissent.
**Depends on**: Phase 1 (validation UAT)
**Requirements**: XCUT-01, XCUT-02, XCUT-03, XCUT-04, XCUT-05, XCUT-06, XCUT-07
**Wave**: 1
**Migrations**: non
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Aucun slug brut (`muscle_gain`, `fat_loss`) ni texte anglais ("End", "May") n'apparaît dans les écrans parcourus ; les noms d'exercices sont en français avec casse correcte.
  2. Aucun titre ne passe sous la barre de statut (accueil, assistant Coach IA, écrans scrollés).
  3. Le bouton bug flottant ne masque aucun bouton d'action (ex. "Repas") ; les barres d'onglets ont des marges latérales cohérentes.
  4. "Coach Ziko" n'apparaît plus deux fois de suite.
**Plans**: TBD

### Phase 6: Séance d'entraînement fiable
**Goal**: L'utilisateur démarre la séance prévue en un tap, et seules les séances réellement faites sont enregistrées.
**Depends on**: Phase 1 (validation UAT)
**Requirements**: TRAIN-01, TRAIN-02, TRAIN-03, TRAIN-04, TRAIN-05, TRAIN-10
**Wave**: 1
**Migrations**: non
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. "Allez, c'est parti !" et "Démarrer la séance d'aujourd'hui" ouvrent la séance prévue avec ses exercices (ex. Full Body Power, 8 exos), pas une séance rapide vide.
  2. Terminer une séance sans série validée ne l'enregistre pas et ne change ni le compteur de la semaine ni "Récent".
  3. La page programme affiche les séances sur les bons jours (plus de "Repos" partout).
  4. Toucher une séance dans "Récent" ouvre son détail et ses stats ; la séance rapide n'utilise que des Ionicons et des libellés français.
**Plans**: TBD

### Phase 7: Programmes : liste, actif unique, menu
**Goal**: L'utilisateur voit tous ses programmes, sait lequel est actif et gère le cycle de vie sans ambiguïté.
**Depends on**: Phase 4 (maquette liste), Phase 6
**Requirements**: TRAIN-06, TRAIN-07, TRAIN-08, TRAIN-09
**Wave**: 2
**Migrations**: oui (bloc 0701-0709)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. La liste affiche tous les programmes (IA, coach, créés) avec le statut actif clairement indiqué.
  2. Activer un programme en désactive automatiquement un autre ; un conflit programme IA / programme coach est résolu par une règle visible à l'écran.
  3. Le menu d'un programme masque "Activer" s'il est actif, ordonne Activer/Dupliquer/Supprimer et affiche un titre lisible.
  4. Après l'assistant 4 étapes, la séance créée est accessible et l'écran propose "Définir comme programme actif".
**Plans**: TBD
**UI hint**: yes

### Phase 8: Accueil & Quick Log
**Goal**: Les tuiles de l'accueil enregistrent et affichent la vérité du jour.
**Depends on**: Phase 1 (validation UAT)
**Requirements**: QLOG-01, QLOG-02, QLOG-03, QLOG-04, QLOG-05
**Wave**: 1
**Migrations**: oui probable (bloc 0801-0809)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Après +250 ml (plusieurs fois), la tuile eau affiche le total du jour correct, sans limite de logs.
  2. Poids et humeur ne se logguent qu'une fois par jour et restent marqués "logué" jusqu'au lendemain (y compris après relance de l'app).
  3. La tuile repas ouvre l'ajout de repas et affiche les kcal du jour.
  4. La carte score affiche des valeurs justes, ou explique l'état vide.
**Plans**: TBD
**UI hint**: yes

### Phase 9: Ajout de repas en un écran
**Goal**: Ajouter un repas prend un écran et un minimum de taps.
**Depends on**: Phase 4 (maquette), Phase 8 (tuile repas)
**Requirements**: NUTR-01, NUTR-02, NUTR-03, NUTR-04
**Wave**: 2
**Migrations**: non (réservé 0901-0909)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Depuis la tuile Repas, un seul tap ouvre l'écran unique d'ajout.
  2. Le repas (petit-déj/déjeuner/etc.) est présélectionné selon l'heure et la dernière méthode utilisée est mémorisée.
  3. Les repas déjà logués aujourd'hui sont visibles dans l'écran.
  4. Recherche, scan, code-barres et saisie manuelle sont accessibles sans changer d'écran.
**Plans**: TBD
**UI hint**: yes

### Phase 10: Pantry utile et en français
**Goal**: Le Pantry sert vraiment à cuisiner selon ce qu'on a et ce qui reste à manger.
**Depends on**: Phase 4 (maquette), Phase 9 (données nutrition du jour)
**Requirements**: PANT-01, PANT-02, PANT-03, PANT-04, PANT-05, PANT-06, PANT-07
**Wave**: 2
**Migrations**: oui (bloc 1001-1009)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures, scan via caméra virtuelle):
  1. Toucher Frigo/Congélateur ouvre la liste des articles ; chaque onglet permet de voir le détail de ses éléments.
  2. Un article s'ajoute à la main, et le scan d'un code-barres préremplit le formulaire.
  3. Les recettes IA tiennent compte du contenu du pantry et des macros restantes du jour (crédits via `creditGate`).
  4. La liste de courses reflète ce qui manque et accepte des ajouts manuels ; tous les libellés sont en français.
**Plans**: TBD
**UI hint**: yes

### Phase 11: Hydratation : boutons et réglages
**Goal**: L'hydratation est entièrement personnalisable et agréable à utiliser.
**Depends on**: Phase 1 (validation UAT)
**Requirements**: HYDR-01, HYDR-02, HYDR-03, HYDR-04, HYDR-05, HYDR-06
**Wave**: 1
**Migrations**: oui (bloc 1101-1109)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Les boutons +250/+500/+750 ont le nouveau design du UI-SPEC et ajoutent la bonne quantité.
  2. Les rappels (on/off, intervalle, plage horaire), la taille de verre, "compter café/thé" + pourcentage et le bonus jour de séance sont éditables et persistés.
  3. En modifiant l'objectif, le champ reste visible au-dessus du clavier.
**Plans**: TBD
**UI hint**: yes

### Phase 12: Récompenses : Succès & Boutique
**Goal**: L'utilisateur voit et gagne de vrais succès et gère sa boutique complète.
**Depends on**: Phase 4 (maquette Récompenses)
**Requirements**: REWD-01, REWD-02, REWD-03, REWD-04, REWD-05, REWD-06, REWD-07, REWD-08, REWD-09, REWD-10
**Wave**: 2
**Migrations**: oui (bloc 1201-1209)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Récompenses a quatre onglets Niveau / Succès / Boutique / Quêtes.
  2. Succès montre les 11 succès réels (icône, condition, progression) ; un tap ouvre la fiche avec date de déblocage ; un succès se débloque automatiquement quand la condition est remplie.
  3. La boutique montre toutes les catégories sans limite de 8, le solde de pièces en permanence, un aperçu avant achat et "Mes objets" avec équipement.
  4. L'historique des gains est consultable ; aucune liste factice de secours n'est affichée.
**Plans**: TBD
**UI hint**: yes

### Phase 13: Quêtes en base
**Goal**: Les quêtes sont réelles, persistées et mesurées sur les vraies données.
**Depends on**: Phase 12 (onglet Quêtes), Phase 4
**Requirements**: QUEST-01, QUEST-02
**Wave**: 3
**Migrations**: oui (bloc 1301-1309)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. L'onglet Quêtes lit la base (plus de tableau codé en dur).
  2. La progression d'une quête évolue quand l'utilisateur fait l'action réelle (ex. logguer de l'eau).
  3. Un nouvel utilisateur reçoit les mêmes quêtes de départ que tous les autres.
**Plans**: TBD
**UI hint**: yes

### Phase 14: Outil IA de quêtes
**Goal**: L'agent IA renouvelle les quêtes de façon personnalisée et encadrée.
**Depends on**: Phase 13 ; orchestrateur IA existant (`tools/registry.ts`, `creditGate`) ; relire v1.18 phases 45/46
**Requirements**: QUEST-03, QUEST-04, QUEST-05, QUEST-06, QUEST-07, QUEST-08
**Wave**: 4
**Migrations**: oui (bloc 1401-1409)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. À chaque passage de niveau, ou quand aucune quête ne reste, l'IA crée de nouvelles quêtes personnalisées selon l'identité de la personne.
  2. Au plus 3 quêtes sont actives ; le nombre créé complète ce qui reste.
  3. L'utilisateur ne peut pas refuser une quête ; chaque quête affiche une durée limite.
  4. Une quête expirée reste visible "échouée", hors du compte des 3, jusqu'à son remplacement, sans pénalité (cohérent avec v1.18 phases 45/46).
**Plans**: TBD

### Phase 15: Mesures & objectifs en base
**Goal**: Les objectifs de mesures sont réels, persistés et affichent la progression.
**Depends on**: Phase 1 (validation UAT)
**Requirements**: MEAS-01, MEAS-04, MEAS-05, MEAS-06
**Wave**: 1
**Migrations**: oui (bloc 1501-1509 ; réutilisation/extension de `ziko_athlete_goals` à confirmer en recherche)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Les objectifs viennent de la base (plus de 76 kg / 78 cm / 40 cm en dur).
  2. Les mesures proposées incluent poids, taille, bras, poitrine, cuisses, hanches et % de masse grasse.
  3. Chaque objectif affiche son % de complétion entre point de départ et cible.
  4. Un objectif en cours n'est pas modifiable par l'utilisateur ; une fois atteint, il peut définir le suivant.
**Plans**: TBD
**UI hint**: yes

### Phase 16: IA des mesures & onboarding objectifs
**Goal**: L'IA pose et ajuste les objectifs avec l'utilisateur, avec transparence.
**Depends on**: Phase 15, Phase 14 (patron d'outil + alimentation des quêtes) ; orchestrateur IA, `creditGate`
**Requirements**: MEAS-02, MEAS-03, MEAS-07, MEAS-08, MEAS-09
**Wave**: 5
**Migrations**: oui (bloc 1601-1609)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. À l'onboarding, l'utilisateur pose ses objectifs de mesures en conversation avec l'IA.
  2. L'agent dispose d'un outil de gestion des mesures et objectifs utilisable dans le chat.
  3. L'IA ne modifie un objectif en cours que dans les 4 cas prévus (stagnation >= 4 semaines, rythme, blessure/pause, changement d'objectif principal) et l'utilisateur est prévenu avec la raison.
  4. Un objectif de mesure peut alimenter la création d'une quête.
**Plans**: TBD
**UI hint**: yes

### Phase 17: Sommeil : saisie manuelle et données réelles
**Goal**: Le Sommeil montre des données vraies et se renseigne à la main.
**Depends on**: Phase 4 (maquette saisie), Phase 8 (cohérence accueil)
**Requirements**: SLP-01, SLP-02, SLP-03, SLP-04, SLP-05, SLP-06
**Wave**: 2
**Migrations**: oui (bloc 1701-1709)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Sans donnée, l'écran affiche un état vide avec "Logger ma nuit" (plus de 8h00/score 100 factice).
  2. Une nuit saisie (coucher, lever, qualité /5, réveils) apparaît sur l'écran Sommeil et sur l'accueil de façon cohérente.
  3. Les phases profond/léger/REM n'apparaissent que si une source connectée les fournit, et cette source prime sur la saisie manuelle.
  4. Cible, rappel coucher, source, réveil intelligent et routine pré-sommeil sont éditables.
**Plans**: TBD
**UI hint**: yes

### Phase 18: Stretching complet
**Goal**: Le Stretching est utilisable de bout en bout et s'insère dans la séance.
**Depends on**: Phase 4 (maquette), Phase 6 (démarrage de séance)
**Requirements**: STRE-01, STRE-02, STRE-03, STRE-04, STRE-05, STRE-06
**Wave**: 2
**Migrations**: oui (bloc 1801-1809)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. La bibliothèque affiche les exercices ; l'utilisateur crée les siens.
  2. L'utilisateur voit, crée et modifie des routines, et en choisit une par défaut.
  3. Le Suivi affiche séances de la semaine, minutes, série, dernière séance et calendrier.
  4. Le démarrage d'une séance ajoute la routine par défaut au début, passable d'un tap ; rien n'est ajouté s'il n'y en a pas.
**Plans**: TBD
**UI hint**: yes

### Phase 19: Compléments : catalogue & comparateur
**Goal**: Les Compléments exposent le catalogue, le comparateur et un stack personnel.
**Depends on**: Phase 4 (maquette catalogue/comparateur)
**Requirements**: SUPP-01, SUPP-02, SUPP-03, SUPP-04, SUPP-05, SUPP-06, SUPP-07
**Wave**: 2
**Migrations**: oui (bloc 1901-1909)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. L'écran a 4 onglets Aujourd'hui / Mon stack / Catalogue / Rappels.
  2. Le Catalogue permet recherche et filtres marque/catégorie, et ouvre le comparateur de prix avec liens ; aucun prix ne s'affiche en "NaN€".
  3. L'utilisateur ajoute un produit au stack avec dose et moment ; "Mon stack" ne contient que ses choix et est éditable.
  4. Les rappels se règlent selon la décision de maquette (par moment de la journée).
**Plans**: TBD
**UI hint**: yes

### Phase 20: Timer : presets éditables
**Goal**: L'utilisateur gère ses propres presets de timer.
**Depends on**: Phase 4 (maquette presets)
**Requirements**: TIMR-01, TIMR-02, TIMR-03
**Wave**: 2
**Migrations**: oui (bloc 2001-2009)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Sur Séance, Tabata et Intervalle, l'utilisateur crée, modifie et supprime un preset.
  2. Un preset règle nom, effort, repos, séries, rounds + repos entre rounds, échauffement.
  3. Le preset de test "Exemple" a disparu.
**Plans**: TBD
**UI hint**: yes

### Phase 21: Social & Amis
**Goal**: Gérer ses amis est fiable et le profil public donne envie d'interagir.
**Depends on**: Phase 2 (cause de l'échec d'ajout), Phase 4 (maquettes Amis + profil), Phase 12 (badges/niveau pour le profil, lecture seule)
**Requirements**: SOC-01, SOC-02, SOC-03, SOC-04, SOC-05, SOC-06, SOC-07, SOC-08
**Wave**: 2
**Migrations**: oui probable (bloc 2101-2109)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures, deux comptes de test):
  1. Ajouter un ami depuis la recherche globale réussit ; la demande apparaît dans "En attente" (envoyées, avec Annuler) et les reçues offrent Accepter/Refuser.
  2. "Suivre" et "ami" sont une seule notion ; le bouton reflète l'état (ajouter / demande envoyée / ami).
  3. Chercher place le champ en haut et filtre en direct sans bouton ; "Demande envoyée" s'affiche sans échappement unicode.
  4. Le profil public s'affiche sans coupure sous la bannière et montre niveau+XP, badges, série, derniers entraînements, PR, défis communs, objectif en français, nombre d'amis/abonnés.
**Plans**: TBD
**UI hint**: yes

### Phase 22: Journal & écran Mon coach
**Goal**: Le Journal enregistre fiablement et l'écran Mon coach présente le coach lié proprement.
**Depends on**: Phase 2 (session)
**Requirements**: JRNL-01, JRNL-02, COACH-01, COACH-02
**Wave**: 2
**Migrations**: non
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. Enregistrer une entrée de Journal réussit avec une session valide.
  2. L'humeur utilise des Ionicons (pas d'emoji) et la couleur du module suit la charte (décision de maquette).
  3. Avec un coach lié, Mon coach affiche son profil, avec header et retour cohérents avec les autres écrans.
**Plans**: TBD
**UI hint**: yes

### Phase 23: Atelier IA de création de programme
**Goal**: L'utilisateur construit un programme précis en conversation avec une IA experte.
**Depends on**: Phase 4 (maquette atelier), Phase 6, Phase 7 (activation) ; orchestrateur IA, `creditGate`
**Requirements**: ATEL-01, ATEL-02, ATEL-03, ATEL-04, ATEL-05, ATEL-06, ATEL-10
**Wave**: 3
**Migrations**: oui (bloc 2301-2309)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. L'utilisateur crée un programme par conversation, en plus de l'assistant 4 étapes.
  2. L'IA s'appuie sur la recherche web, une bibliothèque de skills d'entraînement et le contexte complet (données, séances, programmes passés).
  3. L'utilisateur édite le programme en direct ou demande à l'IA de le modifier ; un programme très précis (powerlifter) est réalisable.
  4. Chaque appel IA décompte les crédits via `creditCheck`/`creditDeduct`.
**Plans**: TBD
**UI hint**: yes

### Phase 24: Périodisation & relance automatique
**Goal**: Les programmes forment une progression pilotée par les résultats.
**Depends on**: Phase 23
**Requirements**: ATEL-07, ATEL-08, ATEL-09
**Wave**: 4
**Migrations**: oui (bloc 2401-2409)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures, fin de programme simulée par seed):
  1. Les programmes forment une suite ordonnée dont un seul est actif.
  2. Le programme suivant est construit à partir des résultats du précédent.
  3. À la fin d'un programme, l'atelier se relance automatiquement avec ces résultats.
**Plans**: TBD
**UI hint**: yes

### Phase 25: Mon coach complet (SEED-002)
**Goal**: Mon coach couvre toute la vision du seed (scope détaillé en `/gsd-discuss-phase`).
**Depends on**: Phase 7 (conflit programme coach/IA), Phase 22 ; lecture de `SEED-002-mobile-mon-coach-plugin.md`
**Requirements**: MCOA-01, MCOA-02, MCOA-03, MCOA-04
**Wave**: 5 (phase finale ; planifiée et exécutée en dernier)
**Migrations**: oui probable (bloc 2501-2509)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures, compte athlète + coach lié):
  1. Un audit documenté compare le plugin `coach` existant (états A/B/C) à SEED-002 et liste les manques.
  2. Le plugin est pré-installé, non désinstallable, et couvre code / aperçu coach / lié.
  3. L'utilisateur retire un coach après confirmation explicite.
  4. L'athlète voit le programme prescrit et la carte du coach.
**Plans**: TBD
**UI hint**: yes

### Phase 26: Factions & Ligues (SEED-001)
**Goal**: Une couche sociale RPG encourageante (factions, ligues, défis collectifs) sans compétition toxique (scope détaillé en `/gsd-discuss-phase`).
**Depends on**: Phase 12, 14, 16, 21, 25 ; lecture de `SEED-001-factions-ligues-rpg-social.md`
**Requirements**: LEAG-01, LEAG-02, LEAG-03, LEAG-04, LEAG-05, LEAG-06
**Wave**: 6 (phase finale)
**Migrations**: oui (bloc 2601-2609)
**Success Criteria** (what must be TRUE; vérifié par Claude sur l'émulateur avec captures):
  1. L'utilisateur rejoint une faction alignée sur son sport/objectif (taxonomie dashboards coach v1.8).
  2. Deux pistes de ligue (Habitudes / Performance) existent sans comparaison entre elles ; l'IA décide la transition avec une célébration.
  3. Les garde-fous s'appliquent : score de régularité relative, ligues débloquées à un palier, pas de chute sous le palier de départ.
  4. Un défi collectif coach + athlètes (via `coach_client_links`) s'affiche ; la couche lit `athlete_state`/`athlete_decisions` sans dupliquer la logique de niveau.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Harness UAT Android | 0/0 | Not started | - |
| 2. Session & authentification robustes | 0/0 | Not started | - |
| 3. Crash Habitudes & garde d'erreur modules | 0/0 | Not started | - |
| 4. Maquettes de référence (DSGN) | 0/0 | Not started | - |
| 5. Corrections transverses | 0/0 | Not started | - |
| 6. Séance d'entraînement fiable | 0/0 | Not started | - |
| 7. Programmes : liste, actif unique, menu | 0/0 | Not started | - |
| 8. Accueil & Quick Log | 0/0 | Not started | - |
| 9. Ajout de repas en un écran | 0/0 | Not started | - |
| 10. Pantry utile et en français | 0/0 | Not started | - |
| 11. Hydratation : boutons et réglages | 0/0 | Not started | - |
| 12. Récompenses : Succès & Boutique | 0/0 | Not started | - |
| 13. Quêtes en base | 0/0 | Not started | - |
| 14. Outil IA de quêtes | 0/0 | Not started | - |
| 15. Mesures & objectifs en base | 0/0 | Not started | - |
| 16. IA des mesures & onboarding objectifs | 0/0 | Not started | - |
| 17. Sommeil : saisie manuelle et données réelles | 0/0 | Not started | - |
| 18. Stretching complet | 0/0 | Not started | - |
| 19. Compléments : catalogue & comparateur | 0/0 | Not started | - |
| 20. Timer : presets éditables | 0/0 | Not started | - |
| 21. Social & Amis | 0/0 | Not started | - |
| 22. Journal & écran Mon coach | 0/0 | Not started | - |
| 23. Atelier IA de création de programme | 0/0 | Not started | - |
| 24. Périodisation & relance automatique | 0/0 | Not started | - |
| 25. Mon coach complet (SEED-002) | 0/0 | Not started | - |
| 26. Factions & Ligues (SEED-001) | 0/0 | Not started | - |
