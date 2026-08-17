---
phase: 5
slug: waitlist-page-entry-points
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
the coverage and the command that plan's `<verify>` block runs. T-05-13 (2026-08-17, merged-tree
convergence run) replaces the "File Exists" column with the real outcome: every file below was
confirmed present with `test -f` and its owning suite confirmed collected and green in the single
`cd apps/web && npm run test` run recorded under "Convergence Gate Run (T-05-13)" below.*

| Req ID | Behavior | Test Type | Owning Task | Automated Command | Status |
|--------|----------|-----------|-------------|--------------------|-------------|
| WAIT-01 | `/fondateurs` renders FR+EN; `generateStaticParams` returns both locales | unit/smoke | T-05-02 | `npx vitest run test/app/fondateurs.metadata.test.ts` | ✅ 12 tests, file exists, collected |
| WAIT-02 | Email field absent from the DOM until a role is chosen | component (happy-dom) | T-05-01 | `npx vitest run test/components/WaitlistRoleForm.test.tsx` | ✅ 18 tests, file exists, collected |
| WAIT-03 | One user-editable input; audience and locale are hidden fields | component | T-05-01 | same file as WAIT-02 | ✅ same file, collected |
| WAIT-04 | Malformed and disposable-domain addresses rejected before the RPC, same message | unit | T-05-04 | `npx vitest run test/actions/waitlist.validation.test.ts` | ✅ 23 tests, file exists, collected |
| WAIT-05 | Founder rank rendered in the visitor's locale when genuinely assigned | component | T-05-01 | same file as WAIT-02 | ✅ same file, collected |
| WAIT-06 | Success render identical for founder-less new vs. duplicate; action responses field-identical | component + integration (DB-gated, `RUN_DB`) | T-05-01, T-05-05 | same file as WAIT-02, plus `npx vitest run test/actions/waitlist.concurrency.test.ts` | ✅/⚠️ component half green (WaitlistRoleForm.test.tsx); DB-gated half (`waitlist.concurrency.test.ts`, 4 tests) collected and skipped cleanly — **not executed against real credentials this session**, see Manual-Only Verifications |
| WAIT-07 | Theme tokens, four type sizes, accent reserved | manual/visual (UI safety gate) | T-05-14 | none — see Manual-Only Verifications | ⬜ pending T-05-14 |
| WAIT-08 | Route prerenders; no request-time read in the segment; no dynamic exports | unit + build | T-05-02, T-05-13 | `npx vitest run test/app/fondateurs.metadata.test.ts`, then `npx next build` route table | ✅ 12 tests green; `next build` route table confirms `/fr/fondateurs` and `/en/fondateurs` both `●` (SSG) |
| FOND-01 | Static offer statement and no number while the display verdict is false | unit + component | T-05-06, T-05-07 | `npx vitest run test/app/api/waitlist-count.test.ts test/components/WaitlistCounterClient.test.tsx` | ✅ 9 + 10 tests, both files exist, collected |
| FOND-02 | Descending remaining count rendered above the reveal point | component | T-05-07 | `npx vitest run test/components/WaitlistCounterClient.test.tsx` | ✅ same file, collected |
| FOND-03 | Number always from a live RPC call; no direct table access anywhere | unit | T-05-06 | `npx vitest run test/app/api/waitlist-count.test.ts` | ✅ same file, collected |
| FOND-04 | Exactly one fetch per mount; no polling, no interval, no refetch | component (fake timers) | T-05-07 | `npx vitest run test/components/WaitlistCounterClient.test.tsx` | ✅ same file, collected |
| FOND-05 | Distinct completion panel, never zero-as-count; form keeps accepting | component | T-05-07 | same file as FOND-02 | ✅ same file, collected |
| FOND-06 | No reveal rule in `apps/web`; verdicts consumed, never recomputed | unit greps + live observation | T-05-06, T-05-07, T-05-14 | acceptance-criteria greps, plus the configuration-change step in the human checkpoint | ✅ greps re-confirmed (no `app_config`/cap-arithmetic in the route); live-observation half ⬜ pending T-05-14 |
| ENTRY-01 | Homepage founders section links to `/fondateurs`, mounted after the hero | component + source order | T-05-08, T-05-09 | `npx vitest run test/components/entry-points.test.tsx` | ✅ 15 tests, file exists, collected |
| ENTRY-02 | Both `/coachs` CTAs link to `/fondateurs` with the coach role hint | component | T-05-09 | same file as ENTRY-01 | ✅ same file, collected |
| ENTRY-03 | Header and footer founders links present, equal-weight, header wraps | component | T-05-10 | `npx vitest run test/components/site-chrome.test.tsx` | ✅ 8 tests, file exists, collected |
| ENTRY-04 | OpenGraph and `summary_large_image` Twitter metadata, canonical + alternates | unit | T-05-02 | same file as WAIT-01 | ✅ same file, collected |
| ENTRY-05 | `/fondateurs` in the sitemap for both locales with alternates; robots permits it | unit | T-05-11 | `npx vitest run test/app/sitemap.test.ts` | ✅ 6 tests, file exists, collected |
| ENTRY-06 (server half) | `utm_source`/`utm_campaign` forwarded to the claim RPC and stored | unit | T-05-05 | `npx vitest run test/actions/waitlist.validation.test.ts` | ✅ same file as WAIT-04, collected |
| ENTRY-06 (client half) | Exactly one conversion event per success, audience-only payload | component | T-05-12 | `npx vitest run test/components/WaitlistRoleForm.test.tsx` | ✅ same file as WAIT-02, collected |
| Consent recording (RESEARCH.md Pitfall 2) | `consent_given_at` + frozen `CONSENT_VERSION` written, no founder-state keys touched | unit (mocked admin client) + integration (DB-gated) | T-05-05 | `npx vitest run test/actions/waitlist.validation.test.ts` | ✅ unit half green (mocked-client case); DB-gated integration half **not executed against real credentials this session** — same gap as WAIT-06 above |
| Abuse layering (RESEARCH.md Pitfall 12) | Honeypot, bot verdict and rate-limit hits never reach the RPC and are indistinguishable | unit | T-05-04 | same file as WAIT-04 | ✅ same file, collected |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Every test file this phase needs is created by the task that produces the code it covers, so there is
no separate Wave 0 scaffold plan. The checklist below is the completeness gate T-05-13 closes — every
item confirmed present (`test -f`) and collected in the T-05-13 merged-tree run on 2026-08-17.

- [x] `test/components/WaitlistRoleForm.test.tsx` — T-05-01; covers WAIT-02, WAIT-03, WAIT-05, WAIT-06; extended by T-05-12 for ENTRY-06 (18 tests, collected, green)
- [x] `test/app/fondateurs.metadata.test.ts` — T-05-02; covers WAIT-01, WAIT-08, ENTRY-04 (12 tests, collected, green)
- [x] `test/actions/waitlist.validation.test.ts` — T-05-04; covers WAIT-04 and the abuse layering; extended by T-05-05 for consent and UTM (23 tests, collected, green)
- [x] `test/app/api/waitlist-count.test.ts` — T-05-06; covers FOND-01, FOND-03, FOND-06 (9 tests, collected, green)
- [x] `test/components/WaitlistCounterClient.test.tsx` — T-05-07; covers FOND-01, FOND-02, FOND-04, FOND-05 (10 tests, collected, green)
- [x] `test/components/entry-points.test.tsx` — T-05-09; covers ENTRY-01, ENTRY-02, and the D-02/D-03 standing guards (15 tests, collected, green)
- [x] `test/components/site-chrome.test.tsx` — T-05-10; covers ENTRY-03 (8 tests, collected, green)
- [x] `test/app/sitemap.test.ts` — T-05-11; covers ENTRY-05 (6 tests, collected, green)
- [x] Extend `test/actions/waitlist.concurrency.test.ts` — T-05-05; two module mocks and a consent field on each fixture, no assertion changed, importability in a plain Node process preserved (RESEARCH.md Pitfall 3) — file exists, collects and skips cleanly (4 tests skipped, `RUN_DB` false, no `SUPABASE_TEST_URL`)
- [x] Framework install: none — Vitest already configured

*Deviation from the pre-planning draft of this section, recorded deliberately: entry-point coverage is
split across two suites rather than one, because the site chrome and the marketing sections are owned
by two plans running in the same wave and a shared test file would be a write conflict. The counter
gained a second suite for the same reason — the route and the widget are separate tasks.*

---

## Convergence Gate Run (T-05-13)

Run 2026-08-17, on the merged tree of plans 05-01 through 05-05 (all five complete, `git log` HEAD
`30fe944`). Each gate run individually so its real outcome could be recorded honestly rather than only
trusting the `&&`-chained exit code.

**1 — Full workspace suite** (`cd apps/web && npm run test`, i.e. `vitest run --passWithNoTests`):

- **25 test files collected, 1 skipped-suite file** (26 total) · **319 tests passed, 4 skipped** · 5.96s.
- All 9 test files this phase's five summaries name are present in the collected set and green:
  `WaitlistRoleForm.test.tsx` (18), `fondateurs.metadata.test.ts` (12), `waitlist.validation.test.ts`
  (23), `waitlist-count.test.ts` (9), `WaitlistCounterClient.test.tsx` (10), `entry-points.test.tsx`
  (15), `site-chrome.test.tsx` (8), `sitemap.test.ts` (6), and `waitlist.concurrency.test.ts` (4 tests,
  all 4 skipped — `RUN_DB` is false, no `SUPABASE_TEST_URL` set in this environment; see the DB-gated
  row below). Reconciled: no suite is silently absent from the include glob — every phase file the five
  summaries claim to have created was actually collected.
- The remaining 16 collected files are pre-existing suites from earlier phases/plans, unaffected by
  this phase; all green.

**2 — TypeScript check** (`npx tsc --noEmit`):

- **Fails** on the unscoped command — but every failing line is in `apps/web/test/purge/*.test.ts`
  (`purge-lib.test.ts`, `purge-export.test.ts`, `purge-rehearsal.test.ts`, `purge-delete.test.ts`),
  loose `object`-typed mock helpers. `git log --oneline -- apps/web/test/purge/` confirms these files
  were authored entirely under Phase 2 (`02-01` through `02-04`, well before this phase existed) and
  `git diff --stat` on all five Phase 5 summaries confirms none of them touched `test/purge/`. 05-03's
  own summary ("Issues Encountered") already recorded this exact gap as pre-existing and out of that
  plan's scope. **Zero type errors exist in any file created or modified by any Phase 5 plan** —
  confirmed by re-running `npx tsc --noEmit 2>&1 | grep -v purge`, which returns only the two
  continuation lines of a single `purge-rehearsal.test.ts` multi-line error, nothing else. This is a
  known, inherited, out-of-phase-scope condition — recorded here rather than fixed, per this task's
  explicit prohibition on repairing files it does not own. It does **not** represent an integration
  failure between the five Phase 5 slices; the merged-tree tsc surface for every Phase 5 file is clean.

**3 — Linter** (`npm run lint`): **exit 0.** 0 errors, 48 pre-existing warnings (unused-var/
exhaustive-deps/no-img-element across files this phase never touched, plus 5 pre-existing intentional
`_column`/`_value`/`_payload` unused-arg warnings in `waitlist.validation.test.ts` and 2 pre-existing
warnings in `test/purge/*.test.ts`). No new warnings introduced.

**4 — Production build** (`npx next build`): **exit 0.** Route table read, not just the exit code —
WAIT-08 confirmed on the merged tree:

| Route | Status |
|---|---|
| `/[locale]` (homepage) | `●` SSG — `/fr`, `/en` |
| `/[locale]/fondateurs` | `●` SSG — `/fr/fondateurs`, `/en/fondateurs` |
| `/[locale]/fondateurs/opengraph-image-q5yamg` | `●` SSG — both locales |
| `/[locale]/fondateurs/twitter-image-q5yamg` | `●` SSG — both locales |
| `/[locale]/coachs` | `●` SSG — `/fr/coachs`, `/en/coachs` |
| `/api/waitlist/count` | `ƒ` Dynamic (correct — not build-evaluated, per Plan 05-03's explicit Cache-Control-not-`revalidate` decision) |

Both locales of the founders route, the homepage, and `/coachs` are all prerendered static content —
none turned dynamic despite the fetching client component (`WaitlistCounterClient`), the BotID script
mount, and the bot-detection wrapper this phase added across three waves.

**`git status --porcelain apps/web/` confirmed empty** before and after all four gates — no production
code changed by this task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual and interaction fidelity of the founders page, the profile picker, the homepage section, and the completion state | WAIT-02, WAIT-07, FOND-05 | `05-UI-SPEC.md` is a design contract with no automated enforcement; colour balance, type scale, spacing rhythm and focal order are not assertable by grep. This project sets `ui_phase` and `ui_safety_gate` on for exactly this reason. | Plan 05-06 task **T-05-14**, steps 1, 2 and 5 — a blocking human checkpoint that walks the rendered page against the UI-SPEC in both locales |
| All four entry points actually landing a browser on `/fondateurs` in both locales | ENTRY-01, ENTRY-02, ENTRY-03 | Component tests pin the hrefs; only a real browser proves routing, locale prefixing and the coach pre-pick end to end | Plan 05-06 task **T-05-14**, step 6 |
| Header wrapping at narrow viewports | ENTRY-03, D-04 | A wrapped versus clipped row is a rendered-layout fact, not a class-list fact | Plan 05-06 task **T-05-14**, step 7 |
| The reveal configuration actually changing the page with no redeploy | FOND-06 | The only honest proof is observing it against a real database; a unit test can prove the frontend recomputes nothing, not that the configuration is live | Plan 05-06 task **T-05-14**, step 5 — raise `app_config.waitlist_reveal_threshold` on the **test** project, reload, observe, then restore the original value |
| DB-gated integration suites (`RUN_DB`) actually executing against a real database | WAIT-05, WAIT-06, consent recording | Requires `SUPABASE_TEST_URL` matching `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. `STATE.md` records this as an open gap inherited from Phase 1 — the suites have never run with real credentials in a session. | **Confirmed not run in the T-05-13 session (2026-08-17):** `SUPABASE_TEST_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are all unset in this environment; `RUN_DB` evaluated false and all 4 DB-gated cases in `waitlist.concurrency.test.ts` collected-and-skipped, never executed. This is the same open gap `STATE.md`'s "Blockers/Concerns" section already records from Phase 1 — Phase 5 inherits it rather than resolving or silently closing it. Run `SUPABASE_TEST_URL=<test project url> SUPABASE_URL=<same> SUPABASE_SERVICE_ROLE_KEY=<key> npx vitest run test/actions/waitlist.concurrency.test.ts` in an environment holding those secrets to close it. |

*Note on the mocked-client substitutions: consent recording, UTM forwarding and the abuse guards are
each proven by a unit case over a mocked admin client rather than only by the database-gated suite.
That is a deliberate choice — it gives those behaviours a gate that runs on every commit in every
environment, instead of one that has never run at all. It proves the code issues the right calls; it
does not prove the database accepted them, which is what the row above is still for.*

---

## Validation Sign-Off

Checked at plan time (2026-08-17) against the six plans in this directory, and closed at execution
time (2026-08-17) by task T-05-13's merged-tree convergence run.

- [x] All tasks have `<automated>` verify — every one of the twelve `auto` and `tracer` tasks across
      plans 05-01 through 05-06 carries an `<automated>` command that runs a real suite or gate. No
      task defers to a test file that no task creates.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the only two tasks
      without one are the checkpoints T-05-03 (package legitimacy) and T-05-14 (UI safety gate), and
      neither is adjacent to another checkpoint.
- [x] Wave 0 covers all MISSING references — every test file named in the map above is created by a
      named task in the same phase; there is no unowned scaffold. Confirmed at execution time: all 9
      files exist on disk (`test -f`) and were collected in the T-05-13 full-suite run.
- [x] No watch-mode flags — every command uses `vitest run`.
- [x] Feedback latency < 30s — each per-task command runs a single suite against a mocked or
      in-memory surface. The production build in T-05-13 is slower, but it is a phase gate rather
      than a per-task sampling command.
- [x] `nyquist_compliant: true` set in frontmatter — holds; every per-task `<automated>` command
      genuinely runs a fast, single-suite command, and the slower T-05-13 phase gate does not count
      against per-task latency (see previous bullet).
- [x] `wave_0_complete: true` — set by T-05-13; every file named in the map exists and was collected
      green in the 2026-08-17 merged-tree run.
- [x] `status: validated` — set by T-05-13. The full suite, lint, and build all ran green on the
      merged tree (319 passed / 4 known-skipped, 0 lint errors, build exit 0 with WAIT-08's route
      table confirmed). `tsc --noEmit` is clean on every file any Phase 5 plan touched; its unscoped
      failure is confined to pre-existing, out-of-phase-scope `test/purge/*.test.ts` files from
      Phase 2, recorded honestly above rather than fixed (out of this task's scope) or hidden. The
      two genuinely outstanding items — WAIT-07/FOND-06's live observation and the DB-gated suites —
      are named gaps in the Manual-Only Verifications table above, resolved by T-05-14 (the former)
      or left as the STATE.md-inherited open gap (the latter), not silently reported as passing.

**Approval:** planner-checked 2026-08-17; execution sign-off closed by T-05-13 (2026-08-17). T-05-14
(the human UI safety checkpoint) remains pending — this document's `status: validated` covers the
automated convergence gate only; the phase itself is not complete until T-05-14 is approved.
