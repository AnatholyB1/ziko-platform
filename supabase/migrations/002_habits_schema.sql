-- ============================================================
-- ZIKO HABITS PLUGIN — Database Schema
-- Run after 001_initial_schema.sql
-- ============================================================

-- ── Habits definitions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habits (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  emoji         TEXT NOT NULL DEFAULT '✅',
  color         TEXT NOT NULL DEFAULT '#6C63FF',
  type          TEXT NOT NULL DEFAULT 'boolean' CHECK (type IN ('boolean', 'count')),
  target        INTEGER NOT NULL DEFAULT 1,
  unit          TEXT,                         -- 'glasses', 'minutes', 'km', etc.
  source        TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'workout_auto', 'nutrition_auto')),
  reminder_time TEXT,                         -- 'HH:MM' — stored as text, parsed client-side
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON public.habits(user_id) WHERE is_active = TRUE;

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habits_own" ON public.habits
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Daily habit logs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id   UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  value      INTEGER NOT NULL DEFAULT 1, -- boolean habits: 1=done; count habits: actual count
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON public.habit_logs(habit_id);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_logs_own" ON public.habit_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Add habits plugin to registry ────────────────────────
INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES (
  'habits',
  '{
    "id": "habits",
    "name": "Daily Habits & Goals",
    "version": "1.0.0",
    "description": "Track your daily goals: water, workouts, sleep, nutrition and custom habits. Smart reminders and streaks — fully connected to your AI coach, workout history and nutrition plugin.",
    "icon": "checkmark-circle-outline",
    "category": "coaching",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history", "read_nutrition", "notifications"],
    "userDataKeys": ["habits"],
    "aiSkills": [
      {"name": "habit_analysis", "description": "Analyse habit streaks and completion rate", "triggerKeywords": ["habit","streak","routine","daily goal","habitude","objectif"]},
      {"name": "habit_coaching", "description": "Advice on building good habits", "triggerKeywords": ["build habit","consistency","motivation","tracking","routine"]}
    ],
    "routes": [
      {"path": "/(plugins)/habits/dashboard", "title": "Habits", "icon": "checkmark-circle-outline", "showInTabBar": true},
      {"path": "/(plugins)/habits/log", "title": "Add Habit", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL,
  TRUE,
  '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest = EXCLUDED.manifest,
      version  = EXCLUDED.version;
