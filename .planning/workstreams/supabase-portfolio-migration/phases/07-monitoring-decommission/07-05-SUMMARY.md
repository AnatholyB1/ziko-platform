---
phase: 07-monitoring-decommission
plan: 05
subsystem: infra
tags: [decommission, verification, delta, content-digest, tdd]
requires: ["07-01", "07-04"]
provides:
  - "22-decom-verify.mjs: pure delta evaluators (PK subset, extras, object subset, tenant delta), row-digest SQL builder, content-digest evaluator, report builder"
affects: [07-13, 07-22]
tech-stack:
  added: []
  patterns: ["pure evaluators returning {ok, detail, ...}", "fail-closed (NOT-RUN counts as failure)", "SELECT-only SQL builders with IDENT_RE and UUID-shape checks"]
key-files:
  created:
    - scripts/portfolio-migration/22-decom-verify.mjs
    - scripts/portfolio-migration/22-decom-verify.test.mjs
  modified: []
key-decisions:
  - "Row digest uses jsonb_object_agg over jsonb_each(to_jsonb(t)) filtered by the shared column list, avoiding the 100-argument limit of jsonb_build_object on wide tables."
  - "Remap is applied on the ziko side via replace(lower(...)) on both pk_key and the row JSON text before md5; portfolio side gets no remap."
  - "Report integrity/auth/tenant sections hold PASS/FAIL/NOT-RUN verdicts only; a missing section is NOT-RUN and forces passed=false. Table count must equal expectedTables (default 99)."
  - "Extras for no-PK tables use classifyExtras with {extraCount, postFlipCount}; no-timestamp tables with extras are unexplained-needs-review."
  - "evaluateTenantDelta classifies by name prefix (rh, gecko, sv, with optional 'bucket '/'policy ' lead): rh/gecko any change fails, sv informational, unknown-tenant problems fail."
requirements-completed: []
duration: 30min
completed: 2026-10-04
---

# Phase 7 Plan 05: Delta-aware verifier semantics Summary

Pure, read-only semantics for D-09/D-10/D-11: every ziko PK must exist in portfolio, extras must be explained as post-flip writes, shared rows are compared by md5 content digest (uuid remap applied), every bucket object is checked by sha256, and tenant deltas follow D-11. The CLI and live run are plans 07-22 and 07-13.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (RED) | Failing delta evaluator tests | 89b34e55 |
| 2 (RED) | Failing content digest tests | caba33ee |
| 1+2 (GREEN) | Evaluators, digest SQL and report | 3601c8b0 |

## Verification

- `node --test scripts/portfolio-migration/22-decom-verify.test.mjs`: 40 pass.
- Full `scripts/portfolio-migration/*.test.mjs` plus `scripts/auth-merge/*.test.mjs`: 516 pass, 0 fail.
- No literal project ref in `22-decom-verify.mjs` (grep count 0); no import of 13-cutover-delta or 05-load-data.
- Report fixtures pass `assertCommittedSafe`; a test asserts no 32-hex digest, PK value, UUID or email in the serialized report.

## Deviations from Plan

**1. [Process] Single GREEN commit for both tasks**
- Both RED test commits were made first (each verified failing: module absent), then the full module was committed once. The module was written ahead of the RED commits and held outside the tree to keep RED honest, so Task 1 and Task 2 share one GREEN commit instead of two.

**2. [Interface] Extra optional inputs**
- `evaluatePkSubset` takes `counts` for no-PK tables; `classifyExtras` takes `extraCount`/`postFlipCount`; `evaluateContentDigest` takes `hasCreatedAt`/`hasUpdatedAt` (needed for the `no-updated_at` detail) and one-sided column lists; `buildDecomReport` takes `expectedTables`. Added `diffColumns` and `PK_COLUMNS_SQL` exports for 07-22.

## Known Stubs

None.

## Threat Flags

None. T-07-18, T-07-19 and T-07-19b mitigations are implemented and tested.

## Notes for 07-22 / 07-13

- `tables` entries passed to `buildDecomReport` are `{table, pk, extras, content}`; `pk.extraKeys` are the PKs whose timestamps the CLI must fetch for `classifyExtras`.
- `buildRowDigestSql` needs the caller to pass `timestampCols` (created_at/updated_at that exist) and sharedCols from `diffColumns`.
- DECOM requirements remain Pending until plan 07-20 (no requirements.mark-complete here).

## Self-Check: PASSED

Files and commits 89b34e55, caba33ee, 3601c8b0 verified present.
