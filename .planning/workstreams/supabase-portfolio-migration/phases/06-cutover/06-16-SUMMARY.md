---
phase: 06-cutover
plan: 16
status: awaiting-user-ui-review (Task 4)
requirements: [CUTOVER-02, CUTOVER-03, CUTOVER-04]
---

# 06-16 Summary: production web flip to portfolio

WEB FLIP SMOKE (scripted): PASS

Task 4 (the user's UI checklist W-01, W-02, W-03, W-04, W-06) is NOT done. The final `WEB FLIP SMOKE: PASS` line is deliberately not written yet: it depends on the user's results. W-05 stays pending 06-18.

Authorized by the typed line in 06-AUTHORIZATIONS.md (0f6916cb). Step 0 gate grep passed before any change.

## Timeline (UTC, 2026-10-03)

| Event | Time |
|-------|------|
| Web Production env flip (5 names) | 15:00:00 to 15:00:37 |
| `--verify-remote` (names present) | right after, exit 0 |
| Fresh redeploy started (no cache) | 15:02:37 |
| WEB_NEW READY | about 15:04:37 |
| `vercel promote` | 15:07:35 to 15:08:02 |
| Core-flow smoke | 15:09:23 to 15:09:46 |
| Storage smoke incl. web live spec | 15:10:04 to 15:13:01 |
| Tenant diffs | after 15:13 |

## Deployments

- WEB_PREV (rollback target, untouched): dpl_Gcm7f2a75LGVsbn4Vy3nLAm6RdE1
- WEB_MERGE (built with ziko env, NOT promoted): dpl_99JbsDk3ZLcnyvuLGDFLZqH1hbrq
- WEB_NEW (fresh build after env flip, now serving production): dpl_3awm4RAZcYwAGzXiRXk1EgfTaNW4 (ziko-1pa9s4ewv-anatholyb1s-projects.vercel.app)

## Steps

1. `17-env-switch --surface web --target portfolio --apply` exit 0: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (fingerprints only). `--verify-remote` exit 0, all 5 present. The relogin cutover-date var is not set.
2. `vercel redeploy WEB_MERGE --target production`: build log shows "Skipping build cache, deployment was triggered without cache", `turbo run build` with "cache bypass, force executing" for coach-sdk and ziko-web, `next build --turbopack` compiled and generated 66/66 static pages. READY, then `vercel promote` succeeded. ziko-app.com and www.ziko-app.com login pages now both serve `dpl_3awm4RAZcYwA...` (WEB_NEW).
3. `15-smoke-core-flows --skip-ai` against prod API and https://ziko-app.com: PASS 13/13 including web-home, web-login, web-inlined-ref (portfolio ref present, ziko ref absent) and cleanup-zero-leftovers. Report: reports/prod-web-core-flows.json. The page-chunk grep (my own check) found neither ref literal in the login chunks, same as 06-15; the smoke's web-inlined-ref check was conclusive, and the served deployment id equals the fresh build.
4. Web live spec: the spec cannot run in `full` mode on portfolio (refused). It is driven by `10-storage-auth-tests --mode smoke --confirm-ref`, which writes the gitignored fixture (throwaway users, real sessions, read/denial/signed-URL only, no object written except the harness's documented route-fixture handling and its guaranteed cleanup) and runs the vitest spec against the real route handlers with portfolio env. PASS 26/26 (web-coach 6/6: cl-public-read allow, ck-web-upload-url-own allow, ck-web-upload-url-foreign deny, unknown-bucket reject, ck-web-photo-foreign deny, ai-foreign-read deny). Cleanup reported no problems. Reports: reports/prod-web-storage-auth.json (full) and reports/prod-web-live-spec.json (web-coach cases only). Caveat: this exercises the repository route handlers with portfolio env, not the deployed bundle over HTTP.
5. Tenant diff: `06-verify-data --check tenants`: 55 tables, 0 row-count deltas. `09-verify-storage --check tenants`: 8 non-ziko buckets, 17 non-ziko policies, 0 regressions. No rh_/gecko_ change; no sv_ drift in this window either (zero deltas overall).
6. Reports grepped: no `@`, UUID or JWT.

## Vercel env records after the flip (names and targets only, no values)

Production now has its own 5 records (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_KEY), each target production only.

Shared records were touched by the switcher (updatedAt 15:00 UTC) and now look like this:
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL: targets development + preview (no production). Values not decrypted; presumably ziko values, as before.
- SUPABASE_SERVICE_ROLE_KEY: target preview only. No development record for it now (could not tell whether one existed before).
- NEXT_PUBLIC_SUPABASE_KEY: no development/preview record (production only).
- Branch-scoped preview records for gsd/phase-6-cutover (5 names) from 06-12 are intact (12:28 UTC).
- SUPABASE_PUBLISHABLE_KEY (development, preview, production, last updated 2026-03-26) was not touched. It is not in the web matrix; flagged as a leftover that may hold the ziko value for production, unused by the switched code as far as the matrix goes.
Nothing was repaired. Decision for the user: whether Preview/Development should stay on ziko or move to portfolio.

## AI chat check: WAIVED (not applicable to the web part)

`--skip-ai` passed, per the user's waiver (Anthropic balance empty).

## Deviations and notes

- No rollback was needed or executed. WEB_PREV remains the rollback target (`17-env-switch --surface web ... --target ziko --apply` plus `vercel rollback dpl_Gcm7f2a75LGVsbn4Vy3nLAm6RdE1`).
- Live spec driven via smoke mode (see step 4); no ad hoc writes were improvised.
- Files not committed by design: pre-existing dirty packages/*/dist, supabase/.temp, .planning/active-workstream, .planning/config.json, scripts/auth-merge/baseline/portfolio-baseline-precutover.json, scripts/portfolio-migration/supabase/.

## Awaiting

User's Task 4: W-01, W-02, W-03, W-04, W-06 on https://ziko-app.com (re-login expected). Any FAIL means web rollback and `WEB FLIP SMOKE: FAIL (rolled back)`.

## Known Stubs

None.
