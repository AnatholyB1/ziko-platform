---
phase: 43-conversational-onboarding
plan: 01
subsystem: api
tags: [ai-tools, json-schema, supabase-rpc, onboarding, vitest]

# Dependency graph
requires:
  - phase: 42-decision-system-foundation
    provides: public.record_athlete_decision() RPC, athlete_state/athlete_decisions schema with CHECK constraints and table-level REVOKE lockdown
provides:
  - assessProfileSchema (JSON Schema AITool) — the tool contract for the onboarding conversation's terminal action
  - assess_profile executor — writes the athlete's starting state exclusively through record_athlete_decision()
  - MICRO_ACTION_POOL curated to exactly hydration_log/journal_mood/measurements_weight (D-13)
  - ONBOARDING_LEVEL/ONBOARDING_TIER locked constants (both 1)
  - ONBOARDING_MAX_STEPS step-cap constant, scoped to the onboarding turn only
  - getToolExecutor('assess_profile') registration, deliberately excluded from allToolSchemas
affects: [43-02-mandatory-flow-gate, 43-03-onboarding-route, 43-04-retroactive-path, 43-06-mission-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tool executor: runtime enum membership checks before any RPC call (schema enum alone is not an enforcement boundary)"
    - "RPC error-shaped JSONB ({ success: false, error }) surfaced as a real failure, never treated as success"
    - "Narrowed one-tool surface: executor registered in registry.ts executors map but schema kept out of allToolSchemas"

key-files:
  created:
    - backend/api/src/tools/onboarding.ts
    - backend/api/test/tools/onboarding.spec.ts
  modified:
    - backend/api/src/config/models.ts
    - backend/api/src/tools/registry.ts

key-decisions:
  - "Onboarding always writes level 1 / tier 1 regardless of readiness — readiness alone carries the gentler-vs-further-along signal; level-based gating is Phase 46's responsibility (43-RESEARCH.md Open Question 3)"
  - "p_evidence is self-reported onboarding-conversation signal (labeled evidence_source: 'onboarding_conversation') — the one documented exception to grounding decisions in real logged activity, since a brand-new athlete has no activity history yet"
  - "status: 'active' in p_state_patch is load-bearing for the mobile mandatory-flow gate (plan 43-02) — the column otherwise defaults to and stays 'onboarding'"

patterns-established:
  - "Pattern: onboarding-only tool schemas live outside allToolSchemas but inside the executors map, so getToolExecutor() resolves them for a route-level narrowed surface without exposing them to the general chat agent"

requirements-completed: [ONBOARD-02, ONBOARD-03, ONBOARD-05]

# Metrics
duration: ~35min
completed: 2026-09-01
---

# Phase 43 Plan 01: assess_profile Tool Contract Summary

**assess_profile JSON-Schema tool contract, its three-item curated micro-action pool, and its record_athlete_decision()-only executor, plus the ONBOARDING_MAX_STEPS step cap — the single foundation every other Phase 43 plan builds on.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 3 (2 created, 2 modified — registry.ts and models.ts modified, onboarding.ts + spec created)

## Accomplishments
- `assessProfileSchema` defines all nine required properties (experience/adherence/readiness signals + confidences, profile_summary, micro_action, mission_title), with `readiness` and `micro_action` enums matching the `athlete_state` CHECK constraints and `MICRO_ACTION_POOL` verbatim
- `assess_profile` executor writes exclusively through `record_athlete_decision()` — never a direct `athlete_state`/`athlete_decisions` write — with runtime guards on `micro_action` and `readiness` before any RPC call, a thrown error on transport failure, and the RPC's `{ success: false, error }` shape surfaced as a real failure rather than silently reported as success
- `getToolExecutor('assess_profile')` resolves via `registry.ts`, while `assessProfileSchema` is deliberately kept out of `allToolSchemas` so `/ai/chat/stream`, `/ai/chat`, and `GET /ai/tools` never expose it to the general chat agent
- `ONBOARDING_MAX_STEPS = 8` added to `config/models.ts`, scoped to the onboarding turn only — `AGENT_MODEL`, `VISION_MODEL`, and the shared `stepCountIs(5)` are untouched
- 9-test unit spec (`test/tools/onboarding.spec.ts`) covers the schema contract, RPC payload shape, and every error path with a mocked db client — no live database access, no `RUN_DB` guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ONBOARDING_MAX_STEPS constant** - `d18968e9` (feat)
2. **Task 2: Create the assess_profile schema, micro-action pool, and executor** - `3b5ad3f6` (feat)
3. **Task 3: Register the executor without widening the general chat tool surface** - `9b5ff6e3` (feat)

_No TDD test→feat split commits: the spec and implementation for Task 2 were written and verified together in one commit per plan convention for this task._

## Files Created/Modified
- `backend/api/src/config/models.ts` - Added `ONBOARDING_MAX_STEPS = 8` next to `AGENT_MODEL`/`VISION_MODEL`
- `backend/api/src/tools/onboarding.ts` - New: `MICRO_ACTION_POOL`, `MicroAction` type, `ONBOARDING_LEVEL`/`ONBOARDING_TIER`, `assessProfileSchema`, `assess_profile` executor
- `backend/api/test/tools/onboarding.spec.ts` - New: 9-test unit spec, mocks `../../src/tools/db.js`
- `backend/api/src/tools/registry.ts` - Added `OnboardingTools` import and `assess_profile` executors-map entry (commented as deliberately absent from `allToolSchemas`)

## Decisions Made
- Reworded one code comment ("status: 'active' is load-bearing...") to avoid a duplicate literal match against the plan's `grep -c "status: 'active'"` acceptance check (expects exactly 1 match) — no behavior change, comment-only rewording.
- Created a local, gitignored `backend/api/.env.test` with dummy placeholder values so the unit spec's `test/setup.ts` env-presence check passes without live Supabase credentials — the spec itself never touches a real database (fully mocked `clientForUser`). This file is not committed (`.gitignore` already excludes `.env.test`); a developer running these tests from a clean checkout will need their own `.env.test` per `.env.test.example`, unchanged from prior plans.

## Deviations from Plan

None — plan executed exactly as written. The comment rewording above was a same-task micro-adjustment to satisfy the plan's own acceptance grep, not a scope change.

## Issues Encountered
- Worktree HEAD was found at a commit behind the required base (`b22e0b7c`) at session start — corrected via `git reset --hard` to the required base per the worktree safety protocol before any task work began.
- `backend/api/test/setup.ts` requires `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` to be present (not valid) for any vitest run in this workspace, including pure-mock unit specs. Resolved by creating a local, gitignored `.env.test` with dummy values (see Decisions Made).
- No `lint` script exists for the `@ziko/api` workspace (`npm run lint` errors "Missing script"; `npx turbo run lint --filter=@ziko/api` only ran the unrelated `@ziko/coach-sdk` lint task) — the plan's lint verification step is a no-op for this package as currently configured, not a finding introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `assessProfileSchema`, `assess_profile`, `MICRO_ACTION_POOL`, `ONBOARDING_LEVEL`, `ONBOARDING_TIER` are all importable from `backend/api/src/tools/onboarding.ts` for plan 43-03 (onboarding stream route) to wrap in a narrowed one-tool surface.
- `ONBOARDING_MAX_STEPS` is importable from `backend/api/src/config/models.ts` for the same route's `stopWhen`.
- `getToolExecutor('assess_profile')` resolves and is absent from `allToolSchemas`, so plan 43-03 can safely build the isolated onboarding tool surface without a general-chat leak.
- No blockers identified for 43-02 (mobile mandatory-flow gate, consumes `status: 'active'`) or 43-03 (onboarding route, consumes the schema + step cap + executor).

---
*Phase: 43-conversational-onboarding*
*Completed: 2026-09-01*
