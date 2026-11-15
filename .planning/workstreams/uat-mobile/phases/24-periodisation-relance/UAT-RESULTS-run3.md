
## Run3 (2026-11-13)
Seed : "Bloc de volume" actif, started_at = now-30 j, 2 semaines x 2 seances ; seances squat 26/21/9/4 jours avant. Fixtures GRANT branche (voir P23). Pilotage par API (`/ai/workshop/relaunch/check` puis `/propose`), faux arme avec `workshop_set_draft` (4 semaines).
| Flow | Verdict | Detail |
|---|---|---|
| A.1 bandeau UI | NON-TESTE | l'emulateur s'est fige (uiautomator/screencap sans reponse) a l'ouverture de l'onglet Seance apres la relance ; redemarrage force. Hypothese non prouvee : spinner animee bloquant l'etat idle / RAM. |
| A.2 base | PASS | programme is_active=false, completed_at renseigne, sequence_id non nul, position 1, results.hint, 0 programme actif ; relance `proposed` ; brouillon `draft` 4 semaines, previous_program_id = programme ; 1 ligne cost_log `program_relaunch`, 0 `user_chat` en plus. |
| A.3 requete du faux | PARTIEL | 1 appel `workshop_set_draft` + tour texte ; contenu (`PREVIOUS PROGRAM RESULTS`, pas de web_search) NON inspecte. |
| A.4 credits | PASS partiel | aucun debit de la proposition ; le solde est passe de 14 a 20 pendant le seed (mes inserts de seances ont declenche des gains, sans lien avec la relance). |
| A.6 idempotence | PASS | 2e `check` : relance deja `proposed` ; 2e `propose` : `{"already":true}` ; aucun nouvel appel au faux. |
| C variantes | PARTIEL | 50 % : `hint=consolidate` (2 seances sur 4 ; la fenetre = duree prevue, les seances apres la fin ne comptent pas). Observation : l'exercice "Squat" du bilan a ete rapproche de "jump squat" (e1RM 140 -> 142,9) : rapprochement flou a verifier. 100 % / 0 seance NON-TESTE. |
| B, D, E, F | NON-TESTE | |
