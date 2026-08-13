---
phase: 01-data-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, security-definer, rls, app_config, backend-vitest]

requires:
  - phase: 01-data-foundation (plan 01-01)
    provides: waitlist_signups table, waitlist_founder_seq, normalize_waitlist_email(), claim_waitlist_signup()
provides:
  - "app_config table (deny-all RLS) — shared key/value store, reused by phase 4 for CRED-05"
  - "public.get_waitlist_founder_status() — threshold-arbitrated counter RPC, service_role-only"
  - "public.anonymize_waitlist_signup(TEXT) — erasure that preserves founder_rank/is_founder"
  - "public.reset_waitlist_founder_sequence(BIGINT) — service_role-only, enables the 200-boundary proof and ROADMAP Phase 6 go-live reset"
affects: [01-03-rls-dedupe-proof, 01-04-concurrency-nondisclosure-ci]

actuals:
  tokens: 4600
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Every new function on this project needs REVOKE EXECUTE FROM PUBLIC, anon, authenticated (not just PUBLIC) — established in plan 01-01, applied consistently here to all three new functions"
    - "Threshold arbitration lives inside the database function, never in application code — the pre-reveal exact count never crosses the network"

key-files:
  created: []
  modified:
    - supabase/migrations/20260812_waitlist_founder_offer.sql
  created_new:
    - backend/api/test/rls/waitlist-config-rpc.spec.ts

key-decisions:
  - "reset_waitlist_founder_sequence uses setval(seq, p_next_value, false) — the is-called=false flag is what makes the NEXT nextval() return exactly p_next_value rather than p_next_value + 1. Getting this flag wrong would have shipped an off-by-one that only shows up when plan 01-04 tries to land the 200-boundary race exactly."
  - "anonymize_waitlist_signup derives both the replacement email AND email_normalized from the row's own id (not from the original address) — this keeps the unique index satisfied post-anonymization and means the erased address becomes registrable again, matching D-07's intent that anonymization is not the same as a permanent block."

patterns-established: []

requirements-completed: [DATA-05, DATA-06]

coverage:
  - id: D1
    description: "app_config (deny-all RLS, seeded threshold) + get_waitlist_founder_status() — threshold arbitration inside the database, unreachable by anon/authenticated"
    requirement: "DATA-05, DATA-06"
    verification:
      - kind: other
        ref: "grep-based structural checks on supabase/migrations/20260812_waitlist_founder_offer.sql — RLS enable=1, CREATE POLICY=0, waitlist_reveal_threshold refs=2, cumulative REVOKE=5, GRANT-to-service_role=5, GRANT-to-anon/authenticated=0"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql live against slkobhavpwsubnsmuhya: pg_policies count=0, relrowsecurity=true, seeded value=30; get_waitlist_founder_status() with 0 claimed returns {should_display:false, remaining:200, is_full:false}; UPDATE app_config to 200 flips should_display to true with no code change; restored to 30"
        status: pass
      - kind: integration
        ref: "SET ROLE anon; SELECT * FROM get_waitlist_founder_status() — actual permission-denied error (42501), not just a privilege-flag check"
        status: pass
    human_judgment: false
  - id: D2
    description: "anonymize_waitlist_signup() — blanks address/UTM, sets anonymized_at, leaves founder_rank/is_founder untouched; counter's remaining is byte-identical across an erasure"
    requirement: "DATA-05, DATA-06"
    verification:
      - kind: other
        ref: "grep-based check: anonymize_waitlist_signup function body (CREATE...to closing $$;) contains no DELETE FROM and no assignment to founder_rank or is_founder"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql live: reset sequence to 150, claimed a row (founder_rank=150, is_founder=true), remaining was 199, anonymized the row, remaining still 199 after, row shows email/email_normalized replaced with anonymized+<id>/anonymized-<id>, anonymized_at set, founder_rank=150 and is_founder=true unchanged; second anonymize call on same address returned false; anonymize on a never-registered address returned false"
        status: pass
    human_judgment: false
  - id: D3
    description: "reset_waitlist_founder_sequence(BIGINT) — service_role-only, deterministic next-value contract, no dynamic SQL"
    requirement: "DATA-05, DATA-06"
    verification:
      - kind: other
        ref: "grep-based checks: setval('public.waitlist_founder_seq' count=1, no 'EXECUTE format' anywhere in the file"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql live: reset_waitlist_founder_sequence(900000) then two claims in sequence produced founder_rank 900000 and 900001, both is_founder=false as expected above the 200 cap"
        status: pass
    human_judgment: false
  - id: D4
    description: "backend/api/test/rls/waitlist-config-rpc.spec.ts — the actual vitest file exercising all of the above through the TypeScript/HTTP path (not direct SQL)"
    requirement: "DATA-05, DATA-06"
    verification: []
    human_judgment: true
    rationale: "Same gap as plan 01-01: SUPABASE_SERVICE_ROLE_KEY is not obtainable via the available MCP tools, so the literal `npm run test:rls -- waitlist-config-rpc.spec.ts` command has not executed. Every behavior it asserts has been proven true via direct SQL against the same RPCs (D1-D3), including one real bug (see Deviations) found by manually walking through the spec's own scenario before trusting it. The remaining gap is narrow: does the TypeScript fixture/client wrapper correctly shape requests, not whether the underlying behavior is correct."

duration: ~40min
completed: 2026-08-13
status: halted
---

# Phase 1 Plan 2: App Config Counter, Erasure, and Sequence Reset Summary

**app_config + get_waitlist_founder_status() + anonymize_waitlist_signup() + reset_waitlist_founder_sequence() — all four applied to the live test project and proven correct via direct SQL and actual `SET ROLE anon` permission-denied checks; the literal backend vitest run remains pending on a service-role key.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 (2 auto tasks executed and DB-verified; Task 3 is the blocking checkpoint, presented separately)
- **Files:** 1 modified (migration), 1 created (spec)

## Accomplishments
- `app_config` table + seeded `waitlist_reveal_threshold=30`, deny-all RLS, applied live
- `get_waitlist_founder_status()` — proven that raising the threshold with a plain `UPDATE` flips `should_display` with no code change or redeploy (D-08/FOND-06)
- `anonymize_waitlist_signup()` — proven live that an erasure blanks the address while `founder_rank`/`is_founder` and the counter's `remaining` stay byte-identical (D-07)
- `reset_waitlist_founder_sequence(BIGINT)` — proven live that `reset(900000)` makes the next two claims land exactly on 900000 and 900001
- All three new functions locked to `service_role` only, verified both by grant-flag check and by an actual `SET ROLE anon` call producing a real `permission denied` error
- Found and fixed a real bug in the test spec before trusting it: the erasure test reset the sequence to `500000`, which `claim_waitlist_signup` never marks as founder (only ranks `<= 200` are); manually walked the corrected value (150) through direct SQL to confirm before leaving it in the committed spec

## Task Commits

1. **Task 1: Threshold-arbitrated founder counter** — combined into `ac4deb3` (see note below)
2. **Task 2: Erasure + sequence reset** — combined into `ac4deb3` (feat)
3. **Task 3: [BLOCKING] Schema push confirmation** — pending human sign-off, not yet resolved

**Note on commit granularity:** Tasks 1 and 2 both append to the same single migration file and were authored, applied, and verified together in one pass rather than as two separate apply/verify cycles — splitting the commit would not have split the verification (both were proven against the same live schema state), so batching them avoided a misleading "task 1 proven" commit that wasn't actually independently verified before task 2 landed.

## Files Created/Modified
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — appended `app_config`, 3 new functions (116 lines)
- `backend/api/test/rls/waitlist-config-rpc.spec.ts` — new file, 3 describe blocks

## Decisions Made
- See frontmatter `key-decisions` — the `setval(..., false)` flag and the id-derived anonymization values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Erasure test spec reset the sequence to a value that would never produce a founder row**
- **Found during:** Manual live walkthrough of the spec's own scenario before trusting the vitest file (which cannot run yet — see Issues Encountered)
- **Issue:** The erasure test called `reset_waitlist_founder_sequence(500000)` expecting the claimed row to be a founder, but `claim_waitlist_signup` only sets `is_founder=true` for `founder_rank <= 200` — the test as written would have claimed a non-founder row and then asserted founder-specific behavior on it, silently proving nothing (or failing confusingly) once it could actually run
- **Fix:** Changed the reset value to `150`
- **Files modified:** `backend/api/test/rls/waitlist-config-rpc.spec.ts`
- **Verification:** Manually walked the exact corrected sequence through `mcp__Supabase__execute_sql` — reset(150) → claim → founder_rank=150, is_founder=true → remaining=199 → anonymize → remaining still 199, row correctly blanked, rank/founder status unchanged
- **Committed in:** `ac4deb3` (caught before the first commit of this plan)

---

**Total deviations:** 1 auto-fixed (1 test-logic bug, caught before it could produce a false pass)
**Impact on plan:** Necessary — an uncaught version of this bug would have made the erasure test either fail confusingly or, worse, pass vacuously once a service-role key becomes available, without ever actually exercising founder-status preservation.

## Issues Encountered

Same structural gap as plan 01-01: the literal `cd backend/api && npm run test:rls -- waitlist-config-rpc.spec.ts` command has not executed, because it needs `SUPABASE_SERVICE_ROLE_KEY`, which the available MCP tools do not expose (only publishable/anon keys). Every behavior the spec asserts has instead been proven directly against the live database via `mcp__Supabase__execute_sql`, including using `SET ROLE anon` to produce an actual `permission denied` error rather than only checking `has_function_privilege()`.

## Next Phase Readiness

**Task 3 (blocking checkpoint) is presented to the user separately, not self-approved.** Per its own instructions, this plan cannot be marked complete until a human confirms:
1. The migration is applied to the test project, not production — automatable steps confirmed (functions exist, RLS/grants correct); the literal vitest command still needs the service-role key
2. The Supabase dashboard shows RLS-with-no-policy on both tables and all five functions under Database → Functions
3. No non-test rows exist in `waitlist_signups` — confirmed live, table is empty
4. Acknowledgment that merging to `main` triggers production migration — a one-way door
5. The Phase 4 ROADMAP drift note (`grant_premium_credits`/`is_lifetime_premium` are not phase-1 scope)

Plans 01-03 and 01-04 depend on this plan. Given the database layer (all 8 objects) is now proven live, they can reasonably proceed once Task 3 is acknowledged.

---
*Phase: 01-data-foundation*
*Completed: 2026-08-13*
