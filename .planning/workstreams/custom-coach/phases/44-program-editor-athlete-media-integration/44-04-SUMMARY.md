---
phase: 44-program-editor-athlete-media-integration
plan: "44-04"
subsystem: mobile/workout
tags: [athlete, media, expo-av, modal, coach-exercise]
dependency_graph:
  requires: ["44-02"]
  provides: ["athlete-media-bottom-sheet"]
  affects: ["apps/mobile/app/(app)/workout/[id].tsx"]
tech_stack:
  added: ["expo-av (Video, ResizeMode)"]
  patterns: ["pageSheet Modal", "graceful degradation on fetch error"]
key_files:
  modified:
    - apps/mobile/app/(app)/workout/[id].tsx
decisions:
  - "Used Image from react-native (not expo-image) for photo display per plan spec"
  - "fetchAndOpenMedia placed before loadProgram callback to keep hooks/callbacks ordered logically"
  - "Pre-existing 9 tsc TS2307 errors in unrelated plugin wrapper files — not introduced by this plan"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  files_modified: 1
---

# Phase 44 Plan 04: Athlete Media Bottom Sheet Summary

## One-liner

Read-only coach exercise media modal added to workout/[id].tsx — tapping a `coach_exercise_id`-linked exercise row slides up a pageSheet with video (expo-av) or photo (react-native Image) fetched from the backend signed URL endpoint.

## What was implemented

### Task 1 — Supabase query + type update
- Updated `program_workouts` select query from `program_exercises(*, exercises(...))` to `program_exercises(*, coach_exercise_id, exercises(...))` so `coach_exercise_id` is returned from the DB join.
- Extended the `WorkoutDay.program_exercises` item type to include `coach_exercise_id?: string | null`.

### Task 2 — Modal state and fetchAndOpenMedia helper
- Added imports: `Image` from `react-native` (added to existing destructure), `Video` and `ResizeMode` from `expo-av` (new import line).
- Added 5 state variables: `showMediaModal`, `mediaExerciseName`, `mediaVideoUrl`, `mediaPhotoUrl`, `mediaLoading`.
- Added `fetchAndOpenMedia(coachExerciseId, exerciseName)` async function:
  - Opens modal immediately and shows loading skeleton
  - Fetches `${EXPO_PUBLIC_API_URL}/coach/exercises/${coachExerciseId}/media-url` with Bearer token from `supabase.auth.getSession()`
  - Sets video/photo URLs from response; graceful silent degradation on error (catch swallows, modal remains open showing name only)
  - Clears loading state in `finally`

### Task 3 — onPress wire-up and Modal rendering
- Exercise row `TouchableOpacity` now has `onPress` set only when `pe.coach_exercise_id` is non-null; rows without it remain tap-inert (undefined handler).
- Added `<Modal>` with `presentationStyle="pageSheet"` and `animationType="slide"` after the CycleConfigModal block, inside the main component's SafeAreaView:
  - Header: exercise name + close button (Ionicons `close`)
  - Loading state: plain View skeleton (200px height)
  - Video state: `<Video>` from expo-av with `useNativeControls`, `ResizeMode.CONTAIN`, `shouldPlay={false}`
  - Photo state: `<Image>` from react-native with `resizeMode="contain"`
  - No-media state: "Aucun média disponible pour cet exercice." text

## Verification result

```
rtk tsc --noEmit in apps/mobile — TypeScript: 9 errors in 9 files (all pre-existing TS2307 "Cannot find module" errors in unrelated plugin wrapper files)
No errors in apps/mobile/app/(app)/workout/[id].tsx
```

Pre-existing errors confirmed not introduced by this plan — they exist on plugin wrapper files (`habits/dashboard.tsx`, `sleep/dashboard.tsx`, etc.) and are out of scope.

## Deviations from plan

None — plan executed exactly as written. Line numbers matched expectations:
- `WorkoutDay` interface at line 36 (expected ~31-37) — matches
- `loadProgram()` select query at line 117 (expected ~115-118) — matches
- Exercise row `TouchableOpacity` at line 609 (expected ~606-619) — matches
- Last Modal block before insertion: `CycleConfigModal` at line 1019 (expected ~700-780 plus cycle config) — media modal inserted before closing `</SafeAreaView>` of main component

## Self-Check

- [x] `apps/mobile/app/(app)/workout/[id].tsx` modified and committed
- [x] Commit `4582e4f` exists
- [x] No new tsc errors introduced in workout/[id].tsx
