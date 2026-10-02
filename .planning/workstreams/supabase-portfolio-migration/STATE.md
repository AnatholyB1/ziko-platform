---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: Migration Supabase ziko vers portfolio
status: executing
stopped_at: "Phase 5: plans 01-08 done; awaiting Management API token for 05-09 scratch rehearsal"
last_updated: "2026-10-02T15:52:45.247Z"
last_activity: 2026-10-02 -- Phase 5 execution started
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 40
  completed_plans: 37
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md and .planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md

**Core value:** Ziko's Supabase footprint (schema, data, auth, storage) is fully and safely consolidated into the shared `portfolio` project — zero data loss, zero regression on portfolio's existing tenants (rh_*, gecko_*), and the old `ziko` project deleted only after explicit, separate confirmation.
**Current focus:** Phase 5 — Storage Migration

## Current Position

Phase: 5 (Storage Migration) — EXECUTING
Plan: 1 of 11
Status: Executing Phase 5
Last activity: 2026-10-02 -- Phase 5 execution started

Progress: [█████████░] 93%

## Accumulated Context

### Decisions

- 7-phase structure derived from research SUMMARY.md, aligned to the 7 requirement categories (INV/SCHEMA/AUTHMIG/DATA/STORAGE/CUTOVER/DECOM); Storage (Phase 5) is architecturally independent and may run parallel to Phases 2-4
- Auth merge (Phase 3) hard-gated before data copy (Phase 4) — FKs to `auth.users(id)` require the referenced rows to exist first
- Decommission (Phase 7) structurally separated from Cutover (Phase 6) by a monitoring/rollback window; deletion requires its own explicit, separate human confirmation — never bundled with cutover sign-off
- [Phase ?]: Phase 03-01: volatile auth columns defined once in scripts/auth-merge/lib.mjs; use glob form for node --test on Node 26
- [Phase 03]: 03-02: ziko auth trigger functions gated on app=ziko, search_path public, pg_temp; triggers attached in separate post-import file
- [Phase 03]: 03-08: NULL instance_id blocks GoTrue login on scratch; Plan 10 must pick the instance-id fix option
- [Phase 03]: 03-11: user-authorized guarded NULL-to-empty fill of 4 GoTrue token columns on the collision row (--fill-null-token-columns, --allow-token-fill)
- [Phase 4]: Phase 4-03: FOREIGN_REFERRERS_SQL lives in 05-load-data.mjs (04-02 REFERRERS_SQL has sequence semantics)

### Pending Todos

- Phase 6 smoke (from Phase 5): backend (ziko-coach-kyc): GET /coach/clients/links/me: full-route smoke against portfolio after the table-name codemod
- Phase 6 smoke (from Phase 5): backend (ziko-coach-videos): POST /coach/videos/upload-url: full-route smoke against portfolio after the table-name codemod
- Phase 6 smoke (from Phase 5): backend (ziko-coach-videos): GET /coach/videos/:videoId/signed-url: full-route smoke against portfolio after the table-name codemod
- Phase 6 smoke (from Phase 5): backend (ziko-coach-videos): GET /coach/videos/annotations/:annotationId/audio-url: full-route smoke against portfolio after the table-name codemod
- Phase 6 smoke (from Phase 5): backend (ziko-coach-exercises): GET /coach/exercises/:id/media-url: full-route smoke against portfolio after the table-name codemod
- Phase 6 smoke (from Phase 5): backend (ziko-ai-imports): POST /coach/imports: full-route smoke against portfolio after the table-name codemod
- Phase 6 smoke (from Phase 5): mobile profile (ziko-avatars): avatar upload and display (D-10 UI-level flow)
- Phase 6 smoke (from Phase 5): mobile profile (ziko-profile-photos): profile photo upload, display and remove (D-02 quirk expected: private bucket, public SELECT policy, no DELETE policy)
- Phase 6 smoke (from Phase 5): mobile workout (ziko-exercise-media): exercise media display in the exercise screen and picker
- Phase 6 smoke (from Phase 5): plugin-nutrition (ziko-scan-photos): scan photo upload via /storage/upload-url and display
- Phase 6 smoke (from Phase 5): plugin-coach (ziko-coach-logos): coach logo display
- Phase 6 smoke (from Phase 5): web coach (ziko-coach-kyc): KYC document upload and api/photo display
- Phase 6 smoke (from Phase 5): web coach (ziko-coach-exercises): coach exercise media upload
- Phase 6 smoke (from Phase 5): web coach (ziko-coach-logos): coach logo upload and branding preview
- Phase 6 smoke (from Phase 5): web coach (ziko-ai-imports): coach AI import upload
- Phase 6 smoke (from Phase 5): mobile athlete + web coach (ziko-coach-videos): athlete video upload and coach view
- Phase 6 smoke (from Phase 5): codemod (all ziko- buckets): re-run 11-codemod-buckets.mjs --apply on a fresh main (or rebase gsd/phase-5-bucket-codemod), run --check with its repo-wide residual pass, merge together with the Vercel env flip, never before

### Blockers/Concerns

- `portfolio`'s actual live schema/triggers/functions/buckets are unverified from this repo — Phase 1 must resolve this via direct Supabase inspection before Phase 2 can be finalized
- True table/function count discrepancy (PROJECT.md says 73 migrations/93 tables; live grep found ~90 files/~100 `CREATE TABLE` statements) must be reconciled against `ziko`'s live `information_schema`, not migration file counts
- Mobile-tail strategy (OTA vs. native rebuild, acceptable drain window before Phase 7 decommission) is a product decision, not resolved by research — needs explicit discussion before Phase 6/7 planning
- Whether `portfolio`'s plan tier supports "pause" as an intermediate step before hard deletion is unverified — check before finalizing the Phase 7 runbook
- 03-11: portfolio collision row 2b6a60fa has NULL token columns -> GoTrue admin HTTP 500; needs user-approved guarded fill before trigger stage

## Session Continuity

Last session: 2026-10-02T15:52:45.223Z
Stopped at: Phase 5: plans 01-08 done; awaiting Management API token for 05-09 scratch rehearsal
Resume file: .planning/workstreams/supabase-portfolio-migration/phases/05-storage-migration/05-09-PLAN.md
