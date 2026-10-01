---
phase: 02-schema-rename-function-rls-rewrite
plan: 04
subsystem: database
tags: [supabase, rls, verification, migration, postgres]
requires:
  - phase: 02-01
    provides: rename-map.generated.json (99 tables, 33 functions, 0 types)
provides:
  - SQL stale-reference / RLS-enabled / table-count verification suite
  - Authenticated owner-vs-non-owner RLS smoke test
affects: [02-05, 02-07]
tech-stack:
  added: []
  patterns: [map-driven verification, explicit project targeting (no ambient env vars)]
key-files:
  created:
    - scripts/portfolio-migration/03-verify-post-apply.sql
    - scripts/portfolio-migration/03-run-verify.mjs
    - scripts/portfolio-migration/04-rls-smoke-test.js
  modified: []
key-decisions:
  - "Function-name alternation strips the identity-args suffix from rename-map function keys"
  - "Smoke test discovers columns via the PostgREST OpenAPI root (information_schema is not exposed by PostgREST)"
  - "Smoke test requires an additional --publishable-key to sign in as test users"
requirements-completed: [SCHEMA-03, SCHEMA-04]
duration: 15min
completed: 2026-10-01
---

# Phase 2 Plan 04: Verification Tooling Summary

**Map-driven SQL stale-reference/RLS check plus an authenticated owner-vs-non-owner smoke test, both targeting an explicit project only.**

## Accomplishments
- `03-verify-post-apply.sql`: template with 5 named query blocks (stale refs in policies, function bodies, trigger definitions; RLS-not-enabled; table count).
- `03-run-verify.mjs`: builds the full alternation from `rename-map.generated.json` at runtime (validates identifiers before interpolation), requires `--project-ref` (no default), supports `--print-sql` for MCP execution, exits non-zero on any finding.
- `04-rls-smoke-test.js`: iterates every map table, skips (and lists) tables without `user_id`, seeds a row as owner via service role, asserts owner reads it and non-owner does not, always cleans up users and seeded rows in `finally`.

## Task Commits
1. Task 1: SQL verification suite - `36ee0fdf`
2. Task 2: RLS smoke test - `57e60e34`

## Deviations from Plan
- **[Rule 2 - Missing critical]** Added `--publishable-key` flag: signing in as test users needs the publishable key, and a bare env fallback is forbidden by T-2-02.
- Added optional `--allow-public` and `--strict` flags to the smoke test for tables intentionally readable by strangers and for unseedable tables.
- Added `--print-sql` to the verify wrapper (transport flexibility).
- Worktree base was corrected via `git reset --hard 1e6ca093` per the startup check.

## Notes for Plan 05
- Only `--help`/arg-validation/`--print-sql` were exercised; no live connection was made.
- Rows are seeded from OpenAPI `required` columns heuristically; tables with FK-dependent required columns will be listed as "could not seed" (use `--strict` to fail on them) and may need manual coverage.
- The word-boundary regex could false-positive on a column that shares a name with an old table; review any findings manually.
- Rename map `types` is empty, so no type checks are included.

## Self-Check: PASSED
All three files exist and are committed (36ee0fdf, 57e60e34).
