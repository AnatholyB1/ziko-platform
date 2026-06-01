---
phase: 39
plan: "039-02"
title: Running/Cardio Dashboard — data utility + component
status: complete
completed: "2026-05-27"
duration_min: 15
tasks_completed: 2
tasks_total: 2
files_created:
  - apps/web/src/lib/dashboard/running.ts
  - apps/web/src/components/coach/dashboard/RunningDashboard.tsx
commits:
  - eb4357e: "feat(039-02): RunningDashboard — 4 charts, pace, distance, VO2max, sessions"
key-decisions:
  - Pre-existing TS errors in bodybuilding.ts and weightloss.ts are out of scope; new files type-check clean
---

# Phase 39 Plan 02: Running/Cardio Dashboard Summary

## One-liner

Running/Cardio dashboard with pace trend, weekly distance, VO2max estimate, and per-session distance charts fetched from `cardio_sessions`.

## What was built

### Task 1 — `apps/web/src/lib/dashboard/running.ts`

Data utility following the exact same structure as `powerlifting.ts`:

- Types: `RunningPacePoint`, `RunningDistanceWeekPoint`, `RunningVO2MaxPoint`, `RunningSessionPoint`, `RunningData`
- `fetchRunningData(supabase, clientId, dateRange)` — queries `cardio_sessions` filtered by `user_id`, `activity_type IN ('running', 'cycling', 'cardio')`, and date cutoff
- Pace computed from `pace` column or derived as `duration_min / distance_km` when column is null
- Weekly distance grouped by ISO-week Monday key
- VO2max estimated via simplified Jack Daniels: `speedMPerMin * 0.2` where `speedMPerMin = (60 / paceMinPerKm * 1000) / 60`
- Session distances filtered to rows where `distance_km > 0`

### Task 2 — `apps/web/src/components/coach/dashboard/RunningDashboard.tsx`

Component following `PowerliftingDashboard.tsx` exactly:

- `useQuery` with key `['running', clientId, sport, dateRange]`, `enabled: sport === 'running'`
- `const supabase = createClientSupabase()` outside component
- `SHARED_AXIS_PROPS`, `TOOLTIP_STYLE`, `CHART_MARGIN` constants
- Loading / error / empty state pattern
- `CHART_CARDS` array with 4 entries:
  1. "Allure (min/km)" — `LineChart`, stroke `#3B82F6`, `dataKey="pace_min_per_km"`
  2. "Distance Hebdomadaire (km)" — `AreaChart`, stroke/fill `#22C55E`, `fillOpacity={0.08}`, `dataKey="distance_km"`
  3. "VO2max Estime" — `LineChart`, stroke `#A855F7`, `dot={{ r: 3, fill: '#A855F7' }}`, `dataKey="vo2max"`
  4. "Distance par Seance" — `BarChart`, fill `#3B82F6`, `radius={[4,4,0,0]}`, `dataKey="distance_km"`
- 2x2 grid `grid grid-cols-2 gap-4`
- Stagger animation: `opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]` + `animationDelay: i * 50ms`

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Check

`npx tsc --noEmit -p apps/web/tsconfig.json` reports 2 pre-existing errors in `bodybuilding.ts` and `weightloss.ts` (out of scope). The two new files introduced no type errors.

## Self-Check

- [x] `apps/web/src/lib/dashboard/running.ts` exists
- [x] `apps/web/src/components/coach/dashboard/RunningDashboard.tsx` exists
- [x] Commit `eb4357e` exists
- [x] No new TypeScript errors introduced

## Self-Check: PASSED
