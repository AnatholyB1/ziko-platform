# UAT-RESULTS P15 (run2, 2026-11-13)

| Id | Verdict | Detail |
|---|---|---|
| ME-1 | PASS | Objectifs sans donnee : "Aucun objectif pour l'instant" + "Definir un objectif". |
| ME-2 | PASS partiel | 7 puces (Poids, Taille, Bras, Poitrine, Cuisses, Hanches, Masse grasse), depart 79,4 / cible 76 -> "Poids - Baisse, depart 79,4 kg le 13 nov. - EN COURS 0 % - Aucune nouvelle mesure" ; "Un objectif en cours ne se modifie pas". Banniere "3,4 kg a perdre" non lue. |
| ME-5 | PASS | tap carte : "Objectif en cours - Tu ne peux pas modifier cet objectif tant qu'il n'est pas atteint. Il te reste 3,4 kg." + "Compris". |
| ME-3, 4, 6-11 | NON-TESTE | |
| FAIL persistant | FAIL | Onglet Aujourd'hui sans mesure : coach IA dit "Tes dernieres mesures sont bien stables." (run1 #7). |

## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| ME-2/ME-3 creation objectif + % | PASS | `Définir le suivant` : Poids 70,5 -> 68 : `Objectif de baisse : 2,5 kg à perdre.`; carte `0 %`, `EN COURS`, `70,5 kg vers 68,0 kg` (p15-created.png) |
| ME-5 verrou D-04 | PASS | feuille `Objectif en cours`, `Tu ne peux pas modifier cet objectif tant qu'il n'est pas atteint. Il te reste 2,5 kg.`, `Compris`; pas de bouton Modifier |
| ME-6 atteint | PASS | carte `ATTEINT`, `100 %` (p15-achieved.png) |
| ME-7 cible = depart | PASS | `La cible doit être différente du point de départ.` |
| Defaut libelle | FAIL mineur | `Objectif atteint le 13 nov.. Bravo.` et `Ta dernière mesure, le 13 nov.. Tu peux la corriger.` : double point |
| ME-1/4/8-11 | NON-TESTE | |
