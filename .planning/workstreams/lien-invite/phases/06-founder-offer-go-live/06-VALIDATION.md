---
phase: 06
slug: founder-offer-go-live
status: ready
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
creates it. `wave_0_complete` flips to `true` in T-06-12 once sections 0 through 11 all exist.

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

## Per-Criterion Verification Map

| # | Success Criterion (ROADMAP Phase 6) | Plan | Wave | Closing Task | Supporting Tasks | Verification Type | Command / Check | Expected Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | The public founder counter reflects only genuine post-launch signups — QA/test signups cleared (table truncated + sequence reset) before the page opens to the public | 06-03 | 3 | **T-06-09** | T-06-07 (authors §7), T-06-08 (one-way `checkpoint:decision`), T-06-10 (records) | scripted SQL, human-fired, one-way | `SELECT * FROM public.claim_waitlist_signup('go-live-smoketest@ziko-app.com', 'athlete');` → `TRUNCATE public.waitlist_signups;` → `SELECT public.reset_waitlist_founder_sequence(1);` → `SELECT count(*) FROM public.waitlist_signups;` | Claim returns `is_new` true / `is_founder` true / `founder_rank` 1; post-cleanup count is 0 with a recorded wall-clock time preceding any entry point being publicly linked | ⬜ pending |
| 2 | The credit-gate feature flag is flipped only after the CGU/CGV pages describing the AI-credit cap are already live — never flag-before-text | 06-03 | 3 | **T-06-09** | T-06-07 (authors §8–§9), T-06-10 (records) | scripted HTTP check + scripted SQL, human-fired, in strict order | `curl -sI <site>/fr/cgv`, `/fr/cgu`, `/en/cgv`, `/en/cgu` → then `UPDATE public.app_config SET value = 'true', updated_at = NOW() WHERE key = 'premium_credit_cap_enabled';` → `SELECT value, jsonb_typeof(value) FROM public.app_config WHERE key = 'premium_credit_cap_enabled';` | All four status lines are 200, obtained before the `UPDATE`; readback reports value true with type `boolean` (not a JSON string) | ⬜ pending |
| 3 | The chosen reveal-threshold state at the moment of launch matches what was intended — FOND-06 applied, not just built | 06-02 | 2 | **T-06-05** | T-06-04 (authors §6), T-06-06 (records, marks this row) | scripted SQL, human-fired | `SELECT value FROM public.app_config WHERE key = 'waitlist_reveal_threshold';` | Returns `30` — confirm-not-assume per D-05; counter first appears at 170/200 claimed | ⬜ pending |
| 4a | All mapped entry points route real traffic to the now-public page | 06-04 | 4 | **T-06-11** | T-06-10 (authors §10), T-06-12 (records) | manual browser click-through on the production domain | Homepage founders section, both `/coachs` CTAs, header link, footer link — French and English; plus served sitemap contains the founders path | Every click lands on `/fondateurs`; both `/coachs` routes arrive with the coach profile pre-selected | ⬜ pending |
| 4b | Its conversions begin recording from the first live visit | 06-04 | 4 | **T-06-11** | T-06-10 (authors §10), T-06-12 (records) | **backstop** — external dashboard, human-observed | Submit one signup on the live page, then look for the `waitlist_signup` event in the production Vercel Analytics dashboard | The event appears for that submission, with the observed delay recorded; an absent event is a finding, not an approval | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — the recording task in each plan updates its rows.*

**Why 4b is a backstop rather than an automated check:** the tracking call fires client-side from
`apps/web/src/components/marketing/WaitlistRoleForm.tsx` and its data lands only in Vercel Analytics.
No repository-local or command-line path to that dashboard exists in this environment
(`06-RESEARCH.md` Environment Availability). It also fails independently of 4a — a deploy missing the
analytics mount produces a perfect click-through and no recorded event — so the two are separate rows
rather than one.

---

## Supporting Verification (not ROADMAP criteria, but launch preconditions)

| Check | Plan | Wave | Task | Command | Expected | Halt condition |
|---|---|---|---|---|---|---|
| Merge landed on `main` as a single merge/squash commit | 06-01 | 1 | T-06-02 | `git rev-list --count HEAD..main`; PR merged | PR number and merge commit SHA recorded | — |
| CI's `migrate-supabase` job applied migrations (not skipped) | 06-01 | 1 | T-06-02 | Actions run on the merge push; `Setup Supabase CLI` and `Push migrations` steps executed | Both steps executed, log tail pasted | Skipped steps ⇒ change detector resolved false ⇒ escalate |
| Tracer: one migration artifact live | 06-01 | 1 | T-06-02, T-06-03 | `SELECT key, value FROM public.app_config ORDER BY key;` (project `slkobhavpwsubnsmuhya`) | A `premium_credit_cap_enabled` row exists | Absent ⇒ ledger `status: blocked`, phase halts |
| Tracer: deploy artifact live | 06-01 | 1 | T-06-02, T-06-03 | `curl -s -o /dev/null -w '%{http_code}' https://ziko-api-lilac.vercel.app/health` + deployed SHA | 200 and deployed SHA equals the merge commit | SHA mismatch ⇒ ledger `status: blocked` |
| All three migrations landed (no partial apply) | 06-02 | 2 | T-06-05 | `app_config` (3 rows) + `information_schema.columns` for `is_lifetime_premium` + `pg_proc` for `grant_premium_credits` and `reset_waitlist_founder_sequence` | All three artifacts present | Any one absent ⇒ escalate with the owning migration named; do not hand-apply |
| Purge precondition fresh (PURGE-01–05) | 06-02 | 2 | T-06-05 | `node --env-file=apps/web/.env.local scripts/purge-test-accounts/dry-run.mjs` | All four totals recorded; `to_delete` is 0 | Nonzero ⇒ run `scripts/purge-test-accounts/RUNBOOK.md` §3–§7 before launch |
| CRED-01 re-audit within the launch window | 06-02 | 2 | T-06-05 | `SELECT count(*) FROM public.user_profiles WHERE tier = 'premium';` | 0 | Nonzero ⇒ halt; grandfather question returns to the project owner |
| Phase 5 carried-forward gap: real submission success/duplicate states | 06-04 | 4 | T-06-11 | Submit an address, then resubmit the same one on the live page | Identical response both times; no hint of prior registration | Not completed ⇒ restated as open with the reason |
| Phase 5 carried-forward gap: FOND-06 live counter reveal | 06-04 | 4 | T-06-11 | Raise `waitlist_reveal_threshold`, reload, confirm the count appears with no redeploy, restore to 30 | Display changes without a redeploy; value confirmed back at 30 | Not restored ⇒ blocking finding |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Resolving Task | Test Instructions |
|----------|-------------|------------|----------------|--------------------|
| Merge-to-main + CI migration apply landed cleanly | Deploy scope (D-02) | Requires a real GitHub PR merge and observing a real Actions run; no `gh` access and no production credentials in any session | **T-06-02** | Open a PR from the milestone branch to `main`, land it as a single merge or squash commit, watch `.github/workflows/ci.yml`'s `migrate-supabase` job, confirm its apply steps executed rather than being skipped |
| Production purge dry-run re-check | PURGE-01–05 (D-03) | Requires production `SUPABASE_SERVICE_ROLE_KEY`, which no session in this milestone has held | **T-06-05** | Run `scripts/purge-test-accounts/dry-run.mjs` against production per its RUNBOOK, record all four totals |
| Live `claim_waitlist_signup()` smoke test + one-way cleanup | Criterion 1 (D-04) | Requires a real production write with `service_role` credentials; the cleanup is irreversible | **T-06-09**, gated by **T-06-08** (`checkpoint:decision`) | Call the RPC as `service_role`, confirm the returned row, then `TRUNCATE` + `reset_waitlist_founder_sequence(1)` and confirm count 0 with a timestamp |
| CGU/CGV liveness before the flag flip | Criterion 2, LEGAL-05 (D-06) | Requires the production domain, which is read from a gitignored env file | **T-06-09** | `curl -sI` all four locale/document combinations; open one in a browser to confirm it renders the terms rather than a 200 from an error boundary |
| Entry-point click-through + Analytics conversion check | Criterion 4 | No browser or Vercel Analytics dashboard access from any session; the dashboard has no CLI or repo-local equivalent | **T-06-11** | Human visits each entry point on production in both locales, submits a signup, confirms the `waitlist_signup` event in Vercel Analytics |

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

**Approval:** planner-signed 2026-08-18
