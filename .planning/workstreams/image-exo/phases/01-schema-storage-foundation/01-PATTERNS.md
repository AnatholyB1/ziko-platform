# Phase 1: Schema & Storage Foundation - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 1 (single new migration file — CONTEXT.md D-08 confirms one file covers all three changes)
**Analogs found:** 3 / 3 (schema column, storage bucket, log table all have strong precedent)

## File Classification

Per D-08, this phase produces exactly **one new migration file**: `supabase/migrations/20260814_exercise_media_schema.sql` (dated convention). It contains three logical sections, each classified separately since they map to different analogs.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/migrations/20260814_exercise_media_schema.sql` §1 (ALTER exercises) | migration | CRUD (schema DDL) | `supabase/migrations/011_name_fr.sql` | exact |
| `supabase/migrations/20260814_exercise_media_schema.sql` §2 (exercise-media bucket) | migration | file-I/O (storage bucket + RLS) | `supabase/migrations/025_storage_buckets.sql` (`exports` bucket section) | exact |
| `supabase/migrations/20260814_exercise_media_schema.sql` §3 (exercise_import_log table) | migration | CRUD (log/status table) | `supabase/migrations/015_bug_reports_schema.sql` | role-match |

No app-facing code (controllers, components, services) is touched in this phase — confirmed by CONTEXT.md `## Existing Code Insights > Reusable Assets: None`.

## Pattern Assignments

### §1 — `ALTER TABLE public.exercises ADD COLUMN image/gif` (migration, CRUD/DDL)

**Analog:** `supabase/migrations/011_name_fr.sql` (full file, 4 lines)

**Full pattern to copy:**
```sql
-- Add name_fr column for French translations
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS name_fr TEXT;
ALTER TABLE public.food_database ADD COLUMN IF NOT EXISTS name_fr TEXT;
CREATE INDEX IF NOT EXISTS idx_food_name_fr ON public.food_database(name_fr);
```

**How to apply (per D-01, D-02):** Same `ADD COLUMN IF NOT EXISTS ... TEXT` idiom, two columns, nullable, no default, no index needed (not queried/filtered on):
```sql
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS gif TEXT;
```

**Base table reference** — `supabase/migrations/001_initial_schema.sql` lines 33-46 (current `public.exercises` definition, confirms `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` is the FK target for `exercise_import_log.exercise_id` in §3, and confirms no `image`/`gif`/media columns exist yet):
```sql
CREATE TABLE IF NOT EXISTS public.exercises (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('strength','cardio','flexibility','balance','sports')),
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  instructions  TEXT,
  video_url     TEXT,
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### §2 — `exercise-media` storage bucket (migration, file-I/O)

**Analog:** `supabase/migrations/025_storage_buckets.sql` lines 58-71 (`exports` bucket — "no INSERT policy, server-side only" pattern named explicitly in CONTEXT.md D-05)

```sql
-- ─────────────────────────────────────────────────────────
-- exports: private, owner-only SELECT (D-03, D-08)
-- No INSERT policy — server-side only (Phase 15)
-- ─────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "exports_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Secondary analog — public-read policy syntax:** `supabase/migrations/017_avatars_storage.sql` lines 1-29 (public bucket + explicit public SELECT policy + folder-per-owner convention referenced in D-03):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatar_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
```

**Tertiary analog — bucket options (file_size_limit / allowed_mime_types):** `supabase/migrations/049_ai_imports_bucket.sql` lines 1-15:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-imports',
  'ai-imports',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    ...
  ]
)
ON CONFLICT (id) DO NOTHING;
```

**How to apply (per D-05):** `public: true` (so no client-facing SELECT policy is required — public buckets serve reads directly, unlike `avatars` which explicitly adds `avatar_public_read` even though public — the `exports` bucket's "omit the write policy entirely" pattern is the one to follow for writes). Consider whether to set `file_size_limit`/`allowed_mime_types` restricting to image/gif MIME types (`image/png`, `image/gif`) using the `049` bucket-options syntax — CONTEXT.md doesn't explicitly decide this, so it's an open call for the planner/implementer, but the syntax precedent is here if chosen.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-media', 'exercise-media', true)
ON CONFLICT (id) DO NOTHING;

-- No INSERT/UPDATE/DELETE policy — writes only via service-role key (bypasses RLS),
-- mirrors 025_storage_buckets.sql's `exports` bucket pattern.
```

---

### §3 — `public.exercise_import_log` table (migration, CRUD / log-status table)

**Analog:** `supabase/migrations/015_bug_reports_schema.sql` (full file, 29 lines) — closest match for a status-enum-via-CHECK-constraint log table with nullable error/detail fields:
```sql
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('ui', 'crash', 'performance', 'feature', 'data', 'other')),
  screen_name TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  github_issue_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Secondary analog — sync/log table with FK + JSONB + index + RLS shape:** `supabase/migrations/014_wearables_schema.sql` lines 1-22 (`health_sync_log`):
```sql
CREATE TABLE IF NOT EXISTS public.health_sync_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type     TEXT NOT NULL,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ...
);

CREATE INDEX IF NOT EXISTS idx_health_sync_log_user_type
  ON public.health_sync_log(user_id, data_type, synced_at DESC);

ALTER TABLE public.health_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_sync_log_own" ON public.health_sync_log
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**How to apply (per D-06, D-07):**
- `status` as `TEXT NOT NULL CHECK (status IN ('matched','inserted','skipped','needs_review'))` — same idiom as `bug_reports.status`/`bug_reports.severity`.
- FK target is `public.exercises(id)` (not `auth.users`), nullable (`exercise_id UUID REFERENCES public.exercises(id) ON DELETE SET NULL` — nullable per D-07 "which row was touched, if any"; use `ON DELETE SET NULL` not `CASCADE` since the log should survive exercise deletion for audit purposes — no direct precedent for this exact FK-nullability choice, flagged for planner judgment).
- A dataset **source id** (D-07) — no exact precedent column name in the codebase; suggest `source_id TEXT NOT NULL` (dataset's original row identifier, used for dedupe/idempotency per IMPORT-04).
- `error_message TEXT` nullable — same nullable-detail-column idiom as `bug_reports.github_issue_url`/`screenshot_url`.
- `processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` — same idiom as `health_sync_log.synced_at` / `bug_reports.created_at`.
- **No RLS "own" policy needed** — this table has no `user_id`/owner column (it's a global import-run log, not user-scoped data), so it does not follow the `USING (auth.uid() = user_id)` RLS pattern seen in `health_sync_log`/`bug_reports`. Since writes come only from the service-role (Phase 3's merge script, not built yet), RLS can either be left disabled or enabled with no policies (service-role bypasses RLS regardless) — planner should pick based on whether any authenticated-client read access is ever needed (currently none is specified).

```sql
CREATE TABLE IF NOT EXISTS public.exercise_import_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id      TEXT NOT NULL,
  exercise_id    UUID REFERENCES public.exercises(id) ON DELETE SET NULL,
  status         TEXT NOT NULL CHECK (status IN ('matched', 'inserted', 'skipped', 'needs_review')),
  error_message  TEXT,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Shared Patterns

### Migration file header/comment style
**Source:** `supabase/migrations/025_storage_buckets.sql` line 1-3 (box-comment header) and `supabase/migrations/20260527_coach_exercise_id_program_exercises.sql` line 1-2 (short phase-reference comment)
**Apply to:** The new migration file — recent dated migrations favor a short 1-2 line comment (`-- Phase N: <what and why>`) over the older box-drawing header style. Since this is a cross-workstream infra migration (not tied to a numbered "Phase N" in the main roadmap), a plain descriptive header naming the workstream/phase is appropriate:
```sql
-- image-exo Phase 1: exercise media columns, exercise-media storage bucket, exercise_import_log table
```

### `ADD COLUMN IF NOT EXISTS` idempotency idiom
**Source:** `supabase/migrations/011_name_fr.sql`, `supabase/migrations/20260527_coach_exercise_id_program_exercises.sql`
**Apply to:** §1 (exercises columns)
Always use `IF NOT EXISTS` on `ADD COLUMN` and `CREATE INDEX`/`CREATE TABLE` — every precedent migration in this codebase does this for safe re-runs.

### `INSERT INTO storage.buckets ... ON CONFLICT (id) DO NOTHING`
**Source:** `supabase/migrations/025_storage_buckets.sql`, `017_avatars_storage.sql`, `049_ai_imports_bucket.sql` (all three)
**Apply to:** §2 (exercise-media bucket)
Universal idiom across every storage-bucket migration in the codebase — always paired with `ON CONFLICT (id) DO NOTHING` for idempotent re-runs.

### Storage RLS: folder-per-owner via `storage.foldername(name)[1]`
**Source:** `supabase/migrations/025_storage_buckets.sql`, `017_avatars_storage.sql`
**Apply to:** N/A for writes in this phase (no write policy per D-05), but relevant if any future authenticated-write policy is ever added — the codebase convention for folder-scoped storage policies is `(storage.foldername(name))[1] = auth.uid()::text`. This phase's folder key is `exercise_id`, not `auth.uid()`, so this exact idiom does not apply to `exercise-media` (no write policy exists here at all).

## No Analog Found

None — all three sections of this phase's single migration have direct or close precedent files as detailed above.

## Metadata

**Analog search scope:** `supabase/migrations/` (all 70 files, name-matched via Glob against CONTEXT.md's named canonical refs)
**Files scanned:** 001_initial_schema.sql, 011_name_fr.sql, 014_wearables_schema.sql, 015_bug_reports_schema.sql, 017_avatars_storage.sql, 025_storage_buckets.sql, 049_ai_imports_bucket.sql, 20260527_coach_exercise_id_program_exercises.sql, 20260529_fix_trigger_n_sessions.sql
**Pattern extraction date:** 2026-08-14
