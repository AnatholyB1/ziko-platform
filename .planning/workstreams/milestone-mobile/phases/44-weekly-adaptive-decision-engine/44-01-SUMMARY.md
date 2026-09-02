---
phase: 44-weekly-adaptive-decision-engine
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rpc, migrations]

# Dependency graph
requires:
  - phase: 42-decision-system-foundation
    provides: athlete_state, athlete_decisions tables + record_athlete_decision() 9-arg RPC
provides:
  - athlete_goals table (D-09) — dedicated goal_text/target_metric/target_value/target_date/status row, SELECT-only RLS, three-role write REVOKE
  - ai_cost_log.source column (ENGINE-05) — distinguishes opex-funded autonomous AI cost from user-initiated chat cost
  - record_athlete_decision() 10-arg RPC — p_new_goal atomic goal creation + goal_id stamping, next_review_due_at now also advances on onboarding_profile (D-02)
affects: [44-weekly-adaptive-decision-engine (remaining plans 02-08 depend on this schema), 47-ops-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration files, not applied to live project yet — Task 3 is a blocking human-verify checkpoint"

key-files:
  created:
    - supabase/migrations/20260902100000_athlete_goals.sql
    - supabase/migrations/20260902100100_ai_cost_log_source.sql
    - supabase/migrations/20260902100200_record_athlete_decision_v2.sql
  modified: []

key-decisions:
  - "DROP FUNCTION IF EXISTS on the exact 9-type signature before CREATE OR REPLACE with 10 args — Postgres treats a different arg count as a new overload, not a replacement, which would leave both signatures live and break every existing 9-named-param caller (onboarding.ts, onboarding-retroactive.ts)"
  - "athlete_goals insert happens after the duplicate early-return and before the athlete_state UPDATE inside record_athlete_decision(), so a duplicate weekly_focus retry never creates an orphan goal row"
  - "next_review_due_at widened to advance on both weekly_focus and onboarding_profile (not just weekly_focus) — implements D-02's cadence rolling from onboarding completion date"
  - "No CHECK constraint added on ai_cost_log.source — deliberately deferred to Phase 47 (OPS-03) which will add more autonomous sources"

requirements-completed: []  # Task 3 (live push) not yet done — requirements ENGINE-04/05/06 not marked complete until the checkpoint is approved and migrations are live

# Metrics
duration: ~25min (Tasks 1-2 only; Task 3 blocked)
completed: 2026-09-02
---

# Phase 44 Plan 01: Weekly Adaptive Decision Engine — Schema Foundation Summary

**Three new Supabase migrations (athlete_goals table, ai_cost_log.source column, record_athlete_decision v2 RPC) written and committed — not yet applied to the live project, blocked at Task 3's mandatory human-verify checkpoint for the production `supabase db push`.**

## Performance

- **Duration:** ~25 min (Tasks 1-2)
- **Tasks:** 2/3 completed, 1 blocked (checkpoint)
- **Files modified:** 3 (all new migration files)

## Accomplishments
- `athlete_goals` table created: SELECT-only RLS, explicit three-role (`anon`, `authenticated`, `service_role`) write REVOKE in the same migration (avoiding the Phase 42 `athlete_state` follow-up-migration mistake), indexed for the "current active goal" lookup
- `ai_cost_log.source` column added, defaulting existing rows safely to `'user_chat'`
- `record_athlete_decision()` extended to a single 10-arg version: explicit `DROP FUNCTION IF EXISTS` on the 9-type signature prevents an ambiguous-overload break for existing callers; new `p_new_goal` param atomically writes `athlete_goals` and stamps the real `goal_id` into `current_focus_detail`; `next_review_due_at` now advances on `onboarding_profile` decisions too (D-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: athlete_goals table + ai_cost_log.source column migrations** - `bb8025a4` (feat)
2. **Task 2: record_athlete_decision v2 — p_new_goal + onboarding review-clock stamp** - `8ebc1a09` (feat)
3. **Task 3: [BLOCKING] Apply migrations to the live Supabase project** - NOT STARTED (checkpoint reached, requires human verification of live production push against Supabase project)

_No plan-metadata commit yet — will be added if/when Task 3 is approved and the plan is closed out._

## Files Created/Modified
- `supabase/migrations/20260902100000_athlete_goals.sql` - New `athlete_goals` table, SELECT-only RLS, three-role write REVOKE, `idx_athlete_goals_user_active` index, `trg_athlete_goals_updated` trigger
- `supabase/migrations/20260902100100_ai_cost_log_source.sql` - `ai_cost_log.source TEXT NOT NULL DEFAULT 'user_chat'` additive column
- `supabase/migrations/20260902100200_record_athlete_decision_v2.sql` - Drops 9-arg `record_athlete_decision`, creates 10-arg version with `p_new_goal`, atomic goal insert + `goal_id` stamp, widened `next_review_due_at` clock, re-asserted per-role EXECUTE lockdown, `NOTIFY pgrst, 'reload schema'`

## Decisions Made
- Followed the plan's explicit instruction to deviate from `44-PATTERNS.md`'s sketch by adding the `DROP FUNCTION IF EXISTS` step — the pattern map's sketch omits it, but the plan's task text calls this out explicitly as required (overload hazard).
- Kept every existing block ((a) evidence guard, (b) journal insert/ON CONFLICT, (c) duplicate early-return, (d) self-heal insert) byte-for-byte identical to the live 9-arg function, only inserting the new `athlete_goals` write and modifying the two `current_focus_detail`/`next_review_due_at` UPDATE assignments, per the plan's explicit "carry forward unchanged except where specified" instruction.
- Did not add a CHECK constraint on `ai_cost_log.source`, per the plan's explicit instruction to defer that to Phase 47 (OPS-03).

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2. Task 3 was not executed — per this plan's frontmatter (`autonomous: false`) and the executor's checkpoint protocol, a blocking `checkpoint:human-verify` task that pushes schema changes to the live production Supabase project must be presented to the user for confirmation before it runs, rather than being auto-executed by the agent.

## Issues Encountered
None during Tasks 1-2. All automated verification greps and acceptance criteria passed on the first attempt for both tasks.

## User Setup Required

None - no external service configuration required. Task 3 requires the orchestrator/user to confirm the live Supabase production push (see Checkpoint below); this is a deployment action, not an environment/dashboard setup step.

## Next Phase Readiness

Tasks 1 and 2 (the two new migration files) are complete, committed, and pass all plan-specified acceptance criteria locally. The phase's remaining plans (44-02 through 44-08) depend on these migrations being live on the production Supabase project — that live application is Task 3, currently blocked pending human confirmation of the `supabase db push` and the five post-push assertions listed in the plan (single `record_athlete_decision` in `pg_proc`, `athlete_goals` RLS enabled, `service_role` cannot INSERT into `athlete_goals`, `ai_cost_log.source` default confirmed, no `.env*` diff). A fresh agent/session must resume at Task 3 once the user approves.

---
*Phase: 44-weekly-adaptive-decision-engine*
*Plan: 01*
*Status: Tasks 1-2 complete, Task 3 blocked at checkpoint*
