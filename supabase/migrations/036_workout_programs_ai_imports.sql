-- ============================================================
-- 036 — workout_programs Extension + ai_imports (Phase 22, v1.5)
-- Adds Phase 27 coach-program semantics + Phase 28 AI-import staging.
-- Per D-12: all extension FKs use ON DELETE SET NULL (Open Decision #4
--   — preserve coach's authored content on athlete deletion pending GDPR review).
-- Per D-11: weeks_data JSONB ships WITHOUT a DB CHECK — Zod validation
--   lives in packages/coach-sdk (Phase 23).
-- Per D-RLS-02: lock_timeout fail-fast guard for concurrent deploys.
-- ============================================================

SET LOCAL lock_timeout = '5s';

-- ───────────────────────────────────────────────────────────
-- 1. workout_programs extension columns (D-12)
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.workout_programs
  ADD COLUMN IF NOT EXISTS created_by_coach_id UUID NULL
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID NULL
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_source_id UUID NULL
    REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weeks_data JSONB NULL;
-- NOTE: weeks_data has NO CHECK constraint — validation is Zod-only
-- via packages/coach-sdk (Phase 23, D-11). This is a deliberate
-- trade-off favoring schema agility over DB-enforced integrity.
-- Defense: ARCH-03 (no service-role under coach/) prevents
-- direct SQL writes; all writes go through typed SDK clients.

-- Phase-27 lookup indexes (cheap to add now; avoids ACCESS EXCLUSIVE later)
CREATE INDEX IF NOT EXISTS idx_workout_programs_created_by_coach
  ON public.workout_programs(created_by_coach_id)
  WHERE created_by_coach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_programs_assigned_to
  ON public.workout_programs(assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_programs_template
  ON public.workout_programs(is_template)
  WHERE is_template = TRUE;

-- ───────────────────────────────────────────────────────────
-- 2. ai_imports (D-09 — full Phase 28 schema, 16 columns)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_imports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url              TEXT NOT NULL,
  original_filename     TEXT NOT NULL,
  mime_type             TEXT NOT NULL
                          CHECK (mime_type IN (
                            'application/pdf',
                            'image/png',
                            'image/jpeg',
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'application/vnd.ms-excel',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          )),
  size_bytes            BIGINT NOT NULL
                          CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  page_count            INTEGER NULL,
  mode                  TEXT NOT NULL
                          CHECK (mode IN ('athlete', 'coach_template')),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'uploaded', 'parsing', 'ready', 'failed', 'committed')),
  parsed_data           JSONB NULL,
  confidence_scores     JSONB NULL,
  error_message         TEXT NULL,
  credit_transaction_id UUID NULL,  -- FK wired in Phase 28 to ai_credit_transactions(id)
  committed_program_id  UUID NULL REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  re_upload_source_id   UUID NULL REFERENCES public.ai_imports(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_at             TIMESTAMPTZ NULL,
  committed_at          TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_imports_user_created
  ON public.ai_imports(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_imports_status
  ON public.ai_imports(status)
  WHERE status IN ('pending', 'uploaded', 'parsing');

CREATE TRIGGER trg_ai_imports_updated
  BEFORE UPDATE ON public.ai_imports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_imports ENABLE ROW LEVEL SECURITY;

-- D-10: owner-only — coaches do NOT read athlete imports.
-- A coach who imports in coach_template mode owns those rows themselves.
CREATE POLICY "ai_imports_own" ON public.ai_imports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- End of migration 036.
