# Phase 23 - Plan d'UAT (emulateur + FAUX Anthropic) - Atelier IA de programme

Cible : emulateur `ziko-uat-1`, branche jetable `uat-v1-20` (jamais la prod) avec la migration `20261201230100_ziko_workshop_drafts.sql` appliquee par l'orchestrateur ET les migrations P7 `0701..0704`. Backend local 8200 (voir `UAT-BACKEND.md`), faux Anthropic 8211 (`scripts/uat/fake-anthropic.mjs`). AUCUN appel Anthropic reel dans ce plan ; le 1 appel reel est fait ulterieurement par l'orchestrateur (section Z). File : `queue.sh acquire 23 <flow>`. Preuves : `uat-evidence/23/<flow>/` (PNG 390x844, `uiautomator dump`, logcat, RESULT.txt, journal `GET http://127.0.0.1:8211/__script`).

## Donnees de depart (branche jetable)
Athlete `uat-athlete` : >= 6 seances `ziko_workout_sessions` avec `ziko_session_sets` (squat 140x5, 150x3 ; developpe 100x5), 2 lignes `ziko_ai_generated_programs`, solde credits 14 (`ziko_ai_credit_transactions`), profil rempli. Compte `uat-athlete-0` : 0 credit et quota gratuit du jour consomme.
Rappel faux Anthropic : un marqueur `[[tool:nom {json}]]` dans le DERNIER message utilisateur force UN appel d'outil puis un texte de confirmation. Plusieurs outils dans un tour : file `POST http://127.0.0.1:8211/__script {"tool":"workshop_load_skill","input":{"id":"powerlifting-peaking"},"count":1}` puis `workshop_web_search`, puis `workshop_set_draft` (l'ordre de la file = l'ordre des appels).

## Flow A - ATEL-01 / ATEL-04 etat initial (A11)
1. Seance > "Mes programmes" > "Nouveau" > feuille Creer > "Atelier IA" -> ecran `Atelier IA` (pas `ai-generate`).
2. Dump : titre "Construis ton programme, point par point" ; section "Ce que l'IA sait de toi" avec les puces `N seances`, `N programmes`, `N records` = comptes REELS de la base (comparer a `select count(*)`), aucun faux message ; 3 suggestions ; barre de credits "14 credits" ; saisie "Decris ton objectif".
3. Sous la saisie : texte de cout = `info.cost` (4 aujourd'hui) soit "4 credits par message" ou "1 message gratuit aujourd'hui, puis 4 credits par message". Critere : le texte ne contient PAS "1 credit par message" tant que `CREDIT_COSTS.chat` = 4 (ecart contrat/gate : w2a Q3).

## Flow B - ATEL-02/03/05/06 conversation powerlifter (A10, critere A-6)
1. File faux Anthropic : `workshop_load_skill {id:"powerlifting-peaking"}`, `workshop_web_search {query:"peaking powerlifting 8 weeks"}`, `workshop_set_draft {program: 8 semaines x 3 seances, pct_1rm 75..95, rpe 7..9, rest_seconds 180..300}`.
2. Saisie : "Je prepare une competition de powerlifting, bloc de pic de force sur 8 semaines." Envoyer.
3. Captures pendant le flux : la puce `Recherche web en cours...` / `Skill : Powerlifting : pic de force avant competition` apparait AVANT le texte (ordre dans le dump) ; puis la carte `BROUILLON` avec `S1..S8`, lignes `Lundi · Squat ...` au format `Squat 4x3 a 85 %`.
4. Base : `ziko_workshop_drafts` 1 ligne `status='draft'`, `revision=1`, `program_data.weeks` de longueur 8 ; `ziko_ai_cost_log` : 1 ligne `source='workshop_web_search'` (cout absorbe) + 1 ligne `user_chat` ; `ziko_ai_credit_transactions` : exactement UN debit de 4 (ou quota gratuit consomme), pas de debit pour la recherche web.
5. Journal du faux : la requete contient le contexte (`ATHLETE CONTEXT`, e1RM squat 165 pour les series seed) et la liste de skills.

## Flow C - ATEL-05 edition manuelle sans credit (A12, critere A-6)
1. Solde note (14 ou moins selon A/B). Crayon `Modifier la seance Lundi` > feuille A12 `Squat` : + sur Series, + sur Charge (87,5 %), repos 5 min, "Semaine 3" puis "Toutes les semaines" > `Enregistrer`.
2. Capture : la carte reflete la modif ; base : `revision` +1, la semaine ciblee (ou les 8) modifiee ; solde IDENTIQUE avant/apres (lecture barre + `/credits/balance`) ; journal du faux : AUCUN appel pendant l'edition ; `ziko_ai_cost_log` inchange.
3. `Demander a l'IA` depuis la feuille : la feuille se ferme, la saisie est pre-remplie ("A propos de Squat (S3, Lundi...)") ; rien n'est envoye tant que l'utilisateur n'appuie pas.
4. Conflit : envoyer par curl un PATCH a `revision` perimee -> 409 avec le brouillon courant ; dans l'app, edition sur un ecran obsolete -> alerte "Brouillon mis a jour" et carte rechargee.

## Flow D - ATEL-05 modification par l'IA (live, A13)
1. Chip "Semaine de decharge" ou saisie "Ajoute une semaine de decharge avant la competition". Faux : `workshop_edit_draft {ops:[{op:"update_exercise",week:7,session:0,index:0,patch:{sets:2,pct_1rm:60}}]}`.
2. Pendant le flux : saisie desactivee `L'IA repond...`, bouton Arreter (`accessibilityLabel "Arreter la reponse"`), puce outil `Brouillon modifie`. Apres : la ligne S7 de la carte a change sans rechargement ; `revision` +1.
3. Arreter : relancer, appuyer Arreter pendant le flux -> le flux s'interrompt, ce qui est affiche est conserve, la saisie redevient active.

## Flow E - ATEL-10 credits (A14, A15, critere A-7)
1. A14 reseau : mode avion avant l'envoi (ou arret du backend) -> banniere "La reponse n'est pas arrivee." + "Ton message est conserve et aucun credit n'a ete retire." + `Reessayer` ; solde et `ziko_ai_credit_transactions` inchanges. Reactiver le reseau, `Reessayer` -> le meme message part, le tour aboutit, UN seul debit.
2. A14 panne modele : faux Anthropic arrete en cours de flux avant tout octet utile (ou reponse 529) -> HTTP 502, aucun debit (verifier `ziko_ai_credit_transactions`).
3. A15 : compte `uat-athlete-0` (0 credit, quota consomme) -> envoyer : 402, saisie desactivee, banniere "Plus de credits IA. Tu en gagnes en t'entrainant, ou tu peux en obtenir.", boutons `Obtenir des credits` (ouvre la feuille d'epuisement existante) et `Enregistrer le brouillon` (si un brouillon existe) ; chip de solde "0 credit" en rouge.
4. Edition manuelle restee possible a 0 credit (Flow C sur ce compte avec un brouillon existant).
5. Plafond web : 21e recherche du jour (inserer 20 lignes `source='workshop_web_search'` dans `ziko_ai_cost_log` du jour) -> l'outil repond `daily_cap`, l'IA continue sans web (le faux renvoie le texte de confirmation) ; aucune ligne supplementaire.

## Flow F - enregistrement et activation (lien P7)
1. Sur un brouillon valide : `Enregistrer le programme` -> alerte "Programme enregistre" -> `Definir comme programme actif` -> liste P7 : le programme est present, badge `ACTIF` unique (RPC `ziko_set_active_program`, comptage `is_active` = 1 sur les 2 tables) ; `ziko_workshop_drafts.status='saved'`, `saved_program_id` renseigne.
2. `Plus tard` : programme present dans la liste, INACTIF.
3. Dans l'onglet Seance, le programme enregistre est demarrable (planificateur P6 : jours distincts, exercices). Limite connue P7 : seules les lignes `ziko_ai_generated_programs` sont lues par `workout/index.tsx`, ce qui est le cas ici.
4. Le brouillon n'apparait JAMAIS dans la liste des programmes tant qu'il n'est pas enregistre.

## Flow G - reprise
Quitter l'ecran apres Flow B, rouvrir l'atelier -> le dernier brouillon et l'historique de la conversation sont recharges (`GET /ai/workshop/drafts/:id`), carte identique, revision identique.

## Section Z - 1 appel reel (orchestrateur, apres validation de ce plan)
Un seul tour reel, compte de test, pour verifier : (1) le tool-calling de l'atelier avec le vrai Claude (schemas `workshop_set_draft` acceptes ; sortie normalisable), (2) l'outil natif `webSearch_20250305` via `@ai-sdk/anthropic` 3.0.58 (non prouve par les tests : runner injecte), (3) le cout reel en tokens d'un tour (`ziko_ai_cost_log`) pour trancher G-1 (kind `chat` a 4 credits suffisant ou non). Hors ce tour, jamais d'appel reel.

## Ce que ce plan ne prouve pas
Qualite/pertinence du programme du vrai modele ; limites de tokens d'un programme de 8 semaines ; comportement du flux SSE sur reseau mobile lent (XHR `onprogress` sous Hermes) ; performances de la requete de contexte sur un gros historique.
