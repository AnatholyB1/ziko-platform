---
phase: 39
plan: "039-01"
subsystem: coach-web-dashboard
tags: [hyrox, dashboard, recharts, tanstack-query]
dependency_graph:
  requires: [038-04]
  provides: [HyroxDashboard, fetchHyroxData]
  affects: [apps/web/src/components/coach/dashboard]
tech_stack:
  added: []
  patterns: [ChartCard, createClientSupabase, SHARED_AXIS_PROPS, stagger-animation]
key_files:
  created:
    - apps/web/src/lib/dashboard/hyrox.ts
    - apps/web/src/components/coach/dashboard/HyroxDashboard.tsx
  modified: []
decisions:
  - Used UTC date math for ISO-week Monday anchor (consistent with powerlifting.ts pattern)
  - Station splits derived from most recent session duration using canonical Hyrox weights array
metrics:
  duration: "~8 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_created: 2
---

# Phase 39 Plan 01: Hyrox Dashboard Summary

## One-liner

HyroxDashboard with station splits BarChart (full-width), finish time LineChart, and weekly volume dual-bar BarChart — fetching from `cardio_sessions` filtered by `activity_type IN ('hyrox', 'functional')`.

## What was built

### Task 1 — `apps/web/src/lib/dashboard/hyrox.ts`

Data utility following the exact `powerlifting.ts` pattern:

- Types: `HyroxStationPoint`, `HyroxFinishPoint`, `HyroxVolumePoint`, `HyroxData`
- `fetchHyroxData(supabase, clientId, dateRange)` — queries `cardio_sessions` with `.in('activity_type', ['hyrox', 'functional'])`, filtered by `user_id` and date cutoff
- `stationSplits`: 8 canonical Hyrox stations (SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, RowErg, Farmers Carry, Sandbag Lunges, Wall Balls) with time_seconds derived from most recent session's duration and canonical weight proportions `[0.12, 0.15, 0.13, 0.10, 0.12, 0.10, 0.16, 0.12]`
- `finishTimes`: each session as `{ date, finish_time_seconds: duration_min * 60 }`
- `weeklyVolume`: ISO-week grouped (Monday anchor, UTC) with sessions count and distance_km sum

### Task 2 — `apps/web/src/components/coach/dashboard/HyroxDashboard.tsx`

React component following PowerliftingDashboard.tsx template exactly:

- `useQuery` with key `['hyrox', clientId, sport, dateRange]`, `enabled: sport === 'hyrox'`
- `supabase = createClientSupabase()` declared outside component
- `SHARED_AXIS_PROPS`, `TOOLTIP_STYLE`, `CHART_MARGIN` constants copied from PowerliftingDashboard
- 3 ChartCards in `grid grid-cols-2 gap-4`:
  - Card 1 "Temps par Station" — `col-span-2`, `BarChart`, `fill="#3B82F6"`, `radius=[4,4,0,0]`
  - Card 2 "Temps Final Hyrox" — `LineChart`, `stroke="#3B82F6"`, `strokeWidth={2}`, `dot={{ r: 3, fill: '#3B82F6' }}`, `connectNulls`
  - Card 3 "Volume Hebdomadaire" — `BarChart`, two bars: sessions `fill="#3B82F6"` + distance_km `fill="#A855F7"`, with `<Legend />`
- Stagger animation: `opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]` + `animationDelay: i * 50ms`
- Loading/error/empty state pattern identical to PowerliftingDashboard

## Commits

| Hash | Message |
|------|---------|
| 0d05c82 | feat(039-01): HyroxDashboard — 3 charts, station splits, finish time, weekly volume |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `/c/ziko-platform/apps/web/src/lib/dashboard/hyrox.ts` — EXISTS
- `/c/ziko-platform/apps/web/src/components/coach/dashboard/HyroxDashboard.tsx` — EXISTS
- Commit `0d05c82` — EXISTS
- TypeScript: no errors in new files (pre-existing error in bodybuilding.ts unrelated to this plan)
