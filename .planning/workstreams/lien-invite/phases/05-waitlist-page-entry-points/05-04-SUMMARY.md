---
phase: 05-waitlist-page-entry-points
plan: 04
subsystem: ui
tags: [nextjs, next-intl, framer-motion, vitest, testing-library]

# Dependency graph
requires:
  - phase: 05-01
    provides: "WaitlistRoleForm's ?role= search-param preselect contract, WaitlistFounderBanner/Client chain, fondateurs.* copy surface"
  - phase: 05-03
    provides: "WaitlistCounterClient — the self-contained, prop-driven three-state counter widget"
provides:
  - "A dedicated founders section on the homepage (FoundersOfferSection/FoundersOfferSectionClient), mounted between <Hero /> and <HowItWorks />, showing Plan 05-03's live counter widget and one CTA to /fondateurs with no role hint"
  - "Both /coachs calls to action (CoachsHeroClient, CoachsCtaFooterClient) redirected to /fondateurs with ?role=coach, their four labels rewritten to describe a waitlist rather than a beta"
  - "WAITLIST_ROLE_PARAM / WAITLIST_ROLE_ATHLETE / WAITLIST_ROLE_COACH exported from WaitlistRoleForm.tsx — the single source of truth for the role pre-pick contract, now consumed by both /coachs links and this plan's own test suite"
  - "test/components/entry-points.test.tsx — 15 tests pinning every entry point's destination and the D-02/D-03 standing guards"
affects: [05-06-full-phase-gate]

# Actuals (#2632)
actuals:
  tokens: 5400
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A component exports the literal contract values it reads from search params (WAITLIST_ROLE_PARAM/WAITLIST_ROLE_COACH) so consumers elsewhere in the tree build matching hrefs by import, not by retyping a string that could silently drift"
    - "Homepage section reuses Plan 05-03's WaitlistCounterClient directly rather than a second, homepage-local badge — the same server/client marketing split as Hero.tsx, resolving both the Home.founders and fondateurs.counter namespaces in one server wrapper"

key-files:
  created:
    - apps/web/src/components/marketing/FoundersOfferSection.tsx
    - apps/web/src/components/marketing/FoundersOfferSectionClient.tsx
    - apps/web/test/components/entry-points.test.tsx
  modified:
    - apps/web/src/app/[locale]/(marketing)/page.tsx
    - apps/web/src/components/marketing/CoachsHeroClient.tsx
    - apps/web/src/components/marketing/CoachsCtaFooterClient.tsx
    - apps/web/src/components/marketing/WaitlistRoleForm.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json

key-decisions:
  - "WaitlistRoleForm.tsx now exports WAITLIST_ROLE_PARAM/WAITLIST_ROLE_ATHLETE/WAITLIST_ROLE_COACH (it previously only used the literals 'role'/'athlete'/'coach' internally) so CoachsHeroClient/CoachsCtaFooterClient build their hrefs from the same constants the form's own search-param reader accepts — a parameter-name or value typo now fails at compile/import time in the two link components, not silently at runtime on a live page."
  - "FoundersOfferSectionClient's CTA link and note text were normalized to the Label size (text-sm) per the UI-SPEC's documented typography deviation, rather than copying CoachsCtaFooterClient's original text-xs verbatim — the closest existing analog predates this phase's typography normalization."

requirements-completed: [ENTRY-01, ENTRY-02]

coverage:
  - id: D1
    description: "The homepage carries a dedicated founders section, mounted textually after <Hero /> and before <HowItWorks />, showing the same live counter widget as /fondateurs and one CTA to /fondateurs with no role hint"
    requirement: "ENTRY-01"
    verification:
      - kind: unit
        ref: "test/components/entry-points.test.tsx#Homepage source order (ENTRY-01, D-05) / FoundersOfferSectionClient (T-05-08, ENTRY-01, D-05) — 3 tests"
        status: pass
      - kind: e2e
        ref: "npx next build — /fr and /en both marked ● (SSG, prerendered) with the section mounted"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both /coachs calls to action lead to /fondateurs with the coach profile preselected via the exact role-hint parameter WaitlistRoleForm itself accepts, and neither links to /coach/onboarding any more"
    requirement: "ENTRY-02"
    verification:
      - kind: unit
        ref: "test/components/entry-points.test.tsx#CoachsHeroClient link target / CoachsCtaFooterClient link target / Role hint contract — 7 tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two /coachs buttons no longer promise beta access; their labels and notes describe joining the founder waitlist, in both locales, within the phase's no-deadline/no-urgency copy constraints"
    verification:
      - kind: other
        ref: "messages/fr.json + messages/en.json coachs.hero.cta/ctaNote and coachs.cta.button/note — manually rewritten, reviewed against 05-UI-SPEC.md's Copywriting Contract constraints"
        status: pass
    human_judgment: false
  - id: D4
    description: "/coach/onboarding is untouched, /coachs gained no section, and the header's own CTA still points at /coach/dashboard"
    verification:
      - kind: other
        ref: "git diff --stat on the coach route group and coachs/page.tsx (empty); grep -c \"coach/dashboard\" HeaderClient.tsx == 1; test/components/entry-points.test.tsx#Standing guards — 2 tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every string added or changed exists in both message files with matching key trees, and no legal sentence was restated"
    verification:
      - kind: unit
        ref: "test/components/entry-points.test.tsx#Message key parity (T-05-08) — 2 tests; node key-tree-parity script (plan acceptance criteria) — printed OK"
        status: pass
    human_judgment: false
  - id: D6
    description: "Both the homepage and /coachs still prerender statically for both locales after this plan's changes"
    verification:
      - kind: e2e
        ref: "npx next build — /[locale] and /[locale]/coachs both marked ● (SSG) for fr and en"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 4: Homepage Founders Section + Redirected /coachs CTAs Summary

**A dedicated founders section on the homepage reusing Plan 05-03's live counter widget verbatim, and both `/coachs` calls to action redirected to `/fondateurs?role=coach` — role param sourced from a constant `WaitlistRoleForm` itself exports so the link and the form's reader cannot drift — with 15 new tests pinning every entry point's destination.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)
- **Commits:** 2

## Accomplishments

- `FoundersOfferSection`/`FoundersOfferSectionClient` follow the established server/client
  marketing split (`Hero.tsx`, `CoachsCtaFooterClient.tsx`), mount Plan 05-03's
  `WaitlistCounterClient` verbatim above the heading — no second counter, no local badge —
  and link to `/${locale}/fondateurs` with no role hint, since the homepage speaks to both
  audiences at once (D-07)
- Mounted between `<Hero />` and `<HowItWorks />` on the homepage, exactly the position D-05
  chose because a nav link alone was judged insufficient for this offer
- `Home.founders` copy (heading/subheading/button/note) added to both locale files: the offer
  stated as fact, the real 200 cap named, both audiences addressed, no deadline/countdown/
  urgency device — matching the milestone's `REQUIREMENTS.md` constraints
- `CoachsHeroClient.tsx` and `CoachsCtaFooterClient.tsx` now link to
  `/${locale}/fondateurs?role=coach` instead of `/${locale}/coach/onboarding` — the role
  param name and value are read from `WaitlistRoleForm.tsx`'s own exported constants
  (`WAITLIST_ROLE_PARAM`/`WAITLIST_ROLE_COACH`), not retyped, so the link and the form's
  search-param reader cannot silently diverge
- `coachs.hero.cta`/`ctaNote` and `coachs.cta.button`/`note` rewritten in both locales to
  describe joining the founder waitlist rather than a private beta — `coachs.hero.badge` left
  untouched per the plan's explicit instruction
- `/coach/onboarding` unmodified, `/coachs` gained no section, and the header's CTA still
  points at `/coach/dashboard` — all three verified by `git diff --stat` on the untouched
  paths plus standing-guard tests
- Homepage and `/coachs` both still prerender statically (`●`, SSG) for both locales after
  `next build`
- Whole workspace suite green: 300 passed, 4 skipped (unchanged pre-existing skip), `tsc
  --noEmit` clean on every file this plan touched, `npm run lint` clean (0 errors)

## Task Commits

Each task was committed atomically:

1. **T-05-08: A dedicated founders section on the homepage, immediately after the hero (ENTRY-01, D-05)** - `2b7bd51` (feat)
2. **T-05-09: Point both /coachs calls to action at the founders page with coach pre-selected (ENTRY-02, D-01)** - `9311e9d` (feat)

## Files Created/Modified

- `apps/web/src/components/marketing/FoundersOfferSection.tsx` - async server component resolving `Home.founders.*` and `fondateurs.counter.*` strings, threads them as plain props
- `apps/web/src/components/marketing/FoundersOfferSectionClient.tsx` - the homepage section: counter widget, heading/subheading, primary CTA to `/fondateurs`, note
- `apps/web/src/app/[locale]/(marketing)/page.tsx` - mounts `<FoundersOfferSection locale={locale} />` between `<Hero />` and `<HowItWorks />`
- `apps/web/src/components/marketing/CoachsHeroClient.tsx` - link target changed to the founders path with the coach role hint
- `apps/web/src/components/marketing/CoachsCtaFooterClient.tsx` - same link-target change
- `apps/web/src/components/marketing/WaitlistRoleForm.tsx` - exports `WAITLIST_ROLE_PARAM`/`WAITLIST_ROLE_ATHLETE`/`WAITLIST_ROLE_COACH`, reads its own preselect through them
- `apps/web/messages/fr.json` / `apps/web/messages/en.json` - `Home.founders` block added; `coachs.hero.cta`/`ctaNote` and `coachs.cta.button`/`note` rewritten
- `apps/web/test/components/entry-points.test.tsx` - 15 RTL tests: both `/coachs` link targets (fr+en), the role-hint contract, the homepage section's role-less link (fr+en), source-order placement, message key parity, and the D-02/D-03 standing guards

## Decisions Made

- **Role-hint contract centralized in `WaitlistRoleForm.tsx`:** rather than duplicating the
  literal `'role'`/`'coach'` strings in `CoachsHeroClient.tsx`/`CoachsCtaFooterClient.tsx`,
  both now import `WAITLIST_ROLE_PARAM`/`WAITLIST_ROLE_COACH` from the form module and build
  their hrefs from them. A future rename of the param or its accepted values now breaks the
  build for these two links instead of silently landing a visitor on an unanswered picker.
- **Typography normalization applied to the new section's CTA/note, not copied verbatim from
  `CoachsCtaFooterClient.tsx`:** the closest existing analog uses `text-xs` for both, which
  predates 05-UI-SPEC.md's documented deviation normalizing that role up to `text-sm` (Label
  size). `FoundersOfferSectionClient` follows the UI-SPEC, not the older file's literal classes.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues surfaced during either task.

### Commit-boundary deviation (non-functional)

**The four `coachs.hero.cta`/`ctaNote` and `coachs.cta.button`/`note` label rewrites landed in
Task 1's commit (`2b7bd51`) instead of Task 2's (`9311e9d`).**
- **What happened:** Both message files were edited for `Home.founders` (Task 1's content) and
  the `coachs` label rewrites (Task 2's content) in the same working-tree pass before Task 1's
  commit ran. Task 1's `git add apps/web/messages/fr.json apps/web/messages/en.json` staged the
  whole file, not just the `Home.founders` hunk, so the `coachs` label changes were committed a
  task early.
- **Impact:** None on correctness or on the plan's guarantees. Both changes are legitimate,
  required content exactly as specified; every acceptance-criteria check (git diffs, greps, the
  key-tree-parity script, the full test suite) was re-run after both commits and passes against
  the final tree. The only effect is that `2b7bd51`'s diff is slightly broader than its commit
  message describes, and `9311e9d`'s diff is narrower than T-05-09's file list implies.
- **Not corrected via amend:** per this executor's protocol, prior commits are never rewritten;
  the discrepancy is recorded here instead. A reviewer diffing `9922b21..HEAD` (the full plan)
  sees the complete, correct set of changes regardless of which of the two commits a given hunk
  landed in.

---

**Total deviations:** 0 auto-fixed, 1 documented commit-boundary misattribution (non-functional)
**Impact on plan:** No production behavior affected. All functional acceptance criteria for both
tasks — 15 new tests, the whole workspace suite (300 passed, 4 skipped), `tsc --noEmit` clean,
`npm run lint` clean, `next build` still SSG for the homepage and `/coachs` in both locales, and
every grep/diff check in both tasks' acceptance criteria — pass exactly as specified.

## Issues Encountered

- Rendering any component that statically imports `WaitlistRoleForm.tsx` (directly, or
  transitively via `CoachsHeroClient.tsx`/`CoachsCtaFooterClient.tsx`) pulls in
  `@/actions/waitlist`, which imports `server-only` — this throws in a plain client-side test
  render. Resolved by mocking `@/actions/waitlist` in `entry-points.test.tsx`, the same mock
  `WaitlistRoleForm.test.tsx` already installs; not a deviation, just the established test
  idiom for this module.
- Verified directly (not just per the plan's caution) that neither `CoachsHeroClient.tsx` nor
  `CoachsCtaFooterClient.tsx` needed their `useScroll`/`useInView` hooks stubbed in happy-dom —
  both components render their CTA link unconditionally regardless of viewport/in-view state
  (only decorative elements are gated), confirmed by a throwaway probe render before writing the
  real suite. `entry-points.test.tsx` therefore contains no framer-motion mock.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-05 (header/footer nav links) is unblocked — this plan touched no file under
  `apps/web/src/components/layout/`, `apps/web/src/app/sitemap.ts`, or
  `apps/web/src/app/[locale]/layout.tsx` (`git diff --stat` on all three confirmed empty).
- Plan 05-06 (full-phase gate run) inherits: `Home.founders` and the rewritten `coachs.hero`/
  `coachs.cta` keys in both message files; `WAITLIST_ROLE_PARAM`/`WAITLIST_ROLE_ATHLETE`/
  `WAITLIST_ROLE_COACH` as the canonical role-hint contract any future consumer should import
  rather than retype; `test/components/entry-points.test.tsx` as a standing regression guard for
  D-01/D-02/D-03/D-05/D-06 together.
- No blockers identified for downstream Phase 5 plans.

---
*Phase: 05-waitlist-page-entry-points*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 9 files listed under "Files Created/Modified" confirmed present on disk (`FoundersOfferSection.tsx`,
`FoundersOfferSectionClient.tsx`, `entry-points.test.tsx` created; `page.tsx`, `CoachsHeroClient.tsx`,
`CoachsCtaFooterClient.tsx`, `WaitlistRoleForm.tsx`, `messages/fr.json`, `messages/en.json` modified).
Both task commits (`2b7bd51`, `9311e9d`) confirmed present in `git log --oneline --all`.
