# UAT-RESULTS P10 (run2, 2026-11-13) - backend local + faux Anthropic

| Id | Verdict | Detail |
|---|---|---|
| Inventaire | PASS | Frigo 3 / Congelateur 1 / Placard 2 ; badges EXPIRE / EXPIRE DEMAIN / DANS 9 J. |
| Recettes IA | PASS | "Il te reste aujourd'hui 1 510 kcal / 123 g prot.", "Generer des recettes . 1 credit". Sans script : "Impossible de generer des recettes" + Reessayer (le faux renvoie {} pour generateObject). Avec script `json` arme : carte "Omelette au yaourt grec - 10 min - 380 kcal . 28 g prot. . rentre dans tes macros - 2 sur 2 ingredients", bouton "Regenerer . 1 credit". |
| Incoherence | FAIL mineur | "reste 1 510 kcal" suppose un objectif 2000 alors que l'ecran repas affiche 2400 (2400-490=1910) : objectifs caloriques divergents. |
| Courses, debit du credit | NON-TESTE | |

## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| S12 groupe `Il manque dans ton frigo` | PASS | `Yaourt grec` + raison `Expiré` |
| S14 ranger 2 articles | PASS partiel | cocher `Yaourt grec` (perime) + `Pates` (manuel) -> `Ranger 2 articles dans le garde-manger` -> message `2 articles rangés dans le garde-manger`; base : Yaourt grec qte 1, `expiration_date` null (ok), `Pates` cree en stock (pantry, qte 1) |
| Defaut | FAIL | `Pates` ranges reapparaissent aussitot dans la liste (`Stock bas`) : l'article manuel est cree avec `low_stock_threshold = 1.00` = quantite (1), donc stock bas immediat (boucle courses -> ranger -> courses). A verifier : seuil par defaut a la creation depuis une ligne de courses (p10-ranger.png) |
| S7 scan introuvable | BLOQUE | meme limite camera virtuelle que U12 |
| Constat base | A SIGNALER | `service_role` recoit `permission denied for table ziko_shopping_list_items` (GRANT manquant sur la branche de test ; sans effet sur l'app authentifiee) |
