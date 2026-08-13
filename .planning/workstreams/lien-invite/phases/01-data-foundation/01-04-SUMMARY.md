---
phase: 01-data-foundation
plan: 04
subsystem: database
tags: [supabase, postgres, concurrency, ci, github-actions, backend-vitest]

requires:
  - phase: 01-data-foundation (plan 01-02)
    provides: reset_waitlist_founder_sequence(), claim_waitlist_signup()
provides:
  - "200-cap concurrency race proof + founder-status non-disclosure proof — apps/web/test/actions/waitlist.concurrency.test.ts"
  - "CI wiring — .github/workflows/test-rls.yml applies the migration and runs both waitlist suites"
affects: []

actuals:
  tokens: 6100
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Postgres sequence atomicity (nextval()) is the concurrency-safety mechanism a sequence-based cap design relies on — proving the design correct does not require literally racing HTTP requests; sequential firing of the same calls produces an identical final database state, because the database serializes nextval() regardless of caller concurrency."
    - "CI migration-apply steps should degrade, not break, when an optional secret (SUPABASE_TEST_PROJECT_ID) is absent — gate with env.<VAR> != '' rather than assuming the secret exists."

key-files:
  created: []
  modified:
    - apps/web/test/actions/waitlist.concurrency.test.ts
    - .github/workflows/test-rls.yml

key-decisions:
  - "The migration-apply CI step diffs against origin/${{ github.base_ref }} (pull_request event) rather than HEAD~1 (ci.yml's push-event pattern) — the two events need different diff bases, and copying ci.yml's HEAD~1 idiom verbatim would have been wrong for a PR-triggered workflow."

patterns-established: []

requirements-completed: [DATA-02, DATA-03, DATA-07]

coverage:
  - id: D1
    description: "20 submissions racing the 196-200 boundary produce exactly 5 founders on ranks 196-200; all 20 rows exist (past-cap signups accepted, not rejected); no founder rank is ever duplicated table-wide"
    requirement: "DATA-02, DATA-03"
    verification:
      - kind: other
        ref: "grep-based structural checks on waitlist.concurrency.test.ts — reset_waitlist_founder_sequence refs >=2, Promise.all present, claimWaitlistSpot refs >=3, no exec_sql, new Set present, apps/web/src/actions/waitlist.ts untouched"
        status: pass
      - kind: integration
        ref: "mcp__Supabase__execute_sql live against slkobhavpwsubnsmuhya: reset(196), then a plpgsql DO block firing the equivalent 20 claim_waitlist_signup calls (Postgres serializes nextval() regardless of caller concurrency, so this produces the identical final state a true Promise.all race would) — result: 5 founders at exactly [196,197,198,199,200], 20 total rows, 0 non-founder rows missing a rank, 0 duplicate ranks table-wide"
        status: pass
    human_judgment: false
  - id: D2
    description: "Re-submitting a known founder's address through claimWaitlistSpot returns a response field-identical to a fresh non-founder signup's, while the stored row still shows founder status true"
    requirement: "DATA-07"
    verification:
      - kind: integration
        ref: "mcp__Supabase__execute_sql live: seeded a founder at rank 150; the raw RPC's duplicate-branch response (is_new=false, is_founder=true, founder_rank=150) and a genuinely fresh signup's response (is_new=true, is_founder=false) were both traced through the already-statically-verified (plan 01-01) Server Action code path — both produce {status:'success', isFounder:false, founderRank:null}; the row still shows is_founder=true after"
        status: pass
    human_judgment: true
    rationale: "This combines a live-proven RPC truth with a statically-verified code path rather than an actual end-to-end HTTP call through claimWaitlistSpot, because SUPABASE_SERVICE_ROLE_KEY is not obtainable via the available MCP tools. The logical chain is sound (both inputs proven live, the code branch proven correct by inspection), but the literal function has not executed."
  - id: D3
    description: "test-rls.yml applies the migration to the test project (when configured) and runs both waitlist proof suites; the pre-existing service-role guard and ci.yml are untouched"
    requirement: "DATA-02, DATA-03, DATA-07"
    verification:
      - kind: other
        ref: "10 grep-based structural checks: no tabs, SUPABASE_TEST_URL x6, supabase db push x1, migration repair x1, conditional gate x2, concurrency.test.ts x1, apps/web/test/actions x1, ARCH-03 guard x1, zero references to secrets.SUPABASE_URL, ci.yml diff empty"
        status: pass
      - kind: other
        ref: "python3 yaml.safe_load() parses the file cleanly and reports both jobs (rls, web-waitlist)"
        status: pass
    human_judgment: true
    rationale: "YAML structure and static correctness are proven; an actual GitHub Actions run has not happened, because that requires a real pull request against the repository, which this session cannot create or observe. Whether SUPABASE_TEST_PROJECT_ID and SUPABASE_ACCESS_TOKEN secrets are actually configured in this repository is also unknown from here."
  - id: D4
    description: "The literal npx vitest run test/actions/waitlist.concurrency.test.ts and an actual CI run — the two acceptance criteria genuinely requiring live execution this session cannot produce"
    requirement: "DATA-02, DATA-03, DATA-07"
    verification: []
    human_judgment: true
    rationale: "Same SUPABASE_SERVICE_ROLE_KEY gap as every prior plan in this phase, plus a new one: this session has no path to open a real pull request or observe a real GitHub Actions run. Task 3's blocking checkpoint requires exactly this and is presented to the user, not self-approved."

duration: ~70min
completed: 2026-08-13
status: halted
---

# Phase 1 Plan 4: 200-Cap Race, Non-Disclosure Proof, CI Wiring Summary

**Race and non-disclosure properties proven live against the test project (sequential firing standing in for true concurrency, since Postgres's nextval() atomicity is the actual safety mechanism); CI now applies the migration and runs both waitlist suites — an actual CI run and the literal vitest command remain open, presented at the Task 3 checkpoint.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3 (2 auto tasks executed and DB/structurally verified; Task 3 is the blocking phase-acceptance checkpoint, presented separately)
- **Files:** 2 modified

## Accomplishments
- Concurrency race proof: 20 submissions across the 196-200 boundary produce exactly 5 founders, all 20 rows persist, no rank is ever duplicated table-wide — verified live via a plpgsql `DO` block firing the equivalent sequence of calls (sequential firing is a valid stand-in here because Postgres's `nextval()` is atomic by construction; this is the exact mechanism the design relies on, not something true HTTP concurrency would test differently)
- Non-disclosure proof: a known founder's duplicate submission and a fresh non-founder's submission both trace, through the already-verified Server Action code, to the identical `{isFounder:false, founderRank:null}` response — while the stored row still shows the truth
- `.github/workflows/test-rls.yml` now applies the phase-1 migration to the test project (when `SUPABASE_TEST_PROJECT_ID` is configured, degrading gracefully otherwise) and runs both the RLS suite and a new `web-waitlist` job for the concurrency suite, without touching the production-secret-bearing `ci.yml` or the pre-existing `ARCH-03` service-role guard

## Task Commits

1. **Task 1: Race the 200 boundary and close the founder-status oracle** — `3b048c3` (feat)
2. **Task 2: CI migration-apply + both proof suites** — `cab8caa` (feat)
3. **Task 3: [BLOCKING] Phase acceptance** — pending human sign-off, presented separately; genuinely requires a real CI run this session cannot produce

## Files Created/Modified
- `apps/web/test/actions/waitlist.concurrency.test.ts` — 2 new describe blocks (127 lines)
- `.github/workflows/test-rls.yml` — path filters, job env, 2 conditional migration-apply steps, new `web-waitlist` job (62 lines)

## Decisions Made
- See frontmatter `key-decisions` — the `origin/${{ github.base_ref }}` diff base for the pull_request-triggered workflow, distinct from `ci.yml`'s `HEAD~1` push-event pattern

## Deviations from Plan

None — plan executed as written. (Compare to plans 01-01/01-02/01-03, each of which caught and fixed a real bug during live verification; this plan's live verification found no defects in the authored code.)

## Issues Encountered

Same `SUPABASE_SERVICE_ROLE_KEY` gap as every prior plan in this phase — the literal `npx vitest run test/actions/waitlist.concurrency.test.ts` has not executed. Additionally, and new to this plan: **an actual GitHub Actions run cannot be produced or observed from this session** — that requires a real pull request against the repository. Both gaps converge at Task 3's blocking checkpoint, which explicitly requires a green CI run and is presented to the user rather than self-approved.

## Next Phase Readiness

**Task 3 (blocking checkpoint) is presented to the user separately.** This is genuinely the phase's final gate — per its own `<how-to-verify>`, it needs:
1. `npx turbo run test` green locally against the test project (needs a real `SUPABASE_SERVICE_ROLE_KEY`)
2. The same command confirming a clean skip when pointed at production instead
3. An actual pull request with the "RLS Suite" workflow green on both jobs
4. Acknowledgment of the production-merge consequence (already given once, at plan 01-02's Task 3 — carrying forward)
5. The two carry-forward notes (Phase 4 ROADMAP drift, D-09 deferred to phase 5) — already recorded

All four database-layer plans (01-01 through 01-04) have their SQL/RPC/RLS behavior proven live against the `ziko` test project, including three real bugs found and fixed along the way (a broken skip guard, a broken anon-execute revoke — which also surfaced a live production security gap outside this phase's scope — and two test-logic bugs in plan 01-03). What remains for phase acceptance is specifically the parts requiring a real CI environment and a real service-role key, neither available in this session.

---
*Phase: 01-data-foundation*
*Completed: 2026-08-13*
