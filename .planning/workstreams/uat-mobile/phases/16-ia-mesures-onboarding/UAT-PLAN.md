# Phase 16 - UAT-PLAN (emulateur + FAUX Anthropic local)

Prerequis : migrations 1501, 1502, 1601, 1602 appliquees sur la branche jetable `uat-v1-20` (par l'orchestrateur, JAMAIS la prod) ; backend + faux Anthropic demarres (`bash scripts/uat/backend-start.sh`, voir `UAT-BACKEND.md`, faux sur 8211) ; compte `uat-athlete`, plugin Mesures actif. Aucun appel reel : le faux emet l'outil via `[[tool:nom {json}]]` dans le message, ou `POST http://127.0.0.1:8211/__script {"tool":..,"input":..,"count":1}`.
Le faux n'emet l'outil que si on lui dit : l'UAT prouve la CHAINE (outil -> garde-fous -> base -> ecran), pas le jugement du vrai modele.

| Id | Parcours | Attendu | Preuve |
|---|---|---|---|
| IM-1 | Onboarding : file `/__script` `set_measure_goal {"measure_key":"weight_kg","start_value":82,"target_value":76}` puis `assess_profile`, nouvel utilisateur, repondre dans la conversation Ziko | carte "Objectif enregistre / Poids : 82 -> 76 kg / Baisse de 6 kg" dans le chat AVANT la carte mission ; ligne `ziko_athlete_goals` (measure_key, start 82, cible 76) | capture + SELECT |
| IM-2 | Meme chose avec cible = depart (82 -> 82) | pas de carte, l'outil renvoie `target_equals_start`, pas de ligne | capture + SELECT |
| IM-3 | Onglet Mesures > Objectifs apres IM-1 | l'objectif apparait avec % ; aucun bouton de modification (verrou P15) | capture |
| IM-4 | Chat IA : `[[tool:measurements_goals {"action":"list"}]]` | reponse avec l'objectif et son % | capture + journal `/__script` |
| IM-5 | Chat : `[[tool:measurements_goals {"action":"create","measure_key":"arm_cm","target_value":40}]]` sans mesure de bras | refus `start_value_required` (aucune valeur inventee), pas de ligne | SELECT |
| IM-6 | Modification refusee : `{"action":"revise","measure_key":"weight_kg","reason":"stagnation","new_target_value":78}` sur un objectif de 2 jours | `goal_too_recent`, cible inchangee, aucune ligne `ziko_goal_revisions` | SELECT |
| IM-7 | Motif hors liste : `{"action":"revise",...,"reason":"user_wants_easier"}` | `reason_not_allowed`, cible inchangee | SELECT |
| IM-8 | Stagnation avérée : antidater `start_date` de 40 j et inserer 2 mesures (j-35, j-3) a ~82 par script SQL sur la branche jetable, puis `revise stagnation new_target_value 79` | succes, cible 79, ligne d'historique, la reponse du chat annonce l'ajustement (le faux repond un texte : verifier que `must_tell_user` est dans le tool_result du journal) | SELECT + journal |
| IM-9 | Ouvrir Mesures > Objectifs apres IM-8 | bandeau "Ziko a ajuste ton objectif / Cible 76 -> 79 kg / Raison : Ta progression est stable depuis plus de 4 semaines" ; `Compris` le fait disparaitre (`acknowledged_at` rempli) ; il ne revient pas | capture + SELECT |
| IM-10 | Seconde modification immediate | `revision_too_soon` | SELECT |
| IM-11 | Blessure : `{"action":"revise","reason":"injury_pause","new_target_date":"<futur>"}` sans phrase, puis avec `user_statement` (apres 14 j simules) | refus `user_statement_required` puis succes avec la phrase journalisee | SELECT |
| IM-12 | Couplage : `{"action":"quest","measure_key":"weight_kg"}` | quete "Mets a jour : poids" (hebdo, cible 2, duree 168 h) dans l'onglet Quetes ; saisir 2 mesures -> terminee + pieces ; avec 3 quetes actives -> refus `max_active_quests` | capture + SELECT |
| IM-13 | Un client ne modifie toujours pas un objectif (UPDATE REST direct avec le jeton utilisateur) | refuse (privilege) | requete REST |
| IM-14 | Credits : `/credits/balance` avant/apres un tour de chat avec outil | un seul debit `chat` (pas de double) ; onboarding : aucun debit, ligne `ziko_ai_cost_log` source `onboarding_assess` | SELECT |

## Appel reel (orchestrateur, ulterieur, 1 seul)
Sur la branche jetable, 1 conversation de chat reelle : "J'ai du mal a perdre du poids depuis un mois" avec un objectif de poids actif (donnees de stagnation preparees). Verifier : le modele appelle `measurements_goals` (list puis eventuellement revise avec motif `stagnation`), annonce la raison, ne change pas l'objectif hors des 4 motifs. Non fait ici.

## Maquette
Pas de maquette pour la carte d'objectif de l'onboarding ni pour le bandeau de revision (G-4 du CONTEXT) : a valider visuellement lors de IM-1 / IM-9.
