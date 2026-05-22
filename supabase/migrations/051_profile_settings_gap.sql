SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 051: profile_settings_gap
-- Adds missing columns to user_profiles, creates badge tables,
-- seeds 11 badge_definitions, creates check_and_award_badges RPC,
-- and safeguards storage buckets.
-- Phase 35 gap closure — resolves smoke test schema failures.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- SECTION 1 — ADD COLUMNS to user_profiles
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium', 'coach'));


-- ─────────────────────────────────────────────────────────────
-- SECTION 2 — CREATE TABLE badge_definitions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT    UNIQUE NOT NULL,
  name            TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  icon            TEXT    NOT NULL,
  condition_type  TEXT    NOT NULL
    CHECK (condition_type IN ('sessions', 'streak', 'prs', 'profile_complete', 'friends')),
  condition_value INTEGER NOT NULL,
  tier            INTEGER DEFAULT 1
);


-- ─────────────────────────────────────────────────────────────
-- SECTION 3 — SEED 11 badge_definitions
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.badge_definitions (slug, name, description, icon, condition_type, condition_value, tier) VALUES
  ('first_session',    'Première séance',   'Complète ta 1ère séance',      '🏋️', 'sessions',         1,   1),
  ('ten_sessions',     '10 séances',        'Complète 10 séances',          '💪', 'sessions',         10,  1),
  ('fifty_sessions',   '50 séances',        'Complète 50 séances',          '🔥', 'sessions',         50,  2),
  ('hundred_sessions', '100 séances',       'Complète 100 séances',         '🏆', 'sessions',         100, 3),
  ('streak_7',         'Streak 7 jours',    'Garde ta streak 7 jours',      '⚡', 'streak',           7,   1),
  ('streak_30',        'Streak 30 jours',   'Garde ta streak 30 jours',     '🌟', 'streak',           30,  2),
  ('streak_100',       'Streak 100 jours',  'Garde ta streak 100 jours',    '👑', 'streak',           100, 3),
  ('first_pr',         'Premier PR',        'Bats ton 1er record perso',    '🎯', 'prs',              1,   1),
  ('ten_prs',          '10 PRs battus',     'Bats 10 records perso',        '💎', 'prs',              10,  2),
  ('profile_complete', 'Profil complet',    'Complète ton profil',          '✅', 'profile_complete', 1,   1),
  ('first_friend',     'Premier ami',       'Ajoute ton 1er ami',           '🤝', 'friends',          1,   1)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- SECTION 4 — CREATE TABLE user_badges + RLS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT        REFERENCES public.badge_definitions(slug),
  earned_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_slug)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_badges'
      AND policyname = 'user_badges_own'
  ) THEN
    CREATE POLICY "user_badges_own" ON public.user_badges
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- SECTION 5 — check_and_award_badges RPC
-- Evaluates badge conditions for a user and inserts earned badges.
-- SECURITY DEFINER: runs with owner privileges; scoped to p_user_id.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sessions      INTEGER := 0;
  v_streak        INTEGER := 0;
  v_prs           INTEGER := 0;
  v_friends       INTEGER := 0;
  v_profile_done  INTEGER := 0;
  v_streak_date   DATE;
  v_consecutive   INTEGER;
  rec             RECORD;
BEGIN
  -- 1. Count completed workout sessions
  SELECT COUNT(*) INTO v_sessions
  FROM public.workout_sessions
  WHERE user_id = p_user_id;

  -- 2. Count personal records (is_pr column may not exist on all deployments)
  BEGIN
    SELECT COUNT(*) INTO v_prs
    FROM public.session_sets
    WHERE user_id = p_user_id
      AND is_pr = true;
  EXCEPTION WHEN undefined_column THEN
    v_prs := 0;
  END;

  -- 3. Calculate current streak from habit_logs (consecutive days up to today)
  v_streak := 0;
  v_streak_date := CURRENT_DATE;
  LOOP
    SELECT COUNT(*) INTO v_consecutive
    FROM public.habit_logs hl
    JOIN public.habits h ON h.id = hl.habit_id
    WHERE h.user_id = p_user_id
      AND hl.completed_at::date = v_streak_date;

    EXIT WHEN v_consecutive = 0;
    v_streak := v_streak + 1;
    v_streak_date := v_streak_date - 1;
  END LOOP;

  -- 4. Check profile completeness (avatar + bio + goal all non-null)
  SELECT COUNT(*) INTO v_profile_done
  FROM public.user_profiles
  WHERE id          = p_user_id
    AND avatar_url  IS NOT NULL
    AND bio         IS NOT NULL
    AND goal        IS NOT NULL;

  -- 5. Count friends (friendships table from community plugin)
  BEGIN
    SELECT COUNT(*) INTO v_friends
    FROM public.friendships
    WHERE user_id = p_user_id
      AND status  = 'accepted';
  EXCEPTION WHEN undefined_table THEN
    v_friends := 0;
  END;

  -- 6. Award all earned badges not yet held by this user
  FOR rec IN
    SELECT bd.slug, bd.condition_type, bd.condition_value
    FROM   public.badge_definitions bd
    WHERE  NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id    = p_user_id
        AND ub.badge_slug = bd.slug
    )
  LOOP
    CASE rec.condition_type
      WHEN 'sessions' THEN
        IF v_sessions >= rec.condition_value THEN
          INSERT INTO public.user_badges (user_id, badge_slug)
          VALUES (p_user_id, rec.slug)
          ON CONFLICT DO NOTHING;
        END IF;

      WHEN 'streak' THEN
        IF v_streak >= rec.condition_value THEN
          INSERT INTO public.user_badges (user_id, badge_slug)
          VALUES (p_user_id, rec.slug)
          ON CONFLICT DO NOTHING;
        END IF;

      WHEN 'prs' THEN
        IF v_prs >= rec.condition_value THEN
          INSERT INTO public.user_badges (user_id, badge_slug)
          VALUES (p_user_id, rec.slug)
          ON CONFLICT DO NOTHING;
        END IF;

      WHEN 'profile_complete' THEN
        IF v_profile_done >= rec.condition_value THEN
          INSERT INTO public.user_badges (user_id, badge_slug)
          VALUES (p_user_id, rec.slug)
          ON CONFLICT DO NOTHING;
        END IF;

      WHEN 'friends' THEN
        IF v_friends >= rec.condition_value THEN
          INSERT INTO public.user_badges (user_id, badge_slug)
          VALUES (p_user_id, rec.slug)
          ON CONFLICT DO NOTHING;
        END IF;

      ELSE NULL;
    END CASE;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- SECTION 6 — Storage bucket safeguard
-- Ensures avatars and profile-photos buckets exist in production.
-- Migrations 017 and 025 created these but may not have been
-- applied on some environments.
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars',        'avatars',        true),
  ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;
