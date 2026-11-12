# Phase 7 - SUMMARY (Programmes : liste, actif unique, menu)

Branche `phase/07-programmes` (merge `milestone/v1.20` fait sans conflit). Gate : `tsc --noEmit` mobile OK, `tsc` plugin `ai-programs` OK, `npx vitest run` racine 464/464 (dont 39 nouveaux : 21 `programs`, 9 `programsService`, 2 store + les existants), `check-migration-names` OK.

## Livré
- Migrations (fichiers seulement, NON appliquées), `supabase/migrations/` : `202612010701_dedupe_active_programs` (idempotent, garde l'actif le plus récent par athlète sur les 2 tables), `…0702_active_program_unique_indexes` (index uniques partiels par table), `…0703_active_program_rpc` (`ziko_set_active_program(kind, id)` SECURITY DEFINER, `search_path=public`, REVOKE PUBLIC/anon, GRANT authenticated ; vérifie la propriété, désactive tout puis active la cible), `…0704_ai_program_insert_single_active` (trigger BEFORE INSERT : l'outil IA backend ne crée plus de 2e actif et n'écrase pas un programme coach actif : la ligne est alors inactive). Ordre d'application : 0701 -> 0702 -> 0703 -> 0704.
- `apps/mobile/src/lib/programs.ts` (pur) + `programsService.ts` (client injecté) : fusion des 2 tables, source IA/coach/créé, invariant "0 ou 1 ACTIF", filtres, entrées de menu, règle de conflit coach, copie/renommage/suppression, ligne d'insert de l'assistant.
- `workout/programs.tsx` : liste A01 (hero actif + "Autres programmes"), filtres 44 dp, A02 feuille Créer, A03 vide, A04 squelettes, A05 erreur + Réessayer (aucun programme de secours), A06/A07 menu (feuille basse, titre 2 lignes), A08 conflit coach (2 boutons), renommage, toast. Bouton plein = `getActionPrimary(theme)` (#CF4509).
- Activation : un seul chemin (RPC) depuis la liste, `workoutStore.setActiveProgram`, onglet "Réactiver" d'`AIProgramsPlugin`, bouton du détail `workout/[id].tsx` (avec confirmation coach). `loadPrograms` n'auto-active plus (0 actif valide, D-09).
- `workout/index.tsx` : lit le programme ACTIF (plus le plus récent, D-11) ; "•••" (et "Mes programmes" à l'état vide) ouvre la liste ; l'ancien `showAlert` à handlers vides est supprimé.
- `program-builder.tsx` : D-10 corrigé (l'insert omettait `name/split_type/days_per_week` NOT NULL ; `program_data.weeks` était un nombre donc inexploitable par le planificateur P6) + écran A09 "Ton programme est prêt" (séances ouvrables, `Définir comme programme actif` / `Plus tard`, rappel du programme remplacé).

## Exigences
| Id | Statut | Preuve / limite |
|----|--------|-----------------|
| TRAIN-06 | PARTIAL | tests `buildProgramList`/filtres/compteurs ; écran type-check ; pas de rendu ni UAT émulateur |
| TRAIN-07 | PARTIAL | tests RPC (appel unique, 0 update direct), store, règle conflit ; SQL non exécuté (aucune base de test à disposition) |
| TRAIN-08 | PARTIAL | tests `menuActionsFor` (pas d'Activer sur l'actif, ordre), garde-fous rename/delete ; hauteur 48 dp / titre 60 car. non mesurés |
| TRAIN-09 | PARTIAL | tests `buildWizardProgramRow` + planificateur P6 (3 séances jours distincts) ; insert réel non joué ; écran A09 non vu |

## Non prouvé / hypothèses
- Les migrations n'ont PAS été exécutées (ni parse Postgres, ni test RLS). À faire par l'orchestrateur sur la branche jetable avant UAT : appliquer 0701-0704, rejouer deux fois (idempotence), tests du Flow B.6 du UAT-PLAN. Risque connu : un programme assigné par un coach avec `is_active = true` ET `is_template = false` en doublon avec un programme perso serait désactivé par 0701 (voulu).
- Hypothèse : la clé athlète d'un programme est `COALESCE(assigned_to_user_id, user_id)`. Si un coach crée des programmes `user_id = coach` avec `assigned_to_user_id` renseigné, l'index les rattache à l'athlète (cohérent). Vérifier en prod (lecture seule) qu'aucun coach n'a plusieurs programmes `is_active` sur sa propre clé avant 0702, sinon 0701 les ramène à un.
- `workout/index.tsx`, l'accueil (`useActiveAIProgram`) et le planificateur P6 ne lisent que `ziko_ai_generated_programs` : si l'actif est un programme coach/créé (table `ziko_workout_programs`), l'écran Séance affiche "Aucun programme actif" avec le lien "Mes programmes". Le démarrage d'une séance d'un programme `ziko_workout_programs` (weeks_data / program_workouts) n'est pas couvert (hors P7, à traiter avec P18/P23).
- "Atelier IA" (feuille Créer / état vide) route vers `workout/ai-generate` en attendant P23.
- Progression du hero : seulement pour les programmes `ziko_workout_programs` (`current_cycle_week`/`weeks_count|cycle_weeks`) ; programmes IA sans progression (aucune donnée, rien d'inventé). Statut `TERMINÉ` de la maquette non implémenté (aucune donnée de fin).
- Le renommage n'est proposé que sur le programme actif non coach et la suppression jamais sur un programme coach (A07/A06 + D-08) ; renommer un inactif exige de l'activer d'abord (conforme à la maquette A07).
- RN `Modal` utilisé pour les feuilles : comportement scrim/clavier non vérifié sur émulateur.

## Écarts
- Pas de namespace i18n `programs.*` : chaînes FR en dur (accepté par CLAUDE.md pour les écrans ; microcopy du contrat reprise mot pour mot). À migrer si P25 le demande.
- Migrations numérotées 0701-0704 (dedupe toujours émis, idempotent) au lieu de 0701 RPC + 0702 optionnel.
- Trigger 0704 non prévu dans le CONTEXT : nécessaire car l'index unique de 0702 ferait échouer l'outil IA backend (`is_active: true` à l'insert).

## Fichiers à risque de conflit
`apps/mobile/app/(app)/workout/index.tsx`, `workout/program-builder.tsx`, `workout/[id].tsx` (P18/P23), `apps/mobile/src/stores/workoutStore.ts`, `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx` (P23/P24).
