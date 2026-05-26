-- Phase 37: Add settings JSONB to user_profiles for persona and coaching preferences
-- Safe: ADD COLUMN IF NOT EXISTS; idempotent on live DB where column may already exist
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.user_profiles.settings IS 'User AI and app preferences. Keys: ai_persona, ai_language, ai_coaching_style, ai_response_length, notif_prefs, hydration_goal_ml.';
