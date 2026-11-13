# UAT run 5 : flows restants apres le run 4 (branche uat/run5, base milestone/v1.20 51121da5)

Env : emulateur ziko-uat-1, Metro 8281, backend local 8200 + faux Anthropic (aucun appel reel), branche Supabase `uat-v1-20` (ref oloobswzsziidjwycthm verifie avant chaque ecriture, helpers `uat-evidence/rest.mjs|restw.mjs|admin.mjs`). Detail par phase : `phases/NN-*/UAT-RESULTS-run5.md` (P7, P14/P13, P21, P24, P25). Captures : `uat-evidence/run5/` (gitignore).

## (1) Re-verification des 4 corrections du run 4

| # | Correction | Verdict |
|---|---|---|
| 2 | P24 demarrage "Squat" + toast | FAIL sur le catalogue reel (aucune ligne "Back Squat"/"Squat" parmi 1318 : l'alias de `exerciseMatch.ts` ne trouve rien, repli en alerte "Modifier le programme" OK). PASS avec une ligne fixture `Back Squat` ("Squat arriere" resolu). Toast non observe (rien de non resolu). |
| 3 | Seance fantome | PASS : seance vide supprimee en base, pas de bandeau apres redemarrage. |
| 4 | P7 nom / statut / reactivation | Nom PASS ; reactivation remet `completed_at` a NULL PASS (2901 OK) ; "Pas encore demarre" FAIL ("En pause 0 %") ; bandeau P24 persiste (relaunch `proposed`). |
| 1 | P23 quota (logs 42P10) | NON-TESTE (pas de 5e `/ai/chat` hors quota ; le debit casse reste differe). |

## Autres flows

| Flow | Verdict |
|---|---|
| P21 vrai login B (accepter, profil ami complet, profil prive non-ami, Ajouter -> Demande envoyee) | PASS ; ecarts : pas de mention "Profil prive", "Niveau 3" vs `athlete_state.level=5` |
| P25 MC-4, MC-6, MC-13 | PASS ; MC-11 FAIL (tap "Obligatoire" sans alerte : `store/index.tsx:405` `accessibilityState disabled`) |
| P7 ecrasement du programme coach avec confirmation | PASS (Annuler no-op, Remplacer bascule) |
| P13/P14 : progression apres log d'eau (une seule recompense), `quests_create` (faux), garde-fou 3 max, "Non terminee · aucune penalite" | PASS ; quete IA expiree masquee si une quete IA plus recente est active ; fenetre 21 h NON-TESTE |

## Nouveaux defauts releves (hors plan)
- Accueil "Aucun programme actif" alors que le programme coach est actif (carte accueil).
- Objectif eau de l'accueil passe de 2.5 L a 2.0 L entre deux relances (non explique).
- Store : description "Track your daily goals..." encore en anglais (Daily Habits).
- Demarrage a froid hors ligne : ecran "Bienvenue" au lieu de la session en cache.

## NON-TESTE (voir `UAT-RUN5-RESUME.md`)
P26 LG-* (transition, absence neutre, defi collectif, garde-fous), P16 IM-*, P6 A..F, P9 U1/U12/U15, P10, P11, P15, P17 SL-*, P20 TI-*, P22 JR/CO, accueil (seance terminee, kcal, FR exercices, FAB), P24 B..F, P23 B..F + feuille d'epuisement, MC-8 bouton mobile, comparaison aux maquettes (aucun ecart mesure releve : seuls des ecarts de libelle/etat).

## Etat laisse sur la branche de test
Lien coach actif (fixture) ; programme coach "Force 5x5, bloc 2" actif (assigne a A) ; ligne catalogue `Back Squat` (fixture) ; amitie A-B `accepted` ; A public ; quetes IA "Run5 eau 3 L" / "Run5 repas 3" expirees ; mot de passe de B reinitialise (dans `.uat/env`).
