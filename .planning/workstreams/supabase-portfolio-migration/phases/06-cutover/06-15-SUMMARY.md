---
phase: 06-cutover
plan: 15
status: complete
requirements: [CUTOVER-02, CUTOVER-03, CUTOVER-04]
---

# 06-15 Summary: production backend flip to portfolio

BACKEND FLIP SMOKE: PASS

Authorized by the typed line in 06-AUTHORIZATIONS.md (875ed6e6). Step 0 gate grep passed before any change. Web was never flipped.

## Timeline (UTC, 2026-10-03)

| Event | Time |
|-------|------|
| API production env flip (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY) | 14:29:36 to 14:29:56 |
| Cutover PR #38 merged (merge commit d575d456) | 14:30:34 |
| Web merge deployment READY (ziko-lwdci40oc) | about 14:31:30 |
| API merge deployment READY (ziko-38ywuo1dk) | about 14:32:00 |
| Web pinned to WEB_PREV (`vercel rollback`) | 14:37:35 to 14:37:40 |
| Smoke (core flows, storage-auth, signup isolation) | 14:39:58 to 14:43:54 |
| Push webhook real event / 200 observed | 14:45:34 / 14:45:38 |

## Steps

1. `17-env-switch --surface api --target portfolio --apply` exit 0, `--verify-remote` exit 0 (3 names present, no relogin var). Fingerprints only, no values logged.
2. `gh pr merge 38 --merge`: MERGED. This was the first production API build with ziko_ code, and it landed with the portfolio env already set (D-08).
3. Both production deployments READY. Web pinned back to WEB_PREV (dpl_Gcm7f2a7...) after READY. The www and apex login pages now serve that deployment id (`dpl_Gcm7f2a7...` in the page, matching the rollback output).
4. Smoke against https://ziko-api-lilac.vercel.app (api.ziko-app.com also 200 on /health):
   - `15-smoke-core-flows --skip-web --skip-ai`: PASS 10/10 (api-health, login, credits, profile read, own-row write/read/delete, coach-crm-read, unauth-denied, cleanup zero leftovers).
   - `10-storage-auth-tests --mode smoke`: PASS 26/26 (mobile-profile 2, web-coach 6, plugin-coach 2, plugin-nutrition 2, backend 14).
   - `14-signup-isolation`: PASS.
5. Push webhook: unauthenticated POST returned 401 (route alive, secret enforced). A real temp ziko user got a ziko_workout_sessions UPDATE (ended_at NULL to timestamp); the API logged `POST /push-events/supabase` 200 on api.ziko-app.com, 4 seconds after the update. No `[push-events] Unhandled event` line in the production log window, so the handled ziko_ table branch ran and the secret in the portfolio trigger matches WEBHOOK_SECRET. Temp user cleaned: 0 leftover users, 0 leftover ziko_ rows.
6. Tenant diff: `06-verify-data --check tenants`: 55 tables, 0 row-count deltas. `09-verify-storage --check tenants`: 8 non-ziko buckets, 17 non-ziko policies, 0 regressions. No rh_/gecko_ change, and no sv_ drift in this window.
7. Reports grepped: no `@`, UUID or JWT. S-7 codemod `--check` for buckets and tables clean on the merged tree. Checklist Section C updated.

## AI chat check: WAIVED

The Anthropic balance is empty. The user accepted waiving the AI-chat check for this cutover, so `--skip-ai` was passed. Not verified in production.

## Deviations and notes

- Web exposure window longer than planned. After the merge, web ran new code against the ziko env from about 14:31:30 until the pin at 14:37:40 (about 6 minutes), because the polling loop did not act on web READY until both deployments had been observed. No users, no errors observed, pin confirmed. Recorded under T-6-62 as accepted.
- CI check `type-check / lint / test` on PR #38 was red from `@ziko/plugin-coach#type-check` TS6307 (tsconfig file list). Not secret targeting. It was already red on main before this plan (main CI failing since 06-07, documented in 06-07 and 06-08 summaries). No `CI-checks decision:` line was written; merge proceeded on the orchestrator's instruction that Tasks 1 and 2 were complete. Flagged for the user. `rls`, `migration-guard` and the other checks were green; `migrate-portfolio` skipped as expected.
- Web domain proof used the served deployment id, not the Supabase ref: the login page chunks contain neither the ziko nor the portfolio ref literal (ref is not inlined in them), so the plan's ref-presence check was inconclusive. The id match against the rollback output is the evidence.
- WEBHOOK_SECRET presence was not read by name (Vercel `env ls` hangs); proven functionally by the 200 on the real trigger.
- Local branch gsd/phase-6-cutover is one docs commit (875ed6e6) ahead of origin and has not been pushed.
- API rollback was not needed and was not executed. Rollback targets remain: API_PREV ziko-5zc66dk2x, WEB_PREV ziko-7xwkvllrp.

## Known Stubs

None.
