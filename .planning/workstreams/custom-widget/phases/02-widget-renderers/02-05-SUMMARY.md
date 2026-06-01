---
phase: 02-widget-renderers
plan: 5
subsystem: web-frontend
tags: [dashboard, react-grid-layout, widget-renderer, drag-drop]
dependency_graph:
  requires: [02-01, 02-02, 02-03, 02-04]
  provides: [WidgetRenderer, DashboardGrid, dashboard-page]
  affects: [apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/]
tech_stack:
  added: []
  patterns: [discriminated-union-dispatch, react-grid-layout-v2-api, auto-save-on-layout-change]
key_files:
  created:
    - apps/web/src/components/coach/dashboard/WidgetRenderer.tsx
    - apps/web/src/components/coach/dashboard/DashboardGrid.tsx
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx
decisions:
  - "Used react-grid-layout v2 config API (gridConfig/dragConfig/resizeConfig) instead of legacy flat props (cols, rowHeight, isDraggable, isResizable, margin) — plan specified v2.2.1 but described v1-style props; v2 API was adapted automatically"
  - "Layout type in v2 is readonly LayoutItem[] — handleLayoutChange uses Layout type from react-grid-layout import"
metrics:
  duration: "12 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  files_modified: 3
---

# Phase 02 Plan 5: WidgetRenderer Dispatch + DashboardGrid + Dashboard Page Summary

WidgetRenderer switch-dispatch to all 7 widget components, DashboardGrid with react-grid-layout v2 drag/resize and auto-save PUT, and full replacement of the placeholder dashboard/page.tsx with the live wired dashboard.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | WidgetRenderer dispatch component | e502585 | WidgetRenderer.tsx (created) |
| 2 | DashboardGrid with react-grid-layout | e502585 | DashboardGrid.tsx (created) |
| 3 | Replace dashboard/page.tsx | e502585 | dashboard/page.tsx (replaced) |

## What Was Built

**WidgetRenderer.tsx** — Type-safe switch-dispatch from `Widget.type` to all 7 widget components. Uses TypeScript discriminated union narrowing — each case narrows the widget type so no casting is needed. Exhaustive default case (`never` check) ensures TypeScript flags any unhandled types added in the future.

**DashboardGrid.tsx** — Wraps react-grid-layout v2's `GridLayout` component. Maps widget `gridPos` to layout items. In edit mode (`isEditMode=true`), drag and resize are enabled via `dragConfig.enabled` / `resizeConfig.enabled`. On layout change, merges new positions into local widget state then fires `PUT /coach/dashboards/:clientId` with JWT (via createBrowserClient). Auto-saves on every drag-end/resize-end — no explicit Save button needed.

**dashboard/page.tsx** — Fully replaces the sport-selector placeholder. Uses `use(params)` (Next.js 15 client component pattern) to extract `clientId`. Calls `useDashboardConfig(clientId)` for widget data. Shows `DashboardLoadingState` while loading, error message on failure, and the full `DashboardGrid` on success. Top bar shows widget count and Éditer/Terminer toggle button (primary bg in edit mode, white border in view mode).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-grid-layout v2 API vs plan-specified v1-style props**
- **Found during:** Task 2
- **Issue:** The plan specified react-grid-layout v2.2.1 but described the v1 flat-props API (`cols`, `rowHeight`, `isDraggable`, `isResizable`, `margin`, `containerPadding` as direct GridLayout props). In v2, these are nested under `gridConfig`, `dragConfig`, `resizeConfig`. The `Layout` type is `readonly LayoutItem[]`. `onLayoutChange` signature is `(layout: Layout) => void`.
- **Fix:** Adapted DashboardGrid to use the v2 API: `gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16], containerPadding: [0, 0] }}`, `dragConfig={{ enabled: isEditMode }}`, `resizeConfig={{ enabled: isEditMode }}`. Imported `Layout` and `LayoutItem` from `react-grid-layout` for the handler type.
- **Files modified:** apps/web/src/components/coach/dashboard/DashboardGrid.tsx
- **Commit:** e502585

## Known Stubs

None — all components are fully wired. Widget data fetching is handled by `useWidgetData` inside each widget component (from Plans 3–4). Dashboard config is fetched by `useDashboardConfig` (from Plan 2).

## Self-Check: PASSED

- [x] WidgetRenderer.tsx exists at `apps/web/src/components/coach/dashboard/WidgetRenderer.tsx`
- [x] DashboardGrid.tsx exists at `apps/web/src/components/coach/dashboard/DashboardGrid.tsx`
- [x] dashboard/page.tsx replaced (no DashboardControlBar/DashboardEmptyState/PowerliftingDashboard imports)
- [x] commit e502585 exists
- [x] `npx tsc --noEmit` passes with 0 errors
- [x] `grep -r "DashboardControlBar|DashboardEmptyState|PowerliftingDashboard" apps/web/src/app` returns no results
- [x] PUT wired in DashboardGrid.tsx
- [x] GridLayout + react-grid-layout imports present in DashboardGrid.tsx
