-- ============================================================
-- 034 — Coach Role + Coach Profiles (v1.5 keystone, Phase 22)
-- Migration scope (per D-15):
--   1. ADD COLUMN user_profiles.role with default 'client'
--   2. CREATE TABLE coach_profiles + RLS + updated_at trigger
-- See .planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md
-- ============================================================

-- Fail fast rather than hold ACCESS EXCLUSIVE locks during deploy.
SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. user_profiles.role (D-14 — PG11+ metadata-only fast path)
--    DEFAULT 'client' applies to existing rows without rewrite.
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL
    DEFAULT 'client'
    CHECK (role IN ('client', 'coach', 'both'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON public.user_profiles(role)
  WHERE role <> 'client';
-- Partial index — only the small set of non-client rows is indexed.

-- ───────────────────────────────────────────────────────────
-- 2. coach_profiles (D-05 — full Phase 24 column set; no later ALTERs)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  specialties   TEXT[] NOT NULL DEFAULT '{}',
  website       TEXT,
  photo_url     TEXT,
  kyc_status    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  kyc_docs      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse existing handle_updated_at() from migration 001.
CREATE TRIGGER trg_coach_profiles_updated
  BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_profiles_own" ON public.coach_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
