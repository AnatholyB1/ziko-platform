---
plan: 039-03
phase: 39
title: Bodybuilding Dashboard — data utility + component
status: complete
commit: 2c19654
subsystem: coach-dashboard
tags: [bodybuilding, dashboard, recharts, supabase]
dependency_graph:
  requires: [039-02]
  provides: [BodybuildingDashboard, fetchBodybuildingData]
  affects: [apps/web/src/components/coach/dashboard/]
tech_stack:
  added: []
  patterns: [useQuery, Promise.all parallel fetch, recharts BarChart/LineChart/AreaChart]
key_files:
  created:
    - apps/web/src/lib/dashboard/bodybuilding.ts
    - apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx
  modified: []
decisions:
  - Used `as unknown as Array<...>` cast for Supabase joined relations (same pattern as powerlifting.ts) to avoid TS2352 overlap error
metrics:
  duration: ~10min
  completed: 2026-05-27
  tasks_completed: 2
  files_created: 2
---

# Phase 39 Plan 03: Bodybuilding Dashboard Summary

## One-liner

Bodybuilding dashboard with horizontal BarChart (muscle volume, col-span-2), multi-line overload LineChart (top 3 exercises), and bodyweight AreaChart — data from `session_sets` + `body_measurements`.

## What Was Built

### Task 1 — `apps/web/src/lib/dashboard/bodybuilding.ts`
- Exports types: `MuscleVolumePoint`, `OverloadPoint`, `BodyweightPoint`, `BodybuildingData`
- Exports `inferMuscleGroup(exerciseName)` — maps English/French exercise names to French muscle group labels (Jambes, Pectoraux, Dos, Épaules, Biceps, Triceps, Abdos, Autre)
- Exports `fetchBodybuildingData(supabase, clientId, dateRange)` — parallel `Promise.all` fetches:
  1. `session_sets` joined with `workout_sessions!inner` + `exercises!inner` — filtered by `user_id` and date cutoff
  2. `body_measurements` — filtered by `user_id`, date cutoff, `weight_kg not null`
- Returns `BodybuildingData` with:
  - `muscleVolume`: aggregated sets + `volume_kg = weight_kg * reps` per muscle group, sorted by volume desc
  - `progressiveOverload`: max weight per date for top 3 exercises by total volume
  - `topExercises`: the 3 exercise names used as line chart keys
  - `bodyweight`: `{ date, weight_kg }` from body_measurements

### Task 2 — `apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx`
- `useQuery` with key `['bodybuilding', clientId, sport, dateRange]`, `enabled: sport === 'bodybuilding'`
- `DashboardLoadingState` and `DashboardEmptyState` for edge cases + inline error div for fetch errors
- 3-card grid (`grid grid-cols-2 gap-4`):
  - Card 1 (col-span-2): horizontal `BarChart layout="vertical"` — two bars (Séries #FF5C1A, Volume #3B82F6), Legend
  - Card 2: `LineChart` — one `Line` per top exercise with `CLIENT_COLORS`, `connectNulls`, Legend
  - Card 3: `AreaChart` — bodyweight trend, `stroke="#F59E0B"`, `fillOpacity=0.08`
- Stagger animation: `opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]` with `animationDelay` per card

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2352 type overlap for Supabase joined relations**
- **Found during:** TypeScript check after Task 1
- **Issue:** Supabase infers joined relations as arrays (`{ started_at: any }[]`) but the code typed them as single objects — direct cast was rejected as overlapping types
- **Fix:** Used `as unknown as Array<...>` double cast (same pattern used in `powerlifting.ts` with `data as unknown as RawRow[]`)
- **Files modified:** `apps/web/src/lib/dashboard/bodybuilding.ts` (line 131)
- **Commit:** 2c19654 (files were committed by prior 039-04 execution that ran first)

## Notes

The two files were found to already be committed in commit `2c19654` (039-04 WeightLossDashboard) — a prior executor created both bodybuilding and weightloss files together. The content matched the plan specification exactly and TypeScript check passes with zero errors.

## Self-Check: PASSED

- `apps/web/src/lib/dashboard/bodybuilding.ts` exists — FOUND
- `apps/web/src/components/coach/dashboard/BodybuildingDashboard.tsx` exists — FOUND
- Commit 2c19654 contains both files — VERIFIED
- TypeScript check: no new errors — VERIFIED
