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

PREVIEW SMOKE: INCOMPLETE (step 5 waiting on bypass)

Branch-scoped Preview env for gsd/phase-6-cutover now points ziko-api and ziko-web at portfolio, both previews are READY, harness smoke and signup isolation pass, tenants show no rh_/gecko_ regression. Step 5 (core flows against the protected preview URLs) is blocked: `scripts/portfolio-migration/.vercel-bypass` is missing and the previews answer 302 to vercel.com/sso-api.

## Step results

| Step | Result | Evidence |
|------|--------|----------|
| 0 gate grep | PASS | exact typed line present (d972cfe9) |
| 1 preview env, api (team anatholyb1s-projects, project ziko-api) | PASS | `--verify-remote`: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY present, branch gsd/phase-6-cutover only |
| 1 preview env, web (project ziko-web) | PASS | `--verify-remote`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY present; fingerprints URL a3934fcc, publishable e4575253, secret 0006453c (web) |
| 2 push + previews READY | PASS | api https://ziko-cf61m52hx-anatholyb1s-projects.vercel.app, web https://ziko-alua2sp9s-anatholyb1s-projects.vercel.app, built from f72e0e1a (after env was set) |
| 3 harness smoke (10) | PASS | 26/26, backend 14/14 incl. 6 coach routes and deny cases |
| 4 signup isolation (14) | PASS | exit 0 |
| 5 core flows (15, --skip-ai) | NOT RUN | bypass file missing, preview protected (302 SSO). AI chat check waived (Anthropic balance empty, user-accepted) |
| 6 tenant diff | PASS | 06-verify-data and 09-verify-storage exit 0, 0 regressions, rh_/gecko_ unchanged |

Reports grepped: no '@', UUID or JWT. Production env was not touched (only `--vercel-env preview --git-branch gsd/phase-6-cutover` writes).

## Tenant note

06-verify-data emitted WARNs on non-ziko, non-rh/gecko tables: sv_client_members 1->2, sv_lead_events 3->5, sv_mail_outbox 0->1, sv_project_links 0->1, sv_projects 0->1, sv_throttle 15->19, auth.users 45->46. These are the live Sevalys app (sevalys.com, deployed 4h earlier) with a coherent single sign-up (+1 auth user, +1 project, +1 member). No rh_/gecko_ change. Treated as unrelated live traffic, not a ziko cause; flagged for the orchestrator to confirm.

## Deviations from Plan

**1. [Rule 3 - Blocking] Branch must exist remote before branch-scoped env add**
Vercel returned branch_not_found. Pushed gsd/phase-6-cutover first, then set env (plan order was env then push).

**2. [Rule 1 - Bug] 17-env-switch could not add NEXT_PUBLIC_SUPABASE_KEY, and failed on Windows temp cleanup**
Vercel CLI requires `--type` for NEXT_PUBLIC_*KEY names; runner now passes `--type config` for them. Temp-dir removal EPERM made apply/verify exit 1 after success; rmSync now retries and is best effort (temp dir holds no secrets). Tests pass (9/9). Commit 255c4ebc.

**3. [Rule 3 - Blocking] Vercel ignoreCommand cancelled preview builds**
`git diff --quiet HEAD^ HEAD -- .` cancelled builds (root dirs backend/api, apps/web) for commits without changes there, including redeploys. Added marker files `apps/web/.preview-rebuild` and `backend/api/.preview-rebuild` (commit f72e0e1a). They can be deleted later.

**4. [Rule 1 - Bug] Harness smoke mode failed on empty ziko-coach-videos bucket**
First run: bk-videos-signed-url and bk-videos-audio-url "expected allow, observed error" (not a deny failure). Cause: portfolio bucket has 0 objects (source had none), nothing to sign. Smoke mode now seeds one tiny object under a test user's folder when a route bucket is empty; cleanup already removes objects in test-user folders. Tests 18/18, rerun PASS. Commit 35eb115b.

## Resume point

Step 5 needs `scripts/portfolio-migration/.vercel-bypass` (gitignored, written by the user). Then run from repo root:
`node scripts/portfolio-migration/15-smoke-core-flows.mjs --project-ref ubxllsvanurkwkohzxau --confirm-ref ubxllsvanurkwkohzxau --api-url https://ziko-cf61m52hx-anatholyb1s-projects.vercel.app --web-url https://ziko-alua2sp9s-anatholyb1s-projects.vercel.app --bypass-file scripts/portfolio-migration/.vercel-bypass --skip-ai --authorization-file <06-AUTHORIZATIONS.md> --authorization-phrase "approve ubxllsvanurkwkohzxau option-preview-smoke" --report-out scripts/portfolio-migration/reports/preview-core-flows.json`
then repeat step 6 and grep the new report. Checklist item S-6 (/coach/imports) waits on this.

## Commits

04fa0a56 baselines, d972cfe9 authorization, 255c4ebc env-switch fix, f72e0e1a rebuild markers, 35eb115b harness fix, 03709d8b reports + checklist.
