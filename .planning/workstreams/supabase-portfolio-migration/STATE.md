---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: Migration Supabase ziko vers portfolio
status: executing
stopped_at: Phase 4 context gathered
last_updated: "2026-10-02T11:37:50.495Z"
last_activity: 2026-10-02
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 29
  completed_plans: 25
  percent: 43
---

# Project State

## Project Reference

See: .planning/PROJECT.md and .planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md

**Core value:** Ziko's Supabase footprint (schema, data, auth, storage) is fully and safely consolidated into the shared `portfolio` project — zero data loss, zero regression on portfolio's existing tenants (rh_*, gecko_*), and the old `ziko` project deleted only after explicit, separate confirmation.
**Current focus:** Phase 4 — Data Copy & Integrity Verification

## Current Position

Phase: 4 (Data Copy & Integrity Verification) — EXECUTING
Plan: 4 of 7
Status: Ready to execute
Last activity: 2026-10-02

Progress: [█████████░] 86%

## Accumulated Context

### Decisions

- 7-phase structure derived from research SUMMARY.md, aligned to the 7 requirement categories (INV/SCHEMA/AUTHMIG/DATA/STORAGE/CUTOVER/DECOM); Storage (Phase 5) is architecturally independent and may run parallel to Phases 2-4
- Auth merge (Phase 3) hard-gated before data copy (Phase 4) — FKs to `auth.users(id)` require the referenced rows to exist first
- Decommission (Phase 7) structurally separated from Cutover (Phase 6) by a monitoring/rollback window; deletion requires its own explicit, separate human confirmation — never bundled with cutover sign-off
- [Phase ?]: Phase 03-01: volatile auth columns defined once in scripts/auth-merge/lib.mjs; use glob form for node --test on Node 26
- [Phase 03]: 03-02: ziko auth trigger functions gated on app=ziko, search_path public, pg_temp; triggers attached in separate post-import file
- [Phase 03]: 03-08: NULL instance_id blocks GoTrue login on scratch; Plan 10 must pick the instance-id fix option
- [Phase 03]: 03-11: user-authorized guarded NULL-to-empty fill of 4 GoTrue token columns on the collision row (--fill-null-token-columns, --allow-token-fill)

### Pending Todos

None yet.

### Blockers/Concerns

- `portfolio`'s actual live schema/triggers/functions/buckets are unverified from this repo — Phase 1 must resolve this via direct Supabase inspection before Phase 2 can be finalized
- True table/function count discrepancy (PROJECT.md says 73 migrations/93 tables; live grep found ~90 files/~100 `CREATE TABLE` statements) must be reconciled against `ziko`'s live `information_schema`, not migration file counts
- Mobile-tail strategy (OTA vs. native rebuild, acceptable drain window before Phase 7 decommission) is a product decision, not resolved by research — needs explicit discussion before Phase 6/7 planning
- Whether `portfolio`'s plan tier supports "pause" as an intermediate step before hard deletion is unverified — check before finalizing the Phase 7 runbook
- 03-11: portfolio collision row 2b6a60fa has NULL token columns -> GoTrue admin HTTP 500; needs user-approved guarded fill before trigger stage

## Session Continuity

Last session: 2026-10-02T11:37:42.172Z
Stopped at: Phase 4 context gathered
Resume file: None
