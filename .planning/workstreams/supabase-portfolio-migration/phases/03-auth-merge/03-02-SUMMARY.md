---
phase: 03-auth-merge
plan: 02
subsystem: auth-merge-db
tags: [supabase, triggers, auth, handoff]
requires: []
provides:
  - Gated ziko_handle_new_user / ziko_handle_new_user_credits (D-05)
  - Separately attachable ziko_ auth.users triggers (D-06)
  - Rolled-back trigger gate probe (D-07)
  - 03-PHASE6-HANDOFF.md, 03-UUID-REMAP-SPEC.md
affects: [03-08, 03-11, phase-04, phase-05, phase-06]
key-files:
  created:
    - supabase/portfolio-migrations/20261002090000_portfolio_ziko_auth_gate_functions.sql
    - supabase/portfolio-migrations/20261002090001_portfolio_ziko_auth_triggers.sql
    - scripts/auth-merge/sql/trigger-gate-probe.sql
    - .planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-PHASE6-HANDOFF.md
    - .planning/workstreams/supabase-portfolio-migration/phases/03-auth-merge/03-UUID-REMAP-SPEC.md
key-decisions:
  - "Both trigger functions pinned to search_path public, pg_temp (credits function previously lacked pg_temp)"
requirements-completed: []
duration: ~10 min
completed: 2026-10-01
---

# Phase 3 Plan 02: Trigger gate, probe and hand-off docs Summary

Ziko signup triggers now return early unless `raw_user_meta_data->>'app' = 'ziko'`, with trigger DDL in a separate post-import file, a self-rolling-back probe, and written contracts for Phase 4 (UUID remap) and Phase 6 (signup paths, OAuth, delta sync, notice send).

## Tasks

| Task | Commit |
|------|--------|
| 1: gate functions, triggers, probe | `484fe103` |
| 2, 3: Phase 6 hand-off, UUID remap spec | see `docs(03-02)` commit in git log |

## Verification

All automated task checks passed (guard count 2, search_path count 2, 2 triggers, no DROP/ALTER in the triggers file, 1 PROBE raise, existing Phase 2 migrations untouched, no email addresses in docs). Nothing was applied to any database; Plans 08 and 11 apply the SQL.

## Deviations from Plan

None. The signup enumeration found only two production paths (mobile register and Google OAuth); no web/backend/Swift creation path exists.

## Notes

- AUTHMIG-01/03/05 left unmarked in REQUIREMENTS.md: the SQL is authored but not applied or proven; AUTHMIG-05 stays open until the Phase 6 send.
- Git warns of LF-to-CRLF conversion on the new files; harmless.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

All five files exist; commit `484fe103` present.
