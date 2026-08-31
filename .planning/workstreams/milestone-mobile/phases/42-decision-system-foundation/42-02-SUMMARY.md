---
phase: 42-decision-system-foundation
plan: 02
subsystem: database
tags: [postgres, supabase, rpc, security-definer, grant-revoke, athlete-state, ai-decision-journal]

# Dependency graph
requires: ["42-01"]
provides:
  - "public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) RETURNS JSONB — the sole write path to athlete_state and athlete_decisions"
  - "Full GRANT/REVOKE lockdown: EXECUTE restricted to service_role; INSERT/UPDATE/DELETE revoked from authenticated AND service_role on both tables"
affects: [42-03-decision-system-foundation-verification, 43-onboarding, 44-weekly-decision-engine, 45-rewards, 46-feature-gating, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC as the sole write gate, modeled on grant_premium_credits (guard-first, error-shaped JSONB return, GET DIAGNOSTICS idempotency)"
    - "Table-level REVOKE from both authenticated AND service_role — first instance in this codebase revoking from service_role, since BYPASSRLS does not exempt it from GRANT checks"
    - "GREATEST(current, incoming) monotonic ratchet for points/tier; level intentionally exempt for de-escalation support"

key-files:
  created:
    - supabase/migrations/20260831120200_athlete_decisions_rpc.sql
  modified: []

key-decisions:
  - "points and tier use GREATEST(current, incoming) ratchet — can never decrease through this RPC (REWARD-04)"
  - "level uses plain COALESCE, no ratchet — Phase 44's weekly engine must be able to de-escalate (ENGINE-03); the level >= 1 CHECK is the only floor"
  - "last_review_at/next_review_due_at only advance when p_decision_type = 'weekly_focus' — other decision types (onboarding, reward grant) never reset the review clock"
  - "REVOKE widened beyond D-06's stated minimum: all three write verbs (INSERT, UPDATE, DELETE) revoked on BOTH tables from BOTH authenticated and service_role, per D-06's 'only code path capable of writing either table' framing and D-07's no-carve-out rule"
  - "SELECT deliberately left untouched on both tables — RLS SELECT-own policies from 42-01 remain the read path; service_role needs SELECT for Phase 46's gating reader and Phase 47's context query"

patterns-established:
  - "Single SECURITY DEFINER RPC atomically inserts the journal row then patches the state row, self-healing a missing parent row via INSERT ... ON CONFLICT (user_id) DO NOTHING — the pattern every Phase 43-45 tool executor will call, never a direct table write"

requirements-completed: [FOUND-02, FOUND-03, FOUND-04]

# Metrics
duration: 15min
completed: 2026-08-31
---

# Phase 42 Plan 02: Decision-System Foundation RPC Summary

**`public.record_athlete_decision()` — a SECURITY DEFINER RPC that atomically journals a decision and patches athlete state, paired with DB-level GRANT/REVOKE lockdown that makes it literally the only write path to either table, for every role including `service_role`.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-31T14:24:05Z (continuing from 42-01 completion)
- **Completed:** 2026-08-31T14:39:22Z
- **Tasks:** 1
- **Files modified:** 1 created (migration) + 1 created (this summary)

## Accomplishments

- `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` — `record_athlete_decision()` RPC with evidence guard, idempotent journal insert, state self-heal, ratcheted `points`/`tier`, weekly-only review-clock advance, and the full role-named EXECUTE + table-write lockdown
- Automated verify script from the plan's Task 1 printed `OK`
- Static checks passed: only one new migration file, sorts after both 42-01 files, every REVOKE names roles explicitly, no `REVOKE` mentions `SELECT` or names `postgres`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the record_athlete_decision() RPC migration** - `ab0d5682` (feat)

**Plan metadata:** (this summary commit, made by the orchestrator after wave merge)

## Files Created/Modified

- `supabase/migrations/20260831120200_athlete_decisions_rpc.sql` — `record_athlete_decision()` function + `COMMENT ON FUNCTION` + EXECUTE lockdown + table write lockdown

## Final RPC Signature

```sql
public.record_athlete_decision(
  p_user_id       UUID,
  p_decision_type TEXT,
  p_week_of       DATE,
  p_summary       TEXT,
  p_rationale     TEXT,
  p_evidence      JSONB,   -- required; no default; guarded as the first statement
  p_outcome       JSONB,
  p_source        TEXT,
  p_state_patch   JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
```

Signature type list used in every REVOKE/GRANT on this function:
`(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB)`

## Return Shapes

| Shape | When |
|-------|------|
| `{ "success": false, "error": "evidence_required" }` | `p_evidence` is `NULL` or not a JSONB object |
| `{ "success": false, "error": "duplicate" }` | A `weekly_focus` decision already exists for that athlete/week — state patch is NOT re-applied |
| `{ "success": true, "decision_id": "<uuid>" }` | Recorded and state patched |

## Recognised `p_state_patch` Keys (any subset; absent key = column unchanged)

`level`, `points`, `tier`, `readiness`, `status`, `current_focus_summary`, `current_focus_detail`, `onboarding_profile`, `rolling_summary`

- `current_focus_detail` and `onboarding_profile` use the `->` JSONB arrow (preserve JSONB type)
- All other keys use `->>` (text extraction, then cast where needed for `level`/`points`/`tier`)

## Ratchet / Exemption Decision — points/tier vs. level

- **`points`/`tier`:** `GREATEST(current, COALESCE(incoming, current))` — monotonic ratchet, can never decrease through this RPC. Enforces REWARD-04 ("unlocked tiers/points never revoked or decreased") at the only DB layer point this invariant can be guaranteed.
- **`level`:** plain `COALESCE(incoming, current)`, NO `GREATEST` guard. ENGINE-03 explicitly requires Phase 44's weekly engine to be able to de-escalate as well as escalate. The `level >= 1` CHECK constraint on the column is the only floor.
- **`last_review_at`/`next_review_due_at`:** only advanced (`NOW()` / `NOW() + INTERVAL '7 days'`) when `p_decision_type = 'weekly_focus'`; left untouched for any other decision type so an onboarding or reward-grant call never resets the weekly review clock.

## Exact REVOKE/GRANT Statement List

```sql
REVOKE EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_athlete_decision(UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.athlete_state FROM authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.athlete_decisions FROM authenticated, service_role;
```

`SELECT` is untouched on both tables (RLS SELECT-own policies from 42-01 remain the read path; `service_role` needs `SELECT` for Phase 46/47). No `REVOKE` in the file names the `postgres`/migration-runner role.

## Decisions Made

None beyond what the plan already specified — plan executed exactly as written, including the deliberate widening of the REVOKE list to all three write verbs on both tables/both roles (D-06's stated purpose + D-07's no-carve-out rule, as instructed by the plan's Task 1 action text).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`cd backend/api && npm run test:rls` fails in this sandboxed worktree with `Missing required env var: SUPABASE_URL` at `test/setup.ts`, before any RLS-specific test code executes — identical pre-existing environment gap already documented in 42-01-SUMMARY.md (no `.env.test` file configured in this environment). This failure is unrelated to the migration file created in this plan: it occurs before any spec file's `RUN_DB` skip-guard is evaluated, and no `backend/api/` source files were touched by this plan. The automated verify command specified in the plan's Task 1 `<verify>` block ran successfully and printed `OK`. All migration-only static checks in `<verification>` (single new file, correct sort order, explicit role-naming in every REVOKE) passed. Recommend the orchestrator or a follow-up session confirm `test:rls` passes in an environment with `.env.test` configured before Phase 43 begins — this is the same outstanding recommendation carried from plan 42-01.

## User Setup Required

None - no external service configuration required for this plan. (A `.env.test` with real Supabase test-project credentials will be needed to run `backend/api/test/rls/*` locally, but that is a pre-existing environment requirement carried from plan 42-01, not something this plan introduced.)

## Next Phase Readiness

`record_athlete_decision()` is live in the migration set with the exact signature, return shapes, and `p_state_patch` key contract that plan 42-03's RLS/RPC verification specs and Phase 43's onboarding tool executor depend on. No caller exists yet (by design — Phase 42 ships schema/RPC/RLS only). Both tables are now fully locked down at the GRANT layer: the SELECT-only RLS from 42-01 plus this plan's table-level REVOKE together mean no client of any kind, including a service-role-keyed backend script, can write either table outside this RPC.

---
*Phase: 42-decision-system-foundation*
*Completed: 2026-08-31*
