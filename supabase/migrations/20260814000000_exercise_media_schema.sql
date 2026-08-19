-- image-exo Phase 1: exercise media columns, exercise-media storage bucket, exercise_import_log table

-- ─────────────────────────────────────────────────────────
-- Section 1: exercises media columns (D-01, D-02)
-- Relative storage paths (e.g. {exercise_id}/thumb.png), not full URLs
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS gif TEXT;

-- ─────────────────────────────────────────────────────────
-- Section 2: exercise-media storage bucket (D-03, D-04, D-05)
-- Public read (bucket public:true serves reads directly, no SELECT policy needed). No INSERT/UPDATE/DELETE policy — writes only via service-role key, which bypasses RLS entirely (mirrors 025_storage_buckets.sql's exports bucket).
-- ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exercise-media', 'exercise-media', true, 2097152, ARRAY['image/png', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Section 3: exercise_import_log table (D-06, D-07)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercise_import_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id      TEXT NOT NULL,
  exercise_id    UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  status         TEXT NOT NULL CHECK (status IN ('matched', 'inserted', 'skipped', 'needs_review')),
  error_message  TEXT,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_import_log_source_id ON public.exercise_import_log(source_id);

-- No policies: this is a global import-run log with no owner column. RLS enabled with zero policies = deny-by-default for anon/authenticated; service-role (Phase 3 merge script) bypasses RLS.
ALTER TABLE public.exercise_import_log ENABLE ROW LEVEL SECURITY;
