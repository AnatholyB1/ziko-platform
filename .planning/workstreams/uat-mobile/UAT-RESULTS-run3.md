# UAT-RESULTS run3 (2026-11-13, branche `uat/run3` = milestone/v1.20)
Cible : AVD ziko-uat-1, Metro 8281, backend local 8200 + faux Upstash/Anthropic, branche Supabase `uat-v1-20`. Aucun appel Anthropic reel, prod jamais touchee. Details : `phases/NN-*/UAT-RESULTS-run3.md` (P25 : `UAT-RESULTS.md`).

## FAIL nouveaux
1. **P25 MC-8 (MAJEUR)** : le retrait du coach cote athlete ne revoque rien. `backend/api/src/coach/clients/service.ts:298` (DELETE `/links/:clientId`, coach) masque `:313` (DELETE `/links/:id`, athlete) : 0 ligne modifiee, reponse 200 `{ok:true}`, l'app affiche "Coach retire" mais le lien reste actif.
2. **P23/credits (a investiguer)** : a solde 0 le 402 annonce `daily_used 3/daily_quota 3` ; apres remise du solde, les tours passent en quota gratuit (lignes `quota`, montant 0) sans debit : quota gratuit non borne ?
3. **P23 UX** : feuille d'epuisement de credits en anglais sans accents ("Credits IA epuises", "Log a workout...").
4. GRANT (classe deja suivie par fix/uat-run2, a verifier couvrir) : `ziko_workshop_drafts`, `ziko_program_sequences`, `ziko_program_relaunches` sans aucun privilege (500 `setup_failed`) ; `service_role` sans privilege sur `ziko_athlete_goals`/`ziko_goal_revisions`.
5. P24 observation : bilan "Squat" rapproche de "jump squat" (rapprochement flou d'exercice).
6. `/forms/athlete/forms/pending` -> 500 : relation `ziko_form_instances` -> `coach_forms` introuvable (devrait etre `ziko_coach_forms`) ; vu au journal backend, hors perimetre des phases.

## Matrice
| Phase | Verdict run3 |
|---|---|
| P6 | B PASS, D PASS, E PASS (accueil), F PARTIEL (statique) ; A, C PASS run1 |
| P16 | PARTIEL : IM-4/5/6/7 PASS par effet ; reste NON-TESTE |
| P23 | A PASS, E3 (0 credit) PASS, G PASS ; B/F PARTIEL ; C, D, E1-2/5 NON-TESTE |
| P24 | A.2/A.6 PASS (base, idempotence) ; bandeau UI NON-TESTE (emulateur fige) ; reste NON-TESTE |
| P25 | MC-1,2,3,5,7,9,10,12 PASS ; MC-8 FAIL ; MC-4 partiel ; MC-6/11/13 NON-TESTE ; 7 attaques RLS toutes bloquees |
| P12 Succes "5 sur 12", P6/P8 clavier poids | NON-TESTE (budget) |

## Environnement
- Emulateur fige (screencap/uiautomator sans reponse) apres ouverture de l'onglet Seance avec relance ouverte ; `emu-stop` + `emu-start` ont suffi. Premier bundle Metro ~117 s puis dev-client en timeout, relance OK. Un "System UI isn't responding" -> Wait.
- Limite du faux Anthropic : un outil par requete.
- Outils locaux (gitignores) : `uat-evidence/{ui,chat,api,q23,rls25}.mjs`.
