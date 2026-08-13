---
phase: 01-data-foundation
plan: 03
subsystem: database
tags: [supabase, postgres, rls, dedupe, backend-vitest]

requires:
  - phase: 01-data-foundation (plan 01-02)
    provides: app_config, get_waitlist_founder_status(), anonymize_waitlist_signup(), reset_waitlist_founder_sequence()
provides:
  - "backend/api/test/rls/waitlist-rls.spec.ts — deny-all RLS proof (anon + authenticated) and normalized-dedupe proof for all phase-1 objects"
affects: [01-04-concurrency-nondisclosure-ci]

actuals:
  tokens: 5200
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Zero-policy RLS: SELECT and UPDATE/DELETE filter silently to empty/zero-affected via the implicit USING clause; only INSERT throws a hard error, since WITH CHECK has no existing rows to filter against and is evaluated unconditionally against the new row. Any future deny-all spec in this codebase should assert 'no error, zero rows' for read/update/delete and 'error' only for insert."
    - "When constructing correlated Gmail-collapse test emails, any distinguishing token MUST sit before the '+' — split_part(local, '+', 1) discards everything from '+' onward during normalization, so two 'same address' test emails that differ only after the '+' will never actually collapse."

key-files:
  created:
    - backend/api/test/rls/waitlist-rls.spec.ts
  modified: []

key-decisions:
  - "Authenticated-role deny-all is proven via a real createTestUser() session in the spec file (per the plan), and was independently cross-checked during this session via SET ROLE authenticated in direct SQL — zero-policy RLS blocks the role uniformly regardless of session identity, so both proofs agree."

patterns-established:
  - "Deny-all RLS spec assertion shape: SELECT/UPDATE/DELETE -> { error: null, data: [] } (via .select() on the mutation); INSERT -> { error: not null }. Do not assume symmetry across DML types."

requirements-completed: [DATA-01, DATA-04, DATA-05, DATA-06]

coverage:
  - id: D1
    description: "Deny-all RLS on waitlist_signups for anon AND authenticated — SELECT (empty, no error), INSERT (errors), UPDATE/DELETE (empty result via .select(), no error)"
    requirement: "DATA-05"
    verification:
      - kind: integration
        ref: "mcp__Supabase__execute_sql live against slkobhavpwsubnsmuhya using SET ROLE anon / SET ROLE authenticated: SELECT returns []; INSERT throws 42501 'new row violates row-level security policy'; UPDATE ... RETURNING * and DELETE ... RETURNING * both return [] with no error"
        status: pass
    human_judgment: false
  - id: D2
    description: "All five RPCs (claim_waitlist_signup, normalize_waitlist_email, get_waitlist_founder_status, anonymize_waitlist_signup, reset_waitlist_founder_sequence) reject the anon key; the service-role path still works"
    requirement: "DATA-06"
    verification:
      - kind: integration
        ref: "mcp__Supabase__execute_sql live: SET ROLE anon; SELECT <each function> — all five produced actual '42501: permission denied for function <name>' errors (not privilege-flag checks alone)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Normalized dedupe: Gmail case/sub-address/dot collapse without advancing the sequence; Outlook dot stays significant; case/whitespace collapse; email_normalized invariant; field completeness"
    requirement: "DATA-01, DATA-04"
    verification:
      - kind: integration
        ref: "mcp__Supabase__execute_sql live: corrected Gmail pair collapsed to one row (same founder_rank, second is_new=false), next fresh signup received rank+1 not rank+2 (sequence not advanced); Outlook pair stayed two distinct rows with distinct ranks; case/whitespace pair collapsed; live rows showed email_normalized = normalize_waitlist_email(email) for all 5 verification rows and every field non-null"
        status: pass
    human_judgment: false
  - id: D4
    description: "backend/api/test/rls/waitlist-rls.spec.ts — the actual vitest file exercising all of the above through the TypeScript/HTTP path"
    requirement: "DATA-01, DATA-04, DATA-05, DATA-06"
    verification: []
    human_judgment: true
    rationale: "Same SUPABASE_SERVICE_ROLE_KEY gap as plans 01-01/01-02 — the literal `npm run test:rls -- waitlist-rls.spec.ts` command has not executed. Every behavior it asserts has been proven true via direct SQL, and two real bugs in the spec's own assertions were found and fixed by manually walking through each scenario before trusting it (see Deviations) — a stronger bar than 'it typechecks', since both bugs would have produced actual test failures once run, not silent false passes."

duration: ~50min
completed: 2026-08-13
status: halted
---

# Phase 1 Plan 3: RLS Deny-All + Normalized Dedupe Proof Summary

**waitlist-rls.spec.ts proves deny-all RLS (anon + authenticated, all 5 RPCs) and normalized dedupe against the live test project — two real bugs in the spec's own assertions were found and fixed before trusting it, including one that would have made the Gmail-collapse test fail outright.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 (both auto, both DB-verified)
- **Files:** 1 created

## Accomplishments
- Deny-all RLS proven for **both** anon and authenticated on `waitlist_signups` — SELECT, INSERT, UPDATE, DELETE, all four operations, both roles
- All five phase-1 RPCs proven to reject the anon key via actual `SET ROLE anon` calls producing real `42501` errors, not just grant-flag inspection
- Normalized dedupe proven live: Gmail case/sub-address/dot collapse without burning a founder rank, Outlook dot-significance preserved, case/whitespace collapse, the `email_normalized` invariant, and field completeness
- **Found and fixed two real bugs in the spec's own assertions before trusting it:**
  1. The original draft asserted anon/authenticated `UPDATE`/`DELETE` would "error" — live testing showed Postgres RLS actually filters these silently to zero rows affected (no error), since the implicit `USING` clause has nothing to match; only `INSERT` throws. Fixed the assertion shape to match real behavior.
  2. The Gmail-collapse test placed its correlating random suffix *after* the `+` in the first test address — `normalize_waitlist_email` discards everything from `+` onward, so the two "same address" test emails would never actually have normalized to the same identity, and the dedupe assertion would have failed. Fixed by moving the suffix before the `+`.

## Task Commits

1. **Task 1: Deny-all RLS proof** — combined into `7ce8ea4` (see note below)
2. **Task 2: Normalized dedupe proof** — combined into `7ce8ea4` (feat)

**Note on commit granularity:** Both tasks extend the same single spec file and were authored and verified together — matching the pattern established in plan 01-02 (batching avoids a "task 1 proven" commit that wasn't actually independently verified before task 2 landed).

## Files Created/Modified
- `backend/api/test/rls/waitlist-rls.spec.ts` — new file, 6 describe blocks (2 deny-all × role, RPC privilege, 3 dedupe/invariant blocks)

## Decisions Made
- See frontmatter `key-decisions` — authenticated-role proof strategy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UPDATE/DELETE assertions expected an error; zero-policy RLS actually filters silently**
- **Found during:** Manual live walkthrough via `SET ROLE anon`/`SET ROLE authenticated` in direct SQL, before trusting the drafted spec (which cannot run yet — see Issues Encountered)
- **Issue:** `UPDATE ... WHERE audience = 'athlete'` and `DELETE ... WHERE audience = 'athlete'` under `SET ROLE anon` both returned successfully with zero rows affected — no error. Only `INSERT` produced `42501: new row violates row-level security policy`. This is correct, standard Postgres RLS behavior (UPDATE/DELETE's implicit `USING` clause filters the target set to nothing before `WITH CHECK` is ever evaluated) but it directly contradicted the spec's original `expect(error).not.toBeNull()` assertions for both operations, on both roles
- **Fix:** Changed all four UPDATE/DELETE assertions (anon × 2, authenticated × 2) to `.select()` and assert `{ data: [], error: null }` instead
- **Files modified:** `backend/api/test/rls/waitlist-rls.spec.ts`
- **Verification:** Reproduced live via `SET ROLE anon; UPDATE ... RETURNING *` and the DELETE equivalent — both confirmed empty result, no error, matching the corrected assertion
- **Committed in:** `7ce8ea4` (caught before the first commit of this plan)

**2. [Rule 1 - Bug, would have caused a false failure] Gmail-collapse test's correlating suffix placed after the stripped '+' segment**
- **Found during:** Same manual walkthrough, replicating the spec's exact email construction in SQL before trusting it
- **Issue:** `emailA = "${PREFIX}Dedupe.User+promo-${suffix}@GMAIL.com"` and `emailB = "${PREFIX}dedupeuser${suffix}@gmail.com"` were meant to normalize to the same identity, but `split_part(local, '+', 1)` discards everything from `+` onward — so `emailA`'s normalized form never included `${suffix}` at all, while `emailB`'s did. The two addresses would never have collapsed; running this test would have failed the `expect(secondRow.is_new).toBe(false)` assertion
- **Fix:** Moved the suffix before the `+`: `emailA = "${PREFIX}Dedupe.User${suffix}+promo@GMAIL.com"`. Also fixed the follow-up `.eq('email_normalized', ...)` query, which had the same PREFIX-omission bug
- **Files modified:** `backend/api/test/rls/waitlist-rls.spec.ts`
- **Verification:** Reproduced both the broken and corrected versions live via `claim_waitlist_signup` — broken version produced two distinct ranks (900500, 900501, no collapse); corrected version produced identical ranks (900500 both times, `is_new=false` on the second) and the next fresh signup received exactly `900501` (sequence not advanced by the duplicate)
- **Committed in:** `7ce8ea4` (caught before the first commit of this plan)

---

**Total deviations:** 2 auto-fixed (2 test-logic bugs, both caught before they could produce a false failure or false pass)
**Impact on plan:** Both necessary. Bug 1 would have made the deny-all suite fail outright the first time it actually ran, for a reason unrelated to any real security gap (a false alarm). Bug 2 would have made the dedupe suite fail outright, also unrelated to any real gap — but a live-DB-blind session would have shipped this code as "structurally verified" without ever discovering either problem.

## Issues Encountered

Same structural gap as plans 01-01 and 01-02: `cd backend/api && npm run test:rls -- waitlist-rls.spec.ts` has not executed as a literal command, because it needs `SUPABASE_SERVICE_ROLE_KEY`, which the available MCP tools do not expose. Every behavior the spec asserts has instead been proven directly against the live database via `mcp__Supabase__execute_sql`, using actual `SET ROLE anon`/`SET ROLE authenticated` calls (not just grant-flag inspection) — and this manual walkthrough is what caught both bugs above before they could reach a real test run.

## Next Phase Readiness

Plan 01-04 (200-boundary concurrency race, non-disclosure proof, CI wiring, phase acceptance checkpoint) depends on this plan and can proceed — the deny-all and dedupe properties are proven live, and the two bugs that would have surfaced as confusing failures are already fixed.

---
*Phase: 01-data-foundation*
*Completed: 2026-08-13*
