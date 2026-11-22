# P9 Ajout de repas : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Barre "Ajouter N aliments" visible clavier ouvert | PASS | recherche "poulet", 1 resultat coche, clavier ouvert (`mInputShown=true`) : barre "Total 190 kcal - Ajouter 1 aliment" au-dessus du clavier ; `uat-evidence/run4/p9-barre-clavier.png` |
| Recap du jour / puces repas / methodes | PASS | recap 490 / 2000 kcal, P/G/L, suggestion "Dejeuner suggere d'apres l'heure (12:44)", methodes Chercher/Photo/Code/Manuel, "Derniere methode utilisee" |
| Observation | | avec clavier ouvert la liste de resultats est reduite a ~1 ligne (barre + clavier) : la selection d'un 2e aliment au tap a vise le clavier ; a confirmer visuellement |
| U1, U12, U15 | NON-TESTE | |
