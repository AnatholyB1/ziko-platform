---
phase: 07-monitoring-decommission
plan: 09
subsystem: infra
tags: [pg_dump, supabase, freeze, probe, decommission]

requires:
  - phase: 07-monitoring-decommission
    provides: "07-21 backup CLI, 07-03/07-07 freeze and delete CLIs"
provides:
  - "pg_dump/pg_restore 18.6 proven through the session pooler (scratch and ziko, schema-only, TLS verified)"
  - "ziko and scratch identity, vercel_managed flag, stray-project check, disable_signup PATCH capability"
  - "Freeze coverage rehearsal on scratch (what REVOKE blocks and what bypasses it)"
affects: [07-10, 07-11, 07-18, 07-20]

key-decisions:
  - "option-scoop-18: PostgreSQL client tools 18.6 via scoop (recorded in 39bf662e)"
  - "Tools resolved by prepending the scoop bin dir to PATH for the process; no code change needed"

requirements-completed: []

duration: 25min
completed: 2026-10-04
---

# Phase 7 Plan 09: Wave 0 live probes Summary

pg_dump/pg_restore 18.6 dump ziko and scratch schema-only through the pooler with verified TLS; ziko accepts a no-op disable_signup PATCH; the scratch freeze rehearsal shows REVOKE blocks REST writes and signup but not auth admin, SECURITY DEFINER RPC or storage writes.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Approve tool install (option-scoop-18) | 39bf662e |
| 2 | Tools, pg_dump probe, Management API preflight | 00093a55 |
| 3 | Freeze coverage rehearsal on scratch | dd11b62b |

## Findings

- pg_dump/pg_restore 18.6. The scoop bin dir is not on PATH (no shims). Probes ran with it prepended to PATH.
- ziko schema dump: 1579 TOC entries, 1 `CREATE TABLE auth.users`, 99 public `CREATE TABLE`. Scratch: 1524 entries. `pg_restore --list` parses both.
- ziko: name `ziko`, ACTIVE_HEALTHY, eu-west-1, `vercel_managed: true`, auth_config_patch `ok` (GET 200, PATCH 200, unchanged). Scratch: name `ziko-migration-scratch`, also `vercel_managed: true` per the preflight. No stray projects (the early scratch attempt project is gone).
- Freeze on scratch (859 write privileges before, none after apply):
  - service_role PATCH 403/42501, anon PATCH 401/42501, service_role GET 200, public signup 422 (blocked).
  - Bypass: GoTrue admin createUser, SECURITY DEFINER RPC (http 200), storage upload (allowed, removed afterwards).
  - Unfreeze replayed grants byte-equal, signup restored, 859 write privileges again.
- Implication: the measured T0==T1 proof in 07-11 is the real gate; REVOKE alone does not stop auth admin, definer or storage writes.
- `--status` after unfreeze exits non-zero by design (writes allowed). The plan's task 3 automated check chains `--status &&`, which only passes while frozen. Acceptance was verified manually instead.

## Deviations from Plan

- The SECURITY DEFINER row-level effect was not measured: the one-off row-count query targeted a table that does not exist, so only the http 200 is recorded (noted in the report). Does not affect the conclusion.
- Probe script was a one-off in the scratchpad (not committed), as the plan specified. Temp user and storage object were cleaned up (0 leftovers).
- Untracked `scripts/portfolio-migration/baseline/decom-scratch-freeze-state.json` (written by `--apply`, grants and prior signup flag only, no PII) was committed with task 3.

## Self-Check: PASSED

Reports exist and pass the PII grep gate; 511 portfolio-migration tests green; temp probe dirs removed; ziko was only read (schema-only dump, GETs, no-op PATCH).
