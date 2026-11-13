# UAT-RUN5 RESUME
Arret propre par budget de contexte. Resultats : `UAT-RESULTS-run5.md` + `phases/NN-*/UAT-RESULTS-run5.md`. Branche `uat/run5`.

## Reprise
Comme `UAT-RUN4-RESUME.md` : `git checkout uat/run5`, copier `.uat/env` (contient desormais `UAT_ATHLETE_B_*`), `.uat/apk/ziko-uat-dev.apk`, `apps/mobile/google-services.json` depuis `integration-v1.20`, `npm install --no-save`, `node scripts/uat/make-backend-env.mjs` (pas de `.env.uat` dans l'integration), outils gitignore `uat-evidence/{ui,chat,api,apic,rest,restw,admin}.mjs`, `metro.sh`, `net.sh on|off` (copier depuis un worktree precedent ; `ui.mjs link` : passer `(app)/(plugins)/x` SANS guillemets ; l'ecran garde son etat en cache : relancer via `dev-open.sh 8281 20` pour relire la base).
Etat branche : voir fin de `UAT-RESULTS-run5.md` (coach programme actif, fixture Back Squat, amitie A-B acceptee).

## A faire (priorite)
1. P26 LG-8/9 (absence neutre) et LG-10/13/14 (transition avec le faux, `scripts/uat/p26-league-sql/run.mjs`), LG-17..20 (defi collectif, jeton coach).
2. P16 IM-1..3, 8..12, 14 (faux 2 tours `afterResult:true`).
3. P6 A..F, accueil (kcal, FR, FAB), P9, P10, P11, P15, P17, P20, P22, P24 B..F, P23 + feuille d'epuisement (solde et quota a 0).
4. Rapporter/corriger : alias Back Squat absent du catalogue, MC-11 (`store/index.tsx:405`), statut "Pas encore demarre", bandeau relaunch, "Aucun programme actif" accueil.
