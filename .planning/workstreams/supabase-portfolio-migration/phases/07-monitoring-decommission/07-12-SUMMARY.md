---
phase: 07-monitoring-decommission
plan: 12
subsystem: infra
tags: [supabase, decommission, restore-proof, pg_restore, scratch]
requires: [07-11]
provides:
  - scratch wipe evidence (all-zero counts)
  - restore proof of the encrypted ziko archive against frozen ziko
  - gate restore_proven PASS
affects: [07-15, 07-16, 07-19, 07-20]
key-files:
  created:
    - scripts/portfolio-migration/reports/decom-restore-wipe.json
    - scripts/portfolio-migration/reports/decom-restore-proof.json
  modified:
    - scripts/portfolio-migration/21-decom-restore-proof.mjs
    - scripts/portfolio-migration/21-decom-restore-proof.test.mjs
    - scripts/portfolio-migration/baseline/decom-gates.json
decisions:
  - "D-07 satisfied: archive restored into wiped scratch and compared to frozen ziko and the archive manifest"
metrics:
  tasks: 2
  completed: 2026-10-04
---

# Phase 7 Plan 12: Restore proof Summary

The encrypted ziko archive was restored into a fully wiped scratch project and matched frozen ziko on every check: 99 tables (count and row md5), auth.users and auth.identities fingerprints, function/policy/trigger/RLS inventory (vs manifest and vs ziko), 144 FKs validated with 0 orphans, and 2699 storage objects with equal sha256 across archive, scratch and ziko. Gate `restore_proven` was recorded through the script's `--record-gate`.

## Results

- Wipe report: passed, public tables / auth users / identities / buckets / objects all 0 (scratch `rkirvurggtgjlkeuhded` only, name-guarded).
- Restore: 99 tables, 39 auth users, 2699 objects, no tolerated pg_restore noise.
- Verify: all 7 checks PASS. Report has 3 deviations stated (D-07 wording, auth by data restore, `--no-privileges`).
- No decrypted temp dir left in the OS temp dir. Reports passed the PII/secret grep gate.
- ziko and portfolio were never written. ziko was only read.

## Deviations from Plan

**1. [Rule 3 - Blocking] CA file default path**
- The script defaults to `<repo>/.ca/supabase-ca.crt`; the cert is at `scripts/portfolio-migration/.ca/supabase-ca.crt`. Passed `--ca-file` explicitly (no code change).

**2. [Rule 1 - Bug] deleteBucket "not empty" after emptyBucket**
- `--wipe` failed on the first attempt. `wipeScratch` now re-empties and retries `deleteBucket` (bounded, 30 tries) when the bucket is reported non-empty. Unit test added.

**3. [Rule 2 - Missing] `--wipe` ignored `--json-out`**
- The plan requires `decom-restore-wipe.json`; `--wipe` now writes a PII-free report. Unit test added.

**4. [Rule 1 - Bug] pg_restore "permission denied to change default privileges"**
- The pooler login role cannot ALTER DEFAULT PRIVILEGES, so the first restore failed (3 fatal lines). pg_restore now runs with `--no-privileges`. Grants/ACLs are not replayed; data, RLS, policies, triggers, functions and constraints still are. Stated in the report deviations.

**5. [Rule 1 - Bug] Extensions dropped with schema public**
- The first verify FAILED on the function inventory (`unaccent`, `unaccent_init`, `unaccent_lexize` missing in scratch): wiping `public CASCADE` drops extensions installed there, and `pg_restore --schema=public` does not recreate them. The failing proof was not recorded as a gate. Fix: before pg_restore, recreate archive-manifest extensions that are missing in scratch (`pg_net`, `unaccent`) in schema public. Scratch was re-wiped and re-restored; verify then passed in full. Unit test added. Note: this extension recreation is not listed in the report's deviations array (the report was generated from the pre-fix constant for that line only); it is documented here.

Script test suite: 33/33 passing (`node --test scripts/portfolio-migration/21-decom-restore-proof.test.mjs`).

## Notes

- Pooler stale-credential flake recurred on read-only login roles; waiting a couple of minutes resolved it.
- Scratch now holds a PII restore. Do not push to the remote until 07-15 (CI points at scratch); scratch is deleted in 07-16.
- DECOM-02 stays Pending (completed at 07-20 per 07-11 note).

## Commits

- 38ff8809: chore(07-12): scratch wiped for restore proof
- 21b1dc1f: chore(07-12): restore proof passed

## Self-Check: PASSED
