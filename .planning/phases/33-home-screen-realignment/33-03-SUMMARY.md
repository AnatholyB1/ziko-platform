---
phase: 33
plan: 03
subsystem: mobile/home-screen
tags: [tanstack-query, home-screen, mission-card, week-strip, recent-sessions]
dependency_graph:
  requires: [33-01 (useHomeData hooks)]
  provides: [MissionCard live data, HomeWeekStrip live data, Recent section live data]
  affects: [apps/mobile/app/(app)/index.tsx (plan 33-04 continues)]
tech_stack:
  added: []
  patterns: [TanStack Query v5 useQuery consumption, defensive JSONB parsing, Skeleton from @ziko/ui]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/index.tsx
decisions:
  - Renamed WeekStrip → HomeWeekStrip to clarify it is the local done/today/rest component (not @ziko/ui WeekStrip which is a date-picker)
  - MissionCardContent extracted as a local function receiving isLoading + activeProgram to keep DashboardScreen readable
  - Defensive JSONB access via program_data?.sessions ?? program_data?.workouts ?? [] per T-33-03-02 accept disposition
  - weeklyCount derived from weeklySessions.length (TanStack Query) instead of recentSessions.filter(<7 days)
  - parseWorkoutFrequency used for weeklyGoal from homeProfile.workout_frequency
  - Kept workoutStore.recentSessions (recentSessionsStore) for streak computation only — streak migration is plan 33-04
metrics:
  duration: 15min
  completed: 2026-05-21
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 33 Plan 03: Home Screen Data Wiring Summary

**One-liner:** MissionCard, HomeWeekStrip, and Recent section wired to useActiveAIProgram, useWeeklySessions, and useRecentSessions with loading/empty/populated states and Skeleton shimmer during fetch.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire MissionCard with useActiveAIProgram + pixel-exact layout | 26cb3c8 | apps/mobile/app/(app)/index.tsx |
| 2 | Wire HomeWeekStrip and Recent section with real data | 26cb3c8 | apps/mobile/app/(app)/index.tsx |

## What Was Built

`apps/mobile/app/(app)/index.tsx` changes:

**MissionCard (now MissionCardContent function):**
- Loading state: dark card `#1C1A17` with 3 inline shimmer bars `rgba(255,250,246,0.12)`
- Empty state: dark card with barbell-outline 56×56 tile, "Aucun programme actif" heading, description, "Créer un programme IA" CTA routing to `/(app)/(plugins)/ai-programs/dashboard`
- Populated state: dark card with orange SVG circle decoration, Mission du jour label, session name (22px 800), sub line `{goal} · {N} exos · ~{duration} min`, up to 3 exercises with numbered badge + name + scheme, "+N autres exercices" overflow, "Allez, c'est parti !" CTA + chevron-down expand button
- Imports `useActiveAIProgram` from `../../src/hooks/useHomeData`

**HomeWeekStrip (renamed from WeekStrip):**
- Props unchanged: `weeklyCount`, `weeklyGoal`, `sessionDates: Set<string>`
- Inner header: "Semaine · {done}/{goal}" with orange fraction (#FF5C1A)
- Right hint: "+{N} pour atteindre l'objectif" in #6B6963
- Day states: done (bg #22C55E + checkmark-outline), today (bg #1C1A17), rest (transparent + border #E2E0DA)
- Day label opacity: 0.75 (was 0.7), using `checkmark-outline` icon (was `checkmark`)
- Now wired to `useWeeklySessions`: doneDates = Set of `started_at.split('T')[0]`, weeklyGoal from `parseWorkoutFrequency(homeProfile?.workout_frequency)`
- Loading state: card with Skeleton placeholder row for 7 dots

**Recent section:**
- Section header: 11px uppercase #6B6963 + "Tout voir" link (#FF5C1A) with router.push to workout/history
- Loading state: 3 skeleton rows (36×36 circle + 2 text bars each)
- Empty state: barbell-outline 40px, "Aucune séance récente", subtitle
- Populated state: bg #FFFFFF, border #E2E0DA, shadow elevation 2, barbell-outline icon tile, session name + date/duration sub, volume in #22C55E
- Session date formatted as `d MMM`, duration as `Math.round(duration_seconds / 60) min`
- Imports `useRecentSessions` from `../../src/hooks/useHomeData`

**Imports added:**
- `Skeleton` from `@ziko/ui`
- `useActiveAIProgram, useWeeklySessions, useRecentSessions, useProfile, parseWorkoutFrequency` from `../../src/hooks/useHomeData`

**Fixtures removed:**
- `RECENT` fixture — no longer referenced
- `workoutStore.activeProgram` usage from MissionCard section
- `workoutStore.recentSessions` usage from Recent section
- `weeklyCount` derived from `workoutStore.recentSessions.filter(<7 days)` — now from `weeklySessions.length`

**Left unchanged (plan 33-04 scope):**
- `FormeDuJour` component and wellness data via cross-plugin stores
- `AICoachInline` component
- `QuickLogRow` / `QuickLogSheet`
- Header with streak and greeting
- `workoutStore.recentSessions` still used for streak computation (plan 33-04 migrates it)

## Deviations from Plan

**1. [Rule 2 - Auto-add] MissionCardContent extracted as named function**
- The plan described replacing JSX inline in DashboardScreen. Extracted as `MissionCardContent` function to keep the loading/empty/populated logic readable and avoid a 100+ line render section inside the component body.
- No behavioral change — renders identically.

**2. [Rule 1 - Bug fix] `done` day guard includes past-only check**
- Plan spec said `done = doneDates.has(dayISOString) AND day is before today`. The original `WeekStrip` had only `sessionDates.has(key)` without the past guard. Added `&& differenceInCalendarDays(date, today) <= 0` to prevent a future day showing as done if data arrives with a future timestamp.

## Known Stubs

None — all three sections render real data from TanStack Query. The FormeDuJour, AICoachInline, and QuickLog sections remain on cross-plugin Zustand stores; those stubs are tracked in plan 33-04.

## Threat Flags

No new network endpoints or auth paths introduced. All three hooks are guarded by `enabled: !!userId` (plan 33-01 implementation). T-33-03-01 mitigated via RLS at DB level.

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/index.tsx` modified
- [x] Commit 26cb3c8 exists in git log
- [x] `useActiveAIProgram` imported and called in DashboardScreen
- [x] `useWeeklySessions` imported and called in DashboardScreen
- [x] `useRecentSessions` imported and called in DashboardScreen
- [x] `Skeleton` imported from `@ziko/ui`
- [x] `HomeWeekStrip` function present (renamed from WeekStrip)
- [x] No `const RECENT` or `RECENT[` references
- [x] No `workoutStore.recentSessions` in Recent section
- [x] No `activeProgram.program_workouts` references
- [x] `date-fns` import present (line 13)
- [x] TypeScript: 0 errors in index.tsx (2 pre-existing errors in ai/chat.tsx and ImportFileScreen.tsx, unrelated)
