# UAT-RUN4 RESUME
Arret propre par budget de contexte. Resultats : `UAT-RESULTS-run4.md` + `phases/NN-*/UAT-RESULTS-run4.md`. Branche `uat/run4`.

## Reprise
Comme `UAT-RUN3-RESUME.md` : `git checkout uat/run4`, copier `.uat/env`, `.uat/apk/ziko-uat-dev.apk`, `apps/mobile/google-services.json` depuis l'integration, `npm install --no-save`, `node scripts/uat/make-backend-env.mjs`, copier `uat-evidence/{ui,chat,api,apic,rest,metro,login}` depuis un worktree precedent (gitignore ; `apic.mjs` = api.mjs avec compte coach, `rest.mjs` = GET REST service role). Etat branche : athlete SANS lien coach actif, faction Powerlifting, 11 plugins actives, programme "Bloc de volume" actif (completed_at non nul), solde 20.

## A faire (priorite)
1. P23 quota : debugger pourquoi `trackQuotaUsage` n'ecrit pas (ledger apres chaque chat) puis feuille d'epuisement en francais (solde 0 + quota atteint).
2. Re-creer un lien coach actif (INSERT fixture) puis P7 ecrasement du programme coach avec confirmation, P25 MC-4/6/11/13, retrait via le bouton mobile.
3. P6 A..F (seance valide, mode libre), invalidation accueil apres seance, kcal accueil, noms FR, FAB.
4. P13/P14 (quete creee a 21 h, expirees, relais IA), P26 LG-* (faux Anthropic), P24 B..F, P16 IM-*, P10, P11, P15, P17, P20, P22, P21 (login B).
