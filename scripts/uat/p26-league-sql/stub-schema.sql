-- Schema MINIMAL (colonnes copiees de supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql et de
-- 20260831120000_athlete_state.sql) pour rejouer les migrations P26 sur un Postgres LOCAL jetable. Jamais sur portfolio.
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;

CREATE TABLE public.ziko_user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text, age integer, goal text, role text DEFAULT 'client' NOT NULL
);
CREATE TABLE public.ziko_athlete_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'onboarding' NOT NULL, readiness text DEFAULT 'fragile' NOT NULL, level integer DEFAULT 1 NOT NULL,
  points integer DEFAULT 0 NOT NULL, tier integer DEFAULT 1 NOT NULL, onboarding_profile jsonb DEFAULT '{}' NOT NULL,
  current_focus_detail jsonb DEFAULT '{}' NOT NULL
);
CREATE TABLE public.ziko_athlete_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, summary text);
CREATE TABLE public.ziko_user_gamification (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, xp integer DEFAULT 0 NOT NULL, level integer DEFAULT 1 NOT NULL,
  coins integer DEFAULT 0 NOT NULL, current_streak integer DEFAULT 0 NOT NULL, longest_streak integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.ziko_workout_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, name text,
  started_at timestamptz DEFAULT now() NOT NULL, ended_at timestamptz
);
CREATE TABLE public.ziko_session_sets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, session_id uuid NOT NULL REFERENCES public.ziko_workout_sessions(id) ON DELETE CASCADE,
  set_number integer NOT NULL, completed boolean DEFAULT false NOT NULL
);
CREATE TABLE public.ziko_habits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, is_active boolean DEFAULT true NOT NULL
);
CREATE TABLE public.ziko_habit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, habit_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE NOT NULL, value integer DEFAULT 1 NOT NULL
);
CREATE TABLE public.ziko_hydration_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml integer NOT NULL, date date DEFAULT CURRENT_DATE NOT NULL
);
CREATE TABLE public.ziko_coach_client_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, expires_at timestamptz, revoked_at timestamptz
);
