# UAT-RUN2 RESUME

Arret propre par budget de contexte. Resultats : `UAT-RESULTS-run2.md` + `phases/NN-*/UAT-RESULTS.md`. Branche `uat/run2`.

## Reprise
1. `git checkout uat/run2` ; copier `.uat/env`, `.uat/apk/ziko-uat-dev.apk`, `apps/mobile/google-services.json` depuis l'integration ; `npm install --no-save` ; `node scripts/uat/make-backend-env.mjs`.
2. `queue.sh acquire`, `emu-start.sh`, Metro (script `uat-evidence/metro.sh` : env branche + API 10.0.2.2:8200, port 8281 ; verifier qu'aucun Metro perime n'occupe 8281), `bash scripts/uat/backend-start.sh`, `dev-open.sh 8281 60` (premier bundle ~110 s : curl du bundle android pour le chauffer).
3. Rejouer `scripts/uat/seed-v1-20.sql` (inclut grants + forme canonique de programme). Etat branche en fin de run : programme coach "Force 5x5" ACTIF (reactiver l'IA via Programmes), amitie A-B acceptee, nuit/mesures/objectif poids/preset timer/quete IA crees.
4. Outils locaux (gitignore) : `uat-evidence/ui.mjs` (dump/tap/text/key/link/shot), `chat.mjs` (POST /ai/chat avec le compte athlete).

## Prochaines phases
P6 (B, D, E, F, seance valide + Q-5), P23 atelier (faux + compte a 0 credit), P24 (seed programme echu), P16 (mesures IA), P13 (Q-5..Q-9), P14 (QA-1..8 avec script `json`), P19 apres correction expo-notifications, P18 routines (creer/lancer), P12 (R-3, R-5, R-8, R-10), P8 (U5-U6, U10-U11, U16), P9 (U1, U12, U15), P21 (session B reelle), comparaison maquettes.
