# UAT-RESULTS run2 (milestone v1.20, branche `uat/run2` = milestone/v1.20 a 00a5eef8)

Cible : AVD `ziko-uat-1`, APK uat-dev, Metro 8281 (env branche `uat-v1-20`), backend local 8200 (+ faux Upstash 8210, faux Anthropic 8211), base `oloobswzsziidjwycthm`. Methode : liens profonds `ziko://...` + uiautomator (`uat-evidence/ui.mjs`, local) + SQL lecture/fixtures sur la branche de test. Details : `phases/NN-*/UAT-RESULTS.md` (un fichier par phase). Aucune correction applicative. Prod jamais touchee, aucun service reel appele.

## FAIL / BLOQUE nouveaux (hors liste fix/uat-run1)
1. **P19 `supplements/list` crash** "Cannot find native module 'ExpoTopicSubscriptionModule'" : `expo-notifications` hoiste a v56.0.14 resolu depuis `plugins/*` vs natif 0.32.16 de apps/mobile (plugins/supplements/src/lib/notifications.ts ; autres plugins importent aussi expo-notifications). Bloque comparateur/favoris/stack.
2. **P7 `ai-programs/dashboard` crash** (Redbox "Objects are not valid as a React child {w, sessions}") si `program_data.weeks` est un tableau : AIProgramsPlugin.tsx:40 (`getProgramWeeks`) et :44.
3. **P18 migration 1801** : `ziko_stretching_exercises` sans GRANT -> "permission denied" a l'ouverture (a confirmer en prod ; meme symptome sur 3 tables supplements de la branche). Fixtures GRANT ajoutees au seed.
4. **P9 U7 / meme classe que P8 U4** : clavier ouvert masque la barre `meal-action-bar` ("Ajouter N aliments"), visible apres fermeture du clavier (LogMealScreen.tsx).
5. **P9** : `today` memoise au montage (LogMealScreen.tsx:87) -> ecran monte avant minuit ecrit en date de la veille.
6. **P10 / P9** : objectifs kcal divergents (recettes "reste 1 510 kcal" = base 2000 ; repas affiche 2400).
7. **P12** : description `ziko_coin_transactions` contient un emoji (fonction d'achat SQL), masque par l'UI ; libelle "Niveau maximum atteint" au niveau 3 persiste.
8. **P15** : texte coach IA "mesures stables" sans aucune mesure persiste.
9. P14 observation : `quests_create hydration_ml` -> `metric_unavailable` car seul le plugin `coach` est installe dans `ziko_user_plugins` (ecran Hydratation pourtant accessible) : verifier la regle.

## Matrice
| Phase | Verdict run2 |
|---|---|
| P9 repas | PASS (U5-U11, U13) ; U7 FAIL mineur clavier ; U1/U12/U15 NON-TESTE |
| P8 suite | PASS U8, U9, U12, U13, U15, U18 ; U5-U6, U10-U11, U16-U17 NON-TESTE |
| P6 | NON-TESTE (B, D, E, F) |
| P7 | PASS liste, B, C (confirmation d'ecrasement) ; D NON-TESTE ; FAIL ai-programs (2) |
| P11 | PASS HY-7, HY-9 ; reste NON-TESTE |
| P12 | PASS R-1, R-7, R-9 ; R-2/R-6 partiels ; reste NON-TESTE |
| P10 | PASS recettes IA (faux arme) ; courses NON-TESTE |
| P19 | FAIL/BLOQUE (1) |
| P15 | PASS ME-1, ME-2, ME-5 ; reste NON-TESTE |
| P21 | PASS profil complet ; acceptation par B simulee en SQL |
| P13 | PASS Q-1, Q-3, Q-4 (+15 pieces) ; reste NON-TESTE |
| P14 | PASS QA-9, QA-10, QA-11 (faux) ; QA-1..8 NON-TESTE |
| P16, P23, P24 | NON-TESTE |
| P17 | PASS (saisie manuelle, accueil) |
| P18 | BLOQUE puis PASS partiel (grant fixture) |
| P20 | PASS creation preset |
| P22 | PASS journal (humeur Quick Log), Mon coach partiel |
Maquettes : comparaison PNG NON faite (RAM/contexte) ; aucun ecart mesure releve hors couleurs (bouton plein orange fonce visuellement conforme #CF4509).

## Environnement
- Metro 8281 etait occupe par un Metro perime d'un ancien worktree (agent-ac774d6d...), arrete par PID. Premier bundle 112 s. Cold start apres force-stop ~30 s avant rendu.
- Lien profond sur un ecran deja monte ne le remonte pas (etat perime) : force-stop pour valider l'etat reel.
- Minuit franchi pendant le run (UTC) : tuiles du jour remises a zero, test indirect du changement de jour.
