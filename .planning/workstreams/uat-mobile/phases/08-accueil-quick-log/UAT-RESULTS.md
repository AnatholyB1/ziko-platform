# UAT-RESULTS P8 suite (run2, 2026-11-13). Cumul run1 (U1,U3,U14 PASS ; U4 FAIL clavier connu, fix/uat-run1 : non re-signale).
| Id | Verdict | Detail |
|---|---|---|
| U5-U6 | NON-TESTE | dependent du poids (clavier, correctif en cours). |
| U8 | PASS | Humeur 4/5 -> tuile "logue", 1 ligne `ziko_journal_entries` mood=4 context=general date=2026-11-13. |
| U9 | PASS | re-choix 2/5 -> toujours 1 ligne (mood=2). Persistance apres force-stop non rejouee. |
| U10-U11 | NON-TESTE | horloge/fuseau (minuit franchi pendant le run : eau repassee a 0.00L = PASS indirect eau). |
| U12 | PASS | Tuile Repas "490 kcal" = somme des logs (190+300) ; ecran `nutrition/log` via lien (tap tuile non rejoue). |
| U13 | PASS | Sans repas : "Loggue ton repas" sans kcal. |
| U15 | PASS | 5 taps eau -> 1.25L ; ligne Hydratation "1.3L / 2.5L" (objectif 2.5 accueil vs 2.0 ecran Hydratation : connu, fix/uat-run1). Score anneau non lu. |
| U16-U17 | NON-TESTE | |
| U18 | PASS | Reseau coupe + tap eau : alerte "Eau non enregistree - Verifie ta connexion et reessaie." ; retour de la tuile non verifie. |
Layout shift grille Quick Log non reproduit (5 taps a coordonnees fixes ont tous compte).
