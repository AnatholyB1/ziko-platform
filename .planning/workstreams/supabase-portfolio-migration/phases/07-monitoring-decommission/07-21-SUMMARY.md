---
phase: 07-monitoring-decommission
plan: 21
subsystem: infra
tags: [pg_dump, gpg, backup, supabase, storage, decommission]

requires:
  - phase: 07-monitoring-decommission
    provides: "07-04 backup primitives (pg_dump argv/env, manifest, checksums, encrypt/decrypt), 07-01 decom guard"
provides:
  - "20-decom-backup.mjs CLI: --init-passphrase, --probe-tools, --schema-probe, --run, --verify-archive"
  - "Archive layout matching the 07-08 restore-proof contract (rls_tables and copy_columns in manifest.json)"
affects: [07-09 probe, 07-11 live backup run, 07-08 restore proof, 07-20]

tech-stack:
  added: []
  patterns:
    - "All side effects behind an injectable deps object; refusals return before any network or child process"
    - "Fresh read-only login role per pg_dump, deleteLoginRoles in finally"
    - "Plaintext dir removed only after encrypt then decrypt-and-rehash; removed on every failure path"

key-files:
  created: []
  modified:
    - scripts/portfolio-migration/20-decom-backup.mjs
    - scripts/portfolio-migration/20-decom-backup.test.mjs

key-decisions:
  - "pg_dump failure in --run is fatal; the COPY layer runs only after all three dumps succeed and can never complete a backup alone"
  - "Catalog, COPY layer and storage listing share one REPEATABLE READ READ ONLY snapshot on a single connection"
  - "A refused non-empty out-dir is never cleaned (cleanup only applies to a dir the run itself created)"
  - "Unsafe storage object names and size mismatches are fatal (masked name in the error) instead of skipped"
  - "Committed report holds aggregates only (counts, bucket totals, hashes, tool versions, tls flag), no object names"

patterns-established:
  - "Internal tar/gpg helper renamed runTool so the exported run is the CLI entry"

requirements-completed: []

duration: 35min
completed: 2026-10-04
---

# Phase 7 Plan 21: Backup orchestration CLI Summary

**Guarded ziko cold-backup CLI: read-only pg_dump (data of record) plus an independent COPY layer and full storage export, encrypted with gpg, proven by decrypt-and-rehash before any plaintext is removed.**

## Accomplishments

- Task 1: `--init-passphrase` (0600, wx flag, output is only `passphrase file created`), `--probe-tools`, `--schema-probe` (schema-only plain and -Fc dumps plus `pg_restore --list`, scratch or ziko only, no SQL connection), `--help`. Refusals (repo paths, non-scratch/ziko targets) return before any runner, fetch, token or connect call.
- Task 2: `--run` (ziko only): three pg_dump runs (full public+auth, storage-meta, schema-only), manifest (version, extensions, functions, triggers, policies, rls_tables, roles, grants, default ACL, auth config reduced to key names, presence flags for pg_cron/vault/supabase_functions/realtime publications, env key names), per-table COPY layer including auth.users and auth.identities hashed while streaming and re-checked against the on-disk hash, storage export with concurrency 4 and sha256 per object, checksums, encrypt to `<out-dir>/../ziko-final-<date>.tar.gpg`, decrypt-and-rehash, plaintext removal, then the committed report.
- `--verify-archive`: archive sha256 vs report, then inner re-hash; a tampered path is named in the error.
- Archive aligns with the 21-decom-restore-proof.mjs contract: `db/full.dump`, `copy/auth.users.copy`, `copy/auth.identities.copy`, `storage/<bucket>/<name>`, `storage-manifest.json` (buckets and objects with bucket, name, sha256, mimetype, cache_control), `manifest.json` with `rls_tables` and `copy_columns` keyed `<schema>.<table>`.
- `buildManifest` extended with `rlsTables` and `copyColumns` (backward compatible defaults).

## Task Commits

1. Task 1: CLI skeleton, refusals, probes - `7a7beadb`
2. Task 2: --run and --verify-archive - `8af46c67`

## Verification

- `node --test scripts/portfolio-migration/20-decom-backup.test.mjs` green (30 tests in file).
- Full suite `node --test "scripts/portfolio-migration/*.test.mjs" "scripts/auth-merge/*.test.mjs"`: 566 pass, 0 fail.
- No live run, no export, no network call against ziko was made (live run is 07-11).

## Deviations from Plan

None - plan executed as written. Minor additions inside scope: `db/storage-meta.dump` and `db/schema.sql` are written next to `db/full.dump`; the schema probe produces both a plain schema-only SQL and a -Fc dump; the report records `tool_versions.tls` (`verified` or `encrypted-not-verified`).

## Known Stubs

None.

## Threat Flags

None. Mitigations T-07-12b, T-07-13b, T-07-14, T-07-16 and T-07-16b are covered by tests (passphrase never printed, plaintext removed on failure, credentials via env only, read-only snapshot with no write SQL, pg_dump failure fatal).

## Notes

- DECOM-02 intentionally not marked complete (stays Pending until 07-20).
- Pre-existing untracked/modified files in the working tree were left untouched.

## Self-Check: PASSED
