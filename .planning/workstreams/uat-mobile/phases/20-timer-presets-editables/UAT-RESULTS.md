# UAT-RESULTS P20 (run2, 2026-11-13)

| Id | Verdict | Detail |
|---|---|---|
| Etat vide | PASS | Onglets Seance/Tabata/Intervalle, "Aucun preset de seance", "Nouveau preset". |
| Creation | PASS | Nom, Repos 1 min 30 (+/-), Series par round 4, "Duree totale : 6 min", "Enregistrer le preset" -> "MES PRESETS 1 : Cotes, 1 min 30 repos . 4 series, duree 6 min" + "Options de Cotes". |
| Edition/suppression/lancement | NON-TESTE | |

## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| TI-1 CRUD | PASS | Onglet Seance : creer `UAT7` (5 series, 8 min), Dupliquer -> `UAT7 (copie)`, Modifier (6 series, base ok), Supprimer : message `Supprimer ce preset ? Cette action est définitive.`, Annuler = rien, Supprimer = ligne retiree. Intervalle et Tabata : creation OK en base (`hiit` 45/45/15/1/10, `tabata` 20/10/1/8) |
| TI-2 etats vides | PASS | `Aucun preset d'intervalle`, `Aucun preset Tabata` + bouton `Nouveau preset` |
| TI-3 editeur Intervalle | PASS | 6 champs (Echauffement, Effort, Repos, Series, Rounds, Repos entre rounds), pas 15 s; `Durée totale : 11 min` = formule (45 s + 10x60 s = 10,75 min) |
| TI-4 editeur Seance | PASS | seulement Repos + Series par round |
| TI-5 lancement | PASS | `EFFORT 00:36`, `Cotes 400 m · Round 1/10 · Série 1/1` apres echauffement (p20-run2.png); pause/arriere-plan non testes |
| TI-6/7 | NON-TESTE | |
Ecart mineur : le preset legacy `Cotes` (type `custom`) est range sous l'onglet Seance.
