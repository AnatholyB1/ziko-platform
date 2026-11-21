# Phase 2 : corrections de l'audit (fix/phase-2-audit)

Source : `audit/phase-2` 02-REVIEW.md et 02-VERIFICATION.md. Base : `milestone/v1.21`.

| # | Sev | Constat | Disposition | Commit |
|---|---|---|---|---|
| 1 | MEDIUM | `firstWorkout.ts` : erreur de lecture des seances seule gardait la carte | CORRIGE : `program.isError \|\| sessions.isError` -> hide ; tests lib + hook mis a jour (seances en erreur -> hide ; echec cout/solde inchange : carte, repli, Manuel) | 6c86c79b |
| 2 | MEDIUM | `index.tsx` : Forme du jour entre la carte et Mission | CORRIGE : bloc extrait (`formeDuJourBlock`), rendu apres `<QuestsBlock />` si la carte est visible/en chargement, ordre historique sinon ; helper pur `formeDuJourPlacement` teste pour les deux ordres | 65c1e3d3 |
| 3 | MEDIUM | `step-7.tsx` : pulsation, clignotement, ressort sans reduced motion | CORRIGE : `useReducedMotion()` ; pas de `withRepeat` (valeurs fixes), pas de `entering` ; `handleFinish` intact | 3f4d0cfb |
| 4a | LOW | etiquette d'acces sans « Conseillé » | CORRIGE : `pathA11yLabel(path, view, badge)` | 3394e228 |
| 4b | LOW | double tap empile deux ecrans | CORRIGE : garde 600 ms par instance de `PathRow` (carte et feuille) | 3394e228 |
| 4c | LOW | cout de la feuille « + » absent avec programme actif | CORRIGE : `useCreditInfo(true)` dans `workout/index.tsx` (staleTime 60 s) | 3394e228 |
| 4d | LOW | `creditFailed` inutilise | CORRIGE : export supprime | 6c86c79b |
| 4e | LOW | double mecanisme R5 (conteneur + prop `hideEmpty`) | CORRIGE : prop `hideEmpty` et sa branche supprimees ; source unique = test du conteneur | 65c1e3d3 |
| 5 | LOW | feuille de creation : pas de ScrollView / inset bas, pas de role modal Android | DOCUMENTE, non corrige (a traiter avec un passage accessibilite, test appareil requis) | docs |
| 6 | LOW | deux modales en sequence au tap d'une rangee epuisee (`onClose` puis `showExhaustionSheet`) | DOCUMENTE, non corrige (course iOS non reproductible sans appareil) | docs |
| 7 | LOW | `GET /ai/workshop/info` refetch a chaque focus accueil (cle `['credits','info']` invalidee) | DOCUMENTE, non corrige : a revoir (retirer la cle de l'invalidation de focus, invalider apres generation) | docs |
| 8 | LOW | `accessibilityLabel` du groupe carte ignore sur iOS (View non accessible) | DOCUMENTE, non corrige | docs |
| 9 | doc | maquette H08 « ce mois-ci » fausse (quota IA simple quotidien) | CORRIGE dans `design/02-DESIGN-CONTRACT.md` | ce commit (docs) |
