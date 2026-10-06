---
phase: 07-monitoring-decommission
plan: 16
subsystem: infra
tags: [decommission, scratch, supabase, D-07, D-12b]
requires:
  - phase: 07-15
    provides: CI off scratch
provides:
  - "Scratch project rkirvurggtgjlkeuhded (ziko-migration-scratch) deleted and confirmed gone"
  - "Gate scratch_deleted PASS"
affects: [07-17, 07-21]
tech-stack:
  added: []
  patterns: ["fail-closed delete script in scratch mode with its own authorization block"]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-scratch-deleted.json
  modified:
    - scripts/portfolio-migration/baseline/decom-gates.json
    - .planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
key-decisions:
  - "User approved scratch deletion with a separate block, distinct from the D-15 ziko confirmation"
requirements-completed: []
duration: n/a
completed: 2026-10-05
---

# Phase 7 Plan 16: Scratch project deletion Summary

The scratch project holding a restored copy of ziko PII was deleted through the API (single DELETE, accepted, HTTP 200) and confirmed gone; ziko and portfolio were untouched.

## Tasks

1. Task 1 (checkpoint:decision): user replied verbatim "Approve scratch deletion (Recommended)".
2. Task 2 (commits d893f86a approval block, 67cab4c7 deletion + gate):
   - Test suite before deletion: 608 pass, 0 fail.
   - Approval recorded in `### 07-16 scratch deletion` of 07-AUTHORIZATIONS.md.
   - Dry run: all gates PASS, pre-delete GET name `ziko-migration-scratch` (ACTIVE_HEALTHY, eu-west-3).
   - `--delete`: exactly one DELETE, accepted. `--confirm-gone`: confirmed gone (method api).
   - Post-check: ziko preflight 200 (ACTIVE_HEALTHY), portfolio GET HTTP 200, `other_projects=0` (no stray projects).
   - Gate `scratch_deleted` recorded PASS; evidence report passes the PII/secret grep gate.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
