# 26-factions-ligues - resultats UAT

## Run 6 (2026-11-13, uat/run6)
- LG-17 PASS, LG-21 PASS (403/400/409), LG-19 contribution plafonnee PASS
- LG-18 FAIL : total_hidden ignore, 'Groupe : 0 / 10000 ml' pour 1 participant (rules.ts ~192, cards.tsx)
- LG-22 PARTIEL (403 sur 3 tables ; 2 tables + RPC inconclusifs)
- LG-5 ecart : 'sur 28 habitudes' vs 21
- LG-1..4, 6..16, 20, 23..25 NON-TESTE
Detail : ../../UAT-RESULTS-run6.md

## Run 7 (2026-11-13)
Defi collectif 1 participant : PASS (voir phase 6, `Total masqué (moins de 3 participants)`). LG-1..16, LG-23..25 : NON-TESTE (arret par budget de contexte).

## Run 8 (2026-11-13) - emulateur + faux Anthropic, branche uat-v1-20
Preuves : `uat-evidence/p26/*.png` (gitignore), SQL `rest.mjs`, `uat-evidence/lg.sh`.
- LG-2 PASS : 6 tuiles, `Powerlifting` seule `Suggérée` (goal strength), alerte `Rejoindre Hyrox ?` (2 boutons). Hyrox jamais suggérée non testé.
- LG-3 PASS : `Changer` < 30 j -> alerte `Tu pourras changer le 13/12.`, `changed_at` inchangé.
- LG-4 PASS : `changed_at` antidaté 31 j -> Hyrox rejoint, `changed_at` mis à jour ; aucun texte `membres` (uiautomator = 0 occurrence ; compteur masqué < 10 adultes).
- LG-5 PASS (piste Habitudes, Argent, `Cette semaine : 0 sur 28 habitudes` = 4 habitudes x 7, aide `ne descend jamais de plus d'un cran`). LG-6 PASS (piste Performance, `1 sur 3 séances`).
- LG-8 PASS (SQL `ziko_league_sync`, user B, palier 3, 3 semaines vides) : 3 lignes `outcome=neutral`, division 3, `low_streak=0` ; 3 semaines vides de plus : division 3 ; LG-9 PASS (palier 1, 6 semaines vides : reste 1). Remarque : sur A les semaines avec une séance Performance donnent `hold` (attendu, pas une absence).
- LG-10 PASS : 4 semaines pleines + faux `json {transition:true}` -> modale `Nouvelle piste : Performance`, citation de la raison, UN bouton `Continuer` ; journal faux = 1 appel ; `ziko_ai_cost_log` 1 ligne `league_transition` (25/15 tokens) ; ligne `ziko_league_transitions`.
- LG-11 PASS : `Continuer` -> `celebrated_at` posé, modale absente à la réouverture, ligne `Historique Habitudes : 4 semaines`.
- LG-12 PARTIEL : la modale se réaffiche (retour accueil puis réouverture) ; la puce `Nouveau` de la carte du Fil NON-TESTE. Observation : après `Continuer` l'app a rechargé sur l'écran des notifications (re-prompt `Activer / Plus tard`) - à vérifier si c'est un redémarrage.
- LG-13 PASS : faux `transition:false` -> 1 appel, 1 ligne cost_log ; appels suivants `skipped` (`declined` puis `cooldown`), 0 appel de plus. LG-14 PASS : 3 semaines -> `not_enough_weeks`, 0 appel, 0 ligne. LG-15 PASS : faux arrêté -> écran normal en piste Habitudes, pas de modale, ligne `league_transition` 0 token (`generation_failed`). LG-16 PASS par lecture de `buildTransitionPrompt` (`backend/api/src/league/rules.ts:93` : semaines, moyenne, tier, readiness, expérience uniquement).
- Défi collectif 3+ : PASS après ajout de liens coach ACTIFS (migration 2703 : seuls les participants avec lien actif comptent) : `4 participants`, `Groupe : 4000 / 10000 ml` visible.
- LG-1, LG-7 (coches vertes en UI), LG-23, LG-24, LG-25 : NON-TESTE (budget de contexte).
