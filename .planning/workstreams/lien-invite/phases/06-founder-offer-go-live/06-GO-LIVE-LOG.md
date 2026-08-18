---
phase: 06
slug: founder-offer-go-live
status: open
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
| 0.2 | `gh secret list --repo AnatholyB1/ziko-platform` (or Settings UI) shows `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` | Both present | pending | — | — |
| 0.3 | Operator confirms verification target is project ref `slkobhavpwsubnsmuhya` | Confirmed | pending | — | — |
| 0.4 | Operator reads `NEXT_PUBLIC_SITE_URL` from `apps/web/.env.local` | Real domain reported | pending | — | — |
| 1 | `git rev-list --count main..HEAD` | Re-run, report actual count (plan-time: 157) | pending | — | — |
| 1 | `git rev-list --count HEAD..main` | Re-run, report actual count (plan-time: 0) | pending | — | — |
| 1 | `git diff main --name-status -- supabase/migrations/` | Re-run, report actual output (plan-time: 4 added files) | pending | — | — |
| 1 | PR opened, landed as single merge or squash commit | PR number + merge commit SHA recorded | pending | — | — |
| 2 | `Check for migration changes` step | Ran (changed=true or false reported) | pending | — | — |
| 2 | `Setup Supabase CLI` step | Executed, not skipped | pending | — | — |
| 2 | `Push migrations` step | Executed, not skipped; log tail pasted | pending | — | — |
| 3.1 | `SELECT key, value FROM public.app_config ORDER BY key;` against `slkobhavpwsubnsmuhya` | Full result pasted; `premium_credit_cap_enabled` row present | pending | — | — |
| 3.2 | `curl -s -o /dev/null -w '%{http_code}' https://ziko-api-lilac.vercel.app/health` | `200` | pending | — | — |
| 3.2 | Vercel dashboard production deployment SHA (API + web) | Matches merge commit SHA from Section 1 | pending | — | — |

## Escalations

None yet.

## Discipline note

A RUNBOOK step that could not be run for real is recorded here as a named gap with its reason — never
left as a blank row, and never marked green by inference or by a bare "approved" with no pasted
output. This mirrors the discipline `05-06-SUMMARY.md` applied to Phase 5's two disclosed gaps (real
submission success/duplicate states never observed live; FOND-06's live counter-reveal never observed),
which are carried forward and recorded in this same ledger by plan 06-03.
