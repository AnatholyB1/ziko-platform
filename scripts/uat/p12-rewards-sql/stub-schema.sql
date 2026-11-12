-- Schema MINIMAL (colonnes copiees de supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql)
-- pour rejouer les migrations 20261201 1201/1202 sur un Postgres LOCAL jetable. Jamais sur le projet portfolio.
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

CREATE TABLE public.ziko_badge_definitions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL,
  description text NOT NULL, icon text NOT NULL, condition_type text NOT NULL, condition_value integer NOT NULL, tier integer DEFAULT 1,
  CONSTRAINT ziko_badge_definitions_condition_type_check CHECK (condition_type = ANY (ARRAY['sessions','streak','prs','profile_complete','friends']))
);
CREATE TABLE public.ziko_user_badges (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug text REFERENCES public.ziko_badge_definitions(slug), earned_at timestamptz DEFAULT now(), UNIQUE (user_id, badge_slug)
);
CREATE TABLE public.ziko_user_gamification (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, xp integer DEFAULT 0 NOT NULL, level integer DEFAULT 1 NOT NULL,
  coins integer DEFAULT 0 NOT NULL, current_streak integer DEFAULT 0 NOT NULL, longest_streak integer DEFAULT 0 NOT NULL, last_activity_date date,
  equipped_title text DEFAULT 'Débutant', equipped_badge text, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL,
  equipped_banner_name text, equipped_theme text
);
CREATE TABLE public.ziko_coin_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL, source text NOT NULL, source_id uuid, description text, created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT ziko_coin_transactions_source_check CHECK (source = ANY (ARRAY['workout','habit','streak_bonus','level_up','purchase','refund']))
);
CREATE TABLE public.ziko_workout_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL, name text,
  started_at timestamptz DEFAULT now() NOT NULL, ended_at timestamptz
);
CREATE TABLE public.ziko_session_sets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, session_id uuid NOT NULL REFERENCES public.ziko_workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL, set_number integer NOT NULL, reps integer, weight_kg numeric(6,2), completed boolean DEFAULT false NOT NULL
);
CREATE TABLE public.ziko_friendships (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, requester_id uuid NOT NULL, addressee_id uuid NOT NULL,
  status text DEFAULT 'pending' NOT NULL
);
CREATE TABLE public.ziko_user_profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, avatar_url text, bio text, goal text);
CREATE TABLE public.ziko_shop_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, name text NOT NULL, description text, category text NOT NULL,
  price integer NOT NULL, icon text, level_required integer DEFAULT 1 NOT NULL, is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT ziko_shop_items_category_check CHECK (category = ANY (ARRAY['title','badge','theme','banner']))
);
CREATE TABLE public.ziko_user_inventory (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.ziko_shop_items(id) ON DELETE CASCADE, is_equipped boolean DEFAULT false NOT NULL,
  purchased_at timestamptz DEFAULT now() NOT NULL, UNIQUE (user_id, item_id)
);

-- Copies fideles des fonctions existantes dont dependent les migrations testees.
CREATE OR REPLACE FUNCTION public.ziko_ensure_gamification_profile(p_user_id uuid)
 RETURNS ziko_user_gamification LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_profile public.ziko_user_gamification;
BEGIN
  SELECT * INTO v_profile FROM public.ziko_user_gamification WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_profile; END IF;
  INSERT INTO public.ziko_user_gamification (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_profile FROM public.ziko_user_gamification WHERE user_id = p_user_id;
  RETURN v_profile;
END; $function$;

CREATE OR REPLACE FUNCTION public.ziko_award_coins(p_user_id uuid, p_amount integer, p_source text, p_source_id uuid, p_description text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.ziko_ensure_gamification_profile(p_user_id);
  INSERT INTO public.ziko_coin_transactions (user_id, amount, source, source_id, description)
  VALUES (p_user_id, p_amount, p_source, p_source_id, p_description);
  UPDATE public.ziko_user_gamification SET coins = coins + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
END; $function$;

-- Ancienne fonction (void) : prouve que le DROP/CREATE de la migration remplace bien le type de retour.
CREATE OR REPLACE FUNCTION public.ziko_check_and_award_badges(p_user_id uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;

-- 11 definitions reelles (profile_settings_gap.sql)
INSERT INTO public.ziko_badge_definitions (slug, name, description, icon, condition_type, condition_value, tier) VALUES
  ('first_session','Première séance','Complète ta 1ère séance','🏋️','sessions',1,1),
  ('ten_sessions','10 séances','Complète 10 séances','💪','sessions',10,1),
  ('fifty_sessions','50 séances','Complète 50 séances','🔥','sessions',50,2),
  ('hundred_sessions','100 séances','Complète 100 séances','🏆','sessions',100,3),
  ('streak_7','Streak 7 jours','Garde ta streak 7 jours','⚡','streak',7,1),
  ('streak_30','Streak 30 jours','Garde ta streak 30 jours','🌟','streak',30,2),
  ('streak_100','Streak 100 jours','Garde ta streak 100 jours','👑','streak',100,3),
  ('first_pr','Premier PR','Bats ton 1er record perso','🎯','prs',1,1),
  ('ten_prs','10 PRs battus','Bats 10 records perso','💎','prs',10,2),
  ('profile_complete','Profil complet','Complète ton profil','✅','profile_complete',1,1),
  ('first_friend','Premier ami','Ajoute ton 1er ami','🤝','friends',1,1);
