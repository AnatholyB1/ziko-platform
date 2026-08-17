-- image-exo Phase 3: instructions i18n columns (D-03) + backup snapshot table (D-09/D-10)

-- ─────────────────────────────────────────────────────────
-- Section 1: instructions i18n columns (D-03)
-- Mirrors the existing name/name_fr split (031_exercises_name_fr.sql).
-- instruction_steps stores the dataset's {en: string[], fr: string[]} shape verbatim.
-- Must come BEFORE Section 2 — the backup table's LIKE copy below is evaluated
-- at CREATE time and would otherwise miss these columns.
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS instructions_fr TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS instruction_steps JSONB;

-- ─────────────────────────────────────────────────────────
-- Section 2: exercises_merge_backup (D-09, D-10)
-- Full-row snapshot, no restore tooling this phase. INCLUDING DEFAULTS only
-- (NOT ALL/CONSTRAINTS/INDEXES) — the backup table must NOT inherit exercises'
-- PRIMARY KEY on id, because the same exercise id may legitimately be
-- snapshotted more than once across multiple merge runs.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercises_merge_backup (
  LIKE public.exercises INCLUDING DEFAULTS
);

ALTER TABLE public.exercises_merge_backup
  ADD COLUMN IF NOT EXISTS backup_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ADD COLUMN IF NOT EXISTS backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_exercises_merge_backup_id ON public.exercises_merge_backup(id);

-- No policies: this is a service-role write-only snapshot table, mirroring
-- exercise_import_log in 20260814_exercise_media_schema.sql. RLS enabled with
-- zero policies = deny-by-default for anon/authenticated; the service-role
-- client used by merge.ts bypasses RLS.
ALTER TABLE public.exercises_merge_backup ENABLE ROW LEVEL SECURITY;
