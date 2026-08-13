---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, security-definer, rls, next-server-action, vitest]

requires: []
provides:
  - "waitlist_signups table (deny-all RLS, no policies) — supabase/migrations/20260812_waitlist_founder_offer.sql"
  - "public.waitlist_founder_seq sequence — the single source of founder-rank issuance"
  - "public.normalize_waitlist_email(TEXT) — Gmail/Googlemail dot-collapse, universal +suffix strip"
  - "public.claim_waitlist_signup(...) — SECURITY DEFINER RPC, service_role-only"
  - "claimWaitlistSpot Server Action — apps/web/src/actions/waitlist.ts, D-03/D-04 non-disclosure filter"
affects: [01-02-app_config-erasure-sequence-reset, 01-03-rls-dedupe-proof, 01-04-concurrency-nondisclosure-ci]

actuals:
  tokens: 3287
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC pairs its own REVOKE EXECUTE FROM PUBLIC + GRANT TO service_role — applied to BOTH new functions, including the non-definer helper, per this plan's explicit task text (not just the security-definer one)"
    - "Deny-all RLS: ENABLE ROW LEVEL SECURITY with zero CREATE POLICY statements, RPC is the only door"
    - "Non-disclosure filtering happens in the Server Action reading is_new first, never in the RPC — the RPC is server-to-server only and may return true state"

key-files:
  created:
    - supabase/migrations/20260812_waitlist_founder_offer.sql
    - apps/web/src/actions/waitlist.ts
    - apps/web/test/actions/waitlist.concurrency.test.ts
  modified: []

key-decisions:
  - "Checkpoint Task 1 resolved as option-a: reset_waitlist_founder_sequence(BIGINT) ships in plan 01-02 (not this plan) as a service_role-only production artefact — ROADMAP Phase 6 needs a sequence reset at go-live regardless of this phase's test needs. Rejected option-b (pg devDependency + connection-string secret) because it adds infrastructure and still leaves Phase 6's need unaddressed."
  - "REVOKE/GRANT applied to normalize_waitlist_email() as well as claim_waitlist_signup(), even though the helper isn't SECURITY DEFINER — the plan's task text says 'each of the two functions... both functions, no exceptions,' which is stricter than the RESEARCH.md code example (which only grants the definer function). Followed the plan text as authoritative."

patterns-established:
  - "Vitest DB-mutating specs: never construct a Supabase client at describe-body top level. Vitest evaluates the describe callback during collection regardless of describe.skipIf, so createClient() with unset env vars throws before the skip guard takes effect. Client construction belongs inside beforeAll."

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07]

coverage:
  - id: D1
    description: "waitlist_signups table + waitlist_founder_seq + normalize_waitlist_email() + claim_waitlist_signup() authored with deny-all RLS and explicit REVOKE/GRANT on both functions"
    requirement: "DATA-01, DATA-02, DATA-05, DATA-06"
    verification:
      - kind: other
        ref: "grep-based structural checks on supabase/migrations/20260812_waitlist_founder_offer.sql — REVOKE count=2, GRANT-to-service_role count=2, GRANT-to-anon/authenticated count=0, CREATE POLICY count=0, ENABLE ROW LEVEL SECURITY count=1, nextval count=1"
        status: pass
    human_judgment: true
    rationale: "The SQL has never executed against a real Postgres instance in this environment — no Supabase MCP, CLI, or connection string was available. Structural correctness is proven; runtime correctness (does it actually apply, does claim_waitlist_signup behave as written) is not. A human with DB access must apply this migration to SUPABASE_TEST_* and confirm before this is trusted."
  - id: D2
    description: "claimWaitlistSpot Server Action — imports nothing from next/headers, filters on is_new before reading is_founder anywhere"
    requirement: "DATA-07"
    verification:
      - kind: other
        ref: "grep-based checks on apps/web/src/actions/waitlist.ts — next/headers count=0, claimWaitlistSpot export count=1, is_new first-occurrence line < is_founder first-occurrence line"
        status: pass
      - kind: unit
        ref: "tsc --noEmit -p apps/web/tsconfig.json — no errors touching waitlist.ts"
        status: pass
    human_judgment: true
    rationale: "The action has never actually called the RPC against a live database — its behavior when claim_waitlist_signup returns is_new=false is unexercised. Static analysis and typecheck pass; the actual non-disclosure behavior is unproven."
  - id: D3
    description: "One-signup round-trip test + normalize_waitlist_email Gmail/Outlook assertions, DB-mutating suite skips cleanly (exit 0) when SUPABASE_TEST_URL is unset"
    requirement: "DATA-01, DATA-02, DATA-04, DATA-06, DATA-07"
    verification:
      - kind: unit
        ref: "apps/web/test/actions/waitlist.concurrency.test.ts — npx vitest run with SUPABASE_TEST_URL/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY all unset: 2 tests skipped, exit 0"
        status: pass
    human_judgment: true
    rationale: "This confirms the skip guard is not silently broken (it genuinely was, until the beforeAll fix below) — it does NOT confirm the round-trip test's actual assertions pass against a real database, because that branch never ran. A human with DB access must run this suite with SUPABASE_TEST_URL=SUPABASE_URL set and confirm 3 tests pass before Plan 01-01 is considered proven."

duration: ~35min (across two sessions, interrupted by a model switch and repeated blocked confirmation attempts)
completed: 2026-08-12
status: halted
---

# Phase 1 Plan 1: Waitlist Capture Core Summary

**waitlist_signups + claim_waitlist_signup SECURITY DEFINER RPC + claimWaitlistSpot Server Action, written and structurally verified — the live database round-trip proof this tracer exists to deliver has NOT run in this environment.**

## Performance

- **Duration:** ~35 min of active work (interleaved with checkpoint waits)
- **Tasks:** 2 (Task 1 checkpoint:decision resolved; Task 2 tracer executed, partially verified)
- **Files created:** 3

## Accomplishments
- `waitlist_signups` table, `waitlist_founder_seq` sequence, `normalize_waitlist_email()`, and `claim_waitlist_signup()` authored in a single new dated migration, following the deny-all-RLS + `SECURITY DEFINER` idiom verified against `is_coach_of()` / `redeem_invitation_code()` / `peek_invitation()` during research
- `claimWaitlistSpot` Server Action published, with the D-03/D-04 non-disclosure filter reading `is_new` before any other field
- A concurrency-test harness scaffolded that plan 01-04 will extend with the 200-cap race
- Found and fixed a real bug during verification: the test's admin client was constructed inline in the `describe` body, which Vitest always evaluates during collection — `createClient()` threw before `describe.skipIf` ever got a chance to skip anything. The fix moves client construction into `beforeAll`.

## Task Commits

1. **Task 1: Approve the one-way schema contract** — no commit (decision only, no files changed). Resolved: option-a (`reset_waitlist_founder_sequence` ships in plan 01-02, `service_role`-only, production artefact per ROADMAP Phase 6).
2. **Task 2: One signup, end to end — migration core, Server Action, round-trip proof** — `c5b00fd` (feat)

## Files Created/Modified
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — table, sequence, two functions, both with explicit REVOKE/GRANT
- `apps/web/src/actions/waitlist.ts` — `claimWaitlistSpot` Server Action
- `apps/web/test/actions/waitlist.concurrency.test.ts` — round-trip + normalization test, extended by plan 01-04

## Decisions Made
- Checkpoint Task 1 → option-a (sequence-reset RPC ships in 01-02, not here)
- REVOKE/GRANT applied to both new functions per the plan's explicit task text, not just the `SECURITY DEFINER` one — see frontmatter `key-decisions` for the reasoning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Admin client constructed inline in describe body, bypassing the skip guard**
- **Found during:** Task 2 verification (running the vitest suite with `SUPABASE_TEST_URL` unset, expecting a clean skip)
- **Issue:** `const admin = getAdmin();` at the top of `describe.skipIf(!RUN_DB)(...)` ran during Vitest's collection phase regardless of the skip condition, so `createClient(undefined, undefined, ...)` threw `supabaseUrl is required` before any test could be marked skipped — the whole load-bearing production-safety guard was non-functional
- **Fix:** Moved `admin = getAdmin()` into `beforeAll`, which Vitest genuinely does not enter for a skipped suite
- **Files modified:** `apps/web/test/actions/waitlist.concurrency.test.ts`
- **Verification:** Re-ran with all three env vars unset — 2 tests skipped, exit 0 (previously: 1 failed suite, exit 1)
- **Committed in:** `c5b00fd` (part of Task 2 commit — caught before the first commit, not a follow-up fix)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary — without this fix, the production-safety guard this whole phase depends on (no DB-mutating spec ever touching production Supabase secrets in CI) was silently broken. No scope creep.

## Issues Encountered

**No live Supabase connection was available in this environment**, and this blocks the actual point of a `type="tracer"` task:

- No `SUPABASE_TEST_URL` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in the shell, no `apps/web/.env.local`
- Supabase MCP tool call (`list_projects`) was declined when requested
- `supabase` CLI is not installed in this environment
- `psql` is present but no connection string or credentials exist anywhere reachable — a cached project ref (`slkobhavpwsubnsmuhya`) exists at `supabase/.temp/project-ref` but that alone doesn't grant a connection

Per the plan's own instruction ("If none is available, halt and report — do not proceed to a verification that cannot run"), I did not fabricate a connection or claim the DB-touching acceptance criteria passed. Instead:
- Every acceptance criterion checkable without a database (14 grep/structural checks, plus `tsc --noEmit`) was run for real and passes
- The "skips cleanly when unset" half of the vitest criterion was run for real and passes (and caught the bug above)
- The "3 tests pass when `SUPABASE_TEST_URL` equals `SUPABASE_URL`" half, and "the migration re-applies idempotently against the test project" — the two genuinely DB-dependent acceptance criteria — were **not verified** and are not claimed as passing

This is why `status: halted` rather than `complete`: the tracer's core promise (the whole waitlist capture path proven end to end against a real database) is unproven, and plans 01-02/01-03/01-04 all build on this foundation.

## Next Phase Readiness

**Blocked pending live Supabase access to the `SUPABASE_TEST_*` project.** Once available:
1. Apply `supabase/migrations/20260812_waitlist_founder_offer.sql` to the test project
2. Run `cd apps/web && SUPABASE_TEST_URL="$SUPABASE_URL" npx vitest run test/actions/waitlist.concurrency.test.ts` — expect 3 passing tests
3. Re-apply the same migration file a second time — expect no error (idempotency check)
4. If all three succeed: update this SUMMARY's frontmatter `status: complete` and flip the three `human_judgment: true` coverage entries' verification to reflect the real pass, then proceed to plan 01-02

Plan 01-02 (`app_config`, erasure, sequence reset, blocking schema-push checkpoint) is written to depend on this plan and should not be treated as safely built-upon until the above is resolved.

---
*Phase: 01-data-foundation*
*Completed: 2026-08-12*
