---
phase: 07-monitoring-decommission
plan: 13
subsystem: infra
tags: [decommission, verification, read-only, stopped, gap-closure-needed]
requires: ["07-12", "07-22"]
provides:
  - "reports/decom-verify.json (second full run, passed=false, PII-free)"
affects: [07-17, 07-20]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-verify.json
  modified:
    - scripts/portfolio-migration/22-decom-verify.mjs
    - scripts/portfolio-migration/22-decom-verify.test.mjs
key-decisions:
  - "STOPPED: verify_pass gate NOT recorded. report.passed is false. No repair or reload attempted."
requirements-completed: []
duration: ~3h wall (two full live runs, each ~30+ min)
completed: 2026-10-05
status: STOPPED-NO-GATE
---

# Phase 7 Plan 13: Full ziko vs portfolio verification Summary

Full read-only verification ran twice. The final run still fails, so the `verify_pass` gate was not recorded and the phase is stopped. Nothing was repaired or reloaded.

## Pre-check

Freeze re-proof (`19-decom-freeze --prove`) passed: 111 keys identical, ziko still frozen.

## Result of the final run (reports/decom-verify.json, passed=false)

| Check | Result |
|-------|--------|
| tables.total | 99 |
| pk-subset | missing_rows=0 everywhere; FAIL on 2 tables (below); 6 tables with explained extras |
| content | 20717 rows compared; 2 tables mismatched; 2 tables not compared |
| storage | PASS: 8 buckets, 2699 objects, missing 0, sha mismatch 0, 1 explained extra, 0 unexplained |
| integrity | PASS: RLS, triggers, FK, orphans |
| auth users | PASS |
| auth identities | FAIL in the run, PASS on immediate re-run (transient supabase CLI telemetry file EPERM on Windows, not data) |
| tenants rh_/gecko_ | PASS (unchanged), sv_ informational=13 |

No ziko row and no ziko storage object is missing in portfolio. The D-13 allowlist was not needed (extra explained, 0 unexplained).

## Remaining blockers for the gate (named, nothing repaired)

1. **content mismatch, ziko_body_measurements** (2 of 3 rows differ) and **ziko_user_profiles** (1 of 38 compared rows differs). Read-only diagnosis (PII-masked): the only differing columns are `photo_url` / `avatar_url` (and `user_id` for the collision uuid in the unremapped diagnostic). The values differ only by the intentional storage URL rewrite: host `<ziko ref>.supabase.co` -> `<portfolio ref>.supabase.co` and bucket `profile-photos`/`avatars` -> `ziko-profile-photos`/`ziko-avatars`; the path and `?t=` suffix are identical. This is an expected migration transform, but the 07-22 verifier does not normalize it, so it reports a mismatch. Classified here as likely benign, but the gate cannot pass without a user decision (normalize this rewrite in the verifier, or explicitly accept).
2. **pk-subset fail, ziko_user_inventory and ziko_user_plugins**: ziko source has no PK, so the verifier uses the count fallback. Counts: user_inventory ziko 55 / portfolio 56, user_plugins ziko 125 / portfolio 126 (portfolio has a PK). One extra row each, no timestamp column to prove it is post-flip, so the verifier fails them and reports content-not-compared. missing_rows=0 by count, but presence cannot be proven by PK. Needs a user decision (for example a targeted read-only row-level comparison, or acceptance of the one extra row as post-flip).

## Deviations from Plan

**1. [Rule 1 - Bug] Verifier applied lower() to the ziko-side row digest only**
- **Found during:** Task 1 (first run reported 54 content mismatches across nearly all tables)
- **Issue:** `buildRowDigestSql` wrapped the ziko JSON in `replace(lower(...))` while portfolio was not lowercased, so every row with uppercase text differed. A read-only diagnosis of a static table (ziko_badge_definitions, 11 rows) showed zero real differences.
- **Fix:** removed `lower()` from the digest wrapper; test updated to assert no `lower(`. 50/50 module tests pass. Mismatches dropped from 54 to 2.
- **Files:** scripts/portfolio-migration/22-decom-verify.mjs, 22-decom-verify.test.mjs
- **Commit:** 9b4588c1

**2. [Process] Transient identities failure**
- The auth-identities child failed once with a supabase CLI telemetry rename EPERM. Re-run of `06-verify --check identities` alone passed (compared=38, collisions=1). The committed report still records identities=FAIL, so the gate cannot be recorded from it as is.

## Commits

- 9b4588c1 fix(07-13): drop one-sided lower() from ziko row digest
- report + this summary: see the docs commit

## Next step

Gap decision needed from the user (`/gsd:plan-phase 7 --gaps` or a verifier follow-up): normalize the storage URL rewrite for the two URL columns, and resolve presence proof for the two no-PK tables; then re-run `22-decom-verify --check all --record-gate`. Expect an additional run time of 30+ minutes. The pooler/supabase CLI telemetry EPERM may recur and needs a re-run.

## Known Stubs

None.

## Self-Check: PASSED

Report exists with 0 PII grep hits; gate not recorded by design.
