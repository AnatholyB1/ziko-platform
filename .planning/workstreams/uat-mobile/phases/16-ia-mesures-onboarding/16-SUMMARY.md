# Phase 16 - IA des mesures et onboarding objectifs : SUMMARY

Branche `phase/16-mesures-ia` (base `milestone/v1.20`, merge de `milestone/v1.20` refait sans conflit, gate refait apres merge). Aucun push, aucune ecriture prod, aucun appel IA reel ; migrations = fichiers non appliques. Decisions D-01..D-06 et gray areas G-1..G-8 : `16-CONTEXT.md`. UAT : `UAT-PLAN.md` (IM-1..IM-14, faux Anthropic).

## Livre
- **Migrations (fichiers seuls)** : `20261201160100_ai_measurement_goals.sql` (RPC service_role `ziko_ai_create_measurement_goal` / `ziko_ai_revise_measurement_goal`, table d'historique `ziko_goal_revisions` en lecture seule client, RPC `ziko_ack_goal_revision`, `ziko_measure_meta`) ; `20261201160200_quest_measurement_metric.sql` (metrique de quete `measurement_logs` : CHECK, `ziko_quest_metric_value` et `ziko_create_quests` redefinies depuis 1302 ; `ziko_sync_quests` NON redefinie, 1402 intacte).
- **Backend** : `backend/api/src/measurements/{rules,service}.ts` ; outil `measurements_goals` (actions list / create / revise / quest) enregistre dans `tools/registry.ts` (additif : 1 executeur, 1 bloc de schema, 1 spread ; enum de `quests_create` etendu) ; onboarding `/ai/onboarding/stream` : outil `set_measure_goal`, phase "objectifs" dans le prompt, evenement SSE `goal`, `ONBOARDING_MAX_STEPS` 8 -> 10.
- **Mobile** : carte "Objectif enregistre" dans le chat d'onboarding (`ziko-chat.tsx`, `src/lib/onboardingGoals.ts`) ; bandeau "Ziko a ajuste ton objectif" + `Compris` dans l'onglet Objectifs (`GoalsTab.tsx`, `lib/revisions.ts`).
- **Harnais SQL** `scripts/uat/p16-measurements-sql/run.mjs` (Postgres local jetable port 8208, arrete ensuite).

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| MEAS-02 onboarding | PARTIAL | outil + prompt + evenement SSE + carte testes (spec route, `onboardingGoals.test.ts`) ; le vrai modele posant des objectifs en conversation et le rendu ecran non prouves (UAT IM-1/IM-2 en file) |
| MEAS-03 outil de gestion | VERIFIED (mock) | `measurements_goals` dans `allToolSchemas` + executeur (`tools/measurements-goals.test.ts`), logique `service.test.ts` ; choix spontane de l'outil par le vrai modele : non prouve |
| MEAS-07 4 cas seulement | VERIFIED (unitaire + SQL local) | `rules.test.ts` (motifs, seuils, donnees obsoletes/insuffisantes refusees) ; SQL local : motif hors liste refuse, delai 14 j, sens conserve sauf changement d'objectif principal, depart intact, porte du verrou refermee ; `injury_pause`/`main_goal_change` declaratifs (phrase exigee, non verifiable serveur) |
| MEAS-08 utilisateur prevenu | PARTIAL | historique + bandeau + `must_tell_user` dans le resultat de l'outil ; SQL : lecture proprietaire seule, acquittement idempotent, insertion client refusee ; rendu bandeau et formulation reelle du modele non prouves |
| MEAS-09 quetes | VERIFIED (SQL local + mock) | SQL : quete `measurement_logs` creee, progression = nb de saisies, plafond de 3 conserve, metrique inconnue refusee ; service : quete liee a l'objectif (`ai_meta`), refus sans objectif / plafond |
| MEAS-10/11 | N/A | absents de REQUIREMENTS.md (G-8) |

## Gate (apres merge de milestone/v1.20)
- Backend vitest : 34 fichiers passes / 8 skipped, **428 tests verts** (3 skipped, 14 todo preexistants) ; nouveaux : `measurements/rules.test.ts`, `service.test.ts`, `tools/measurements-goals.test.ts`, 2 cas dans `test/routes/onboarding.spec.ts`. `tsc --noEmit` backend, `apps/mobile`, `plugins/measurements` : 0 erreur.
- Vitest racine : **48 fichiers / 831 tests verts** (dont `revisions.test.ts`, `onboardingGoals.test.ts`). `check-migration-names` OK (27 fichiers v1.20).
- Harnais SQL P16 : **36 PASS / 0 FAIL** (PG local, migrations 1201..1602 rejouees sur stubs).

## Deviations
- RPC `service_role` dediees au lieu de `ziko_create_measurement_goal` (qui exige `auth.uid()`, nul avec la cle service) : G-1 [A CONFIRMER].
- 2 tests existants modifies : `routes/quests.test.ts` (enum de metriques + `measurement_logs`) et `test/routes/onboarding.spec.ts` (la surface d'outils de l'onboarding passe de [assess_profile] a [set_measure_goal, assess_profile], elargissement voulu).
- `ONBOARDING_MAX_STEPS` 8 -> 10 : cout autonome supplementaire absorbe, journalise comme `onboarding_assess`.

## NON prouve
Comportement du vrai Claude (pertinence des objectifs proposes, respect des 4 motifs, annonce de la raison, choix d'outil) ; migrations sur la base portfolio reelle (grants par defaut, donnees existantes) : testees sur PG 18 local + stubs, `auth.role()` service_role simule par `set_config` ; rendu natif de la carte d'onboarding et du bandeau (aucune maquette : G-4) ; pertinence des seuils (G-2 : 28 j, 5 %, 1 %/semaine, 14 j) ; `injury_pause`/`main_goal_change` non verifiables ; accessibilite ; cout reel en tokens ; mesure absente de la derniere ligne : l'outil de lecture `measurements_get_progress` de P15 garde sa limite (current_value nul), mais `measurements_goals` lit la derniere valeur non nulle par mesure.

## Besoins humains
Approbation + application de 1601 puis 1602 (apres 1501/1502 et 1301/1302/1401/1402) ; confirmer G-1..G-4 ; UAT IM-1..IM-14 ; 1 appel Anthropic reel (voir `UAT-PLAN.md`) ; trancher MEAS-10/11.

## Fichiers a risque de conflit
`backend/api/src/tools/registry.ts` (P23 ajoute aussi : 1 executeur, 1 bloc, 1 spread ; merge deja fait sans conflit), `backend/api/src/routes/onboarding.ts`, `backend/api/src/quests/{rules,service}.ts` (P14), `plugins/measurements/src/screens/GoalsTab.tsx` (P15), `apps/mobile/app/(auth)/onboarding/ziko-chat.tsx`, `supabase/migrations/20261201160200` (copie de 1302 : toute phase qui redefinit `ziko_quest_metric_value` / `ziko_create_quests` doit partir de 1602).
