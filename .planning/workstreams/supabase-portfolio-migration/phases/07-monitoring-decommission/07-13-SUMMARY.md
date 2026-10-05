---
phase: 07-monitoring-decommission
plan: 13
subsystem: infra
tags: [decommission, verification, read-only, verify-pass]
requires: ["07-12", "07-22"]
provides:
  - "reports/decom-verify.json (full run 6, passed=true, PII-free)"
  - "verify_pass gate recorded in scripts/portfolio-migration/baseline/decom-gates.json"
affects: [07-17, 07-20]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-verify.json
  modified:
    - scripts/portfolio-migration/22-decom-verify.mjs
    - scripts/portfolio-migration/22-decom-verify.test.mjs
    - scripts/portfolio-migration/baseline/decom-gates.json
key-decisions:
  - "Extras on tables are explained only by rows timestamped after backend_flip_at; ziko rows missing from portfolio still fail."
  - "Tables lacking created_at (user_inventory, user_plugins) are dated by purchased_at / installed_at."
requirements-completed: []
duration: multiple live runs of ~30+ min each
completed: 2026-10-05
status: PASSED
---

# Phase 7 Plan 13: Full ziko vs portfolio verification Summary

Final full read-only run passed and the `verify_pass` gate was recorded. Nothing was repaired or reloaded; ziko and portfolio were only read.

## Final result (reports/decom-verify.json, passed=true)

| Check | Result |
|-------|--------|
| pk-subset | tables=99 failed=0 missing_rows=0 tables_with_explained_extras=8 |
| content | 20717 rows compared, 0 mismatches, 2 tables not compared (no timestamp column and counts differ) |
| storage-subset | 8 buckets, 2699 objects, missing 0, sha mismatch 0, 1 explained extra, 0 unexplained |
| integrity | PASS (RLS, triggers, FK, orphans) |
| auth | PASS (users, identities) |
| tenants | PASS (rh_/gecko_ unchanged, informational=13) |

Report PII grep (uuids, JWTs, emails): 0 hits.

## Deviations from Plan

1. **[Rule 1 - Bug] one-sided lower() in ziko row digest** removed (9b4588c1). Mismatches dropped from 54 to 2.
2. **[Rule 1 - Bug] storage URL rewrite not normalized** in the verifier: ziko host/bucket -> portfolio host/bucket, strict rewrite applied ziko side only (46f1b106, 31da169d). Cleared the photo_url/avatar_url mismatches.
3. **[Rule 1 - Bug] no-PK tables** compared by a row-digest multiset (every ziko digest must appear in portfolio at least as often); extras explained only if post-flip.
4. **No-PK extras** dated via purchased_at / installed_at (c2a7f8ca).
5. **[Rule 1 - Bug] Root cause of the last two pk-subset failures** (3e182fc1): ziko_user_inventory and ziko_user_plugins do have primary keys, so they took the PK branch, which only looked at created_at/updated_at (absent) and reported "no timestamp column" for the single post-flip extra row. The PK branch now dates extras via purchased_at/installed_at when created_at is missing. A failing test was written first; strictness is preserved (a pre-flip extra still fails, missing ziko rows still fail). Also added a `--tables` debug filter (refused with `--record-gate`) and PII-free extras detail in failing pk-subset lines.
6. **[Process] Memory kills / transient failures:** earlier runs were killed by low free memory and one auth-identities child failed once on a transient supabase CLI telemetry EPERM; runs were repeated single-process with a 1 GB heap.

## Commits

- 9b4588c1, 31da169d, 46f1b106, c2a7f8ca, 3e182fc1 (verifier fixes and tests)
- report, gate file and this summary: docs commit

## Known Stubs

None.

## Self-Check: PASSED

Report exists, passed=true, 0 PII grep hits, gate recorded, suite 596/596 green.
