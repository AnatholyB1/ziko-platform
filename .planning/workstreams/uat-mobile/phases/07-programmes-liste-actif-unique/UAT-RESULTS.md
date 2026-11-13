# UAT-RESULTS P7 (run2, 2026-11-13) - cumul run1 (flow A PASS)

| Id | Verdict | Detail |
|---|---|---|
| Liste | PASS | `workout/programs` : filtres Tous 3 / IA 1 / Coach 1 / Crees 1, bandeau "Un seul programme est actif a la fois...", PROGRAMME ACTIF + AUTRES PROGRAMMES, badges ACTIF/IA/COACH. |
| B (activer un programme coach) | PASS | Options > "Definir comme programme actif" : Force 5x5 seul actif en base, l'ancien passe dans AUTRES. |
| C (ecraser le programme coach) | PASS | Dialogue "Remplacer le programme de ton coach ? ... passe en pause. Ta progression est conservee ... Ton coach garde la main..." avec "Activer ..." et "Garder le programme du coach" ; "Garder" = aucun changement. |
| D (feuille detail coach A08) | NON-TESTE | |
| FAIL | FAIL | `ai-programs/dashboard` plante ("Ce module a rencontre un probleme", Redbox "Objects are not valid as a React child (found: object with keys {w, sessions})") quand `program_data.weeks` est un TABLEAU (forme `weeks[].sessions` documentee en prod, geree par normalizePlanSessions, utilisee par le seed run1). Cause probable : `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx:40` `getProgramWeeks` suppose un nombre (`program_data?.weeks ?? 8`) puis le rend (~l.299, 616) ; l.44 idem pour `sessions`. Fixture corrigee sur la branche (weeks=8 + sessions top-level). |

## Run 6 (2026-11-13, uat/run6)
- 'Pas encore demarre' NON-CONFIRME (aucune etiquette de statut visible sur lignes/detail)
- Liste : 1 actif (Force 5x5 bloc 2, 38 %), 4 autres, texte 'Un seul programme est actif a la fois' OK
Detail : ../../UAT-RESULTS-run6.md
