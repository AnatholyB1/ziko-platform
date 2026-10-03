# Phase 6 Plan 17: CI Repoint Summary

STATUS: BLOCKED (CUTOVER-05 not proven). `CI REPOINT: PASS` is NOT recorded.

Verify is now green (PR #39 and PR #40 fixed it), but migrate-portfolio fails at `Link portfolio project`: the stored `SUPABASE_ACCESS_TOKEN` is rejected by the Supabase CLI with "Invalid access token format. Must be like `sbp_0102...1920`."

## What was done (re-run of Task 4)

- Step 0 gate: authorization line present in 06-AUTHORIZATIONS.md (commit e2f96581), `verify-secrets: scratch`.
- `SUPABASE_PROJECT_ID` = ubxllsvanurkwkohzxau (updated 2026-10-03T16:24:48Z).
- Verify secrets point at scratch rkirvurggtgjlkeuhded: SUPABASE_URL 15:53:53Z, SUPABASE_PUBLISHABLE_KEY 15:53:54Z, SUPABASE_SERVICE_ROLE_KEY 15:53:55Z.
- `SUPABASE_ACCESS_TOKEN` updated 2026-10-03T16:23:11Z (`ziko-ci-portfolio`, set by the user).
- `PORTFOLIO_MIGRATIONS_ENABLED=true` set, run dispatched, then DELETED after the failure (job dormant; variable list is empty).
- Dispatched run on main: 37138638180
  https://github.com/AnatholyB1/ziko-platform/actions/runs/37138638180
- Context: PR #39 (TS6307 + stale test paths) and PR #40 (8875a730, two latency-sensitive timing specs skipped when CI is set) are merged.

## Evidence

Attempt 1 of the run: type-check / lint / test failed. Failures were `duplicate key value violates unique constraint "ziko_coach_invitations_code_key"` in clients-preview, clients-summary and invitations specs. Cause is most likely a concurrent push-triggered CI run (37138602718, started 34s earlier) sharing the same scratch database. This is not one of the two skipped timing specs. One `gh run rerun --failed` was done (the one allowed rerun); with no concurrent run, verify then passed.

Final job conclusions (run 37138638180):
- type-check / lint / test: success (after the rerun)
- migration-guard: success
- Verify no react-native in web bundle: success
- Verify no SERVICE_ROLE under coach/: success
- coach-sdk zod resolves to root zod: success
- migrate-portfolio: FAILURE at step `Link portfolio project`

Marker assertions:
- `project ref ok`: present (ref guard passed).
- `ziko_ tables: N` (N >= 99): NOT reached.
- `no pending portfolio migrations`: NOT reached.
- `grep -cE "db push|migration repair"` over the whole run log: 0.

## Open items

- `SUPABASE_ACCESS_TOKEN` is not a valid Supabase personal access token. It must start with `sbp_`. Likely cause: wrong value pasted (for example an API key, or extra characters or whitespace). The user must mint a fresh token at https://supabase.com/dashboard/account/tokens and run `gh secret set SUPABASE_ACCESS_TOKEN` themselves (the agent never sees it).
- After the secret is fixed: `gh variable set PORTFOLIO_MIGRATIONS_ENABLED --body true`, then `gh workflow run ci.yml --ref main`. Do not trigger other CI runs (a push or PR) at the same time, because the verify suites share the scratch DB and collide on invitation codes.
- Trade-off recorded: the two timing specs (coach/timing.spec.ts and rls/redeem-rpc.spec.ts) no longer run on CI. The verify suites also share one scratch DB, so concurrent CI runs can fail spuriously.
- No workflow or code changes were made in this task.
