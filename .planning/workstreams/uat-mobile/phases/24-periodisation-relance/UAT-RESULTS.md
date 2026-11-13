## Run 9 (2026-11-13, UI émulateur) - Flow B 1-2 : activation du programme suivant par l'interface
Captures `uat-evidence/run9/m1.png`, `p2.png`, `p3.png`, `p5.png`, `t2.png`, `t3.png`.
| Id | Verdict | Détail |
|---|---|---|
| B-1 activation par l'UI | PASS | Programmes > menu `...` de `Bloc de force` (PAS ENCORE DÉMARRÉ) > `Définir comme programme actif` > modale `Remplacer le programme de ton coach ?` (`Force 5x5, bloc 2 passe en pause. Ta progression est conservée.`) > `Activer Bloc de force`. Base : `Bloc de force` `is_active=true`, `sequence_position=2` ; aucun autre actif (`ziko_workout_programs` actifs = 0, 1 seul actif au total). |
| B-2 frise `Ma suite` | PASS | `1. TERMINÉ Bloc de volume`, `2. EN COURS Bloc de force` (carte bord orange, pastille pleine), bilan `2 séances sur 4 prévues / 1 212 kg / jump squat 140 -> 142,9 kg / La suite consolide...`. Un seul `EN COURS`. Avant activation la ligne 2 affichait `2. SUIVANT` (gris). Les cartes de la frise ne sont pas cliquables (pas d'activation depuis `Ma suite`). |
| B-3 `Plus tard` | NON-TESTE (partiel P23) | Le `Plus tard` de la modale d'enregistrement a été touché sur l'atelier P23 (programme `Atelier run9`, inactif) ; l'état `Aucun programme actif` n'a pas été rejoué sur la chaîne P24. |
| C (100 % / 0 séance), D, E, F | NON-TESTE | Non joués (budget contexte). |
| Piège harnais | CONSTAT | Un lien profond vers un écran déjà monté ne le recharge pas : `Ma suite` est restée `SUIVANT` après activation tant que l'écran n'a pas été remonté (retour onglet Entraînement > `Ma suite`). Vérifier côté appli que `sequence.tsx` refetch au focus. |
| Ecart mesurable (maquette) 1 | FAIL | Onglet Entraînement, programme actif `Bloc de force` : titre `Force` (au lieu de `Bloc de force`) et sous-titre `Coach Ziko · Intermédiaire` codé en dur : `apps/mobile/app/(app)/workout/index.tsx:499-500` (`goalLabel(activeProgram.goal)` pour tout programme non coach). `Créé par moi` dans Programmes. |
| Ecart mesurable 2 | FAIL | Libellé anglais brut `strength` dans la frise (`2 semaines · strength`, `4 semaines · strength`) en UI française. |
| Ecart mesurable 3 | CONSTAT | Programme coach actif : Programmes `Semaine 3 sur 8 · 38 %` vs Entraînement `1 SEMAINE / 0 TOTAL` (deux calculs de progression différents). `Bloc de force` (issu de la chaîne de relance) sans badge `IA` dans Programmes alors que `Bloc de volume` l'a. |

# UAT-RESULTS P24 (run2) - NON-TESTE

Seed "programme echu" non cree ; a faire run3.

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

## Run 6 (2026-11-13, uat/run6)
- Squat -> 'Squat complet barre' sans fixture : PASS (toast non observe)
- Bandeau apres reactivation, B..F : NON-TESTE
Detail : ../../UAT-RESULTS-run6.md

## Run 7 (2026-11-13)
B..F : NON-TESTE (budget)

## Run 8 (2026-11-13)
Programme `Bloc de volume` réactivé par SQL (is_active, results=null), seed 2 séances sur 4 dans la fenêtre.
- Flow A PASS (backend + UI) : `relaunch/check` clôt le programme (`completed_at`, `results.adherence_pct=50`, `hint=consolidate`), bandeau `Programme terminé : Bloc de volume / 2 séances sur 4 prévues / 1 212 kg de volume total` + `Préparer la suite` (`uat-evidence/p24/flowA4.png`, écran `/(app)/workout`), l'atelier s'ouvre sur `BILAN DU PROGRAMME` (`jump squat : 140 -> 142,9 kg`, `La suite consolide ce niveau avant de monter.`).
- Coût absorbé PASS : `propose` -> 1 ligne `ziko_ai_cost_log` source `program_relaunch`, solde 20 -> 20 ; relance `proposed`, brouillon 4 semaines x 3 séances. Idempotence PASS : `check`/`propose` répétés -> `already:true`, journal du faux inchangé, 1 seule ligne cost_log.
- Flow B (partiel) PASS : `publish` du brouillon -> `Bloc de force` `sequence_position=2`, même `sequence_id`, `is_active=false`, AUCUN programme actif. Activation via `Définir comme programme actif` et frise `Ma suite` NON-TESTE.
- Remarque harnais : `check` lancé par l'API avant l'app -> relance `pending`, écran `Préparer la suite` (pas d'auto-propose) ; `?relaunch` génère alors la proposition. Le 2e élément de file du faux (`workshop_set_draft`) doit porter `afterResult:true`.
- Flow C (variantes 100 %/0 séance), D, E (plafond, panne, course), F : NON-TESTE.
