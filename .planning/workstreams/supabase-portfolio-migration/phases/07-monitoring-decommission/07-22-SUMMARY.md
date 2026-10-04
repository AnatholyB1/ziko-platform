---
phase: 07-monitoring-decommission
plan: 22
subsystem: infra
tags: [decommission, verification, cli, read-only, tdd]
requires: ["07-01", "07-04", "07-05"]
provides:
  - "22-decom-verify.mjs CLI: --check pk-subset|content|storage-subset|integrity|auth|tenants|all, buildChildSteps, run"
affects: [07-13, 07-20]
tech-stack:
  added: []
  patterns: ["injected deps (runSql, runner, storage client, fs, now)", "continue-on-failure child steps", "SELECT-only guard on every SQL string"]
key-files:
  created: []
  modified:
    - scripts/portfolio-migration/22-decom-verify.mjs
    - scripts/portfolio-migration/22-decom-verify.test.mjs
key-decisions:
  - "Target must equal PROJECTS.portfolio and source PROJECTS.ziko; refusals (exit 1) and bad args (exit 2) happen before any query, child step or file read."
  - "Every SQL string goes through assertReadOnlySql (must start with SELECT/WITH, no INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP/CREATE/GRANT/REVOKE/COPY/VACUUM) in production, not only in tests."
  - "Tenant delta (D-11) is computed in-process: the three tenant child verifiers' [FAIL]/[WARN] lines are parsed and fed to evaluateTenantDelta, so sv_ drift stays informational and rh_/gecko_ changes fail."
  - "Tables without a PK on either side use the count fallback and report content-not-compared as a deviation instead of passing silently."
requirements-completed: []
duration: 35min
completed: 2026-10-04
---

# Phase 7 Plan 22: Decom verify CLI Summary

Read-only DECOM-03 verifier CLI on top of the 07-05 evaluators: one command collects PK lists, row digests and sha256 of every bucket object from frozen ziko and portfolio, runs the existing integrity/auth/tenant verifiers as child steps, and writes a PII-free report. Built and unit-tested only; the live run is plan 07-13.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 + 2 | Guards, child steps, report/gate output, read-only live collection | ac428905 |

## Verification

- `node --test scripts/portfolio-migration/22-decom-verify.test.mjs`: 50 pass (21 evaluator/report tests from 07-05, 10 new CLI tests).
- `node --test "scripts/portfolio-migration/*.test.mjs" "scripts/auth-merge/*.test.mjs"`: 576 pass, 0 fail.
- `node scripts/portfolio-migration/22-decom-verify.mjs --help` works.
- No literal project ref in the module (grep 0). `13-cutover-delta` and `05-load-data` appear only in comments/help text; a test asserts no built step contains them or a `counts` check.
- Not run against live ziko or portfolio (by instruction).

## Deviations from Plan

**1. [Process] Single commit for Task 1 and Task 2**
- Both tasks edit the same two files and were developed together, so one commit covers both instead of two.

**2. [Interface] Public-table column lookup**
- `fetchNonGeneratedColumns` only accepts auth tables, so a new `buildColumnsSql` (information_schema, SELECT-only) lists non-generated columns per public table on each side.

**3. [Interface] Portfolio object listing with timestamps**
- `buildObjectListSql` (07-04) has no created_at/updated_at, which `evaluateObjectSubset` needs to explain post-flip extras. Added `buildTargetObjectListSql` in this module for the portfolio side; the ziko side reuses the 07-04 builder.

## Notes for 07-13

- The `integrity-fk` child (06-verify-data `--check fk`) is the existing verifier and issues VALIDATE CONSTRAINT on ziko_ tables of portfolio, as in the post-cutover run. All SQL sent by this CLI itself is SELECT-only.
- `--record-gate` needs `--check all` and a repo-relative `--json-out`; it records `verify_pass` only when the full run passes.
- DECOM requirements remain Pending until plan 07-20.

## Known Stubs

None.

## Threat Flags

None. T-07-17, T-07-18b, T-07-20 and T-07-20b mitigations are implemented and tested.

## Self-Check: PASSED

Files and commit ac428905 verified present.
