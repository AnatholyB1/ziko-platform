---
gsd_state_version: 1.0
milestone: v1.19
milestone_name: Migration Supabase ziko vers portfolio
status: Awaiting next milestone
stopped_at: Milestone v1.19 completed and archived
last_updated: "2026-10-06T14:52:05.295Z"
last_activity: 2026-10-06 — Milestone v1.19 completed and archived
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 82
  completed_plans: 82
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-06). v1.19 archive: .planning/workstreams/supabase-portfolio-migration/milestones/v1.19-ROADMAP.md, v1.19-REQUIREMENTS.md, MILESTONES.md

**Core value:** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and controls AI costs through gamified engagement. Coaches manage their clients, assign programs, and use AI to analyze and adapt those programs from the web CRM. (v1.19 consolidated its Supabase backend into the shared `portfolio` project.)
**Current focus:** Planning next milestone (v1.19 shipped 2026-10-06; carry-over items below)

## Current Position

Phase: Milestone v1.19 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-10-06 — Milestone v1.19 completed and archived

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
- RESOLVED in 07-14: Vercel Preview/Development scopes remediated and ziko-web SUPABASE_PUBLISHABLE_KEY removed (re-audit 87 rows clean)
- Orphan test PNG in ziko-coach-exercises; revoke stale CI token `ziko-ci-portfolio` (CI uses `ziko-ci-portfolio-2`, keep it)
- Milestone close-out carry (Phase 7): backup retention review by 2027-04-06 (GDPR); CI remote verify specs disabled (re-enable against a dedicated CI project); leftover Vercel resources `redis-crimson-brush`, `redis-ziko`, Neon `potsgres-ziko`; confirm nothing needed from the orphan PNG in ziko-coach-exercises (bucket deleted with ziko); PR #46 (phase 7) merged to main; PR #44 (docs) state not re-checked at close
- OUTSTANDING credentials (user chose "not now" at 07-19; NOT revoked, local PAT file deleted but tokens still valid in the account): revoke PATs `ziko-cutover-phase6` and `ziko-decom-phase7` (value pasted in chat) at https://supabase.com/dashboard/account/tokens; rotate the Vercel Protection Bypass for Automation secret on web and API (Settings > Deployment Protection). Keep `ziko-ci-portfolio-2`. Phase 6 credential retirement (06-20 Task 3) stays OPEN. Also: delete the kept passphrase file after confirming decrypt; portfolio login-role sweep not run

### Blockers/Concerns

- None blocking. Resolved blockers cleared at milestone close (portfolio live inventory done in Phase 1; table count reconciled to 99 live tables; OTA question settled in Phase 6; pause-before-delete question moot after deletion; collision-row NULL token columns fixed in 03-11). Open items for the user are under Deferred Items and Pending Todos.
- iOS is still unreleased, so the mobile app on the stores has not been confirmed to run against portfolio.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-10-06 (user chose "Acknowledge and close"):

| Category | Item | Status |
|----------|------|--------|
| verification_gap | Phase 03: 03-VERIFICATION.md | human_needed |
| verification_gap | Phase 07: 07-VERIFICATION.md | human_needed |

Carry-over items for the user (NOT done at close):

| Category | Item | Status |
|----------|------|--------|
| credential | Supabase PATs `ziko-auth-merge-temp`, `ziko-auth-merge-temp-2` (Phase 3) | not revoked (expire 2026-10-08) |
| credential | Supabase PAT `ziko-cutover-phase6` | not revoked |
| credential | Supabase PAT `ziko-decom-phase7` (value was pasted into a chat) | not revoked |
| credential | Supabase PAT `ziko-ci-portfolio` | not revoked (waived by user; keep `ziko-ci-portfolio-2`) |
| credential | Vercel Protection Bypass for Automation secret (web and API) | not rotated |
| credential | Local backup passphrase file | kept until the user confirms decrypt of the second copy |
| credential | portfolio login-role sweep | not run |
| credential | Phase 6 credential retirement (06-20 Task 3) | open |
| ops | API crons return 401 (CRON_SECRET on the API project) | open |
| mobile | iOS release (Sign in with Apple on the App ID, regenerate provisioning profile) | open |
| mobile | Play Console state of Android 1.5.0 (versionCode 16) | unconfirmed |
| ai | Anthropic balance empty; AI chat never verified on portfolio | open |
| ci | CI remote verify specs disabled (re-enable against a dedicated CI project) | open |
| infra | Leftover Vercel resources `redis-crimson-brush` (still listing ziko-web/ziko-api), `redis-ziko`, Neon `potsgres-ziko` | open |
| data | Backup retention review (GDPR) | due by 2027-04-06 |

## Session Continuity

Last session: 2026-10-06
Stopped at: Milestone v1.19 completed and archived (complete-milestone, 2026-10-06)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
