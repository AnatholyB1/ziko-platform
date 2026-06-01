---
phase: 40-advanced-dashboard-features
plan: "040-03"
subsystem: coach-dashboard
tags: [compare-mode, dual-series, charts, recharts]
dependency_graph:
  requires: ["040-02"]
  provides: ["compare-chart-rendering"]
  affects: ["coach-dashboard-ui"]
tech_stack:
  added: []
  patterns: ["dual-series recharts", "conditional useQuery with enabled param", "mergeForCompare helper"]
key_files:
  created:
    - apps/web/src/components/coach/dashboard/widgets/DeltaChip.tsx
    - apps/web/src/components/coach/dashboard/widgets/LegendDot.tsx
    - apps/web/src/components/coach/dashboard/CompareExcludeNote.tsx
  modified:
    - apps/web/src/hooks/useWidgetData.ts
    - apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx
    - apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx
    - apps/web/src/components/coach/dashboard/WidgetRenderer.tsx
    - apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx
    - apps/web/src/components/coach/dashboard/HyroxDashboard.tsx
    - apps/web/src/components/coach/dashboard/RunningDashboard.tsx
    - apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx
    - apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx
decisions:
  - "Used enabled? param on useWidgetData rather than a separate hook to keep dual-series logic local to each widget"
  - "Sport dashboards use mergeForCompare helper mapping sport-specific data keys to {date, value} tuples before merging"
  - "BodybuildingDashboard progressiveOverload chart kept single-series in compare mode (dynamic exercise name keys are incompatible with simple merge)"
metrics:
  duration: "~30 min"
  completed: "2026-05-28"
  tasks_completed: 3
  files_created: 3
  files_modified: 10
---

# Phase 40 Plan 03: Dual-series chart widgets for compare mode — Summary

## What was built

Three shared UI components (DeltaChip, LegendDot, CompareExcludeNote) plus dual-series rendering in all three generic widget types (LineChartWidget, BarChartWidget, KpiTileWidget) and all five sport dashboards. When compareMode is active and a compareClientId or comparePeriod is provided, each chart makes a second conditional data fetch and renders two series: Subject A in orange (#FF5C1A, solid) and Subject B in blue (#3B82F6, dashed for lines, grouped for bars). KPI tiles display valueA / valueB with a color-coded DeltaChip. Widget types that cannot render dual series (callout, athlete_list, threshold_indicator) show CompareExcludeNote instead.

## Files created

- `apps/web/src/components/coach/dashboard/widgets/DeltaChip.tsx` — green/red/grey chip based on delta sign
- `apps/web/src/components/coach/dashboard/widgets/LegendDot.tsx` — colored dot + label for chart legends
- `apps/web/src/components/coach/dashboard/CompareExcludeNote.tsx` — exclusion placeholder for incompatible widget types

## Files modified

- `apps/web/src/hooks/useWidgetData.ts` — added `enabled?` optional param for conditional second-series fetching
- `apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx` — dual-series with Loader2 overlay
- `apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx` — grouped dual bars with Loader2 overlay
- `apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx` — valueA / valueB layout with DeltaChip + LegendDots
- `apps/web/src/components/coach/dashboard/WidgetRenderer.tsx` — compare props passthrough + CompareExcludeNote for excluded types
- `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` — second useQuery + dual-series for RPE, Tonnage, Intensity charts
- `apps/web/src/components/coach/dashboard/HyroxDashboard.tsx` — second useQuery + dual-series for FinishTimes, WeeklyVolume charts
- `apps/web/src/components/coach/dashboard/RunningDashboard.tsx` — second useQuery + dual-series for Pace, Distance, VO2max, SessionDist charts
- `apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx` — second useQuery + dual-series for Bodyweight chart
- `apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx` — second useQuery + dual-series for BodyweightCurve, CalorieCompliance, LoadProgression charts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect import path in WidgetRenderer**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan specified `import CompareExcludeNote from '../CompareExcludeNote'` but WidgetRenderer is in `dashboard/` — CompareExcludeNote is also in `dashboard/` — correct path is `'./CompareExcludeNote'`
- **Fix:** Changed to `import { CompareExcludeNote } from './CompareExcludeNote'`
- **Files modified:** WidgetRenderer.tsx
- **Commit:** 32446e4

### Design Decisions

**BodybuildingDashboard — progressiveOverload chart not compare-enabled**
- **Reason:** The `progressiveOverload` data uses dynamic exercise names as recharts `dataKey` values (`data.topExercises[i]`). These keys differ per client and are incompatible with the simple `mergeForCompare` approach (which expects a single `value` numeric field). Merging two clients' top-exercise arrays would require a more complex join. The chart is left as single-series to preserve correctness. The `bodyweight` chart in the same dashboard does support dual-series.

## Verification

- [x] DeltaChip green/red/grey per delta sign
- [x] Compare mode: LineChartWidget renders two Lines (orange solid A, blue dashed B) + Legend
- [x] Compare mode: BarChartWidget renders grouped orange/blue bars + Legend
- [x] Compare mode: KpiTileWidget shows `{valueA} / {valueB}` + DeltaChip + LegendDots
- [x] callout/athlete_list/threshold_indicator show CompareExcludeNote in compare mode
- [x] Compare loading overlay (Loader2 spinner) on LineChart and BarChart while second dataset loads
- [x] useWidgetData accepts optional `enabled?` param — second call only fires when compareMode && compareClientId
- [x] All 5 sport dashboards: second useQuery with enabled guard + conditional dual-series rendering
- [x] TypeScript: 0 new errors across all 12 modified/created files

## Self-Check: PASSED

Files exist:
- apps/web/src/components/coach/dashboard/widgets/DeltaChip.tsx: FOUND
- apps/web/src/components/coach/dashboard/widgets/LegendDot.tsx: FOUND
- apps/web/src/components/coach/dashboard/CompareExcludeNote.tsx: FOUND

Commit 32446e4 exists: CONFIRMED
