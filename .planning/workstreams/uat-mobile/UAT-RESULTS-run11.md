# UAT-RESULTS run 11 (branche `uat/run11`, emulateur ziko-uat-1, branche Supabase `uat-v1-20`)
Preuves : `uat-evidence/run11/*.png` (gitignore). Faux Anthropic local (8211), aucun appel reel.
Note : "System UI isn't responding" au premier lancement -> Wait, app OK (comme run 10).

## Flows joues
| Flow | Critere | Verdict | Preuve |
|---|---|---|---|
| Atelier | Clavier : champ + mention `1 message gratuit...` restent au-dessus du clavier | PASS | `atelier-kbd.png` : champ y 1320-1445, mention y~1490, clavier des y~1580 |
| P26 LG-1 | A tier 2 : carte `Ligue` sous-titre `Se debloque au palier 3` ; ecran `Ligue verrouillee` + `Elle s'ouvre au palier 3. Continue a ton rythme.` ; aucune barre/compteur ; aucune ligne `ziko_league_state` | PASS | `lg1-fil.png`, `lg1-locked.png`, SQL count=0. Ecart de vocabulaire volontaire : `palier` (fix run 9) au lieu de `niveau` du plan |
| P26 LG-7 | A habitudes, 2 semaines pleines closes : `Argent`, 2 points remplis, 2 coches vertes ; base `division=2`, 2 lignes `ziko_league_weeks` hold/up | PASS | `lg7.png`, SQL : 26 oct `hold` score 100, 2 nov `up` 1->2. Non verifie : `ziko_user_gamification` avant/apres (pas de snapshot) |
| P26 LG-10 | 4 semaines pleines + faux `transition:true` : modale `Nouvelle piste : Performance`, citation, UN seul bouton `Continuer` ; 1 ligne `ziko_league_transitions` `decided_by=ai`, `celebrated_at` NULL ; 1 appel `json` au faux ; 1 nouvelle ligne `ziko_ai_cost_log` `league_transition` ; solde credits inchange (20) ; piste Performance, Bronze | PASS | `lg10-modal.png`, journal du faux, SQL. Les `�` dans la citation viennent tres probablement du `curl` Git Bash (encodage console) : a rejouer avec `é` echappes avant de conclure |
| P26 LG-11 | `Continuer` : modale fermee, `celebrated_at` pose, ligne `Historique Habitudes : 4 semaines` | PASS | `lg11-after.png`, SQL ack=true |
| P26 LG-12 | Sortie de l'app sans `Continuer` : la modale se reaffiche ; carte du Fil : puce `Nouveau` | PASS | `lg12-reopen.png`, `lg12-fil2.png` (`Hyrox · Bronze` + `Nouveau`) |
| P26 LG-23 | A `age=15`, faction Hyrox avec 10 adultes : ecran, compteur | ECART | `lg23-minor.png` : l'ecran affiche `10 membres` (11 en base, le mineur n'est pas compte, aucune personne listee) -> conforme a D-12 (compteur = adultes seulement, >= 10) mais CONTRAIRE au libelle du plan `compteur de faction jamais affiche`. DECISION a prendre : masquer le compteur aux mineurs, ou corriger le plan |
| P26 LG-24 | Hors ligne apres chargement : tirer pour rafraichir -> `Hors ligne` ; `Rejoindre` -> `Action non enregistree` | PASS | `lg24-offline.png`, `lg24-action-top.png` (le bandeau est en haut du defilement : invisible si l'ecran est scrolle) |
| P26 LG-25 | Zones tactiles >= 44 dp ; texte >= 12 sp ; `paddingBottom` | PASS (partiel) | cibles `Changer` 61x44, `Quitter ce defi` 345x44, `Rejoindre` > 44 (dump, densite 420) ; aucun `fontSize` < 12 dans `LeagueScreen.tsx` ; dernier bloc visible au-dessus des onglets (`lg25-bottom.png`). NON mesure : ratio de contraste numerique de `Rejoindre` ; bouton dev `Signaler un bug` 37x36 dp (surcouche de dev, hors ecran) |
| Notification | `Activer / Plus tard` apres `Continuer` sur la modale de ligue | NON REPRODUIT | ni apres `Continuer`, ni apres redemarrage a froid (run 8 l'avait vu) |

## Constats
- Fil / carte Ligue : si l'ecran Fil est deja monte, un changement de palier fait en base n'est pas relu (carte `Se debloque au palier 3` perimee) tant que l'app n'est pas redemarree. Realiste seulement hors scenario normal (palier change par SQL) : NOTE, non bloquant.
- Piege harnais : `ziko://community` seul = Unmatched Route ; utiliser `(app)/(plugins)/community/dashboard` (Fil) ou `.../league`.

## NON TESTE (suite)
P26 LG-8, 9, 13-16 non rejoues ; P16 IM-4, 12, 13 + carte onboarding ; P24 C..F ; P6 D/E ; P11 HY-5/6 ; P15 ME-1/8 ; P17 SL-3..5 ; P22 JR-6 ; solde de pieces hors Recompenses.

## Etat de la branche de test apres run 11
A : tier 3, piste Performance Bronze (transition acquittee), faction Hyrox, age 30, 5 semaines de logs d'habitudes (12 oct -> 8 nov), solde credits 20. Comptes `uat-lg23-*` crees puis supprimes.
