# Phase 15 - Plan UAT emulateur (en file apres P1)

Pre-requis : migrations `202612011501` et `202612011502` appliquees sur la base cible PAR L'ORCHESTRATEUR (jamais par l'agent de phase) ; compte de test neuf (0 objectif, 0 mesure) ; build dev-client de la branche. Reperes visuels : `phases/04-maquettes-reference/lot-E/` (E10 a E16), 1080x2400 / dpi 420. Resultat attendu consigne dans `15-VERIFICATION.md` par l'auditeur UAT.

| Id | Flow (ecran) | Actions | Attendu | Preuve |
|---|---|---|---|---|
| ME-1 | Mesures > Objectifs, compte neuf (E10) | ouvrir l'onglet | etat vide `Aucun objectif pour l'instant` + bouton `Definir un objectif` ; aucune carte 76/78/40 | capture ; `grep -nE "\b(76\|78\|40)\b" plugins/measurements/src/screens/MeasurementsPlugin.tsx` = 0 cible |
| ME-2 | Creer poids (E13) | saisir une mesure poids 79,4 ; `Definir un objectif` ; Poids ; depart prerempli 79,4 ; cible 76 ; `Creer l'objectif` | banniere `Objectif de baisse : 3,4 kg a perdre.` ; carte `0 %`, `EN COURS`, `Aucune nouvelle mesure` ; ligne base `ziko_athlete_goals` (start_value 79.4, target_value 76, unit kg, status active) | capture + requete lecture seule |
| ME-3 | Pourcentage (E11) | creer bras 36 -> 40 ; saisir bras 37,2 ; poids 79,4 vers cible 76 avec depart 82 (via 2 objectifs) | `43 %` et `30 %` ; barre proportionnelle ; hausse et baisse | capture (formule deja couverte par 29 tests unitaires) |
| ME-4 | 7 mesures (E13, E15) | ouvrir la creation puis `Nouvelle mesure` | 7 puces (Poids, Taille, Bras, Poitrine, Cuisses, Hanches, Masse grasse) ; 7 champs dans l'ordre E15, seul le poids `(obligatoire)`, `Facultatif` en placeholder | arbre d'accessibilite uiautomator |
| ME-5 | Verrou (E11, E16) | inspecter la carte `EN COURS` ; toucher la carte | aucun bouton `Modifier`/crayon ; feuille `Objectif en cours` `Il te reste 3,4 kg.` + `Compris` ; test RLS : `UPDATE` client de start/target rejete | capture + `npm run test:rls` (measurement-goals.spec.ts) sur base de test |
| ME-6 | Atteint puis suivant (E12) | saisir poids 75,8 (<= cible) ; revenir sur Objectifs ; `Definir le suivant` ; creer 75,8 -> 72 | carte `ATTEINT`, `100 %`, `Objectif atteint le <date>. Bravo.` ; formulaire E13 ; second objectif cree, l'ancien reste en historique | scenario + base |
| ME-7 | Validation (E14) | creation : cible = depart | message exact `La cible doit etre differente du point de depart.` sous le champ, bord rouge, bouton `enabled=false`, champs conserves | uiautomator + capture |
| ME-8 | Chargement/erreur | mode avion puis ouvrir l'onglet | squelettes gris (pas d'orange), puis `Impossible de charger tes objectifs` + `Reessayer` | capture |
| ME-9 | Accessibilite | TalkBack | barres `progressbar` annoncent `43 pour cent` ; puces `radio` `choisi` ; erreurs de champ annoncees | tree + TalkBack |
| ME-10 | Couleurs | inspecter | boutons pleins `#CF4509` (jamais `#FF5C1A` en fond de bouton) ; 0 emoji ; cibles tactiles >= 44 dp | frames/uiautomator |
| ME-11 | Doublon | creer un 2e objectif poids pendant qu'un est en cours | message `Tu as deja un objectif en cours sur cette mesure.` | scenario |

Hors perimetre P15 (P16) : onboarding IA, outil IA de gestion/modification, notification de modification, quetes.
