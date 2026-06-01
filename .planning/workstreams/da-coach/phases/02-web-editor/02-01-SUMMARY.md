---
phase: 02-web-editor
plan: 01
subsystem: coach-web
tags: [branding, routing, server-component, navigation]
dependency_graph:
  requires: []
  provides: [coach/branding route, CoachSidebar Direction artistique nav]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [Next.js Server Component with parallel Supabase queries, revalidate=0]
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/branding/loading.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - revalidate=0 on branding page (branding changes must be fresh on each visit — no caching)
  - BrandingClient import left intentionally broken until Plan 03 creates the file
  - parallel Promise.all for 3 queries (coach_branding + user_profiles.tier + coach_profiles.display_name)
metrics:
  duration: ~5 minutes
  completed: 2026-05-27
  tasks_completed: 2
  files_changed: 3
---

# Phase 02 Plan 01: Branding Route Server Component + CoachSidebar Nav Summary

**One-liner:** Next.js Server Component at `/coach/branding` with parallel Supabase queries deriving `isPro` server-side, plus `IoColorPaletteOutline` nav entry in CoachSidebar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create page.tsx Server Component | e1890bf | apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx |
| 2 | Create loading.tsx skeleton + CoachSidebar nav item | e1890bf | apps/web/src/app/[locale]/(coach)/coach/branding/loading.tsx, apps/web/src/components/coach/CoachSidebar.tsx |

## What Was Built

### page.tsx — Server Component
- `export const revalidate = 0` ensures fresh data on every visit
- Calls `getCachedCoachUser()` to get the authenticated coach's `user.id`
- Runs three Supabase queries in parallel via `Promise.all`: `coach_branding`, `user_profiles.tier`, `coach_profiles.display_name`
- Derives `isPro = tierData.data?.tier === 'premium'` entirely server-side (client cannot spoof)
- Passes `userId`, `isPro`, `initialBranding`, `displayName` as props to `<BrandingClient>`
- `BrandingClient` import produces a `TS2307` error until Plan 03 creates the file — expected and documented

### loading.tsx — Skeleton
- Matches the 2-column layout of the branding page
- Uses `animate-pulse` on all skeleton elements (h1 bar, 3 left-column section cards, 1 right-column preview card)

### CoachSidebar.tsx — Nav Item
- Added `IoColorPaletteOutline` to the `react-icons/io5` import block
- Inserted `{ label: 'Direction artistique', href: \`/\${locale}/coach/branding\`, icon: IoColorPaletteOutline, disabled: false }` between IA and Paramètres entries

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `BrandingClient` is imported but does not exist yet. The import will resolve when Plan 03 (`02-03`) creates `BrandingClient.tsx`. This is intentional per plan specification.

## Threat Surface Scan

No new security surface introduced beyond what the plan's threat model covers:
- `T-02-01`: RLS on `coach_branding` scopes rows to the authenticated coach's own data
- `T-02-02`: `isPro` boolean derived server-side only — client receives read-only prop

## Self-Check: PASSED

- `apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx` — exists
- `apps/web/src/app/[locale]/(coach)/coach/branding/loading.tsx` — exists
- `apps/web/src/components/coach/CoachSidebar.tsx` — modified with IoColorPaletteOutline and Direction artistique entry
- Commit `e1890bf` — verified in git log
