---
phase: 20-activity-earn-hooks
plan: "02"
subsystem: mobile-earn-hooks
tags: [credits, earn, mobile, fire-and-forget, idempotency]
dependency_graph:
  requires: ["20-01"]
  provides: ["mobile-earn-hooks"]
  affects: ["apps/mobile/src/lib/earnCredits.ts", "apps/mobile/src/stores/workoutStore.ts", "plugins/habits", "plugins/nutrition", "plugins/measurements", "plugins/stretching", "plugins/cardio"]
tech_stack:
  added: []
  patterns:
    - "Fire-and-forget fetch: fetch(...).catch(() => {}) with no await"
    - "Inline earnCredit helper in plugins (cross-package boundary)"
    - "Shared callCreditsEarn in apps/mobile/src/lib for store access"
    - "Idempotency key = record UUID (from .select().single()) or habit_${id}_${date}"
key_files:
  created:
    - apps/mobile/src/lib/earnCredits.ts
  modified:
    - apps/mobile/src/stores/workoutStore.ts
    - plugins/habits/src/screens/HabitsDashboardScreen.tsx
    - plugins/nutrition/src/screens/LogMealScreen.tsx
    - plugins/measurements/src/screens/MeasurementsLog.tsx
    - plugins/stretching/src/screens/StretchingSession.tsx
    - plugins/cardio/src/screens/CardioTracker.tsx
decisions:
  - "Inline earnCredit helper used in all 5 plugin screens — plugins cannot import from apps/mobile/src (no tsconfig path alias)"
  - "Shared callCreditsEarn exported from apps/mobile/src/lib/earnCredits.ts for workoutStore (same package)"
  - "Habit idempotency key = habit_${id}_${date}: fires on every increment, server ON CONFLICT DO NOTHING prevents double-credit"
  - "StretchingSession insert upgraded to .select('id').single() to obtain record UUID for idempotency key"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 7
---

# Phase 20 Plan 02: Activity Earn Hooks (Mobile Screens) Summary

Fire-and-forget POST /credits/earn hooks wired into all 6 mobile-side activity screens — workout store, habits dashboard, log meal, measurements log, stretching session, and cardio tracker — using a shared helper in apps/mobile and inline helpers in plugin screens.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared earnCredits helper + workout store + habits screen hooks | 519e783 | earnCredits.ts (new), workoutStore.ts, HabitsDashboardScreen.tsx |
| 2 | Nutrition, measurements, stretching, and cardio mobile screen earn hooks | 2c2d7de | LogMealScreen.tsx, MeasurementsLog.tsx, StretchingSession.tsx, CardioTracker.tsx |

## What Was Built

**Shared helper (`apps/mobile/src/lib/earnCredits.ts`):**
- `callCreditsEarn(supabase, source, idempotencyKey)` — reads JWT from `supabase.auth.getSession()`, fires `fetch()` to `POST /credits/earn` with no `await`, swallows all errors in both outer try/catch (getSession failures) and inner `.catch(() => {})` (network failures)

**Earn hooks wired in 6 locations:**

| Screen | Source | Idempotency Key | When |
|--------|--------|-----------------|------|
| `workoutStore.endSession` | `workout` | `currentSession.id` (UUID) | Before `set({ currentSession: null })` |
| `HabitsDashboardScreen.handleToggle` | `habit` | `habit_${id}_${date}` | When `newValue >= 1` |
| `HabitsDashboardScreen.handleIncrement` | `habit` | `habit_${id}_${date}` | On every increment |
| `LogMealScreen.saveLog` | `meal` | `data.id` (UUID) | After insert, before `router.back()` |
| `MeasurementsLog.handleSave` | `measurement` | `data.id` (UUID) | After insert, before `router.back()` |
| `StretchingSession.handleNext` | `stretch` | `logData.id` (UUID) | After insert (upgraded to `.select('id').single()`) |
| `CardioTracker.handleSave` | `cardio` | `data.id` (UUID) | After insert, before `addSession()` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Pattern] Inline helper used in all 5 plugin screens instead of cross-package import**
- **Found during:** Task 1 analysis
- **Issue:** Plugins have no tsconfig path alias to `apps/mobile/src` — a direct relative import like `'../../../../apps/mobile/src/lib/earnCredits'` would not resolve at build time
- **Fix:** Inlined the identical `earnCredit()` function body (13 lines) in each plugin screen — same logic as the shared helper, no behavioral difference
- **Files modified:** HabitsDashboardScreen.tsx, LogMealScreen.tsx, MeasurementsLog.tsx, StretchingSession.tsx, CardioTracker.tsx
- **Commit:** 519e783, 2c2d7de

## Known Stubs

None. All earn calls are wired to real record UUIDs from successful Supabase inserts or deterministic date-keyed strings (habits).

## Threat Flags

No new network endpoints or auth paths introduced. `earnCredit` uses the existing Supabase session token — same trust boundary documented in plan's threat model (T-20-06 through T-20-09).

## Self-Check: PASSED

- apps/mobile/src/lib/earnCredits.ts: FOUND
- Commit 519e783 (Task 1): FOUND
- Commit 2c2d7de (Task 2): FOUND
