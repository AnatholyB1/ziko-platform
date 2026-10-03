---
phase: 04-data-copy-integrity-verification
plan: 04
subsystem: database
tags: [verification, cli, runbook, supabase-cli]
requires:
  - phase: 04-01
    provides: lib-data (rename map, table plan, remap file parser)
  - phase: 04-02
    provides: lib-verify builders and evaluators
provides:
  - 06-verify-data.mjs re-runnable, credential-free verification CLI
  - RUNBOOK.md Phase 4 section (scratch rehearsal, typed gate, portfolio load, recovery, Phase 6 reuse)
affects: [04-05, 04-07, phase-06]
tech-stack:
  added: []
  patterns: [thin CLI over pure lib, per-check catch with redaction, runSql via logged-in Supabase CLI]
key-files:
  created:
    - scripts/portfolio-migration/06-verify-data.mjs
    - scripts/portfolio-migration/06-verify-data.test.mjs
  modified:
    - scripts/portfolio-migration/RUNBOOK.md
key-decisions:
  - "Usage errors are a UsageError class mapped to exit 2 before any query runs"
  - "Error text and details pass through redactPii plus UUID masking before printing"
requirements-completed: [DATA-03, DATA-04, DATA-05]
duration: 25min
completed: 2026-10-02
---

# Phase 4 Plan 04: 06-verify-data Summary

Credential-free verification CLI covering counts, rls, triggers, fk, orphans, sequence, remap and tenants (plus tenant snapshot mode and a PII-free JSON report), with the Phase 4 runbook section.

## Tasks

| Task | Commit |
|------|--------|
| 1. 06-verify-data.mjs + tests + live scratch smoke | 7c2dc3b2 |
| 2. RUNBOOK Phase 4 section | ebf7a43f |

## Live smoke on scratch (read-only, project rkirvurggtgjlkeuhded)

- rls: 99/99 tables enabled
- triggers: 18 triggers inspected, 0 not enabled; 2 ziko_ triggers on auth.users, enabled
- fk: 144 FK constraints, 97 FK columns to auth.users, 144 validated (confirms the corrected FK discovery query)
- orphans: 0 orphans across 144 FK constraints

Unit suite: 66 pass across portfolio-migration tests (11 new). Targeting ziko exits 2; `--check all` on portfolio without `--baseline` exits 2 with no query. Acceptance grep for nextval/n_live_tup/pg_get_triggerdef returns 0; the CLI is 324 lines.

## Not exercised live

counts, sequence, remap and tenants were not run live (scratch tables are empty until 04-05); they are covered by lib-verify unit tests and will be proven in 04-05 and 04-07.

## Deviations from Plan

None - plan executed as written.

## Known Stubs

None.

## Self-Check: PASSED

Both created files exist; commits 7c2dc3b2 and ebf7a43f are in git log. Runbook has no UUID or email.
