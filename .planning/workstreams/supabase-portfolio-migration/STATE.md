---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: Migration Supabase ziko vers portfolio
status: complete
stopped_at: Completed 07-20-PLAN.md (docs close-out; deletion log is the final commit)
last_updated: "2026-10-06T14:10:27.167Z"
last_activity: 2026-10-06
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 82
  completed_plans: 82
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md and .planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md

**Core value:** Ziko's Supabase footprint (schema, data, auth, storage) is fully and safely consolidated into the shared `portfolio` project — zero data loss, zero regression on portfolio's existing tenants (rh_*, gecko_*), and the old `ziko` project deleted only after explicit, separate confirmation.
**Current focus:** Milestone close-out (Phase 7 complete)

## Current Position

Phase: 7 (Monitoring & Decommission) — complete (rollback window waived; credential retirement outstanding)
Plan: 22 of 22 (22 of 22 complete)
Status: Milestone v1.19 work complete; ziko deleted 2026-10-06T13:59:22Z; close-out carry items below
Last activity: 2026-10-06

Progress: [██████████] 100%

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
- [Phase 05]: 05-11: smoke harness drains public-read bodies (fetch stall fix, scratch-validated); portfolio storage migrated and verified
- [Phase 6]: OTA superseded: expo-updates is disabled natively, so the native build (1.5.0) is the mobile flip (REQUIREMENTS out-of-scope note amended)
- [Phase 6]: CI migrate job replaced by dormant ref-locked migrate-portfolio, enabled via PORTFOLIO_MIGRATIONS_ENABLED=true; CI verify secrets deliberately point at scratch; two remote timing specs skip on CI (PR #40)
- [Phase 6]: Branch policy: cutover merged to main through PRs #38-#43 with the env flipped first; web pinned back via `vercel rollback` after the merge deploy, then flipped with a fresh no-cache build and promote
- [Phase 6]: Rollback window starts at the backend flip, 2026-10-03T14:29:36Z; ziko project untouched (read-only intent, no writes since the final delta)
- [Phase 7]: D-01: DECOM-01 rollback window WAIVED by user 2026-10-04 (recorded as waived, not complete)
- [Phase 6]: User waived the mobile device checklist (never device-tested against portfolio) and AI chat checks (Anthropic balance empty); user chose Android-only store submission after the iOS build failed
- [Phase 07]: [07-09] PostgreSQL client tools 18.6 via scoop; bin dir prepended to PATH, no code change
- [Phase 07]: 07-12: restore proof passed; wipe CASCADE drops public extensions so restore recreates them; pg_restore uses --no-privileges
- [Phase 07]: 07-15: user waived ci_token_revoked (token ziko-ci-portfolio NOT revoked); waiver allowed for that single gate only
- [Phase 07]: 07-15 carry to milestone close-out: revoke stale token ziko-ci-portfolio manually
- [Phase 07]: freeze approach: ziko write-freeze (REVOKE + signup off, T0==T1 proof) replaced the waived rollback window
- [Phase 07]: CI remote verify specs disabled (ci-verify-target: disabled); scratch project deleted 2026-10-05
- [Phase 07]: ziko (slkobhavpwsubnsmuhya) deleted via Management API 2026-10-06T13:59:22Z, confirmed gone 13:59:33Z; D-15 confirmation "yes" at 13:56:46Z
- [Phase 07]: Backup retained indefinitely (D-08); 6-month GDPR retention review due by 2027-04-06

### Pending Todos

- Phase 6 smoke (from Phase 5), WAIVED not proven on device (API-level evidence only): mobile avatar (ziko-avatars), profile photo (ziko-profile-photos), exercise media (ziko-exercise-media), nutrition scan photo (ziko-scan-photos), plugin-coach logo (ziko-coach-logos), athlete video + coach view (ziko-coach-videos)
- Phase 6 smoke items for the 6 backend routes, 4 web coach flows and the codemod merge are proven (see ROADMAP Phase 6 carried items)
- iOS release: enable Sign in with Apple on the App ID, regenerate the provisioning profile (eas credentials), tag v1.5.2
- Play Console: confirm the production release state of Android 1.5.0 (versionCode 16, submission finished)
- Anthropic balance empty: AI chat never verified on portfolio
- API crons all return 401 (pre-existing since at least 2026-09-29): check CRON_SECRET on the API project
- Vercel Preview/Development scopes of the shared web env records may still hold ziko values; SUPABASE_PUBLISHABLE_KEY on ziko-web untouched
- Orphan test PNG in ziko-coach-exercises; revoke stale CI token `ziko-ci-portfolio` (CI uses `ziko-ci-portfolio-2`, keep it)
- Milestone close-out carry (Phase 7): backup retention review by 2027-04-06 (GDPR); CI remote verify specs disabled (re-enable against a dedicated CI project); leftover Vercel resources `redis-crimson-brush`, `redis-ziko`, Neon `potsgres-ziko`; confirm nothing needed from the orphan PNG in ziko-coach-exercises (bucket deleted with ziko); PR #46 (phase 7) and PR #44 (docs) open
- OUTSTANDING credentials (user chose "not now" at 07-19; NOT revoked, local PAT file deleted but tokens still valid in the account): revoke PATs `ziko-cutover-phase6` and `ziko-decom-phase7` (value pasted in chat) at https://supabase.com/dashboard/account/tokens; rotate the Vercel Protection Bypass for Automation secret on web and API (Settings > Deployment Protection). Keep `ziko-ci-portfolio-2`. Phase 6 credential retirement (06-20 Task 3) stays OPEN. Also: delete the kept passphrase file after confirming decrypt; portfolio login-role sweep not run

### Blockers/Concerns

- `portfolio`'s actual live schema/triggers/functions/buckets are unverified from this repo — Phase 1 must resolve this via direct Supabase inspection before Phase 2 can be finalized
- True table/function count discrepancy (PROJECT.md says 73 migrations/93 tables; live grep found ~90 files/~100 `CREATE TABLE` statements) must be reconciled against `ziko`'s live `information_schema`, not migration file counts
- RESOLVED by Phase 7: ziko deleted, no further pause question. Mobile-tail strategy: OTA is infeasible, native build is the flip (resolved in Phase 6); the remaining question is the drain window of old binaries before Phase 7 decommission, and iOS is not released yet
- Whether `portfolio`'s plan tier supports "pause" as an intermediate step before hard deletion is unverified — check before finalizing the Phase 7 runbook
- 03-11: portfolio collision row 2b6a60fa has NULL token columns -> GoTrue admin HTTP 500; needs user-approved guarded fill before trigger stage

## Session Continuity

Last session: 2026-10-06
Stopped at: Completed 07-20-PLAN.md (docs close-out; deletion log is the final commit)
Resume file: None
