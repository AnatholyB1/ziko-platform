---
phase: 42-decision-system-foundation
plan: 03
subsystem: testing
tags: [vitest, rls, supabase, integration-tests, athlete-state, ai-decision-journal]

# Dependency graph
requires:
  - phase: 42-01
    provides: "public.athlete_state and public.athlete_decisions tables with SELECT-only RLS"
  - phase: 42-02
    provides: "public.record_athlete_decision() RPC and the full GRANT/REVOKE lockdown both specs assert against"
provides:
  - "backend/api/test/rls/athlete-state.spec.ts — executable proof of FOUND-01/03/04 (own-read, cross-read-denied, authenticated-write-blocked, service-role-write-blocked, RPC role matrix, self-heal, ratchet, weekly idempotency)"
  - "backend/api/test/rls/athlete-decisions.spec.ts — executable proof of FOUND-02 (evidence-mandatory, append-only immutability for both authenticated and service_role)"
affects: [42-04-decision-system-foundation-migration-push, 43-onboarding, 44-weekly-decision-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC-only seeding in RLS specs — admin.from(table).insert() is unavailable once table-level REVOKE is in force, so every fixture row in both spec files is created via admin.rpc('record_athlete_decision', ...)"
    - "RUN_DB guard + describe.skipIf(!RUN_DB) copied verbatim from premium-grant-rpc.spec.ts, so both new spec files skip cleanly in every environment lacking a real Supabase test project"

key-files:
  created:
    - backend/api/test/rls/athlete-state.spec.ts
    - backend/api/test/rls/athlete-decisions.spec.ts
  modified: []

key-decisions:
  - "backend/api/test/rls/fixtures.ts left untouched — every fixture needed (getAdminClient/getAnonClient/createTestUser/cleanupTestUsers) already existed, confirmed by git diff --stat being empty for that file"
  - "Ratchet and idempotency tests each use a single dedicated test user with two sequential RPC calls inside the same it() block, rather than depending on execution order across separate tests, so each test is independently runnable"

patterns-established:
  - "seedState()/seed-via-RPC helper pattern for RLS specs against RPC-locked tables — any future spec touching athlete_state/athlete_decisions must seed through record_athlete_decision(), never a direct table insert"

requirements-completed: [FOUND-01, FOUND-02, FOUND-03, FOUND-04]

# Metrics
duration: 18min
completed: 2026-08-31
---

# Phase 42 Plan 03: RLS Verification Specs for the Decision-System Foundation Summary

**Two new Vitest RLS integration specs (`athlete-state.spec.ts`, `athlete-decisions.spec.ts`) — 19 tests total — that prove the phase's schema-layer security claims (SELECT-only RLS, RPC-only write path, mandatory grounding evidence, append-only immutability) are real database behavior, not just SQL text; every seed row in both files is created exclusively through `record_athlete_decision()` since direct table inserts are revoked.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-31T20:05:00Z
- **Completed:** 2026-08-31T20:23:00Z
- **Tasks:** 2
- **Files modified:** 2 created (spec files) + 1 created (this summary)

## Accomplishments

- `backend/api/test/rls/athlete-state.spec.ts` — 10 tests covering own-read, cross-read-denied, authenticated-write-blocked, service-role-write-blocked (UPDATE and INSERT), the anon/authenticated/admin RPC role matrix, the SECURITY-DEFINER-owner smoke test, self-heal, the points/tier ratchet with level exempt, and weekly idempotency
- `backend/api/test/rls/athlete-decisions.spec.ts` — 9 tests covering the evidence contract (null and non-object evidence rejected, each proving no journal row was written), the happy-path round-trip, own-read/cross-read, and append-only immutability against both the admin and authenticated clients (INSERT/UPDATE/DELETE all blocked)
- `backend/api/test/rls/fixtures.ts` left completely unmodified — confirmed via `git diff --stat`
- Both automated verify scripts from the plan's Task 1 and Task 2 printed `OK`
- `npx tsc --noEmit` in `backend/api/` exits 0 — both new spec files type-check cleanly against the live Supabase JS client types

## Task Commits

Each task was committed atomically:

1. **Task 1: Write athlete-state.spec.ts (RLS reads + write lockdown + RPC role matrix)** - `85ce4a51` (test)
2. **Task 2: Write athlete-decisions.spec.ts (evidence contract + append-only immutability)** - `6a296569` (test)

**Plan metadata:** (this summary commit, made by the orchestrator after wave merge)

## Files Created/Modified

- `backend/api/test/rls/athlete-state.spec.ts` - 10 tests: own-read, cross-read, authenticated-write-blocked, service-role UPDATE/INSERT-blocked, anon/authenticated/admin RPC matrix, owner smoke test, self-heal, ratchet, weekly idempotency
- `backend/api/test/rls/athlete-decisions.spec.ts` - 9 tests: evidence-required (null, array), happy-path round-trip, own-read, cross-read, admin INSERT/UPDATE/DELETE blocked, authenticated INSERT/UPDATE/DELETE blocked

### Full list of test titles — `athlete-state.spec.ts`

1. `athlete reads own athlete_state row after seeding, with schema-default readiness/level (D-01/D-02, FOUND-01, reads own)`
2. `cross-read: athlete A selects athlete B's athlete_state row → RLS silently filters, 0 rows (FOUND-04)`
3. `authenticated client cannot UPDATE athlete_state directly (FOUND-03)`
4. `service-role (admin) client also cannot UPDATE athlete_state directly (D-06, FOUND-03, the load-bearing case — cannot UPDATE)`
5. `service-role (admin) client also cannot INSERT athlete_state directly (D-06, FOUND-03)`
6. `RPC role matrix: anon and authenticated are denied EXECUTE, admin succeeds (D-06, FOUND-03)`
7. `RPC still works after the REVOKEs — SECURITY DEFINER owner smoke test (D-06, FOUND-03, FOUND-04)`
8. `self-heal: the first RPC call for a brand-new user creates the athlete_state row (FOUND-01, reads own)`
9. `ratchet: points/tier never decrease across two RPC calls, level is exempt and can de-escalate (REWARD-04, ENGINE-03)`
10. `weekly idempotency: a second weekly_focus RPC call for the same user and week returns duplicate and does not re-apply the state patch (ENGINE-04)`

### Full list of test titles — `athlete-decisions.spec.ts`

1. `evidence required: a null p_evidence returns evidence_required and writes no journal row`
2. `evidence must be an object: a JSON array for p_evidence also returns evidence_required`
3. `happy path: a populated p_evidence object round-trips the summary/rationale/evidence into a single journal row`
4. `own-read: the athlete's own client reads their journal rows`
5. `cross-read denied: athlete B reads athlete A's journal → RLS silently filters, 0 rows`
6. `direct INSERT is blocked for the admin client — proves the table-level REVOKE that makes the journal append-only-through-the-RPC`
7. `direct UPDATE is blocked for the admin client — immutability of a genuinely existing row`
8. `direct DELETE is blocked for the admin client — append-only, no client of any kind can remove a row`
9. `authenticated client INSERT/UPDATE/DELETE on athlete_decisions are all blocked`

## Execution status: did the suite actually run or skip?

**Skipped — `SUPABASE_TEST_URL` was NOT set in this execution environment.** This sandboxed worktree has no `.env.test` file, so `backend/api/test/setup.ts` throws `Missing required env var: SUPABASE_URL` before Vitest even collects any spec file — before the `RUN_DB`/`describe.skipIf` guard inside either new spec is ever evaluated. This is the identical pre-existing environment gap documented in both `42-01-SUMMARY.md` and `42-02-SUMMARY.md`; it is not something this plan introduced or can fix.

Running `npm run test:rls` confirms this is uniform, not a regression: all 13 spec files under `backend/api/test/rls/` (the 11 pre-existing files plus the 2 new ones from this plan) fail identically at `test/setup.ts` with the same missing-env-var error. No new failure mode was introduced by this plan's two files.

**What was verified instead**, per the plan's `<known_environment_limitation>` guidance:
- Both automated `<verify>` node scripts from the plan (static content checks — RUN_DB guard present, required substrings/titles present, no direct-insert seeding outside error-asserting tests) ran successfully and printed `OK`.
- `npx tsc --noEmit` in `backend/api/` exits 0 — both spec files compile cleanly against the real `@supabase/supabase-js` types, meaning the RPC call shapes (`p_user_id`, `p_decision_type`, etc.) and client method chains are structurally correct.
- Grepped both files for `.only(` and watch-mode flags — none present.
- `git diff --stat backend/api/test/rls/fixtures.ts` is empty — no fixture changes were made.

**Live execution is unverified in this environment.** Plan 42-04's checkpoint must run both spec files (`npx vitest run test/rls/athlete-state.spec.ts` and `npx vitest run test/rls/athlete-decisions.spec.ts`) against a real Supabase test project with `.env.test` configured — this is the first opportunity either spec has to prove the RLS/RPC/REVOKE claims are true at runtime, not just structurally well-formed.

## Decisions Made

- Chose to give the ratchet test (`athlete-state.spec.ts` test 9) and the idempotency test (test 10) each their own dedicated test user with two sequential RPC calls inside a single `it()` block, rather than trying to share state across separate `it()` blocks — keeps every test independently runnable regardless of Vitest's execution order, while still exercising the exact two-call sequence the plan's `<behavior>` bullets describe.
- Used `randomUUID()` (not a real test user) for the service-role INSERT-blocked test on `athlete_state`, per the plan's explicit guidance — the privilege check fails before the FK to `auth.users` is ever reached, so no test user needs creation or cleanup for that assertion.

## Deviations from Plan

None - plan executed exactly as written, including the exact test titles/substrings both automated verify scripts require (`reads own`, `cannot UPDATE`, `evidence`) and the RPC-only seeding constraint throughout both files.

## Issues Encountered

Same pre-existing environment gap as 42-01/42-02: `backend/api/test/setup.ts` throws before any spec-level `RUN_DB` guard is evaluated, because this sandboxed worktree has no `.env.test`. Confirmed this is uniform across all 13 RLS spec files (not specific to the 2 new files) by running the full `npm run test:rls` suite. Static verification (the plan's own automated `<verify>` node scripts, plus `tsc --noEmit`) is the maximum confidence achievable in this environment; recommend the orchestrator or plan 42-04's checkpoint confirm both new specs actually pass against a real Supabase test project before Phase 43 begins.

## User Setup Required

None - no external service configuration required for this plan. (A `.env.test` with real Supabase test-project credentials will be needed to run `backend/api/test/rls/*` locally and confirm these two specs pass at runtime — this is the same pre-existing environment requirement carried from plans 42-01 and 42-02, not something this plan introduces.)

## Next Phase Readiness

Both spec files are structurally complete and statically verified against the exact RPC signature and return shapes shipped in plan 42-02 (`record_athlete_decision(p_user_id, p_decision_type, p_week_of, p_summary, p_rationale, p_evidence, p_outcome, p_source, p_state_patch)`, returning `{success, error}` or `{success, decision_id}`). Plan 42-04 (migration push) should run both specs live as its human-verify checkpoint — that is the first point in this phase where the security claims get an actual runtime pass/fail, since Wave 3 (this plan) could only confirm structural correctness in this sandboxed environment.

---
*Phase: 42-decision-system-foundation*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: backend/api/test/rls/athlete-state.spec.ts
- FOUND: backend/api/test/rls/athlete-decisions.spec.ts
- FOUND: commit 85ce4a51 (Task 1)
- FOUND: commit 6a296569 (Task 2)
