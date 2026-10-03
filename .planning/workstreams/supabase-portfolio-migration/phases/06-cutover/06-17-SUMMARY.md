# Phase 6 Plan 17: CI Repoint Summary

STATUS: BLOCKED (CUTOVER-05 not yet proven). `CI REPOINT: PASS` is NOT recorded.

## What was done

- Step 0 gate: authorization line present (commit e2f96581, `verify-secrets: scratch`).
- `SUPABASE_PROJECT_ID` set to ubxllsvanurkwkohzxau (updated 2026-10-03T16:24:48Z).
- Secrets (names/update dates only): SUPABASE_URL 15:53:53Z, SUPABASE_PUBLISHABLE_KEY 15:53:54Z, SUPABASE_SERVICE_ROLE_KEY 15:53:55Z (all scratch rkirvurggtgjlkeuhded, set by orchestrator); SUPABASE_ACCESS_TOKEN 16:23:11Z (new `ziko-ci-portfolio`).
- `PORTFOLIO_MIGRATIONS_ENABLED=true` set, then DELETED after failure (job dormant again).
- Dispatched `ci.yml` on main: run 37136754071
  https://github.com/AnatholyB1/ziko-platform/actions/runs/37136754071
  (PR #39 TS6307 + stale test paths fix already merged.)

## Evidence

Job conclusions (initial run and `--failed` rerun identical): type-check / lint / test = failure; migration-guard, no-RN-in-web, coach-sdk zod, no SERVICE_ROLE = success; migrate-portfolio = skipped (needs verify).

Failing tests (both attempts, backend, live scratch DB latency-sensitive):
- test/coach/timing.spec.ts peek_invitation p99-p1 < 100ms: 301.99ms, then 173.04ms
- test/rls/redeem-rpc.spec.ts constant-time p95 variance <= 35ms: 264.90ms, then 165.71ms

Marker assertions (`project ref ok`, `ziko_ tables >= 99`, `no pending portfolio migrations`, zero `db push|migration repair`) were not evaluated: migrate-portfolio never ran.

## Open items

- Two latency-based timing specs (coach/timing.spec.ts and rls/redeem-rpc.spec.ts) fail on GitHub runners against the scratch project; a rerun did not clear them, so the "single flaky spec" assumption does not hold. Decision needed: relax/skip these timing thresholds in CI (code change via PR), or run them against a lower-latency target.
- No workflow changes were made. After resolution: `gh variable set PORTFOLIO_MIGRATIONS_ENABLED --body true` and `gh workflow run ci.yml --ref main`.
- SUPABASE_PROJECT_ID is already portfolio; the variable is unset so migrate-portfolio stays dormant.
