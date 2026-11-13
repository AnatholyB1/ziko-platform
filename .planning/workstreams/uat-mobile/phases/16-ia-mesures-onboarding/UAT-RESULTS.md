# UAT-RESULTS P16 (run2) - NON-TESTE

Contexte epuise ; backend local + faux disponibles, scripts `scripts/uat/p16-measurements-sql/` non rejoues. A faire run3.

## Run3 (2026-11-13) - PARTIEL, chaine backend seule (faux Anthropic, POST /ai/chat, pas d'UI)
Methode : `[[tool:measurements_goals {...}]]` puis SQL branche. Le faux ne renvoie pas le resultat de l'outil dans son texte : les codes d'erreur (`start_value_required`, `goal_too_recent`, `reason_not_allowed`) n'ont PAS ete lus, seulement les effets en base.
| Id | Verdict | Detail |
|---|---|---|
| IM-4 list | PASS (outil execute) | 5 tours = 5 appels `[Tool] measurements_goals` dans le journal backend ; contenu non observable. |
| IM-5 arm_cm sans mesure | PASS par effet | aucune ligne arm_cm creee. |
| IM-6 revise stagnation, objectif recent | PASS par effet | cible inchangee (79.4 -> 76), 0 ligne `ziko_goal_revisions`. |
| IM-7 motif hors liste | PASS par effet | cible inchangee. |
| IM-13 | indice | `authenticated` : SELECT seul sur `ziko_athlete_goals` (pas d'INSERT) ; UPDATE REST direct non rejoue. |
| IM-1/2/3, IM-8..12, IM-14 | NON-TESTE | onboarding, bandeau de revision (sans maquette), quetes, credits. |
| Env | | `service_role` sans AUCUN privilege sur `ziko_athlete_goals`, `ziko_goal_revisions`, `ziko_workshop_drafts`, `ziko_program_sequences`, `ziko_program_relaunches` sur la branche (classe GRANT v1.20 deja suivie) ; fixtures GRANT appliquees sur la branche seulement. |

## Run 7 (2026-11-13)
IM-1..3, IM-8..12, IM-14 : NON-TESTE (arret par budget de contexte; prochaine etape dans UAT-RUN7-RESUME.md)

## Run 8 (2026-11-13) - faux Anthropic (`/__script`), chat via `uat-evidence/tool.sh`
- IM-1 PASS (backend) : `/ai/onboarding/stream` + faux `set_measure_goal waist_cm 90->84` -> événement SSE `type:goal` + ligne `ziko_athlete_goals` ; rendu de la carte dans l'écran d'onboarding NON-TESTE (compte neuf requis). IM-2 PASS : `target_equals_start`, pas de ligne. IM-14 PASS : aucun débit crédit (solde 20 inchangé), lignes `ziko_ai_cost_log` source `onboarding_assess`.
- IM-3 PASS : onglet Mesures > Objectifs liste les objectifs avec %, aucun bouton de modification (seulement `Définir le suivant` sur l'objectif atteint).
- IM-5 PASS (`start_value_required`, aucune ligne), IM-6 PASS (`goal_too_recent`, seuil réel 28 j), IM-7 PASS (`reason_not_allowed`).
- IM-8 PASS : `start_date` antidaté 40 j (UPDATE avec `session_replication_role=replica`, le trigger `measurement_goal_locked` bloque sinon), 2 mesures, `revise stagnation 69.5` : cible 68 -> 69.5, ligne `ziko_goal_revisions`, `must_tell_user` présent. IM-9 PASS : bandeau `Ziko a ajusté ton objectif / Cible 68 → 69,5 kg / Raison : Ta progression est stable depuis plus de 4 semaines`, `Compris` -> `acknowledged_at` rempli, bandeau disparu (capture `uat-evidence/p16/im9.png`). IM-10 PASS (`revision_too_soon`, délai 14 j). IM-11 PASS (`user_statement_required` puis succès, phrase journalisée). IM-12 PARTIEL : quête `Mets à jour : poids` créée (hebdo, cible 2, 168 h, 40 pièces, `free_slots_left:1`) ; complétion et refus `max_active_quests` NON-TESTE.
- Mineur : `reason_detail` d'une stagnation dit `Progression de 0 % sur 35 j.` (cohérent avec le seed).
