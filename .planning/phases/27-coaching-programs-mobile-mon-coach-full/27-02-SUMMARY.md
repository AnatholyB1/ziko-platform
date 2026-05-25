---
phase: 27-coaching-programs-mobile-mon-coach-full
plan: "02"
subsystem: database
tags: [supabase, postgresql, rls, migrations, coaching, workout-programs]

# Dependency graph
requires:
  - phase: 27-01
    provides: coach_client_links table and is_coach_of() SECURITY DEFINER function (migration 035)
  - phase: 27-00
    provides: Phase 27 architecture decisions, schema design (D-07 through D-15)

provides:
  - coach_program_folders table with RLS (folders_own policy)
  - folder_id + start_date columns on workout_programs
  - is_user_defined column on exercises
  - shared_note column on coach_client_links
  - source_program_id + source_session_id columns on workout_sessions
  - workout_programs_coach_read RLS policy (SELECT for coaches + seed templates)
  - workout_programs_coach_assign RLS policy (INSERT for coach fork-on-assign)
  - Performance indexes on folder_id and source_program_id

affects:
  - 27-03 (backend coach API routes need all 7 columns)
  - 27-04 (fork-on-assign route uses coach_assign RLS + source columns)
  - 27-05 (mobile coach screens query coach_program_folders)
  - 27-06 (mobile athlete screens use source_program_id for compliance)
  - 27-07 (shared_note surfaced in coach-client link detail)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Partial index pattern: CREATE INDEX IF NOT EXISTS ... WHERE column IS NOT NULL — filters NULL rows from indexes for FK columns that are often NULL"
    - "RLS multi-OR pattern: own row OR coach relationship OR public seed template — three distinct access paths in a single SELECT policy"
    - "Separation of is_custom (user self-flagged) vs is_user_defined (coach-created) on exercises — coexistence without renaming existing columns"

key-files:
  created:
    - supabase/migrations/045_coaching_programs_schema.sql
  modified: []

key-decisions:
  - "Migration applied via Supabase MCP tools instead of supabase CLI — duplicate-numbered migration files in local repo caused CLI push conflicts; MCP apply_migration bypasses local file resolution and applies SQL directly to remote project"
  - "start_date named distinctly from existing cycle_start_date (migration 016) — these are different concepts: assignment start date vs program cycle start"
  - "shared_note max-length (500 chars) enforced at API layer, not DB CHECK constraint — aligns with plan D-15 decision"
  - "Seed templates (is_template=TRUE, created_by_coach_id=NULL) made readable by any authenticated user via third OR clause in workout_programs_coach_read — enables template browsing without exposing client program data"

patterns-established:
  - "Phase 27 DB pattern: all new columns use ON DELETE SET NULL for FK references (folder_id, source_program_id) — preserves child rows when parent is deleted"
  - "is_coach_of() reuse: all coach-access RLS policies call the pre-existing SECURITY DEFINER function from migration 035 — no inline subqueries"

requirements-completed:
  - PROG-01
  - PROG-04
  - PROG-06
  - PROG-07
  - PROG-09

# Metrics
duration: 30min
completed: 2026-05-20
---

# Phase 27 Plan 02: Migration 045 — Coaching Programs Schema Summary

**PostgreSQL migration 045 adding 7 schema objects (1 table + 6 columns), 2 targeted RLS policies, and 2 partial indexes to unlock the full coaching programs feature stack**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-20T00:00:00Z
- **Completed:** 2026-05-20T00:30:00Z
- **Tasks:** 2 (1 auto + 1 human-verify gate)
- **Files modified:** 1

## Accomplishments

- Created `coach_program_folders` table with RLS (`folders_own` policy) enabling single-level folder organization for coaches (D-08)
- Added 6 columns across 4 existing tables: `folder_id` + `start_date` on `workout_programs`, `is_user_defined` on `exercises`, `shared_note` on `coach_client_links`, `source_program_id` + `source_session_id` on `workout_sessions`
- Added `workout_programs_coach_read` (SELECT) and `workout_programs_coach_assign` (INSERT) RLS policies using the pre-existing `is_coach_of()` SECURITY DEFINER function
- Migration applied successfully to production Supabase via MCP — all columns and policies confirmed visible in Supabase Dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 045** - `89b4dc9` (feat)
2. **Task 2: Push migration via Supabase MCP** - human-verify gate (no commit — applied via MCP directly to remote)

## Files Created/Modified

- `supabase/migrations/045_coaching_programs_schema.sql` — Full DDL for coach_program_folders, 6 ALTER TABLE statements, 2 RLS policies, 2 partial indexes

## Decisions Made

- **MCP over CLI for push:** Local supabase CLI failed to push due to duplicate-numbered migration files in the repo. Migration was applied via Supabase MCP `apply_migration` which sends SQL directly to the remote project. Schema is identical to the planned file — no functional difference.
- **Partial indexes:** `WHERE folder_id IS NOT NULL` and `WHERE source_program_id IS NOT NULL` on the new FK columns — avoids indexing the common NULL case, keeping index size small.

## Deviations from Plan

Migration was applied via Supabase MCP instead of `supabase db push` CLI command. This was necessitated by duplicate-numbered migration files in the local repository causing CLI resolution conflicts. The applied SQL is byte-for-byte identical to the committed migration file. Schema outcome is identical to plan specification.

No code deviations. No schema deviations.

## Issues Encountered

- `supabase db push` CLI had conflicts with duplicate migration file numbers in the local repo. Resolved by applying migration directly via Supabase MCP `apply_migration` — success: true, all 7 schema changes confirmed in Supabase Dashboard.

## User Setup Required

None - migration was applied directly to the remote Supabase project via MCP during plan execution.

## Next Phase Readiness

- All 7 schema changes are live in the production Supabase database
- `coach_program_folders`, `folder_id`, `start_date`, `is_user_defined`, `shared_note`, `source_program_id`, `source_session_id` columns are all available
- `workout_programs_coach_read` and `workout_programs_coach_assign` RLS policies are active
- Wave 2 plans (27-03 backend routes, 27-04 fork-on-assign, 27-05 coach mobile screens) are unblocked

---
*Phase: 27-coaching-programs-mobile-mon-coach-full*
*Completed: 2026-05-20*
