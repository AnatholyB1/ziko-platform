-- Schema MINIMAL (colonnes utiles) pour rejouer 202612012701/2702/2703 sur un Postgres LOCAL jetable.
-- Jamais applique au projet portfolio ni a la branche de test.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
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
ALTER ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA auth, public, extensions TO anon, authenticated, service_role;
-- Comme Supabase : les nouvelles fonctions/tables du schema public sont ouvertes aux 3 roles par defaut.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

CREATE TABLE public.ziko_user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text, handle text, avatar_url text, goal text,
  is_public boolean DEFAULT true, role text NOT NULL DEFAULT 'client' CHECK (role IN ('client','coach','both')),
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium')),
  subscription_tier text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','premium','coach')),
  is_lifetime_premium boolean NOT NULL DEFAULT false, bio text
);
CREATE TABLE public.ziko_friendships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, requester_id uuid NOT NULL, addressee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ziko_coach_client_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, coach_id uuid NOT NULL, client_id uuid NOT NULL,
  revoked_at timestamptz, expires_at timestamptz
);
CREATE TABLE public.ziko_user_gamification (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, xp integer DEFAULT 0 NOT NULL, level integer DEFAULT 1 NOT NULL,
  coins integer DEFAULT 0 NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.ziko_level_definitions (level integer PRIMARY KEY, xp_required integer NOT NULL, title text NOT NULL, reward_coins integer NOT NULL DEFAULT 0);
INSERT INTO public.ziko_level_definitions VALUES (1,0,'Debutant',0),(2,100,'Initie',25),(3,250,'Regulier',50),(4,500,'Sportif',75);
CREATE TABLE public.ziko_coin_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL, source text NOT NULL, source_id uuid, description text, created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.ziko_xp_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL, source text NOT NULL, source_id uuid, description text, created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.ziko_shop_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, price integer NOT NULL, level_required integer DEFAULT 1 NOT NULL
);
CREATE TABLE public.ziko_user_inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.ziko_shop_items(id) ON DELETE CASCADE, is_equipped boolean DEFAULT false NOT NULL,
  purchased_at timestamptz DEFAULT now() NOT NULL, UNIQUE (user_id, item_id)
);
CREATE TABLE public.ziko_community_user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, updated_at timestamptz DEFAULT now(),
  messages_sent int DEFAULT 0, gifs_sent int DEFAULT 0, reactions_sent int DEFAULT 0, challenges_won int DEFAULT 0, challenges_lost int DEFAULT 0,
  challenges_tied int DEFAULT 0, xp_gifted int DEFAULT 0, xp_received int DEFAULT 0, coins_gifted int DEFAULT 0, coins_received int DEFAULT 0,
  programs_shared int DEFAULT 0, group_workouts_done int DEFAULT 0, encouragements_sent int DEFAULT 0, encouragements_received int DEFAULT 0,
  invites_sent int DEFAULT 0, invites_accepted int DEFAULT 0
);
CREATE TABLE public.ziko_coin_gifts (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, sender_id uuid NOT NULL, receiver_id uuid NOT NULL, amount int NOT NULL, message text);
CREATE TABLE public.ziko_xp_gifts (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, sender_id uuid NOT NULL, receiver_id uuid NOT NULL, amount int NOT NULL, message text);
CREATE TABLE public.ziko_user_ai_credits (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, balance integer NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now());
CREATE TABLE public.ziko_ai_credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, type text NOT NULL, amount integer NOT NULL, source text NOT NULL,
  idempotency_key text, metadata jsonb, created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.ziko_ai_credit_transactions ADD CONSTRAINT ziko_ai_credit_tx_unique UNIQUE (user_id, source, idempotency_key);
CREATE UNIQUE INDEX idx_credit_tx_idempotency ON public.ziko_ai_credit_transactions (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE public.ziko_coach_forms (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, coach_id uuid NOT NULL, status text NOT NULL DEFAULT 'active', trigger_config jsonb);
CREATE TABLE public.ziko_form_instances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, form_id uuid NOT NULL, athlete_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending',
  CONSTRAINT form_instances_no_dup_pending UNIQUE (form_id, athlete_id, status)
);
CREATE TABLE public.ziko_ai_cost_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, model text, source text, input_tokens int, output_tokens int, created_at timestamptz DEFAULT now()
);
-- Tables lues par ziko_get_public_profile et les defis collectifs
CREATE TABLE public.ziko_habit_logs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, habit_id uuid NOT NULL DEFAULT gen_random_uuid(), date date NOT NULL, value numeric NOT NULL DEFAULT 1);
CREATE TABLE public.ziko_hydration_logs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, amount_ml integer NOT NULL, date date NOT NULL);
CREATE TABLE public.ziko_badge_definitions (slug text PRIMARY KEY, name text NOT NULL, icon text, tier integer);
CREATE TABLE public.ziko_user_badges (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, badge_slug text NOT NULL, earned_at timestamptz DEFAULT now());
CREATE TABLE public.ziko_exercises (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text, name_fr text);
CREATE TABLE public.ziko_workout_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL, name text, started_at timestamptz DEFAULT now() NOT NULL, ended_at timestamptz,
  total_sets int, total_exercises int
);
CREATE TABLE public.ziko_session_sets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, session_id uuid NOT NULL REFERENCES public.ziko_workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid, weight_kg numeric, completed boolean DEFAULT false, completed_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.ziko_challenges (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text, status text, end_date date);
CREATE TABLE public.ziko_challenge_participants (challenge_id uuid NOT NULL, user_id uuid NOT NULL);
