---
phase: 33
plan: 01
subsystem: mobile/hooks
tags: [tanstack-query, supabase, data-layer, home-screen]
dependency_graph:
  requires: []
  provides: [useHomeData hooks, HOME_DEFAULTS, parseWorkoutFrequency]
  affects: [apps/mobile/app/(app)/index.tsx (plans 33-03, 33-04)]
tech_stack:
  added: []
  patterns: [TanStack Query v5 useQuery, Supabase direct client, Zustand selector (useAuthStore)]
key_files:
  created:
    - apps/mobile/src/hooks/useHomeData.ts
  modified: []
decisions:
  - Used .maybeSingle() for sleep_logs and ai_generated_programs — both rows may be absent
  - Used .eq('is_active', true) boolean (not status='active') per migration 012
  - Hardcoded hydrationGoalMl=2500, sleepTargetH=8 (columns do not exist in schema)
  - parseWorkoutFrequency parses '5+' → 5 via strip-replace before parseInt
  - useStreak uses a Set to deduplicate habit_log dates before counting consecutive days
metrics:
  duration: 8min
  completed: 2026-05-21
  tasks_completed: 1
  files_created: 1
---

# Phase 33 Plan 01: Home Screen Data Layer Summary

**One-liner:** 8 TanStack Query hooks (useHomeData.ts) reading user_profiles, habit_logs, sleep_logs, hydration_logs, nutrition_logs, workout_sessions, ai_generated_programs with typed returns and HOME_DEFAULTS fallbacks.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create useHomeData.ts with 8 TanStack Query hooks | 83de683 | apps/mobile/src/hooks/useHomeData.ts |

## What Was Built

`apps/mobile/src/hooks/useHomeData.ts` — a pure data layer file (no UI) exporting:

| Export | Type | Table | staleTime |
|--------|------|-------|-----------|
| `useProfile` | hook | user_profiles | 10 min |
| `useStreak` | hook | habit_logs (computed) | 5 min |
| `useSleepToday` | hook | sleep_logs | 10 min |
| `useHydrationToday` | hook | hydration_logs | 2 min |
| `useNutritionToday` | hook | nutrition_logs | 5 min |
| `useWeeklySessions` | hook | workout_sessions | 5 min |
| `useActiveAIProgram` | hook | ai_generated_programs | 10 min |
| `useRecentSessions` | hook | workout_sessions | 5 min |
| `HOME_DEFAULTS` | const | — | — |
| `parseWorkoutFrequency` | helper | — | — |

All hooks: `enabled: !!userId`, userId from `useAuthStore((s) => s.user?.id)`, non-null assertion inside queryFn (safe because enabled guards it). No StyleSheet.create, no cross-plugin require().

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a pure data layer file with no UI rendering.

## Threat Flags

No new network endpoints, auth paths, or file access patterns beyond what is documented in the plan threat model. All queries are guarded by `enabled: !!userId` (T-33-01-01 mitigation in place).

## Self-Check: PASSED

- [x] `apps/mobile/src/hooks/useHomeData.ts` exists
- [x] Commit 83de683 verified in git log
- [x] 8 exported hook functions confirmed (`grep -c "^export function use"` = 8)
- [x] HOME_DEFAULTS exported
- [x] parseWorkoutFrequency exported
- [x] `.maybeSingle()` appears 2 times (sleep_logs + ai_generated_programs)
- [x] `.eq('is_active', true)` appears once
- [x] No require() calls
- [x] No StyleSheet references
- [x] TypeScript: 0 new errors (2 pre-existing errors in unrelated files)
