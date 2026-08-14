---
phase: 01-schema-storage-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, storage, migration, exercise-library]

# Dependency graph
requires: []
provides:
  - "supabase/migrations/20260814_exercise_media_schema.sql — exercises.image/gif columns, exercise-media bucket DDL, exercise_import_log table DDL (committed locally AND applied to production via dashboard SQL editor)"
affects: [image-exo Phase 2 Download & Match, image-exo Phase 3 Merge, image-exo Phase 4 Mobile Consumption]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dated migration filename convention (YYYYMMDD_description.sql) per D-08"
    - "Public Storage bucket with zero write policies — service-role-only writes (mirrors 025_storage_buckets.sql exports bucket)"
    - "RLS enabled with zero policies on a global (non-user-owned) log table = deny-by-default for anon/authenticated"

key-files:
  created:
    - supabase/migrations/20260814_exercise_media_schema.sql
  modified: []

key-decisions:
  - "Task 2 (push via `supabase db push --linked`) BLOCKED on a pre-existing 30-version migration-history bookkeeping drift on the shared production project — resolved instead by applying this plan's migration SQL directly via the Supabase dashboard SQL editor (Option C), bypassing the CLI's full-history reconciliation entirely. The broader bookkeeping drift is unresolved and will still block future `supabase db push` runs from this branch."

patterns-established:
  - "Migration file organizes multiple related DDL changes (columns + bucket + table) into one dated file with numbered comment sections, per D-08/CONTEXT.md"

requirements-completed: [MEDIA-01, MEDIA-02]

# Metrics
duration: ~20min (Task 1) + human-applied SQL editor step (Task 2 workaround) + verification (Task 3)
completed: 2026-08-14
---

# Phase 1 Plan 1: Schema & Storage Foundation Summary

**Migration written, committed, and applied to production.** Task 2's `supabase db push --linked` was blocked by pre-existing migration-history drift on the shared production project (unrelated to this plan's migration content); the user applied this plan's migration SQL directly via the Supabase dashboard SQL editor instead (Option C from the blocked-task analysis). Task 3's live verification confirms all three schema/storage changes are live.

## Performance

- **Duration:** ~20 min (Task 1) + human SQL editor step + verification
- **Started:** 2026-08-14T20:42:00Z (approx)
- **Completed:** 2026-08-14 (Task 3 verified post-merge by orchestrator)
- **Tasks:** 3 of 3 completed
- **Files modified:** 1

## Accomplishments
- Wrote `supabase/migrations/20260814_exercise_media_schema.sql` with all three required DDL sections (exercises.image/gif columns, exercise-media public bucket, exercise_import_log table), verified against every acceptance-criteria grep check in the plan
- Confirmed local file content matches D-01 through D-08 exactly (relative storage paths, folder-per-exercise_id + fixed filenames convention documented in comments, zero CREATE POLICY statements, status CHECK enum, source_id index)
- Identified and diagnosed a pre-existing, cross-workstream production migration-history mismatch that blocks ALL pushes to the linked Supabase project from this branch — not just this plan's migration — and stopped before taking a risky, potentially irreversible bookkeeping action against shared production infrastructure
- Migration applied to production directly via the Supabase dashboard SQL editor (user-executed), sidestepping the broader drift
- Live verification (REST + Storage API) confirms all three changes are present in production

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the exercise media schema + storage migration** - `5440c44` (feat)
2. **[BLOCKING] Task 2: Push migration to the linked Supabase project** - COMPLETED via workaround (user applied SQL directly via Supabase dashboard SQL editor, bypassing `supabase db push --linked`'s history-reconciliation blocker)
3. **Task 3: Verify live schema and storage state against production** - COMPLETED (see Verification below)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `supabase/migrations/20260814_exercise_media_schema.sql` - Adds `exercises.image`/`exercises.gif` nullable TEXT columns, creates the public `exercise-media` Storage bucket (service-role-write-only, 2MB limit, png/gif only), creates `public.exercise_import_log` table with status CHECK enum + FK to exercises + source_id index + RLS enabled with zero policies

## Decisions Made
- Halted at Task 2 rather than running `supabase migration repair --status reverted <30 versions>` (the CLI's own suggested remedy) — see Issues Encountered for full rationale. This is a deliberate Rule 4 (architectural/production-safety) stop, not an auto-fix.

## Deviations from Plan

### Blocked — Requires Human Decision (Rule 4)

**1. [Rule 4 - Architectural/Production-Safety] `supabase db push --linked --yes` fails with migration-history mismatch unrelated to this plan's migration content**
- **Found during:** Task 2 ([BLOCKING] push to linked project)
- **Issue:** `npx supabase db push --linked --yes` fails immediately with `LegacyDbPushMissingLocalError: Remote migration versions not found in local migrations directory`. Running `npx supabase migration list --linked` (read-only) shows the remote project's `supabase_migrations.schema_migrations` bookkeeping table has **30 migration versions** with full `YYYYMMDDHHMMSS` timestamps (spanning 2026-05-20 through 2026-08-13) that have **no corresponding file anywhere in this worktree's `supabase/migrations/` directory** (dev branch). Conversely, local has migrations `045`–`064` (sequential) plus 6 dated files — including this plan's new `20260814_exercise_media_schema.sql` — that show as **not yet applied** on remote (`remote:""`).
- **Why not auto-fixed:** The CLI's own suggested remedy (`supabase migration repair --status reverted <30 versions>` then `db pull`) only touches the bookkeeping table (not actual schema), but:
  1. This is the **single shared production Supabase project** (`slkobhavpwsubnsmuhya`) used by the live Ziko mobile app and referenced by multiple other **concurrently active parallel workstreams** (v1.9–v1.15 per PROJECT.md "Active Parallel Workstreams"). A bookkeeping change here is not scoped to this plan/phase.
  2. The 30 unknown remote-only versions plausibly correspond 1:1 with local migrations `045`-`064` + some dated files under a *different* version-id (e.g. if they were originally applied via `supabase migration new` with an auto-generated timestamp, then the file was later renamed to the project's sequential convention without re-syncing bookkeeping). If that hypothesis is correct, `--status reverted` followed by a `db push` re-applying `045`-`064` should be a safe no-op (codebase consistently uses `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`) — but this cannot be verified with certainty from inside this sandboxed worktree, and a wrong assumption risks re-executing non-idempotent DDL/data operations against live production data.
  3. `psql` is not available in this environment, so a scoped/manual direct-SQL application of just the new migration (bypassing the CLI's full-history reconciliation) was not a viable fallback either.
  4. This mismatch pre-dates this plan and is not something Task 1's new migration file caused — it affects the entire `supabase/migrations/` directory's ability to push from this branch, not just `20260814_exercise_media_schema.sql`.
- **Proposed resolution (for user):**
  - Option A: Confirm (via Supabase dashboard SQL editor or `supabase db diff --linked`) whether local migrations `045`-`064` and the 5 pre-existing dated files are already physically applied to production under the unmatched timestamp versions. If yes, run `supabase migration repair --status reverted <the 30 versions>` then re-run `supabase db push --linked --yes` — this should cleanly land `045`-`064`, the 5 pre-existing dated files, AND this plan's `20260814_exercise_media_schema.sql` in one push.
  - Option B: If any of the 30 remote-only versions are NOT reflected in local files, investigate what they contain (`supabase db pull` into a throwaway branch, or dashboard migration history view) before repairing — there may be genuine schema drift from manual dashboard changes that needs to be reconciled into the git history first.
  - Option C (narrowest, unblocks only this plan): Apply just this plan's migration SQL directly against production via the Supabase dashboard SQL editor or `psql` (from a machine that has it installed) using the service-role/postgres connection string — bypasses the CLI's full migration-history reconciliation entirely. All three DDL sections in `20260814_exercise_media_schema.sql` use `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`, so this is safe to run standalone regardless of the broader migration-history drift, and low risk given it only adds two nullable columns, one new bucket row, and one new table.
- **Files affected:** None beyond the committed migration file — production schema was updated out-of-band via SQL editor, not via `supabase db push`
- **Resolution:** User applied Option C — ran the migration SQL directly via the Supabase dashboard SQL editor. Confirmed live via Task 3 verification below. The broader 30-version migration-history bookkeeping drift (Options A/B) remains unresolved and will still block a future `supabase db push --linked` from this branch — noted as a standing concern, not blocking this phase.

---

**Total deviations:** 1 (Rule 4 architectural/production-safety stop — resolved via human-executed workaround, not by this executor)
**Impact on plan:** All 3 tasks complete. Migration is live in production.

## Issues Encountered

See "Deviations from Plan" above. The production migration-history mismatch on the linked Supabase project (`slkobhavpwsubnsmuhya`) is unresolved at the bookkeeping level and will resurface for the next migration that needs `supabase db push` from this branch (Phase 3's merge script will add data, not schema, so it may not need a push — but any future phase adding new migrations should expect this same block and either resolve the drift first or use the SQL-editor workaround again).

## Task 3 Verification (live production checks)

Run post-merge by the orchestrator after the user confirmed the SQL editor apply:

```
curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/rest/v1/exercises?select=id,image,gif&limit=1"
→ 200

curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/rest/v1/exercise_import_log?select=id&limit=1"
→ 200

curl -s -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/storage/v1/bucket/exercise-media"
→ {"id":"exercise-media","name":"exercise-media","owner":"","public":true,"file_size_limit":2097152,"allowed_mime_types":["image/png","image/gif"],...}
```

All three checks pass: `exercises.image`/`exercises.gif` columns are queryable, `exercise_import_log` table exists, and the `exercise-media` bucket exists with `public:true` and the correct size/MIME constraints.

## Next Phase Readiness
- Migration file is written, committed, and live in production — all three Phase 1 success criteria are satisfied.
- Phase 2 (Download & Match) can now start — the `image`/`gif` columns, `exercise-media` bucket, and `exercise_import_log` table all exist live.
- **Standing concern (non-blocking for this phase):** the pre-existing production migration-history bookkeeping drift (30 unmatched remote versions) is still unresolved. Any future phase in this or other workstreams that adds a new migration should expect `supabase db push --linked` to fail the same way until that's reconciled (Options A/B from the deviation note above).

---
*Phase: 01-schema-storage-foundation*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260814_exercise_media_schema.sql`
- FOUND: `.planning/workstreams/image-exo/phases/01-schema-storage-foundation/01-01-SUMMARY.md`
- FOUND: commit `5440c44` (Task 1 migration file)
- FOUND: commit `4257098` (this SUMMARY.md)
- VERIFIED: exercises.image/gif columns live (HTTP 200)
- VERIFIED: exercise_import_log table live (HTTP 200)
- VERIFIED: exercise-media bucket live (public:true, correct constraints)
