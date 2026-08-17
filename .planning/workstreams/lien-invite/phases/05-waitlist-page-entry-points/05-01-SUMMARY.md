---
phase: 05-waitlist-page-entry-points
plan: 01
subsystem: ui
tags: [nextjs, next-intl, framer-motion, useActionState, next-og, react-icons, vitest, testing-library]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "claim_waitlist_signup() / claimWaitlistSpot Server Action, WaitlistState shape, D-03/D-04 non-disclosure filter"
  - phase: 03-legal-cgv-cgu
    provides: "CONSENT_CHECKBOX_LABEL / COLLECTION_POINT_NOTICE frozen legal copy in @/content/legal/founder-offer.ts"
provides:
  - "The /fondateurs SSG route (fr+en), statically prerendered, no request-time reads"
  - "WaitlistFounderBanner / WaitlistFounderBannerClient / WaitlistRoleForm component chain"
  - "Complete bilingual fondateurs/Header.founders/Footer.founders copy surface in messages/{fr,en}.json — Plans 05-02/05-03/05-05 read these keys, must not add to them"
  - "opengraph-image.tsx / twitter-image.tsx code-generated social preview for /fondateurs"
  - "A commented mount slot above the hero headline reserved for Plan 05-03's live counter widget"
affects: [05-02-abuse-hardening, 05-03-counter-widget, 05-04-entry-points, 05-05-nav-links]

# Actuals (#2632)
actuals:
  tokens: 9700
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suspense-wrapped client-side useSearchParams() read (not a page-component request-time read) to satisfy a role pre-pick without breaking static generation"
    - "Server/client marketing component split (WaitlistFounderBanner resolves next-intl + legal copy, WaitlistFounderBannerClient owns animation/interactivity) mirroring Hero.tsx/HeroClient.tsx"
    - "next/og opengraph-image.tsx/twitter-image.tsx file-convention social preview generated from the page's own message-file copy, twitter re-exporting the OG generator"
    - "useActionState dispatched via a manual onSubmit + startTransition(() => formAction(new FormData(...))) instead of <form action={formAction}> — see Deviations"

key-files:
  created:
    - apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx
    - apps/web/src/app/[locale]/(marketing)/fondateurs/opengraph-image.tsx
    - apps/web/src/app/[locale]/(marketing)/fondateurs/twitter-image.tsx
    - apps/web/src/components/marketing/WaitlistFounderBanner.tsx
    - apps/web/src/components/marketing/WaitlistFounderBannerClient.tsx
    - apps/web/src/components/marketing/WaitlistRoleForm.tsx
    - apps/web/test/components/WaitlistRoleForm.test.tsx
    - apps/web/test/app/fondateurs.metadata.test.ts
  modified:
    - apps/web/messages/fr.json
    - apps/web/messages/en.json

key-decisions:
  - "WaitlistRoleForm submits via manual onSubmit + startTransition dispatch rather than <form action={formAction}>, because happy-dom's BrowserFrameNavigator eval()s React 19's javascript: sentinel href unconditionally regardless of preventDefault() — a happy-dom limitation this repo's test environment can't route around. Same useActionState dispatcher either way."
  - "WaitlistFounderBanner passes only errorGeneric (not errorInvalidEmail) down the prop chain — the form renders one generic error sentence for now per the plan's action text; Plan 05-02 will replace it with a code-driven mapping once the Server Action classifies failures."

requirements-completed: [WAIT-01, WAIT-02, WAIT-03, WAIT-05, WAIT-06, WAIT-07, WAIT-08, ENTRY-04]

coverage:
  - id: D1
    description: "/fondateurs renders as a complete SSG route for both locales, produced by generateStaticParams, with no request-time reads anywhere in the route segment"
    requirement: "WAIT-01"
    verification:
      - kind: e2e
        ref: "npx next build — route table marks /fr/fondateurs and /en/fondateurs as ● (SSG, prerendered)"
        status: pass
      - kind: unit
        ref: "test/app/fondateurs.metadata.test.ts#generateStaticParams resolves to exactly the two locale objects"
        status: pass
    human_judgment: false
  - id: D2
    description: "No email input exists in the DOM before a role is picked; clicking a role card is what brings it into existence"
    requirement: "WAIT-02"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#renders no email textbox before a role is picked (WAIT-02)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#reveals exactly one email textbox after clicking the Athlète card (WAIT-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The only visitor-typed field is the email address; every other value (audience, locale) is a hidden field"
    requirement: "WAIT-03"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#exposes no second text/number/select input beyond the email field (WAIT-03)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#carries the picked role in the hidden audience input and the locale prop in the hidden locale input"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-08 coach pre-pick via ?role=coach loads with coach selected and the email field present, and the picker never locks"
    requirement: "WAIT-05"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#preselects the coach card and shows the email field when search params carry role=coach (D-08)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#leaves the athlete card clickable after a coach pre-pick — the picker never locks (D-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Success copy is chosen by state.isFounder alone — never state.message — and a duplicate renders byte-identically to a genuinely-new non-founder signup"
    requirement: "WAIT-06"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#renders the localized founder sentence containing the rank when the action reports a genuine founder (WAIT-05)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#renders the localized generic sentence with no digit when the action reports no founder status (WAIT-06)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#renders the byte-identical generic success sentence whether the row was genuinely new or a duplicate (WAIT-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Consent checkbox renders Phase 3's frozen legal strings verbatim and gates submission; unchecked by default on every load"
    requirement: "WAIT-02"
    verification:
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#disables the submit control until consent is checked, then enables it with a role picked (LEGAL-06)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#renders the exact French CONSENT_CHECKBOX_LABEL and COLLECTION_POINT_NOTICE strings for locale=\"fr\" (LEGAL-06/07)"
        status: pass
      - kind: unit
        ref: "test/components/WaitlistRoleForm.test.tsx#renders the exact English CONSENT_CHECKBOX_LABEL and COLLECTION_POINT_NOTICE strings for locale=\"en\" (LEGAL-06/07)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Sharing either locale's URL yields a correct 1200x630 social preview and an explicit summary_large_image Twitter card, with correct canonical/alternates/OpenGraph metadata"
    requirement: "ENTRY-04"
    verification:
      - kind: unit
        ref: "test/app/fondateurs.metadata.test.ts (12 tests — title/description, canonical/alternates, OpenGraph block, Twitter card, image module size/content-type)"
        status: pass
      - kind: e2e
        ref: "npx next build — emits opengraph-image and twitter-image routes for both locales"
        status: pass
    human_judgment: false
  - id: D8
    description: "The complete bilingual fondateurs/Header.founders/Footer.founders copy surface exists in both message files with structurally identical key trees"
    verification:
      - kind: other
        ref: "node key-tree-parity check over messages/fr.json and messages/en.json (plan acceptance criteria script) — printed OK"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every color/radius/border/spacing value resolves to an existing Tailwind v4 semantic token — no new @theme entry, no raw hex outside the shared CTA box-shadow"
    requirement: "WAIT-07"
    verification: []
    human_judgment: true
    rationale: "Visual/token conformance to the UI-SPEC's color, typography and spacing tables is a design-review judgment call — classes were authored to match the spec but a human visual pass over the rendered page has not occurred in this session."

# Metrics
duration: ~55min
completed: 2026-08-17
status: complete
---

# Phase 5 Plan 1: /fondateurs Tracer — Role Picker, Email Form, Server Action Wiring Summary

**Bilingual `/fondateurs` SSG route with a progressive-disclosure role picker, Server-Action-wired
email form using `useActionState`, code-generated OpenGraph/Twitter previews via `next/og`, and the
complete bilingual copy surface for the whole phase — 25 tests green.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 10 (8 created, 2 modified)
- **Commits:** 2

## Accomplishments

- `/fr/fondateurs` and `/en/fondateurs` both render as statically prerendered pages
  (`next build` marks both `●` SSG) with no request-time reads in the route segment
- `WaitlistRoleForm` implements progressive disclosure (no email field until a role is picked),
  the D-08 coach pre-pick via a `Suspense`-wrapped client-side `useSearchParams()` read, a
  consent-gated submit button, and success copy chosen solely by `state.isFounder` — never
  `state.message` — so a duplicate and a genuinely-new non-founder signup render byte-identically
- The frozen Phase 3 legal strings (`CONSENT_CHECKBOX_LABEL`, `COLLECTION_POINT_NOTICE`) are
  imported and rendered verbatim, never retyped
- `opengraph-image.tsx`/`twitter-image.tsx` generate the 1200x630 social preview from the page's
  own message-file copy at build time per locale, replacing the previously-anticipated committed
  static PNG
- The full bilingual `fondateurs`/`Header.founders`/`Footer.founders` copy surface exists in
  `messages/fr.json` and `messages/en.json` with structurally identical key trees
- 13 component tests (`WaitlistRoleForm.test.tsx`) and 12 metadata tests
  (`fondateurs.metadata.test.ts`) pin the interaction and metadata contracts

## Task Commits

Each task was committed atomically:

1. **T-05-01: End-to-end — pick a profile, submit one email, see the confirmation** - `742af1d` (feat)
2. **T-05-02: Social preview and metadata contract (ENTRY-04)** - `9fdf3b9` (feat)

_Tracer feedback gate (auto mode active): re-ran `WaitlistRoleForm.test.tsx` immediately after
committing Task 1 — 13/13 passing — before proceeding to Task 2._

## Files Created/Modified

- `apps/web/src/app/[locale]/(marketing)/fondateurs/page.tsx` - SSG route mirroring `coachs/page.tsx`, plus an explicit `twitter: { card: 'summary_large_image' }` block
- `apps/web/src/app/[locale]/(marketing)/fondateurs/opengraph-image.tsx` - `next/og` 1200x630 OpenGraph image, composed from the page's own locale copy
- `apps/web/src/app/[locale]/(marketing)/fondateurs/twitter-image.tsx` - re-exports the OG image generator so the Twitter card can never drift from it
- `apps/web/src/components/marketing/WaitlistFounderBanner.tsx` - server component resolving `next-intl` + Phase 3's legal constants, passes plain strings down
- `apps/web/src/components/marketing/WaitlistFounderBannerClient.tsx` - hero + role-picker section, `Suspense`-wraps `WaitlistRoleForm`, reserves a commented slot for Plan 05-03's counter
- `apps/web/src/components/marketing/WaitlistRoleForm.tsx` - the tracer's heart: role cards, progressive-disclosure email field, consent gate, `useActionState` wiring to `claimWaitlistSpot`
- `apps/web/test/components/WaitlistRoleForm.test.tsx` - 13 RTL tests pinning WAIT-02/03/05/06 and LEGAL-06/07
- `apps/web/test/app/fondateurs.metadata.test.ts` - 12 Node-environment tests pinning the metadata contract
- `apps/web/messages/fr.json` / `apps/web/messages/en.json` - `fondateurs` namespace + `Header.founders`/`Footer.founders`, structurally identical key trees

## Decisions Made

- **Consent-prop trimming:** `WaitlistFounderBanner` threads only `errorGeneric` down to
  `WaitlistRoleForm`, not `errorInvalidEmail` — the form currently renders one generic error
  sentence per the plan's action text ("a single generic sentence is the truthful thing to show
  until [Plan 05-02] starts classifying failures"). No dead prop was left in the component chain.
- **Role-card and CTA recipe:** followed `05-UI-SPEC.md` §3/§5 and the Label-size (`text-sm`, not
  `text-xs`) CTA normalization exactly, reusing `fadeUp`/`ctaHover`/`ctaTap` from `@/lib/motion`
  with no new animation primitive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `WaitlistRoleForm` dispatches via manual `onSubmit` + `startTransition`, not `<form action={formAction}>`**
- **Found during:** Task 1, writing and running `WaitlistRoleForm.test.tsx`
- **Issue:** `DeleteAccountForm.tsx`'s house idiom (`<form action={formAction}>`) is what the plan
  and `05-PATTERNS.md` specify. Under this repo's test environment, React 19 sets a sentinel
  `javascript:` href on the form's `action` attribute as a safety net (only meant to fire if a
  submission somehow escapes React's own listener). happy-dom 15.11's
  `BrowserFrameNavigator.navigate()` `eval()`s that href on its `javascript:` protocol branch
  unconditionally — ahead of, and regardless of, `preventDefault()` — throwing an uncaught
  `SyntaxError` and leaving `state` permanently at `'idle'`, so every submission-path test
  (founder rank, generic success, byte-identical duplicate) failed or hung.
- **Fix:** Replaced `<form action={formAction}>` with `<form onSubmit={...}>` that calls
  `event.preventDefault()` and dispatches `formAction(new FormData(event.currentTarget))`
  wrapped in `startTransition(...)` (without the transition wrapper, `useActionState`'s `pending`
  state silently stopped updating — a real correctness bug that showed up as a React console
  warning during the fix, not just a test artifact). This is the same `useActionState` dispatcher,
  given the same `FormData` shape, and works identically in a real browser — it just doesn't rely
  on the browser's native action-submission pathway that happy-dom mishandles.
- **Also tried and reverted:** an `environmentOptions.happyDOM.settings` override in
  `vitest.config.ts` (`disableJavaScriptEvaluation` + `navigation.disableMainFrameNavigation`)
  suppressed the crash but didn't fix the underlying non-invocation; once the `onSubmit` fix made
  the config change unnecessary, it was reverted rather than left as an unexplained global test
  knob. `git diff vitest.config.ts` is empty in the final state.
- **Files modified:** `apps/web/src/components/marketing/WaitlistRoleForm.tsx`
- **Verification:** `npx vitest run test/components/WaitlistRoleForm.test.tsx` — 13/13 passing, no console warnings
- **Committed in:** `742af1d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix is behavior-preserving in production (same dispatcher, same data) and
was necessary to get a real, passing test suite rather than a suite that merely avoided crashing.
No scope creep — no other file's submission idiom was touched (`DeleteAccountForm.tsx` is untouched).

## Issues Encountered

- The prior session's partial work-in-progress (`messages/{fr,en}.json`, `WaitlistFounderBanner.tsx`,
  and the `fondateurs/` directory with `page.tsx`) was verified against this plan's actual task text
  before reuse. `messages/{fr,en}.json` and `page.tsx` matched the plan's copy contract and SSG shape
  closely enough to keep as-is (prop lists on `WaitlistFounderBanner.tsx` were trimmed to drop an
  unused `errorInvalidEmail` prop once `WaitlistRoleForm` was built — see Decisions). Nothing from
  that WIP was committed prior to this session; all commits above are new.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-02 (abuse hardening) can extend `apps/web/src/actions/waitlist.ts` freely — this plan's
  `git diff --stat` on that file is empty, confirming it was untouched.
- Plan 05-03 (counter widget) has a ready mount point: the commented slot immediately above the
  hero headline in `WaitlistFounderBannerClient.tsx`, and every `fondateurs.counter.*` message key
  already exists in both locale files.
- Plans 05-04/05-05 (entry points, nav links) can rely on `?role=athlete`/`?role=coach` as the
  pre-pick contract and on `Header.founders`/`Footer.founders` already existing in both message files.
- No blockers identified for downstream Phase 5 plans.

---
*Phase: 05-waitlist-page-entry-points*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 10 files listed under "Files Created/Modified" confirmed present on disk. Both task commits
(`742af1d`, `9fdf3b9`) confirmed present in `git log --oneline --all`.
