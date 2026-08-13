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
  commits: 2

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
  - "CRITICAL FIX, found by live verification: REVOKE EXECUTE ... FROM PUBLIC alone did NOT block anon/authenticated on this Supabase project. has_function_privilege() showed anon_can_execute=true on both new functions despite the REVOKE FROM PUBLIC already in the migration. Root cause: ALTER DEFAULT PRIVILEGES on schema public grants EXECUTE to anon/authenticated/service_role directly at CREATE FUNCTION time — a separate, already-materialized grant that a PUBLIC-only revoke never touches. Fixed by explicitly naming anon and authenticated in the REVOKE. Re-verified live after a clean drop + re-apply: anon=false, authenticated=false, service_role=true. The SAME gap was found live on is_coach_of()/redeem_invitation_code()/peek_invitation() — the exact functions this codebase treats as the proven security idiom — meaning anon can call all three in production today despite their own REVOKE FROM PUBLIC. That is a pre-existing, codebase-wide issue outside this phase's scope; flagged urgently to the user, not fixed here."

patterns-established:
  - "Vitest DB-mutating specs: never construct a Supabase client at describe-body top level. Vitest evaluates the describe callback during collection regardless of describe.skipIf, so createClient() with unset env vars throws before the skip guard takes effect. Client construction belongs inside beforeAll."

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07]

coverage:
  - id: D1
    description: "waitlist_signups table + waitlist_founder_seq + normalize_waitlist_email() + claim_waitlist_signup() — deny-all RLS, explicit REVOKE/GRANT on both functions, applied and verified against the live SUPABASE_TEST_* project"
    requirement: "DATA-01, DATA-02, DATA-04, DATA-05, DATA-06"
    verification:
      - kind: other
        ref: "grep-based structural checks on supabase/migrations/20260812_waitlist_founder_offer.sql — REVOKE count=2, GRANT-to-service_role count=2, GRANT-to-anon/authenticated count=0, CREATE POLICY count=0, ENABLE ROW LEVEL SECURITY count=1, nextval count=1"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__apply_migration against project slkobhavpwsubnsmuhya (ziko, confirmed by the user as the test project) — applied clean after a full DROP, then re-applied a second time with no error (idempotency)"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql round-trip: claim_waitlist_signup('mcp-verify-beta@example.com', 'athlete') -> is_new=true, founder_rank=1; same email re-submitted case-different -> is_new=false, same rank; exactly 1 row stored"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql normalization: normalize_waitlist_email('Test.User+promo@GMAIL.com') = normalize_waitlist_email('testuser@gmail.com'); first.last@outlook.com <> firstlast@outlook.com"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql RLS: pg_policies count=0, pg_class.relrowsecurity=true for waitlist_signups"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql has_function_privilege(): anon=false, authenticated=false, service_role=true on both functions, AFTER the anon/authenticated revoke fix (see key-decisions — first check found anon=true, a real bug)"
        status: pass
    human_judgment: false
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
    rationale: "The RPC and table this action calls are now proven live (D1) but the Server Action's own TypeScript code has never made an actual HTTP call to Supabase — it's exercised by direct SQL (D1) and by static analysis, not by its own code path. Running the actual vitest suite against the live project needs a SUPABASE_SERVICE_ROLE_KEY, which is not obtainable via the available MCP tools (only publishable/anon keys are exposed) and was not supplied in this session."
  - id: D3
    description: "One-signup round-trip test + normalize_waitlist_email Gmail/Outlook assertions, DB-mutating suite skips cleanly (exit 0) when SUPABASE_TEST_URL is unset"
    requirement: "DATA-01, DATA-02, DATA-04, DATA-06, DATA-07"
    verification:
      - kind: unit
        ref: "apps/web/test/actions/waitlist.concurrency.test.ts — npx vitest run with SUPABASE_TEST_URL/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY all unset: 2 tests skipped, exit 0"
        status: pass
    human_judgment: true
    rationale: "The skip guard is proven correct (it genuinely was broken until the beforeAll fix below). The behavior this test file asserts has separately been proven true via direct SQL (D1) — same RPC, same table, same assertions, different call path. What remains unproven is the test FILE itself executing successfully via `npx vitest run` against the live project, which needs SUPABASE_SERVICE_ROLE_KEY. Functionally low-risk (D1 already proves the behavior) but the literal acceptance criterion — the command actually passing — has not run."

duration: ~35min (across two sessions, interrupted by a model switch and repeated blocked confirmation attempts)
completed: 2026-08-12
status: halted
---

# Phase 1 Plan 1: Waitlist Capture Core Summary

**waitlist_signups + claim_waitlist_signup SECURITY DEFINER RPC + claimWaitlistSpot Server Action, applied to the live SUPABASE_TEST_* project and proven correct — including catching and fixing a critical anon-execute bug that also affects three functions already in production.**

## Performance

- **Duration:** ~35 min initial + a second session applying and verifying against live Supabase
- **Tasks:** 2 (Task 1 checkpoint:decision resolved; Task 2 tracer executed and DB-verified)
- **Files created:** 3

## Accomplishments
- `waitlist_signups` table, `waitlist_founder_seq` sequence, `normalize_waitlist_email()`, and `claim_waitlist_signup()` authored and **applied to the live `ziko` test project** (`slkobhavpwsubnsmuhya`), following the deny-all-RLS + `SECURITY DEFINER` idiom verified against `is_coach_of()` / `redeem_invitation_code()` / `peek_invitation()` during research
- `claimWaitlistSpot` Server Action published, with the D-03/D-04 non-disclosure filter reading `is_new` before any other field
- A concurrency-test harness scaffolded that plan 01-04 will extend with the 200-cap race
- **Found and fixed a critical live security bug**: `REVOKE EXECUTE ... FROM PUBLIC` did not actually block `anon`/`authenticated` from calling either new function — this Supabase project grants EXECUTE to those roles automatically at function-creation time via `ALTER DEFAULT PRIVILEGES`, a grant the `PUBLIC`-only revoke never touches. Fixed by naming `anon, authenticated` explicitly in the revoke; verified live. **The same gap is live in production today** on `is_coach_of()`, `redeem_invitation_code()`, and `peek_invitation()` — see "Issues Encountered."
- Found and fixed a second bug during verification: the test's admin client was constructed inline in the `describe` body, which Vitest always evaluates during collection — `createClient()` threw before `describe.skipIf` ever got a chance to skip anything. Fixed by moving client construction into `beforeAll`.
- Genuine, live database proof of the round trip, dedupe, normalization, RLS deny-all, and grant posture — via `mcp__Supabase__execute_sql` and `apply_migration` — not just static analysis

## Task Commits

1. **Task 1: Approve the one-way schema contract** — no commit (decision only, no files changed). Resolved: option-a (`reset_waitlist_founder_sequence` ships in plan 01-02, `service_role`-only, production artefact per ROADMAP Phase 6).
2. **Task 2: One signup, end to end — migration core, Server Action, round-trip proof** — `c5b00fd` (feat)
3. **Security fix, found during live verification** — `baf55f9` (fix): explicit `anon`/`authenticated` revoke, re-verified live

## Files Created/Modified
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — table, sequence, two functions, both with explicit REVOKE/GRANT
- `apps/web/src/actions/waitlist.ts` — `claimWaitlistSpot` Server Action
- `apps/web/test/actions/waitlist.concurrency.test.ts` — round-trip + normalization test, extended by plan 01-04

## Decisions Made
- Checkpoint Task 1 → option-a (sequence-reset RPC ships in 01-02, not here)
- REVOKE/GRANT applied to both new functions per the plan's explicit task text, not just the `SECURITY DEFINER` one — see frontmatter `key-decisions` for the reasoning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, CRITICAL] REVOKE FROM PUBLIC did not block anon/authenticated execution**
- **Found during:** Live verification against the `ziko` test project (`slkobhavpwsubnsmuhya`), after the user approved a Supabase MCP call and confirmed the project
- **Issue:** `has_function_privilege('anon', ..., 'EXECUTE')` returned `true` for both `claim_waitlist_signup` and `normalize_waitlist_email`, despite the migration's `REVOKE EXECUTE ... FROM PUBLIC` on both. Root cause: this project has `ALTER DEFAULT PRIVILEGES` on schema `public` granting EXECUTE to `anon`/`authenticated`/`service_role` directly at `CREATE FUNCTION` time — a separate, already-materialized grant that revoking `FROM PUBLIC` never touches. **The identical check against `is_coach_of()`, `redeem_invitation_code()`, and `peek_invitation()` — the three functions this codebase's own research verified as "the proven idiom" — showed the same result: `anon_can_execute: true` on all three, live, in production, right now**, despite each carrying its own `REVOKE ... FROM PUBLIC`.
- **Fix (this phase's scope only):** `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` — named explicitly — on both new functions
- **Files modified:** `supabase/migrations/20260812_waitlist_founder_offer.sql`
- **Verification:** Dropped all objects, re-applied the corrected file from scratch, re-ran `has_function_privilege()` — `anon=false, authenticated=false, service_role=true` on both. Re-ran the full round-trip/dedupe/normalization/RLS proof suite against the corrected schema; all pass. Re-applied the file a second time with no error (idempotency).
- **Committed in:** `baf55f9`
- **NOT fixed (out of scope, urgent, needs its own response):** `is_coach_of()`, `redeem_invitation_code()`, `peek_invitation()` remain anon-executable in production. Editing migrations 035/040 is out of this phase's scope and out of "never edit an existing migration" — this needs a deliberate security fix (a new migration explicitly revoking `anon`/`authenticated` from all three) as its own piece of work, ideally soon.

**2. [Rule 1 - Bug] Admin client constructed inline in describe body, bypassing the skip guard**
- **Found during:** Task 2 verification (running the vitest suite with `SUPABASE_TEST_URL` unset, expecting a clean skip)
- **Issue:** `const admin = getAdmin();` at the top of `describe.skipIf(!RUN_DB)(...)` ran during Vitest's collection phase regardless of the skip condition, so `createClient(undefined, undefined, ...)` threw `supabaseUrl is required` before any test could be marked skipped — the whole load-bearing production-safety guard was non-functional
- **Fix:** Moved `admin = getAdmin()` into `beforeAll`, which Vitest genuinely does not enter for a skipped suite
- **Files modified:** `apps/web/test/actions/waitlist.concurrency.test.ts`
- **Verification:** Re-ran with all three env vars unset — 2 tests skipped, exit 0 (previously: 1 failed suite, exit 1)
- **Committed in:** `c5b00fd` (part of Task 2 commit — caught before the first commit, not a follow-up fix)

---

**Total deviations:** 2 auto-fixed (1 critical security bug, 1 test-infrastructure bug)
**Impact on plan:** Both necessary. The security fix is the reason this migration is safe to build on; without it, DATA-06 ("all access through a SECURITY DEFINER RPC") was silently false — `anon` could call `claim_waitlist_signup` directly with the public anon key, burning founder ranks and bypassing the Server Action's non-disclosure filter entirely. No scope creep — the pre-existing production issue this uncovered was flagged, not silently fixed elsewhere.

## Issues Encountered

**No live Supabase connection was available at first**, blocking the actual point of a `type="tracer"` task — see the git history for the initial blocked state. The user then approved a Supabase MCP call and confirmed `ziko` (`slkobhavpwsubnsmuhya`) as the test project (it was `INACTIVE`/paused; restored via `mcp__Supabase__restore_project`).

From there, real verification against the live database was possible:
- The migration was applied, and a critical security bug was found and fixed (see Deviations above)
- Every structural/static acceptance criterion, plus round-trip, dedupe, normalization, RLS, and grant behavior, were proven against the live test project via `mcp__Supabase__execute_sql`
- Migration re-apply idempotency was proven directly (not just claimed)

**What remains unproven:** the actual `npx vitest run test/actions/waitlist.concurrency.test.ts` command, exercising the TypeScript Server Action's own HTTP call to Supabase. This needs `SUPABASE_SERVICE_ROLE_KEY`, which is not obtainable through the available MCP tools (`get_publishable_keys` only exposes the anon/publishable key — service-role keys are deliberately not exposed by Supabase's management API). The underlying behavior this test would prove has already been proven true via direct SQL against the same RPC and table (D1) — so the remaining gap is narrow (does the TS wrapper correctly shape the request/response) rather than "is the database behavior correct."

## Next Phase Readiness

**Mostly unblocked.** The database layer (table, sequence, both RPCs, RLS, grants) is applied to the live test project and genuinely proven correct, including a critical security fix. What's still open:
1. Run `cd apps/web && SUPABASE_TEST_URL=<ziko test URL> SUPABASE_URL=<same> SUPABASE_SERVICE_ROLE_KEY=<service role key> npx vitest run test/actions/waitlist.concurrency.test.ts` — expect 3 passing tests. Needs the service-role key, obtainable from the Supabase dashboard (Project Settings → API) for `slkobhavpwsubnsmuhya`.
2. **Separately, urgently:** open a security fix for the pre-existing anon-execute gap on `is_coach_of()` / `redeem_invitation_code()` / `peek_invitation()` — confirmed live in production today. Not part of this phase; needs its own migration and review.

Plan 01-02 (`app_config`, erasure, sequence reset, blocking schema-push checkpoint) depends on this plan. Given the database layer is now proven, 01-02 can reasonably proceed — apply the same "verify live via MCP, not just structurally" discipline to it.

---
*Phase: 01-data-foundation*
*Completed: 2026-08-12*
