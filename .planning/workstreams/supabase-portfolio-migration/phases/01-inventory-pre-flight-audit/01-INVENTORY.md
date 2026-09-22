# Phase 1 — Inventory & Pre-Flight Audit

## Executive Summary

_(filled in by plan 01-02 Task 2 after all sections exist)_

## ziko Live Inventory (INV-01)

All values below were queried live against `ziko` (`slkobhavpwsubnsmuhya`) on **2026-09-22T06:38:15Z** via `supabase db query --linked "<SQL>"`, one query per invocation, in this execution session (not carried over from `01-RESEARCH.md`'s 2026-09-22 earlier snapshot).

### Tables

**99 tables** in `public`, **99 / 99 (100%)** with RLS enabled.

<details>
<summary>Full table list (99), with RLS flag and on-disk size</summary>

| Table | RLS | Size |
|---|---|---|
| ai_conversations | true | 48 kB |
| ai_cost_log | true | 64 kB |
| ai_credit_transactions | true | 248 kB |
| ai_generated_programs | true | 88 kB |
| ai_imports | true | 112 kB |
| ai_messages | true | 208 kB |
| ai_tool_audit | true | 48 kB |
| app_config | true | 32 kB |
| app_invites | true | 80 kB |
| athlete_decisions | true | 56 kB |
| athlete_goals | true | 24 kB |
| athlete_state | true | 32 kB |
| badge_definitions | true | 48 kB |
| body_measurements | true | 80 kB |
| bug_reports | true | 64 kB |
| cardio_sessions | true | 64 kB |
| challenge_participants | true | 40 kB |
| challenge_teams | true | 24 kB |
| challenges | true | 32 kB |
| coach_alerts | true | 32 kB |
| coach_branding | true | 32 kB |
| coach_client_links | true | 96 kB |
| coach_client_notes | true | 64 kB |
| coach_client_tags | true | 64 kB |
| coach_client_videos | true | 32 kB |
| coach_exercises | true | 48 kB |
| coach_forms | true | 16 kB |
| coach_invitations | true | 96 kB |
| coach_memory | true | 32 kB |
| coach_metric_thresholds | true | 24 kB |
| coach_profiles | true | 64 kB |
| coach_program_folders | true | 24 kB |
| coach_video_annotations | true | 24 kB |
| coach_vocal_feedbacks | true | 24 kB |
| coin_gifts | true | 32 kB |
| coin_transactions | true | 48 kB |
| community_conversations | true | 16 kB |
| community_messages | true | 24 kB |
| community_posts | true | 32 kB |
| community_user_stats | true | 24 kB |
| conversation_members | true | 16 kB |
| dashboard_configs | true | 32 kB |
| exercise_import_log | true | 600 kB |
| exercises | true | 8896 kB |
| exercises_merge_backup | true | 1288 kB |
| food_database | true | 2448 kB |
| food_products | true | 48 kB |
| form_instances | true | 40 kB |
| form_responses | true | 24 kB |
| friendships | true | 80 kB |
| group_workout_participants | true | 16 kB |
| group_workouts | true | 32 kB |
| habit_encouragements | true | 24 kB |
| habit_logs | true | 104 kB |
| habits | true | 96 kB |
| health_sync_log | true | 24 kB |
| hydration_logs | true | 40 kB |
| journal_entries | true | 48 kB |
| level_definitions | true | 32 kB |
| notification_log | true | 88 kB |
| notification_preferences | true | 32 kB |
| notification_tokens | true | 32 kB |
| nutrition_logs | true | 96 kB |
| pantry_items | true | 64 kB |
| persona_settings | true | 24 kB |
| plugin_reviews | true | 80 kB |
| plugins_registry | true | 96 kB |
| post_comments | true | 24 kB |
| post_likes | true | 16 kB |
| program_exercises | true | 224 kB |
| program_workouts | true | 32 kB |
| promo_codes | true | 24 kB |
| screen_reactions | true | 24 kB |
| session_exercises | true | 120 kB |
| session_sets | true | 168 kB |
| shared_programs | true | 24 kB |
| shop_items | true | 32 kB |
| sleep_logs | true | 64 kB |
| stretching_logs | true | 24 kB |
| stretching_routines | true | 24 kB |
| supplement_brands | true | 64 kB |
| supplement_categories | true | 64 kB |
| supplement_prices | true | 928 kB |
| supplements | true | 1616 kB |
| timer_presets | true | 48 kB |
| user_ai_credits | true | 128 kB |
| user_badges | true | 24 kB |
| user_gamification | true | 64 kB |
| user_inventory | true | 280 kB |
| user_plugins | true | 120 kB |
| user_profiles | true | 368 kB |
| user_promo_redemptions | true | 16 kB |
| user_supplement_favorites | true | 16 kB |
| waitlist_signups | true | 120 kB |
| wearable_daily_summary | true | 32 kB |
| workout_programs | true | 160 kB |
| workout_sessions | true | 136 kB |
| xp_gifts | true | 32 kB |
| xp_transactions | true | 48 kB |

</details>

**Drift note:** `01-RESEARCH.md` (2026-09-22, earlier session) also reported 99/99 tables — no drift detected between the research snapshot and this execution session.

### Functions

**37 functions** in `public`, **29 SECURITY DEFINER**.

<details>
<summary>Full function list (37), with SECURITY DEFINER flag and identity arguments</summary>

| Function | SECURITY DEFINER | Args |
|---|---|---|
| anonymize_waitlist_signup | true | p_email text |
| award_coins | true | p_user_id uuid, p_amount integer, p_source text, p_source_id uuid, p_description text |
| award_xp | true | p_user_id uuid, p_amount integer, p_source text, p_source_id uuid, p_description text |
| check_and_award_badges | true | p_user_id uuid |
| claim_waitlist_signup | true | p_email text, p_audience text, p_locale text, p_utm_source text, p_utm_campaign text |
| create_form_instances_for_trigger | true | p_trigger_type text, p_athlete_id uuid, p_coach_id uuid, p_n_sessions integer, p_date text |
| deduct_ai_credits | true | p_user_id uuid, p_cost integer, p_action_type text, p_idempotency_key text |
| earn_ai_credits | true | p_user_id uuid, p_source text, p_idempotency_key text, p_amount integer, p_daily_cap integer |
| ensure_community_stats | true | (none) |
| ensure_gamification_profile | true | p_user_id uuid |
| generate_referral_code | false | user_id uuid |
| get_waitlist_founder_status | true | (none) |
| grant_premium_credits | true | p_user_id uuid, p_amount integer |
| handle_new_user | true | (none) |
| handle_new_user_credits | true | (none) |
| handle_updated_at | false | (none) |
| increment_community_stat | true | p_user_id uuid, p_field text, p_amount integer |
| is_coach_of | true | coach uuid, client uuid |
| normalize_waitlist_email | false | p_email text |
| peek_invitation | true | code_input text |
| purchase_shop_item | true | p_user_id uuid, p_item_id uuid |
| record_athlete_decision | true | p_user_id uuid, p_decision_type text, p_week_of date, p_summary text, p_rationale text, p_evidence jsonb, p_outcome jsonb, p_source text, p_state_patch jsonb, p_new_goal jsonb |
| redeem_invitation_code | true | code_input text |
| reset_waitlist_founder_sequence | true | p_next_value bigint |
| rls_auto_enable | true | (none) |
| search_users_fuzzy | true | search_query text, calling_user_id uuid, result_limit integer |
| send_coin_gift | true | p_sender_id uuid, p_receiver_id uuid, p_amount integer, p_message text |
| send_xp_gift | true | p_sender_id uuid, p_receiver_id uuid, p_amount integer, p_message text |
| set_credit_transaction_balance_after | true | (none) |
| unaccent | false | text |
| unaccent | false | regdictionary, text |
| unaccent_init | false | internal |
| unaccent_lexize | false | internal, internal, internal, internal |
| unlock_default_theme | true | (none) |
| update_post_comments_count | true | (none) |
| update_post_likes_count | true | (none) |
| update_updated_at_column | false | (none) |

</details>

**Drift note:** matches `01-RESEARCH.md`'s earlier count of 37 functions / 29 SECURITY DEFINER — no drift.

**Note on "email" substring in this section:** three function names/parameters above (`anonymize_waitlist_signup`, `claim_waitlist_signup`, `normalize_waitlist_email`) legitimately contain the substring "email" as schema metadata (function/parameter identifiers from `pg_proc`/`pg_get_function_identity_arguments`) — these are not `auth.users.email` values. No query in this task selected an email column or any row of actual user data; this is the intended PII-safety boundary (schema shape is fine to document, user data is not).

### RLS Policies

**176 policies** in `public` (count only — full per-table policy detail is deferred to Phase 2's own grep-based audit per `01-RESEARCH.md`'s recommended structure).

### Triggers (public + auth)

**20 triggers** total — 2 on `auth.users`, 18 on `public` tables.

| Schema | Table | Trigger | Function | Definition |
|---|---|---|---|---|
| auth | users | on_auth_user_created | handle_new_user | `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()` |
| auth | users | on_auth_user_created_credits | handle_new_user_credits | `CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits()` |
| public | ai_conversations | trg_conversations_updated | handle_updated_at | `CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | ai_credit_transactions | trg_credit_transaction_balance_after | set_credit_transaction_balance_after | `CREATE TRIGGER trg_credit_transaction_balance_after BEFORE INSERT ON public.ai_credit_transactions FOR EACH ROW EXECUTE FUNCTION set_credit_transaction_balance_after()` |
| public | ai_imports | trg_ai_imports_updated | handle_updated_at | `CREATE TRIGGER trg_ai_imports_updated BEFORE UPDATE ON public.ai_imports FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | athlete_goals | trg_athlete_goals_updated | handle_updated_at | `CREATE TRIGGER trg_athlete_goals_updated BEFORE UPDATE ON public.athlete_goals FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | athlete_state | trg_athlete_state_updated | handle_updated_at | `CREATE TRIGGER trg_athlete_state_updated BEFORE UPDATE ON public.athlete_state FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | coach_branding | trg_coach_branding_updated | handle_updated_at | `CREATE TRIGGER trg_coach_branding_updated BEFORE UPDATE ON public.coach_branding FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | coach_profiles | trg_coach_profiles_updated | handle_updated_at | `CREATE TRIGGER trg_coach_profiles_updated BEFORE UPDATE ON public.coach_profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | friendships | trg_ensure_community_stats | ensure_community_stats | `CREATE TRIGGER trg_ensure_community_stats AFTER INSERT ON public.friendships FOR EACH ROW EXECUTE FUNCTION ensure_community_stats()` |
| public | persona_settings | trg_persona_updated | handle_updated_at | `CREATE TRIGGER trg_persona_updated BEFORE UPDATE ON public.persona_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | plugin_reviews | update_plugin_reviews_updated_at | update_updated_at_column | `CREATE TRIGGER update_plugin_reviews_updated_at BEFORE UPDATE ON public.plugin_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()` |
| public | post_comments | trg_post_comments_count | update_post_comments_count | `CREATE TRIGGER trg_post_comments_count AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION update_post_comments_count()` |
| public | post_likes | trg_post_likes_count | update_post_likes_count | `CREATE TRIGGER trg_post_likes_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION update_post_likes_count()` |
| public | user_ai_credits | trg_user_ai_credits_updated | handle_updated_at | `CREATE TRIGGER trg_user_ai_credits_updated BEFORE UPDATE ON public.user_ai_credits FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | user_gamification | push_user_xp_level_up | http_request | `CREATE TRIGGER push_user_xp_level_up AFTER UPDATE ON public.user_gamification FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://api.ziko-app.com/push-events/supabase', 'POST', '{"Content-type":"application/json","X-Webhook-Secret":"[REDACTED]"}', '{}', '5000')` |
| public | user_profiles | trg_unlock_default_theme | unlock_default_theme | `CREATE TRIGGER trg_unlock_default_theme AFTER INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION unlock_default_theme()` |
| public | user_profiles | trg_user_profiles_updated | handle_updated_at | `CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | workout_programs | trg_programs_updated | handle_updated_at | `CREATE TRIGGER trg_programs_updated BEFORE UPDATE ON public.workout_programs FOR EACH ROW EXECUTE FUNCTION handle_updated_at()` |
| public | workout_sessions | push_workout_session_end | http_request | `CREATE TRIGGER push_workout_session_end AFTER UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://api.ziko-app.com/push-events/supabase', 'POST', '{"Content-type":"application/json","X-Webhook-Secret":"[REDACTED]"}', '{}', '5000')` |

**Security note:** the live `pg_get_triggerdef()` output for `push_user_xp_level_up` and `push_workout_session_end` includes a literal `X-Webhook-Secret` header value embedded in the trigger definition (this is how `supabase_functions.http_request` is configured — the secret is a trigger argument, not an env var). The actual secret value has been redacted (`[REDACTED]`) in this committed file — it must never be copied verbatim into a git-tracked document. See `## Threat Flags` in the plan Summary for follow-up.

**Drift note:** matches `01-RESEARCH.md`'s finding of exactly the two `auth.users` triggers (`on_auth_user_created`, `on_auth_user_created_credits`); the 18 `public`-schema triggers were not enumerated in `01-RESEARCH.md`'s prose (only referenced generically) — this is the first time the full 18 are itemized.

### Storage Buckets

**10 buckets** — matches `01-RESEARCH.md`'s corrected count (not the "9" figure in REQUIREMENTS.md/STORAGE-01).

| Bucket | Public | Object Count | Total Size |
|---|---|---|---|
| ai-imports | false | 9 | 26 MB |
| avatars | true | 2 | 160 kB |
| coach-exercises | false | 5 | 2879 kB |
| coach-kyc | false | 6 | 13 MB |
| coach-logos | true | 1 | 742 kB |
| coach-videos | false | 0 | 0 bytes |
| exercise-media | true | 2660 | 144 MB |
| exports | false | 0 | 0 bytes |
| profile-photos | false | 3 | 1596 kB |
| scan-photos | false | 13 | 16 MB |

**Total: 2,699 objects, ~205 MB** across all buckets.

**Drift note:** exact match with `01-RESEARCH.md`'s per-bucket figures — no drift.

### Storage RLS Policies

**25 policies** on `storage.objects` scoped to ziko's buckets.

<details>
<summary>Full policy list (25)</summary>

| Policy | Command | Qual / With Check |
|---|---|---|
| ai_imports_owner_delete | DELETE | `(bucket_id = 'ai-imports' AND auth.uid()::text = (storage.foldername(name))[1])` |
| ai_imports_owner_insert | INSERT | `(bucket_id = 'ai-imports' AND auth.uid()::text = (storage.foldername(name))[1])` |
| ai_imports_owner_select | SELECT | `(bucket_id = 'ai-imports' AND auth.uid()::text = (storage.foldername(name))[1])` |
| avatar_delete | DELETE | `(bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| avatar_public_read | SELECT | `(bucket_id = 'avatars')` |
| avatar_update | UPDATE | `(bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| avatar_upload | INSERT | `(bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_exercises_delete | DELETE | `(bucket_id = 'coach-exercises' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_exercises_insert | INSERT | `(bucket_id = 'coach-exercises' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_exercises_select | SELECT | `(bucket_id = 'coach-exercises' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_kyc_delete | DELETE | `(bucket_id = 'coach-kyc' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_kyc_insert | INSERT | `(bucket_id = 'coach-kyc' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_kyc_select | SELECT | `(bucket_id = 'coach-kyc' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_logos_coach_write | ALL | `(bucket_id = 'coach-logos' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| coach_logos_public_read | SELECT | `(bucket_id = 'coach-logos')` |
| coach_videos_athlete_read | SELECT | `(bucket_id = 'coach-videos' AND auth.uid()::text = (storage.foldername(name))[1])` |
| coach_videos_athlete_upload | INSERT | `(bucket_id = 'coach-videos' AND auth.uid()::text = (storage.foldername(name))[1])` |
| coach_videos_coach_read | SELECT | `(bucket_id = 'coach-videos' AND is_coach_of(auth.uid(), (storage.foldername(name))[1]::uuid))` |
| exports_read | SELECT | `(bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| profile_photos_insert | INSERT | `(bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| profile_photos_public_read | SELECT | `(bucket_id = 'profile-photos')` |
| profile_photos_update | UPDATE | `(bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| scan_photos_delete | DELETE | `(bucket_id = 'scan-photos' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| scan_photos_read | SELECT | `(bucket_id = 'scan-photos' AND (storage.foldername(name))[1] = auth.uid()::text)` |
| scan_photos_upload | INSERT | `(bucket_id = 'scan-photos' AND (storage.foldername(name))[1] = auth.uid()::text)` |

</details>

### Extensions

**7 extensions.**

| Extension | Version |
|---|---|
| pg_net | 0.20.0 |
| pg_stat_statements | 1.11 |
| pgcrypto | 1.3 |
| plpgsql | 1.0 |
| supabase_vault | 0.3.1 |
| unaccent | 1.1 |
| uuid-ossp | 1.1 |

**Drift note:** exact match with `01-RESEARCH.md` — no drift.

### Realtime Publications

**None** — `pg_publication_tables` for `supabase_realtime` returns 0 rows. Matches `01-RESEARCH.md`.

### Sequence-backed PKs

**None** — no column in `public` has a `nextval(...)` default. Matches `01-RESEARCH.md`.

### DB Size

**42 MB** (`pg_database_size(current_database())`). Matches `01-RESEARCH.md`'s 2026-09-22 figure — no drift.

### Max Connections

**60** (`SHOW max_connections;`, Postgres-level ceiling — not the Supavisor pooler's client-facing limit). Matches `01-RESEARCH.md`.

### Auth User Count

**39** (`SELECT count(*) FROM auth.users;` — count only, no PII selected). Matches `01-RESEARCH.md`'s figure exactly and satisfies this task's acceptance criterion of `>= 39` (ziko is live and only gains signups) — no new signups occurred between the research session and this execution session, or the count would exceed 39.

### Postgres Version (verbatim, feeds Task 2's diff)

```
PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

Build number (from `supabase projects list`): `17.6.1.084`.

## portfolio Live Inventory (INV-02)

All values below were queried live against `portfolio` (`ubxllsvanurkwkohzxau`) on **2026-09-22T06:38:15Z** (same session as the ziko section above) via `supabase db query --linked --project-ref ubxllsvanurkwkohzxau "<SQL>"`, one query per invocation.

### Tables

**34 tables** in `public`, **34 / 34 (100%)** with RLS enabled.

<details>
<summary>Full table list (34), with RLS flag and on-disk size</summary>

| Table | RLS | Size |
|---|---|---|
| album_photos | true | 912 kB |
| albums | true | 104 kB |
| categories | true | 48 kB |
| gecko_admins | true | 32 kB |
| gecko_announcement | true | 32 kB |
| gecko_menu_categories | true | 32 kB |
| gecko_menu_items | true | 32 kB |
| gecko_menu_pages | true | 32 kB |
| gecko_opening_hours | true | 24 kB |
| gecko_phone_verifications | true | 40 kB |
| gecko_reservations | true | 96 kB |
| gecko_restaurant_settings | true | 32 kB |
| gecko_special_hours | true | 24 kB |
| gecko_table_assignments | true | 32 kB |
| gecko_table_configuration_tables | true | 40 kB |
| gecko_table_configurations | true | 24 kB |
| gecko_tables | true | 40 kB |
| orders | true | 32 kB |
| portfolio_photos | true | 112 kB |
| products | true | 32 kB |
| prospects | true | 32 kB |
| rh_chat_messages | true | 24 kB |
| rh_chat_sessions | true | 40 kB |
| rh_employee_sites | true | 40 kB |
| rh_employees | true | 64 kB |
| rh_leave_requests | true | 64 kB |
| rh_notifications | true | 80 kB |
| rh_shift_swaps | true | 48 kB |
| rh_shift_types | true | 48 kB |
| rh_shifts | true | 240 kB |
| rh_sites | true | 48 kB |
| rh_tenants | true | 48 kB |
| rh_unavailabilities | true | 80 kB |
| rh_users | true | 48 kB |

</details>

**Drift note:** total of 34 matches `01-RESEARCH.md`. Correction to research's own parenthetical labels: research's prose said "gecko_* (13)" and "rh_* (11)" but actually *listed* 14 gecko_* names and 13 rh_* names (a labeling typo in the prior document, not a live-data discrepancy) — this live query confirms the correct counts are **14 gecko_\*** and **13 rh_\*** (plus 7 unprefixed = 34 total, unchanged).

### Tenant Breakdown

| Tenant | Count | Tables |
|---|---|---|
| `gecko_*` | 14 | gecko_admins, gecko_announcement, gecko_menu_categories, gecko_menu_items, gecko_menu_pages, gecko_opening_hours, gecko_phone_verifications, gecko_reservations, gecko_restaurant_settings, gecko_special_hours, gecko_table_assignments, gecko_table_configuration_tables, gecko_table_configurations, gecko_tables |
| `rh_*` | 13 | rh_chat_messages, rh_chat_sessions, rh_employee_sites, rh_employees, rh_leave_requests, rh_notifications, rh_shift_swaps, rh_shift_types, rh_shifts, rh_sites, rh_tenants, rh_unavailabilities, rh_users |
| unprefixed — portfolio's own app tables | 7 | album_photos, albums, categories, orders, portfolio_photos, products, prospects |

### Functions

**5 functions** in `public`, **2 SECURITY DEFINER**.

| Function | SECURITY DEFINER | Args |
|---|---|---|
| gecko_is_admin | true | (none) |
| gecko_update_reservation_timestamp | false | (none) |
| gecko_update_updated_at_column | false | (none) |
| set_updated_at | false | (none) |
| swap_shift_employees | true | p_shift_id_a uuid, p_shift_id_b uuid, p_employee_id_a uuid, p_employee_id_b uuid |

**Drift note:** exact match with `01-RESEARCH.md` — no drift. Zero name collisions with ziko's 37 functions (confirmed by cross-checking both function-name lists above — no shared `proname` value).

### RLS Policies

**50 policies** in `public` (not previously enumerated as a total count in `01-RESEARCH.md` — new figure captured this session).

### Triggers (public + auth)

**5 triggers**, all on `public` tables. **0 triggers on `auth.users`** — confirms `01-RESEARCH.md`'s finding that no `handle_new_user`-equivalent trigger exists on portfolio's `auth.users` today.

| Schema | Table | Trigger | Function | Definition |
|---|---|---|---|---|
| public | albums | albums_updated_at | set_updated_at | `CREATE TRIGGER albums_updated_at BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION set_updated_at()` |
| public | gecko_reservations | gecko_reservations_updated_at | gecko_update_reservation_timestamp | `CREATE TRIGGER gecko_reservations_updated_at BEFORE UPDATE ON public.gecko_reservations FOR EACH ROW EXECUTE FUNCTION gecko_update_reservation_timestamp()` |
| public | gecko_restaurant_settings | gecko_restaurant_settings_updated_at | gecko_update_updated_at_column | `CREATE TRIGGER gecko_restaurant_settings_updated_at BEFORE UPDATE ON public.gecko_restaurant_settings FOR EACH ROW EXECUTE FUNCTION gecko_update_updated_at_column()` |
| public | gecko_table_configurations | gecko_table_configurations_updated_at | gecko_update_updated_at_column | `CREATE TRIGGER gecko_table_configurations_updated_at BEFORE UPDATE ON public.gecko_table_configurations FOR EACH ROW EXECUTE FUNCTION gecko_update_updated_at_column()` |
| public | gecko_tables | gecko_tables_updated_at | gecko_update_updated_at_column | `CREATE TRIGGER gecko_tables_updated_at BEFORE UPDATE ON public.gecko_tables FOR EACH ROW EXECUTE FUNCTION gecko_update_updated_at_column()` |

### Storage Buckets

**7 buckets** — matches `01-RESEARCH.md` exactly.

| Bucket | Public | Object Count | Total Size |
|---|---|---|---|
| album-backgrounds | true | 33 | 33 MB |
| album-covers | true | 37 | 32 MB |
| album-photos | true | 1877 | 1071 MB |
| gecko-menu-images | true | 0 | 0 bytes |
| portfolio-photos | true | 178 | 91 MB |
| product-images | true | 0 | 0 bytes |
| sellerie-preview-product-images | true | 0 | 0 bytes |

**Total: 2,125 objects, ~1,227 MB** across all buckets.

**Drift note:** exact match with `01-RESEARCH.md`'s per-bucket figures — no drift. Zero bucket-name collisions with ziko's 10 buckets.

**New tenant surfaced by bucket list:** `sellerie-preview-product-images` (empty) is not part of `rh_*`/`gecko_*`/portfolio's-own-app — it belongs to a *fourth*, separate Supabase project (`sellerieduchet-preview`, confirmed via `supabase projects list`) but the bucket exists inside the `portfolio` project's storage. This is out of scope for the ziko migration (no ziko bucket name collides with it) but is noted here for completeness since it was not named in `01-RESEARCH.md`.

### Storage RLS Policies

**17 policies** on `storage.objects` scoped to portfolio's buckets.

<details>
<summary>Full policy list (17)</summary>

| Policy | Command | Qual / With Check |
|---|---|---|
| Admins can delete gecko menu images | DELETE | `(bucket_id = 'gecko-menu-images' AND gecko_is_admin())` |
| Admins can upload gecko menu images | INSERT | `(bucket_id = 'gecko-menu-images' AND gecko_is_admin())` |
| Public can view gecko menu images | SELECT | `(bucket_id = 'gecko-menu-images')` |
| auth delete album-backgrounds | DELETE | `(bucket_id = 'album-backgrounds')` |
| auth delete album-covers | DELETE | `(bucket_id = 'album-covers')` |
| auth delete album-photos | DELETE | `(bucket_id = 'album-photos')` |
| auth delete portfolio-photos | DELETE | `(bucket_id = 'portfolio-photos')` |
| auth upload album-backgrounds | INSERT | `(bucket_id = 'album-backgrounds')` |
| auth upload album-covers | INSERT | `(bucket_id = 'album-covers')` |
| auth upload album-photos | INSERT | `(bucket_id = 'album-photos')` |
| auth upload portfolio-photos | INSERT | `(bucket_id = 'portfolio-photos')` |
| product_images_select_all | SELECT | `(bucket_id = 'product-images')` |
| public read album-backgrounds | SELECT | `(bucket_id = 'album-backgrounds')` |
| public read album-covers | SELECT | `(bucket_id = 'album-covers')` |
| public read album-photos | SELECT | `(bucket_id = 'album-photos')` |
| public read portfolio-photos | SELECT | `(bucket_id = 'portfolio-photos')` |
| sellerie_preview_product_images_select_all | SELECT | `(bucket_id = 'sellerie-preview-product-images')` |

</details>

**Security note (out of scope, flagged for awareness only):** the four `auth delete`/`auth upload` policies (album-backgrounds/album-covers/album-photos/portfolio-photos) qualify only on `bucket_id`, with no `auth.uid()`/ownership check — any authenticated user of the `portfolio` project can write/delete any object in those four buckets. This is a pre-existing condition of portfolio's own app, unrelated to ziko's migration; not a ziko action item, noted here only because it was directly observed while capturing this inventory.

### Extensions

**6 extensions.**

| Extension | Version |
|---|---|
| pg_cron | 1.6.4 |
| pg_stat_statements | 1.11 |
| pgcrypto | 1.3 |
| plpgsql | 1.0 |
| supabase_vault | 0.3.1 |
| uuid-ossp | 1.1 |

**Drift note:** exact match with `01-RESEARCH.md` — no drift.

### Realtime Publications

**3 tables**: `orders`, `products`, `rh_notifications`. **New finding — not previously captured in `01-RESEARCH.md`** (research's realtime-publication query was only shown/reported for ziko, where it returned empty; portfolio's own realtime membership was not queried in the prior research session). This confirms portfolio has active realtime subscriptions on 3 of its own unprefixed/rh_ tables — relevant if a future Phase 2/6 planning step considers realtime publication changes for any renamed `ziko_*` table (no overlap risk found: none of these 3 table names match any ziko table).

### Sequence-backed PKs

**11 columns found** — all `id` columns on `gecko_*` tables, all integer/bigint sequence-backed (not UUID):

| Table | Column | Default |
|---|---|---|
| gecko_opening_hours | id | `nextval('gecko_opening_hours_id_seq')` |
| gecko_special_hours | id | `nextval('gecko_special_hours_id_seq')` |
| gecko_announcement | id | `nextval('gecko_announcement_id_seq')` |
| gecko_menu_pages | id | `nextval('gecko_menu_pages_id_seq')` |
| gecko_menu_categories | id | `nextval('gecko_menu_categories_id_seq')` |
| gecko_menu_items | id | `nextval('gecko_menu_items_id_seq')` |
| gecko_reservations | id | `nextval('gecko_reservations_id_seq')` |
| gecko_tables | id | `nextval('gecko_tables_id_seq')` |
| gecko_table_configurations | id | `nextval('gecko_table_configurations_id_seq')` |
| gecko_table_assignments | id | `nextval('gecko_table_assignments_id_seq')` |
| gecko_phone_verifications | id | `nextval('gecko_phone_verifications_id_seq')` |

**New finding — not previously captured in `01-RESEARCH.md`** (research's sequence-backed-PK query was only run/reported against ziko, which returned zero; portfolio was not checked in the prior research session). **Relevant for Phase 4 planning (DATA-03 row-count/sequence-reconciliation scope):** since none of ziko's 99 tables use sequence-backed PKs (confirmed zero in the ziko section above), there is no PK-type collision risk between the two schemas — but this confirms `portfolio`'s own `gecko_*` sequences are independent integer counters that must not be touched or reset by any ziko-side migration tooling that assumes UUID-only PKs project-wide.

### DB Size

**20 MB** (`pg_database_size(current_database())`). Matches `01-RESEARCH.md` — no drift.

### Max Connections

**60** (`SHOW max_connections;`). Matches `01-RESEARCH.md` and identical to ziko's figure.

### Auth User Count

**5** (`SELECT count(*) FROM auth.users;` — count only, no PII selected). Matches `01-RESEARCH.md`.

### Postgres Version (verbatim, feeds diff below)

```
PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

Build number (from `supabase projects list`): `17.6.1.105`.

## Version & Extension Diff (INV-04)

### Postgres Version — verbatim comparison

| Project | `SELECT version()` (verbatim) | Build (from `supabase projects list`) |
|---|---|---|
| ziko | `PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit` | `17.6.1.084` |
| portfolio | `PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit` | `17.6.1.105` |

**Assessment:** `SELECT version()`'s text output is byte-for-byte identical between the two projects (same engine build toolchain/platform: `17.6`, `aarch64-unknown-linux-gnu`, `gcc 15.2.0`). The only distinguishing figure is the Supabase-internal build/patch number reported by the Management API (`084` vs `105`) — this is a platform patch revision, not a SQL-visible Postgres version difference, and is **not a compatibility blocker** for Phase 2's dump/restore path (confirmed live, matches `01-RESEARCH.md`'s conclusion).

### Extension Diff

| Extension | ziko | portfolio | Classification | Version Match |
|---|---|---|---|---|
| pg_net | 0.20.0 | — | ziko-only | n/a |
| unaccent | 1.1 | — | ziko-only | n/a |
| pg_cron | — | 1.6.4 | portfolio-only | n/a |
| pg_stat_statements | 1.11 | 1.11 | shared | match |
| pgcrypto | 1.3 | 1.3 | shared | match |
| plpgsql | 1.0 | 1.0 | shared | match |
| supabase_vault | 0.3.1 | 0.3.1 | shared | match |
| uuid-ossp | 1.1 | 1.1 | shared | match |

No version mismatches found among the 5 shared extensions — all report identical `extversion` on both projects.

**Action for Phase 2:**
- `pg_net` (ziko-only, 0.20.0): used for async HTTP calls from Postgres. Two of ziko's public-schema triggers (`push_user_xp_level_up`, `push_workout_session_end`) call `supabase_functions.http_request(...)` directly (confirmed live in the ziko Triggers section above) — this is the Supabase-managed `supabase_functions` wrapper, not a raw `net.http_post` call, so it is unclear from this phase's inspection alone whether `pg_net` itself (vs. the `supabase_functions` schema helper) is the actual dependency. Per D-02 and `01-RESEARCH.md` Open Question 2, Phase 2 must grep `pg_proc.prosrc` across all 37 ziko functions for `net\.` calls to confirm whether `CREATE EXTENSION IF NOT EXISTS pg_net;` is required on `portfolio` before any renamed `ziko_*` function/trigger is created there. Not resolved as blocking in this phase — documented per D-02, not auto-installed.
- `unaccent` (ziko-only, 1.1): likely backs `search_users_fuzzy` (confirmed present in ziko's function list above) — a text-normalization extension. Per D-02, add `CREATE EXTENSION IF NOT EXISTS unaccent;` as an explicit Phase 2 pre-step, gated on Phase 2's own confirmation that `search_users_fuzzy`'s body references `unaccent(...)`. Not auto-installed in this phase.
- `pg_cron` (portfolio-only, 1.6.4): no action needed for ziko's migration — ziko's scheduled jobs run as Vercel crons (per CLAUDE.md), not `pg_cron`. Do not disturb portfolio's existing `pg_cron` usage.

## Capacity & Quota Check (INV-05)

All measured figures below reuse the DB size, per-bucket storage size, and `max_connections` values already captured live in the ziko and portfolio sections above (same session, 2026-09-22T06:38:15Z) — not carried over from `01-RESEARCH.md`.

| Dimension | ziko usage | portfolio usage (pre-migration) | Combined post-migration | Assessment |
|---|---|---|---|---|
| DB size | 42 MB | 20 MB | **62 MB** | No concern at any Supabase plan tier — trivially small even for Free tier's ~500 MB framing. |
| Storage | ~205 MB (2,699 objects across 10 buckets) | ~1,227 MB (2,125 objects across 7 buckets) | **~1,432 MB (~1.4 GB)** | Needs plan-tier confirmation — portfolio alone already exceeds the commonly-cited Free-tier 1 GB storage allowance (consistent with it being an active paid multi-tenant project), but the exact plan and its storage ceiling is not resolvable via SQL/CLI for this org type (see below). |
| `max_connections` (Postgres-level) | 60 | 60 | n/a — shared single pool after merge, not additive | Both projects report the same Postgres-level ceiling. This is the **direct** connection limit, not the Supavisor pooler's client-facing limit (typically higher, and the one application code actually hits) — Phase 6 cutover should use the pooler connection string, not raw Postgres, consistent with STACK.md's existing session-mode-vs-transaction-pooler guidance. |

### Org type confirmation

`supabase orgs list` (run live this session):
```json
{"organizations":[{"id":"vercel_icfg_y5brWcl0o23xn4A50p4NAUFG","slug":"vercel_icfg_y5brWcl0o23xn4A50p4NAUFG","name":"anatholyb1's projects"}]}
```

The org slug carries the **`vercel_icfg_` prefix**, confirming this is a **Vercel Marketplace-managed Supabase integration**, not a native Supabase org. Per `01-RESEARCH.md` Pitfall 4, billing/plan-tier and quota ceilings (storage quota, Supavisor pooler client-connection limit) for this org type are **not exposed via any `supabase orgs`/`projects` CLI subcommand and not SQL-introspectable** — this is a Dashboard-only check (Vercel dashboard → Storage/Integrations tab for the Supabase integration, or Supabase dashboard → Settings → Billing for `ubxllsvanurkwkohzxau`).

### Plan-tier ceiling

**Verdict: sufficient.** Confirmed live via the Vercel dashboard (Integrations > Supabase > `portfolio` resource, and the installation-level Settings page for `icfg_y5brWcl0o23xn4A50p4NAUFG`) by the user, recorded verbatim below.

> Portfolio's plan-tier: Supabase Pro Plan + Micro Compute add-on.
> - Database space ceiling: 8 GB (measured combined post-migration DB size: 62 MB — 0.75% of ceiling)
> - File storage ceiling: 100 GB (measured combined post-migration storage: ~1.4 GB — 1.4% of ceiling)
> - Bandwidth ceiling: 250 GB/month
> - RAM: 1 GB, dedicated CPU
> - Connection-pooler client limit for Micro Compute was not independently re-confirmed on this specific settings page (it did not surface a distinct pooler-vs-raw-Postgres number beyond the already-measured max_connections=60), but given usage is 44 total users (39 ziko + 5 portfolio, not concurrent connections) against any standard Micro-tier pooler allowance, this is not a binding constraint — recorded as "not separately exposed on this page; raw max_connections=60 confirmed, pooler client limit assumed non-binding given the tiny scale."

**Assessment:** Both measured dimensions (DB size, storage) sit well under 2% of their respective plan-tier ceilings — no capacity deficit exists for this migration. The one sub-item not separately re-confirmed (Supavisor pooler client-connection limit, distinct from the already-measured raw Postgres `max_connections=60`) is assessed non-binding given the scale (44 total users, not concurrent connections) rather than silently assumed — per D-03, this is recorded as an explicit, reasoned non-binding assessment, not a blank/skipped field. No plan-upgrade action taken (none needed).
