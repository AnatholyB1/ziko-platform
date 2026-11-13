# UAT-RESULTS P11 (run2, 2026-11-13)
| Id | Verdict | Detail |
|---|---|---|
| HY-1 | PASS partiel | +250 x2, +750 : 1 ligne par appui en base ; verrou <300 ms non rejoue. |
| HY-2/3/4/5/6/8 | NON-TESTE | (ecran Reglages present : objectif 2,0 L, +0,5 L jours de seance, Rappels desactives, verre 250 ml, cafe Oui a 50 %, bonus +500 ml). |
| HY-7 | PASS | Cafe 250 ml a 50 % -> ligne `amount_ml`=125. |
| HY-9 | PASS | Modal Objectif quotidien clavier ouvert : Enregistrer y=1565, haut clavier ~1695 (marge ~130 px). |
Incoherence objectif accueil 2.5 L vs ecran 2.0 L : connue (fix/uat-run1), toujours presente (pas encore mergee).
