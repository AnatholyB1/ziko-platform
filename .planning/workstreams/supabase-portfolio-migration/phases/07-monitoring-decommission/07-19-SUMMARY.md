---
phase: 07-monitoring-decommission
plan: 19
subsystem: infra
tags: [credentials, decommission, supabase, vercel]
requires:
  - phase: 07-18
    provides: ziko project deleted and confirmed gone
provides:
  - Local credential files removed from this machine
  - Honest record of credentials still outstanding at the account level
affects: [milestone close-out, 06-20 Task 3]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-credentials-retired.json
  modified:
    - .planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
requirements-completed: []
completed: 2026-10-06
---

# Phase 7 Plan 19: Credential Retirement (partial) Summary

Local credential files were deleted (commit 968fcb41), but the user chose "not now" on revoking the PATs and rotating the Vercel bypass secret, so account-level retirement remains OPEN.

## Outstanding credentials (ACTION REQUIRED)

| Credential | State | Where to act |
|------------|-------|--------------|
| `ziko-cutover-phase6` (Supabase PAT) | NOT revoked | https://supabase.com/dashboard/account/tokens |
| `ziko-decom-phase7` (Supabase PAT; its value was pasted into the chat during Phase 7) | NOT revoked | https://supabase.com/dashboard/account/tokens |
| Vercel "Protection Bypass for Automation" secret, web and API projects | NOT rotated | Vercel project Settings > Deployment Protection |

- The local PAT file (`scripts/auth-merge/.access-token`) is deleted, so these tokens can no longer be used from this machine. They remain valid until revoked in the account.
- `ziko-ci-portfolio` is waived (07-15) and stays. `ziko-ci-portfolio-2` must stay (backs the migrate-portfolio CI secret).
- The Phase 6 credential retirement (06-20 Task 3) is NOT closed by this plan.

## Task results

1. Task 1 (done, 968fcb41): local credential and temp files removed; encrypted archive kept (D-08).
2. Task 2 (checkpoint:human-action): user replied "not now". Nothing revoked or rotated.
3. Task 3 (adapted): recorded the outstanding items in 07-AUTHORIZATIONS.md (`### 07-19 credential retirement`) with the verbatim reply. No `Revoked:` line and no `Closes: 06-20 Task 3` line were written. The plan's automated check (`grep "^Revoked: ziko-cutover-phase6"`) intentionally does NOT pass.

## Deviations from Plan

1. **Passphrase file deliberately kept.** `$USERPROFILE/.ziko-decom/backup-passphrase` still exists. The user deletes it after confirming the archive decrypts with their password-manager copy.
2. **Login-role sweep not run** (`login_roles_swept: null`). The PAT file was already removed and no remote calls were permitted in this execution. The sweep remains unperformed; check portfolio for leftover temporary login roles when convenient.
3. **Revocation not performed, by user choice** (see above). Task 3's verify intentionally fails.

## Known Stubs

None.

## Self-Check: PASSED

Authorization block present, no revocation claimed; report JSON present.
