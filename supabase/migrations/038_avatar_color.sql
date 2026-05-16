-- ═══════════════════════════════════════════════════════════
-- 038 — Add avatar_color to user_profiles
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_color TEXT;
