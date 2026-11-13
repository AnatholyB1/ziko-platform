# UAT-RESULTS P23 (run2) - NON-TESTE

A faire run3 : `workout/atelier` avec faux Anthropic + test "compte a 0 credit". Note : `ziko_workshop_drafts` sans GRANT authenticated/anon (privileges Dxtm seulement) : verifier que l'ecran passe par le backend.

## Run3 (2026-11-13)
GRANT : `ziko_workshop_drafts` sans privilege -> `POST /ai/workshop/stream` = 500 `setup_failed` jusqu'a fixture branche (classe GRANT v1.20 connue). Limite du faux : un seul outil par requete (apres un tool_result il repond du texte) : skill -> recherche -> set_draft = 3 tours, pas 1.
| Flow | Verdict | Detail |
|---|---|---|
| A etat initial | PASS | "Construis ton programme, point par point", puces "3 seances / 2 programmes / 1 record" (3 seances en base dont la vide ; 2 programmes = 1 IA + 1 coach), 3 suggestions, "4 credits par message" (pas "1 credit"), solde (`23/A-atelier-0.png`). |
| B conversation | PARTIEL | Tour 1 : puce "Skill : Powerlifting : pic de force avant competition" (start/done) avant le texte (SSE). Tour 2 : `workshop_set_draft` -> draft rev1, 8 semaines x 3 seances ; carte "Pic de force 8 sem / 3 seances par semaine · 8 semaines", "Lundi · Squat S1 / Barbell Squat 4x3 a 75 %". Recherche web NON jouee. Credits : tours en lignes `quota` amount 0, solde 14 inchange, 1 ligne `user_chat` par tour. ANOMALIE : a solde 0 le 402 annonce `daily_used 3 / daily_quota 3`, puis apres remise du solde a 14 les tours passent en "quota" sans debit : le quota gratuit ne semble pas borne par `daily_quota` (a investiguer, creditGate/getQuotaStatus). |
| C, D, E1, E2, E5 | NON-TESTE | |
| E3 (A15) COMPTE A 0 CREDIT | PASS | Solde mis a 0 (UPDATE `ziko_user_ai_credits`) : `/ai/workshop/info` balance 0, free_left 0 ; stream -> 402 `insufficient_credits` (required 4), AUCUNE ligne `ziko_ai_credit_transactions` (8 avant/apres), 0 appel au faux, 0 ligne cost_log. UI : envoi -> feuille d'epuisement ("Credits IA epuises", gains, "Reset dans 22h 35m", Fermer) puis banniere "Plus de credits IA. Tu en gagnes en t'entrainant, ou tu peux en obtenir." + "Obtenir des credits" (`23/E3-zero-credit.png`, `E3-after-close.png`). Ecarts : feuille d'epuisement en ANGLAIS sans accents ("Log a workout", "Credits IA epuises") ; chip rouge non verifie ; "Enregistrer le brouillon" absent faute de brouillon (normal). |
| F enregistrement | PARTIEL | publish -> programme cree, draft `saved` + `saved_program_id`, programme INACTIF. Activation / badge ACTIF / liste P7 NON-TESTE. NB : le programme publie a `program_data.weeks` en TABLEAU = forme qui plante `ai-programs/dashboard` (bug P7 connu, fix/uat-run2). |
| G reprise | PASS | Apres force-stop, l'atelier recharge historique (2 messages + reponses), "Contexte : 3 seances, 2 programmes" et la carte brouillon (`23/G-reprise.png`). |
