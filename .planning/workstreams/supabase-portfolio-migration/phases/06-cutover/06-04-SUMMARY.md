---
phase: 06-cutover
plan: 04
subsystem: ci
tags: [ci, github-actions, supabase, migrations, guard]
requires: []
provides:
  - CI migration guard (legacy freeze + portfolio ziko_-only lint + pending selection)
  - gated migrate-portfolio job (dormant until PORTFOLIO_MIGRATIONS_ENABLED=true)
affects: [06-07, 06-17]
tech-stack:
  added: []
  patterns: [node:test fixtures, watermark-based pending selection]
key-files:
  created:
    - scripts/portfolio-migration/16-ci-migration-guard.mjs
    - scripts/portfolio-migration/16-ci-migration-guard.test.mjs
    - scripts/portfolio-migration/legacy-migrations.manifest.json
    - scripts/portfolio-migration/portfolio-migrations.watermark
  modified:
    - .github/workflows/ci.yml
key-decisions:
  - "Manifest hashes normalise CRLF to LF so Windows checkouts match Linux CI"
  - "Lint blanks string literals before DDL matching (the real functions migration contains DDL text inside format() strings)"
  - "Triggers on public ziko_ tables keep their original names; only triggers on shared schemas (auth/storage) must be ziko_-named"
requirements-completed: [CUTOVER-05]
duration: ~25min
completed: 2026-10-03
---

# Phase 6 Plan 04: CI migration guard Summary

Removed the unsafe `migrate-supabase` job (no `db push` or `migration repair` remain) and replaced it with a flag-gated, ref-locked `migrate-portfolio` job plus a `migration-guard` job that runs on every PR and push.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 RED: guard tests G1-G5 | 11bb49ac | failed before implementation |
| 1 GREEN: guard script, manifest (90 files), watermark 20261002160000 | f4176de9 | G1-G5 pass; --check-legacy and --check-portfolio exit 0 |
| 2 ci.yml rewrite | 0be032d7 | see below |

## ci.yml outcome
- `on:` gains `workflow_dispatch`.
- `migration-guard` (name equals id): checkout fetch-depth 0, `--check-legacy`, `--check-portfolio`.
- `migrate-portfolio` (name equals id): needs verify + migration-guard; `if` requires push to main or dispatch AND `vars.PORTFOLIO_MIGRATIONS_ENABLED == 'true'`; CLI pinned 2.116.0; shell equality check against `ubxllsvanurkwkohzxau` before `supabase link`; read-only proof (ziko_ table count >= 99); pending step has no event `if` and prints `no pending portfolio migrations` when the list is empty (always on dispatch).
- YAML validated with PyYAML 6.0.3 (no yaml/js-yaml in node_modules); jobs parse as verify, migration-guard, migrate-portfolio, no-service-role-in-coach, bundle-hygiene, zod-drift.

## Deviations from Plan
None of substance. Lint tuning (string blanking, trigger naming scope) was done to make the real 5 portfolio files pass (G2) and is recorded in key-decisions. The read-only proof parses JSON with a regex on `"ziko_tables"` rather than assuming the CLI's exact JSON envelope.

## Known Stubs
None.

## Self-Check: PASSED
Files and commits 11bb49ac, f4176de9, 0be032d7 verified present.
