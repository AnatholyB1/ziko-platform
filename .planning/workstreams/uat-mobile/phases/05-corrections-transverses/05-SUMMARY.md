# Phase 5 - Summary (corrections transverses)

Branche `phase/05-corrections-transverses`. Aucune migration ; mobile uniquement.

## Livre
- `packages/plugin-sdk/src/displayLabels.ts` (+ `.test.ts`, 22 tests) : `goalLabel`, `formatDateFr` (tables fixes, sans Intl), `exerciseDisplayName`, `topInsetShortfall`, `clampFabPosition`/`snapFabX`, `tabsSideMargin`. Exporte via `@ziko/plugin-sdk`.
- XCUT-01 : `goalLabel` applique a accueil, entrainement, profil (propre + `[userId]`), recherche, amis, detail programme IA.
- XCUT-02 : tous les `toLocaleDateString('fr-FR', ...)` (21 fichiers) remplaces par `formatDateFr` ; "End" -> "Terminer" (session.tsx x2) ; onglet "Shopping" -> "Courses" (PantryPlugin).
- XCUT-03 : `WSHeader` mesure sa position (`measureInWindow`) et ajoute exactement le manque sous la barre de statut (0 si deja dans un SafeAreaView).
- XCUT-04 : `BugFab` (packages/ui) compact 36 px, translucide, deplacable, accroche aux bords, borne au-dessus de la barre d'onglets, position initiale bord gauche.
- XCUT-05 : `SubTabs` (composant commun) applique la gouttiere 16 quand collee aux bords (pas de double marge).
- XCUT-06 : `exerciseDisplayName` (majuscule initiale, name_fr > table > nom) branche dans `tExercise` et 7 sites d'affichage ; aucune migration.
- XCUT-07 : tag du conseil par defaut "Coach Ziko" -> "Conseil", et masquage si tag == "Coach Ziko".

## Prouve
- 334/334 tests vitest racine (dont 22 nouveaux) ; type-check `apps/mobile`, `packages/plugin-sdk`, `packages/ui` verts.
## Non prouve
- Aucun rendu emulateur : safe-area (mesure runtime), position du FAB vs boutons reels, gouttiere SubTabs, absence de "May" sur device. Voir `05-UAT-PLAN.md` + `.maestro/p05-xcut.yaml` (non executes).
- Ecrans a en-tete maison (PostDetailScreen, profile/[userId], paywall, GroupsScreen...) n'utilisent pas WSHeader : non corriges ici.
- Noms d'exercices bruts en base non francises : seul l'affichage est corrige (table `exerciseNames` partielle).
- Traductions Pantry complete = P10. Sites d'exercices hors liste (stats, plugins) non traites.
## Conflits probables
`apps/mobile/app/(app)/index.tsx` (P6/P8, edits localises), `workout/index.tsx`, `packages/plugin-sdk/src/i18n.ts` (import + tExercise), `index.ts` plugin-sdk.
