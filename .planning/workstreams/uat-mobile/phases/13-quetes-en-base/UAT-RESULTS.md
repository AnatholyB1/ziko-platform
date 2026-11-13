# UAT-RESULTS P13 (run2, 2026-11-13) - migrations 1301/1302 sur la branche
| Id | Verdict | Detail |
|---|---|---|
| Q-1 | PASS | "AUJOURD'HUI . SE RENOUVELLE DANS 23 H" : "Terminer une seance" 25, "Boire 2 litres d'eau" 15 ; "CETTE SEMAINE" : "S'entrainer 3 fois" 60 ; starters en base (`source=starter`). |
| Q-3 | PASS | 1,375 L en base -> "1,4 / 2 L" (progression calculee depuis `ziko_hydration_logs`). |
| Q-4 | PASS | +750 ml -> "Boire 2 litres d'eau : Termine . +15 pieces recuperees", solde 430 -> 445. Toast non capture. |
| Q-2, Q-5..Q-11 | NON-TESTE | (Q-7: expires_at = minuit Paris = 23:00 UTC, coherent.) |

## Run 8 (2026-11-13) - fenêtre de dates des quêtes (quête créée à 21 h)
PASS (SQL `ziko_quest_metric_value`, hydration_ml, user A, 14 000 ml déjà bus aujourd'hui) : fenêtre démarrant en cours de journée (18:14:22Z) -> 500 (seule la saisie postérieure à la création compte) ; fenêtre démarrant après la dernière saisie -> 0 ; fenêtre alignée minuit Paris -> 14 500 (comportement P13 conservé). Migration 2801 effective. Création d'une quête à 21 h via l'UI NON-TESTE.
