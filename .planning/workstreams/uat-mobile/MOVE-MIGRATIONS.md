# MOVE-MIGRATIONS : migrations v1.20 deplacees vers supabase/portfolio-migrations/ (2026-11-14)

Branche : `chore/move-migrations-2` (le nom `chore/move-migrations` est deja pris par un autre worktree, `agent-acb832dede2641a0f`, au meme commit que milestone/v1.20). Rien n'est pousse, rien n'est applique nulle part, aucune ecriture prod (seuls 4 SELECT : `pg_get_functiondef`, colonnes, `ziko_app_config`).

## RISQUE CI A LIRE EN PREMIER (migrate-portfolio)

- Le job `migrate-portfolio` (`.github/workflows/ci.yml`) ne tourne que si `vars.PORTFOLIO_MIGRATIONS_ENABLED == 'true'`, sur push `main` ou `workflow_dispatch`, projet force `ubxllsvanurkwkohzxau`. Il applique `supabase db query --linked -f`, fichier par fichier, tous les fichiers de `supabase/portfolio-migrations/` AJOUTES dans `HEAD~1..HEAD` (au-dessus du filigrane `20261002160000`), par ordre alphabetique.
- Consequence du deplacement : un merge de `milestone/v1.20` vers `main` (merge commit ou squash) ajoute les 54 fichiers dans HEAD~1..HEAD. Si la variable est a `true`, ils partent en prod AUTOMATIQUEMENT, dans l'ordre alphabetique, AVANT que le backend v1.20 soit deploye (Vercel deploie en parallele, sans garantie d'ordre).
- Dangers concrets : (1) `20261201270100_security_hardening` (ex-2701) revoque les droits de `ziko_earn_ai_credits` / `ziko_deduct_ai_credits` / `ziko_create_form_instances_for_trigger` pour tout sauf service_role : le backend ACTUEL (cle publiable pour forms/webhooks/credits) casserait ; (2) `...290500_ziko_deduct_ai_credits_fix` n'est pas dangereuse (billing_enabled=false) mais ne doit pas partir sans decision ; (3) `20261201250100_coach_link_guard` (ex-2501) est DEJA en prod (rejouable sans effet, a sauter) ; (4) le nettoyage `...070100` desactive 16 programmes sans avertissement.
- REGLE : NE JAMAIS passer `PORTFOLIO_MIGRATIONS_ENABLED` a `true` avant que le backend v1.20 soit deploye, et ne jamais merger milestone/v1.20 sur main en un seul commit avec la variable a true. Decoupage concret propose dans `DEPLOY-ORDER.md`. Le workflow n'a pas ete modifie (consigne).
- Le filigrane (`portfolio-migrations.watermark`) ne protege pas : `--pending` liste les fichiers ajoutes par le diff `HEAD~1` ; ils sont tous posterieurs a `20261002160000`.

## Garde CI (migration-guard)

- `16-ci-migration-guard.mjs --check-legacy` : PASS (supabase/migrations/ identique a l'empreinte gelee ; `git diff --stat origin/main -- supabase/migrations` = vide).
- `--check-portfolio` (ziko_ uniquement) : PASS.
- `node scripts/uat/check-migration-names.mjs` : PASS (54 fichiers v1.20 : 53 deplaces + 2905).

## FAIT

1. Commit `88ff47ec` : `git mv` pur de 53 fichiers `2026120PPSS_*.sql` -> `20261201PPSS00_*.sql` (suffixe `00` : ordre identique, tous > `20261111130000`, le dernier fichier portfolio).
2. Commit "mise a jour des references" : ancien nom -> nouveau dans 90+ fichiers (tests statiques GRANT `v120MigrationGrants`, stretching, mandatoryPlugins, earnCapMigration, specs RLS backend, harnais `scripts/uat/*-sql` (chemin + noms), `plugins/measurements/db-tests`, commentaires source, docs/planning uat-mobile) ; `scripts/uat/check-migration-names.mjs` (dossier `supabase/portfolio-migrations`, regex `20261201PPSS00`) ; `README-v1.20.md` deplace dans portfolio-migrations et reecrit.
3. Commit `905bfb88` : migration `20261201290500_ziko_deduct_ai_credits_fix.sql` (voir ci-dessous) + harnais `scripts/uat/deduct-credits-sql/run.mjs`.
4. `DEPLOY-ORDER.md` ecrit.

Gate : `npx vitest run` racine 83 fichiers / 1246 tests OK ; `backend/api` 50 fichiers / 572 tests OK (8 skipped = RLS sans DB) ; check-migration-names OK ; type-check backend et test statique GRANT : voir la fin de ce fichier.

## Facturation inactive : migration 20261201290500_ziko_deduct_ai_credits_fix.sql

- Lu en prod (SELECT `pg_get_functiondef`) : identique au runbook 5b (UPDATE du solde avant l'INSERT ; `ON CONFLICT (user_id, source, idempotency_key)` sans predicat -> 42P10 car l'index est partiel).
- Interrupteur : table existante `ziko_app_config(key, value jsonb)` (lisible anon/authenticated, ecriture service_role/postgres), cle `billing_enabled` inseree a `false` (`ON CONFLICT DO NOTHING` : une re-application ne remet pas le flag a false). Pas de nouvelle table.
- Flag false (ou cle absente) : retourne `{success:true, balance_after:<solde>, billing:'disabled'}`, aucun debit, aucune ligne de ledger, journal via `RAISE LOG` (log Postgres, pas de ligne en base : le CHECK `type` du ledger n'a pas de valeur adaptee et une ligne `deduct` fausserait les stats / l'index d'idempotence).
- Flag true : verrou de ligne, puis test de la cle d'idempotence AVANT debit (rejeu = `{success:true, duplicate:true}`, pas de second debit), solde insuffisant = `success:false`, UPDATE, INSERT ledger avec `ON CONFLICT (...) WHERE idempotency_key IS NOT NULL DO NOTHING`. Cle NULL tolere (pas d'idempotence). Signature inchangee, REVOKE PUBLIC/anon/authenticated + GRANT service_role.
- Activation (par vous, plus tard) : `UPDATE public.ziko_app_config SET value='true'::jsonb, updated_at=now() WHERE key='billing_enabled';` Retour arriere = meme UPDATE avec `false`.
- Test : Postgres 18 local jetable port 8216 (scoop), `DC_PG_URL=postgres://postgres@127.0.0.1:8216/dc node scripts/uat/deduct-credits-sql/run.mjs` = 25 PASS / 0 FAIL (defaut prod reproduit 42P10, migration x2, off, on, rejeu, insuffisant, cle NULL, 5 appels concurrents meme cle = 1 debit, droits anon/authenticated/PUBLIC sans EXECUTE, service_role OK). Instance arretee, non applique ailleurs.
- Note : tant que cette migration n'est pas appliquee, la prod actuelle echoue deja a chaque debit (42P10), donc la facturation est de fait inactive ; la migration rend l'etat explicite et pilotable.

## NON FAIT / A SAVOIR

- Rien n'est pousse ni applique ; `.github/workflows` non modifie ; la variable `PORTFOLIO_MIGRATIONS_ENABLED` n'a pas ete lue (a verifier dans Settings > Variables).
- Le runbook `DEPLOY-RUNBOOK-v1.20.md` et CLAUDE.md citent encore `supabase/migrations/` et les identifiants courts (0701, 2701...) : les identifiants courts restent valides (PPSS) ; la section 0 du runbook est a considerer resolue par ce deplacement (option "deplacer vers portfolio-migrations").
- Les noms 12 chiffres ont ete remplaces aussi dans les docs d'archive du workstream uat-mobile (recherche/remplacement mecanique des noms et identifiants exacts).
- `schema_migrations` n'est pas mis a jour par `supabase db query` : l'historique prod ne contiendra pas ces versions (voir runbook 0).
- Pas de `2902` (trou normal). Prod : 2501 deja appliquee a la main.

## Mapping ancien -> nouveau (53 fichiers deplaces)

| # | Ancien (supabase/migrations/) | Nouveau (supabase/portfolio-migrations/) |
|---|---|---|
| 1 | 202612010701_dedupe_active_programs.sql | 20261201070100_dedupe_active_programs.sql |
| 2 | 202612010702_active_program_unique_indexes.sql | 20261201070200_active_program_unique_indexes.sql |
| 3 | 202612010703_active_program_rpc.sql | 20261201070300_active_program_rpc.sql |
| 4 | 202612010704_ai_program_insert_single_active.sql | 20261201070400_ai_program_insert_single_active.sql |
| 5 | 202612011001_shopping_manual_items.sql | 20261201100100_shopping_manual_items.sql |
| 6 | 202612011101_ziko_hydration_settings.sql | 20261201110100_ziko_hydration_settings.sql |
| 7 | 202612011201_badge_award_and_progress.sql | 20261201120100_badge_award_and_progress.sql |
| 8 | 202612011202_equip_item_rpc.sql | 20261201120200_equip_item_rpc.sql |
| 9 | 202612011203_badge_definitions_select_policy.sql | 20261201120300_badge_definitions_select_policy.sql |
| 10 | 202612011204_coin_description_no_emoji.sql | 20261201120400_coin_description_no_emoji.sql |
| 11 | 202612011205_level_definitions_select_policy.sql | 20261201120500_level_definitions_select_policy.sql |
| 12 | 202612011301_quest_tables.sql | 20261201130100_quest_tables.sql |
| 13 | 202612011302_quest_functions.sql | 20261201130200_quest_functions.sql |
| 14 | 202612011401_quest_ai_state.sql | 20261201140100_quest_ai_state.sql |
| 15 | 202612011402_quest_sync_ai_handover.sql | 20261201140200_quest_sync_ai_handover.sql |
| 16 | 202612011501_measurement_goals_extend.sql | 20261201150100_measurement_goals_extend.sql |
| 17 | 202612011502_measurement_goals_achieved_trigger.sql | 20261201150200_measurement_goals_achieved_trigger.sql |
| 18 | 202612011601_ai_measurement_goals.sql | 20261201160100_ai_measurement_goals.sql |
| 19 | 202612011602_quest_measurement_metric.sql | 20261201160200_quest_measurement_metric.sql |
| 20 | 202612011701_sleep_manual_entry.sql | 20261201170100_sleep_manual_entry.sql |
| 21 | 202612011801_stretching_exercises.sql | 20261201180100_stretching_exercises.sql |
| 22 | 202612011802_stretching_default_routine.sql | 20261201180200_stretching_default_routine.sql |
| 23 | 202612011803_v1_20_grants.sql | 20261201180300_v1_20_grants.sql |
| 24 | 202612011901_supplement_stack.sql | 20261201190100_supplement_stack.sql |
| 25 | 202612011902_supplement_intakes.sql | 20261201190200_supplement_intakes.sql |
| 26 | 202612011903_supplement_reminder_prefs.sql | 20261201190300_supplement_reminder_prefs.sql |
| 27 | 202612012001_timer_preset_fields.sql | 20261201200100_timer_preset_fields.sql |
| 28 | 202612012101_friendships_integrity.sql | 20261201210100_friendships_integrity.sql |
| 29 | 202612012102_friend_rpc.sql | 20261201210200_friend_rpc.sql |
| 30 | 202612012103_public_profile_rpc.sql | 20261201210300_public_profile_rpc.sql |
| 31 | 202612012301_ziko_workshop_drafts.sql | 20261201230100_ziko_workshop_drafts.sql |
| 32 | 202612012401_program_sequences.sql | 20261201240100_program_sequences.sql |
| 33 | 202612012402_program_relaunches.sql | 20261201240200_program_relaunches.sql |
| 34 | 202612012501_coach_link_guard.sql | 20261201250100_coach_link_guard.sql |
| 35 | 202612012502_coach_link_history_index.sql | 20261201250200_coach_link_history_index.sql |
| 36 | 202612012503_mandatory_plugin_guard.sql | 20261201250300_mandatory_plugin_guard.sql |
| 37 | 202612012504_v1_20_grants_late.sql | 20261201250400_v1_20_grants_late.sql |
| 38 | 202612012601_factions_leagues_schema.sql | 20261201260100_factions_leagues_schema.sql |
| 39 | 202612012602_faction_rpc.sql | 20261201260200_faction_rpc.sql |
| 40 | 202612012603_league_sync.sql | 20261201260300_league_sync.sql |
| 41 | 202612012604_league_ai_gate.sql | 20261201260400_league_ai_gate.sql |
| 42 | 202612012605_collective_challenges.sql | 20261201260500_collective_challenges.sql |
| 43 | 202612012701_security_hardening.sql | 20261201270100_security_hardening.sql |
| 44 | 202612012702_public_profile_privacy.sql | 20261201270200_public_profile_privacy.sql |
| 45 | 202612012703_collective_progress_privacy.sql | 20261201270300_collective_progress_privacy.sql |
| 46 | 202612012801_quest_metric_window.sql | 20261201280100_quest_metric_window.sql |
| 47 | 202612012802_quest_ai_relay.sql | 20261201280200_quest_ai_relay.sql |
| 48 | 202612012803_league_neutral_absence.sql | 20261201280300_league_neutral_absence.sql |
| 49 | 202612012804_league_ai_decline_cooldown.sql | 20261201280400_league_ai_decline_cooldown.sql |
| 50 | 202612012805_v1_20_service_role_grants.sql | 20261201280500_v1_20_service_role_grants.sql |
| 51 | 202612012901_active_program_clear_completed.sql | 20261201290100_active_program_clear_completed.sql |
| 52 | 202612012903_earn_credits_daily_cap_lock.sql | 20261201290300_earn_credits_daily_cap_lock.sql |
| 53 | 202612012904_quest_reward_system_award.sql | 20261201290400_quest_reward_system_award.sql |
| 54 | (nouveau) | 20261201290500_ziko_deduct_ai_credits_fix.sql |
