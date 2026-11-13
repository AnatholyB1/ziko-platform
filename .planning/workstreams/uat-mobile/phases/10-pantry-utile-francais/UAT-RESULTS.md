# UAT-RESULTS P10 (run2, 2026-11-13) - backend local + faux Anthropic

| Id | Verdict | Detail |
|---|---|---|
| Inventaire | PASS | Frigo 3 / Congelateur 1 / Placard 2 ; badges EXPIRE / EXPIRE DEMAIN / DANS 9 J. |
| Recettes IA | PASS | "Il te reste aujourd'hui 1 510 kcal / 123 g prot.", "Generer des recettes . 1 credit". Sans script : "Impossible de generer des recettes" + Reessayer (le faux renvoie {} pour generateObject). Avec script `json` arme : carte "Omelette au yaourt grec - 10 min - 380 kcal . 28 g prot. . rentre dans tes macros - 2 sur 2 ingredients", bouton "Regenerer . 1 credit". |
| Incoherence | FAIL mineur | "reste 1 510 kcal" suppose un objectif 2000 alors que l'ecran repas affiche 2400 (2400-490=1910) : objectifs caloriques divergents. |
| Courses, debit du credit | NON-TESTE | |
