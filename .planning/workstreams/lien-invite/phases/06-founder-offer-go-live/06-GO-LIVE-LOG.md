---
phase: 06
slug: founder-offer-go-live
status: blocked
started: 2026-08-18
---

# Phase 6 — Founder Offer Go-Live: Evidence Ledger

The dated, literal record of every RUNBOOK check. Every row starts `pending` and is filled with the
operator's own reported output — never inferred, never marked green without a literal result to point
at. A step that could not be run is written down as a named gap with its reason; it is never left
blank and never marked green (the same discipline `05-06-SUMMARY.md` applied to Phase 5's two
disclosed gaps).

## Evidence

| RUNBOOK section | Check | Expected result | Observed result | Operator | Timestamp |
|---|---|---|---|---|---|
| 0.1 | Operator confirms holding production `SUPABASE_ACCESS_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY` (or SQL Editor access) | Confirmed held | pending | — | — |
| 0.2 | `gh secret list --repo AnatholyB1/ziko-platform` (or Settings UI) shows `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` | Both present | CONFIRMED present — CI's `Setup Supabase CLI` and `supabase link` steps ran and authenticated successfully (see Escalation E-01) | Claude (GitHub Actions read) | 2026-08-18 |
| 0.3 | Operator confirms verification target is project ref `slkobhavpwsubnsmuhya` | Confirmed | Confirmed — same project ref used throughout this milestone's Supabase MCP queries | Claude (Supabase MCP) | 2026-08-18 |
| 0.4 | Operator reads `NEXT_PUBLIC_SITE_URL` from `apps/web/.env.local` | Real domain reported | pending — not read this session | — | — |
| 1 | `git rev-list --count main..HEAD` | Re-run, report actual count (plan-time: 157) | 159 at merge time (per PR #25) | Claude (git) | 2026-08-18 |
| 1 | `git rev-list --count HEAD..main` | Re-run, report actual count (plan-time: 0) | 0 | Claude (git) | 2026-08-18 |
| 1 | `git diff main --name-status -- supabase/migrations/` | Re-run, report actual output (plan-time: 4 added files) | 4 added files (`20260812_waitlist_founder_offer.sql`, `20260815_waitlist_retention_config.sql`, `20260816_premium_credit_flag.sql`, `20260816_premium_credit_grant.sql`) | Claude (git) | 2026-08-18 |
| 1 | PR opened, landed as single merge or squash commit | PR number + merge commit SHA recorded | PR #25, merged by operator as a single merge commit `182637b1b2d602b2b1847165bb2ef6be7126ca91` | Operator + Claude (GitHub) | 2026-08-18 |
| 2 | `Check for migration changes` step | Ran (changed=true or false reported) | Ran, resolved `changed=true` (correctly — single merge commit strategy worked as designed) | Claude (GitHub Actions read) | 2026-08-18 |
| 2 | `Setup Supabase CLI` step | Executed, not skipped | Executed successfully | Claude (GitHub Actions read) | 2026-08-18 |
| 2 | `Push migrations` step | Executed, not skipped; log tail pasted | **Executed, FAILED** — see Escalation E-01. No migration applied. | Claude (GitHub Actions read) | 2026-08-18 |
| 3.1 | `SELECT key, value FROM public.app_config ORDER BY key;` against `slkobhavpwsubnsmuhya` | Full result pasted; `premium_credit_cap_enabled` row present | **UPDATED (E-04):** `[{"key":"premium_credit_cap_enabled","value":false},{"key":"waitlist_retention_years","value":3},{"key":"waitlist_reveal_threshold","value":30}]` — all 3 rows present after direct MCP migration apply. `is_lifetime_premium` column and both RPCs also verified present. | Claude (Supabase MCP), applied per explicit user instruction | 2026-08-18 |
| 3.2 | `curl -s -o /dev/null -w '%{http_code}' https://ziko-api-lilac.vercel.app/health` | `200` | **500** — see Escalation E-02 | Claude (curl) | 2026-08-18 |
| 3.2 | Vercel dashboard production deployment SHA (API + web) | Matches merge commit SHA from Section 1 | **Does not match** — most recent `ziko-api` production deployment (`dpl_7YcfNLArhzzvLj79ynhqF3in5dbj`) is still from PR #24 (`23034e868db5190e578ac1cc3d5e86af9c3fcc5f`), not this merge. See Escalation E-03. | Claude (Vercel MCP) | 2026-08-18 |

## Escalations

**E-01 — [BLOCKING] `Push migrations` failed: production migration-history/filename drift, pre-existing.**
CI job `Apply Supabase migrations` / step `Push migrations` on the merge run
(https://github.com/AnatholyB1/ziko-platform/actions/runs/32132472841/job/95697836616) failed with:

```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted 20260520214714 20260520220108 20260521082622 20260521125605
20260521174343 20260522114339 20260522143410 20260526101947 20260526103032 20260526120820 20260526121018
20260527110132 20260527120544 20260527120550 20260527120956 20260527133251 20260527134709 20260527134853
20260527202747 20260528215148 20260528215154 20260529222709 20260529224843 20260530200608 20260813172717
20260813172759 20260813173516 20260813173831 20260813182644 20260813183227
supabase db pull
```

Root cause: production's `supabase_migrations.schema_migrations` table has ~30 rows recorded under
full-timestamp (`YYYYMMDDHHMMSS`) version numbers, but the corresponding files in
`supabase/migrations/` at this commit are named under the repo's short numbered convention (e.g. the
remote version `20260521082622` has no matching file — the closest is `047_coach_plugin_registry.sql`,
which is presumably the same migration under a different filename/version). This mismatch predates
Phase 6 entirely — it is a drift between how migrations were once named (or applied from a different
checkout) and this repo's current `supabase/migrations/` contents. **No production schema state
changed as a result of this push** (confirmed by the 3.1 read above: `app_config` still holds exactly
the same single row it held before this merge).
**Disposition:** escalated to the user, not attempted. Repairing a production migration-history table
(`supabase migration repair --status reverted ...` then `supabase db pull`) is a one-way, credentialed,
production-database operation outside anything this session should attempt unilaterally — it needs a
human who understands which local file corresponds to which remote version before running repair,
per D-01.

**E-02 — `/health` returns 500, not 200.**
`curl https://ziko-api-lilac.vercel.app/health` returned HTTP 500 at the time of this check (before
any new deploy of this merge — the currently-live deployment is still PR #24's). Not yet diagnosed
whether this predates this milestone's work or is a live, pre-existing production issue. Recorded as
a fact, not investigated further within Phase 6's scope.

**E-03 — Vercel has not deployed this merge; automated redeploy attempt was blocked.**
No new `ziko-api` production deployment appeared for merge commit `182637b1...` after several minutes
(GitHub integration should auto-deploy on push to `main`, per CLAUDE.md). An attempt to trigger one via
`mcp__Vercel__create_git_project` (reusing the existing linked project) was first blocked by the Claude
Code auto-mode permission classifier, then — after explicit user approval — failed with a Vercel API
403 (`"You don't have permission to create the project"`) for both `ziko-api` and `ziko-web`, tried a
second time after the user re-approved. Confirmed this is a Vercel-account/token permission limit on
this session's connection, not the Claude Code classifier — in-chat approval cannot override it.
**Still open** as of this entry: application code (both API and web) is not yet redeployed with this
merge's changes. Needs either a Vercel-side permission fix on this session's connector, or the user
triggering the deploy manually from the Vercel dashboard (Deployments → Redeploy on latest `main`, for
both `ziko-api` and `ziko-web`).

**E-04 — [RESOLVED, deviation from RUNBOOK] The three pending migrations were applied directly via
Supabase MCP, not through CI, per explicit user instruction.**
Given E-01 (CI's `db push` blocked by the pre-existing filename/version-history drift) and the user's
explicit direction to defer that reconciliation and apply the schema change directly instead — since
this Supabase project is confirmed to be the only instance (no separate test project to diverge from)
— all three pending migration files were applied via `mcp__Supabase__apply_migration` against
`slkobhavpwsubnsmuhya`, each using its exact repo file content unmodified:
`20260815_waitlist_retention_config.sql`, `20260816_premium_credit_flag.sql`,
`20260816_premium_credit_grant.sql`. Verified by direct read immediately after:
`app_config` now holds all three keys (`premium_credit_cap_enabled=false`,
`waitlist_retention_years=3`, `waitlist_reveal_threshold=30`); `user_profiles.is_lifetime_premium`
column exists; `grant_premium_credits()` and `reset_waitlist_founder_sequence()` RPCs both exist.
**Production database schema is now caught up with `main`.** The CI/CLI migration-ledger drift (E-01)
itself remains unreconciled — deferred by explicit user instruction — but no longer blocks the
schema being correct, since the MCP path applies DDL directly rather than diffing against the
CLI's version-history table.

**Carried forward from Phase 5 (inherited, unrelated to E-01–E-04):** a real submission's
success/duplicate confirmation states were never observed live, and FOND-06's live counter-reveal was
never observed (per `STATE.md`). Still open; plan 06-04 is where these are closed or restated.

## Discipline note

A RUNBOOK step that could not be run for real is recorded here as a named gap with its reason — never
left as a blank row, and never marked green by inference or by a bare "approved" with no pasted
output. This mirrors the discipline `05-06-SUMMARY.md` applied to Phase 5's two disclosed gaps (real
submission success/duplicate states never observed live; FOND-06's live counter-reveal never observed),
which are carried forward and recorded in this same ledger by plan 06-03.
