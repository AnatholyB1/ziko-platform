# UAT-RESULTS run 10 (branche `uat/run10`, emulateur ziko-uat-1, branche Supabase `uat-v1-20`)
Arret propre par budget de contexte apres le flow 1 (installation npm lente : 2 passes, la 1re corrompue par un lancement concurrent).
Preuves : `uat-evidence/run10/*.png` (gitignore). Note : "System UI isn't responding" au premier lancement -> Wait, app OK.

## Flow 1 - re-verification fix run 9
| Critere | Verdict | Preuve |
|---|---|---|
| Quete d'eau : progression mise a jour apres log eau SANS ouvrir Recompenses | PASS | quete `Boire 0,5 litre (run10)` (seed SQL) : 2 taps Quick Log eau (250 ml) -> `progress 500`, `status completed`, `rewarded_at` poses ~7 s apres, depuis l'accueil |
| Pieces versees une seule fois (+15) | PASS | `ziko_coin_transactions` source=quest : 1 ligne +15 ; solde 500461 -> 500476 ; ecran Recompenses : `Solde : 500476 pieces`, 2 lignes `+15` (run9 + run10) |
| Reparation de la perte run 9 (migration 2904) | PASS | solde 500446 (fin run 9) -> 500461 avant le test : les 15 pieces perdues de `Boire 1 litre (run9)` ont ete versees |
| Solde de pieces affiche SANS ouvrir Recompenses | NON-TESTE | aucun affichage du solde hors Recompenses ; verifie en base + a l'ouverture de Recompenses |
| Entrainement : programme cree par l'utilisateur, nom reel + provenance | PASS | `Bloc de force` + `Cree par moi`, frise Semaine type A/B/C (train.png) |
| Serie identique accueil / Recompenses / Profil | PASS | `5 jours` (accueil), `5 jours Serie en cours` (Recompenses), `5 Jours d'affilee` (Profil) ; base `current_streak=5` |
| Clavier de l'Atelier | NON-TESTE | contexte epuise (`ziko://workout/atelier`, focus saisie, comparer bounds champ / clavier) |

Ecart maquette : non mesure (flows non atteints).

## Flows 2 a 5 : NON-TESTE (contexte)
P26 LG-1, 7, 12, 23, 24, 25 + question `Activer / Plus tard` ; P16 IM-4, 12, 13 + carte onboarding ; P24 C..F ; P6 D/E, P11 HY-5/6, P15 ME-1/8, P17 SL-3..5, P22 JR-6.
