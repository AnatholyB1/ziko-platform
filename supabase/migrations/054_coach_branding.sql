-- ============================================================
-- 054 — Coach Branding (v1.12 DA Coach, Phase 1)
-- Migration scope:
--   1. CREATE TABLE coach_branding — primary_color, logo_url, tone
--   2. updated_at trigger (reuses handle_updated_at from migration 001)
--   3. RLS — coach owns their row; linked athlete can SELECT
--   4. INSERT storage bucket coach-logos (public)
--   5. Storage RLS — coach writes under their own UUID prefix; public read
-- ============================================================

-- Fail fast rather than hold ACCESS EXCLUSIVE locks during deploy.
SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. coach_branding table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_branding (
  coach_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_color TEXT NOT NULL
                  CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url      TEXT NULL,
  tone          TEXT NULL
                  CHECK (tone IN ('Motivant', 'Analytique', 'Bienveillant', 'Exigeant')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────
-- 2. updated_at trigger — reuse handle_updated_at() from migration 001.
-- ───────────────────────────────────────────────────────────
CREATE TRIGGER trg_coach_branding_updated
  BEFORE UPDATE ON public.coach_branding
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ───────────────────────────────────────────────────────────
-- 3. RLS
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.coach_branding ENABLE ROW LEVEL SECURITY;

-- Coach owns their own row (all operations).
CREATE POLICY "coach_branding_own" ON public.coach_branding
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Linked athlete can read the coach's branding row.
-- is_coach_of(coach UUID, client UUID) — coach_id FIRST, auth.uid() second.
CREATE POLICY "coach_branding_athlete_read" ON public.coach_branding
  FOR SELECT
  USING (public.is_coach_of(coach_id, auth.uid()));

-- ───────────────────────────────────────────────────────────
-- 4. Public storage bucket: coach-logos
-- ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('coach-logos', 'coach-logos', true)
  ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 5. Storage RLS for coach-logos bucket
-- ───────────────────────────────────────────────────────────

-- Coach can write/delete their own logos (path prefix = their UUID).
CREATE POLICY "coach_logos_coach_write" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'coach-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read — bucket is public but explicit policy for clarity.
CREATE POLICY "coach_logos_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'coach-logos');
