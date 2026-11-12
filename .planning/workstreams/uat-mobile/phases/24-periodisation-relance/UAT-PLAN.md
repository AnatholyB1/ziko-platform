# Phase 24 - Plan d'UAT (emulateur + FAUX Anthropic) - Periodisation et relance automatique

Cible : emulateur `ziko-uat-1`, branche jetable `uat-v1-20` (jamais la prod) avec appliquees par l'orchestrateur : migrations P7 `0701..0704`, P23 `2301`, P24 `202612012401` PUIS `202612012402`. Backend local 8200 (voir `UAT-BACKEND.md`), faux Anthropic 8211. AUCUN appel Anthropic reel. File : `queue.sh acquire 24 <flow>`. Preuves : `uat-evidence/24/<flow>/` (PNG 390x844, `uiautomator dump`, logcat, RESULT.txt, journal `GET http://127.0.0.1:8211/__script`).

## Donnees de depart (seed SQL sur la branche jetable, fin de programme SIMULEE)
Athlete `uat-athlete` : 1 programme `ziko_ai_generated_programs` ACTIF `Bloc de volume`, `program_data.weeks` = 2 semaines x 2 seances, `days_per_week=2`, `started_at = now() - interval '30 days'` (donc echu : 2 semaines de duree), `completed_at null`. 4 seances `ziko_workout_sessions` terminees dans la fenetre (`ended_at` non nul) avec `ziko_session_sets` squat 120x5, 122,5x5 (premiere moitie), 130x5, 135x5 (seconde moitie). Variante B : meme programme mais `started_at = now() - interval '2 days'` (en cours). Variante C : 0 seance. Compte `uat-athlete-2` sans programme actif.
File faux Anthropic (avant le flow A) : `POST /__script {"tool":"workshop_load_skill","input":{"id":"powerlifting-volume-block"},"count":1}` puis `{"tool":"workshop_set_draft","input":{"program":{ 4 semaines x 3 seances, pct_1rm 70..85, rpe 7..8 }},"count":1}`.

## Flow A - ATEL-09 relance automatique a la fin d'un programme (seed echu)
1. Ouvrir l'onglet Seance. Attendu : le bandeau `Programme termine : Bloc de volume` apparait (carte, icone drapeau, 2 premieres lignes de bilan `4 seances sur 4 prevues`, `... kg de volume total`), puis passe de `L'atelier prepare la suite...` (spinner) a `La suite est prete, a relire dans l'atelier.` avec le bouton plein (couleur `getActionPrimary`) `Voir la suite`.
2. Base : `ziko_ai_generated_programs` `Bloc de volume` : `is_active=false`, `completed_at` renseigne, `sequence_id` non nul, `sequence_position=1`, `results.sessions_done=4`, `results.adherence_pct=100`, `results.hint='progress'`, `results.lifts[0].exercise='Squat'` ; `ziko_program_sequences` 1 ligne ; `ziko_program_relaunches` 1 ligne `status='proposed'` ; `ziko_workshop_drafts` 1 ligne `status='draft'`, `previous_program_id` = programme, `program_data.weeks` de longueur 4 ; AUCUN programme `is_active=true` (le suivant n'est pas active).
3. Journal du faux : exactement UN appel (+ tours d'outil) ; la requete contient `PREVIOUS PROGRAM RESULTS`, `Squat`, la regle `Never frame the previous program as a failure` ; la liste des outils NE contient PAS `workshop_web_search`.
4. Credits : `ziko_ai_credit_transactions` et le solde affiches/lus via `/credits/balance` IDENTIQUES avant/apres (aucun debit) ; `ziko_ai_cost_log` : 1 ligne `source='program_relaunch'`, 0 ligne `user_chat` supplementaire.
5. Appuyer `Voir la suite` : l'atelier s'ouvre sur la carte `BILAN DU PROGRAMME` (7 -> ici 4 seances sur 4, `Squat : 116,7 -> 128,3`...) puis la conversation (message `Mon programme est termine...` + reponse du faux) et la carte BROUILLON du programme suivant. L'edition manuelle reste possible sans credit (Flow C de P23).
6. Retour Seance, rouvrir l'onglet : le bandeau est toujours la (relance ouverte), AUCUN second appel au faux (journal inchange), aucune nouvelle ligne `relaunches`/`drafts`/`cost_log` (idempotence).

## Flow B - ATEL-07 suite ordonnee, un seul actif
1. Dans l'atelier (Flow A), `Enregistrer le programme` -> `Definir comme programme actif`. Base : le nouveau programme a `sequence_id` identique, `sequence_position=2`, `is_active=true` ; l'ancien reste `is_active=false` ; `select count(*) where is_active` sur les 2 tables = 1.
2. Ecran `Ma suite de programmes` (ligne `Ma suite` de l'onglet Seance) : frise `1. TERMINE Bloc de volume`, `2. EN COURS <nouveau>` (bord primaire) ; le bilan du programme termine est affiche sous la frise. Un seul `EN COURS`.
3. `Plus tard` puis `Enregistrer` sans activer : programme inactif en position 2, statut `SUIVANT` ; l'onglet Seance affiche `Aucun programme actif` + lien `Mes programmes` (pas d'activation automatique).

## Flow C - ATEL-08 le suivant depend des resultats (3 variantes)
1. Seed 100 % d'adherence : `results.hint='progress'` ; prompt du faux contient `Suggested direction ... progress`.
2. Seed 2 seances sur 4 (50 %) : `consolidate`. Seed 0 seance (variante C) : programme quand meme cloture, bilan `Aucune seance enregistree sur cette periode : la suite repart d'une base douce.`, `hint='reentry'`, relance et brouillon crees normalement.
3. Verifier textuellement dans les 3 dumps : aucun mot `echec`, `rate`, `manque`, `retard`, `penalite`.

## Flow D - non punitif (critere dur)
1. Variante C (0 seance) : avant/apres, soldes credits, XP/niveau, pieces, serie (`ziko_user_xp`, serie dans l'accueil) IDENTIQUES ; aucune ligne dans les tables de credits/gamification. Le programme est simplement `TERMINE`.
2. `Plus tard` sur le bandeau : il disparait pour la session ; aucun effet en base. Rouvrir : bandeau de retour. `POST /ai/workshop/relaunch/<id>/dismiss` (curl) : plus de bandeau, plus d'appel IA possible (409 sur `/propose`).

## Flow E - plafond et panne (appel automatique absorbe)
1. Plafond : inserer 1 ligne `ziko_ai_cost_log` `source='program_relaunch'` datee d'aujourd'hui avant le seed echu -> ouvrir Seance : bandeau `Programme termine` avec bouton `Preparer la suite` (pas de spinner infini), journal du faux VIDE ; `Preparer la suite` ouvre l'atelier avec le bilan, brouillon vide, vue initiale ; envoyer un message : tour paye normalement (`creditCheck/creditDeduct('chat')`, un debit), et le prompt contient `PREVIOUS PROGRAM RESULTS`.
2. Panne : arreter le faux Anthropic avant d'ouvrir Seance (ou reponse 529) -> bandeau `Preparer la suite`, relance `status='pending'`, aucun debit ; relancer le faux puis rouvrir l'atelier avec `?relaunch` -> la proposition est generee (1 appel), `status='proposed'`.
3. Course : ouvrir l'atelier via le bandeau PENDANT que la proposition est en cours (spinner) -> un seul appel dans le journal du faux.

## Flow F - non-regression
Programme en cours (variante B) : aucun bandeau, aucune ecriture, aucun appel au faux ; l'onglet Seance, la liste P7 et l'atelier P23 se comportent comme avant (le brouillon de relance n'apparait pas dans la liste P7). Compte sans programme actif : pas de bandeau, pas d'erreur.

## Section Z - 1 appel reel (orchestrateur, apres validation de ce plan)
Un seul tour reel `propose` sur un compte de test avec un programme echu seede : verifier (1) que le vrai Claude ecrit un programme suivant valide via `workshop_set_draft` SANS recherche web et avec un ton neutre, (2) le cout reel en tokens du tour (`ziko_ai_cost_log`, `source='program_relaunch'`) pour juger le plafond `PROGRAM_RELAUNCH_DAILY_CAP=1`, (3) que la direction proposee suit `results.hint`.

## Ce que ce plan ne prouve pas
Qualite et pertinence du programme suivant du vrai modele ; comportement en vrai fuseau/ouverture d'app a la minute ou la fin tombe ; lien exact des seances d'un programme IA (fenetre de dates, pas de `program_id`) sur un historique reel ; rendu et accessibilite (44 dp, libelles) des ecrans sans maquette.
