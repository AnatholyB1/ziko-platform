---
phase: 02-widget-renderers
plan: 4
subsystem: custom-widget
tags: [widget, table, athlete-list, threshold, callout, react, next.js]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [TableWidget, AthleteListWidget, ThresholdIndicatorWidget, CalloutWidget]
  affects: [02-05-WidgetRenderer]
tech_stack:
  added: []
  patterns: [useWidgetData hook, WidgetCard wrapper, design-token inline styles]
key_files:
  created:
    - apps/web/src/components/coach/dashboard/widgets/TableWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/AthleteListWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx
  modified: []
decisions:
  - IIFE pattern used in ThresholdIndicatorWidget to derive pct/isAbove/barColor inline without extracting to a helper function
metrics:
  duration: ~8min
  completed: 2026-05-27
  tasks_completed: 3
  files_created: 4
---

# Phase 02 Plan 4: Widget Renderers (Table, AthleteList, Threshold, Callout) Summary

**One-liner:** Four remaining widget renderers — dynamic table, athlete list with fr-FR dates, threshold progress bar with green/orange color coding, and static severity callout.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | TableWidget | 3326129 | TableWidget.tsx |
| 2 | AthleteListWidget + ThresholdIndicatorWidget | 3326129 | AthleteListWidget.tsx, ThresholdIndicatorWidget.tsx |
| 3 | CalloutWidget | 3326129 | CalloutWidget.tsx |

## What Was Built

### TableWidget
- Calls `useWidgetData(clientId, 'table', widget.period, 'rows')`
- Renders scrollable table (`overflow-auto max-h-52`) with sticky thead
- Column headers from `widget.config.columns` — text-xs uppercase tracking-wide
- Empty state: "Aucune donnée disponible."
- Loading/error delegated to WidgetCard

### AthleteListWidget
- Calls `useWidgetData(clientId, 'athlete_list', widget.period, widget.config.filter)`
- Compact `<ul>` list, `space-y-2 overflow-auto max-h-52`
- Name left-aligned, last_activity_at right-aligned in fr-FR locale
- "Jamais" when last_activity_at is null
- Empty state: "Aucun athlète."

### ThresholdIndicatorWidget
- Calls `useWidgetData(clientId, 'threshold_indicator', widget.period, widget.config.dataKey)`
- Large value + threshold label at top
- Horizontal progress bar: `bg-[#E2E0DA]` track, colored fill div with `style` width
- `barColor`: `#22C55E` (green) when at/above threshold, `#FF5C1A` (orange) when below
- Percentage label below bar (right-aligned)
- Null state: "—"

### CalloutWidget
- No API call — purely static
- Severity color map: info=`#3B82F6`, warning=`#FF5C1A`, success=`#22C55E`
- Severity labels: Info / Attention / Succès
- Left border `4px solid {color}` via inline style
- Bold uppercase severity label + message text

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all widgets wire real data. CalloutWidget is intentionally static (no data source needed).

## Self-Check: PASSED

- TableWidget.tsx: exists, calls `useWidgetData`, renders dynamic columns
- AthleteListWidget.tsx: exists, calls `useWidgetData`, formats dates fr-FR
- ThresholdIndicatorWidget.tsx: exists, calls `useWidgetData`, colors `#22C55E`/`#FF5C1A`
- CalloutWidget.tsx: exists, zero `useWidgetData` calls, all 3 severity colors present
- TypeScript: `npx tsc --noEmit` from apps/web — 0 errors
