# Phase 3 - Corrections parcours entrainement (UATN-03)

Branche `fix/uat-workout` (depuis `milestone/v1.21`). Sources : `03-UAT.md` (bugs UATN-03). Aucun emulateur, aucune migration.

| # | SEV | Bug | Cause | Correctif | Commit | Non prouve |
|---|-----|-----|-------|-----------|--------|------------|
| 1 | 2 | IA simple : "Demarrer cette seance" ouvre une Seance rapide vide | `ai-generate.tsx` poussait `/workout/session` sans rien ecrire dans le store ; l'ecran de seance (`isGuided = currentWorkoutExercises.length > 0`) demarrait donc une seance libre | Nouvelle action `startGeneratedSession` du `workoutStore` (nom, `3 x 8-10` -> series/reps via `parseSetsSpec`, note -> `notes`), qui partage avec `startPlannedSession` la resolution catalogue (`resolvePlanExercises`). L'ecran appelle l'action puis navigue ; aucun exercice resolu -> alerte "Regenere la seance", pas de navigation. | 447d34fa | Rendu reel de la seance avec les exercices du faux Anthropic ; correspondance catalogue reelle des noms generes |
| 2 | 2 | Manuel : "Creer mon programme" sans retour, programme `is_active=false`, carte d'accueil inchangee | Le code d'ecran de fin d'assistant (A09) n'etait plus rendu : `created`/`replaced` jamais lus, aucune activation, aucune navigation | Decision : 1er programme auto-actif (`wizardActivationPlan`). Aucun programme actif -> RPC `ziko_set_active_program`, invalidation (`refreshProgramQueries` : programs, program/active...), toast `activationToast`, retour au tableau. Un programme deja actif (athlete) -> conserve + alerte "Definir comme programme actif" / "Plus tard" ; programme coach actif -> "Voir mes programmes" (confirmation A08 de l'ecran Programmes) ; lecture en erreur -> pas d'activation devinee. | 849c9067 | Disparition effective de la carte (cle `['program','active']` invalidee, non rejouee sur emulateur) |
| 3 | 3 | Programme a 0 exercice creable | Aucune validation a l'etape 4 | `validateWizardExercises` : `showAlert` "Ajoute au moins un exercice" avant tout insert | 849c9067 | - |
| 4 | 3 | Onglet Entrainement garde l'assistant / la liste Programmes | Pile imbriquee sans `index` dessous (ecran ouvert directement depuis l'accueil) : le "pop to top" par defaut du tab press ne retombait pas sur le tableau | `goToTrainingDashboard` (`router.dismissTo('/(app)/workout')`) apres creation/activation ; `tabPress` de l'onglet `workout` ramene au tableau (sauf seance en cours) ; `unstable_settings.initialRouteName = 'index'` dans `workout/_layout.tsx` | 359d124e | Comportement exact de `dismissTo` / `initialRouteName` sur la pile reelle (expo-router 6) ; a confirmer par les flows Maestro |
| 5 | - | Atelier : apres enregistrement + activation, arret sur la liste Programmes | `atelier.tsx` faisait `router.replace('/(app)/workout/programs')` apres activation, et n'invalidait que `['programs', userId]` | Apres activation : invalidation complete, toast, `goToTrainingDashboard` ("Demarrer la seance d'aujourd'hui" atteignable). "Plus tard" garde la liste Programmes. | 359d124e | Demarrage reel de la seance avec exercices sur emulateur (le chemin `startPlannedSession` est deja teste en unitaire) |

## Tests ajoutes
- `src/stores/__tests__/workoutStore.test.ts` : `startGeneratedSession` (exercices + series/reps/note dans le store, aucun exercice -> pas de seance, liste vide).
- `src/lib/__tests__/workoutPlan.test.ts` : `parseSetsSpec`.
- `src/lib/__tests__/generatedStart.test.ts` : retour utilisateur + garde source `ai-generate`.
- `src/lib/__tests__/workoutNav.test.ts` : navigation, invalidation, validation 0 exercice, plan d'activation, gardes source builder/atelier/onglet.

## A rejouer sur emulateur
Flows `.maestro/v121-n03a-manual.yaml`, `v121-n03b-ai-simple.yaml` (ajouter l'assertion d'un exercice generé, ex. "Squat goblet", dans la seance), `v121-n03c-atelier.yaml` (jusqu'a "Demarrer la seance d'aujourd'hui").
