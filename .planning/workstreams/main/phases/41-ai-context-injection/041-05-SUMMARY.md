---
phase: 41-ai-context-injection
plan: "05"
subsystem: apps/web/coach-dashboard
tags:
  - integration
  - ai-features
  - dashboard-wiring
dependency_graph:
  requires:
    - 041-01 (InsightsResponse types + backend endpoints)
    - 041-02 (POST /api/coach/dashboards/:clientId/insights + thresholds)
    - 041-03 (useInsights hook, NarrativeSummaryCard, DashboardChatDrawer)
    - 041-04 (AlertesModal, ChartCard badge)
  provides:
    - DashboardControlBar with Alertes + Demander à l'IA buttons
    - All 5 sport dashboards with onDataReady + chartInsights threading
    - Dashboard page fully wired with all AI features
  affects:
    - apps/web/src/components/coach/dashboard/DashboardControlBar.tsx
    - apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx
    - apps/web/src/components/coach/dashboard/HyroxDashboard.tsx
    - apps/web/src/components/coach/dashboard/RunningDashboard.tsx
    - apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx
    - apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx
tech_stack:
  added: []
  patterns:
    - optional callback prop pattern (onDataReady, onOpenChat, onOpenAlerts)
    - useEffect with [data, onDataReady] dep array for side-effect callback
    - chartKey slug on CHART_CARDS array entries for insights routing
    - inline chartInsights prop on JSX ChartCards for Bodybuilding/WeightLoss
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/dashboard/DashboardControlBar.tsx
    - apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx
    - apps/web/src/components/coach/dashboard/HyroxDashboard.tsx
    - apps/web/src/components/coach/dashboard/RunningDashboard.tsx
    - apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx
    - apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx
decisions:
  - "chartKey slugs added as CHART_CARDS array field (not separate map) for co-location with chart definitions"
  - "Bodybuilding muscleVolume sets summed as proxy for weeklySetCount (no weekly grouping available in data shape)"
  - "WeightLoss data shape has avgDailyCalories scalar directly on data — used as-is without last-element access"
  - "handleDataReady defined as named function (not useCallback) — consistent with existing page function style"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 7
---

# Phase 41 Plan 05: Integration — Wire All AI Features Summary

**One-liner:** DashboardControlBar extended with Alertes + Demander à l'IA buttons; all 5 sport dashboards extended with onDataReady and chartInsights threading; dashboard page fully wired with useInsights, NarrativeSummaryCard, DashboardChatDrawer, and AlertesModal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend DashboardControlBar with Alertes + Demander à l'IA buttons | b456f82 | DashboardControlBar.tsx |
| 2 | Extend all 5 sport dashboards with onDataReady + chartInsights | aa20c6b | PowerliftingDashboard.tsx, HyroxDashboard.tsx, RunningDashboard.tsx, BodybuildingDashboard.tsx, WeightLossDashboard.tsx |
| 3 | Wire all AI features into dashboard page | 0711192 | dashboard/page.tsx |
| 4 | Human verify checkpoint | — | (awaiting human) |

## What Was Built

### DashboardControlBar (Task 1)

Two new optional props: `onOpenChat?: () => void` and `onOpenAlerts?: () => void`. New icons: `Bell` and `MessageCircle` from lucide-react. Button order in right section: `Comparer | date segmented | Alertes (ghost) | Demander à l'IA (primary #FF5C1A) | Export PDF`. Both buttons are conditional on their callback being defined — zero breaking change to existing usages.

### Sport Dashboards (Task 2)

All five dashboards follow the same four-change pattern:
- `onDataReady?: (summary: Record<string, unknown>) => void` — optional prop
- `chartInsights?: Record<string, string>` — optional prop
- `useEffect([data, onDataReady])` — calls `onDataReady(summary)` with sport-specific scalar metrics when data loads
- `chartInsights?.[chartKey]` passed as `aiInsight` to each ChartCard

Chart key slugs per sport:
- Powerlifting: `squat_1rm`, `rpe_avg`, `tonnage_hebdo`, `intensite_1rm`
- Hyrox: `temps_station`, `temps_total`, `volume_hebdo`
- Running: `allure_avg`, `volume_hebdo`, `vo2max`, `distance`
- Bodybuilding: `volume_total`, `series_hebdo`, `poids_corps` (inline ChartCards)
- WeightLoss: `poids_actuel`, `calories_avg`, `series_total` (inline ChartCards)

### Dashboard Page (Task 3)

- 4 new imports: `useInsights`, `NarrativeSummaryCard`, `DashboardChatDrawer`, `AlertesModal`
- 4 new state/ref declarations: `isChatOpen`, `isAlertesOpen`, `chartSummary`, `dashboardContextRef`
- `useInsights(clientId, sport, dateRange, chartSummary)` — auto-fires when `!!sport && !!chartSummary`
- `handleDataReady` callback — updates `chartSummary` state and writes to `dashboardContextRef.current`
- `DashboardControlBar` receives `onOpenChat` and `onOpenAlerts` callbacks
- `NarrativeSummaryCard` rendered above chart grid with `narrative`, `sport`, `isLoading` props
- All 5 sport dashboards receive `onDataReady={handleDataReady}` and `chartInsights={insights?.chartInsights}`
- `DashboardChatDrawer` mounted at page root (always present, controlled by `isChatOpen`)
- `AlertesModal` mounted conditionally when `isAlertesOpen` with `crossedThresholds` from insights

## Deviations from Plan

### Auto-adapted: Bodybuilding weekly set count

**Found during:** Task 2 — reading BodybuildingDashboard data shape  
**Issue:** The plan spec calls for `weeklySetCount` in the summary, but `data.muscleVolume` contains per-muscle sets without weekly grouping. No `weeklySetCount` scalar is available.  
**Fix:** Used `data.muscleVolume.reduce((acc, m) => acc + m.sets, 0)` as the total sets across all muscle groups for the period — functionally equivalent to weekly set volume.  
**Files modified:** BodybuildingDashboard.tsx

### Auto-adapted: WeightLoss avgDailyCalories

**Found during:** Task 2 — reading WeightLossDashboard data shape  
**Issue:** `data.avgDailyCalories` is a top-level scalar on the data object (not inside `calorieCompliance` array). The plan spec treats it as a derived value from the array.  
**Fix:** Used `data.avgDailyCalories` directly with a `> 0` guard — matches the existing ReferenceLine usage in the component.  
**Files modified:** WeightLossDashboard.tsx

## Known Stubs

None — all props flow through real data. `NarrativeSummaryCard` shows fallback text only when `insights` is `undefined` (before first load), which is expected behavior.

## Threat Flags

None — no new trust boundaries introduced. All data flows are coach-owned (dashboardContextRef, chartSummary from own client's Supabase query, chartInsights read-only display strings from Claude).

## Self-Check

- [x] DashboardControlBar.tsx — FOUND, contains `onOpenChat`, `onOpenAlerts`, `MessageCircle`, `Bell`, `Demander à l'IA`, `Alertes`, `bg-[#FF5C1A]`
- [x] PowerliftingDashboard.tsx — FOUND, contains `onDataReady`, `chartInsights`, `useEffect`, `onDataReady(summary)`
- [x] HyroxDashboard.tsx — FOUND, same pattern
- [x] RunningDashboard.tsx — FOUND, same pattern
- [x] BodybuildingDashboard.tsx — FOUND, same pattern (inline ChartCards)
- [x] WeightLossDashboard.tsx — FOUND, same pattern (inline ChartCards)
- [x] dashboard/page.tsx — FOUND, contains `useInsights`, `NarrativeSummaryCard`, `DashboardChatDrawer`, `AlertesModal`, `isChatOpen`, `isAlertesOpen`, `dashboardContextRef`, `handleDataReady`, `onDataReady={handleDataReady}` × 5, `chartInsights={insights?.chartInsights}` × 5
- [x] Commits b456f82, aa20c6b, 0711192 present in git log
- [x] TypeScript: 0 new errors (only pre-existing VocalReview.test.tsx TS2305)

## Self-Check: PASSED
