---
phase: 27-coaching-programs-mobile-mon-coach-full
plan: "03"
subsystem: database
tags: [supabase, postgresql, rls, migrations, workout-programs, seed-data]

# Dependency graph
requires:
  - phase: 27-coaching-programs-mobile-mon-coach-full
    provides: workout_programs table + RLS policies (migration 045)
provides:
  - 5 expert seed program templates (PPL, 5/3/1 Wendler, Hyrox Prep, Body Recomp, Débutant Full Body)
  - workout_programs.goal TEXT NULL column
  - workout_programs.weeks_count INTEGER NULL column
  - workout_programs.user_id made nullable (DROP NOT NULL)
affects: [28-ui-design-mon-coach, ai-programs-plugin, coach-web]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NULL user_id for system seed templates — cleaner than sentinel UUID when FK bypass is unavailable"
    - "ON CONFLICT (id) DO NOTHING for idempotent seed migrations"

key-files:
  created:
    - supabase/migrations/046_coaching_programs_seeds.sql
  modified: []

key-decisions:
  - "NULL user_id instead of sentinel UUID 00000000-0000-0000-0000-000000000001 — Supabase MCP apply_migration cannot bypass FK constraints; NULL is semantically cleaner and RLS policies already protect templates"
  - "ALTER COLUMN user_id DROP NOT NULL added at top of migration 046 to enable NULL seed rows"

patterns-established:
  - "System seed templates use NULL user_id — not a sentinel UUID — when FK constraint makes sentinel approach impractical"

requirements-completed: [PROG-08]

# Metrics
duration: 30min
completed: 2026-05-20
---

# Phase 27 Plan 03: Coaching Programs Seed Templates Summary

**5 expert program templates seeded (PPL, 5/3/1 Wendler, Hyrox Prep, Body Recomp, Débutant Full Body) with goal + weeks_count columns and nullable user_id via migration 046**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-20T00:00:00Z
- **Completed:** 2026-05-20T00:30:00Z
- **Tasks:** 2 (1 auto + 1 human-verify gate)
- **Files modified:** 1

## Accomplishments
- Wrote migration 046 with 5 full expert program templates (week 1 sessions fully specified with exercises, RPE, rest times, notes)
- Added goal (TEXT NULL) and weeks_count (INTEGER NULL) columns to workout_programs
- Made user_id nullable via ALTER COLUMN DROP NOT NULL to support system seed templates
- Migration applied successfully via Supabase MCP (success: true, human-verify gate passed)

## Task Commits

1. **Task 1: Write migration 046** - `cbd9817` (feat)
2. **Task 2: Human-verify gate** - migration applied via Supabase MCP (no code commit)

## Files Created/Modified
- `supabase/migrations/046_coaching_programs_seeds.sql` - Migration adding goal/weeks_count columns, DROP NOT NULL on user_id, and 5 seed templates with full week-1 exercise data

## Decisions Made
- NULL user_id instead of sentinel UUID: the Supabase MCP `apply_migration` path enforces FK constraints against `auth.users` — the sentinel UUID strategy from D-09 could not be used. NULL is also semantically cleaner: NULL user_id + existing `workout_programs_coach_read` RLS policy (is_template = TRUE AND created_by_coach_id IS NULL) already exposes templates to all authenticated users while preventing modification by regular users.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] user_id strategy changed from sentinel UUID to NULL**
- **Found during:** Task 2 (human-verify gate — migration apply)
- **Issue:** Supabase MCP `apply_migration` enforces FK constraint against `auth.users`; sentinel UUID `00000000-0000-0000-0000-000000000001` does not exist in auth.users, causing FK violation at apply time
- **Fix:** Added `ALTER TABLE public.workout_programs ALTER COLUMN user_id DROP NOT NULL` at top of migration; replaced all 5 sentinel UUID values with NULL in INSERT statements; updated header comment to document the NULL strategy
- **Files modified:** supabase/migrations/046_coaching_programs_seeds.sql
- **Verification:** Migration applied successfully via Supabase MCP (success: true)
- **Committed in:** post-apply fix (this commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug: FK constraint violation)
**Impact on plan:** Semantically cleaner outcome. NULL user_id is the correct pattern for system-owned seed data. No scope change.

## Issues Encountered
- FK constraint on workout_programs.user_id → auth.users was not bypassable via Supabase MCP apply_migration (unlike direct superuser psql). Resolved by making user_id nullable, which is the correct long-term approach for system templates.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Migration 046 applied and verified — 5 program templates queryable via `SELECT * FROM workout_programs WHERE is_template = TRUE`
- goal and weeks_count columns available for UI display
- Ready for Phase 28 UI implementation of program catalog screens

---
*Phase: 27-coaching-programs-mobile-mon-coach-full*
*Completed: 2026-05-20*
