# DEPLOY-ORDER v1.20 : ordre d'application et decoupage de deploiement (2026-11-14)

Complete `DEPLOY-RUNBOOK-v1.20.md` (etat prod, rollback, comportement visible) avec les NOMS 14 CHIFFRES definitifs (voir `MOVE-MIGRATIONS.md` pour le mapping). Rien n'est applique par ce document. Les anciens identifiants courts du runbook (0701, 2701...) = PPSS : `0701` -> `20261201070100_*`.

## 1. Regles

- Dossier : `supabase/portfolio-migrations/`. Application MANUELLE, fichier par fichier, dans l'ordre alphabetique de la liste ci-dessous : `supabase link --project-ref ubxllsvanurkwkohzxau` puis `supabase db query --linked -f <fichier>` (meme outil que la CI), ou MCP `execute_sql` une transaction par fichier. Pas de `db push`.
- **`20261201250100_coach_link_guard.sql` (2501) = SKIP** : deja en prod (colonne `revoked_by`, trigger `ziko_coach_link_guard_trg`), rejouable sans effet mais inutile.
- **Backend v1.20 deploye AVANT `20261201270100_security_hardening.sql`** (sinon forms/webhooks/credits cassent), et le build mobile v1.20 APRES toutes les migrations.
- Chaque fichier est idempotent (rejouable en cas d'echec). Verifications par bloc : runbook section 4.
- **`20261201290500_ziko_deduct_ai_credits_fix.sql` : decision facturation.** Appliquee, elle laisse la facturation INACTIVE (`billing_enabled=false`). L'activation est un UPDATE separe (voir MOVE-MIGRATIONS.md).

## 2. Ordre exact (54 fichiers, 2501 en SKIP)

### Bloc A : programmes (0701+0702 dans la meme transaction)
- 20261201070100_dedupe_active_programs.sql
- 20261201070200_active_program_unique_indexes.sql
- 20261201070300_active_program_rpc.sql
- 20261201070400_ai_program_insert_single_active.sql

### Bloc B : liste de courses, hydratation, recompenses
- 20261201100100_shopping_manual_items.sql
- 20261201110100_ziko_hydration_settings.sql
- 20261201120100_badge_award_and_progress.sql
- 20261201120200_equip_item_rpc.sql
- 20261201120300_badge_definitions_select_policy.sql
- 20261201120400_coin_description_no_emoji.sql
- 20261201120500_level_definitions_select_policy.sql

### Bloc C : quetes puis mesures (chaine de redefinition 1302 -> 1402 -> 1602 -> 2802 : ne rien sauter ni permuter)
- 20261201130100_quest_tables.sql
- 20261201130200_quest_functions.sql
- 20261201140100_quest_ai_state.sql
- 20261201140200_quest_sync_ai_handover.sql
- 20261201150100_measurement_goals_extend.sql
- 20261201150200_measurement_goals_achieved_trigger.sql
- 20261201160100_ai_measurement_goals.sql
- 20261201160200_quest_measurement_metric.sql

### Bloc D : sommeil, stretching, complements, minuteur, social, atelier, relances
- 20261201170100_sleep_manual_entry.sql
- 20261201180100_stretching_exercises.sql
- 20261201180200_stretching_default_routine.sql
- 20261201180300_v1_20_grants.sql
- 20261201190100_supplement_stack.sql
- 20261201190200_supplement_intakes.sql
- 20261201190300_supplement_reminder_prefs.sql
- 20261201200100_timer_preset_fields.sql
- 20261201210100_friendships_integrity.sql
- 20261201210200_friend_rpc.sql
- 20261201210300_public_profile_rpc.sql
- 20261201230100_ziko_workshop_drafts.sql
- 20261201240100_program_sequences.sql
- 20261201240200_program_relaunches.sql

### Bloc E : lien coach et plugin obligatoire (2501 = SKIP, deja en prod)
2501 a sauter. 2502, 2503, 2504 (grants tardifs, garde to_regclass) a appliquer.
- 20261201250100_coach_link_guard.sql
- 20261201250200_coach_link_history_index.sql
- 20261201250300_mandatory_plugin_guard.sql
- 20261201250400_v1_20_grants_late.sql

### Bloc F : factions, ligues, defis collectifs
- 20261201260100_factions_leagues_schema.sql
- 20261201260200_faction_rpc.sql
- 20261201260300_league_sync.sql
- 20261201260400_league_ai_gate.sql
- 20261201260500_collective_challenges.sql

### Bloc G : securite et correctifs (2701 APRES 1204, 2102, 2103, 2605 ; backend v1.20 deja en prod)
2902 n'existe pas (trou normal). 2905 = correctif facturation inactive (derniere).
- 20261201270100_security_hardening.sql
- 20261201270200_public_profile_privacy.sql
- 20261201270300_collective_progress_privacy.sql
- 20261201280100_quest_metric_window.sql
- 20261201280200_quest_ai_relay.sql
- 20261201280300_league_neutral_absence.sql
- 20261201280400_league_ai_decline_cooldown.sql
- 20261201280500_v1_20_service_role_grants.sql
- 20261201290100_active_program_clear_completed.sql
- 20261201290300_earn_credits_daily_cap_lock.sql
- 20261201290400_quest_reward_system_award.sql


Total : 54 fichiers dont 1 a sauter (2501) = 53 a appliquer.

## 3. Dependances / blocs (d'apres le runbook)

- 0701 (nettoyage, 16 desactivations) -> 0702 (index uniques partiels, echoue s'il reste un doublon actif) -> 0703 -> 0704 ; 2901 redefinit set_active_program apres.
- 1201 -> 1202 -> 1203 -> 1204 (redefinit award_xp/purchase_shop_item, 55 descriptions) -> 1205.
- 1301 -> 1302 -> 1401 -> 1402 -> 1501 -> 1502 -> 1601 -> 1602 ; puis 2801 / 2802.
- 1801 -> 1802 -> 1803 (grants) ; 2101 -> 2102 -> 2103 (profil public).
- 2601 -> 2602 -> 2603 -> 2604 -> 2605 ; 2803 et 2804 redefinissent 2603 et 2604.
- 2701 (securite) apres 1204, 2102/2103, 2605 ; puis 2702, 2703, 2801..2804, 2805 (grants service_role), 2901, 2903 (earn_credits), 2904 (recompense systeme de quete), 2905 (facturation).
- 2701 revoque earn/deduct_ai_credits et create_form_instances aux clients : prerequis = backend v1.20 (serviceClient) en production.

## 4. Decoupage de deploiement recommande (backend d'abord, sans declencher migrate-portfolio)

Contexte : le merge de milestone/v1.20 vers main ajoute les 54 fichiers dans `HEAD~1..HEAD` ; avec `PORTFOLIO_MIGRATIONS_ENABLED=true` ils partiraient en prod automatiquement avant le backend. Donc :

1. **Verifier** (Settings > Secrets and variables > Actions > Variables) que `PORTFOLIO_MIGRATIONS_ENABLED` n'est PAS `true` (absente ou `false`). Ne jamais la passer a true avant l'etape 5.
2. **PR 1 "code" (sans migration)** : milestone/v1.20 -> main avec `supabase/portfolio-migrations/*20261201*` EXCLUS (ex. branche `release/v1.20-code` = milestone/v1.20 moins les 54 fichiers + README ; les tests statiques qui lisent ces fichiers doivent etre exclus ou le diff garde les fichiers hors du dossier surveille). Alternative equivalente et plus simple : laisser la variable a false pendant tout le merge unique et appliquer a la main (etape 4), la variable n'est alors jamais evaluee a true.
3. Le push sur main deploie backend + web par Vercel (integration GitHub). Smoke : `/health`, flux forms/webhooks/credits avec la cle publiable (les anciens grants sont encore en place).
4. **Migrations a la main**, dans l'ordre de la section 2, en mettant 2701 APRES la verification du backend v1.20 en prod (`SUPABASE_SERVICE_KEY` presente). Verifs du runbook section 4 apres chaque bloc. 2501 sautee. 2905 en dernier.
5. **PR 2 "migrations" (si on veut la CI)** : seulement apres l'etape 4, ajouter les fichiers deplaces par une PR separee ; elle n'est sure que si la variable reste false. Si on veut reactiver la CI : AVANT d'activer la variable, remonter le filigrane (`scripts/portfolio-migration/portfolio-migrations.watermark`) a `20261201290500` dans un commit separe et verifier `--pending --base HEAD~1` = vide ; puis seulement mettre la variable a true pour les migrations futures.
6. Build EAS/stores v1.20 apres l'etape 4. Facturation : activer `billing_enabled` (UPDATE) a la date choisie, apres credit de bienvenue/communication (runbook 5b).

Variante 1 seul merge (si la variable est deja false) : merger, laisser Vercel deployer, verifier le backend, appliquer les migrations a la main (etape 4). C'est equivalent a 2-4 sans exclure de fichiers ; le seul risque est d'oublier que la variable est a true.

Verification locale du risque : `node scripts/portfolio-migration/16-ci-migration-guard.mjs --pending --base origin/main` liste les 54 fichiers que la CI appliquerait.
