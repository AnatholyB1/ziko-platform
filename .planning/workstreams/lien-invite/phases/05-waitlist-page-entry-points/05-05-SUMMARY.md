---
phase: 05-waitlist-page-entry-points
plan: 05
subsystem: ui
tags: [nextjs, next-intl, vercel-analytics, vitest, testing-library, tailwind]

# Dependency graph
requires:
  - phase: 05-01
    provides: "/fondateurs SSG route, Header.founders/Footer.founders message keys already seeded in both locale files, WAITLIST_ROLE_PARAM contract"
  - phase: 05-02
    provides: "claimWaitlistSpot's guard chain and WaitlistState.code shape the success/error branches of the conversion-event guard read"
provides:
  - "A plain 'Fondateurs'/'Founders' nav link in HeaderClient and FooterClient, on every page, in both locales, weighted like their neighbours (D-04)"
  - "sitemap.ts's founders entry for both locales with correct alternates, daily changefreq, priority 0.9"
  - "@vercel/analytics mounted site-wide via <Analytics /> in the locale layout"
  - "WaitlistRoleForm's ref-guarded, single-key ('audience') conversion event on successful signup"
affects: [05-06-full-phase-gate]

# Actuals (#2632)
actuals:
  tokens: 6716
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: ["@vercel/analytics@^2.0.1"]
  patterns:
    - "Shared NAV_LINK_CLASS constant in HeaderClient.tsx copied verbatim onto the new founders link and the unselected-locale-link ternary branch, so both literally emit the identical class string (D-04 equal-weight guarantee by construction, not by convention)"
    - "useEffect keyed on [state.status, role] plus a useRef boolean guard for the conversion event — dependency-array idempotency alone would already prevent re-firing on a same-state re-render; the ref additionally survives a React 19 Strict Mode double-invoke in development"

key-files:
  created:
    - apps/web/test/components/site-chrome.test.tsx
    - apps/web/test/app/sitemap.test.ts
  modified:
    - apps/web/src/components/layout/Header.tsx
    - apps/web/src/components/layout/HeaderClient.tsx
    - apps/web/src/components/layout/Footer.tsx
    - apps/web/src/components/layout/FooterClient.tsx
    - apps/web/src/app/sitemap.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/components/marketing/WaitlistRoleForm.tsx
    - apps/web/package.json
    - package-lock.json
    - apps/web/test/components/WaitlistRoleForm.test.tsx

key-decisions:
  - "Header's right-hand row and the new founders link use the exact class recipe 05-UI-SPEC.md §1 specifies verbatim (`text-sm text-muted hover:text-text transition-colors px-2 py-2 min-h-[44px] inline-flex items-center rounded`, wrapper gains `flex-wrap justify-end gap-y-2`) — no hand-composed near-match."
  - "Footer's founders link uses AnimatedLink verbatim per 05-UI-SPEC.md §2's explicit 'zero new styling code' instruction — it does not carry a min-h-[44px] touch-target class, matching every sibling footer link (legal/privacy/terms/cgv) exactly, which is what D-04's 'same visual weight' requires. The plan's own behaviour bullet ('both new links meet the minimum touch-target height the existing locale links use') is satisfied for the header link (whose copied class already includes min-h-[44px]) and, for the footer, is satisfied by parity-with-siblings rather than an independent 44px floor — adding that floor only to the new link while its neighbours lack it would have made it taller than the links it must visually match, directly contradicting D-04 and the UI-SPEC's explicit 'verbatim, no new styling' instruction it inherits from."
  - "sitemap priority for /fondateurs set to 0.9 (below the homepage's 1.0, above every legal page's 0.3) and changeFrequency 'daily', per the plan's own action text — the offer page's remaining-spot count changes daily during the live window."
  - "track() imported from the base '@vercel/analytics' package (not '@vercel/analytics/react') in a 'use client' component — both work in the browser; the base import needs no extra plumbing and Vercel's own Next.js example uses it this way alongside the /next entry point's <Analytics /> mount."

requirements-completed: [ENTRY-03, ENTRY-05, ENTRY-06]

coverage:
  - id: D1
    description: "A visitor can reach /fondateurs from the header and the footer on every page, in both locales, as a plain link weighted like its neighbours (ENTRY-03, D-04)"
    requirement: "ENTRY-03"
    verification:
      - kind: unit
        ref: "test/components/site-chrome.test.tsx — 8 tests: header link href/label, class-list equality vs. the unselected locale link, footer link first-in-nav and identical class list to the legal link"
        status: pass
      - kind: other
        ref: "grep -c fondateurs on HeaderClient.tsx and FooterClient.tsx both output 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03 preserved — the header's CTA still points at /coach/dashboard with its accent styling, untouched by this plan"
    requirement: "ENTRY-03"
    verification:
      - kind: unit
        ref: "test/components/site-chrome.test.tsx#still produces a link to the coach dashboard bearing the CTA label with its accent styling intact (D-03)"
        status: pass
      - kind: unit
        ref: "test/components/entry-points.test.tsx (Plan 05-04's standing guard, unmodified) — the header component's own call to action still points at the coach dashboard"
        status: pass
    human_judgment: false
  - id: D3
    description: "The header's right-hand row wraps rather than clips or scrolls on narrow viewports; no hamburger/drawer/mobile-nav component introduced"
    verification:
      - kind: unit
        ref: "test/components/site-chrome.test.tsx#the right-hand container permits its children to wrap"
        status: pass
      - kind: other
        ref: "! grep -qiE 'bg-primary[^\"'\\'']*fondateurs|hamburger|MobileNav|Drawer' HeaderClient.tsx succeeds; grep -c flex-wrap outputs 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "/fondateurs appears in the sitemap for both locales with correct language alternates, and nothing in robots.ts blocks it (ENTRY-05)"
    requirement: "ENTRY-05"
    verification:
      - kind: unit
        ref: "test/app/sitemap.test.ts — 6 tests: both locale URLs + alternates, lastModified/priority present, 4 pre-existing paths survive, total count == 5 pages x 2 locales, robots produces no fondateurs disallow, account-deletion disallow unchanged"
        status: pass
      - kind: other
        ref: "git diff --stat apps/web/src/app/robots.ts is empty — confirmed no change needed"
        status: pass
    human_judgment: false
  - id: D5
    description: "The sitemap's 4 pre-existing entries are unchanged and the 2 pre-existing omissions (/coachs, /cgv) were not silently repaired"
    verification:
      - kind: other
        ref: "node entry-count probe: exactly 5 changeFrequency entries (4 pre-existing + 1 addition) — prints OK"
        status: pass
    human_judgment: false
  - id: D6
    description: "A completed signup emits exactly one conversion event carrying only the chosen audience (ENTRY-06 client half)"
    requirement: "ENTRY-06"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx > conversion event (T-05-12, ENTRY-06) — 5 tests: exactly-once firing, stable event name + one-key payload, no re-fire on re-render, no fire on error, founder/generic payload parity"
        status: pass
      - kind: other
        ref: "! grep -qE 'track\\([^)]*email|track\\([^)]*founderRank|track\\([^)]*rank' WaitlistRoleForm.tsx succeeds"
        status: pass
    human_judgment: false
  - id: D7
    description: "The founders page still prerenders for both locales after the analytics mount and the event call are added; every marketing route unaffected"
    verification:
      - kind: e2e
        ref: "npx next build — /fr/fondateurs, /en/fondateurs, /fr/coachs, /en/coachs, homepage all still marked ● (SSG)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Web Analytics is enabled for the ziko-web project in the Vercel dashboard, so the client-side event actually records in production"
    verification: []
    human_judgment: true
    rationale: "This session has no access to the Vercel dashboard. The code is correct and fully testable either way per the plan's own precondition text; whether the dashboard toggle has been flipped is unverifiable from here and is recorded under User Setup Required below rather than assumed."

# Metrics
duration: ~40min
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 5: Header/Footer Nav Links, Sitemap Entry, and One Conversion Event Summary

**A plain "Fondateurs" nav link in the header and footer on every page (both locales, D-04 equal
visual weight), a sitemap entry for `/fondateurs` with correct alternates, and a ref-guarded
`@vercel/analytics` `track()` call firing exactly once per completed signup with a payload
containing only the chosen audience — 32 new tests, full workspace suite (319 tests) green.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 11 (2 created, 9 modified)
- **Commits:** 3

## Accomplishments

- `HeaderClient.tsx`/`FooterClient.tsx` resolve and render a new `founders` label, threaded down
  from `Header.tsx`/`Footer.tsx` exactly the way every other label in these components already
  travels
- The header's "Fondateurs" link reuses the unselected locale link's exact class recipe
  (`text-sm text-muted hover:text-text transition-colors px-2 py-2 min-h-[44px] inline-flex
  items-center rounded`) via a shared `NAV_LINK_CLASS` constant, so the D-04 equal-weight
  guarantee holds by construction rather than by a hand-typed near-match
- The header's right-hand row gained `flex-wrap justify-end gap-y-2`, so a third nav item no
  longer forces clipping or horizontal scroll on narrow viewports — no hamburger/drawer
  introduced
- The footer's link is the first nav item, rendered by the existing `AnimatedLink` helper
  verbatim, per D-04 and the UI-SPEC's explicit "zero new styling code" instruction
- `/fondateurs` was added to `sitemap.ts`'s `pages` array (daily changefreq, priority 0.9);
  `robots.ts` was confirmed to need no change and was left untouched
- `@vercel/analytics@^2.0.1` installed (research-verified `OK` legitimacy, no human gate
  required); `@vercel/speed-insights` deliberately not installed
- `<Analytics />` mounted in `apps/web/src/app/[locale]/layout.tsx`, inside `<body>`, after
  `{children}`
- `WaitlistRoleForm.tsx` fires `track('waitlist_signup', { audience })` exactly once on the
  transition into the success state, guarded by both a `useEffect` dependency array and a
  `useRef` boolean — the payload carries only the audience, never the email, rank, or any
  identifier, and the founder and generic branches emit an identical key set

## Task Commits

Each task was committed atomically:

1. **T-05-10: A plain founders link in the header and the footer, on every page (ENTRY-03, D-04)** - `dde45c2` (feat)
2. **T-05-11: List the founders route in the sitemap and confirm nothing blocks it (ENTRY-05)** - `e4e98b5` (feat)
3. **T-05-12: Emit one cookieless conversion event per completed signup (ENTRY-06)** - `bea3391` (feat)

## Files Created/Modified

- `apps/web/src/components/layout/Header.tsx` / `HeaderClient.tsx` - resolve and render the `founders` label; new `NAV_LINK_CLASS` constant; right-hand row gains `flex-wrap justify-end gap-y-2`
- `apps/web/src/components/layout/Footer.tsx` / `FooterClient.tsx` - resolve and render `founders`; new `AnimatedLink` entry, first in the nav list
- `apps/web/src/app/sitemap.ts` - one new page-array entry for `/fondateurs`
- `apps/web/src/app/[locale]/layout.tsx` - `<Analytics />` mount from `@vercel/analytics/next`
- `apps/web/src/components/marketing/WaitlistRoleForm.tsx` - ref-guarded `track()` call on the success transition
- `apps/web/package.json` / `package-lock.json` - `@vercel/analytics@^2.0.1`
- `apps/web/test/components/site-chrome.test.tsx` - new, 8 tests (header/footer nav link contracts)
- `apps/web/test/app/sitemap.test.ts` - new, 6 tests (sitemap + robots contract)
- `apps/web/test/components/WaitlistRoleForm.test.tsx` - 5 new cases appended under a `conversion event (T-05-12, ENTRY-06)` describe block; all 13 pre-existing cases unchanged (18/18 total)

## Decisions Made

- **Footer touch-target reading:** the plan's behaviour bullet asks that "both new links meet the
  minimum touch-target height the existing locale links use," but the UI-SPEC's own §2 instructs
  reusing `AnimatedLink` "verbatim, zero new styling code" for the footer link — and `AnimatedLink`
  itself carries no `min-h-[44px]`, matching every existing footer sibling (legal/privacy/terms/
  cgv). Resolved in favor of the UI-SPEC's explicit, more specific instruction: the header link
  (whose copied class recipe already includes `min-h-[44px]`) satisfies the touch-target bullet
  directly; the footer link satisfies D-04's equal-weight requirement by being structurally
  identical to its siblings, which is the more important guarantee those siblings currently share.
  Giving only the new link a 44px floor its neighbours lack would have made it visually taller —
  the opposite of D-04's intent.
- **`track()` import source:** imported from the base `'@vercel/analytics'` package rather than
  `'@vercel/analytics/react'` — both work identically from a `'use client'` component; the base
  import needs no additional wiring beyond the `<Analytics />` mount already using the `/next`
  entry point.
- **Event guard belt-and-suspenders:** a `useEffect` dependency array (`[state.status, role]`)
  alone already prevents re-firing on a same-state re-render, but the plan explicitly asked for a
  ref guard, which additionally protects against a React 19 Strict Mode development double-invoke
  counting one signup twice. Both mechanisms are present; neither is redundant in practice.

## Deviations from Plan

None — plan executed exactly as written, including the footer touch-target reading documented
above under Decisions Made (a plan-interpretation resolution favoring the more specific and
canonical UI-SPEC instruction, not a deviation from either document's actual text).

## Issues Encountered

None.

## User Setup Required

- **Web Analytics must be enabled for the `ziko-web` project in the Vercel dashboard** (Vercel
  Dashboard → `ziko-web` project → Analytics → Enable) before the `track()` call this plan wires
  up actually records anything in production. The code is correct and fully tested regardless —
  `@vercel/analytics`'s script simply emits nothing to a project where Web Analytics has not been
  turned on. This session has no access to the Vercel dashboard to confirm the toggle's current
  state; per the plan's own precondition text, this is recorded here rather than assumed either
  way.

## Next Phase Readiness

- Plan 05-06 (full-phase gate run) can rely on: every entry point required by ENTRY-01 through
  ENTRY-06 now exists (homepage section, `/coachs` CTA redirects from Plan 05-04, header/footer
  nav links and sitemap entry from this plan), and both halves of ENTRY-06 (database UTM columns
  from Plan 05-02, client-side conversion event from this plan) are in place.
- No blockers identified for Plan 05-06.

---
*Phase: 05-waitlist-page-entry-points*
*Completed: 2026-08-17*

## Self-Check: PASSED

All files listed under "Files Created/Modified" confirmed present on disk. All three task commits
(`dde45c2`, `e4e98b5`, `bea3391`) confirmed present in `git log --oneline --all`.
