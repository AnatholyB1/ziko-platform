-- ============================================================
-- ZIKO NEW PLUGINS — Database Schema
-- Migration: 012_new_plugins_schema.sql
-- Tables for: stretching, sleep, measurements, timer, 
--             ai-programs, journal, hydration, cardio
-- ============================================================

-- ── Stretching Logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stretching_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_name  TEXT NOT NULL,
  duration_sec  INTEGER NOT NULL,
  exercises     JSONB NOT NULL DEFAULT '[]',
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stretching_logs_user_date ON public.stretching_logs(user_id, date DESC);

ALTER TABLE public.stretching_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stretching_logs_own" ON public.stretching_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Sleep Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bedtime       TEXT NOT NULL,
  wake_time     TEXT NOT NULL,
  duration_hours NUMERIC(4,2) NOT NULL,
  quality       INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
  notes         TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON public.sleep_logs(user_id, date DESC);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sleep_logs_own" ON public.sleep_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Body Measurements ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.body_measurements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg     NUMERIC(5,2),
  body_fat_pct  NUMERIC(4,1),
  waist_cm      NUMERIC(5,1),
  chest_cm      NUMERIC(5,1),
  arm_cm        NUMERIC(5,1),
  thigh_cm      NUMERIC(5,1),
  hip_cm        NUMERIC(5,1),
  photo_url     TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON public.body_measurements(user_id, date DESC);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_measurements_own" ON public.body_measurements
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Timer Presets ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timer_presets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('tabata', 'hiit', 'emom', 'rest', 'custom')),
  work_sec      INTEGER NOT NULL,
  rest_sec      INTEGER NOT NULL DEFAULT 0,
  rounds        INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timer_presets_user ON public.timer_presets(user_id);

ALTER TABLE public.timer_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timer_presets_own" ON public.timer_presets
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── AI Generated Programs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_generated_programs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  goal          TEXT NOT NULL,
  split_type    TEXT NOT NULL,
  days_per_week INTEGER NOT NULL,
  experience    TEXT,
  equipment     TEXT,
  program_data  JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_programs_user ON public.ai_generated_programs(user_id);

ALTER TABLE public.ai_generated_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_generated_programs_own" ON public.ai_generated_programs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Journal Entries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood          INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy        INTEGER NOT NULL DEFAULT 3 CHECK (energy BETWEEN 1 AND 5),
  stress        INTEGER NOT NULL DEFAULT 2 CHECK (stress BETWEEN 1 AND 5),
  context       TEXT NOT NULL DEFAULT 'general'
                  CHECK (context IN ('pre_workout', 'post_workout', 'morning', 'evening', 'general')),
  notes         TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries(user_id, date DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_entries_own" ON public.journal_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Hydration Logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hydration_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml     INTEGER NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_date ON public.hydration_logs(user_id, date DESC);

ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hydration_logs_own" ON public.hydration_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Cardio Sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cardio_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type       TEXT NOT NULL CHECK (activity_type IN ('running', 'cycling', 'swimming', 'hiit', 'walking', 'elliptical', 'rowing', 'other')),
  duration_min        NUMERIC(6,1) NOT NULL,
  distance_km         NUMERIC(7,2),
  calories_burned     INTEGER,
  avg_heart_rate      INTEGER,
  avg_pace_sec_per_km INTEGER,
  notes               TEXT,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cardio_sessions_user_date ON public.cardio_sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_sessions_type ON public.cardio_sessions(user_id, activity_type);

ALTER TABLE public.cardio_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cardio_sessions_own" ON public.cardio_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Register new plugins ─────────────────────────────────
INSERT INTO public.plugins_registry (plugin_id, manifest, bundle_url, is_active, version)
VALUES
(
  'stretching',
  '{
    "id": "stretching",
    "name": "Stretching & Mobilité",
    "version": "1.0.0",
    "description": "Routines d''étirement pré/post entraînement, sessions de mobilité guidées avec minuteur.",
    "icon": "body-outline",
    "category": "training",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history"],
    "userDataKeys": ["stretching"],
    "aiSkills": [
      {"name": "stretching_recommendation", "description": "Recommend stretching routines based on workout", "triggerKeywords": ["étirement","stretch","mobilité","souplesse","échauffement","warm up","cool down"]},
      {"name": "stretching_coaching", "description": "Coach through stretching exercises", "triggerKeywords": ["douleur","raideur","stiff","tight","recovery","récupération"]}
    ],
    "routes": [
      {"path": "/(plugins)/stretching/dashboard", "title": "Stretching", "icon": "body-outline", "showInTabBar": true},
      {"path": "/(plugins)/stretching/session", "title": "Session", "icon": "play-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'sleep',
  '{
    "id": "sleep",
    "name": "Sommeil & Récupération",
    "version": "1.0.0",
    "description": "Suivi du sommeil, score de récupération, analyse de la qualité et conseils personnalisés.",
    "icon": "moon-outline",
    "category": "health",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["sleep"],
    "aiSkills": [
      {"name": "sleep_analysis", "description": "Analyze sleep patterns and quality", "triggerKeywords": ["sommeil","sleep","dormir","fatigue","insomnie","nuit","repos"]},
      {"name": "recovery_coaching", "description": "Recovery advice based on sleep data", "triggerKeywords": ["récupération","recovery","repos","rest","fatigue","énergie"]}
    ],
    "routes": [
      {"path": "/(plugins)/sleep/dashboard", "title": "Sommeil", "icon": "moon-outline", "showInTabBar": true},
      {"path": "/(plugins)/sleep/log", "title": "Logger", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'measurements',
  '{
    "id": "measurements",
    "name": "Mesures & Progression",
    "version": "1.0.0",
    "description": "Suivi des mensurations corporelles : poids, tour de taille, bras, cuisses, % de gras.",
    "icon": "resize-outline",
    "category": "health",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["measurements"],
    "aiSkills": [
      {"name": "body_progress", "description": "Analyze body measurement trends", "triggerKeywords": ["mensurations","mesures","poids","weight","tour de taille","body fat","gras","progression corporelle","body"]}
    ],
    "routes": [
      {"path": "/(plugins)/measurements/dashboard", "title": "Mesures", "icon": "resize-outline", "showInTabBar": true},
      {"path": "/(plugins)/measurements/log", "title": "Nouvelle mesure", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'timer',
  '{
    "id": "timer",
    "name": "Timer & Chrono",
    "version": "1.0.0",
    "description": "Minuteur d''entraînement : Tabata, HIIT, EMOM, repos. Presets personnalisés.",
    "icon": "timer-outline",
    "category": "training",
    "price": "free",
    "requiredPermissions": [],
    "userDataKeys": ["timer"],
    "aiSkills": [
      {"name": "timer_recommendation", "description": "Recommend timer settings for workouts", "triggerKeywords": ["timer","chrono","minuteur","tabata","emom","hiit","interval","repos","rest"]}
    ],
    "routes": [
      {"path": "/(plugins)/timer/dashboard", "title": "Timer", "icon": "timer-outline", "showInTabBar": true}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'ai-programs',
  '{
    "id": "ai-programs",
    "name": "Programmes IA",
    "version": "1.0.0",
    "description": "Génération de programmes d''entraînement personnalisés par l''IA selon vos objectifs.",
    "icon": "sparkles-outline",
    "category": "training",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history"],
    "userDataKeys": ["ai-programs"],
    "aiSkills": [
      {"name": "program_generation", "description": "Generate personalized workout programs", "triggerKeywords": ["programme","program","plan","routine","générer","generate","semaine","week"]},
      {"name": "program_adaptation", "description": "Adjust existing programs based on progress", "triggerKeywords": ["adapter","adjust","modifier","changer","plateau","progression"]}
    ],
    "routes": [
      {"path": "/(plugins)/ai-programs/dashboard", "title": "Programmes IA", "icon": "sparkles-outline", "showInTabBar": true},
      {"path": "/(plugins)/ai-programs/generate", "title": "Générer", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'journal',
  '{
    "id": "journal",
    "name": "Journal & Mindset",
    "version": "1.0.0",
    "description": "Journal d''humeur pré/post séance, suivi du stress et de l''énergie mentale.",
    "icon": "journal-outline",
    "category": "coaching",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history"],
    "userDataKeys": ["journal"],
    "aiSkills": [
      {"name": "mood_analysis", "description": "Analyze mood patterns and correlate with workouts", "triggerKeywords": ["humeur","mood","énergie","energy","motivation","moral","stress","mental","journal"]},
      {"name": "mindset_coaching", "description": "Mental coaching and motivation", "triggerKeywords": ["démotivé","unmotivated","confiance","confidence","mindset","positif","gratitude"]}
    ],
    "routes": [
      {"path": "/(plugins)/journal/dashboard", "title": "Journal", "icon": "journal-outline", "showInTabBar": true},
      {"path": "/(plugins)/journal/entry", "title": "Nouvelle entrée", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'hydration',
  '{
    "id": "hydration",
    "name": "Hydratation",
    "version": "1.0.0",
    "description": "Suivi de consommation d''eau quotidienne. Compteur de verres, objectif personnalisé.",
    "icon": "water-outline",
    "category": "health",
    "price": "free",
    "requiredPermissions": ["read_profile"],
    "userDataKeys": ["hydration"],
    "aiSkills": [
      {"name": "hydration_tracking", "description": "Track and analyze daily water intake", "triggerKeywords": ["eau","water","hydratation","hydration","boire","drink","verre","glass","litre"]}
    ],
    "routes": [
      {"path": "/(plugins)/hydration/dashboard", "title": "Hydratation", "icon": "water-outline", "showInTabBar": true}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
),
(
  'cardio',
  '{
    "id": "cardio",
    "name": "Cardio & Running",
    "version": "1.0.0",
    "description": "Suivi des sessions cardio : course, vélo, natation, HIIT. Distance, durée, allure, calories.",
    "icon": "fitness-outline",
    "category": "training",
    "price": "free",
    "requiredPermissions": ["read_profile", "read_workout_history"],
    "userDataKeys": ["cardio"],
    "aiSkills": [
      {"name": "cardio_analysis", "description": "Analyze cardio performance and pace trends", "triggerKeywords": ["cardio","course","running","courir","vélo","cycling","natation","allure","pace","distance","endurance"]},
      {"name": "running_coaching", "description": "Running plans and training advice", "triggerKeywords": ["plan course","running plan","marathon","5k","10k","fractionné","tempo","endurance fondamentale"]}
    ],
    "routes": [
      {"path": "/(plugins)/cardio/dashboard", "title": "Cardio", "icon": "fitness-outline", "showInTabBar": true},
      {"path": "/(plugins)/cardio/log", "title": "Nouvelle session", "icon": "add-circle-outline", "showInTabBar": false}
    ]
  }'::jsonb,
  NULL, TRUE, '1.0.0'
)
ON CONFLICT (plugin_id) DO UPDATE
  SET manifest = EXCLUDED.manifest,
      version  = EXCLUDED.version;
