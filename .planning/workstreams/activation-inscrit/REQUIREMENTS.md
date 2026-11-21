# Requirements: Ziko Platform — v1.21 Activation du nouvel inscrit

**Defined:** 2026-11-20
**Workstream:** `activation-inscrit`
**Source:** revue du flux d'inscription après les 4 correctifs TestFlight (`.planning/debug/UAT-TESTFLIGHT-FIXES-2026-11-20.md`)
**Core Value:** Un utilisateur a une seule app qui le coache, suit tout, et dit quoi cuisiner selon sa cuisine — en maîtrisant les coûts IA via l'engagement gamifié.

Règles transverses : maquette Claude Design / `/gsd-ui-phase` avant plan et exécution des phases visuelles (rendu exact de la maquette) · UAT par Claude sur émulateur Android (harness v1.20) · jamais d'édition d'une migration existante · philosophie non punitive des quêtes · démarrage après l'envoi TestFlight des 4 correctifs.

## v1 Requirements (ce milestone)

### Quêtes dès l'inscription (QNEW)

- [x] **QNEW-01**: Un compte neuf a ses quêtes actives dès son arrivée sur l'accueil, sans avoir ouvert l'écran Récompenses
- [x] **QNEW-02**: La création des quêtes ne dépend plus du déblocage de l'écran Récompenses (niveau 3) et ne crée pas de doublons
- [x] **QNEW-03**: L'accueil affiche un bloc Quêtes (3 actives max) avec titre, progression et état de complétion
- [x] **QNEW-04**: Chaque quête indique l'action à faire pour la compléter et y mène en un tap
- [x] **QNEW-05**: Au niveau 1, aucune quête ne renvoie vers un écran verrouillé
- [x] **QNEW-06**: Une quête complétée se met à jour sur l'accueil sans relancer l'app
- [x] **QNEW-07**: Aucune quête « échouée » n'est affichée (philosophie non punitive)

### Premier entraînement (FWKO)

- [x] **FWKO-01**: Un compte sans programme ni séance voit « Crée ton premier entraînement » en toute première carte de l'accueil
- [x] **FWKO-02**: La carte propose 3 chemins (Manuel, IA simple, Atelier IA), chacun avec une phrase d'explication et le coût en crédits pour les deux IA
- [x] **FWKO-03**: Manuel ouvre l'assistant en 4 étapes (`program-builder`)
- [x] **FWKO-04**: IA simple ouvre l'assistant de séance unique (`ai-generate`)
- [x] **FWKO-05**: Atelier IA ouvre l'atelier conversationnel
- [x] **FWKO-06**: La carte disparaît dès qu'un programme est actif ou qu'une séance est terminée, et cohabite avec la carte Mission du jour
- [x] **FWKO-07**: Crédits épuisés : les chemins IA le disent avant l'ouverture et Manuel reste proposé

### Clarifications du parcours (CLAR)

- [x] **CLAR-01**: Le bouton de l'onglet Entraînement dit ce qu'il fait (séance unique ou programme) et mène au bon écran
- [x] **CLAR-02**: La fin de l'onboarding ne promet plus un programme ou une « première séance demain matin » qui n'existent pas
- [x] **CLAR-03**: Le backend n'assigne comme première mission que l'hydratation à un compte de niveau 1
- [x] **CLAR-04**: Le bouton de la première mission n'est jamais renvoyé à l'accueil par le garde de route

### UAT compte neuf (UATN)

- [x] **UATN-01**: Claude vérifie, avec captures sur émulateur, le parcours inscription → onboarding → 1re conversation → accueil
- [x] **UATN-02**: Claude vérifie que les quêtes sont visibles sur l'accueil et complétables
- [x] **UATN-03**: Claude vérifie que chacun des 3 chemins mène à une séance lancée (IA avec faux Anthropic)

## Future Requirements (reporté)

- Programme pré-généré à la fin de l'onboarding
- Quêtes personnalisées par l'IA dès le jour 1

## Out of Scope

| Exclusion | Raison |
|-----------|--------|
| Économie de crédits IA | Inchangée ; seul l'affichage du coût sur la carte est ajouté |
| Refonte de l'écran Récompenses | Seule la synchro des quêtes en sort ; l'écran reste tel quel |
| Factions et ligues (SEED-001) | Hors sujet pour l'activation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QNEW-01 | Phase 1 | Verified (code+tests+UAT) |
| QNEW-02 | Phase 1 | Verified (code+tests+UAT) |
| QNEW-03 | Phase 1 | Verified (code+tests+UAT) |
| QNEW-04 | Phase 1 | Verified (code+tests+UAT) |
| QNEW-05 | Phase 1 | Verified (code+tests+UAT) |
| QNEW-06 | Phase 1 | Verified (code+tests+UAT) |
| QNEW-07 | Phase 1 | Verified (code+tests+UAT) |
| CLAR-03 | Phase 1 | Verified (code+tests+UAT) |
| CLAR-04 | Phase 1 | Verified (code+tests+UAT) |
| FWKO-01 | Phase 2 | Verified (code+tests+UAT) |
| FWKO-02 | Phase 2 | Verified (code+tests+UAT) |
| FWKO-03 | Phase 2 | Verified (code+tests+UAT) |
| FWKO-04 | Phase 2 | Verified (code+tests+UAT) |
| FWKO-05 | Phase 2 | Verified (code+tests+UAT) |
| FWKO-06 | Phase 2 | Verified (code+tests+UAT) |
| FWKO-07 | Phase 2 | Verified (code+tests+UAT) |
| CLAR-01 | Phase 2 | Verified (code+tests+UAT) |
| CLAR-02 | Phase 2 | Verified (code+tests+UAT) |
| UATN-01 | Phase 3 | Verified (UAT émulateur) |
| UATN-02 | Phase 3 | Verified (UAT émulateur) |
| UATN-03 | Phase 3 | Verified (UAT émulateur, rejoué 2026-11-21) |

**Coverage:** 21/21 mapped, 0 orphans.
