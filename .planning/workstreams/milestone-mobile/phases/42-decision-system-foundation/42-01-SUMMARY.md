---
phase: 42-decision-system-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migrations, athlete-state, ai-decision-journal]

# Dependency graph
requires: []
provides:
  - "public.athlete_state table — compact one-row-per-athlete current-state row"
  - "public.athlete_decisions table — append-only AI decision journal with mandatory evidence"
  - "SELECT-only RLS policies on both tables (own-row read, zero write policies)"
  - "idx_athlete_decisions_week_idempotency partial unique index for plan 42-02's RPC ON CONFLICT inference"
  - "idx_athlete_decisions_user_created index for the FOUND-05 bounded-window read"
  - "FOUND-05 bounded-read convention text, recorded verbatim in the rolling_summary column comment"
affects: [42-02-decision-system-foundation-rpc, 43-onboarding, 44-weekly-decision-engine, 45-rewards, 46-feature-gating, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SELECT-only RLS via explicit FOR SELECT command restriction, zero write policies — deny-write-at-RLS, write path deferred entirely to a future SECURITY DEFINER RPC"
    - "Reuse of existing public.handle_updated_at() trigger function rather than redefining per-table"
    - "Mandatory JSONB evidence column (NOT NULL, no DEFAULT, jsonb_typeof CHECK) as a schema-level grounding contract"
    - "Partial unique index scoped to a single decision_type value, for idempotent per-week upserts"

key-files:
  created:
    - supabase/migrations/20260831120000_athlete_state.sql
    - supabase/migrations/20260831120100_athlete_decisions.sql
    - .planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-01-SUMMARY.md
  modified: []

key-decisions:
  - "readiness is a top-level TEXT column with CHECK (fragile/building/ready), defaulting to 'fragile' as the fail-safe posture (D-01/D-02)"
  - "No track column on athlete_state — cut entirely per D-03"
  - "Both tables ship with zero GRANT/REVOKE statements; all grant lockdown is consolidated in plan 42-02's RPC migration so no partially-locked window exists across files"
  - "evidence JSONB is NOT NULL with no DEFAULT — an ungrounded decision is unwritable at the schema layer (FOUND-02)"

patterns-established:
  - "Compact current-state table (athlete_state) paired with an append-only append-only journal (athlete_decisions) — state read is O(1) row, history read is a bounded LIMIT 4 query, never a full journal replay"

requirements-completed: [FOUND-01, FOUND-02, FOUND-04, FOUND-05]

# Metrics
duration: 12min
completed: 2026-08-31
---

# Phase 42 Plan 01: Decision-System Data Model Foundation Summary

**Two new Postgres tables — `athlete_state` (compact current-state row) and `athlete_decisions` (append-only AI decision journal with mandatory grounding evidence) — both RLS-protected with SELECT-only own-row policies and zero write policies.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-31T14:12:00Z
- **Completed:** 2026-08-31T14:24:05Z
- **Tasks:** 2
- **Files modified:** 2 created (migrations) + 1 created (this summary)

## Accomplishments
- `supabase/migrations/20260831120000_athlete_state.sql` — `public.athlete_state`, one row per athlete, with `readiness` as a top-level fail-safe-default CHECK column and no `track` column
- `supabase/migrations/20260831120100_athlete_decisions.sql` — `public.athlete_decisions`, append-only journal with a mandatory `evidence` JSONB grounding contract and both required indexes
- Both tables RLS-enabled with exactly one `FOR SELECT` own-row policy each and zero write policies — write access deliberately deferred to plan 42-02's RPC
- Zero GRANT/REVOKE statements in either file, per the plan's explicit ordering requirement

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the athlete_state table migration** - `27495951` (feat)
2. **Task 2: Create the athlete_decisions journal migration** - `32a7db4b` (feat)

**Plan metadata:** (this summary commit, made by the orchestrator after wave merge)

## Files Created/Modified
- `supabase/migrations/20260831120000_athlete_state.sql` - `athlete_state` table: status/readiness/level/points/tier/onboarding_profile/current_focus_summary/current_focus_detail/rolling_summary/last_review_at/next_review_due_at + created_at/updated_at, SELECT-only RLS, `handle_updated_at()` trigger reuse, column comments
- `supabase/migrations/20260831120100_athlete_decisions.sql` - `athlete_decisions` table: id/user_id/decision_type/week_of/summary/rationale/evidence/outcome/source/created_at, two named indexes, SELECT-only RLS, column comments

### Final column list — `public.athlete_state`
```
user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
status                 TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','paused'))
readiness              TEXT NOT NULL DEFAULT 'fragile' CHECK (readiness IN ('fragile','building','ready'))
level                  INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1)
points                 INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0)
tier                   INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1)
onboarding_profile     JSONB NOT NULL DEFAULT '{}'
current_focus_summary  TEXT
current_focus_detail   JSONB NOT NULL DEFAULT '{}'
rolling_summary        TEXT
last_review_at         TIMESTAMPTZ
next_review_due_at     TIMESTAMPTZ
created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Final column list — `public.athlete_decisions`
```
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
decision_type  TEXT NOT NULL CHECK (decision_type IN ('onboarding_profile','weekly_focus','level_change','reward_grant','program_created','goal_created'))
week_of        DATE
summary        TEXT NOT NULL
rationale      TEXT
evidence       JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object')
outcome        JSONB NOT NULL DEFAULT '{}'
source         TEXT NOT NULL DEFAULT 'weekly_review_cron' CHECK (source IN ('weekly_review_cron','onboarding_tool','app_open_fallback','manual_admin'))
created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### FOUND-05 bounded-read convention (verbatim from `athlete_state.rolling_summary` column comment — Phase 44 needs this exact text)
> FOUND-05 bounded-context read convention: AI callers must read this column (capped at ~500 tokens / ~2000 characters) plus the last 4 rows of public.athlete_decisions ordered by created_at DESC, and must never replay the full decisions journal. Recompaction of this column is Phase 44's coaching-engine/context.ts, run as the last step of the weekly review.

## Decisions Made
None beyond what the plan already specified — plan executed exactly as written, including the deliberate deferral of all GRANT/REVOKE statements to plan 42-02.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`cd backend/api && npm run test:rls` could not be run to full completion in this sandboxed worktree — it fails at `test/setup.ts` with `Missing required env var: SUPABASE_URL` before any RLS-specific test code executes, because no `.env.test` file exists in this environment. This failure is unrelated to the two migration files created in this plan (no `backend/api/` files were touched, and the failure occurs before the `RUN_DB` skip-guard in individual spec files is even evaluated). The two automated verify commands specified in the plan's Task 1 and Task 2 `<verify>` blocks both ran successfully and printed `OK`. The migration-only static checks in `<verification>` (filename sort order, absence of GRANT/REVOKE, clean `git status --porcelain`) all passed. Recommend the orchestrator or a follow-up session confirm `test:rls` passes in an environment with `.env.test` configured before Phase 43 begins.

## User Setup Required

None - no external service configuration required for this plan. (A `.env.test` with real Supabase test-project credentials will be needed to run `backend/api/test/rls/*` locally, but that is a pre-existing environment requirement, not something this plan introduced.)

## Next Phase Readiness

Both tables are live in the migration set with the exact interface (column names, types, constraints, index names) that plan 42-02's `record_athlete_decision()` RPC and plan 42-03's RLS specs depend on. No write path exists yet (by design) — plan 42-02 adds the SECURITY DEFINER RPC and the consolidated GRANT/REVOKE lockdown. No rows are written by this phase; zero application code depends on these tables yet.

---
*Phase: 42-decision-system-foundation*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260831120000_athlete_state.sql
- FOUND: supabase/migrations/20260831120100_athlete_decisions.sql
- FOUND: .planning/workstreams/milestone-mobile/phases/42-decision-system-foundation/42-01-SUMMARY.md
- FOUND: commit 27495951 (Task 1)
- FOUND: commit 32a7db4b (Task 2)
- FOUND: commit 655fd79e (SUMMARY commit)
