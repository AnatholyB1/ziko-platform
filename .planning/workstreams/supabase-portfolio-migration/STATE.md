---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: Migration Supabase ziko vers portfolio
status: planning
stopped_at: Phase 2 context gathered
last_updated: "2026-09-22T13:26:20.353Z"
last_activity: 2026-09-22
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md and .planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md

**Core value:** Ziko's Supabase footprint (schema, data, auth, storage) is fully and safely consolidated into the shared `portfolio` project — zero data loss, zero regression on portfolio's existing tenants (rh_*, gecko_*), and the old `ziko` project deleted only after explicit, separate confirmation.
**Current focus:** Phase 2 — schema rename & function/rls rewrite

## Current Position

Phase: 2 of 7 (schema rename & function/rls rewrite)
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-22

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

- 7-phase structure derived from research SUMMARY.md, aligned to the 7 requirement categories (INV/SCHEMA/AUTHMIG/DATA/STORAGE/CUTOVER/DECOM); Storage (Phase 5) is architecturally independent and may run parallel to Phases 2-4
- Auth merge (Phase 3) hard-gated before data copy (Phase 4) — FKs to `auth.users(id)` require the referenced rows to exist first
- Decommission (Phase 7) structurally separated from Cutover (Phase 6) by a monitoring/rollback window; deletion requires its own explicit, separate human confirmation — never bundled with cutover sign-off

### Pending Todos

None yet.

### Blockers/Concerns

- `portfolio`'s actual live schema/triggers/functions/buckets are unverified from this repo — Phase 1 must resolve this via direct Supabase inspection before Phase 2 can be finalized
- True table/function count discrepancy (PROJECT.md says 73 migrations/93 tables; live grep found ~90 files/~100 `CREATE TABLE` statements) must be reconciled against `ziko`'s live `information_schema`, not migration file counts
- Mobile-tail strategy (OTA vs. native rebuild, acceptable drain window before Phase 7 decommission) is a product decision, not resolved by research — needs explicit discussion before Phase 6/7 planning
- Whether `portfolio`'s plan tier supports "pause" as an intermediate step before hard deletion is unverified — check before finalizing the Phase 7 runbook

## Session Continuity

Last session: 2026-09-22T13:26:20.326Z
Stopped at: Phase 2 context gathered
Resume file: .planning/workstreams/supabase-portfolio-migration/phases/02-schema-rename-function-rls-rewrite/02-CONTEXT.md
