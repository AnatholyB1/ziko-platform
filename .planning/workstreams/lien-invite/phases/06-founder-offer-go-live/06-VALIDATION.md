---
phase: 06
slug: founder-offer-go-live
status: ready
rebaselined: 2026-11-07
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-18
plans_created: 2026-08-18
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None applicable — this phase ships zero application code and zero test files. Verification is entirely direct-SQL / HTTP-check / human-observed, executed against live production per `06-CONTEXT.md` D-01. |
| **Config file** | n/a |
| **Quick run command** | n/a — see Per-Criterion Verification Map below for the literal command per success criterion |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a — this is a human-fired RUNBOOK, not a CI-timed suite |

**Wave 0 equivalent:** `scripts/founder-offer-go-live/RUNBOOK.md`. Every human-fired step in this phase
executes that document rather than a summary of it, so no execution task can run before T-06-01
creates it. `wave_0_complete` flips to `true` in T-06-12 once the runbook sections all exist.

**Probe disclosure:** no edge-probe / prohibition-probe run — phase owns no net-new requirement IDs.
Phase 6 claims no requirement not already owned by Phases 1–5, there is no phase-local SPEC.md, and
`phase_req_ids` is descriptive prose rather than a list of IDs with their own requirement text. The
map below is therefore derived directly from ROADMAP.md's four literal Phase 6 success criteria.

---

## Sampling Rate

- **Per RUNBOOK step:** the human operator confirms each step's expected output (SQL result set, HTTP
  status, or event visibility) and pastes it back before proceeding to the next — this replaces "per
  task commit," since no code is being committed in the destructive steps.
- **Per plan:** each plan's third task transcribes the operator's literal output into
  `06-GO-LIVE-LOG.md` and applies that plan's halt conditions before the next wave is unblocked.
  A plan's `<automated>` verify fails while any of its seeded ledger rows is still pending, so the
  ledger cannot be completed by assertion.
- **Phase gate:** all four criteria below confirmed with recorded evidence before the phase is marked
  complete — mirroring Phase 2's `02-04-SUMMARY.md` pattern of a written, dated confirmation.
- **Max feedback latency:** n/a (human-paced, not automated-suite-paced)

---

## Re-baseline 2026-11-07 (post v1.19)

Production = portfolio project `ubxllsvanurkwkohzxau`, tables `ziko_*`; the old ziko project is deleted.
No TRUNCATE, no sequence reset (94 real signups kept). The smoke test of `ziko_claim_waitlist_signup`
runs on a disposable DB only. Threshold 200 -> 30 and the cap flag flip are human-fired UPDATEs on explicit
authorization. The 21 premium are grandfathered (`is_lifetime_premium`) and receive the finite 300/month
allocation. All earlier rows referring to the old project, TRUNCATE or "premium count 0" are superseded.

## Per-Criterion Verification Map

| # | Success Criterion (ROADMAP Phase 6) | Plan | Wave | Closing Task | Supporting Tasks | Verification Type | Command / Check | Expected Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | The public founder counter reflects only genuine signups. Re-interpreted: no real signup is destroyed; the 94 real rows are kept, claim path proven on a disposable DB | 06-03 | 3 | **T-06-09** | T-06-07 (authors, runs smoke test), T-06-05 (snapshot), T-06-10 | read-only SQL + disposable-DB scripted check | `SELECT count(*) FROM public.ziko_waitlist_signups;` and `SELECT last_value, is_called FROM public.ziko_waitlist_founder_seq;` before and after; smoke test on throwaway DB | count >= 94 and sequence unchanged; smoke test: rank 1 is_new true, repeat is_new false | pending |
| 2 | Credit-gate flag flipped only after CGU/CGV are live (CRED-05 + LEGAL-05) and with finite allocation for all, grandfathered premium included | 06-03 | 3 | **T-06-09** | T-06-05 (premium + allocation reads), T-06-07, T-06-10 | HTTP checks + SQL, human-fired in strict order | `curl -sI <site>/fr/cgv /fr/cgu /en/cgv /en/cgu` (4x 200), then premium_without_grant = 0, then `UPDATE ... SET value='true'::jsonb ...`, then `SELECT value, jsonb_typeof(value) ...` | 4x 200 before UPDATE; readback true / boolean; rollback `'false'::jsonb` | pending |
| 3 | Reveal-threshold state at launch matches intent (FOND-06 applied): 200 -> 30 | 06-03 | 3 | **T-06-09** | T-06-05 (reads 200 first), T-06-08 (authorization), T-06-07 | read + human-fired UPDATE | `UPDATE public.ziko_app_config SET value='30'::jsonb, updated_at=now() WHERE key='waitlist_reveal_threshold';` then `SELECT value, jsonb_typeof(value) ...` | 200/number before, 30/number after; should_display false at 94 claimed; rollback `'200'::jsonb` | pending |
| 4a | Entry points route real traffic to the public page | 06-04 | 4 | **T-06-11** | T-06-10, T-06-12 | manual browser click-through on production | homepage section, both /coachs CTAs, header, footer, fr + en; sitemap | every click lands on /fondateurs; coach pre-selected | pending |
| 4b | Conversions record from the first live visit | 06-04 | 4 | **T-06-11** | T-06-10, T-06-12 | **backstop** - external dashboard | one real submission, then `waitlist_signup` in Vercel Analytics | event appears; absence is a finding | pending |

*Status legend: pending / green / red / flaky. The recording task in each plan updates its rows.*

4b is a backstop: the tracking call is client-side and lands only in Vercel Analytics; no repo-local path
exists. 4b fails independently of 4a.

---

## Supporting Verification (launch preconditions, read-only unless marked)

| Check | Plan | Wave | Task | Command | Expected | Halt condition |
|---|---|---|---|---|---|---|
| Code deployed from main as single merge commit | 06-01 | 1 | T-06-02 | PR + Vercel deployed SHA (api + web) + `/health` | SHA = merge SHA; 200 | Mismatch or non-200: blocked |
| CI migrate-portfolio dormant, nothing applied | 06-01 | 1 | T-06-02 | Actions run on the push; variable PORTFOLIO_MIGRATIONS_ENABLED | job skipped | Variable 'true': stop and ask |
| Migrations live | 06-01 | 1 | T-06-02 | `SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20261001101852' ORDER BY 1;` | 5 versions | Short: escalate, no hand-apply |
| Config baseline | 06-01 | 1 | T-06-02 | `SELECT key, value FROM public.ziko_app_config ORDER BY key;` | cap false, retention 3, threshold 200 | Differs: record and ask |
| Four artifacts | 06-02 | 2 | T-06-05 | pg_proc (4 ziko_ functions), information_schema.columns (is_lifetime_premium), sequence read | all present | Any miss: blocked |
| Waitlist snapshot | 06-02 | 2 | T-06-05 | total / founders / no_consent / anonymized | 94 / 94 / 19 / record | Total < 94: blocked |
| Purge dry-run fresh, ziko-scoped | 06-02 | 2 | T-06-05 | `node --env-file=<env> scripts/purge-test-accounts/dry-run.mjs` | to_delete 0 | > 0: purge RUNBOOK; shared auth.users scope check first |
| Grandfathered premium | 06-02 | 2 | T-06-05 | premium / lifetime / not_grandfathered / profiles | 21 / 21 / 0 / 40 | not_grandfathered > 0: user decision |
| Finite allocation | 06-02 | 2 | T-06-05, T-06-09 | premium_without_grant query (current UTC month) | 0 | > 0: trigger idempotent grant cron or escalate; no flip |
| RGPD exclusion | 06-04 | 4 | T-06-11 | `SELECT count(*) FROM public.ziko_waitlist_signups WHERE consent_given_at IS NULL;` | 19, ids listed in DEPLOY-CHECKLIST-v1.16.md | Any send must filter consent_given_at IS NOT NULL |
| Phase 5 gap: real submission success/duplicate | 06-04 | 4 | T-06-11 | submit then resubmit on live page; DB level covered by the disposable smoke test | identical response | Not done: restated open |
| Phase 5 gap: FOND-06 live reveal | 06-04 | 4 | T-06-11 | needs threshold raised in prod: separate authorization, restore 30 same sitting | display changes with no redeploy | Not authorized: restated open |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Resolving Task | Test Instructions |
|----------|-------------|------------|----------------|--------------------|
| Merge to main and deploy | Deploy scope | Needs merge rights and Vercel dashboard | **T-06-02** | RUNBOOK sections 1-2 |
| Production reads | PURGE, CRED-01 | Needs prod SQL access; purge needs service-role env | **T-06-05** | RUNBOOK sections 3-6 |
| Threshold UPDATE | Criterion 3 (FOND-06) | Production write, explicit authorization | **T-06-08, T-06-09** | RUNBOOK section 8 |
| Flag UPDATE after legal + allocation gates | Criterion 2 (CRED-05, LEGAL-05) | Production write, explicit authorization | **T-06-08, T-06-09** | RUNBOOK sections 9-10 |
| Entry-point click-through + Analytics event | Criterion 4 | Browser and external dashboard | **T-06-11** | RUNBOOK section 11 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly logged as human-fired per the
      Manual-Only Verifications table above — all six `auto`/`tracer` tasks carry an `<automated>`
      command; all five checkpoint tasks appear in that table with a resolving task ID.
- [x] Sampling continuity: every RUNBOOK step has a stated expected output that the operator confirms
      before the next step, and each plan's recording task fails its verify while any seeded ledger
      row is still pending.
- [x] Wave 0 covers all MISSING references — the wave-0 equivalent is `RUNBOOK.md` itself, created by
      T-06-01 in wave 1 before any execution task references it.
- [x] No watch-mode flags — no test runner is involved.
- [x] Feedback latency: n/a (human-paced by design, per D-01).
- [x] `nyquist_compliant: true` — every ROADMAP success criterion maps to a verification row with a
      literal command and an expected result, and the one row with no automatable path (4b) is
      recorded as a backstop with its reason rather than claimed as automated.
- [ ] `wave_0_complete: true` — set by T-06-12 once RUNBOOK sections 0 through 11 all exist.
- [ ] All four criteria green — set by T-06-12 from the operator's actual reported results.

**Approval:** planner-signed 2026-08-18; re-baselined 2026-11-07 (post v1.19, user decisions Q1-Q4)
