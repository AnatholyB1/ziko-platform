---
plan: 039-04
phase: 39
subsystem: web/coach/dashboard
tags: [dashboard, charts, weightloss, recharts, tanstack-query]
dependency_graph:
  requires: [038-04]
  provides: [WeightLossDashboard, fetchWeightLossData]
  affects: [apps/web/src/components/coach/dashboard, apps/web/src/lib/dashboard]
tech_stack:
  added: []
  patterns: [parallel-fetch, recharts-area-bar-line, stagger-animation]
key_files:
  created:
    - apps/web/src/lib/dashboard/weightloss.ts
    - apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx
  modified: []
decisions:
  - Cast workout_sessions through unknown to handle Supabase returning joined rows as array
metrics:
  duration: ~15min
  completed: 2026-05-27
---

# Phase 39 Plan 04: Weight Loss Dashboard Summary

## One-liner

Weight Loss dashboard with bodyweight AreaChart, calorie compliance BarChart with average ReferenceLine, and load progression LineChart — using parallel Supabase fetches and stagger animation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create weightloss.ts data utility | 2c19654 | apps/web/src/lib/dashboard/weightloss.ts |
| 2 | Create WeightLossDashboard component | 2c19654 | apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx |

## What Was Built

### `apps/web/src/lib/dashboard/weightloss.ts`

Exports `fetchWeightLossData(supabase, clientId, dateRange)` which runs three parallel Supabase queries:
1. `body_measurements` — `measured_at, weight_kg` filtered by user_id and date cutoff
2. `nutrition_logs` — `date, calories` grouped by date, summed to daily totals
3. `session_sets` joined with `workout_sessions!inner` — summed as `weight_kg * reps` per session date

Returns `WeightLossData` with:
- `bodyweightCurve`: daily weight measurements
- `calorieCompliance`: daily calorie totals (grouped/summed from nutrition_logs)
- `loadProgression`: total load per workout session date
- `avgDailyCalories`: arithmetic mean of daily calories (used as chart reference line)

### `apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx`

3-card grid layout (`grid grid-cols-2 gap-4`):
- Card 1 — "Evolution du Poids" (`col-span-2`): `AreaChart` with orange stroke/fill, `fillOpacity=0.10`, dots at each point
- Card 2 — "Conformite Calorique": `BarChart` with orange bars, green dashed `ReferenceLine` at `avgDailyCalories` when > 0
- Card 3 — "Progression de Charge": `LineChart` with green stroke, no dots, `connectNulls`

Stagger animation identical to `PowerliftingDashboard` (delays: 0ms, 50ms, 100ms).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript cast for workout_sessions array type**
- **Found during:** TypeScript check after Task 1
- **Issue:** Supabase types `workout_sessions` from a `!inner` join as an array (`{ started_at: any }[]`), but the code was casting directly to `{ started_at: string }` (single object), causing TS2352 error
- **Fix:** Cast through `unknown` and handle both array and object forms: `Array.isArray(session) ? session[0]?.started_at : session?.started_at`
- **Files modified:** `apps/web/src/lib/dashboard/weightloss.ts`
- **Commit:** 2c19654

## Self-Check: PASSED

- [x] `apps/web/src/lib/dashboard/weightloss.ts` exists
- [x] `apps/web/src/components/coach/dashboard/WeightLossDashboard.tsx` exists
- [x] Commit 2c19654 exists
- [x] TypeScript: no errors (`TypeScript compilation completed`)
