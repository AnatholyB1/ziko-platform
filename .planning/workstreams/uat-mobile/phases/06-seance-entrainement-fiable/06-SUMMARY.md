# Phase 6 - SUMMARY (Séance d'entraînement fiable)

Branche `phase/06-seance-entrainement-fiable` (merge `milestone/v1.20` fait, gate vert : `tsc --noEmit` mobile OK, vitest mobile 128/128 dont 25 nouveaux).

## Ce qui a été fait
- `apps/mobile/src/lib/workoutPlan.ts` (pur) : normalisation de `program_data` (weeks[].sessions / sessions / workouts / days), résolution des jours (day_index 0/1-basé, day_of_week 1-7, répartition par fréquence si absent ou empilé), `buildWeekLayout`, `pickSessionForToday`, `parseReps`, `isCountableSession`.
- `workoutStore.startPlannedSession(programId, dayIndex)` : chemin unique (D-01) ; charge le programme IA, précharge les exercices (résolus par id puis nom/nom_fr), insère la séance nommée ; échec propre sans ligne en base. `discardSession()` supprime sets/exercices/séance. `loadRecentSessions` filtre les séances sans série.
- Accueil `index.tsx` (edits localisés) : carte "Mission du jour" et bouton "Allez, c'est parti !" utilisent la séance du jour planifiée ; "Récent" cliquable vers le détail. `useHomeData.ts` : requêtes semaine et Récent filtrées (`total_sets>0 OR total_volume_kg>0`).
- `workout/index.tsx` : semaine type par jour (Repos seulement sur vrais repos), bouton fixe "Démarrer la séance d'aujourd'hui" démarre la séance prévue, `SessionCard` ouvre le détail.
- `workout/session.tsx` : garde séance vide (aucune série validée -> suppression + alerte neutre, pas de crédit ni XP), libellés FR ("Terminer", "Série", "Poids (kg)"...), emojis remplacés par Ionicons, `program_exercise_id` null pour exercices planifiés (FK).
- `workout/session/[sessionId].tsx` : tuile EXOS ajoutée (FC seulement si présente).

## Exigences
| Id | Statut | Preuve |
|----|--------|--------|
| TRAIN-01 | PARTIAL | test store `startPlannedSession` (8 exos mockés, jour de repos -> séance suivante) ; pas d'UAT émulateur |
| TRAIN-02 | PARTIAL | même fonction/résolveur ; bouton câblé, type-check OK ; UAT en attente |
| TRAIN-03 | PARTIAL | tests `discardSession`, `isCountableSession`, filtre `loadRecentSessions` ; requêtes `.or()` PostgREST non exécutées contre une base |
| TRAIN-04 | PARTIAL | tests de layout ; mapping réel des jours inconnu (voir ci-dessous) |
| TRAIN-05 | PARTIAL | navigation câblée (écran détail pré-existant) ; non vu à l'écran |
| TRAIN-10 | PARTIAL | emojis/labels du fichier session.tsx traités ; `favContainer.icon` (hydratation) reste une donnée possiblement emoji |

## Non prouvé / hypothèses
- Aucun rendu réel ni UAT émulateur (file d'attente P1). Les mocks Supabase ne prouvent ni la syntaxe `.or('total_sets.gt.0,...')`, ni `ilike` avec noms accentués, ni les FK/RLS.
- Forme réelle de `program_data` en prod inconnue (3 formes coexistent) ; si les séances n'ont pas de jour explicite valide, répartition par fréquence (3 -> L/M/V) : à valider contre un programme réel.
- Les exercices de programme sans correspondance dans `ziko_exercises` sont ignorés.
- Séances historiques vides conservées en base (D-02 : filtre d'affichage + garde d'écriture seulement). Nettoyage souhaitable : `delete from ziko_workout_sessions where coalesce(total_sets,0)=0 and coalesce(total_volume_kg,0)=0 and ended_at is not null` (non exécuté, à décider).
- Séances "en cours" abandonnées sans passer par Terminer restent en base (ended_at null) mais sont exclues des compteurs.

## Fichiers à risque de conflit
`apps/mobile/app/(app)/index.tsx` (P5/P8), `apps/mobile/src/hooks/useHomeData.ts` (P8), `workout/*` + `workoutStore.ts` (P7/P18/P23).
