---
phase: 36-workout-stack-redesign
plan: "03"
subsystem: mobile-workout
tags: [exercise-detail, exercise-picker, tanstack-query, moti, expo-router]
dependency_graph:
  requires: [36-01-WSHeader]
  provides: [ExerciseDetailRoute, ExercisePickerModal]
  affects: [workout/exercise/[exerciseId].tsx, src/components/ExercisePicker.tsx]
tech_stack:
  added: []
  patterns: [TanStack Query useQuery, MotiView entrance animation, Modal pageSheet, LinearGradient footer fade]
key_files:
  created:
    - apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx
    - apps/mobile/src/components/ExercisePicker.tsx
  modified: []
decisions:
  - "auth-session query used to fetch userId for session_sets history — avoids prop drilling"
  - "sessionGroups computed from history via Set of date-keys — groups sets per session for bar chart"
  - "Tendance stat uses weight_kg delta between last 2 sets (not volume) — simpler and readable"
  - "Favoris filter shows all exercises in Phase 36 (stub) — documented in Known Stubs"
metrics:
  duration: "35 min"
  completed: "2026-05-25"
  tasks_completed: 2
  files_created: 2
---

# Phase 36 Plan 03: ExerciseDetail Route + ExercisePicker Modal Summary

ExerciseDetail dynamic route and ExercisePicker modal component created — exercise drill-down with real Supabase data wiring, 16:9 video placeholder, 3 stat tiles, SubTabs with AISuggestion and mini bar chart, and multi-select picker modal with stagger animations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ExerciseDetail route with stat tiles, SubTabs, AISuggestion, mini bar chart | 2a246b9 | apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx |
| 2 | ExercisePicker modal with search, filter chips, multi-select, sticky footer | 2a246b9 | apps/mobile/src/components/ExercisePicker.tsx |

## What Was Built

### ExerciseDetail (`apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx`)

- `useLocalSearchParams<{ exerciseId: string }>()` for dynamic Expo Router param
- Two TanStack Query hooks: `['exercise', exerciseId]` → exercises table (single); `['exercise-history', exerciseId, userId]` → session_sets joined with workout_sessions (30 records)
- Loading state: `ActivityIndicator` centered
- Error state: "Impossible de charger les données. Réessaie." + "Réessayer" button calling `refetch()`
- 16:9 dark video placeholder (`backgroundColor: '#1C1A17'`, orange tint overlay 4%, centered play button 60×60 shadow, "Démo · 0:42" badge top-left, "HD" badge bottom-right)
- 3 stat tiles (Record/Séances/Tendance) computed from real history data with `maxWeight`, unique `sessionCount`, and `trendPct` delta
- 3 SubTabs (Consignes/Muscles/Historique) with pill container
- Consignes tab: numbered cue circles (22×22, orange 14% tint) + AISuggestion block (sparkles icon)
- Muscles tab: primary muscle orange pill + secondary muscle_groups chips
- Historique tab: mini bar chart (5 sessions, proportional height, newest bar orange) + session rows with date-fns relative dates
- MotiView entrance animation `from={{ opacity:0, translateY:8 }} animate={{ opacity:1, translateY:0 }} transition={{ type:'timing', duration:200 }}`
- Action buttons: "Ajouter à ma séance" → `setShowPicker(true)`, "Substituer" → `showAlert`
- ExercisePicker modal rendered inline

### ExercisePicker (`apps/mobile/src/components/ExercisePicker.tsx`)

- `ExercisePickerProps`: `{ visible: boolean, onClose: () => void, onAdd: (selectedIds: string[]) => void }`
- Modal with `animationType="slide"` `presentationStyle="pageSheet"`
- TanStack Query `queryKey: ['exercises-picker']` → exercises table (id/name/muscle_groups/equipment/target_muscle), `staleTime: 5 * 60 * 1000`
- Search input with search-outline icon + clear button (close-outline visible when query non-empty)
- 7 filter chips: Favoris (★ prefix) / Pectoraux / Dos / Jambes / Épaules / Bras / Abdos
- Filter logic: Bras = Biceps|Triceps, others match target_muscle or muscle_groups array, search overrides muscle filter
- Exercise rows with multi-select checkbox UI (orange fill + checkmark when selected, bordered empty otherwise)
- Stagger MotiView animation: `from={{ opacity:0, translateY:8 }} delay=Math.min(index*40, 320)`
- Sticky gradient footer: LinearGradient fade, disabled ("Sélectionne des exercices") when 0 selected, active orange ("Ajouter N exercice(s)") when 1+ selected
- State reset on close and on add
- Error state with "Réessaie" + `refetch()` button
- WSHeader from `'../components/WSHeader'`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Notes

**Parallel execution:** The two files were committed by the plan 36-04 executor agent (commit `2a246b9`) which ran in parallel. Our implementation matched exactly — no conflicts or overrides needed.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Favoris filter shows all exercises | `apps/mobile/src/components/ExercisePicker.tsx` | ~85 | Favorites list not yet implemented in Phase 36; `showAlert` note deferred — filter returns all instead to avoid empty state |
| AISuggestion text is static | `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` | ~248 | Coaching text is hardcoded; real AI suggestion injection planned for a future AI integration pass |
| 16:9 video is a placeholder | `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` | ~143 | No real video/demo content in Phase 36; visual placeholder only |

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Both files query existing tables (exercises, session_sets, workout_sessions) with RLS enforcement. No threat flags.

## Self-Check: PASSED

- `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` — EXISTS (committed 2a246b9)
- `apps/mobile/src/components/ExercisePicker.tsx` — EXISTS (committed 2a246b9)
- `useLocalSearchParams` — FOUND
- `exercise-history` queryKey — FOUND
- `exercises-picker` queryKey — FOUND
- TypeScript check — zero errors on new files
- No StyleSheet.create — CONFIRMED
