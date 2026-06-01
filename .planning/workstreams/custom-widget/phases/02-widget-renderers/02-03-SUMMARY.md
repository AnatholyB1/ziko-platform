---
phase: 02-widget-renderers
plan: 3
subsystem: apps/web
tags: [recharts, widgets, dashboard, kpi, line-chart, bar-chart]
dependency_graph:
  requires:
    - 02-01 (WidgetCard, dashboard types)
    - 02-02 (useWidgetData hook)
  provides:
    - LineChartWidget renderer
    - BarChartWidget renderer
    - KpiTileWidget renderer
  affects:
    - Dashboard grid (consumes these renderers)
tech_stack:
  added: []
  patterns:
    - Recharts ResponsiveContainer wrapping chart components
    - useWidgetData hook for data fetching
    - WidgetCard chrome with loading/error states
key_files:
  created:
    - apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx
  modified: []
decisions:
  - Used `(data as { data: Array<...> } | null)?.data ?? []` cast pattern to safely extract chart arrays from unknown query result
  - KpiTileWidget em-dash (\u2014) for null/missing data instead of empty string
  - formatDuration is a module-local helper (not exported) per plan spec
metrics:
  duration: ~5min
  completed: 2026-05-27
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 3: Widget Renderers (Line, Bar, KPI) Summary

Three Recharts-powered chart widget renderers that wire `useWidgetData` to visual output inside the `WidgetCard` chrome — completing the DEFAULT_WIDGETS coverage (line chart, bar chart, 2x KPI tiles).

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | LineChartWidget | 70cb542 | `widgets/LineChartWidget.tsx` |
| 2 | BarChartWidget | 70cb542 | `widgets/BarChartWidget.tsx` |
| 3 | KpiTileWidget | 70cb542 | `widgets/KpiTileWidget.tsx` |

## What Was Built

**LineChartWidget** — `'use client'` component wrapping a Recharts `LineChart` in `ResponsiveContainer` (height 220). Calls `useWidgetData(clientId, 'line_chart', widget.period, widget.config.dataKey)`. Renders inside `WidgetCard` with loading skeleton and error display delegated to the card. YAxis tickFormatter appends `widget.config.unit` when present. Empty-data state shows "Aucune donnée disponible." Line stroke defaults to primary `#FF5C1A`, overridable via `widget.config.color`.

**BarChartWidget** — Same pattern as LineChartWidget but with `BarChart` + `Bar`. Bars have `radius={[3, 3, 0, 0]}` for rounded top corners matching the coach CRM design style. Fill color defaults to `#FF5C1A`.

**KpiTileWidget** — Single large metric display. Casts query result as `{ value: number }`. Formats based on `widget.config.format`: `number` rounds to integer, `percent` appends `%`, `duration` calls `formatDuration()` which returns `Xh Ym` for >= 60 min or `Xmin` below. Null raw value renders an em-dash. Optional `widget.config.unit` rendered below the value in muted text.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all widgets fetch real data via `useWidgetData` from the backend API.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

Files exist:
- FOUND: apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx
- FOUND: apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx
- FOUND: apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx

Commits:
- FOUND: 70cb542 feat(02-03): LineChartWidget, BarChartWidget, KpiTileWidget renderers

TypeScript: PASSED (tsc --noEmit exits 0)
