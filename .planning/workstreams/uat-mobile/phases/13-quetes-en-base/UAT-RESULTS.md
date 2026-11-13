# UAT-RESULTS P13 (run2, 2026-11-13) - migrations 1301/1302 sur la branche
| Id | Verdict | Detail |
|---|---|---|
| Q-1 | PASS | "AUJOURD'HUI . SE RENOUVELLE DANS 23 H" : "Terminer une seance" 25, "Boire 2 litres d'eau" 15 ; "CETTE SEMAINE" : "S'entrainer 3 fois" 60 ; starters en base (`source=starter`). |
| Q-3 | PASS | 1,375 L en base -> "1,4 / 2 L" (progression calculee depuis `ziko_hydration_logs`). |
| Q-4 | PASS | +750 ml -> "Boire 2 litres d'eau : Termine . +15 pieces recuperees", solde 430 -> 445. Toast non capture. |
| Q-2, Q-5..Q-11 | NON-TESTE | (Q-7: expires_at = minuit Paris = 23:00 UTC, coherent.) |
