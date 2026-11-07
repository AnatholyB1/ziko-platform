-- ziko: narrow client (anon / authenticated) table privileges on ziko_* tables.
--
-- WHY
--   The schema migration replays the privileges of the source project, where Supabase default
--   privileges gave anon and authenticated every table privilege (SELECT, INSERT, UPDATE, DELETE,
--   TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) on every ziko_* table. Protection relied on RLS alone, and
--   RLS does not govern TRUNCATE / REFERENCES / TRIGGER / MAINTAIN at all (anon could TRUNCATE any
--   ziko_* table with the public anon key). Tables with no write policy returned
--   silently-filtered "0 rows" instead of a permission error, and server-only tables (credit balance,
--   credit ledger, waitlist, app config) were writable by the owning user whenever an `_own` policy
--   existed (e.g. a user could UPDATE ziko_user_ai_credits.balance on their own row).
--
-- RULES APPLIED (derived from pg_policy as of the last portfolio migration + a scan of every
--   .from('ziko_*') call in apps/, plugins/, packages/, backend/api/src)
--   1. TRUNCATE, REFERENCES, TRIGGER, MAINTAIN are revoked from anon and authenticated everywhere.
--      No client code uses them; they are not subject to RLS.
--   2. anon loses INSERT/UPDATE/DELETE everywhere, EXCEPT where a permissive policy is explicitly
--      `TO anon`: ziko_supplements, ziko_supplement_prices, ziko_supplement_brands. The catalog scraper
--      (backend/api/src/scrapers via routes/supplements.ts adminClient) writes them with the
--      PUBLISHABLE (anon) key today. Kept to avoid breaking the Monday cron; see FOLLOW-UP below.
--      All other policies are `TO public` with auth.uid()-based predicates and can never match anon.
--   3. authenticated keeps INSERT / UPDATE / DELETE only where (a) a permissive policy for
--      authenticated (or public) covers that command, AND (b) some mobile / web / backend code path
--      writes that table with .from(). Writes that have no .from() writer are done through SECURITY
--      DEFINER functions (ziko_award_xp, ziko_send_coin_gift, ziko_purchase_shop_item, ...) or by
--      service_role, neither of which is affected by this migration.
--   4. Server-only tables (written only with the service key in backend/api/src: ziko_user_ai_credits,
--      ziko_ai_credit_transactions, ziko_user_promo_redemptions) become SELECT-only for authenticated even
--      though an `_own` policy exists. Their writes go through SECURITY DEFINER RPCs
--      (ziko_deduct_ai_credits, ziko_earn_ai_credits, ziko_grant_premium_credits) or service_role.
--   SELECT is intentionally NOT touched on any table (reads are governed by the existing policies).
--   service_role keeps everything. Only ziko_* tables are named; other apps in the shared portfolio
--   project are never touched.
--
-- PRIVILEGES NOT CHANGED
--   * SELECT, and all column / sequence / function privileges.
--   * Default privileges (ALTER DEFAULT PRIVILEGES) are role-wide in the shared portfolio project and
--     would change other apps' future tables, so they are deliberately left alone. Every NEW ziko_*
--     table migration must therefore carry its own explicit REVOKE ... FROM anon, authenticated
--     (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN, plus any DML the RLS policies do not need).
--
-- FOLLOW-UP (not done here, needs a code change first)
--   * Supplement catalog: switch the scraper to a service-role client, then drop the `*_anon_write`
--     policies and revoke the anon DML kept above.
--   * Client-written backend tables (ziko_coach_*, ziko_ai_cost_log, ...) keep policy-derived DML:
--     the backend mixes service-key and user-JWT clients, so a tighter per-table cut needs a code audit.
--   * anon SELECT on tables without an anon-readable policy is harmless (RLS returns 0 rows) and left
--     in place to avoid permission errors in SECURITY INVOKER paths.
--
-- IDEMPOTENT: REVOKE of a privilege that is not held is a no-op, so the migration can be re-run.
-- Plain statements, no dynamic SQL; safe inside the migration runner's transaction.

-- ziko_ai_conversations: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_conversations FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_conversations FROM authenticated;
-- ziko_ai_cost_log: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_cost_log FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_cost_log FROM authenticated;
-- ziko_ai_credit_transactions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_credit_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_credit_transactions FROM authenticated;
-- ziko_ai_generated_programs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_generated_programs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_generated_programs FROM authenticated;
-- ziko_ai_imports: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_imports FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_imports FROM authenticated;
-- ziko_ai_messages: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_messages FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_messages FROM authenticated;
-- ziko_ai_tool_audit: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_tool_audit FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_ai_tool_audit FROM authenticated;
-- ziko_app_config: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_app_config FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_app_config FROM authenticated;
-- ziko_app_invites: authenticated keeps INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_app_invites FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_app_invites FROM authenticated;
-- ziko_athlete_decisions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_athlete_decisions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_athlete_decisions FROM authenticated;
-- ziko_athlete_goals: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_athlete_goals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_athlete_goals FROM authenticated;
-- ziko_athlete_state: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_athlete_state FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_athlete_state FROM authenticated;
-- ziko_badge_definitions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_badge_definitions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_badge_definitions FROM authenticated;
-- ziko_body_measurements: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_body_measurements FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_body_measurements FROM authenticated;
-- ziko_bug_reports: authenticated keeps INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_bug_reports FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_bug_reports FROM authenticated;
-- ziko_cardio_sessions: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_cardio_sessions FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_cardio_sessions FROM authenticated;
-- ziko_challenge_participants: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_challenge_participants FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_challenge_participants FROM authenticated;
-- ziko_challenge_teams: authenticated keeps INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_challenge_teams FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_challenge_teams FROM authenticated;
-- ziko_challenges: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_challenges FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_challenges FROM authenticated;
-- ziko_coach_alerts: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_alerts FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_alerts FROM authenticated;
-- ziko_coach_branding: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_branding FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_branding FROM authenticated;
-- ziko_coach_client_links: authenticated keeps UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_links FROM anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_links FROM authenticated;
-- ziko_coach_client_notes: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_notes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_notes FROM authenticated;
-- ziko_coach_client_tags: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_tags FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_tags FROM authenticated;
-- ziko_coach_client_videos: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_videos FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_client_videos FROM authenticated;
-- ziko_coach_exercises: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_exercises FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_exercises FROM authenticated;
-- ziko_coach_forms: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_forms FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_forms FROM authenticated;
-- ziko_coach_invitations: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_invitations FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_invitations FROM authenticated;
-- ziko_coach_memory: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_memory FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_memory FROM authenticated;
-- ziko_coach_metric_thresholds: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_metric_thresholds FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_metric_thresholds FROM authenticated;
-- ziko_coach_profiles: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_profiles FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_profiles FROM authenticated;
-- ziko_coach_program_folders: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_program_folders FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_program_folders FROM authenticated;
-- ziko_coach_video_annotations: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_video_annotations FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_video_annotations FROM authenticated;
-- ziko_coach_vocal_feedbacks: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_vocal_feedbacks FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coach_vocal_feedbacks FROM authenticated;
-- ziko_coin_gifts: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coin_gifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coin_gifts FROM authenticated;
-- ziko_coin_transactions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coin_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_coin_transactions FROM authenticated;
-- ziko_community_conversations: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_conversations FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_conversations FROM authenticated;
-- ziko_community_messages: authenticated keeps INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_messages FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_messages FROM authenticated;
-- ziko_community_posts: authenticated keeps DELETE/INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_posts FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_posts FROM authenticated;
-- ziko_community_user_stats: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_user_stats FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_community_user_stats FROM authenticated;
-- ziko_conversation_members: authenticated keeps DELETE/INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_conversation_members FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_conversation_members FROM authenticated;
-- ziko_dashboard_configs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_dashboard_configs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_dashboard_configs FROM authenticated;
-- ziko_exercise_import_log: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_exercise_import_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_exercise_import_log FROM authenticated;
-- ziko_exercises: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_exercises FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_exercises FROM authenticated;
-- ziko_exercises_merge_backup: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_exercises_merge_backup FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_exercises_merge_backup FROM authenticated;
-- ziko_food_database: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_food_database FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_food_database FROM authenticated;
-- ziko_food_products: authenticated keeps INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_food_products FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_food_products FROM authenticated;
-- ziko_form_instances: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_form_instances FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_form_instances FROM authenticated;
-- ziko_form_responses: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_form_responses FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_form_responses FROM authenticated;
-- ziko_friendships: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_friendships FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_friendships FROM authenticated;
-- ziko_group_workout_participants: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_group_workout_participants FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_group_workout_participants FROM authenticated;
-- ziko_group_workouts: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_group_workouts FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_group_workouts FROM authenticated;
-- ziko_habit_encouragements: authenticated keeps INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_habit_encouragements FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_habit_encouragements FROM authenticated;
-- ziko_habit_logs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_habit_logs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_habit_logs FROM authenticated;
-- ziko_habits: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_habits FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_habits FROM authenticated;
-- ziko_health_sync_log: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_health_sync_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_health_sync_log FROM authenticated;
-- ziko_hydration_logs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_hydration_logs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_hydration_logs FROM authenticated;
-- ziko_journal_entries: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_journal_entries FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_journal_entries FROM authenticated;
-- ziko_level_definitions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_level_definitions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_level_definitions FROM authenticated;
-- ziko_notification_log: authenticated keeps UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_notification_log FROM anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_notification_log FROM authenticated;
-- ziko_notification_preferences: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_notification_preferences FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_notification_preferences FROM authenticated;
-- ziko_notification_tokens: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_notification_tokens FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_notification_tokens FROM authenticated;
-- ziko_nutrition_logs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_nutrition_logs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_nutrition_logs FROM authenticated;
-- ziko_pantry_items: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_pantry_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_pantry_items FROM authenticated;
-- ziko_persona_settings: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_persona_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_persona_settings FROM authenticated;
-- ziko_plugin_reviews: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_plugin_reviews FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_plugin_reviews FROM authenticated;
-- ziko_plugins_registry: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_plugins_registry FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_plugins_registry FROM authenticated;
-- ziko_post_comments: authenticated keeps DELETE/INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_post_comments FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_post_comments FROM authenticated;
-- ziko_post_likes: authenticated keeps DELETE/INSERT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_post_likes FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_post_likes FROM authenticated;
-- ziko_program_exercises: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_program_exercises FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_program_exercises FROM authenticated;
-- ziko_program_workouts: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_program_workouts FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_program_workouts FROM authenticated;
-- ziko_promo_codes: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_promo_codes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_promo_codes FROM authenticated;
-- ziko_screen_reactions: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_screen_reactions FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_screen_reactions FROM authenticated;
-- ziko_session_exercises: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_session_exercises FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_session_exercises FROM authenticated;
-- ziko_session_sets: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_session_sets FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_session_sets FROM authenticated;
-- ziko_shared_programs: authenticated keeps INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_shared_programs FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_shared_programs FROM authenticated;
-- ziko_shop_items: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_shop_items FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_shop_items FROM authenticated;
-- ziko_sleep_logs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_sleep_logs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_sleep_logs FROM authenticated;
-- ziko_stretching_logs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_stretching_logs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_stretching_logs FROM authenticated;
-- ziko_stretching_routines: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_stretching_routines FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_stretching_routines FROM authenticated;
-- ziko_supplement_brands: anon keeps DELETE/INSERT/UPDATE (explicit anon policy); authenticated: SELECT only
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_brands FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_brands FROM authenticated;
-- ziko_supplement_categories: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_categories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_categories FROM authenticated;
-- ziko_supplement_prices: anon keeps DELETE/INSERT/UPDATE (explicit anon policy); authenticated: SELECT only
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_prices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplement_prices FROM authenticated;
-- ziko_supplements: anon keeps DELETE/INSERT/UPDATE (explicit anon policy); authenticated: SELECT only
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_supplements FROM authenticated;
-- ziko_timer_presets: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_timer_presets FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_timer_presets FROM authenticated;
-- ziko_user_ai_credits: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_ai_credits FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_ai_credits FROM authenticated;
-- ziko_user_badges: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_badges FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_badges FROM authenticated;
-- ziko_user_gamification: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_gamification FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_gamification FROM authenticated;
-- ziko_user_inventory: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_inventory FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_inventory FROM authenticated;
-- ziko_user_plugins: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_plugins FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_plugins FROM authenticated;
-- ziko_user_profiles: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_profiles FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_profiles FROM authenticated;
-- ziko_user_promo_redemptions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_promo_redemptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_promo_redemptions FROM authenticated;
-- ziko_user_supplement_favorites: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_supplement_favorites FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_user_supplement_favorites FROM authenticated;
-- ziko_waitlist_signups: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_waitlist_signups FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_waitlist_signups FROM authenticated;
-- ziko_wearable_daily_summary: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_wearable_daily_summary FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_wearable_daily_summary FROM authenticated;
-- ziko_workout_programs: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_workout_programs FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_workout_programs FROM authenticated;
-- ziko_workout_sessions: authenticated keeps DELETE/INSERT/UPDATE
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_workout_sessions FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_workout_sessions FROM authenticated;
-- ziko_xp_gifts: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_xp_gifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_xp_gifts FROM authenticated;
-- ziko_xp_transactions: authenticated: SELECT only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_xp_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ziko_xp_transactions FROM authenticated;

-- Verified fix (independent replay of 155 write couples on a disposable stack): the Open Food Facts cache upsert is INSERT ... ON CONFLICT DO UPDATE and needs UPDATE.
-- No UPDATE policy exists on ziko_food_products, so no row becomes modifiable. Applied to portfolio on 2026-11-07.
GRANT UPDATE ON TABLE public.ziko_food_products TO authenticated;
