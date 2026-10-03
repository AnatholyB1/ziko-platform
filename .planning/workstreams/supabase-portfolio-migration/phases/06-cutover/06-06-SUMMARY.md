---
phase: 06-cutover
plan: 06
subsystem: cutover-docs-and-test-fixtures
tags: [rls, fixtures, runbook, checklist, authorization-log]
requires: ["06-01", "06-02", "06-03", "06-04", "06-05"]
provides:
  - RLS fixture users stamped app ziko (D-18)
  - 06-CUTOVER-SMOKE-CHECKLIST.md (M-01..M-12, W-01..W-06, scripted items)
  - 06-AUTHORIZATIONS.md append-only typed-phrase log
  - RUNBOOK.md Phase 6 section
affects: [06-07, 06-10, 06-12, 06-15, 06-16, 06-18]
key-files:
  created:
    - .planning/workstreams/supabase-portfolio-migration/phases/06-cutover/06-CUTOVER-SMOKE-CHECKLIST.md
    - .planning/workstreams/supabase-portfolio-migration/phases/06-cutover/06-AUTHORIZATIONS.md
  modified:
    - backend/api/test/rls/fixtures.ts
    - backend/api/test/rls/fixtures.test.ts
    - scripts/portfolio-migration/RUNBOOK.md
decisions:
  - "Section C of the checklist uses S-n ids so the M-/W- row-count gate counts only manual rows"
metrics:
  tasks: 2
  completed: 2026-10-03
---

# Phase 6 Plan 06: Wave 0 fixtures, checklist, authorization log, RUNBOOK Summary

createTestUser now sets `user_metadata: { app: 'ziko' }` so gated triggers create profile/credit rows; the manual checklist, authorization log and RUNBOOK Phase 6 section (order, scripts 12-17 commands, per-surface rollback) are committed.

## Commits

- 0b62ba84: test(06-06): stamp app ziko on RLS fixture users; add authorization log
- docs(06-06) commit: smoke checklist and RUNBOOK Phase 6 (second commit on this branch)

## Verification

- grep gates pass: `app: 'ziko'` in fixtures.ts, zero `^Typed authorization:` lines, option-mobile-build present, 18 M-/W- rows, `## Phase 6`, script and `vercel rollback` references.
- PII grep (emails, UUIDs) returns 0 on the checklist and RUNBOOK.

## Deviations from Plan

**1. [Rule 3 - Blocking] Type-check and live fixture test not run**
- The worktree has no `node_modules` (not installed in the isolated checkout), so `npx turbo run type-check --filter=@ziko/api` and the vitest live test could not run. The change is one `user_metadata` key on the Supabase admin `createUser` payload. The live test "createTestUser stamps app ziko" runs against scratch in 06-10, as the plan allows.
- The RUNBOOK 6.3 flags for 13/14/15/17 were taken from each script's header and option spec (the SUMMARYs do not list them). Exact `--authorization-*` usage on 17-env-switch should be confirmed with `--help` at run time.

**2. Worktree base reset** - the worktree HEAD was not on the expected base, so it was reset to 6b295d79 at start as the branch check prescribes (no work lost).

## Known Stubs

None. Result and header fields in the checklist are intentionally blank for testers.

## Self-Check: PASSED

All five files exist and both task commits are present on the branch.
