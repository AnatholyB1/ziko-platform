# UAT-RUN7 RESUME
Arret propre par budget de contexte. Resultats : `UAT-RESULTS-run7.md` + `phases/NN-*/UAT-RESULTS.md` (section Run 7). Branche `uat/run7`.

## Reprise
Comme `UAT-RUN6-RESUME.md`. Outils gitignores copies depuis `agent-a6eadaee128c96dfe` : `uat-evidence/{ui,api,apic,chat,rest,restw,admin,lg22,q23,rls25,logout}.mjs`, `metro.sh`, `net.sh`, `login.sh`. Metro : `bash uat-evidence/metro.sh` (la 1re compilation prend ~10 min ; ouvrir l'app seulement apres "Bundled"). Connexion apres `pm clear` : `login.sh` (Maestro) echoue ; saisir email/mot de passe par `adb input text` depuis `.uat/env`, `Plus tard` sur l'ecran notifications.
Pieges nouveaux : un lien profond `ziko://(app)/(tabs)` donne Unmatched (utiliser `(app)`) ; le JWT reste valide apres `logout?scope=global` (pas d'expiration simulable en < 1 h) mais le backend 401 ; la camera virtuelle ne scanne pas de code-barres.
Etat branche : athlete A connecte, programme actif `Force 5x5, bloc 2` (0 jour), preset timer `UAT7`, `Cotes 400 m`, `Tab7`, objectif poids 70,5 -> 68 en cours, 1 nuit de sommeil 7,75 h, defi `Defi eau du groupe` rejoint (1 participant).

## A faire (priorite)
1. P26 LG-1..16, 23..25 (transition faux, absence neutre 3 semaines), P16 IM-1..3, 8..12, 14 (faux 2 tours `afterResult:true`), P24 B..F, P23 feuille d'epuisement, quete a 21 h.
2. P6 D (activer `UAT Full Body 3x8`) et E (Recent), P15 ME-1/8, P17 SL-3..5, P22 JR-6 (reduire jwt_exp ou attendre), CO-1b..5, P11 HY-5/6.
3. Defauts a faire corriger : HY-2 (tuiles hydratation `HydrationPlugin.tsx:511-535`), onglet Entrainement `Aucun programme actif`, `nov..` (double point), 401 presente comme coupure reseau (Mon coach), gating niveau 1 a froid hors ligne, `Pates` stock bas immediat apres rangement.
