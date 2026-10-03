---
phase: 06-cutover
plan: 02
subsystem: infra
tags: [cutover, delta-sync, auth-merge, storage, runbook]
requires:
  - phase: 03-auth-merge
    provides: 01/02/04/06 auth scripts and lib.mjs guards
  - phase: 05-storage-migration
    provides: 05-load-data, 08-copy-storage, 06-verify-data, 09-verify-storage
provides:
  - 13-cutover-delta.mjs single-checkpoint final delta runbook (plan and apply modes)
affects: [06-10, 06-14]
tech-stack:
  added: []
  patterns: [injected runner and fs deps for offline tests, counts-only reporting]
key-files:
  created:
    - scripts/portfolio-migration/13-cutover-delta.mjs
    - scripts/portfolio-migration/13-cutover-delta.test.mjs
  modified: []
key-decisions:
  - "Apply requires confirm-ref == project-ref on scratch too, not only portfolio"
  - "Password-update flag is appended to the import step only after the delta report shows a reviewed, matching count"
  - "Unreadable delta remap is treated as exit 4 (cannot prove no new collision)"
requirements-completed: [CUTOVER-03, CUTOVER-04]
duration: 25min
completed: 2026-10-03
---

# Phase 6 Plan 02: Cutover delta orchestrator Summary

One gated command runs the D-06 delta sequence (collision, delta report, import, waitlist setval, auth verify, loader probe+apply, storage copy, both verify suites) over the existing Phase 3/5 scripts, stopping at the first failure.

## Tasks

| Task | Commit |
|------|--------|
| 1 RED: D1-D10 tests | 25546410 |
| 2 GREEN: implementation | 2a8773eb |

## Behavior

- Gates, in order: refs format -> ziko refused (any mode) -> assertWriteAllowed -> confirm-ref == project-ref -> exact `Typed authorization: approve ubxllsvanurkwkohzxau option-cutover-delta` line (portfolio) -> run.
- Exit codes: 0 ok, 1 refused/step failed, 2 bad args, 4 new collision/remap mismatch, 5 password changes need review.
- Report: step names, exit codes, durations, numeric counts only; console echo passes through redactPii plus JWT masking. Delta remap lives in os.tmpdir().
- Plan mode uses only read-only children (collision, delta-report, load --plan, copy --plan).
- No direct SQL in the script (grep for TRUNCATE / DELETE FROM / storage.objects returns 0).

## Verification

- `node --test scripts/portfolio-migration/13-cutover-delta.test.mjs`: 10/10 pass.
- Targeting ziko with apply exits 1 with no child spawned.
- Live `--mode plan` on scratch: collision and delta-report steps ran read-only (password_changed=0, other_changed=0). The load-plan step failed with "remap file target_ref does not match --project-ref" because the committed remap targets portfolio. Scratch needs its own scratch remap (`--remap-file`); the full plan dry-run is deferred to 06-10.

## Deviations from Plan

- Plan mode does not report a new-users count (the delta report does not print one; parsed only if a `to_insert=` line appears). Reported as 0 otherwise.
- Test paths normalized for Windows separators (test-only fix).

## Known Stubs

None.

## Self-Check: PASSED
