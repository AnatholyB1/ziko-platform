---
phase: 07-monitoring-decommission
plan: 11
subsystem: infra
tags: [supabase, decommission, backup, gpg, encryption]
requires: [07-10]
provides:
  - encrypted full cold backup of frozen ziko (outside repo)
  - freeze proof (T0 == T1)
  - gates freeze_proven, backup_encrypted, backup_second_copy PASS
affects: [07-12, 07-19, 07-20]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-backup-manifest.json
    - scripts/portfolio-migration/reports/decom-freeze-proof.json
  modified:
    - scripts/portfolio-migration/baseline/decom-gates.json
    - scripts/portfolio-migration/20-decom-backup.mjs
    - .planning/workstreams/supabase-portfolio-migration/phases/07-monitoring-decommission/07-AUTHORIZATIONS.md
decisions:
  - "D-05/D-06 satisfied: AES256 gpg archive outside repo, second off-machine copy, only PII-free manifest committed"
metrics:
  tasks: 3
  completed: 2026-10-04
---

# Phase 7 Plan 11: ziko cold backup, encryption and custody Summary

Frozen ziko was backed up in full (99 public tables, auth.users, auth.identities, 10 storage buckets), encrypted with gpg, verified by decrypt and re-hash, proven consistent with the T0 freeze snapshot, and a second off-machine copy was confirmed by the user.

## Results

- Archive: `C:/ziko-backups/ziko-final-2026-10-04.tar.gpg`, 207273907 bytes (plaintext 235148687), sha256 `1732e313ee718bb8b03a66b1c6647610578fcc8950301ef8ac2ebdb16b10e39b`.
- `--verify-archive` exit 0; plaintext work dir removed; no `.tar.gpg` or `.dump` tracked by git.
- Report covers 99 `public.*` tables plus `auth.users` (39) and `auth.identities` (39), and 10 buckets.
- Freeze proof T0 vs T1 passed, so the backup is a single consistent state.
- Task 3: user reply recorded verbatim in its own block `### 07-11 second copy` of 07-AUTHORIZATIONS.md. The 12 hex characters in the reply (`1732e313ee71`) equal the first 12 of the manifest archive sha256. Gate `backup_second_copy` set through `18-decom-guard.mjs --record-gate` (decom-gates.json not hand-edited).
- Claude independently verified the second copy at `C:\Users\Anatholy\OneDrive\ziko-backups\ziko-final-2026-10-04.tar.gpg` has the same sha256 as the original.

## Commits

- 1fa219c3: fix(07-11): retry pg_dump with a fresh login role on stale pooler role state
- 63e9b9eb: chore(07-11): ziko cold backup encrypted and verified
- Task 3 commit: chore(07-11): second backup copy confirmed

## Deviations from Plan

**1. [Rule 3 - Blocking] Transient pooler stale-credential failure during pg_dump**
- **Found during:** Task 1
- **Issue:** pg_dump intermittently failed because the pooler still held stale state for a just-recreated temporary login role. `connectClient` already tolerated this, but `dumpWith` did not retry.
- **Fix:** `dumpWith` now retries up to 4 attempts with a fresh login role; the last failure is still fatal and there is no COPY fallback.
- **Files modified:** scripts/portfolio-migration/20-decom-backup.mjs
- **Commit:** 1fa219c3

## Custody caveat

The statement "passphrase stored" in the user's password manager is the user's own and is not independently verifiable by Claude. Claude never displayed the passphrase. Only the second copy hash match was verified by Claude. Per D-08, without the passphrase the backup is unrecoverable (review at 6 months).

## Notes

- DECOM-02 stays Pending (completed at 07-20); restorability is proven in 07-12.
- ziko remains FROZEN.

## Self-Check: PASSED
