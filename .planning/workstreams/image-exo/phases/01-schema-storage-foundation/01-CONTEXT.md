# Phase 1: Schema & Storage Foundation - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The database and storage infrastructure the import pipeline writes to must exist and be locked down before any data moves. This phase adds:
1. `image` (thumbnail) and `gif` (animation) columns on `public.exercises`
2. A public `exercise-media` Supabase Storage bucket — readable by anyone, writable only via service-role key
3. An `exercise_import_log` table ready to record per-row import status

No data import, matching, or merging happens in this phase — that's Phases 2–3. No mobile rendering — that's Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Exercise media columns
- **D-01:** Add BOTH `image` (thumbnail) and `gif` (animation) as nullable `TEXT` columns on `public.exercises` in this phase's migration — not just `image` as ROADMAP's literal wording suggests. Rationale: Phase 4 (MOBILE-01) needs to render both a real GIF and a thumbnail; adding both columns now avoids a second schema migration mid-pipeline, and lets Phase 3's merge script populate both in a single pass.
- **D-02:** Both columns store a **relative storage path** (e.g. `{exercise_id}/thumb.png`), not a full public URL. The mobile app builds the public URL client-side via the Supabase Storage client. This decouples the DB from the project's storage domain — safer if the Supabase project URL ever changes.

### Storage path convention (exercise-media bucket)
- **D-03:** Files are organized **folder-per-`exercise_id`** — e.g. `{exercise_id}/thumb.png` + `{exercise_id}/animation.gif`. Stable across exercise name/rename changes; matches the existing `avatars`/`profile-photos` bucket convention (folder-per-owner) already in the codebase (`supabase/migrations/017_avatars_storage.sql`, `025_storage_buckets.sql`).
- **D-04:** **Fixed filenames** within each folder — always `thumb.png` + `animation.gif` regardless of the dataset's original filenames. Simple, predictable, and safe to overwrite on re-import (supports IMPORT-04 idempotency).
- **D-05 (bucket policy):** `exercise-media` bucket is created with `public: true` (readable by anyone, no client-facing SELECT policy needed since public buckets serve reads directly). **No INSERT/UPDATE/DELETE policy is added** — writes only via the service-role key, which bypasses RLS entirely. This mirrors the precedent in `025_storage_buckets.sql`'s `exports` bucket ("No INSERT policy — server-side only").

### exercise_import_log schema
- **D-06:** Status enum: `matched` / `inserted` / `skipped` / `needs_review`.
  - `matched` = existing exercise UPDATEd in place (preserves UUID)
  - `inserted` = new exercise created
  - `skipped` = already processed in a prior run (supports IMPORT-04 resumability/idempotency)
  - `needs_review` = legacy exercise with real history (`program_exercises`/`session_sets`) but no confident match — flagged, never auto-merged, never deleted (per IMPORT-05)
- **D-07:** Row fields beyond status: a dataset **source id** (to detect re-runs / dedupe), a nullable **`exercise_id`** (which row in `public.exercises` was touched, if any), a nullable **`error_message`** (for failed/problem rows), and a **`processed_at`** timestamp. This is enough for both Phase 3's resumable merge and a human-readable review, without needing to reconstruct state from external report files.

### Migration naming convention
- **D-08:** Use the **dated** naming convention (e.g. `20260814_exercise_media_schema.sql`), not sequential numbering. Matches the project's most recent convention (the last 5 migrations in `supabase/migrations/` are all dated `2026MMDD_*.sql`) and avoids numbering collisions across parallel workstreams (`main`, `image-exo`, etc.).

### Claude's Discretion
None — all four discussed areas reached explicit decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/image-exo/REQUIREMENTS.md` — MEDIA-01, MEDIA-02 (this phase's mapped requirements); also read MEDIA-03/04 and MOBILE-01 for how the schema is consumed downstream
- `.planning/workstreams/image-exo/ROADMAP.md` §"Phase 1: Schema & Storage Foundation" — success criteria this phase must satisfy

### Storage bucket precedent (existing patterns to follow)
- `supabase/migrations/025_storage_buckets.sql` — `exports` bucket pattern: no INSERT policy, server-side/service-role writes only (directly analogous to `exercise-media`)
- `supabase/migrations/017_avatars_storage.sql` — public bucket + explicit public-read policy pattern, folder-per-owner convention
- `supabase/migrations/049_ai_imports_bucket.sql` — recent bucket migration showing file_size_limit / allowed_mime_types usage

### Schema precedent
- `supabase/migrations/001_initial_schema.sql` — current `public.exercises` table definition (no `image`/`gif`/media columns yet)
- `supabase/migrations/011_name_fr.sql` — example of a small, additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration on `public.exercises`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None directly reusable for this phase — it's pure DB/storage infrastructure with no app-facing code.

### Established Patterns
- Storage buckets in this codebase always pair a `storage.buckets` INSERT with explicit `storage.objects` RLS policies (see canonical refs above). Public-read buckets still get an explicit public SELECT policy in most precedents, but the `exports` bucket in `025_storage_buckets.sql` shows the "no write policy = service-role-only writes" pattern this phase should follow for `exercise-media`.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is the established idiom for additive schema changes on `public.exercises` (see `011_name_fr.sql`).
- Recent migrations (last 5 in the folder) use dated filenames (`20260529_*.sql` etc.) rather than the older sequential numbering (`001_*.sql`–`064_*.sql`).

### Integration Points
- `public.exercises.id` (UUID) is the FK target for `exercise_import_log.exercise_id` and the folder key for `exercise-media` storage paths.
- `exercise_import_log` is read/written by Phase 3's merge script (not built in this phase) — its schema must support resumability (IMPORT-04) and manual-review flagging (IMPORT-05) from day one, since retrofitting columns after Phase 3 starts writing to it would be costly.

</code_context>

<specifics>
## Specific Ideas

- The `image`/`gif` column split and folder-per-`exercise_id` + fixed-filename convention were specifically chosen to let Phase 3's merge script write predictable, overwrite-safe paths without needing per-exercise filename logic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope-creep items came up; every discussed area was a "how to implement Phase 1's listed success criteria" question, not a new capability.

</deferred>

---

*Phase: 1-Schema & Storage Foundation*
*Context gathered: 2026-08-14*
