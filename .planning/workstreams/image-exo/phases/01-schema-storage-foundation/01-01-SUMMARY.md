---
phase: 01-schema-storage-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, storage, migration, exercise-library]

# Dependency graph
requires: []
provides:
  - "supabase/migrations/20260814_exercise_media_schema.sql — exercises.image/gif columns, exercise-media bucket DDL, exercise_import_log table DDL (committed locally, NOT YET applied to production)"
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
  - "Task 2 (push to linked production Supabase project) BLOCKED — halted per Rule 4 rather than running the CLI-suggested `supabase migration repair --status reverted` against 30 unknown remote-only migration versions on the shared production project"

patterns-established:
  - "Migration file organizes multiple related DDL changes (columns + bucket + table) into one dated file with numbered comment sections, per D-08/CONTEXT.md"

requirements-completed: []

# Metrics
duration: ~20min (Task 1 only; Task 2/3 blocked)
completed: 2026-08-14
---

# Phase 1 Plan 1: Schema & Storage Foundation Summary

**Migration file written and committed locally (exercises.image/gif columns, exercise-media bucket, exercise_import_log table) — but NOT applied to production; Task 2's `supabase db push --linked` is blocked by pre-existing migration-history drift on the shared production project, unrelated to this plan's own migration content.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-14T20:42:00Z (approx)
- **Completed:** 2026-08-14T21:01:49Z
- **Tasks:** 1 of 3 completed (Task 2 and Task 3 blocked)
- **Files modified:** 1

## Accomplishments
- Wrote `supabase/migrations/20260814_exercise_media_schema.sql` with all three required DDL sections (exercises.image/gif columns, exercise-media public bucket, exercise_import_log table), verified against every acceptance-criteria grep check in the plan
- Confirmed local file content matches D-01 through D-08 exactly (relative storage paths, folder-per-exercise_id + fixed filenames convention documented in comments, zero CREATE POLICY statements, status CHECK enum, source_id index)
- Identified and diagnosed a pre-existing, cross-workstream production migration-history mismatch that blocks ALL pushes to the linked Supabase project from this branch — not just this plan's migration — and stopped before taking a risky, potentially irreversible bookkeeping action against shared production infrastructure

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the exercise media schema + storage migration** - `5440c44` (feat)
2. **[BLOCKING] Task 2: Push migration to the linked Supabase project** - NOT COMPLETED (see Deviations/Issues below)
3. **Task 3: Verify live schema and storage state against production** - NOT ATTEMPTED (depends on Task 2)

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
- **Files affected:** None beyond the committed migration file (no schema was applied to production; Task 3's live verification checks were not run since there is nothing new to verify yet)
- **Impact:** Phase 1's success criteria ("migration is committed to git AND applied to the linked Supabase project") is only half-satisfied — committed but not applied. Phases 2-4 of the image-exo workstream cannot proceed until this is resolved, since they depend on the live `image`/`gif` columns, `exercise-media` bucket, and `exercise_import_log` table existing in production.

---

**Total deviations:** 1 blocked (Rule 4 — architectural/production-safety decision required)
**Impact on plan:** Task 1 fully complete and verified. Tasks 2-3 could not be completed safely without human input on a shared production database migration-history issue that pre-dates and is broader in scope than this plan.

## Issues Encountered

See "Deviations from Plan" above — the single blocking issue is the production migration-history mismatch on the linked Supabase project (`slkobhavpwsubnsmuhya`), discovered while attempting Task 2's required `supabase db push --linked --yes`.

## User Setup Required

**Human decision + action required to unblock Task 2/3.** See "Deviations from Plan" above for the three proposed resolution options (A/B/C). Recommended fastest path: Option C (apply this plan's migration SQL directly via the Supabase dashboard SQL editor), since the migration is small, fully idempotent (`IF NOT EXISTS`/`ON CONFLICT DO NOTHING` throughout), and does not require resolving the broader 30-version bookkeeping drift to unblock this specific plan. Options A/B are needed eventually regardless, to unblock future `supabase db push` from any branch against this project.

After applying (via any option), verify with:
```
curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/rest/v1/exercises?select=id,image,gif&limit=1"
curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/rest/v1/exercise_import_log?select=id&limit=1"
curl -s -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" "$SUPABASE_URL/storage/v1/bucket/exercise-media"
```
All three should return HTTP 200, and the bucket check should show `"public":true`.

## Next Phase Readiness
- Migration file is written, reviewed, and committed — ready to apply as soon as the production migration-history question is resolved.
- Phase 2 (Download & Match) cannot start until Task 2/3 of this plan are completed (the `image`/`gif` columns, `exercise-media` bucket, and `exercise_import_log` table must exist live).
- **Blocker:** production Supabase migration-history drift (see above) — needs a human decision before this plan (and the rest of the image-exo workstream) can proceed.

---
*Phase: 01-schema-storage-foundation*
*Completed: 2026-08-14 (partial — Task 1 of 3)*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260814_exercise_media_schema.sql`
- FOUND: `.planning/workstreams/image-exo/phases/01-schema-storage-foundation/01-01-SUMMARY.md`
- FOUND: commit `5440c44` (Task 1 migration file)
- FOUND: commit `4257098` (this SUMMARY.md)
