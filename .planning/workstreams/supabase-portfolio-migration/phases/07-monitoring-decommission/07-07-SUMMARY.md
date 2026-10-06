---
phase: 07-monitoring-decommission
plan: 07
subsystem: infra
tags: [decommission, delete, management-api, fail-closed, tdd]
requires: ["07-01"]
provides:
  - "24-decom-delete.mjs: --preflight/--dry-run/--delete/--confirm-gone/--write-log for --project ziko|scratch"
  - "Pure evaluators evaluatePreDelete, classifyGetResponse, buildDeletionLog; run(argv, deps)"
affects: [07-16, 07-17, 07-18, 07-19, 07-20]
tech-stack:
  added: []
  patterns: ["gate order enforced before any network call", "single never-retried DELETE", "injected fetchImpl recorder proves zero DELETE on refusal"]
key-files:
  created:
    - scripts/portfolio-migration/24-decom-delete.mjs
    - scripts/portfolio-migration/24-decom-delete.test.mjs
  modified: []
key-decisions:
  - "Direct Management API via fetch; no Supabase CLI projects delete (D-16 discretion)."
  - "Preflight and confirm-gone json-out share the pre_delete shape, so the dashboard-deletion path (API 403 on Vercel-managed org) can still produce the deletion log."
  - "confirm-gone and write-log re-run gates 1-3 (no user confirm-ref needed, ref taken from DECOM_REFS) so they cannot log an unauthorized deletion."
requirements-completed: []
duration: 30min
completed: 2026-10-04
---

# Phase 7 Plan 07: Fail-closed project deletion script Summary

Built the irreversible ziko/scratch deletion script and its tests only. Nothing was run against the real Management API; every test uses a mocked fetch recorder.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (RED) | Failing evaluator tests | (test commit, prior to 6de46b3d) |
| 1 (GREEN) | evaluatePreDelete, classifyGetResponse, buildDeletionLog | 6de46b3d |
| 2 | Fail-closed CLI (all modes) and 43 CLI tests | 61099c58 |

## Gate order (delete)

1. project in {ziko, scratch}, `assertDeleteAllowed` (ref from DECOM_REFS, `--confirm-ref` equal)
2. `readGates` + `verifyGates(REQUIRED_GATES[project])` including evidence sha256
3. authorization block (ziko: D-15 `checkConfirmation`; scratch: `checkAuthBlock`)
4. token load
5. pre-delete GET with `evaluatePreDelete` (name and ref)
6. exactly one DELETE; 200 exit 0, 403/409 exit 3, anything else GET state and exit 1 (no retry)

## Verification

- `node --test scripts/portfolio-migration/24-decom-delete.test.mjs`: 53 pass.
- 18-decom-guard tests: 36 pass. Full portfolio-migration plus auth-merge suites: 476 pass, 0 fail.
- `--help` works. Literal-ref grep on production code prints 0.
- Refusal tests assert zero DELETE calls for: portfolio project, portfolio/scratch/garbage/missing confirm-ref, each of the 10 gates false, tampered and missing evidence, missing auth block, "yes but wait", abort line, unreadable gate file, GET name/ref mismatch, GET 404/401/500, token failure. Happy path asserts exactly one DELETE whose URL ends with `/v1/projects/` + PROJECTS.ziko. 429, 500 and network error each yield a single DELETE.
- Token redaction test confirms the token never appears in output.

## Deviations from Plan

None. Plan executed as written (the RED commit contained the Task 1 tests; Task 2 tests were added alongside the CLI in one commit).

## Known Stubs

None.

## Threat Flags

None. T-07-24..27 mitigations implemented and tested.

## Self-Check: PASSED

Files and commits 6de46b3d and 61099c58 verified present.
