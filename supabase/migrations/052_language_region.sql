-- 052 — Add language and region to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr'
    CHECK (language IN ('fr', 'en')),
  ADD COLUMN IF NOT EXISTS region  TEXT DEFAULT 'FR';
