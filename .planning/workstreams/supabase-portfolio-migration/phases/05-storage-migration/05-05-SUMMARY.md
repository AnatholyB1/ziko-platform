---
phase: 05-storage-migration
plan: 05
subsystem: storage-migration
tags: [storage, verification, supabase, read-only]
requires:
  - scripts/portfolio-migration/lib-storage.mjs (05-01 evaluators)
provides:
  - scripts/portfolio-migration/09-verify-storage.mjs (--check buckets|policies|objects|hashes|rekey|urls|tenants|all, --snapshot-tenants, --json-out)
affects:
  - Phase 5 scratch/portfolio runs, Phase 6/7 re-verification
tech-stack:
  added: []
  patterns: [mirror of 06-verify-data CLI contract, counts-only PII-safe output]
key-files:
  created:
    - scripts/portfolio-migration/09-verify-storage.mjs
    - scripts/portfolio-migration/09-verify-storage.test.mjs
  modified: []
key-decisions:
  - "Function renames for policy rewrite derived directly from rename-map.generated.json (name before '(') rather than importing 07-generate-storage-policies"
  - "Source-side URL counts use a local SQL builder because buildUrlScanSql only accepts ziko_ table names"
  - "Object downloads use the Storage REST endpoint with the service-role key in memory (no extra dependency), 4 concurrent, 3 attempts; a failed download counts as a hash mismatch"
  - "JSON report holds ok/detail/warnings per check only; hash mismatches are reported as bucket#sha256-prefix keys"
requirements-completed: [STORAGE-01, STORAGE-02, STORAGE-03]
duration: ~20 min
completed: 2026-10-02
---

# Phase 5 Plan 05: Storage verification suite Summary

Read-only, re-runnable CLI that proves bucket config, policy equivalence, object count/byte parity, full SHA-256 parity (no sampling), UUID re-key, zero leftover stored URLs and non-ziko storage tenant regression, with PII-safe console and JSON output.

## Tasks

| Task | Commits |
|------|---------|
| 1. Arg resolution, report builder, guard tests (TDD) | RED 1195c22b, GREEN a6e3995d |
| 2. Live check runners and tenant snapshot | 801c0889 |

## Verification

- `node --test 09-verify-storage.test.mjs`: 12 pass, 0 fail (includes spawnSync test: ziko target exits 2 offline).
- `--help` exits 0; ziko target exits 2.
- Read-only grep (upload/remove/bucket writes/DML) returns 0; `assertReportSafe` appears 3 times (JSON report, tenant snapshot, import).
- Live runners were NOT executed (plan scope: build + unit test only).

## Deviations from Plan

None - plan executed as written. The runners (Task 2) have no unit tests beyond the CLI guard; they are exercised only against live projects in later plans.

## Known Stubs

None.

## Threat Flags

None. T-5-20..23 mitigations implemented: assertReportSafe before writes, object keys hashed, 100% hash coverage, read-only by static grep, field-by-field policy comparison plus stale-reference and baseline checks.

## Self-Check: PASSED
