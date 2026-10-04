---
phase: 07-monitoring-decommission
plan: 04
subsystem: infra
tags: [decommission, backup, gpg, pg_dump, checksums, storage, tdd]
requires: ["07-01"]
provides:
  - "lib-decom-storage.mjs: withRetry, mapPool, buildObjectListSql, BUCKET_LIST_SQL, downloadBuffer, uploadObject (no delete calls)"
  - "20-decom-backup.mjs: pg_dump argv/env builders, gpg argv builders, secret-free manifest, checksums, committed report, encryptArchive/decryptArchive"
affects: [07-08, 07-09, 07-11, 07-21]
tech-stack:
  added: []
  patterns: ["passphrase on gpg stdin (--passphrase-fd 0)", "PG* env vars only for pg_dump", "decrypt-and-rehash verification", "injectable spawn deps"]
key-files:
  created:
    - scripts/portfolio-migration/lib-decom-storage.mjs
    - scripts/portfolio-migration/lib-decom-storage.test.mjs
    - scripts/portfolio-migration/20-decom-backup.mjs
    - scripts/portfolio-migration/20-decom-backup.test.mjs
  modified: []
key-decisions:
  - "Helpers were copied into lib-decom-storage.mjs, not extracted; 08-copy-storage.mjs and lib-storage.mjs are untouched."
  - "uploadObject uses upsert false (x-upsert false on the raw path) because the restore target is wiped first."
  - "Manifest keeps secret-like auth config keys as {name, present}; env key names come only from ENV_MATRIX."
  - "gpg runs with --no-symkey-cache so the passphrase is not kept in gpg-agent."
  - "verifyDirectory also fails on files not listed in checksums.sha256 (unlisted), not only tampered or missing ones."
  - "buildPgEnv upgrades to PGSSLMODE verify-full when a CA path is given, otherwise require."
requirements-completed: []
duration: 20min
completed: 2026-10-04
---

# Phase 7 Plan 04: Cold-backup primitives Summary

Backup building blocks for DECOM-02: storage helpers with no delete calls, pg_dump argv/env builders that never carry a URL or password, a secret-free manifest, sha256 checksums, and tar + gpg AES256 encryption with the passphrase on stdin, plus a decrypt-and-rehash check that names any tampered file.

DECOM-02 stays Pending. The CLI is plan 07-21, and the live run is 07-09 (probe) and 07-11 (real run).

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | lib-decom-storage helpers | 8f8efa40 |
| 2 | Manifest, checksums, encryption, archive verification | 213be3d4 |

## Verification

- `lib-decom-storage`, `08-copy-storage` and `lib-storage` tests: 52 pass.
- `20-decom-backup.test.mjs`: 12 pass, including a real gpg 2.4.9 round-trip and a tampered-file case. The gpg tests are skipped only if gpg or tar is missing.
- Full `scripts/portfolio-migration/*.test.mjs` plus `scripts/auth-merge/*.test.mjs`: 403 pass, 0 fail.
- Neither new production file contains a literal project ref (grep prints 0 for both).
- `git diff` on `08-copy-storage.mjs` is empty.
- No live Supabase access: all tests use fakes or local gpg/tar on temp dirs outside the repo.

## Deviations from Plan

None. The plan was executed as written. TDD was done per task, with each test file and its implementation in one commit (no separate RED commit).

## Known Stubs

None.

## Threat Flags

None. T-07-12 (passphrase on stdin, redacted, absent from argv/logs), T-07-13 (assertOutsideRepo before any spawn, intermediate tar removed in finally) and T-07-15 (per-file sha256 plus decrypt-and-rehash) are implemented and tested.

## Self-Check: PASSED

All four files exist, and commits 8f8efa40 and 213be3d4 are in git log.
