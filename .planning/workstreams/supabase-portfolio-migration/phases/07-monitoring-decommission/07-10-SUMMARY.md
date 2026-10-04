---
phase: 07-monitoring-decommission
plan: 10
subsystem: infra
tags: [supabase, decommission, write-freeze, snapshot]
requires: [07-02, 07-05, 07-06, 07-08, 07-09, 07-21, 07-22]
provides:
  - ziko public tables write-frozen (reversible)
  - committed pre-freeze grant snapshot
  - T0 frozen-state snapshot
affects: [07-11, 07-12, 07-13]
key-files:
  created:
    - scripts/portfolio-migration/baseline/decom-ziko-freeze-state.json
    - scripts/portfolio-migration/reports/decom-freeze-t0.json
  modified:
    - scripts/portfolio-migration/RUNBOOK.md
decisions:
  - "D-02 freeze applied; D-03/D-04 respected (no pause, no monitoring period)"
metrics:
  tasks: 2
  completed: 2026-10-04
---

# Phase 7 Plan 10: ziko write-freeze and T0 snapshot Summary

ziko (slkobhavpwsubnsmuhya) is now write-frozen via the reversible grant REVOKE plus disable_signup, with the pre-freeze grant snapshot and a T0 state fingerprint committed.

## Results

- Preconditions verified: pg tools 18.6 present, ziko name/auth PATCH probe ok, scratch rehearsal unfreeze restored grants byte-equal.
- `--apply --confirm-ref slkobhavpwsubnsmuhya` exit 0; `--status` exit 0 (no write privilege for anon, authenticated, service_role).
- Frozen at 2026-10-04T20:01:04Z. Prior disable_signup was false; now true (confirmed via /auth/v1/settings).
- Read check: PostgREST GET on a public table returned HTTP 200.
- Grant snapshot: 1156 grant rows (names only), PII/secret grep clean.
- T0 snapshot: 111 keys: 99 `public.*`, `auth.users`, `auth.identities`, 10 `storage:*`. Grep gate clean.
- RUNBOOK 7.5 got the freeze timestamp and rollback command.

## Commits

- 72095eb0: chore(07-10): ziko write-freeze applied
- d268f013: chore(07-10): frozen ziko T0 snapshot

## Deviations from Plan

None. The only production writes were the REVOKE and disable_signup PATCH performed by 19-decom-freeze.mjs. No unfreeze was needed.

## Notes

- ziko remains FROZEN. Proceed to 07-11 (backup) without delay.
- DECOM-02 left Pending (completed at plan 07-20 per orchestrator instruction).
- The publishable key was fetched via the management API for a status-code-only check; no secrets printed.

## Self-Check: PASSED
