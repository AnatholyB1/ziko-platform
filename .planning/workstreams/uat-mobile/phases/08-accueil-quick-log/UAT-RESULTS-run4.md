# P8 Accueil / Quick Log : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Feuille Poids visible clavier ouvert | PASS | clavier numerique ouvert (`mInputShown=true`) : titre "Log ton poids", champ et bouton Confirmer au-dessus du clavier ; `uat-evidence/run4/p8-poids-clavier.png` |
| Quick Log Poids : mise a jour sans relance | PASS | 70.5 saisi puis Confirmer : la tuile devient "Poids - Logue" sans relancer l'app |
| Invalidation apres log d'eau (accueil) | PASS | tuile eau 2.13 L puis 2.38 L ; carte Hydratation "2.1L / 2.5L" puis "2.4L / 2.5L" immediatement, sans relance |
| Objectif d'eau identique accueil / Hydratation | PASS | 2.5 L des deux cotes ("2.4L / 2.5L", "Encore 0.1L") |
| Invalidation apres seance | NON-TESTE | aucune seance terminee (le demarrage de la seance planifiee echoue, voir P24) |
| Objectif kcal accueil, noms d'exercices FR, anglais residuel seance, FAB, decalage Quick Log | NON-TESTE | |

Observation (hors criteres) : onglet Entrainement, bandeau "Seance en cours - Lower - 705 min -> 708 min - Reprendre" (seance fantome de plus de 11 h) ; "Reprendre" ouvre une "Seance rapide" vide a 00:24 au lieu de la seance Lower : la seance orpheline n'est ni reprise ni nettoyee. Repro : ouvrir l'onglet Entrainement, toucher Reprendre.
