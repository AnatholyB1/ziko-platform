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
