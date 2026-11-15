# Phase 15: Mesures & objectifs en base - Context

**Gathered:** 2026-11-12 (recap chantier 8). Req : MEAS-01, MEAS-04, MEAS-05, MEAS-06. Vague 1. UI hint oui, UI-SPEC propre.

## Decisions verrouillees
- **D-01** MEAS-01 : objectifs en base (plus de 76 kg / 78 cm / 40 cm codes en dur dans `MeasurementsPlugin.tsx`). **Recherche d'abord** : examiner `ziko_athlete_goals` (migration `20260902100000_athlete_goals.sql`) et les tables de mesures existantes ; **recommandation** : etendre `ziko_athlete_goals` si son modele (type d'objectif, cible, valeur de depart, statut) convient, sinon table `ziko_measurement_goals` liee. Decision documentee dans `15-RESEARCH.md`, signalee a l'orchestrateur AVANT d'ecrire la migration (bloc `20261201 1501-1509`).
- **D-02** MEAS-04 : mesures proposees = poids, tour de taille, bras, poitrine, cuisses, hanches, % de masse grasse.
- **D-03** MEAS-05 : chaque objectif affiche son **% de completion** = progression entre point de depart (premiere mesure ou valeur enregistree a la creation) et cible, borne [0,100], correct pour les objectifs a la baisse ET a la hausse.
- **D-04** MEAS-06 : un objectif **en cours n'est pas modifiable par l'utilisateur** (UI sans edition ; RLS/trigger empeche la mise a jour de cible/valeur par le client si faisable) ; une fois atteint, l'utilisateur definit le suivant. (La modification par l'IA est P16, hors perimetre.)
- **D-05** Creation d'un premier objectif par l'utilisateur permise (avant l'onboarding IA de P16) : formulaire simple, validation (cible differente du depart, unite).
- **D-06** Fichiers : `plugins/measurements/**`, `backend/api/src/tools/measurements.ts` (adapter aux objectifs en base sans casser les outils existants), migration. P16 ajoutera l'outil IA de gestion apres P14.
- **D-07** Verification : tests unitaires du calcul de % (cas limites), requetes d'objectifs ; test RLS d'ecriture client ; UAT emulateur en file.

## Zones grises restantes
Aucune produit ; choix de modele de donnees = D-01 (recommandation fournie).
