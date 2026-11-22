# Phase 6: Seance d'entrainement fiable - Context

**Gathered:** 2026-11-12 (recap chantier 3 bugs). Req : TRAIN-01..05, TRAIN-10. Vague 1.

## Decisions verrouillees
- **D-01** TRAIN-01/02 : "Allez, c'est parti !" (mission du jour, accueil) et "Demarrer la seance d'aujourd'hui" (page programme) ouvrent la **seance prevue avec ses exercices** (ex. Full Body Power, 8 exos), jamais une seance rapide vide. Un seul chemin de demarrage (fonction commune `startPlannedSession(programId, dayIndex)`), reutilise par P7/P18/P23.
- **D-02** TRAIN-03 (regle validee) : une seance **sans serie validee n'est ni enregistree ni comptee** (compteur de semaine "2/4", "Recent", duree "0 min"). A la fin/abandon sans serie : rien en base (`ziko_workout_sessions`/`session_sets` selon schema reel), message neutre. Nettoyer le calcul du compteur pour ignorer les seances sans serie (ne PAS supprimer les donnees historiques : filtre d'affichage + garde a l'ecriture ; signaler si un nettoyage de donnees est souhaitable).
- **D-03** TRAIN-04 : la semaine type d'un programme (ex. `muscle_gain`) affiche ses seances sur les bons jours ("Repos" uniquement les vrais jours de repos). Verifier le mapping jour de semaine <-> `day_index` (0/1, lundi/dimanche).
- **D-04** TRAIN-05 : toucher une seance de "Recent" ouvre son detail + stats (volume, series, duree, exos). Nouvel ecran route sous `apps/mobile/app/(app)/workout/`.
- **D-05** TRAIN-10 : seance rapide = Ionicons (pas d'emoji), libelles francais ("End" -> "Terminer"), casse des noms d'exercices (P5 fournit l'utilitaire de nom ; ne pas dupliquer).
- **D-06** Fichiers : `apps/mobile/app/(app)/workout/*`, `apps/mobile/src/stores/workoutStore.ts`, `apps/mobile/app/(app)/index.tsx` (edits localises sur les 2 boutons seulement). P6 proprietaire de `workout/*` ; P7/P18/P23 apres.
- **D-07** Pas de migration. Pas d'UI-SPEC (corrections de comportement) mais le detail de seance (D-04) suit les tokens charte et les composants existants (carte standard).

## Zones grises restantes
Aucune (le comportement "seance vide" est tranche).
