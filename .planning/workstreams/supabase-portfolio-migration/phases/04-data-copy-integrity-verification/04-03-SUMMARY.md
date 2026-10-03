---
phase: 04-data-copy-integrity-verification
plan: 03
subsystem: data-migration
tags: [pg, pg-copy-streams, loader, management-api, uuid-remap]
requires:
  - phase: 04-data-copy-integrity-verification
    provides: lib-data.mjs (04-01), lib-verify.mjs (04-02)
provides:
  - lib-conn.mjs login-role + verified-TLS session-pooler client factory
  - 05-load-data.mjs loader CLI (--plan | --probe | --apply)
affects: [04-04, 04-05, 04-07]
tech-stack:
  added: []
  patterns: [one pg.Client per side, in-memory short-lived credentials, per-table transaction with count equality gate]
key-files:
  created:
    - scripts/portfolio-migration/lib-conn.mjs
    - scripts/portfolio-migration/lib-conn.test.mjs
    - scripts/portfolio-migration/05-load-data.mjs
    - scripts/portfolio-migration/05-load-data.test.mjs
  modified: []
key-decisions:
  - "Foreign-referrer guard SQL (FOREIGN_REFERRERS_SQL) lives in 05-load-data.mjs: 04-02's REFERRERS_SQL has different semantics (sequence-dependent column defaults), and lib-verify.mjs is outside this plan's files_modified"
  - "Column parity uses pg_attribute with format_type and attgenerated = '' (generated columns cannot be COPY targets, information_schema loses enum/array detail)"
  - "Source-side UUID occurrence SQL is built locally because buildUuidOccurrenceSql only accepts ziko_ names"
  - "Sequence regression (source below previous target value) is refused before setval rather than detected after"
  - "Load errors report table, phase and SQLSTATE only, because pg error text can embed row values"
requirements-completed: [DATA-01, DATA-02]
duration: 25min
completed: 2026-10-02
---

# Phase 4 Plan 03: Loader CLI Summary

Connection layer and guarded loader: `--plan` (read-only, no credentials), `--probe`, and `--apply` (one guarded 99-table TRUNCATE, per-table COPY with in-flight remap inside a REPEATABLE READ source snapshot, setval from live ziko state, trigger assertion, PII-safe report). Nothing was run against any live project.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1. lib-conn.mjs + tests (6) | cd268d18 | no network in tests |
| 2a. guards, --plan, --probe, pure helpers + tests (8) | 8b77e72c | |
| 2b. --apply, loadTable | 417bfa21 | |

## Verification (local only)

- `node --test "scripts/portfolio-migration/*.test.mjs"`: 74 pass, 0 fail (includes the 04-02 no-nextval scan over 05-load-data.mjs)
- `--help` exits 0; ziko target with --apply exits 1; portfolio without --confirm-ref exits 1; committed portfolio remap on scratch exits 1 (target_ref mismatch), all before any network call
- Greps: 3 occurrences of the replica SET LOCAL, 1 REPEATABLE READ READ ONLY, 0 cascade/nextval in code lines; 0 `rejectUnauthorized: false`, 0 connection URLs in lib-conn.mjs

## Deviations from Plan

**1. [Rule 3 - Blocking] FK referrer guard defined in the loader.** The plan says to add REFERRERS_SQL to 04-02 if absent; it exists with unrelated semantics, and lib-verify.mjs is out of this plan's file scope (parallel 04-04). Added FOREIGN_REFERRERS_SQL in 05-load-data.mjs instead. Commit 8b77e72c.

**2. Column query via pg_attribute instead of information_schema** (see key-decisions). Commit 8b77e72c.

## Notes for 04-04 / operators

- Not exercised live: `--probe` and `--apply` need SUPABASE_ACCESS_TOKEN and ideally `--ca-file` (Supabase CA in gitignored `scripts/portfolio-migration/.ca/`). Verify the Management API login-role TTL and pooler `db_host` shape on first scratch probe (RESEARCH A1-A4 assumptions are unverified).
- After TRUNCATE commits, a failed table leaves the target partially loaded; re-run `--apply` (it truncates again).

## Known Stubs

None.

## Self-Check: PASSED
