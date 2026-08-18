---
phase: 05-waitlist-page-entry-points
plan: 06
subsystem: ui
tags: [nextjs, next-intl, vitest, testing-library, ui-safety-gate, next-build]

# Dependency graph
requires:
  - phase: 05-01
    provides: "/fondateurs SSG route, WaitlistFounderBanner/WaitlistRoleForm chain"
  - phase: 05-02
    provides: "claimWaitlistSpot guard chain, consent write, UTM forwarding"
  - phase: 05-03
    provides: "GET /api/waitlist/count, WaitlistCounterClient three-state widget"
  - phase: 05-04
    provides: "Homepage founders section, /coachs CTA redirects"
  - phase: 05-05
    provides: "Header/footer nav links, sitemap entry, conversion event"
provides:
  - "05-VALIDATION.md completed: per-task map replaced with real files/commands, Wave 0 checklist closed, status: validated, wave_0_complete: true, sign-off checked"
  - "One full-suite/tsc/lint/build pass proven on the merged tree of all five preceding plans, with the build route table read (not just exit code) to confirm WAIT-08 across the merged result"
  - "A real production-build, real-browser walkthrough of the full 8-step T-05-14 checklist, approved by the developer"
  - "A locale-propagation bug in the shared marketing layout (Header/Footer/CoachsHero/CoachsCtaFooter rendering French on /en) found during that walkthrough, fixed, and re-verified — closing both this phase's own defect and a pre-existing Phase 3 gap as a side effect"
  - "Phase 5 closed: WAIT-01 through ENTRY-06 (19 requirements) all complete in REQUIREMENTS.md"
affects: [06-founder-offer-go-live]

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared route-group layout.tsx must call setRequestLocale(locale) itself if any Server Component beneath it (Header/Footer and anything importing them) resolves translations via getLocale()/getTranslations() with no params of its own — next-intl's per-request locale context does not reliably propagate across static generation of a layout that never re-declares it, even though every page.tsx sibling in the tree already does. Established as the fix pattern for this class of bug."

key-files:
  created: []
  modified:
    - .planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-VALIDATION.md
    - apps/web/src/app/[locale]/(marketing)/layout.tsx

key-decisions:
  - "The locale-propagation bug found at T-05-14 was fixed inline rather than deferred to a new plan — it is a one-file, mechanical application of the codebase's own already-established convention (every other route.tsx in the tree calls setRequestLocale()), not an architectural change, and blocking Phase 5's close on it would have left the founders page shipping with a broken English header. Documented as a deviation below rather than silently folded into a routine commit."
  - "Two verification gaps disclosed to and explicitly accepted by the user rather than blocking approval: Step 3 (real submission success/duplicate states) could not be observed live — no working SUPABASE_SERVICE_ROLE_KEY in this session — and Step 5 (FOND-06 live counter-reveal observation) was skipped entirely because the only Supabase project this session held credentials for is production, not the test project the step requires. Both are session-credential limitations, not implementation gaps; the underlying code paths are covered by unit/component tests recorded in 05-VALIDATION.md."
  - "REQUIREMENTS.md's WAIT-04 checkbox and traceability row, left unchecked/`Pending` since the requirements were drafted, are marked complete here — the behavior it names (malformed/disposable-domain rejection) is fully proven by `test/actions/waitlist.validation.test.ts` (23 tests, part of the 319 green in the T-05-13 convergence run) and was never actually incomplete; the checkbox was simply never flipped by an earlier plan."

patterns-established:
  - "Convergence plan (final plan of a multi-plan UI phase): run every declared gate once on the merged tree before the human checkpoint, read the build route table rather than trust only the exit code, and record any gate that cannot run as a named gap rather than a silent pass — same discipline as Phase 1's database-gated suites."

requirements-completed: [WAIT-01, WAIT-02, WAIT-03, WAIT-04, WAIT-05, WAIT-06, WAIT-07, WAIT-08, FOND-01, FOND-02, FOND-03, FOND-04, FOND-05, FOND-06, ENTRY-01, ENTRY-02, ENTRY-03, ENTRY-04, ENTRY-05, ENTRY-06]

coverage:
  - id: D1
    description: "Every automated gate the phase declared (full vitest suite, tsc, lint, next build) runs green together on the merged tree of all five preceding plans, and the build's route table confirms WAIT-08 across the merged result"
    requirement: "WAIT-08"
    verification:
      - kind: unit
        ref: "apps/web — `npm run test` (319 passed / 4 known-skipped DB-gated), recorded in 05-VALIDATION.md 'Convergence Gate Run (T-05-13)'"
        status: pass
      - kind: other
        ref: "`npx next build` route table — both locales of /fondateurs, homepage, /coachs all `●` SSG"
        status: pass
    human_judgment: false
  - id: D2
    description: "05-VALIDATION.md's per-task map, Wave 0 checklist, and sign-off are all completed with real files/commands, status: validated, wave_0_complete: true"
    verification:
      - kind: other
        ref: ".planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-VALIDATION.md — status: validated, wave_0_complete: true, every row's file confirmed present via test -f"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rendered founders page (both locales), the progressive-disclosure form, all four entry points, and the counter's states were reviewed by a human against 05-UI-SPEC.md and approved"
    requirement: "WAIT-07"
    verification:
      - kind: manual_procedural
        ref: "T-05-14 checkpoint — 8-step walkthrough against 05-UI-SPEC.md, real dev server + real Chromium browser + real production build"
        status: pass
    human_judgment: true
    rationale: "Color balance, type scale, spacing rhythm, and whether four entry points genuinely land a real browser on the founders page are not assertable by grep — this project's ui_safety_gate exists for exactly this, and the checkpoint's resume-signal required an explicit human 'approved'."
  - id: D4
    description: "A locale-propagation defect found during the human walkthrough (header/footer nav link and /coachs CTA labels rendering French on /en pages) is fixed and re-verified on a fresh production build"
    verification:
      - kind: other
        ref: "commit 137a562 + re-verification against fresh `next build`/`next start`: nav link, CTA labels, FR/EN toggle active state correct on /en; French pages unaffected; 319 tests still green; tsc/lint clean on Phase 5 files; still SSG both locales"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two verification steps could not be completed live this session (real-submission success/duplicate states; FOND-06 live counter-reveal observation) and are recorded as disclosed, user-accepted gaps rather than silently passed"
    verification: []
    human_judgment: true
    rationale: "These are honesty-of-record items, not automatable — the human explicitly reviewed and accepted both gaps as part of approving the checkpoint; no automated check can substitute for that acceptance."

# Metrics
duration: ~35min
completed: 2026-08-18
status: complete
---

# Phase 5 Plan 6: Merged-Tree Convergence Gate + Human UI Safety Checkpoint Summary

**Proved Phase 5 as a whole (not five separately-green slices) on the merged tree, found and fixed a real locale-propagation bug during the human walkthrough, and closed the phase on explicit developer approval with two disclosed, accepted gaps.**

## Performance

- **Duration:** ~35 min (T-05-13 convergence run + T-05-14 human walkthrough, bug found/fixed/re-verified, checkpoint approved)
- **Tasks:** 2 (T-05-13 auto, T-05-14 checkpoint:human-verify)
- **Files modified:** 2 (05-VALIDATION.md, apps/web/src/app/[locale]/(marketing)/layout.tsx)

## Accomplishments

- Ran the full vitest suite, `tsc --noEmit`, lint, and `next build` once on the merged result of all five preceding plans (05-01–05-05) rather than trusting five independently-green plan runs to compose correctly. 319 tests passed (4 known-skipped, DB-gated), lint exit 0, build exit 0 with the route table read directly to confirm WAIT-08 held across the merged tree (both locales of `/fondateurs`, the homepage, and `/coachs` all `●` SSG despite three waves of client components added since any single plan last checked).
- Completed `05-VALIDATION.md`: every Wave 0 marker replaced with the real test file and command that covers each requirement, the per-task map reconciled against the five plan summaries, `status: validated`, `wave_0_complete: true`, and a fully checked Validation Sign-Off — including an honest statement that the DB-gated suites did not run against real credentials this session (inheriting, not silently closing, Phase 1's recorded gap).
- Ran a dedicated verification agent through all 8 steps of T-05-14's checklist against a real dev server and a real Chromium browser. It found one genuine, blocking defect: on every `/en` page, the header/footer "Founders" nav link and both `/coachs` CTA buttons rendered in French (wrong href, wrong label) despite `<html lang="en">` and the page body itself being correctly English.
- Root-caused and fixed the defect: `apps/web/src/app/[locale]/(marketing)/layout.tsx` never called `setRequestLocale()` itself, unlike every `page.tsx` in the tree — so Header/Footer's next-intl calls didn't reliably resolve the correct locale during static generation of the shared layout. Fixed by awaiting `params` and calling `setRequestLocale(locale)` before rendering Header/Footer, mirroring the codebase's own established convention (commit `137a562`).
- Re-verified against a fresh production build: nav link, CTA labels, and the FR/EN toggle's active state are now correct on `/en`; French pages unaffected; all 319 tests still green; `tsc`/lint clean; both locales still SSG. As a side effect, this fix also resolved a pre-existing, previously out-of-scope bug from Phase 3's own UI walkthrough (CGU/CGV footer links showing French labels/hrefs on `/en` pages) — confirmed fixed via curl on the production build.
- The full findings report, including two explicitly disclosed and not-fully-verified gaps (see below), was presented to the real user, who reviewed it and responded "approved" — closing T-05-14 and, with it, Phase 5.

## Task Commits

Each task was committed atomically:

1. **T-05-13: Run every gate once on the merged tree and complete the validation record** - `7b7ab85` (docs)
2. **T-05-14: Human checkpoint — locale-propagation bug found and fixed as part of resolving the checkpoint** - `137a562` (fix)

**Plan metadata:** committed as part of this closeout (docs: complete plan)

## Files Created/Modified

- `.planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-VALIDATION.md` - Per-task map completed with real files/commands, Wave 0 checklist closed, `status: validated`, `wave_0_complete: true`, sign-off checklist completed
- `apps/web/src/app/[locale]/(marketing)/layout.tsx` - Added `setRequestLocale(locale)` call so Header/Footer/CoachsHero/CoachsCtaFooter resolve the correct locale during static generation

## Decisions Made

- The locale-propagation bug was fixed inline during checkpoint resolution rather than deferred to a new plan or routed back to the owning plan (05-01/05-05) — it is a one-file, mechanical application of a convention every other route in the tree already follows, not an architectural change, and it directly blocked the UI safety gate this plan exists to close. Documented as a deviation, not hidden inside a routine commit.
- Two verification gaps (real-submission success/duplicate states; FOND-06's live counter-reveal observation) were disclosed in full to the user rather than silently marked passing, and the user explicitly accepted both when approving. This follows the same honesty convention Phase 1 established for its database-gated suites and that `05-VALIDATION.md`'s Manual-Only Verifications table already carries forward.
- `REQUIREMENTS.md`'s WAIT-04 checkbox/traceability row (left unchecked/`Pending` since requirements were drafted, despite the behavior it names being fully covered by `test/actions/waitlist.validation.test.ts`) is corrected to complete here — an oversight in an earlier plan's bookkeeping, not an actual gap in the implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Marketing layout never called `setRequestLocale()`, causing English pages to render French nav links and CTA labels**
- **Found during:** Task 2 (T-05-14 human checkpoint, step 1/6 of the 8-step walkthrough)
- **Issue:** `apps/web/src/app/[locale]/(marketing)/layout.tsx` rendered Header/Footer (and, transitively, CoachsHero/CoachsCtaFooter on `/coachs`) as Server Components that resolve translations via next-intl's `getLocale()`/`getTranslations()` with no params of their own, relying on the ancestor `[locale]/layout.tsx` having already called `setRequestLocale()`. That propagation does not reliably hold across static generation of a shared layout that never re-declares its own locale-scoped params — every `page.tsx` sibling in the tree (cgv, cgu, fondateurs, etc.) already calls `setRequestLocale()` itself; this layout was the one shared boundary that didn't. Result: on every `/en` page, the "Founders" nav link had the wrong href (`/fr/fondateurs`) and wrong label, and both `/coachs` CTA buttons showed French labels, despite `<html lang="en">` and the page body being correctly English.
- **Fix:** `layout.tsx` now accepts `params`, awaits it, and calls `setRequestLocale(locale)` before rendering Header/Footer — mirroring the codebase's own established convention.
- **Files modified:** `apps/web/src/app/[locale]/(marketing)/layout.tsx`
- **Verification:** Re-ran the full 8-step walkthrough against a fresh production build (`next build && next start`): nav link href/label, CTA labels, and the FR/EN toggle's active state all correct on `/en`; French pages unaffected. Full suite re-run (319 passed / 4 known-skipped), `tsc --noEmit` clean on every Phase 5 file, lint exit 0, `next build` route table unchanged (both locales still SSG). As a side effect, this also fixed a pre-existing Phase 3 UI-walkthrough gap (CGU/CGV footer links showing French labels/hrefs on `/en`), confirmed via curl on the production build.
- **Committed in:** `137a562`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness — the founders page and its entry points, the exact surface this phase exists to ship, would have shipped with a broken English header/footer and mislabeled CTAs otherwise. No scope creep: fix is confined to the one shared layout file that was missing the codebase's own established convention.

## Issues Encountered

Two items from the T-05-14 8-step walkthrough could not be fully verified this session and remain open gaps, explicitly disclosed to and accepted by the user when they approved:

- **Step 3 (a real submission's success/duplicate confirmation states):** blocked because no working `SUPABASE_SERVICE_ROLE_KEY` was available in this session. The guard chain (honeypot/bot/rate-limit/syntax/disposable-domain) was confirmed working up to the RPC call, but the actual success panel, duplicate-resubmission parity, and founder-rank rendering were never observed live. Recommend a human with real local dev credentials verify this directly (~5 min) at the earliest opportunity.
- **Step 5 (FOND-06 — the counter's three states via a live `app_config` mutation):** skipped entirely, never attempted. The only Supabase project this session held credentials for (`slkobhavpwsubnsmuhya`) was confirmed by the user to be **production**, not the test project this step requires. No database was touched for this step; the reveal-rule/no-recomputation guarantees remain proven only by the unit-level greps already recorded in `05-VALIDATION.md`.

Both gaps are session-credential limitations, not implementation gaps — the underlying code paths (`WaitlistRoleForm`'s success/duplicate branches, the reveal-threshold verdict consumption) are covered by unit and component tests already green in the T-05-13 convergence run. They are recorded here, in `05-VALIDATION.md`'s Manual-Only Verifications table, and inherited by `STATE.md` as the same class of open gap Phase 1 already carries for its own DB-gated suites.

## Next Phase Readiness

- Phase 5 (Waitlist Page & Entry Points) is complete: 6/6 plans, all 19 requirements (WAIT-01 through ENTRY-06) verified and marked complete in `REQUIREMENTS.md`.
- Phase 6 (Founder Offer Go-Live) is unblocked — it depends on Phases 2, 3, 4, and 5 all being complete, and claims no net-new requirements of its own; it verifies the production-activation state of CRED-01, CRED-05, LEGAL-05, PURGE-01–05, and FOND-06.
- Two open, disclosed items to hand to Phase 6 (or resolve before it, whichever comes first): (1) a live, credentialed re-run of the DB-gated waitlist suites (`waitlist.concurrency.test.ts`) and the real-submission success/duplicate walkthrough, both blocked in this session by missing `SUPABASE_TEST_URL`/`SUPABASE_SERVICE_ROLE_KEY`; (2) the FOND-06 live counter-reveal observation against the actual test project, never attempted this session because only production credentials were available. Neither blocks Phase 6 from starting, but both should close before the founder offer is genuinely activated in production, since Phase 6's own goal is exactly that activation.

---
*Phase: 05-waitlist-page-entry-points*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `.planning/workstreams/lien-invite/phases/05-waitlist-page-entry-points/05-06-SUMMARY.md`
- FOUND: commit `137a562` (fix — locale propagation)
- FOUND: commit `7b7ab85` (docs — T-05-13 convergence gate)
