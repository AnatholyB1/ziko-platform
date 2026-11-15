# Phase 6 - Plan d'UAT (Maestro / adb) - Séance d'entraînement fiable

Cible : émulateur `ziko-uat-1`, base = branche jetable (jamais la prod). File : `queue.sh acquire 06 <flow>`.
Preuves : `uat-evidence/06/<flow>/` (PNG, logcat, RESULT.txt).

## Données de départ (via `scripts/uat/reset-data.mjs` + insertions sur la branche jetable uniquement)
- Athlète UAT avec 1 ligne `ziko_ai_generated_programs` (`is_active = true`, goal `muscle_gain`) :
  `program_data = {"weeks":[{"w":1,"sessions":[{"name":"Full Body Power","exercises":[8 exercices dont les noms existent dans ziko_exercises]},{"name":"Upper","exercises":[...]},{"name":"Lower","exercises":[...]}]}]}` (3 séances, sans jour explicite -> lundi / mercredi / vendredi).
- 2 séances historiques : S1 (total_sets 12, volume 3000), S2 vide (total_sets 0, volume 0, ended_at renseigné) créées par insert, pour vérifier le filtre.

## Flow A - TRAIN-01 "Allez, c'est parti !" (accueil)
1. Login athlète, onglet Accueil. Forcer le jour : `adb shell date` non fiable -> choisir le jour réel ; le jour de repos doit tomber sur la prochaine séance (voir étape 4).
2. Maestro : `tapOn: "Allez, c'est parti !"`.
3. Critères mesurables : l'écran séance affiche le nom de la séance prévue (`assertVisible: "Full Body Power"` ou la séance du jour) ET une liste de 8 exercices (compteur "Exercice 1/8" visible après "Démarrer la séance") ; jamais le titre "Séance rapide". `adb shell uiautomator dump` : aucun `quickStart`.
4. Un jour de repos : la séance ouverte est la prochaine planifiée (nom = séance suivante du programme).
5. Base : 1 nouvelle ligne `ziko_workout_sessions` avec `name` = séance prévue.

## Flow B - TRAIN-02 page programme
1. Onglet Séance, bouton fixe "Démarrer la séance d'aujourd'hui · <nom>".
2. Mêmes critères que A.3 ; le nom du bouton = nom de la séance ouverte.

## Flow C - TRAIN-03 séance vide ignorée
1. Depuis A, ne valider aucune série, appuyer "Terminer" (ancien libellé "End"), confirmer.
2. Critères : alerte "Séance non enregistrée" ; retour onglet Séance ; `ziko_workout_sessions` n'a PAS de nouvelle ligne pour cet id (requête branche jetable) ; compteur de la semaine inchangé ; "Récent" inchangé ; aucun toast de crédit.
3. Variante : valider 1 série puis Terminer -> 1 ligne, total_sets = 1, compteur +1, Récent +1.
4. Filtre historique : la séance S2 vide n'apparaît ni dans Récent (accueil), ni dans "Séances récentes", ni dans l'historique, ni dans le compteur "x/4".

## Flow D - TRAIN-04 semaine type
1. Onglet Séance > sous-onglet "Semaine type".
2. Critères : 7 lignes L..D ; Full Body Power sur L, Upper sur M(ercredi, 3e ligne), Lower sur V ; "Repos" uniquement sur M(ardi), J, S, D (4 repos pour 3 séances). Cas jours explicites (`day_of_week` 2,5,7) : séances sur M, V, D.

## Flow E - TRAIN-05 détail depuis Récent
1. Accueil > "Récent" > toucher la séance S1 ; idem onglet Séance > "Séances récentes".
2. Critères : écran détail (`workout/session/<id>`) avec cartes DURÉE, VOLUME, SÉRIES, EXOS et la liste des exercices/séries ; retour ramène à l'écran d'origine.

## Flow F - TRAIN-10 séance rapide
1. Onglet Séance > "Séance rapide" (ou chemin existant), état vide.
2. Critères : icône barbell (aucun emoji : `uiautomator dump` sans U+1F3CB / U+1F525), boutons "Terminer", en-têtes "Série / Reps / Poids (kg)", écran fin de séance avec Ionicons (pas de U+1F389 etc.).

## Squelette Maestro (à compléter au run)
```yaml
appId: com.ziko.app   # à confirmer avec P1
---
- launchApp
- tapOn: "Allez, c'est parti !"
- assertVisible: "Exercice 1/8" # après "Démarrer la séance"
- assertNotVisible: "Séance rapide"
- tapOn: "Terminer"
- tapOn: "Terminer"   # confirmation
- assertVisible: "Séance non enregistrée"
```

## Limites connues avant UAT
- Mapping de jours sans `day_of_week` valide = répartition par fréquence (2:L/J, 3:L/M/V, 4:L/M/J/V...) : à valider avec un vrai programme généré.
- Les exercices du programme dont le nom n'est pas résolu dans `ziko_exercises` sont ignorés ; si aucun n'est résolu, alerte "Séance indisponible".
