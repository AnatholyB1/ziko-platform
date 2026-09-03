---
phase: 44-weekly-adaptive-decision-engine
plan: 02
subsystem: api
tags: [supabase, vitest, coaching-engine, weekly-review, backend]

# Dependency graph
requires:
  - phase: 43-conversational-onboarding
    provides: athlete_state / athlete_decisions schema, onboarding-retroactive.ts aggregation convention
provides:
  - "coaching-engine/db.ts client factory re-export"
  - "coaching-engine/types.ts full contract (FocusType, FocusTarget, FocusScopedActivity, FocusComparison, RecentDecision, WeeklyReviewContext, WeeklyDecisionResult)"
  - "coaching-engine/context.ts: FOCUS_SOURCE_MAP (D-08), fetchFocusScopedActivity, fetchWeeklyReviewContext"
  - "ENGINE-01 activity-aggregation test suite (11 passing tests)"
affects: [44-03-decide, 44-04-apply, 44-05, 44-06, weekly-review-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-08 closed-set focus->table mapping (FOCUS_SOURCE_MAP) — table names never interpolated from athlete-supplied JSONB"
    - "weekOf captured from athlete_state.next_review_due_at at read time, never from Date.now()/new Date()/CURRENT_DATE, to keep cron and lazy on-open triggers idempotent for the same review cycle"
    - "Raw bounded-window read (12 rows) filtered by decision_type before slicing to the last 3, so interleaved program_created/goal_created rows never dilute the weekly_focus miss-pattern signal"

key-files:
  created:
    - backend/api/src/coaching-engine/db.ts
    - backend/api/src/coaching-engine/types.ts
    - backend/api/src/coaching-engine/context.ts
    - backend/api/test/tools/coaching-engine.spec.ts
  modified: []

key-decisions:
  - "D-07: met is true only on exact-or-exceed (actual_value >= target_value); a missing target yields met: null, never false"
  - "D-08: FOCUS_SOURCE_MAP is a closed set of 6 focus types + 'unassigned' fallback (workout_sessions + habit_logs), never a fixed default source"
  - "D-05: pattern_of_misses is 2-of-last-3 real weekly_focus decisions, read from a raw 12-row athlete_decisions window (not the 4-row prompt-facing recentDecisions slice) so interleaved program_created/goal_created rows can't starve the signal — flagged [ASSUMED] per 44-RESEARCH.md Open Question 2"
  - "training_volume focus additionally queries session_sets (joined via already-user-scoped session ids, since session_sets has no user_id column) only when target_metric is sets_completed"

requirements-completed: [ENGINE-01, ENGINE-03]

# Metrics
duration: ~25min (Task 1-2 executed in prior session ~23:17-23:25; Task 3 in this continuation session)
completed: 2026-09-03
---

# Phase 44 Plan 02: Coaching-Engine Foundation + Focus-Scoped Activity Aggregation Summary

**`coaching-engine/context.ts` builds a grounded weekly-review context from real Supabase rows: a closed-set focus->table mapping (D-08), a backend-computed exact-or-exceed met verdict (D-07), and a 2-of-last-3 weekly_focus miss-pattern signal (D-05) — all with `weekOf` captured from `next_review_due_at`, never the system clock.**

## Performance

- **Duration:** ~25 min total across two sessions (Task 1-2 in a prior session that stalled after committing Task 2; Task 3 completed in this continuation)
- **Completed:** 2026-09-03T21:45:04+02:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 4 (3 created in `coaching-engine/`, 1 test file)

## Accomplishments
- `coaching-engine/db.ts` re-exports the single shared `clientForUser` factory (no second `createClient` call)
- `coaching-engine/types.ts` declares the full seven-type contract every later plan in Phase 44 (44-03 through 44-06) compiles against
- `coaching-engine/context.ts` implements `FOCUS_SOURCE_MAP`, `fetchFocusScopedActivity`, and `fetchWeeklyReviewContext` per the plan's D-07/D-08/D-05 design
- ENGINE-01 activity-aggregation test suite: 11/11 passing, covering per-focus table isolation, exact/exceed/near-miss met verdicts, the habit/journal date-union metric, the unassigned fallback, the miss-pattern 2-of-3 rule (including the interleaved-rows edge case), and the weekOf wall-clock-independence check

## Task Commits

Each task was committed atomically:

1. **Task 1: coaching-engine/db.ts + types.ts — module contracts** - `f9afec8d` (feat)
2. **Task 2: Failing spec for focus-scoped activity aggregation (ENGINE-01)** - `73bce4f9` (test — RED state, `context.ts` did not exist yet)
3. **Task 3: context.ts — D-08 focus-scoped aggregation and the D-07 met verdict** - `d3f0971e` (feat — GREEN state, makes the Task 2 suite pass)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified
- `backend/api/src/coaching-engine/db.ts` - re-exports `clientForUser` from `../tools/db.js`
- `backend/api/src/coaching-engine/types.ts` - `FocusType`, `FocusTarget`, `FocusScopedActivity`, `FocusComparison`, `RecentDecision`, `WeeklyReviewContext`, `WeeklyDecisionResult`
- `backend/api/src/coaching-engine/context.ts` - `FOCUS_SOURCE_MAP`, `fetchFocusScopedActivity`, `fetchWeeklyReviewContext`
- `backend/api/test/tools/coaching-engine.spec.ts` - ENGINE-01 activity-aggregation suite (11 tests)

## Decisions Made
- Implemented Task 3 exactly per the plan's already-locked D-07/D-08/D-05 design — no deviation from the finalized focus->table mapping, met-verdict arithmetic, or miss-pattern window.
- `sets_completed` target metric triggers an additional `session_sets` read (joined via already-user-scoped session ids from the `workout_sessions` fetch, since `session_sets` has no `user_id` column) — this path is specified in the plan's action text but not directly exercised by the Task 2 test suite; it compiles and follows the same reduce-to-counts convention as every other branch.
- Default window-start fallback (`last_review_at ?? next_review_due_at - 7 days`) uses `new Date(<expr>).getTime()` with a non-empty argument, which does not match the plan's banned literal `new Date()` (empty-parens, wall-clock-now) pattern — verified via the acceptance-criteria grep, which returned 0 matches.

## Deviations from Plan

None - plan executed exactly as written. Task 3's implementation follows the action text's per-focus-type branch behavior, the weekOf-capture-before-anything-else discipline, the raw-12-row/sliced-4-row decision read, and the [ASSUMED] 2-of-3 miss-pattern comment verbatim.

## Issues Encountered

The previous execution session stalled (600s no progress, watchdog killed it) immediately after committing Task 2 (`73bce4f9`), apparently while starting Task 3's implementation — no partial/uncommitted work was left behind (working tree was clean on resume). This continuation session verified the prior two commits, read Task 3's full spec plus the existing `types.ts`/`db.ts`/spec file/`onboarding-retroactive.ts` analog, implemented `context.ts`, and confirmed all automated verification (vitest suite, `tsc --noEmit`, and all five acceptance-criteria grep checks) before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `fetchWeeklyReviewContext` and `fetchFocusScopedActivity` are ready for plan 44-03 (`decide.ts` — the `generateObject` call consuming `WeeklyReviewContext`) and plan 44-04 (`apply.ts` — writing `WeeklyDecisionResult` back via `record_athlete_decision`, which needs the `weekOf` this plan captures).
- No blockers. The `unassigned` fallback and `met: null` guard are in place so plan 44-03's prompt can safely refuse to de-escalate on a null verdict (ENGINE-03 guard-rail requirement).

---
*Phase: 44-weekly-adaptive-decision-engine*
*Completed: 2026-09-03*

## Self-Check: PASSED

All created files verified present (`db.ts`, `types.ts`, `context.ts`, `coaching-engine.spec.ts`, this SUMMARY.md) and all three task commit hashes (`f9afec8d`, `73bce4f9`, `d3f0971e`) verified present in `git log --oneline --all`.
