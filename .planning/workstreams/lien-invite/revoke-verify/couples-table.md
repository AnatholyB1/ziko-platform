| ziko_ai_conversations | insert | backend (cle publishable + JWT, ou service) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_conversations | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_conversations | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_ai_conversations | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_ai_cost_log | insert | backend (cle publishable + JWT, ou service) | 4 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_credit_transactions | insert | backend (cle publishable + JWT, ou service) | 1 | OK | PRIV_DENIED | RLS_DENIED -> PRIV_DENIED | Serveur uniquement (creditService.ts). Voulu. |
| ziko_ai_generated_programs | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_generated_programs | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_generated_programs | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_ai_generated_programs | update | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_ai_imports | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_imports | update | backend (cle publishable + JWT, ou service) | 3 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_ai_messages | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_ai_tool_audit | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_app_invites | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_app_invites | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_body_measurements | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_body_measurements | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_body_measurements | insert | mobile (JWT utilisateur) | 3 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_bug_reports | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_cardio_sessions | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_cardio_sessions | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_cardio_sessions | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_cardio_sessions | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_challenge_participants | delete | mobile (JWT utilisateur) | 1 | OK_0ROWS | PRIV_DENIED | OK_0ROWS -> PRIV_DENIED | Etait deja un no-op (aucune politique DELETE => 0 ligne). Maintenant 42501 explicite; le client ignore l erreur. Pas de regression fonctionnelle. |
| ziko_challenge_participants | insert | mobile (JWT utilisateur) | 4 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_challenge_participants | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_challenge_participants | upsert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_challenge_teams | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_challenges | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_alerts | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_alerts | update | backend (cle publishable + JWT, ou service) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_branding | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_client_links | update | backend (cle publishable + JWT, ou service) | 3 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_client_notes | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_client_tags | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_client_tags | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_client_videos | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_client_videos | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_exercises | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_exercises | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_exercises | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_forms | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_forms | update | backend (cle publishable + JWT, ou service) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_invitations | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_invitations | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_memory | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_metric_thresholds | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_metric_thresholds | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_profiles | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_profiles | update | web (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_profiles | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_profiles | upsert | web (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_program_folders | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_video_annotations | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_video_annotations | insert | backend (cle publishable + JWT, ou service) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_coach_video_annotations | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_coach_vocal_feedbacks | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_community_conversations | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_community_conversations | update | mobile (JWT utilisateur) | 1 | OK_0ROWS | OK_0ROWS | OK_0ROWS -> PRIV_DENIED | OK (privilege passe; RLS ou 0 ligne identique avant; rejoue en cible = 2xx) |
| ziko_community_messages | insert | mobile (JWT utilisateur) | 1 | RLS_DENIED | RLS_DENIED | RLS_DENIED -> PRIV_DENIED | OK (privilege passe; RLS ou 0 ligne identique avant; rejoue en cible = 2xx) |
| ziko_community_posts | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_conversation_members | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_dashboard_configs | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_dashboard_configs | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_exercises | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_food_products | upsert | mobile (JWT utilisateur) | 1 | RLS_DENIED | PRIV_DENIED | RLS_DENIED -> PRIV_DENIED | ECART REEL: UPSERT (ON CONFLICT DO UPDATE) exige le privilege UPDATE meme pour un nouveau code-barres. Avant: 201 (cache OFF rempli). Apres: 42501. |
| ziko_form_instances | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_form_responses | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_friendships | delete | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_friendships | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_friendships | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_group_workout_participants | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_group_workouts | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_habit_encouragements | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_habit_logs | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_habit_logs | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_habit_logs | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_habits | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_habits | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_hydration_logs | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_hydration_logs | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_journal_entries | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_journal_entries | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_notification_log | insert | backend (cle publishable + JWT, ou service) | 1 | RLS_DENIED | PRIV_DENIED | RLS_DENIED -> PRIV_DENIED | Serveur uniquement (notificationService.ts, SUPABASE_SERVICE_KEY obligatoire). Voulu. |
| ziko_notification_log | update | backend (cle publishable + JWT, ou service) | 5 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_notification_log | update | mobile (JWT utilisateur) | 4 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_notification_preferences | upsert | mobile (JWT utilisateur) | 3 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_notification_tokens | update | backend (cle publishable + JWT, ou service) | 3 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_notification_tokens | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_nutrition_logs | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_nutrition_logs | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_nutrition_logs | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_pantry_items | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_pantry_items | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_pantry_items | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_pantry_items | update | backend (cle publishable + JWT, ou service) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_pantry_items | update | mobile (JWT utilisateur) | 3 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_plugin_reviews | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_plugin_reviews | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_plugin_reviews | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_post_comments | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_post_likes | delete | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_post_likes | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_program_exercises | delete | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_program_exercises | insert | mobile (JWT utilisateur) | 4 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_program_exercises | update | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_program_workouts | delete | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_program_workouts | insert | mobile (JWT utilisateur) | 4 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_program_workouts | update | mobile (JWT utilisateur) | 3 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_promo_codes | update | backend (cle publishable + JWT, ou service) | 1 | OK_0ROWS | PRIV_DENIED | OK_0ROWS -> PRIV_DENIED | Serveur uniquement (referral.ts). Voulu. |
| ziko_screen_reactions | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_screen_reactions | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_session_exercises | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_session_exercises | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_session_sets | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_session_sets | upsert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_shared_programs | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_sleep_logs | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_sleep_logs | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_stretching_logs | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_stretching_logs | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_stretching_routines | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_stretching_routines | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_stretching_routines | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_supplement_prices | insert | backend (cle publishable + JWT, ou service) | 1 | RLS_DENIED | PRIV_DENIED | OK -> OK | Idem scraper: anon conserve (OK). |
| ziko_supplements | upsert | backend (cle publishable + JWT, ou service) | 1 | RLS_DENIED | PRIV_DENIED | OK -> OK | Scraper = cle publishable/anon (routes/supplements.ts adminClient): anon conserve (OK). authenticated n est pas utilise. |
| ziko_timer_presets | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_timer_presets | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_timer_presets | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_timer_presets | update | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_ai_credits | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | PRIV_DENIED | RLS_DENIED -> PRIV_DENIED | Serveur uniquement (creditService.ts, cle SERVICE ?? publishable, jamais le JWT utilisateur). Voulu. |
| ziko_user_gamification | update | mobile (JWT utilisateur) | 5 | PRIV_DENIED | PRIV_DENIED | OK_0ROWS -> PRIV_DENIED | Pre-existant (deja 42501 AVANT la migration: UPDATE absent du schema importe). Non cause par la migration. |
| ziko_user_inventory | update | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_plugins | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_plugins | delete | mobile (JWT utilisateur) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_plugins | update | backend (cle publishable + JWT, ou service) | 2 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_plugins | upsert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_user_plugins | upsert | mobile (JWT utilisateur) | 6 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_user_profiles | update | backend (cle publishable + JWT, ou service) | 3 | OK_0ROWS | OK_0ROWS | OK_0ROWS -> PRIV_DENIED | OK (privilege passe; RLS ou 0 ligne identique avant; rejoue en cible = 2xx) |
| ziko_user_profiles | update | mobile (JWT utilisateur) | 11 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_profiles | update | web (JWT utilisateur) | 1 | OK_0ROWS | OK_0ROWS | OK_0ROWS -> PRIV_DENIED | OK (privilege passe; RLS ou 0 ligne identique avant; rejoue en cible = 2xx) |
| ziko_user_profiles | upsert | mobile (JWT utilisateur) | 4 | RLS_DENIED | RLS_DENIED | RLS_DENIED -> PRIV_DENIED | OK (privilege passe; RLS ou 0 ligne identique avant; rejoue en cible = 2xx) |
| ziko_user_promo_redemptions | insert | backend (cle publishable + JWT, ou service) | 1 | OK | PRIV_DENIED | RLS_DENIED -> PRIV_DENIED | Serveur uniquement (referral.ts, cle SERVICE ?? publishable). Voulu. |
| ziko_user_supplement_favorites | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_supplement_favorites | delete | mobile (JWT utilisateur) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_user_supplement_favorites | insert | backend (cle publishable + JWT, ou service) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_user_supplement_favorites | insert | mobile (JWT utilisateur) | 1 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_waitlist_signups | update | web (JWT utilisateur) | 1 | PRIV_DENIED | PRIV_DENIED | PRIV_DENIED -> PRIV_DENIED | Voulu: client = createAdminClient (service_role), inchange. 42501 pour authenticated deja present avant (migration 150000). |
| ziko_workout_programs | delete | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_workout_programs | insert | backend (cle publishable + JWT, ou service) | 5 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_workout_programs | update | backend (cle publishable + JWT, ou service) | 1 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_workout_programs | update | mobile (JWT utilisateur) | 9 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |
| ziko_workout_sessions | insert | mobile (JWT utilisateur) | 2 | OK | OK | RLS_DENIED -> PRIV_DENIED | OK |
| ziko_workout_sessions | update | mobile (JWT utilisateur) | 3 | OK | OK | OK_0ROWS -> PRIV_DENIED | OK |