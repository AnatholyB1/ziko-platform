---
phase: 07-monitoring-decommission
plan: 08
subsystem: infra
tags: [decommission, restore-proof, scratch, pg_restore, storage, tdd]
requires: ["07-01", "07-04"]
provides:
  - "21-decom-restore-proof.mjs: --wipe/--restore/--verify/--all with --record-gate, hard-locked to the scratch project"
  - "Pure builders/evaluators: buildWipeSql, evaluateEmpty, classifyRestoreErrors, buildTableDigestSql, buildAuthFingerprintSql, evaluateSameName, evaluateInventory, evaluateObjectHashes, buildPublicOrphanSql, evaluatePublicFks, buildRestoreReport"
affects: [07-09, 07-11, 07-12, 07-21]
tech-stack:
  added: []
  patterns: ["wipe code private to one file, no ref parameter", "injected deps (connect, runner, copyIn, decrypt, storage factory) prove zero side effects on refusal", "same-name evaluators replace prefix-bound verifiers"]
key-files:
  created:
    - scripts/portfolio-migration/21-decom-restore-proof.mjs
    - scripts/portfolio-migration/21-decom-restore-proof.test.mjs
  modified: []
key-decisions:
  - "Every mode (including --verify) requires --confirm-ref equal to the scratch ref and a verified Management API name (ziko-migration-scratch); there is no --project-ref flag. The ref check runs before any network call."
  - "The wipe functions are module-private and take no ref; nothing exports them. 08/09 and lib-decom-storage do not import this file (grep confirmed), so findDeleteCalls guards stay green."
  - "ziko is opened read-only and receives only SELECTs; its storage client only downloads."
  - "Archive is decrypted once per run into an os.tmpdir() dir (assertOutsideRepo) and removed in finally; --all reuses the same decrypt for restore and verify."
  - "Auth restore columns come from manifest.copy_columns when present, otherwise the scratch non-generated columns in ordinal order."
  - "evaluateInventory skips the RLS dimension (and says so) when manifest has no rls_tables; verify also compares frozen ziko live inventory to scratch, so RLS is still proven."
  - "Report details pass through redactPii, then assertReportSafe and assertCommittedSafe."
requirements-completed: []
duration: 55min
completed: 2026-10-04
---

# Phase 7 Plan 08: Restore-proof script Summary

Restore proof for D-07 built as one guarded command that can only write to the scratch project: wipe public/auth/storage and assert empty, restore auth from the COPY layer (replica role verified) and public via pg_restore, recreate buckets and objects, then verify against frozen ziko and the archive manifest with no sampling. DECOM-02 stays Pending (live run is 07-12; DECOM requirements close in 07-20).

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (RED) | Failing evaluator tests | 0f41e2e8 |
| 1 (GREEN) | Wipe/verify builders and evaluators | 3825563e |
| 2 | Restore-proof CLI and 17 CLI tests | ae405075 |

## Verification

- `node --test scripts/portfolio-migration/21-decom-restore-proof.test.mjs`: 30 pass.
- Full `scripts/portfolio-migration/*.test.mjs` plus `scripts/auth-merge/*.test.mjs`: 546 pass, 0 fail (includes 08/09 findDeleteCalls guards).
- `--help` exits 0. Literal project ref grep on the production file prints 0.
- Refusal tests (ziko, portfolio, missing confirm-ref, across all four modes, plus unknown `--project-ref`) assert zero fetch, connect, SQL, storage, decrypt and pg_restore calls. A GET name mismatch allows one GET and nothing else.
- Restore refused when not empty (no decrypt, no pg_restore), temp dir removed on fatal pg_restore and on checksum failure, gate not recorded on a failed verify (digest diff, orphans), gate recorded with a repo-relative path on pass, secrets absent from error output.
- No live Supabase access of any kind: no wipe, restore or write against any project.

## Contracts for downstream plans

Archive layout this script expects (07-21 backup CLI must produce it):
- `db/full.dump` (pg_dump -Fc, public+auth), `copy/auth.users.copy`, `copy/auth.identities.copy` (COPY text format)
- `storage/<bucket>/<object name>`
- `storage-manifest.json`: `{buckets:[{id,public,file_size_limit,allowed_mime_types}], objects:[{bucket,name,sha256,mimetype,cache_control}]}`
- `manifest.json`: buildManifest output; recommended additions `rls_tables` (names of public tables with RLS) and `copy_columns` (`{"auth.users":[...],"auth.identities":[...]}`). Policy rows use `tablename/policyname`, trigger rows `relname/tgname`, function rows `proname`.

## Deviations from Plan

None in scope. Notes: the plan's `--restore` description mentions `buildPgEnv`; the login role for pg_restore is created separately from the SQL connection (connectClient does not expose its password). Only `restore_proven` is recorded by this script.

## D-07 deviation (stated in every report)

06-verify-data and 09-verify-storage are bound to the ziko_ prefix and uuid remap and cannot run on an unprefixed raw restore, so same-name evaluators replace them. Auth is proven by data restore plus non-volatile column fingerprints, not by replaying GoTrue DDL.

## Known Stubs

None.

## Threat Flags

None. T-07-28 (guard + name check before any write, zero-side-effect refusal tests), T-07-29 (empty check before restore, non-zero assertions after, three-way object hash compare), T-07-30 (tmpdir outside repo removed in finally, passphrase redacted) and T-07-31 (deviations array) are implemented and tested.

## Self-Check: PASSED

Both files exist; commits 0f41e2e8, 3825563e and ae405075 are in git log.
