# UAT-RUN11 RESUME
Resultats : `UAT-RESULTS-run11.md`. Branche `uat/run11`, worktree `C:\ziko-platform\.claude\worktrees\uat-run11`.

## Reprise (comme `UAT-RUN10-RESUME.md`)
- `.uat/env`, `.uat/apk`, `apps/mobile/google-services.json`, `uat-evidence/*.mjs|sh` copies depuis `integration-v1.20` / `agent-a6eadaee128c96dfe` ; UN SEUL `npm install --no-save` (fait, ~963 paquets) ; `node scripts/uat/make-backend-env.mjs`.
- `bash scripts/uat/queue.sh acquire 99 run11` ; `bash scripts/uat/emu-start.sh --wait 400` ; `bash uat-evidence/metro.sh` (premier bundle ~130 s apres `--clear`) ; `bash scripts/uat/backend-start.sh` ; `bash scripts/uat/dev-open.sh 8281 25` (2 fois) ; `Wait` sur `System UI isn't responding` (tap 220,1362).
- SQL : `supabase db query --linked --project-ref oloobswzsziidjwycthm "<sql>"` (une seule requete par appel : seule la derniere est renvoyee). Helper jetable `../q.sh` a recreer.
- Pieges nouveaux : `ziko://community` = Unmatched ; utiliser `(app)/(plugins)/community/dashboard|league` ; `ui.mjs link '(app)/...'` AVEC apostrophes sous Git Bash ; `adb input keyevent 111` (Echap) ferme la feuille de saisie ; fermer l'alerte `Mesure enregistree` (`OK`) avant la saisie suivante ; `curl` Git Bash corrompt les accents dans `/__script` (utiliser `\u00e9`) ; la ligne bandeau `Hors ligne`/`Action non enregistree` est en haut du defilement.
- Heure : emulateur en GMT, la base raisonne en Europe/Paris (voir constat DATES dans les resultats).

## Etat branche apres run 11
A (`a0a0a0a0-...a1`) : tier 3, piste Performance Bronze (transition acquittee), faction Hyrox, age 30, solde credits 20, 0 quete libre (3 actives : `4 seances`, `taille`, + ...). Programme `Bloc echu C` (id d6240000-...-c1) CLOS ; `Bloc de force` REACTIVE ; relance `pending`, plafond du jour atteint ; file du faux : `workshop_set_draft` restant. Migrations 2906/2907 appliquees sur la branche de test. Faux Anthropic : relance normale (8211), file vide. Ligue de A : etat supprime (recree a l'ouverture, tier 3). Logs d'habitudes 12 oct -> 8 nov restaures (112).

## A faire (non joue)
P16 carte d'onboarding (IM-1..3, nouvel utilisateur) ; P24 C 100 %/50 %, D2, E1 message paye, E3 (`UAT-PLAN.md` de la phase) ; P6 D (jours explicites), E (depuis l'Accueil) ; P11 HY-5 (objectif atteint) ; P15 ME-1 (compte neuf) ; P17 SL-4 (compte C avec source connectee) ; P22 JR-6 (JWT court requis) ; solde de pieces hors Recompenses ; contraste numerique des boutons pleins.

## Etape 2 : expo install --check + EAS (2026-11-15)
- `npx expo install --check` signalait 10 ecarts dont 3 MAJEURS (paquets SDK 55 sur un projet Expo ~54) : `expo-build-properties ^55.0.10`, `expo-document-picker 55.0.13`, `expo-image-manipulator ^55.0.13` (+ `~13.1.7` dans `plugins/nutrition`). CORRIGE (commit `e62d805e`) : `~1.0.10`, `~14.0.8`, `~14.0.8`, `~14.0.8` ; `expo-document-picker ~14.0.8` declare aussi dans `plugins/ai-programs` (qui l'importe). Lockfile regenere avec `npm install --legacy-peer-deps` (pairs react 19.1 mobile / 19.2 web : un `npm install` simple re-resout tout l'arbre et echoue en ERESOLVE) ; entrees imbriquees perimees `apps/mobile/node_modules/expo-image-manipulator*` retirees du lock. `tsc` mobile OK, 579 tests OK (nutrition, ai-programs, community, mobile).
- A SURVEILLER : la CI lance `npm install` (sans `--legacy-peer-deps`) : verifier que `ci.yml` passe sur la PR ; sinon ajouter `legacy-peer-deps=true` dans un `.npmrc` (decision a prendre).
- Reste (7 ecarts de PATCH, non bloquants) : expo 54.0.33 -> ~54.0.37, expo-constants, expo-font, expo-image-picker, expo-linking, expo-router, expo-updates. Non corriges : le premier essai a casse la resolution des pairs.
- REBUILD EAS : NON FAIT. `eas-cli` absent et connexion Expo requise (utilisateur) : taper `! npx eas-cli login` puis, depuis `apps/mobile`, `npx eas-cli build --platform android --profile production` (et `ios`). Le dev-client UAT (apk) embarque encore les anciens modules natifs SDK 55 : a reconstruire (`--profile uat-dev`) avant de retester l'avatar / la photo de repas / l'import de fichier.
