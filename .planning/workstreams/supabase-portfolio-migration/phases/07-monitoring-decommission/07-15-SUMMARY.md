---
phase: 07-monitoring-decommission
plan: 15
subsystem: infra
tags: [ci, github-actions, decommission, waiver, D-12]
requires:
  - phase: 07-14
    provides: env scopes clean
provides:
  - "CI test step no longer receives scratch-valued Supabase secrets; CI green"
  - "Gate ci_off_scratch PASS"
  - "Gate ci_token_revoked recorded as WAIVED (user decision), not PASS"
affects: [07-16, 07-17, 07-21]
tech-stack:
  added: []
  patterns: ["single-gate waiver backed by a verbatim authorization block, re-verified on every read"]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-ci-offscratch.json
  modified:
    - .github/workflows/ci.yml
    - backend/api/vitest.config.ts
    - backend/api/test/setup.ts
    - scripts/portfolio-migration/18-decom-guard.mjs
    - scripts/portfolio-migration/18-decom-guard.test.mjs
    - scripts/portfolio-migration/24-decom-delete.test.mjs
    - scripts/portfolio-migration/baseline/decom-gates.json
    - scripts/portfolio-migration/RUNBOOK.md
    - .planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
key-decisions:
  - "User declined to revoke the stale CI token ziko-ci-portfolio and chose to waive the gate; the token was NOT revoked"
  - "Waiver is allowed for exactly one gate (ci_token_revoked) and only with the exact 07-15 ci token waiver block"
requirements-completed: []
duration: n/a
completed: 2026-10-05
---

# Phase 7 Plan 15: CI off scratch, stale token waiver Summary

CI no longer depends on the scratch project (3 scratch secrets deleted, run 37298715805 green, PR #46), and the stale-token revocation was replaced by an explicit, narrowly scoped user waiver: the token `ziko-ci-portfolio` is still live.

## Tasks

1. Task 1 (commits 8c9d1089, 03c519f0, 31f1745c): ci.yml test step no longer passes SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY; those secrets deleted (10 -> 7 secrets); CI run 37298715805 success; gate `ci_off_scratch` PASS with evidence report.
2. Task 2 (checkpoint:human-action, revoke `ziko-ci-portfolio`): the user replied "I will not revoke it". The token showed "Never used"; `ziko-ci-portfolio-2` stays (backs the migrate-portfolio CI secret). No revocation took place.
3. Task 3 (replaced by waiver, commit 3bb3c065): asked how to handle the gate, the user chose "Waive it, keep the token (Recommended)". Both replies are recorded verbatim in `### 07-15 ci token waiver` with the line `Waiver: ci_token_revoked (token ziko-ci-portfolio NOT revoked; user decision)`. Gate recorded via `18-decom-guard.mjs --record-waiver ci_token_revoked`.

## Waiver mechanism

- `recordGate(key, { waiver: true })` / CLI `--record-waiver`: only `ci_token_revoked`; requires the exact heading, line, Timestamp and Reply in 07-AUTHORIZATIONS.md; stores `passed: "waived"`.
- `verifyGates` (also used by `24-decom-delete.mjs`): `waived` counts as satisfied only for `ci_token_revoked` and only while the exact block still exists; a `waived` value on any other gate fails, and every other gate stays strict.
- `--status` prints `ci_token_revoked: WAIVED`, distinct from `PASS`.
- Tests written first (RED: 4 failing), then implementation: waiver accepted with block; refused without block (4 defects); refused for all 9 other gates (also hand-written); delete script refuses when any other gate is false even with the waiver; delete proceeds only with waiver plus block. Full suite: `node --test "scripts/portfolio-migration/*.test.mjs" "scripts/auth-merge/*.test.mjs"` 608 pass, 0 fail.

## Deviations from Plan

**1. [Rule 3 - Blocking] Backend vitest config change for remote-DB specs (Task 1, commit 03c519f0)**
- Without the scratch secrets, remote-dependent specs would fail CI; `backend/api/vitest.config.ts` and `test/setup.ts` were changed so those specs skip cleanly when the secrets are absent.

**2. [Rule 3 - Blocking] origin/main merged into the phase branch (commit 023ddb04)**
- Needed to bring the branch current so PR #46 CI could run.

**3. [Checkpoint outcome] Waiver replaces Task 3's revocation record**
- Plan truth "ziko-ci-portfolio is revoked by the user" is NOT met. The user declined; the gate is WAIVED, not PASS. Required adding the waiver mechanism (commit 3bb3c065). The plan's automated check `grep -q "^ci_token_revoked: PASS"` intentionally no longer applies.

## Carry list for milestone close-out

- Stale Supabase access token `ziko-ci-portfolio` is still live (user waived revocation; dashboard showed "Never used"). Revoke manually at milestone close-out. Keep `ziko-ci-portfolio-2`.

## Known Stubs

None.

## Self-Check: PASSED
