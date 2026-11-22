# UAT-RUN6 RESUME
Arret par budget de contexte. Resultats : `UAT-RESULTS-run6.md` + `phases/NN-*/UAT-RESULTS.md` (section Run 6). Branche `uat/run6`.

## Reprise
Comme `UAT-RUN5-RESUME.md`. Outils gitignore copies depuis un worktree precedent : `uat-evidence/{ui,chat,api,apic,rest,restw,admin,lg22}.mjs`, `metro.sh`, `net.sh`. Pieges : `MSYS_NO_PATHCONV=1` pour `api.mjs POST /route` ; `ui.mjs dump` echoue pendant l'anneau anime de la seance (utiliser les captures) ; taps perdus si l'emulateur rame (attendre 3 s) ; `ui.mjs link (app)/(plugins)/community/league`.
Etat branche : voir fin de `UAT-RESULTS-run6.md`.

## A faire (priorite)
1. Defauts a faire corriger : `summary.tsx:63` (route inexistante), `total_hidden` du defi collectif, profil non persiste hors ligne (`_layout.tsx:252`).
2. P26 LG-1..16, 20, 23..25 (transition faux Anthropic, absence neutre) ; P16 IM-1..3, 8..12, 14 (faux 2 tours `afterResult:true`).
3. P6 B/D/E/F, P9, P10, P11, P15, P17, P20, P22, P24 B..F, P23 feuille d'epuisement (solde et quota a 0), quete a 21 h, MC-11, mention profil prive, bandeau P24, toast "Exercice remplace".
