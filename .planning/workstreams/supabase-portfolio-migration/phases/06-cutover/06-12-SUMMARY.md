---
phase: 06-cutover
plan: 12
subsystem: cutover-preview-smoke
tags: [vercel-preview, portfolio, smoke, d-08]
requires: [06-11]
provides: [branch-scoped preview env on portfolio, preview-storage-auth.json, preview-signup-isolation.json]
affects: [06-14, 06-15]
key-files:
  created:
    - scripts/portfolio-migration/reports/preview-storage-auth.json
    - scripts/portfolio-migration/reports/preview-signup-isolation.json
    - scripts/portfolio-migration/baseline/portfolio-tenants-prepreview.json
    - scripts/portfolio-migration/baseline/portfolio-storage-tenants-prepreview.json
    - apps/web/.preview-rebuild
    - backend/api/.preview-rebuild
  modified:
    - scripts/portfolio-migration/17-env-switch.mjs
    - scripts/portfolio-migration/10-storage-auth-tests.mjs
    - .planning/workstreams/supabase-portfolio-migration/phases/06-cutover/06-CUTOVER-SMOKE-CHECKLIST.md
metrics:
  completed: 2026-10-03
---

# Phase 6 Plan 12: Preview smoke Summary

PREVIEW SMOKE: PASS

Branch-scoped Preview env for gsd/phase-6-cutover points ziko-api and ziko-web at portfolio, both previews are READY (built from f72e0e1a; later commits are docs/scripts only), harness smoke, signup isolation and core flows all pass, tenants show no rh_/gecko_ regression. AI chat check waived by the user (Anthropic balance empty).

## Step results

| Step | Result | Evidence |
|------|--------|----------|
| 0 gate grep | PASS | exact typed line present (d972cfe9) |
| 1 preview env, api (team anatholyb1s-projects, project ziko-api) | PASS | `--verify-remote`: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY present, branch gsd/phase-6-cutover only |
| 1 preview env, web (project ziko-web) | PASS | `--verify-remote`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY present; fingerprints URL a3934fcc, publishable e4575253, secret 0006453c (web) |
| 2 push + previews READY | PASS | api https://ziko-cf61m52hx-anatholyb1s-projects.vercel.app, web https://ziko-alua2sp9s-anatholyb1s-projects.vercel.app, built from f72e0e1a (after env was set) |
| 3 harness smoke (10) | PASS | 26/26, backend 14/14 incl. 6 coach routes and deny cases |
| 4 signup isolation (14) | PASS | exit 0 |
| 5 core flows (15, --skip-ai) | PASS | 13/13 against both preview URLs with bypass header; ai-chat WAIVED by user (Anthropic balance empty), not run; web-inlined-ref proven via ref-named auth cookie (see deviation 5); cleanup zero leftovers |
| 6 tenant diff (re-run after step 5) | PASS | 06-verify-data and 09-verify-storage exit 0, 0 regressions, rh_/gecko_ unchanged. All three reports grepped: no '@', UUID or JWT |

Reports grepped (incl. preview-core-flows.json): no '@', UUID or JWT. Production env was not touched (only `--vercel-env preview --git-branch gsd/phase-6-cutover` writes).

## Tenant note

06-verify-data emitted WARNs on non-ziko, non-rh/gecko tables: sv_client_members 1->2, sv_lead_events 3->5, sv_mail_outbox 0->1, sv_project_links 0->1, sv_projects 0->1, sv_throttle 15->19, auth.users 45->46. Re-run after step 5 shows further sv_* growth only (sv_mail_outbox 0->10, sv_project_facts 0->5, sv_project_files 0->2, sv_project_consents 0->2, sv_client_onboarding 0->1, sv_consent_log 3->4, sv_project_fact_notes 0->1, sv_throttle 15->25, bucket sv-project-files 0->2 objects); auth.users still 46 (smoke temp users cleaned up). No rh_/gecko_ or ziko change. These are the live Sevalys app (sevalys.com, deployed 4h earlier) with a coherent single sign-up (+1 auth user, +1 project, +1 member). No rh_/gecko_ change. Treated as unrelated live traffic, not a ziko cause; flagged for the orchestrator to confirm.

## Deviations from Plan

**1. [Rule 3 - Blocking] Branch must exist remote before branch-scoped env add**
Vercel returned branch_not_found. Pushed gsd/phase-6-cutover first, then set env (plan order was env then push).

**2. [Rule 1 - Bug] 17-env-switch could not add NEXT_PUBLIC_SUPABASE_KEY, and failed on Windows temp cleanup**
Vercel CLI requires `--type` for NEXT_PUBLIC_*KEY names; runner now passes `--type config` for them. Temp-dir removal EPERM made apply/verify exit 1 after success; rmSync now retries and is best effort (temp dir holds no secrets). Tests pass (9/9). Commit 255c4ebc.

**3. [Rule 3 - Blocking] Vercel ignoreCommand cancelled preview builds**
`git diff --quiet HEAD^ HEAD -- .` cancelled builds (root dirs backend/api, apps/web) for commits without changes there, including redeploys. Added marker files `apps/web/.preview-rebuild` and `backend/api/.preview-rebuild` (commit f72e0e1a). They can be deleted later.

**4. [Rule 1 - Bug] Harness smoke mode failed on empty ziko-coach-videos bucket**
First run: bk-videos-signed-url and bk-videos-audio-url "expected allow, observed error" (not a deny failure). Cause: portfolio bucket has 0 objects (source had none), nothing to sign. Smoke mode now seeds one tiny object under a test user's folder when a route bucket is empty; cleanup already removes objects in test-user folders. Tests 18/18, rerun PASS. Commit 35eb115b.

**5. [Rule 1 - Bug] web-inlined-ref check could not pass on public pages**
Web login is a server action and public chunks never inline any supabase.co URL (0 refs in /fr, /fr/login chunks), so the bundle scan failed for the right deployment. Check now proves the web's configured ref server-side: a temp coach session cookie named for the portfolio ref authenticates /fr/coach/dashboard (200) while a cookie named for the other ref gets the login redirect, and the authenticated page chunks carry no other ref. Script tests 5/5. Commit 3f67554a. The check id is unchanged.

## Commits

04fa0a56 baselines, d972cfe9 authorization, 255c4ebc env-switch fix, f72e0e1a rebuild markers, 35eb115b harness fix, 03709d8b reports + checklist, 3f67554a core flows report + web ref check fix + S-6 checklist.
