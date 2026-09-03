---
phase: 44-weekly-adaptive-decision-engine
plan: 03
subsystem: api
tags: [ai-sdk-v6, generateobject, anthropic, zod, supabase-rpc, tool-executor]

# Dependency graph
requires:
  - phase: 44-weekly-adaptive-decision-engine (plan 44-02)
    provides: "fetchWeeklyReviewContext(), FOCUS_SOURCE_MAP, WeeklyReviewContext/WeeklyDecisionResult types"
  - phase: 44-weekly-adaptive-decision-engine (plan 44-01)
    provides: "10-arg record_athlete_decision() RPC with p_new_goal, athlete_goals table"
provides:
  - "decideWeeklyFocus() — single-shot generateObject weekly trajectory decision (escalate/hold/de-escalate)"
  - "create_goal / create_program tool executors + coachingEngineToolSchemas, ready for registry.ts registration"
affects: [44-04-apply-and-idempotency, 44-05-routes-and-cron, 44-06-rls-and-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anthropic JSON Schema sanitizer (stripUnsupportedKeywords/anthropicSchema) copied verbatim per-module rather than shared, matching onboarding-retroactive.ts/coach-voice/coach-imports convention"
    - "normaliseSource() shared helper enforcing the athlete_decisions.source CHECK constraint at the TS boundary before the RPC ever sees an invalid value"
    - "buildRealEvidence() re-derives server-side evidence per tool call, discarding any model-supplied evidence field"

key-files:
  created:
    - backend/api/src/coaching-engine/decide.ts
    - backend/api/src/coaching-engine/tools.ts
  modified:
    - backend/api/test/tools/coaching-engine.spec.ts

key-decisions:
  - "Dynamic (not static top-level) imports for decide.js/tools.js in the new spec describe blocks, so Task 1's RED state doesn't break the already-passing activity-aggregation block from plan 44-02 when filtering with -t"
  - "create_goal/create_program both send p_week_of: null — goals and programs are not week-scoped and must never touch the weekly_focus idempotency arbiter"
  - "D-11 enforced defensively in code (not just via system prompt): decideWeeklyFocus() forces call_create_program=false and new_focus_detail=null whenever trajectory is hold, regardless of what the model returned"

patterns-established:
  - "Pattern: any new generateObject call in this backend must copy the ANTHROPIC_BANNED_KEYWORDS/stripUnsupportedKeywords/anthropicSchema trio verbatim rather than import it — this is now the third instance of the pattern (voice, imports/parse, and now coaching-engine/decide.ts)"

requirements-completed: [ENGINE-02, ENGINE-03, ENGINE-06]

# Metrics
duration: 8min
completed: 2026-09-03
---

# Phase 44 Plan 03: Weekly Decision Call + Goal/Program Tools Summary

**Single-shot `generateObject` weekly trajectory decision (escalate/hold/de-escalate) plus `create_goal`/`create_program` tool executors that write through `record_athlete_decision()` with server-derived athlete id and server-derived evidence.**

## Performance

- **Duration:** ~8 min (measured from first task commit to last)
- **Started:** 2026-09-03T22:12:12+02:00
- **Completed:** 2026-09-03T22:19:41+02:00
- **Tasks:** 3
- **Files modified:** 3 (1 test file extended, 2 new source files)

## Accomplishments

- `decide.ts` ships `WEEKLY_DECISION_SCHEMA` (Anthropic-sanitized), `WEEKLY_REVIEW_SYSTEM_PROMPT`, `buildWeeklyReviewPrompt()`, and `decideWeeklyFocus()` — exactly one `generateObject` call per review, no tool-calling loop, real token usage returned for plan 44-04's `ai_cost_log` write
- D-04/D-05/D-06/D-11 locked into the system prompt text (fast escalate, slow de-escalate gated on `pattern_of_misses`, AI discretion to hold, `call_create_program` restricted to escalate/de-escalate) and D-11 additionally enforced defensively in code
- `tools.ts` ships `create_goal` and `create_program` executors plus `coachingEngineToolSchemas`, both writing exclusively through the 10-arg `record_athlete_decision()` RPC with athlete id bound to the `userId` function argument (never `params.user_id`) and evidence re-derived server-side via `buildRealEvidence()` (never `params.evidence`)
- `create_program` merges its new targets over the athlete's existing `current_focus_detail` so the RPC's wholesale JSONB replacement can never orphan `goal_id`
- Both executors always send `p_rationale` and `p_source` (fixed-string rationale fallback + `normaliseSource()` enum guard) since neither has a database default and PostgREST cannot resolve the 10-arg signature otherwise

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing specs for the decision schema and the two tool executors** - `121b92fb` (test)
2. **Task 2: decide.ts — single-shot generateObject weekly decision** - `3d1de7ea` (feat)
3. **Task 3: tools.ts — create_goal and create_program executors + schemas** - `894b26e5` (feat)

_TDD gate sequence verified: test(121b92fb) → feat(3d1de7ea) → feat(894b26e5), no failing tests left behind._

## Files Created/Modified

- `backend/api/src/coaching-engine/decide.ts` - Anthropic schema sanitizer, `WEEKLY_DECISION_SCHEMA`, `WEEKLY_REVIEW_SYSTEM_PROMPT`, `buildWeeklyReviewPrompt()`, `decideWeeklyFocus()`
- `backend/api/src/coaching-engine/tools.ts` - `buildRealEvidence()`, `normaliseSource()`, `create_goal`, `create_program`, `coachingEngineToolSchemas`
- `backend/api/test/tools/coaching-engine.spec.ts` - added `decision schema` (ENGINE-02) and `goal and program tools` (ENGINE-06) describe blocks; `activity aggregation` block from plan 44-02 untouched

## Decisions Made

- Used dynamic `import()` inside each new describe block's `beforeEach` (rather than a static top-level import) for `decide.js`/`tools.js`, so that Task 1's intentional RED state (missing modules) doesn't break Vitest's module collection for the whole file — this let `-t "activity aggregation"` keep passing throughout Task 1, satisfying that task's explicit acceptance criterion.
- Mocked `@ai-sdk/provider-utils`'s `zodSchema()` to return a realistic raw JSON Schema carrying all eleven Anthropic-banned keywords (rather than an empty object, as the sibling `retroactive-recompute.spec.ts` does), so the banned-keyword regression-guard test genuinely exercises `decide.ts`'s own `stripUnsupportedKeywords` copy instead of trivially passing against nothing.

## Deviations from Plan

None — plan executed exactly as written. All eleven Task 1 assertions, both tools' security invariants (T-44-10/T-44-11/T-44-12/T-44-13/T-44-15), and every grep-based acceptance criterion in the plan were satisfied without needing to diverge from the specified action text.

## Issues Encountered

- `backend/api/test/setup.ts` requires real `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars to even load the test file, even for pure-mock unit specs that never touch a live database — this is the same pre-existing `.env.test` gap noted in the prior wave-1 tracking commit (`b7953c3f`), not something introduced by this plan. Populated a local-only, gitignored `backend/api/.env.test` with placeholder values (never committed) purely to satisfy the presence check and unblock this worktree's own test runs.
- Running the fuller `backend/api` test suite (excluding `test/rls/**`) with those same placeholder credentials surfaces `fetch failed` errors in unrelated `test/coach/*.spec.ts` integration tests that create real Supabase test users — expected given the placeholder URL, out of scope for this plan (Rule scope boundary: pre-existing, unrelated files), and not a regression introduced here. `test/tools/coaching-engine.spec.ts` itself passes 24/24.

## User Setup Required

None - no external service configuration required. (Real Supabase credentials in `backend/api/.env.test` are needed for the pre-existing `test/coach/*` and `test/rls/*` integration suites to pass in this or any other worktree, but that requirement predates this plan.)

## Next Phase Readiness

- `decideWeeklyFocus()` and `create_goal`/`create_program` are ready for plan 44-04's `apply.ts` to call directly (shared deterministic write path) and for plan 44-05's `registry.ts` registration (both executors + `coachingEngineToolSchemas` spread into `allToolSchemas`, per 44-PATTERNS.md's dual-registration note).
- No blockers. `npx tsc --noEmit` is clean and `npx vitest run test/tools/coaching-engine.spec.ts` is fully green (24/24).

---
*Phase: 44-weekly-adaptive-decision-engine*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: `backend/api/src/coaching-engine/decide.ts`
- FOUND: `backend/api/src/coaching-engine/tools.ts`
- FOUND: `backend/api/test/tools/coaching-engine.spec.ts`
- FOUND: `.planning/workstreams/milestone-mobile/phases/44-weekly-adaptive-decision-engine/44-03-SUMMARY.md`
- FOUND commit: `121b92fb`
- FOUND commit: `3d1de7ea`
- FOUND commit: `894b26e5`
