---
phase: 06-cutover
plan: 20
status: awaiting-credential-retirement
requirements: [CUTOVER-01, CUTOVER-02, CUTOVER-03, CUTOVER-04, CUTOVER-05]
---

# Phase 06 Plan 20: Final regression, docs and Phase 7 hand-off Summary

Status: awaiting-credential-retirement. Tasks 1 and 2 are done; Task 3 (credential retirement, a human-action checkpoint) has NOT run. Phase 6 is NOT complete: the mobile flip was not achieved.

The plan's Task 1 precondition (`MOBILE FLIP: PASS` from 06-19) was not met. Task 1 was run anyway on the orchestrator's instruction (read-only), and the docs were updated honestly instead of showing Phase 6 as done.

## Task 1: final regression, leftovers, crons (read-only)

Evidence: `scripts/portfolio-migration/reports/portfolio-cutover-final.json` (PII-free, grep gate clean). Commit f29fb59f.

- Data tenants (`06-verify-data --check tenants` vs the pre-cutover baseline): PASS, 55 tables, 4 row-count deltas, all `sv_*` (sv_mail_outbox 10 to 22, sv_project_fact_notes 1 to 4, sv_project_facts 5 to 8, sv_throttle 25 to 23). Zero `rh_`/`gecko_` change.
- Storage tenants (`09-verify-storage --check tenants`): PASS, 17 non-ziko policies unchanged, 0 regressions. Non-ziko buckets 8 in the baseline, 9 now: one new bucket `sv-documents` (Sevalys).
- Auth tenants (`scripts/auth-merge/06-verify --check tenants`): PASS, 46 users now vs 46 in the baseline; only `sv_*` row drift warnings (sv_mail_outbox +12, sv_project_fact_notes +3, sv_project_facts +3, sv_throttle -2).
- Integrity: rls 99/99 tables, triggers 18 inspected 0 not enabled, fk 144 validated, orphans 0.
- Leftovers: 0 temp test users (example.com test patterns), 0 ziko profiles for such users, 39 ziko profiles total, 0 new ziko accounts since the flip. The one user created in the last 24h predates the pre-cutover baseline and is not a ziko account.
- Production health: ziko-api-lilac /health 200, api.ziko-app.com /health 200, ziko-app.com 200, web login 200.
- Crons: only `/notifications/cron/streak-at-risk` ran since the backend flip (2026-10-03 21:00Z) and returned **401**. Every cron run in the last 7 days returned 401 on deployments before and after the flip, so this is pre-existing (CRON_SECRET / Bearer mismatch), not caused by the cutover. The plan expected 2xx: NOT met. Carried as an open item.
- No unexplained `rh_`/`gecko_` change, so no STOP condition.

## Task 2: planning docs and Phase 7 hand-off

Commit 5ad4ed09. Files changed (CRLF newlines preserved in all):

- ROADMAP.md: all 17 carried items checked with a proof pointer (6 backend routes: prod-backend-storage-auth.json cases; web coach items: prod-web-storage-auth.json and checklist W rows; codemod item: checklist S-7). The 6 mobile UI items are checked but labeled WAIVED (never device-tested, API-level evidence only). Phase 6 stays unchecked with a "NOT COMPLETE" status block listing what is open; plan 06-18 shown as complete with waiver, 06-19 partial, 06-20 Tasks 1-2 done; Progress row says in progress.
- REQUIREMENTS.md: CUTOVER-01, 02, 04, 05 marked done; CUTOVER-03 left open as Partial (mobile not achieved); OTA out-of-scope note amended (OTA infeasible because expo-updates is disabled natively, the native build is the mobile flip).
- STATE.md: status awaiting-credential-retirement, position and progress honest (58/60 plans), Phase 6 decisions recorded (OTA superseded, CI job replaced and ref-locked, branch policy, web pin via rollback, rollback window start, waivers), the proven smoke todos cleared and replaced by the real open items.
- HANDOFF.json: key `phase7_handoff_from_phase6` added (backend_flip_at 2026-10-03T14:29:36Z, web_flip_at 2026-10-03T15:08:02Z, mobile_release_tag, rollback_window_starts_at = backend_flip_at, ziko_untouched true, 12 open items incl. the iOS release). All other keys kept, JSON valid.
- RUNBOOK.md: section 6.7 "As executed" (timeline, deviations, no secrets).
- Grep gate on inserted text: no '@', UUIDs or JWT fragments.

## Open items carried to Phase 7

iOS release (Sign in with Apple missing from the provisioning profile); Play Console confirmation of Android 1.5.0 (versionCode 16); app never device-tested against portfolio (checklist waived); Anthropic balance empty (AI chat never verified on portfolio); API crons returning 401; Preview/Development Vercel env scopes of shared web records possibly still on ziko; SUPABASE_PUBLISHABLE_KEY on ziko-web; orphan test PNG in ziko-coach-exercises; stale CI token `ziko-ci-portfolio` to revoke (keep `ziko-ci-portfolio-2`); CI verify secrets point at scratch and two remote timing specs skip on CI (PR #40); old mobile binaries still on ziko; Sevalys (`sv_*`) drift is live traffic, not ours.

## Task 3 (pending, human-action)

Not run. Files still on disk: `scripts/auth-merge/.access-token`, `scripts/portfolio-migration/.vercel-bypass`, `scripts/portfolio-migration/.tmp-storage-copy-ubxllsvanurkwkohzxau.json`. Claude deletes these three and confirms none remain; the user revokes PAT `ziko-cutover-phase6` at the Supabase account tokens page and optionally rotates the Vercel Protection Bypass for Automation secret on the web and API projects, then replies `revoked`. Revocation confirmation: pending.

## Docs-only PR

Branch gsd/phase-6-cutover pushed and a docs-only PR to main opened; NOT merged (hard limit: no pushes to main from this run). PR URL: https://github.com/AnatholyB1/ziko-platform/pull/44 (open, diff limited to .planning/ and scripts/portfolio-migration/, awaiting merge decision).

## Deviations from Plan

- Task 1 ran although its precondition (MOBILE FLIP: PASS) was not met (orchestrator instruction); Phase 6 and CUTOVER-03 are deliberately not marked done.
- The plan expected crons to answer 2xx; they answer 401 (pre-existing).
- gsd-sdk roadmap/requirements handlers were not used: they would count the on-disk summaries as complete and overstate Phase 6; docs edited by hand.

## Known Stubs

None.
