---
phase: 06
slug: founder-offer-go-live
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
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

---

## Sampling Rate

- **Per RUNBOOK step:** the human operator confirms each step's expected output (SQL row count, HTTP
  status, or event visibility) before proceeding to the next — this replaces "per task commit," since
  no code is being committed in the destructive steps.
- **Phase gate:** all four ROADMAP success criteria below confirmed true, in order, with results
  recorded (pasted back into the RUNBOOK or a completion log) before the phase is marked complete —
  mirroring Phase 2's `02-04-SUMMARY.md` pattern of a written, dated confirmation.
- **Max feedback latency:** n/a (human-paced, not automated-suite-paced)

---

## Per-Criterion Verification Map

*(Task IDs are assigned by the planner once PLAN.md exists — this map is seeded from
`06-RESEARCH.md`'s "Validation Architecture" section, which the planner should refine into
per-task rows.)*

| Success Criterion | Behavior | Verification Type | Command / Check | Automatable? |
|---|---|---|---|---|
| 1. Founder counter reflects only genuine post-launch signups | `waitlist_signups` is empty and the sequence is reset to 1 immediately before public launch | scripted SQL, human-fired | `SELECT count(*) FROM waitlist_signups;` (expect 0) run after the `TRUNCATE`/`reset_waitlist_founder_sequence(1)` pair | Query is scriptable; firing it against production requires human credentials |
| 2. Flag flips only after CGU/CGV are live | An HTTP 200 from `/cgv` and `/cgu` (both locales) precedes the `UPDATE app_config ... premium_credit_cap_enabled` | scripted HTTP check + scripted SQL, human-fired, in strict order | `curl -sI <site>/fr/cgv` etc., then `UPDATE app_config ...` | Both checks are scriptable; the *ordering guarantee* is a human-process control (RUNBOOK step order), not script-enforceable |
| 3. Reveal-threshold state matches what was intended | `app_config.waitlist_reveal_threshold = 30` on production | scripted SQL | `SELECT value FROM app_config WHERE key='waitlist_reveal_threshold';` (expect 30) — confirm-not-assume per D-05 | Fully scriptable; only needs production read access |
| 4. Entry points route real traffic and conversions record | Homepage/`/coachs`/header/footer all reach `/fondateurs`; a real submission produces a `waitlist_signup` event visible in Vercel Analytics | manual browser click-through + manual dashboard check | Visit each entry point in a browser; submit one signup; check Vercel Analytics dashboard for the `waitlist_signup` event | Not automatable — no repo-local/CLI-scriptable path to a live-site click-through or the Vercel Analytics UI |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — planner/executor updates per row as the RUNBOOK executes.*

---

## Wave 0 Requirements

None — there is no test framework to bootstrap. The "Wave 0" equivalent for this phase is writing the
RUNBOOK itself (`scripts/founder-offer-go-live/RUNBOOK.md`), which must exist before any execution
task can reference it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Merge-to-main + CI migration apply landed cleanly | Deploy scope (D-02) | Requires a real GitHub PR merge and observing a real Actions run; no `gh` access in this session | Open a PR from `claude/gsd-knowledge-j7q4l7` to `main`, merge, watch `.github/workflows/ci.yml`'s `migrate-supabase` job go green |
| Production purge dry-run re-check | Account-purge precondition (D-03) | Requires production `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ACCESS_TOKEN`, which no session in this milestone has held | Run `scripts/purge-test-accounts/dry-run.mjs` against production per `RUNBOOK.md`, record the result |
| Live `claim_waitlist_signup()` smoke test + cleanup | QA-row cleanup (D-04) | Requires a real production write with admin credentials | Submit one real signup via the deployed `/fondateurs` page or `createAdminClient()`, confirm the row, then `TRUNCATE`/reset per D-04 |
| Entry-point click-through + Analytics dashboard check | Success criterion 4 | No browser/dashboard access from this session | Human visits each entry point, submits a signup, confirms the `waitlist_signup` event in Vercel Analytics |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies, or are explicitly logged as
      human-fired per the Manual-Only Verifications table above
- [ ] Sampling continuity: every RUNBOOK step has a stated expected-output check before the next step
- [ ] Wave 0 covers all MISSING references (n/a — no test framework)
- [ ] No watch-mode flags (n/a)
- [ ] Feedback latency: n/a (human-paced)
- [ ] `nyquist_compliant: true` set in frontmatter once the planner confirms every success criterion
      maps to a verification row

**Approval:** pending
