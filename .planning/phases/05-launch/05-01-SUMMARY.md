---
phase: 05-launch
plan: 01
subsystem: ui
tags: [next.js, plausible, analytics, hero, screenshot, marketing]

# Dependency graph
requires:
  - phase: 04-seo-performance
    provides: Hero phone frame with next/image fill+priority pattern
provides:
  - Hero component referencing real Expo app screenshot at /screen.jpg
  - Plausible Analytics script injected in root layout with cookieless tracking
affects: [05-launch plan 02 (deploy verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "next/script with strategy=afterInteractive for third-party analytics"
    - "Plausible as cookieless analytics — no consent banner required"

key-files:
  created:
    - src/components/marketing/Hero.tsx (screenshot src changed)
    - public/screen.jpg (now tracked in git)
  modified:
    - src/components/marketing/Hero.tsx
    - src/app/layout.tsx

key-decisions:
  - "Plausible script placed after {children} inside body — loads after page content, non-blocking"
  - "screen.jpg committed to git — required public asset, no CDN dependency"
  - "strategy=afterInteractive ensures script loads post-hydration (Next.js best practice)"
  - "No noscript fallback per CONTEXT.md — Plausible works correctly without it"

patterns-established:
  - "Third-party analytics via next/script with strategy=afterInteractive"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 5 Plan 01: Screenshot swap + Plausible Analytics — launch code changes

**Real Expo app screenshot wired into Hero phone frame and Plausible cookieless analytics injected into root layout via next/script — production build passes with all 16 routes statically generated.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-27T18:58:02Z
- **Completed:** 2026-03-27T19:01:00Z
- **Tasks:** 3
- **Files modified:** 3 (Hero.tsx, layout.tsx, public/screen.jpg tracked)

## Accomplishments

- Replaced placeholder PNG reference with `/screen.jpg` in Hero component — real Expo app screenshot now displayed
- Added Plausible Analytics `<Script>` with `data-domain="ziko-app.com"` and `strategy="afterInteractive"` — cookieless tracking, no CNIL consent banner needed
- Committed `public/screen.jpg` to git so the Hero image reference resolves in production
- Production build verified: exit 0, all 16 routes remain statically generated (SSG), no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap Hero placeholder to real screenshot** - `314df73` (feat)
2. **Task 2: Install Plausible Analytics script in root layout** - `adc328b` (feat)
3. **Task 3: Build verification gate + screen.jpg asset** - `e9d8835` (chore)

## Files Created/Modified

- `src/components/marketing/Hero.tsx` — src prop changed from `/app-screenshot-placeholder.png` to `/screen.jpg`; all other Image props (alt, fill, priority, sizes, style) unchanged
- `src/app/layout.tsx` — `import Script from 'next/script'` added; `<Script defer data-domain="ziko-app.com" src="https://plausible.io/js/script.js" strategy="afterInteractive" />` added inside body after {children}
- `public/screen.jpg` — real Expo app screenshot committed to git (was untracked)

## Decisions Made

- `screen.jpg` committed to the `ziko-web` git repo — it was untracked despite being referenced by Hero; committing ensures the asset is available in all deployments without a CDN dependency
- Plausible script placed after `{children}` inside `<body>` — per Next.js best practice, ensures page content renders first
- No `<noscript>` fallback added — per CONTEXT.md guidance, Plausible works correctly without it

## Deviations from Plan

None — plan executed exactly as written. The only addition was committing `public/screen.jpg` to git since it was untracked and required for the Hero change to resolve correctly in production.

## Issues Encountered

None. Build output shows pre-existing Upstash Redis env var warnings during static generation — these are non-blocking and unrelated to this plan's changes (the rate limiter falls back gracefully when env vars are absent).

## Known Stubs

None — both changes are wired to real data (real screenshot asset, real analytics domain).

## User Setup Required

None — Plausible tracking activates automatically once the site is deployed to `ziko-app.com`. No Plausible dashboard configuration required for the script to load correctly.

## Next Phase Readiness

- Hero now shows real app screenshot — launch-ready visual
- Plausible analytics will track visits from day one post-deploy
- All routes remain statically generated — Vercel deploy will be fast and cheap
- Ready for plan 02 (deploy verification / launch gate)

---
*Phase: 05-launch*
*Completed: 2026-03-27*
