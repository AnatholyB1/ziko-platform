---
phase: 5
slug: waitlist-page-entry-points
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-16
planned: 2026-08-17
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v3.2.4 (`apps/web/package.json:53`) |
| **Config file** | `apps/web/vitest.config.ts` (`environment: 'node'`, `environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']]`, `passWithNoTests: true`) |
| **Quick run command** | `cd apps/web && npx vitest run <touched test file>` |
| **Full suite command** | `cd apps/web && npm run test` (`vitest run --passWithNoTests`) |
| **Estimated runtime** | ~30 seconds (existing suite size; DB-gated suites skip without `RUN_DB`) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run <touched test file>`
- **After every plan wave:** Run `cd apps/web && npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

*Populated by the planner from the six plans created 2026-08-17. Each row names the task that creates
the coverage and the command that plan's `<verify>` block runs. Plan 05-06 T-05-13 replaces the
"File Exists" column with real outcomes once the phase is merged.*

| Req ID | Behavior | Test Type | Owning Task | Automated Command | File Exists |
|--------|----------|-----------|-------------|--------------------|-------------|
| WAIT-01 | `/fondateurs` renders FR+EN; `generateStaticParams` returns both locales | unit/smoke | T-05-02 | `npx vitest run test/app/fondateurs.metadata.test.ts` | ❌ created by T-05-02 |
| WAIT-02 | Email field absent from the DOM until a role is chosen | component (happy-dom) | T-05-01 | `npx vitest run test/components/WaitlistRoleForm.test.tsx` | ❌ created by T-05-01 |
| WAIT-03 | One user-editable input; audience and locale are hidden fields | component | T-05-01 | same file as WAIT-02 | ❌ created by T-05-01 |
| WAIT-04 | Malformed and disposable-domain addresses rejected before the RPC, same message | unit | T-05-04 | `npx vitest run test/actions/waitlist.validation.test.ts` | ❌ created by T-05-04 |
| WAIT-05 | Founder rank rendered in the visitor's locale when genuinely assigned | component | T-05-01 | same file as WAIT-02 | ❌ created by T-05-01 |
| WAIT-06 | Success render identical for founder-less new vs. duplicate; action responses field-identical | component + integration (DB-gated, `RUN_DB`) | T-05-01, T-05-05 | same file as WAIT-02, plus `npx vitest run test/actions/waitlist.concurrency.test.ts` | ✅ concurrency suite exists — extend, never replace |
| WAIT-07 | Theme tokens, four type sizes, accent reserved | manual/visual (UI safety gate) | T-05-14 | none — see Manual-Only Verifications | n/a |
| WAIT-08 | Route prerenders; no request-time read in the segment; no dynamic exports | unit + build | T-05-02, T-05-13 | `npx vitest run test/app/fondateurs.metadata.test.ts`, then `npx next build` route table | ❌ created by T-05-02 |
| FOND-01 | Static offer statement and no number while the display verdict is false | unit + component | T-05-06, T-05-07 | `npx vitest run test/app/api/waitlist-count.test.ts test/components/WaitlistCounterClient.test.tsx` | ❌ created by T-05-06/07 |
| FOND-02 | Descending remaining count rendered above the reveal point | component | T-05-07 | `npx vitest run test/components/WaitlistCounterClient.test.tsx` | ❌ created by T-05-07 |
| FOND-03 | Number always from a live RPC call; no direct table access anywhere | unit | T-05-06 | `npx vitest run test/app/api/waitlist-count.test.ts` | ❌ created by T-05-06 |
| FOND-04 | Exactly one fetch per mount; no polling, no interval, no refetch | component (fake timers) | T-05-07 | `npx vitest run test/components/WaitlistCounterClient.test.tsx` | ❌ created by T-05-07 |
| FOND-05 | Distinct completion panel, never zero-as-count; form keeps accepting | component | T-05-07 | same file as FOND-02 | ❌ created by T-05-07 |
| FOND-06 | No reveal rule in `apps/web`; verdicts consumed, never recomputed | unit greps + live observation | T-05-06, T-05-07, T-05-14 | acceptance-criteria greps, plus the configuration-change step in the human checkpoint | n/a |
| ENTRY-01 | Homepage founders section links to `/fondateurs`, mounted after the hero | component + source order | T-05-08, T-05-09 | `npx vitest run test/components/entry-points.test.tsx` | ❌ created by T-05-09 |
| ENTRY-02 | Both `/coachs` CTAs link to `/fondateurs` with the coach role hint | component | T-05-09 | same file as ENTRY-01 | ❌ created by T-05-09 |
| ENTRY-03 | Header and footer founders links present, equal-weight, header wraps | component | T-05-10 | `npx vitest run test/components/site-chrome.test.tsx` | ❌ created by T-05-10 |
| ENTRY-04 | OpenGraph and `summary_large_image` Twitter metadata, canonical + alternates | unit | T-05-02 | same file as WAIT-01 | ❌ created by T-05-02 |
| ENTRY-05 | `/fondateurs` in the sitemap for both locales with alternates; robots permits it | unit | T-05-11 | `npx vitest run test/app/sitemap.test.ts` | ❌ created by T-05-11 |
| ENTRY-06 (server half) | `utm_source`/`utm_campaign` forwarded to the claim RPC and stored | unit | T-05-05 | `npx vitest run test/actions/waitlist.validation.test.ts` | ❌ created by T-05-04, extended by T-05-05 |
| ENTRY-06 (client half) | Exactly one conversion event per success, audience-only payload | component | T-05-12 | `npx vitest run test/components/WaitlistRoleForm.test.tsx` | ❌ created by T-05-01, extended by T-05-12 |
| Consent recording (RESEARCH.md Pitfall 2) | `consent_given_at` + frozen `CONSENT_VERSION` written, no founder-state keys touched | unit (mocked admin client) + integration (DB-gated) | T-05-05 | `npx vitest run test/actions/waitlist.validation.test.ts` | ❌ created by T-05-04, extended by T-05-05 |
| Abuse layering (RESEARCH.md Pitfall 12) | Honeypot, bot verdict and rate-limit hits never reach the RPC and are indistinguishable | unit | T-05-04 | same file as WAIT-04 | ❌ created by T-05-04 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Every test file this phase needs is created by the task that produces the code it covers, so there is
no separate Wave 0 scaffold plan. The checklist below is the completeness gate T-05-13 closes.

- [ ] `test/components/WaitlistRoleForm.test.tsx` — T-05-01; covers WAIT-02, WAIT-03, WAIT-05, WAIT-06; extended by T-05-12 for ENTRY-06
- [ ] `test/app/fondateurs.metadata.test.ts` — T-05-02; covers WAIT-01, WAIT-08, ENTRY-04
- [ ] `test/actions/waitlist.validation.test.ts` — T-05-04; covers WAIT-04 and the abuse layering; extended by T-05-05 for consent and UTM
- [ ] `test/app/api/waitlist-count.test.ts` — T-05-06; covers FOND-01, FOND-03, FOND-06
- [ ] `test/components/WaitlistCounterClient.test.tsx` — T-05-07; covers FOND-01, FOND-02, FOND-04, FOND-05
- [ ] `test/components/entry-points.test.tsx` — T-05-09; covers ENTRY-01, ENTRY-02, and the D-02/D-03 standing guards
- [ ] `test/components/site-chrome.test.tsx` — T-05-10; covers ENTRY-03
- [ ] `test/app/sitemap.test.ts` — T-05-11; covers ENTRY-05
- [ ] Extend `test/actions/waitlist.concurrency.test.ts` — T-05-05; two module mocks and a consent field on each fixture, no assertion changed, importability in a plain Node process preserved (RESEARCH.md Pitfall 3)
- [ ] Framework install: none — Vitest already configured

*Deviation from the pre-planning draft of this section, recorded deliberately: entry-point coverage is
split across two suites rather than one, because the site chrome and the marketing sections are owned
by two plans running in the same wave and a shared test file would be a write conflict. The counter
gained a second suite for the same reason — the route and the widget are separate tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual and interaction fidelity of the founders page, the profile picker, the homepage section, and the completion state | WAIT-02, WAIT-07, FOND-05 | `05-UI-SPEC.md` is a design contract with no automated enforcement; colour balance, type scale, spacing rhythm and focal order are not assertable by grep. This project sets `ui_phase` and `ui_safety_gate` on for exactly this reason. | Plan 05-06 task **T-05-14**, steps 1, 2 and 5 — a blocking human checkpoint that walks the rendered page against the UI-SPEC in both locales |
| All four entry points actually landing a browser on `/fondateurs` in both locales | ENTRY-01, ENTRY-02, ENTRY-03 | Component tests pin the hrefs; only a real browser proves routing, locale prefixing and the coach pre-pick end to end | Plan 05-06 task **T-05-14**, step 6 |
| Header wrapping at narrow viewports | ENTRY-03, D-04 | A wrapped versus clipped row is a rendered-layout fact, not a class-list fact | Plan 05-06 task **T-05-14**, step 7 |
| The reveal configuration actually changing the page with no redeploy | FOND-06 | The only honest proof is observing it against a real database; a unit test can prove the frontend recomputes nothing, not that the configuration is live | Plan 05-06 task **T-05-14**, step 5 — raise `app_config.waitlist_reveal_threshold` on the **test** project, reload, observe, then restore the original value |
| DB-gated integration suites (`RUN_DB`) actually executing against a real database | WAIT-05, WAIT-06, consent recording | Requires `SUPABASE_TEST_URL` matching `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. `STATE.md` records this as an open gap inherited from Phase 1 — the suites have never run with real credentials in a session. | Run `SUPABASE_TEST_URL=<test project url> SUPABASE_URL=<same> SUPABASE_SERVICE_ROLE_KEY=<key> npx vitest run test/actions/waitlist.concurrency.test.ts` in an environment holding those secrets. T-05-13 records honestly whether this happened rather than assuming it. |

*Note on the mocked-client substitutions: consent recording, UTM forwarding and the abuse guards are
each proven by a unit case over a mocked admin client rather than only by the database-gated suite.
That is a deliberate choice — it gives those behaviours a gate that runs on every commit in every
environment, instead of one that has never run at all. It proves the code issues the right calls; it
does not prove the database accepted them, which is what the row above is still for.*

---

## Validation Sign-Off

Checked at plan time (2026-08-17) against the six plans in this directory. The first five are
properties of the plan set and are true now; the last two are execution-time facts that plan 05-06
task T-05-13 closes.

- [x] All tasks have `<automated>` verify — every one of the twelve `auto` and `tracer` tasks across
      plans 05-01 through 05-06 carries an `<automated>` command that runs a real suite or gate. No
      task defers to a test file that no task creates.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the only two tasks
      without one are the checkpoints T-05-03 (package legitimacy) and T-05-14 (UI safety gate), and
      neither is adjacent to another checkpoint.
- [x] Wave 0 covers all MISSING references — every test file named in the map above is created by a
      named task in the same phase; there is no unowned scaffold.
- [x] No watch-mode flags — every command uses `vitest run`.
- [x] Feedback latency < 30s — each per-task command runs a single suite against a mocked or
      in-memory surface. The production build in T-05-13 is slower, but it is a phase gate rather
      than a per-task sampling command.
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] `wave_0_complete: true` — set by T-05-13 once every file above exists and is collected
- [ ] `status: validated` — set by T-05-13 once the full suite, typecheck, lint and build have run
      green together on the merged tree

**Approval:** planner-checked 2026-08-17; execution sign-off pending T-05-13 and T-05-14.
