-- ============================================================
-- ZIKO PLATFORM — Supabase Schema
-- Run this in Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & PROFILES
-- ============================================================

-- user_profiles (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT,
  age          INTEGER CHECK (age > 0 AND age < 150),
  weight_kg    DECIMAL(5,2),
  height_cm    DECIMAL(5,2),
  goal         TEXT CHECK (goal IN ('muscle_gain', 'fat_loss', 'maintenance', 'endurance')),
  units        TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  avatar_url   TEXT,
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXERCISES & PROGRAMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercises (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('strength','cardio','flexibility','balance','sports')),
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  instructions  TEXT,
  video_url     TEXT,
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercises_category ON public.exercises(category);
CREATE INDEX idx_exercises_user ON public.exercises(user_id);

CREATE TABLE IF NOT EXISTS public.workout_programs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  days_per_week INTEGER CHECK (days_per_week BETWEEN 1 AND 7),
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programs_user ON public.workout_programs(user_id);

CREATE TABLE IF NOT EXISTS public.program_workouts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id  UUID NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.program_exercises (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id   UUID NOT NULL REFERENCES public.program_workouts(id) ON DELETE CASCADE,
  exercise_id  UUID NOT NULL REFERENCES public.exercises(id),
  sets         INTEGER,
  reps         INTEGER,
  rest_seconds INTEGER,
  notes        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- WORKOUT SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_workout_id  UUID REFERENCES public.program_workouts(id),
  name                TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  notes               TEXT,
  total_volume_kg     DECIMAL(10,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX idx_sessions_started ON public.workout_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS public.session_sets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id       UUID NOT NULL REFERENCES public.exercises(id),
  set_number        INTEGER NOT NULL,
  reps              INTEGER,
  weight_kg         DECIMAL(6,2),
  duration_seconds  INTEGER,
  completed         BOOLEAN NOT NULL DEFAULT FALSE,
  rpe               INTEGER CHECK (rpe BETWEEN 1 AND 10),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sets_session ON public.session_sets(session_id);
CREATE INDEX idx_sets_exercise ON public.session_sets(exercise_id);

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT,
  plugin_context JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON public.ai_conversations(user_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON public.ai_messages(conversation_id);

-- ============================================================
-- PLUGIN REGISTRY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plugins_registry (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_id   TEXT NOT NULL UNIQUE,
  manifest    JSONB NOT NULL,
  bundle_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  version     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_plugins (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id    TEXT NOT NULL REFERENCES public.plugins_registry(plugin_id),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings     JSONB DEFAULT '{}',
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, plugin_id)
);

CREATE INDEX idx_user_plugins_user ON public.user_plugins(user_id);

-- ============================================================
-- NUTRITION PLUGIN TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  meal_type   TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  food_name   TEXT NOT NULL,
  serving_g   DECIMAL(7,2),
  calories    DECIMAL(7,2),
  protein_g   DECIMAL(6,2),
  carbs_g     DECIMAL(6,2),
  fat_g       DECIMAL(6,2),
  fiber_g     DECIMAL(6,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrition_user_date ON public.nutrition_logs(user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.food_database (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  brand       TEXT,
  calories    DECIMAL(7,2) NOT NULL,
  protein_g   DECIMAL(6,2),
  carbs_g     DECIMAL(6,2),
  fat_g       DECIMAL(6,2),
  fiber_g     DECIMAL(6,2),
  serving_g   DECIMAL(7,2) DEFAULT 100,
  barcode     TEXT,
  source      TEXT DEFAULT 'custom'
);

CREATE INDEX idx_food_name ON public.food_database(name);

-- ============================================================
-- PERSONA PLUGIN TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.persona_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name            TEXT NOT NULL DEFAULT 'Ziko',
  traits                TEXT[] DEFAULT '{}',
  habits                TEXT[] DEFAULT '{}',
  backstory             TEXT,
  system_prompt_addition TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HELPER: auto update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_programs_updated
  BEFORE UPDATE ON public.workout_programs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_conversations_updated
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_persona_updated
  BEFORE UPDATE ON public.persona_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_workouts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_sets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plugins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_database        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugins_registry     ENABLE ROW LEVEL SECURITY;

-- user_profiles: read/write own profile
CREATE POLICY "users_own_profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);

-- exercises: read global + own custom exercises
CREATE POLICY "read_exercises" ON public.exercises
  FOR SELECT USING (is_custom = FALSE OR user_id = auth.uid());
CREATE POLICY "manage_own_exercises" ON public.exercises
  FOR ALL USING (user_id = auth.uid());

-- workout_programs: own data only
CREATE POLICY "own_programs" ON public.workout_programs
  FOR ALL USING (user_id = auth.uid());

-- program_workouts: through parent program
CREATE POLICY "own_program_workouts" ON public.program_workouts
  FOR ALL USING (
    program_id IN (SELECT id FROM public.workout_programs WHERE user_id = auth.uid())
  );

-- program_exercises: through parent workout
CREATE POLICY "own_program_exercises" ON public.program_exercises
  FOR ALL USING (
    workout_id IN (
      SELECT pw.id FROM public.program_workouts pw
      JOIN public.workout_programs wp ON wp.id = pw.program_id
      WHERE wp.user_id = auth.uid()
    )
  );

-- workout_sessions
CREATE POLICY "own_sessions" ON public.workout_sessions
  FOR ALL USING (user_id = auth.uid());

-- session_sets: through parent session
CREATE POLICY "own_session_sets" ON public.session_sets
  FOR ALL USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

-- ai_conversations
CREATE POLICY "own_conversations" ON public.ai_conversations
  FOR ALL USING (user_id = auth.uid());

-- ai_messages: through parent conversation
CREATE POLICY "own_ai_messages" ON public.ai_messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid())
  );

-- user_plugins
CREATE POLICY "own_user_plugins" ON public.user_plugins
  FOR ALL USING (user_id = auth.uid());

-- plugins_registry: read-only for all authenticated users
CREATE POLICY "read_plugins_registry" ON public.plugins_registry
  FOR SELECT USING (auth.role() = 'authenticated');

-- nutrition_logs
CREATE POLICY "own_nutrition_logs" ON public.nutrition_logs
  FOR ALL USING (user_id = auth.uid());

-- food_database: read-only for all authenticated users
CREATE POLICY "read_food_database" ON public.food_database
  FOR SELECT USING (auth.role() = 'authenticated');

-- persona_settings
CREATE POLICY "own_persona_settings" ON public.persona_settings
  FOR ALL USING (user_id = auth.uid());
