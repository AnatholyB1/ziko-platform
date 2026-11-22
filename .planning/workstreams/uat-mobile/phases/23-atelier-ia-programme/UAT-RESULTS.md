## Run 9 (2026-11-13, UI émulateur + faux Anthropic) - atelier A, D, E (partiels)
Route `ziko://(app)/workout/atelier`. Captures `uat-evidence/run9/a1.png`, `a4.png`, `e1.png`, `e2.png`, `e3.png`.
| Id | Verdict | Détail |
|---|---|---|
| A - vue initiale | PASS | Titre `Construis ton programme, point par point`, chip `20 crédits`, `9 séances / 5 programmes / 2 records`, 3 suggestions, champ `Décris ton objectif`, `4 crédits par message`. |
| B - conversation avec le faux | PASS | Message saisi par adb, file `workshop_set_draft` : carte `Atelier run9 · BROUILLON · 2 séances par semaine · 1 semaine` (Lundi Haut du corps, Mercredi Bas du corps), chip `Brouillon mis à jour`, résultat outil `revision:1`. Le texte du faux (« C'est fait (reponse simulee...) ») s'affiche tel quel : attendu avec le faux. |
| C - débit du tour | BLOQUE/A CONFIRMER | Solde `20 -> 20` après le tour (`/credits/balance`), alors que l'écran annonce 4 crédits/message ; probablement quota gratuit du jour (`withinFreeQuota`, `routes/workshop.ts:67`) mais non prouvé (colonne du journal de coût non lue). Autre incohérence : `daily_earned:6` > `daily_cap:4` sur `/credits/balance`. |
| D - édition manuelle sans débit | PASS | Crayon Lundi > Séries `+` > `Enregistrer` : carte `Developpe couche 5x6` (avant 4x6), solde inchangé (20), aucun nouvel appel au faux. |
| E - Enregistrer = programme INACTIF, 2 clics concurrents = 1 programme | PASS | 2 taps simultanés (`input tap ... & input tap ...`) : 1 seule ligne `Atelier run9` dans `ziko_ai_generated_programs`, `is_active=false`, modale `Programme enregistré · Définir comme programme actif / Plus tard`. |
| F - (clavier) | FAIL (mesuré) | Clavier ouvert : le champ `Décris ton objectif` (y 1892-2016) est recouvert par le clavier (début y=1580) ; la zone de saisie n'est pas remontée (pas de KeyboardAvoiding/adjustResize), le bouton Envoyer n'est plus atteignable sans fermer le clavier (touche Retour). A vérifier sur un vrai appareil. |
| Maquette | ECART | `5 programmes` (atelier) vs `Tous 6` (liste Programmes) : compteurs divergents. |

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

## Run 7 (2026-11-13)
Feuille d'epuisement (solde 0 + quota 0) et quete creee a 21 h : NON-TESTE (budget)

## Run 8 (2026-11-13)
- Feuille d'épuisement PASS : solde 0 (`ziko_user_ai_credits.balance=0`, quota du jour déjà consommé : `daily_earned 6 / cap 4`), puce `0 crédit` rouge, envoi d'un message -> feuille `Crédits IA épuisés / Complète des activités pour gagner des crédits` (6 activités listées, `Réinitialisation dans 5h 46m`), en français (`uat-evidence/p23/exhaust2.png`). Solde remis à 20 ensuite.
- Atelier A..F restants : NON-TESTE (budget).
