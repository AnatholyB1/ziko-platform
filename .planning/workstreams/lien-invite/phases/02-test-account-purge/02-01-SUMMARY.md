---
phase: 02-test-account-purge
plan: 01
subsystem: infra
tags: [supabase, admin-api, vitest, csv, operational-script, esm]

# Dependency graph
requires: []
provides:
  - "scripts/purge-test-accounts/lib.mjs — TEST_ACCOUNT_DOMAIN, isTestAccountEmail, createPurgeAdminClient, listAllUsers, fetchCrossLinks, classifyAccounts, runDryRun, writeReport"
  - "scripts/purge-test-accounts/dry-run.mjs — read-only CLI entry point"
  - "DryRunReport JSON contract (id/email/created_at/candidates/flagged/to_delete/totals) plus a to_delete CSV, written to the git-ignored scripts/purge-test-accounts/exports/ directory"
  - "apps/web/test/purge/purge-lib.test.ts — 33-assertion proof of the whole pipeline via injected fakes, no Supabase credentials required"
affects: [02-02-export-and-pitr, 02-03-delete-and-verify, 02-04-runbook]

# Actuals (#2632)
actuals:
  tokens: 7940
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-fakes seam: runDryRun takes listUsers/fetchCrossLinks as plain async functions with no client binding, so the full pipeline is provable without a service-role key"
    - "Declarative cross-link table: CROSS_LINK_SOURCES is a data array of {table, columnA, columnB}, driving a symmetric two-query loop per table so a candidate is caught on either side of the relationship"
    - "Exact-domain criterion after the final '@', never substring/LIKE — pinned by a single-screen table-driven test (it.each) instead of scattered assertions"

key-files:
  created:
    - scripts/purge-test-accounts/lib.mjs
    - scripts/purge-test-accounts/dry-run.mjs
    - apps/web/test/purge/purge-lib.test.ts
  modified:
    - .gitignore

key-decisions:
  - "Task 2 followed task-level TDD literally: RED commit (6ba86fc) with 6 intentionally-failing tests against the task-1 single-source implementation, then GREEN commit (71491dc) extending fetchCrossLinks/writeReport to make them pass — confirmed RED before writing any new production code"
  - "Chunked candidateIds into batches of 200 per .in() call (not in the plan's <behavior> list but explicit in <action>) — added a dedicated test proving batch sizes stay <=200 for a 450-id candidate set, since PostgREST URL-length limits are a real correctness risk the plan calls out"
  - "Replaced task 1's two flat isTestAccountEmail describe blocks with one it.each table in task 2, matching the plan's instruction that D-01's blast radius should be 'readable in one screen'"

requirements-completed: [PURGE-01, PURGE-02]

coverage:
  - id: D1
    description: "Read-only dry-run enumerates auth.users via the paginated Admin API and applies the locked @ziko-app.com criterion (D-01), producing a written candidate/to_delete/flagged report for human review before any deletion"
    requirement: PURGE-01
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-lib.test.ts#runDryRun + writeReport — end to end"
        status: pass
      - kind: unit
        ref: "apps/web/test/purge/purge-lib.test.ts#listAllUsers — pagination"
        status: pass
      - kind: unit
        ref: "apps/web/test/purge/purge-lib.test.ts#isTestAccountEmail — criterion table (D-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dry-run report lists exact candidates and partitions them into to_delete and flagged, writing both a JSON report and a to_delete.csv to a git-ignored export directory, with zero rows actually removed"
    requirement: PURGE-02
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-lib.test.ts#also writes a to_delete CSV whose header is id,email,created_at and whose row count equals to_delete.length"
        status: pass
      - kind: other
        ref: "git check-ignore -q scripts/purge-test-accounts/exports/probe.json"
        status: pass
      - kind: other
        ref: "grep -v -E comment-lines scripts/purge-test-accounts/{lib,dry-run}.mjs | grep -c deleteUser -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "A test-account candidate cross-linked to a non-candidate real account through coach_client_links, coach_vocal_feedbacks, or workout_programs (on either user column of each pair) is excluded from to_delete and named in flagged with the linked user id (D-05)"
    requirement: PURGE-02
    verification:
      - kind: unit
        ref: "apps/web/test/purge/purge-lib.test.ts#fetchCrossLinks — full cross-link surface (D-05)"
        status: pass
      - kind: unit
        ref: "apps/web/test/purge/purge-lib.test.ts#classifyAccounts — multi-link aggregation"
        status: pass
    human_judgment: false

duration: ~10min (Task 2 this session; Task 1 executed in a prior agent session per the tracer checkpoint)
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 1: Test-Account Purge Dry-Run Summary

**Read-only dry-run tool for the `@ziko-app.com` test-account purge — paginated Admin API enumeration, exact-domain criterion, three-table/six-column cross-link detection, and a JSON+CSV report to a git-ignored export directory, all proven end-to-end via injected fakes with zero Supabase credentials.**

## Performance

- **Duration:** ~10 min for Task 2 (this continuation session); Task 1 executed and checkpoint-approved in a prior session
- **Started (Task 2):** 2026-08-13T22:47Z
- **Completed:** 2026-08-13T22:50:33Z
- **Tasks:** 2/2
- **Files modified:** 4 (3 created, 1 modified — `.gitignore`)

## Accomplishments
- `scripts/purge-test-accounts/lib.mjs` exports the full interface the plan's `<interfaces>` block specifies: `TEST_ACCOUNT_DOMAIN`, `isTestAccountEmail`, `createPurgeAdminClient`, `listAllUsers`, `fetchCrossLinks`, `classifyAccounts`, `runDryRun`, `writeReport` — the exact surface plans 02-02 through 02-04 will import against
- `fetchCrossLinks` queries all three documented cross-user tables (`coach_client_links`, `coach_vocal_feedbacks`, `workout_programs`) on both columns of each pair, symmetric on either side, batched at 200 ids per `.in()` call, throwing (naming table + column) on any query error rather than silently returning an empty flag list
- `writeReport` now emits both the JSON report and a `to_delete.csv` (header `id,email,created_at`, comma/quote-safe) — the artifact a second reviewer reads under Pitfall 13's two-person rule
- `isTestAccountEmail`'s behavior against every lookalike domain (`notziko-app.com`, `sub.ziko-app.com`, `ziko-app.co`, `ziko-app.com.attacker.tld`), plus a plus-suffixed local part and a two-`@` edge case, is pinned by a single `it.each` table
- 33/33 assertions pass in `apps/web/test/purge/purge-lib.test.ts`, full web suite green (93 passed, 4 pre-existing skips, 0 failed), `npm run lint` exits 0
- Nothing in `lib.mjs` or `dry-run.mjs` is capable of deleting an account — confirmed by grep gates on non-comment lines (`deleteUser`, `DELETE FROM`, `.delete(`)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end dry-run — enumerate, classify, write the review report** — `7aa27d7` (feat) — executed and checkpoint-approved in a prior agent session
2. **Task 2: Complete the cross-link surface and harden the criterion** — TDD, two commits:
   - `6ba86fc` (test) — RED: 6 intentionally-failing tests for coach_vocal_feedbacks/workout_programs sources, batching, CSV output
   - `71491dc` (feat) — GREEN: extended `fetchCrossLinks` and `writeReport` to satisfy all 33 tests

**Plan metadata:** committed separately below (docs commit).

## Files Created/Modified
- `scripts/purge-test-accounts/lib.mjs` - Criterion, Admin client factory, paginated enumeration, 3-table/6-column cross-link detection, pure classification, JSON+CSV report writer
- `scripts/purge-test-accounts/dry-run.mjs` - Thin read-only CLI: resolves output dir, builds the client, runs the pipeline, prints totals + flagged warning + written paths
- `apps/web/test/purge/purge-lib.test.ts` - 33 assertions: criterion table, pagination, classification, cross-link surface (all 3 tables x 2 columns, chunking, error surfacing), end-to-end JSON+CSV report
- `.gitignore` - Adds `scripts/purge-test-accounts/exports/` (git-ignored export directory)

## Decisions Made
- Followed task-level TDD literally for Task 2: committed the RED state (failing tests) before writing any implementation change, confirming 6 new-behavior tests failed and the 27 pre-existing/unaffected tests still passed — then committed GREEN once all 33 passed.
- Added a chunking test (450 candidate ids -> 3 batches of <=200, 18 total `.in()` calls across 3 tables x 2 columns x 3 batches) even though it's not in the plan's `<behavior>` list, because the batching requirement is explicit in `<action>` and untested batching is exactly the kind of silent-under-report bug this phase exists to prevent.
- Replaced the two flat `isTestAccountEmail` describe blocks (from Task 1) with a single `it.each` table per Task 2's explicit instruction that the criterion should be "readable in one screen."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Minor] Fixed two non-convention lint warnings introduced by this task's own test fakes**
- **Found during:** Task 2, post-implementation `npm run lint` pass
- **Issue:** The RED-phase error-throwing test fake declared `from(table)` / `in(col)` params that ended up unused once the test only needed to assert the throw, not use the values — ESLint flagged `table`/`col` as unused (not underscore-prefixed, unlike this repo's established convention for intentionally-unused params).
- **Fix:** Renamed to `_table`/`_col` to match the codebase's existing `_locale`/`_identifier`/`_cols` pattern for intentionally-unused parameters (lint was already exiting 0 — this is style, not a blocking error).
- **Files modified:** `apps/web/test/purge/purge-lib.test.ts`
- **Verification:** `npm run lint` still exits 0; the fake's own tests still pass.
- **Committed in:** `71491dc` (part of Task 2's GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, cosmetic — no functional change)
**Impact on plan:** No scope creep; the fix only touched code introduced within this same task.

## Issues Encountered
None - both tasks executed cleanly against the plan as written, including the tracer feedback checkpoint between Task 1 and Task 2 (user responded "continue" with no changes requested).

## User Setup Required
None - no external service configuration required. No `SUPABASE_SERVICE_ROLE_KEY` was needed or used; the entire suite runs against injected fakes.

## Next Phase Readiness
- `scripts/purge-test-accounts/lib.mjs`'s public interface (`TEST_ACCOUNT_DOMAIN`, `isTestAccountEmail`, `createPurgeAdminClient`, `listAllUsers`, `fetchCrossLinks`, `classifyAccounts`, `runDryRun`, `writeReport`) and the `DryRunReport` JSON shape are stable and match the plan's `<interfaces>` block exactly — plan 02-02 (export + PITR check) can import and read the report directly.
- The `to_delete.csv` writeReport now produces is available for plan 02-02's export step to consume alongside the JSON.
- D-03's safety boundary holds: no delete capability exists anywhere in this plan's files, and no production `SUPABASE_SERVICE_ROLE_KEY` was available or used this session — the real Admin API path (`listAllUsers`, `fetchCrossLinks` against a live client, `createPurgeAdminClient`) remains structurally proven but not executed against a live project. Running `node scripts/purge-test-accounts/dry-run.mjs` against real credentials is the natural first verification step whenever a service-role key becomes available, but it is not required to unblock plan 02-02.

---
*Phase: 02-test-account-purge*
*Completed: 2026-08-13*
