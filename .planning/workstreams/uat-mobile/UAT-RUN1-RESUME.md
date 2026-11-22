# UAT-RUN1 RESUME

Arret propre par budget de contexte. Resultats : `UAT-RESULTS-run1.md` (meme dossier). Branche `uat/run1`.

## Reprise
1. `git checkout uat/run1` ; copier `.uat/env`, `.uat/apk/ziko-uat-dev.apk`, `apps/mobile/google-services.json` depuis le worktree d'integration ; `npm install --no-save`.
2. `bash scripts/uat/queue.sh acquire ...`, `emu-start.sh`, Metro (voir README, port 8281, premier bundle ~140 s), `dev-open.sh 8281 60`, login via `.maestro/demo-login-nav.yaml`.
3. Methode rapide : liens profonds `adb shell am start -a android.intent.action.VIEW -d ziko://<route>` + `uiautomator dump` (helpers dans le scratchpad de l'agent, a recreer : dump -> texte+centre).
4. Seed : relancer `scripts/uat/seed-v1-20.sql` (remplacer `__ATHLETE_B_PASSWORD__`) ; habitudes : 4 lignes `ziko_habits` (type `boolean|count`).

## Prochaines phases (dans l'ordre)
P9 repas (non commence), puis finir P8 (U5-U6, U8-U13, U15-U18 ; poids bloque par le clavier), P6 (B, D, E, F), P11 (reglages), P7 (B-D avec SWITCH_COACH), P12 (R-3..R-10), P10, P19 (comparateur), P15 (saisie), P21 (changer de compte -> B accepte, profil complet), P2 U1 en attente reelle > 1 h, P5 XCUT-04/05. Comparaison aux maquettes lots A-F a faire (PNG a regenerer).
