# P24 Periodisation / relance : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Bandeau suite/bilan sur l'onglet Entrainement | PASS | "Programme termine : Bloc de volume - La suite est prete, a relire dans l'atelier. - 2 seances sur 4 prevues - 1 212 kg de volume total" + boutons "Voir la suite" / "Plus tard" ; `uat-evidence/run4/p24-bandeau.png` |
| Bilan "Squat" : demarrer la seance prevue | FAIL | "Demarrer la seance d'aujourd'hui - A" -> feuille "Seance indisponible : Impossible de demarrer la seance prevue (exercices introuvables). Verifie ton programme." (`p18-carte-seance.png`) : l'exercice prevu "Squat" n'existe pas sous ce nom dans `ziko_exercises` (le bilan cite "jump squat"). Cause : resolution par `ilike` exact dans `startPlannedSession` (limite deja notee dans FIX-UAT-RUN3, non corrigee) ; un programme d'atelier/IA avec un nom non catalogue ne peut pas etre lance |
| Bandeau persistant sur programme reactive | FAIL (mineur) | voir P7 : `completed_at` non remis a null a la reactivation |
| B (activation suite), C (100 %/0 seance), D, E, F | NON-TESTE | |
