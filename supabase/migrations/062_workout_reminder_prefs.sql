-- 062 — Workout Reminder Preferences
-- ============================================================
-- PURPOSE: Add workout reminder day/time preferences to notification_preferences.
--
-- Plans 06-02 and 06-03 read and write these columns to schedule local
-- Expo notifications for recurring workout reminders. Without this migration
-- the UPSERT in workout/[id].tsx will fail at runtime with a column-not-found error.
--
-- The existing `notification_preferences_own` RLS policy (auth.uid() = user_id)
-- from migration 054 covers the new columns automatically — no additional policy needed.
-- ============================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS workout_reminder_days JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS workout_reminder_time TEXT DEFAULT NULL;

-- workout_reminder_days: JSON array of lowercase weekday strings
--   e.g. ["monday","wednesday","friday"]
--   NOT NULL with DEFAULT '[]' so existing rows get an empty array rather than NULL.

-- workout_reminder_time: time string in "HH:MM" format
--   e.g. "07:30"
--   NULL means no workout reminder is configured.
