# Phase 18 : Stretching complet, SUMMARY

Branche `phase/18-stretching` (base `milestone/v1.20`, mergée en fin de travail). Req : STRE-01..06. Maquette : lot C C01-C09 ; bouton plein = `getActionPrimary(theme)` (#CF4509), texte orange `#B53D05`.

## Livré
- **Migrations (fichiers seulement, jamais appliquées)** : `202612011801_stretching_exercises.sql` (table `ziko_stretching_exercises`, catalogue 24 exercices user_id NULL, RLS lecture catalogue + propres lignes, écriture seulement `auth.uid() = user_id`, REVOKE structure/anon) ; `202612011802_stretching_default_routine.sql` (`is_default` + index unique partiel 1 défaut/user, `ziko_stretching_logs.routine_id`). `check-migration-names` OK.
- **plugins/stretching** : `lib.ts` (logique pure, dates locales), `data.ts` (accès Supabase), `StretchingPlugin` (onglets Bibliothèque / Routines / Suivi, puces par zone + `Mes exercices`, badge `PERSO`, `PAR DÉFAUT`, calendrier du mois, zéros honnêtes, erreurs + `Réessayer`, jamais de donnée de secours), `ExerciseEditor` (nouvel écran, route `stretching/exercise`), `RoutineEditor` (réécrit : sélecteur de bibliothèque, Monter/Descendre/corbeille, durée/répétitions éditables, interrupteur `Routine par défaut`, suppression confirmée), `StretchingSession` (mesure durée ou répétitions, 2 côtés, charge la routine par id, log avec `routine_id` et date locale, erreur visible), `DefaultStretchingCard`. `RoutineManager` + route `manager` supprimés (remplacés par l'onglet Routines, entrée manifest retirée).
- **workout/session.tsx (additif)** : import + 1 état local `stretchSkipped` + `<DefaultStretchingCard>` en 1re position des 2 écrans (revue de programme, séance libre) ; les 2 anciens liens `Échauffement stretching` sont retirés (remplacés par la carte, ou par une phrase d'indication sans défaut).
- Backend `tools/stretching.ts` non modifié (la colonne `routine_id` est facultative).

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| STRE-01 | PARTIAL | filtres/compteurs testés (lib.test) ; affichage réel du catalogue = UAT ST-1 (migration non appliquée) |
| STRE-02 | PARTIAL | validation + payload d'insertion testés (data.test) ; RLS statique + spec RUN_DB écrite, non exécutée ; ST-2 en UAT |
| STRE-03 | PARTIAL | moveItem, durée/résumé, normalisation d'anciennes routines testés ; UI non vue |
| STRE-04 | VERIFIED (logique) / PARTIAL (écran) | semaine lundi-dimanche, minutes, série, dernière séance, grille du mois, fuseau local, changement d'heure testés (lib.test) ; ST-5 recalcul base en UAT |
| STRE-05 | PARTIAL | `saveRoutine` : ancien défaut retiré, restauré si échec, exactement 1 défaut (data.test avec index unique simulé) ; index unique réel = migration non appliquée, spec RUN_DB non exécutée |
| STRE-06 | PARTIAL | absence de carte sans défaut / après `Passer` / routine vide testée (`shouldShowDefaultCard`, `fetchDefaultRoutine`) ; rendu dans `session.tsx` non exécuté (ST-4) |

## Gate
`npx vitest run` racine : 44 fichiers, 795 tests verts (stretching : lib 23, data 9, migrations 7 ; ajoutés à `vitest.config.ts`). `tsc --noEmit` vert : `plugins/stretching` et `apps/mobile` (après merge de `milestone/v1.20`). `scripts/uat/check-migration-names.mjs` OK. Lint non lancé (pas de config exécutée).

## Décisions / déviations
- Q-P18 option 1 retenue : toucher la carte lance la routine ; `Passer` = état local non persisté ; le log n'écrit que `ziko_stretching_logs` (jamais une série, G-04).
- Série : jours consécutifs en date locale, comptée depuis aujourd'hui ou hier (non cassée tant qu'aujourd'hui n'a pas de séance).
- Réordonnancement : boutons `Monter`/`Descendre` (44 dp) sans poignée de glisser-déposer (pas de lib de drag ; une poignée non fonctionnelle serait trompeuse). Écart au contrat C05, à valider.
- `AISuggestion` et les barres 7 jours de l'ancien écran retirés (hors contrat, logique UTC fausse).
- 4 zones seulement (Dos, Jambes, Épaules, Hanches) comme la maquette ; anciennes valeurs libres des routines jsonb restent lisibles (libellé de repli).
- Durée d'une routine : répétition estimée à 3 s, durée x côtés.
- Définir le défaut = 2 écritures client (retire l'ancien puis écrit) avec restauration en cas d'échec, pas de RPC : non atomique si l'app est tuée entre les deux (l'index unique empêche tout double défaut ; au pire aucun défaut).

## NON prouvé
Aucun rendu émulateur (ST-1..ST-6 à faire), aucune exécution réelle des migrations ni de la RLS (le test statique vérifie le texte SQL, pas le comportement), pas de test de contraste/130 % de police, pas de test du composant dans `session.tsx`, crédit `stretch` (earn) inchangé et non testé.

## Besoins humains
Appliquer les 2 migrations sur la base de test puis prod (orchestrateur) ; valider la déviation drag-and-drop ; garde-fou : sans migration appliquée, l'onglet Bibliothèque affiche une carte d'erreur.

## Fichiers à risque de conflit
`apps/mobile/app/(app)/workout/session.tsx` (3 petits blocs), `apps/mobile/app/(app)/(plugins)/_layout.tsx` (+2 Stack.Screen), `vitest.config.ts` (liste include).
