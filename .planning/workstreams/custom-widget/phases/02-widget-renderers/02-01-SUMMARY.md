---
phase: 02-widget-renderers
plan: 1
subsystem: apps/web
tags: [react-grid-layout, typescript, components, dashboard]
dependency_graph:
  requires: []
  provides: [Widget types, WidgetCard component, DashboardLoadingState]
  affects: [apps/web/src/types/dashboard.ts, apps/web/src/components/coach/dashboard/]
tech_stack:
  added: [react-grid-layout@2.2.1, @types/react-grid-layout]
  patterns: [Server Component for loading state, client component for WidgetCard]
key_files:
  created:
    - apps/web/src/types/dashboard.ts
    - apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx
  modified:
    - apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx
    - apps/web/package.json
decisions:
  - DashboardLoadingState converted from inline skeleton to WidgetCard-based (unblocks loading.tsx import)
  - Widget types copied locally to avoid cross-workspace coupling with backend
metrics:
  completed: "2026-05-27"
---

# Phase 02 Plan 1: Install react-grid-layout, Widget types, WidgetCard, DashboardLoadingState Summary

react-grid-layout@2.2.1 installed, frontend-local Widget discriminated union types created, WidgetCard chrome wrapper with loading/error states, and DashboardLoadingState rebuilt using 4 WidgetCard skeletons.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install react-grid-layout | fc01eac | apps/web/package.json |
| 2 | Create frontend Widget types | fc01eac | apps/web/src/types/dashboard.ts |
| 3 | WidgetCard + DashboardLoadingState | fc01eac | WidgetCard.tsx, DashboardLoadingState.tsx |

## What Was Built

**react-grid-layout@2.2.1** installed in `apps/web/` with TypeScript types (`@types/react-grid-layout`).

**`apps/web/src/types/dashboard.ts`** — frontend-local copy of the backend Widget type definitions. Exports: `WidgetType`, `WidgetPeriod`, `GridPos`, `WidgetBase`, all 7 config interfaces, all 7 widget interfaces, `Widget` discriminated union, and `DashboardConfig`. No imports — pure type definitions.

**`apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx`** — `'use client'` component wrapping widget content in a titled card chrome. Accepts `title`, `period` (badge), `isLoading` (SkeletonBlock), `error` (muted message), and `children`.

**`apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx`** — Server Component (no `'use client'`) rendering 4 `WidgetCard` shells with `isLoading={true}` in a `grid-cols-2` layout. Fixes the dead import in `dashboard/loading.tsx`.

## Deviations from Plan

**[Rule 1 - Bug] DashboardLoadingState already existed**
- **Found during:** Task 3
- **Issue:** File existed with an inline animate-pulse skeleton implementation, not the WidgetCard-based version the plan required.
- **Fix:** Replaced existing content with WidgetCard-based 4-skeleton grid as specified.
- **Files modified:** `apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx`
- **Commit:** fc01eac

**Files bundled in prior agent commit:** The task files were committed as part of commit `fc01eac` (docs(02-02) summary commit by a concurrent plan executor). All deliverables are verified present and correct.

## Self-Check: PASSED

- `apps/web/src/types/dashboard.ts` — EXISTS (committed in fc01eac)
- `apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx` — EXISTS
- `apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx` — EXISTS (updated)
- `apps/web/package.json` contains `react-grid-layout@^2.2.1` — CONFIRMED
- TypeScript `--noEmit` passes with 0 errors — CONFIRMED
