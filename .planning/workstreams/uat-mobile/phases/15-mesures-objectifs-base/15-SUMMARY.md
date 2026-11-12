# Phase 15 - Mesures et objectifs en base : SUMMARY

Branche `phase/15-mesures` (base `milestone/v1.20`, merge de `milestone/v1.20` fait, 1 conflit trivial `vitest.config.ts` resolu par union des `include`). Aucun push, aucune ecriture en base reelle, migrations = fichiers non appliques.

## Livre
- Decision D-01 : etendre `ziko_athlete_goals` (detail : `15-RESEARCH.md`). Colonnes nullables `measure_key, start_value, unit, start_date, achieved_at, achieved_value` ; les lignes de l'outil IA `create_goal` restent valides.
- Migrations (fichiers) : `supabase/migrations/202612011501_measurement_goals_extend.sql` (colonnes, CHECK, index unique 1 objectif actif par mesure, trigger verrou D-04, RPC `ziko_create_measurement_goal` SECURITY DEFINER) ; `202612011502_measurement_goals_achieved_trigger.sql` (passage auto a `achieved`).
- Logique pure `plugins/measurements/src/lib/goals.ts` (+ `goals.test.ts`, 29 tests) : formule du %, sens baisse/hausse, validation, 7 mesures, dernieres valeurs.
- UI `screens/GoalsTab.tsx` (E10 vide, E11 cartes, E12 atteint + `Definir le suivant`, E13/E14 creation, E16 feuille verrou, squelettes, erreur) ; `MeasurementsPlugin.tsx` (76/78/40 supprimes, saisie 7 mesures ordre E15, poids seul obligatoire) ; `MeasurementsLog.tsx` idem ; boutons pleins = `getActionPrimary(theme)` (#CF4509).
- Backend : `measurements_get_progress` renvoie aussi les objectifs en base (lecture seule, additif). L'outil de gestion IA = P16.
- Tests : harness SQL `plugins/measurements/db-tests/measurement-goals.harness.sql` ; spec RLS `backend/api/test/rls/measurement-goals.spec.ts` (garde `RUN_DB`).
- `UAT-PLAN.md` (ME-1 a ME-11).

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| MEAS-01 base | VERIFIED (logique + SQL local), UAT en file | RPC + table testees sur PostgreSQL 18 jetable (stubs) ; 0 valeur 76/78/40 dans `MeasurementsPlugin.tsx` (grep) ; onglet lit `ziko_athlete_goals` |
| MEAS-04 7 mesures | VERIFIED (unitaire) | test d'ordre E13/E15 ; saisie et creation partagent `MEASURES`/`ENTRY_ORDER` |
| MEAS-05 % | VERIFIED (unitaire) | 12 cas dont 43, 30, 0, mauvais sens, >= cible = 100, 99,6 -> 99, depart = cible, bornage grille |
| MEAS-06 verrou/suivant | PARTIAL | UI sans edition (revue de code) ; SQL local : UPDATE/INSERT client refuses (privilege), trigger refuse meme avec GRANT remis, atteint puis 2e objectif OK. Non prouve sur base Supabase reelle ni sur emulateur |

## Gate
- `npx vitest run` racine : 32 fichiers, 564 tests verts. `backend/api` vitest : 300 verts, 3 skipped (RLS). `tsc --noEmit` mobile, `plugins/measurements`, `backend/api` : 0 erreur. `check-migration-names.mjs` OK. Harness SQL : 21 PASS / 0 FAIL.

## NON prouve
- Aucun rendu emulateur/capture (E10 a E16 non compares a la maquette pixel pour pixel) ; accessibilite TalkBack non testee ; densite typo non mesuree.
- Migrations jamais appliquees sur le schema reel (le harness utilise des stubs `auth`/roles, pas les grants reels du projet portfolio) : verifier a l'application (ordre : apres `20261111130000`). Spec RLS ecrite mais non executee (pas de base de test).
- Le trigger d'atteinte ne considere que les mesures datees >= `start_date` ; une mesure saisie avec une date passee n'atteint pas l'objectif (choix volontaire).
- `measurements_get_progress` compare a la derniere ligne uniquement : une mesure facultative absente de cette ligne donne `current_value` null cote IA.
- Pas de i18n (textes FR en dur, conforme a la convention plugin).

## Pour P16 (ou l'orchestrateur)
- Modification d'un objectif actif par l'IA : RPC SECURITY DEFINER qui fait `set_config('ziko.allow_goal_edit','on',true)` avant l'UPDATE (le trigger verrou lit ce flag).
- Les objectifs `create_goal` (sans `measure_key`) ont une semantique libre (`target_value` = ecart) ; l'onboarding IA devra utiliser `ziko_create_measurement_goal` pour produire des objectifs de mesure.

## Fichiers susceptibles de conflit
`vitest.config.ts` (include, resolu), `backend/api/src/tools/measurements.ts` (P16), `plugins/measurements/**`.
