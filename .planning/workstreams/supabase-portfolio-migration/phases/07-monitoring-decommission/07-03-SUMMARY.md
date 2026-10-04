---
phase: 07-monitoring-decommission
plan: 03
subsystem: infra
tags: [decommission, freeze, revoke, tdd, supabase]
requires: ["07-01"]
provides:
  - "19-decom-freeze.mjs: reversible write-freeze with --plan/--snapshot-grants/--probe-auth-config/--apply/--status/--unfreeze/--snapshot-state/--prove"
  - "Pure builders and evaluators: GRANT_SNAPSHOT_SQL, buildRevokeSql, buildReplaySql, diffGrantSnapshots, buildStateSnapshotSql, evaluateFreezeProof, evaluateFreezeStatus"
affects: [07-04, 07-20]
tech-stack:
  added: []
  patterns: ["PATCH-before-SQL ordering with rollback", "snapshot-then-replay reversible grants", "T0 vs T1 digest proof"]
key-files:
  created:
    - scripts/portfolio-migration/19-decom-freeze.mjs
    - scripts/portfolio-migration/19-decom-freeze.test.mjs
  modified: []
key-decisions:
  - "Function EXECUTE is not revoked (would break read RPCs, D-02). The measured T0 == T1 proof covers SECURITY DEFINER, GoTrue and Storage writes."
  - "disable_signup PATCH runs before any SQL. The grant snapshot itself is also SQL, so it runs after the PATCH, and any failure after the PATCH patches signup back to the prior value."
  - "A repeat --apply reuses the stored snapshot, including prior_disable_signup (the live value is already true by then)."
  - "Target is --target ziko|scratch only; refs come from DECOM_REFS, no --project-ref flag, no literal refs in production code."
requirements-completed: []
duration: 30min
completed: 2026-10-04
---

# Phase 7 Plan 03: Reversible write-freeze script Summary

Built 19-decom-freeze.mjs: REVOKE of INSERT/UPDATE/DELETE/TRUNCATE on public tables with a pre-REVOKE grant snapshot and byte-equal replay, signup disable/restore, and a pure T0 vs T1 state proof. All code and tests are offline. Nothing was executed against any live Supabase project, and tests use injected fakes only.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (RED) | Failing builder tests | 544c9555 |
| 1 (GREEN) | Builders and evaluators | d71c4c91 |
| 2 | CLI modes, guards, snapshot files | 73ffdb6a |

## Verification

- `node --test scripts/portfolio-migration/19-decom-freeze.test.mjs`: 28 pass.
- Full `scripts/portfolio-migration/*.test.mjs` plus `scripts/auth-merge/*.test.mjs`: 380 pass, 0 fail.
- `--help` prints usage. Grep for literal project refs in 19-decom-freeze.mjs: 0.

## Deviations from Plan

**1. [Ordering] Grant snapshot runs after the PATCH, not before**
- The plan lists "grant snapshot written" before the PATCH, but also requires a refused PATCH to produce zero runSql calls, and the snapshot is a runSql call. I put the PATCH first and made every later failure (snapshot, file write, REVOKE) patch signup back to the prior value. The prior value is persisted in the snapshot file.

**2. [Scope] CLI tests live in the same test file**
- Task 1 and Task 2 tests share 19-decom-freeze.test.mjs, as the plan's file list specifies.

## Notes for later plans

- The freeze-state snapshot (`baseline/decom-<target>-freeze-state.json`) is created at --apply time and is not committed by this plan.
- `--status` exits 1 when any write privilege is still held.
- Table or column names that are not lowercase identifiers make `--snapshot-state` fail (fail-closed).
- DECOM requirements stay Pending until plan 07-20; requirements.mark-complete was not used.

## Known Stubs

None.

## Threat Flags

None. T-07-08..11 mitigations implemented and tested (ref guard, identifier and role whitelists, snapshot no-overwrite plus replay diff, token redaction).

## Self-Check: PASSED

Files and commits 544c9555, d71c4c91, 73ffdb6a verified present.
