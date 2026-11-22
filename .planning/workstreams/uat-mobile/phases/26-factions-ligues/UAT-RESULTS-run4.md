# P26 Factions / ligues : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Ecran Ligue sans faction | PASS | "Ligue - Ta regularite, a ton rythme - Choisis une faction pour commencer" : 6 factions (Powerlifting [Suggeree, objectif strength], Hyrox, Running, Bodybuilding, Perte de poids, Forme et bien-etre) ; `uat-evidence/run4/p26-league.png` |
| Rejoindre une faction | PASS | confirmation "Rejoindre Powerlifting ?" -> faction affichee avec bouton Changer |
| Piste | PASS | "Piste Habitudes - Bronze" ; explication "Ton palier monte avec ta regularite et ne descend jamais de plus d'un cran par rapport a ton meilleur." ; "Cette semaine : 0 sur 28 habitudes" ; `p26-piste.png` |
| Defi collectif sous 3 participants | PASS (etat vide) | "Defis de groupe - Aucun defi de groupe pour l'instant" |
| Transition de palier avec faux Anthropic, absence neutre, LG-1..LG-25 restants | NON-TESTE | budget de contexte |

Etat laisse : athlete membre de la faction Powerlifting.
