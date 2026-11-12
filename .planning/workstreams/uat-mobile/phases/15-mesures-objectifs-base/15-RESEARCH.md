# Phase 15 - Recherche : modele de donnees des objectifs de mesures (D-01 / MEAS-01)

## Etat de l'existant (verifie dans le depot)
- `ziko_athlete_goals` (migration `20260902100000_athlete_goals.sql`, schema portfolio `20261001101852_*`) : `id, user_id, goal_text, target_metric, target_value, target_date, status ('active'|'achieved'|'abandoned'), created_at, updated_at`. Index `(user_id, status, created_at DESC)`. Trigger `updated_at`.
- Ecriture : **aucune** pour les clients (RLS SELECT seule + REVOKE INSERT/UPDATE/DELETE sur anon, authenticated, service_role). Seul chemin : RPC `ziko_record_athlete_decision(..., p_new_goal)` (SECURITY DEFINER), appelee par l'outil IA `create_goal` (`backend/api/src/coaching-engine/tools.ts`). Test RLS existant : `backend/api/test/rls/athlete-goals.spec.ts`.
- Aucun lecteur de la table cote backend en dehors de cette RPC (`grep athlete_goals backend/api/src` : 2 commentaires). `create_program` lit un goal par `goal_id` (pas "l'objectif actif de l'utilisateur"), donc des lignes supplementaires ne le perturbent pas.
- `ziko_body_measurements` : `weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm, date` ; policy `FOR ALL` own ; DML `authenticated` conserve (`20261107170000_ziko_revoke_client_dml.sql`).
- `MeasurementsPlugin.tsx` : onglet Objectifs avec 76 kg / 78 cm / 40 cm en dur (MEAS-01 a supprimer).

## Ce qui manque a `ziko_athlete_goals` pour les objectifs de mesures
`start_value` (point de depart, D-03), `unit`, cle de mesure normalisee, date de depart, date/valeur d'atteinte, verrou d'edition (D-04), ecriture cliente (D-05).
Present et reutilisable tel quel : `goal_text` (libelle), `target_metric` (cle de mesure), `target_value` (cible), `target_date`, `status`, index, trigger `updated_at`, RLS SELECT, lockdown DML.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Etendre `ziko_athlete_goals` (colonnes nullables) | une seule table "objectifs" pour l'IA (P16 : onboarding, outil de gestion, MEAS-07/08/09) ; le lockdown DML existant donne gratuitement D-04 cote client ; `status` deja la bonne machine d'etats ; pas de jointure ; P16 reutilise la meme table (carte de propriete : "P15->P16 meme table") | melange deux familles de lignes (objectif "texte libre" cree par `create_goal`, objectif de mesure) : on les distingue par `measure_key IS NOT NULL` |
| B. Table liee `ziko_measurement_goals` | separation nette | duplique status/cible/date ; P16 devrait lire deux tables ; relit le verrou a zero |

## Decision : **A, etendre `ziko_athlete_goals`** (conforme a la recommandation du CONTEXT)
- Colonnes ajoutees (toutes nullables, donc les lignes `create_goal` existantes et la RPC `ziko_record_athlete_decision` restent valides sans changement) : `measure_key`, `start_value`, `unit`, `start_date`, `achieved_at`, `achieved_value`.
- Mapping : `goal_text` = libelle (`Poids 82,0 -> 76,0 kg`), `target_metric` = `measure_key`, `target_value` = cible.
- Contraintes : `measure_key` dans les 7 colonnes de `ziko_body_measurements` ; si `measure_key` non nul alors `start_value`, `target_value`, `unit` non nuls et `start_value <> target_value` ; au plus 1 objectif `active` par `(user_id, measure_key)` (index unique partiel).
- Ecriture client (D-05) : RPC `ziko_create_measurement_goal(p_measure_key, p_start_value, p_target_value, p_target_date)` SECURITY DEFINER, `auth.uid()` (jamais un `user_id` fourni), validations serveur miroir du client (plage plausible, cible <> depart, pas de second objectif actif sur la meme mesure). `EXECUTE` accorde a `authenticated` seulement. Table toujours SELECT-only pour le client.
- Verrou D-04 : (1) pas de GRANT UPDATE/INSERT/DELETE client (existant) ; (2) trigger `BEFORE UPDATE` qui refuse tout changement de `measure_key/start_value/target_value/unit` sur un objectif `active`, sauf si `set_config('ziko.allow_goal_edit','on',true)` (porte reservee a la future RPC IA de P16, SECURITY DEFINER) ; defense en profondeur si un GRANT est remis par erreur.
- Atteinte : trigger `AFTER INSERT OR UPDATE` sur `ziko_body_measurements` (SECURITY DEFINER) qui passe en `achieved` (+ `achieved_at`, `achieved_value`) les objectifs actifs dont la nouvelle valeur franchit la cible dans le sens voulu. Fonctionne aussi pour une mesure ajoutee par l'outil IA ou une saisie hors UI. Le % lui-meme n'est PAS stocke : calcule cote client depuis la derniere mesure (formule du contrat, fonction pure testee).
- Point de depart : valeur saisie a la creation (prerempli avec la derniere mesure, modifiable), stockee dans `start_value`.

## Compatibilite et risques
- `ziko_record_athlete_decision` et `create_goal` : inchanges, ne remplissent pas les nouvelles colonnes (NULL). Le CHECK ne s'applique que si `measure_key` non nul.
- Les lignes `create_goal` (ex. `target_metric='weight_kg'`, `target_value=5` = un ecart, pas une cible absolue) n'ont pas `measure_key` : l'UI mesures les ignore (filtre `measure_key IS NOT NULL`). Ambiguite de semantique entre les deux familles a traiter par P16 (onboarding IA devra utiliser la nouvelle RPC ou renseigner `measure_key/start_value`).
- Le test RLS d'ecriture client exige une base de test (`SUPABASE_TEST_URL`) : ecrit et commite, saute sans base (meme garde `RUN_DB` que les specs existantes).
- Migration cible le schema `ziko_` du projet portfolio (noms `ziko_*`). Aucune application par cet agent.
