---
phase: 07-monitoring-decommission
plan: 14
subsystem: infra
tags: [vercel, eas, env-audit, decommission, D-12]
requires:
  - phase: 07-13
    provides: verified data/storage state before decommission
provides:
  - "All Vercel (api, web) and EAS env scopes classified clean (87 rows, 0 points_at_ziko, 0 unknown)"
  - "Gate env_scopes_clean PASS"
affects: [07-15, 07-16, 07-17]
tech-stack:
  added: []
  patterns: ["approval-block gated remediation", "REST fallback for ambiguous CLI env rm"]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-env-audit-before.json
    - scripts/portfolio-migration/reports/decom-env-audit.json
  modified:
    - scripts/portfolio-migration/23-decom-env-audit.mjs
    - scripts/portfolio-migration/baseline/decom-gates.json
    - .planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
key-decisions:
  - "User approved the 17-item remediation list as shown; no Supabase integration link exists"
requirements-completed: []
duration: n/a
completed: 2026-10-05
---

# Phase 7 Plan 14: Env scope remediation Summary

Remaining ziko-pointing Vercel Preview/Development scopes were switched to portfolio values (11 set-portfolio) and the unread ziko-web SUPABASE_PUBLISHABLE_KEY was removed (6 rm); the re-audit is fully clean and gate env_scopes_clean is recorded.

## Tasks

1. Task 1 (commits 56c8c324, 774412cd): read-only before-audit: 91 rows, 74 clean, 17 points_at_ziko, 0 scratch, 0 unknown. Production of ziko-api and all EAS values were already clean and left untouched.
2. Task 2 (checkpoint:decision): user replied "approve env-remediation (Recommended)" and "no-integration (Recommended)".
3. Task 3 (commit 2e7d61af): approval block recorded in 07-AUTHORIZATIONS.md (with `Integration: none`), remediation applied (30 vercel commands), integration check run, after-audit passed (87 rows, all clean), gate recorded via the script's `--record-gate`.

## Verification

- Integration check: `vercel integration list --all` shows the Supabase integrations; none lists ziko-api or ziko-web (the portfolio resource is linked to other projects only). No re-injection possible.
- After-audit: 87 rows, all clean; PII/secret grep on the report: 0 matches.
- `18-decom-guard.mjs --status`: `env_scopes_clean: PASS`.
- Production health: https://ziko-api-lilac.vercel.app/health returns 200; https://ziko-app.com returns 307 (locale redirect) then 200 when following redirects.
- `node --test scripts/portfolio-migration/23-*.test.mjs`: 21 pass, 0 fail.

## Deviations from Plan

**1. [Rule 3 - Blocking] eas env:list invocation fix (Task 1)**
- `eas env:list` was invoked with flags eas-cli 24.10.0 rejects; changed to the positional environment plus supported flags, with a regression test. Commit 56c8c324.

**2. [Rule 3 - Blocking] Vercel team scope required**
- All vercel calls need `--vercel-scope anatholyb1s-projects`; without it the project link cannot resolve the projects.

**3. [Rule 3 - Blocking] Ambiguous `vercel env rm` for preview all-branches records**
- Vercel CLI 59 returns `multiple_envs` when a branch-specific record (gsd/phase-6-cutover) shares the name with the all-branches record, and offers no way to target the latter. The first apply attempt failed on its first command, before any change was made. Added a fallback in `23-decom-env-audit.mjs` that looks up branchless, non-production records for the target through `vercel api` (ids only) and deletes them by id. The following per-environment add commands restored the shared Development scope. Commit 2e7d61af.
- Note: the new fallback has no dedicated unit test; the existing 21 tests pass.

## Known Stubs

None.

## Self-Check: PASSED

Commits 56c8c324, 774412cd, 2e7d61af exist; decom-env-audit.json present; gate PASS.
