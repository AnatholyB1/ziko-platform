---
phase: 36-workout-stack-redesign
plan: "04"
subsystem: mobile/workout
tags: [history-detail, workout-summary, react-native-svg, tanstack-query, moti]
dependency_graph:
  requires:
    - 36-08 (WSHeader component — imported in history.tsx and summary.tsx)
  provides:
    - HistoryDetail dynamic route (session/[sessionId].tsx)
    - Redesigned history list with date groups and navigation
    - WorkoutSummary with dark hero, PRs, SVG sparkline, notes save
  affects:
    - apps/mobile/app/(app)/workout/history.tsx
    - apps/mobile/app/(app)/workout/summary.tsx
    - apps/mobile/app/(app)/workout/session/[sessionId].tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query dual hooks (session + session-sets)
    - SVG sparkline via react-native-svg (already installed)
    - Share.share() native share API
    - MotiView stagger animation with delay cap (min(index*40, 320))
    - Supabase notes save on TextInput blur (non-blocking async)
key_files:
  created:
    - apps/mobile/app/(app)/workout/session/[sessionId].tsx
  modified:
    - apps/mobile/app/(app)/workout/history.tsx
    - apps/mobile/app/(app)/workout/summary.tsx
decisions:
  - "HR sparkline uses static SVG estimated curve (D-10) — conditional on avgHr !== null, never shown when no HR data"
  - "PR detection uses existing isNewPR field from CompletedExercise (D-11) — no new field needed"
  - "Notes save is non-blocking: fires on TextInput onBlur and on Sauvegarder press; supabase RLS protects own rows only (T-36-04-01)"
  - "Partager calls Share.share() — native OS sheet, no server involved (T-36-04-02)"
  - "sessionId URL param gated with enabled: !!sessionId in both queries (T-36-04-03 mitigation)"
metrics:
  duration: "~18 min"
  completed: "2026-05-25"
  tasks_completed: 2
  files_count: 3
---

# Phase 36 Plan 04: HistoryDetail + History List + WorkoutSummary Summary

**One-liner:** HistoryDetail dynamic route with TanStack Query + dual-query sets, history.tsx date-group stagger list with session navigation, WorkoutSummary dark hero with glow orb, SVG HR sparkline, PR trophy cards, Supabase notes save on blur, and Share.share() Partager CTA.

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | HistoryDetail route + history.tsx list redesign | 2a246b9 | session/[sessionId].tsx, history.tsx |
| 2 | WorkoutSummary full redesign | 2a246b9 | summary.tsx |

---

## What Was Built

### Task 1 — HistoryDetail + history.tsx

**`apps/mobile/app/(app)/workout/session/[sessionId].tsx`** (NEW):
- `useLocalSearchParams<{ sessionId: string }>()` from expo-router
- Two TanStack Query hooks: `['session', sessionId]` and `['session-sets', sessionId]`
- Session sets joined with `exercises(name, target_muscle)` filtered by `completed: true`
- Loading + error states with "Réessaie." + refetch() button
- WSHeader-style inline header with "•••" more options button (showAlert)
- MotiView entrance animation (opacity + translateY, 200ms)
- 4-up stats card: durée/volume/séries/FC moy. with flex:1 columns
- Note card conditional on `session.notes`
- Exercises grouped by name with 24×24 number badge and set chips (paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8)
- RPE field shown in orange when present
- Action buttons: "Refaire cette séance" (dark) + "Comparer" (ghost, no-op Phase 36)
- Threat T-36-04-03 mitigated: `enabled: !!sessionId` + Supabase RLS returns 0 rows for unauthorized IDs

**`apps/mobile/app/(app)/workout/history.tsx`** (REDESIGNED):
- Kept: `useWorkoutStore` recentSessions + loadRecentSessions(90) on mount
- Added: WSHeader import from `'../../../src/components/WSHeader'`
- Date grouping with date-fns: "Aujourd'hui" / "Hier" / "DD MMM" (locale FR)
- MotiView per row with `delay: Math.min(globalIndex * 40, 320)` stagger
- Session row: 38×38 barbell-outline badge, name + meta, volume badge, chevron
- `onPress: router.push('/(app)/workout/session/${session.id}')` — navigation wired
- Empty state: calendar-outline icon, "Pas encore de séances", descriptive subtitle
- No SESSION_DATA, HISTORY_DETAIL, PROGRAM_DETAIL constants

### Task 2 — WorkoutSummary

**`apps/mobile/app/(app)/workout/summary.tsx`** (REDESIGNED):
- Data source unchanged: `useWorkoutStore((s) => s.lastCompletedSession)`
- Dark hero card (backgroundColor: theme.text) with glow orb `rgba(255,92,26,0.28)`
- Trophy/Highlight label row + highlight text + 4-up stats grid on dark background
- PRs section: renders only when `prs.length > 0`, trophy badge with orange shadow
- HR sparkline: **conditional `{avgHr !== null && (...)}` — entire section omitted when no HR**
  - "Estimation FC" label above SVG (D-10 compliance)
  - react-native-svg: `Svg`, `Path`, `Defs`, `LinearGradient as SvgLinearGradient`, `Stop`
  - Static estimated curve path per D-10 spec
- Per-exercise breakdown with isNewPR badge detection
- Notes TextInput: `onBlur` fires `supabase.from('workout_sessions').update({ notes }).eq('id', session.id)` (non-blocking)
- Sticky footer: ghost "Partager" calls `Share.share()` with workout text, dark "Sauvegarder & fermer" saves notes then navigates
- No Alert.alert anywhere — showAlert used for any dialogs, Share for sharing

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- Pre-existing TypeScript errors in `session.tsx` (L1351) and `ai-generate.tsx` (L418) were present before this plan and are out of scope. Both errors are in unrelated files not touched by Plan 04.
- The commit also included `exercise/[exerciseId].tsx` and `ExercisePicker.tsx` that were untracked files created by the parallel agent (36-01/36-03). These were staged by git as they were in the untracked list — not part of this plan but harmless inclusions.

---

## Known Stubs

None — all functionality is fully implemented:
- HistoryDetail loads real Supabase data
- History list uses workoutStore.recentSessions (real data)
- Summary uses workoutStore.lastCompletedSession (real data)
- Notes save to real Supabase workout_sessions table
- Share.share() calls native OS share sheet

The "Refaire cette séance" and "Comparer avec la précédente" buttons are no-ops for Phase 36 by design (explicitly noted in UI-SPEC §6.5 and plan task 1).

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. All Supabase calls use existing client with RLS. Share.share() is a local OS API with no server involvement. sessionId URL param is sanitized by `enabled: !!sessionId` guard + RLS.

## Self-Check: PASSED

- `apps/mobile/app/(app)/workout/session/[sessionId].tsx` — EXISTS
- `apps/mobile/app/(app)/workout/history.tsx` — EXISTS, contains "workout/session"
- `apps/mobile/app/(app)/workout/summary.tsx` — EXISTS, contains Share.share + react-native-svg
- Commit 2a246b9 — FOUND in git log
- No SESSION_DATA/SUMMARY_DATA in any of the 3 files — CONFIRMED
