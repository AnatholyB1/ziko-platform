---
phase: 37
plan: "03"
subsystem: plugins/habits
tags: [habits, plugin-redesign, tanstack-query, heatmap, completion-toggle]
dependency_graph:
  requires: [37-01]
  provides: [HabitsPlugin entrypoint with 3 SubTabs]
  affects: [apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx]
tech_stack:
  added: []
  patterns: [TanStack Query useQuery/useMutation, optimistic update, inline heatmap]
key_files:
  created:
    - plugins/habits/src/screens/HabitsPlugin.tsx
  modified:
    - apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx
    - plugins/habits/src/index.ts
  deleted:
    - plugins/habits/src/screens/HabitsDashboardScreen.tsx
decisions:
  - "30-day heatmap built inline with View/flexWrap — not a shared component (per plan spec)"
  - "Streak computation iterates backward from today using monthLogs (30-day window)"
  - "AISuggestion rule: habit missed > 3 of last 7 days triggers specific tip with habit name"
  - "Template tap opens creation modal pre-filled — avoids instant insert without user confirmation"
metrics:
  duration: "~20 min"
  completed: "2026-05-26T09:54:04Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 37 Plan 03: HabitsPlugin Redesign Summary

**One-liner:** Single-entrypoint HabitsPlugin.tsx with 3 SubTabs, completion toggle with optimistic update, 30-day inline heatmap, 8-template creation grid — all data from TanStack Query.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build HabitsPlugin.tsx | ded8422 | plugins/habits/src/screens/HabitsPlugin.tsx |
| 2 | Wire route + barrel + delete old | 7f8cbe0 | dashboard.tsx, index.ts, HabitsDashboardScreen.tsx (deleted) |

## What Was Built

### HabitsPlugin.tsx

Full 3-tab plugin entrypoint using internal `useState('Aujourd\'hui')` for tab switching.

**Aujourd'hui tab:**
- Summary card: `done/total habitudes` count + per-habit dot grid (20×20px, habit.color when done)
- AISuggestion with PLUG-HAB-05 rule: if any habit missed > 3 of last 7 days → `"Tu rates '{name}' N fois sur 7. On baisse la cible ?"` — else generic encouragement
- Habit list with completion toggle button (36×36px, borderRadius 8): done = habit.color bg + checkmark; undone = transparent + 2px border + habit icon
- Streak chip for habits with streak > 0 (rgba(color, 0.14) bg, flame icon)
- Optimistic update: flips state immediately via `queryClient.setQueryData`, reverts + `showAlert` on error
- Loading skeleton: 3 placeholder cards at 0.4 opacity
- Empty state: navigates to Nouvelle tab

**Historique tab:**
- Month overview card: completion rate % (32px) + "jours complets" chip
- 30-day heatmap built inline with `View { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }` — 30 cells computed, each `width: (screenWidth - 32 - 36) / 10`, `aspectRatio: 1`, `borderRadius: 4`
  - Done day: `rgba(255, 92, 26, 0.5 + rate * 0.5)` — orange intensity proportional to completion rate
  - Missed day: `rgba(28,26,23,0.05)`
- Top streaks: habits sorted by streak DESC, each with icon circle + name + `{streak}j` display

**Nouvelle tab:**
- AISuggestion with generic sleep/goal advice + "Créer" CTA
- 8 templates in 2-column grid: Méditer, Lire, Marcher 10k pas, Pas d'alcool, Vitamines, Étirements, Courir 30 min, Dormir 8h
- Each template tap opens creation modal pre-filled
- Primary CTA "Créer une habitude perso" opens blank creation modal
- Modal: TextInput name (max 100 chars) + frequency picker (Tous les jours / Lun-Ven) + Créer button

**Security (threat model mitigations):**
- T-37-03-01: All inserts include `user_id` from auth session; unique constraint on (habit_id, date) prevents duplicates
- T-37-03-02: Name trimmed + non-empty check + max 100 chars before any mutation
- T-37-03-03: `.eq('user_id', userId)` on all queries; RLS double-enforces

### Route + barrel wiring

- `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx`: changed import from `HabitsDashboardScreen` to `HabitsPlugin`
- `plugins/habits/src/index.ts`: added `export { default as HabitsPlugin } from './screens/HabitsPlugin'`
- `plugins/habits/src/screens/HabitsDashboardScreen.tsx`: deleted after verifying 0 remaining import references

## Deviations from Plan

**1. [Rule 2 - Security] Habit name validation added to template mutations**
- **Found during:** Task 1 (threat model T-37-03-02)
- **Issue:** Plan spec showed template tap → direct insert; no explicit mention of validation in template path
- **Fix:** Both template and custom habit mutations validate name non-empty + trimmed + max 100 chars before Supabase insert
- **Files modified:** plugins/habits/src/screens/HabitsPlugin.tsx

**2. [Deviation — UX] Template tap opens modal instead of direct insert**
- **Found during:** Task 1
- **Reason:** UI-SPEC §3.5 states "tap template → open habit creation form pre-filled with name + icon + color" — not a direct insert. The plan's `<behavior>` section mentioned direct insert; UI-SPEC was used as source of truth per plan instruction
- **Impact:** Better UX — user can review and confirm before creating; matches §3.5 spec exactly

None of these deviations change the plan goal or require architectural changes.

## Verification Results

```
rtk tsc --noEmit → 0 error TS
grep 'export default function HabitsPlugin' HabitsPlugin.tsx → FOUND
test -f HabitsDashboardScreen.tsx → DELETED OK
grep 'HabitsDashboardScreen' apps/ plugins/habits/src/ → 0 lines
grep 'useMutation' HabitsPlugin.tsx → FOUND (toggleMutation + createHabitMutation)
grep 'flexWrap' HabitsPlugin.tsx → 'wrap' in 3 locations
grep 'WeekStrip' HabitsPlugin.tsx → NOT FOUND (correct)
grep 'Méditer|Marcher|Vitamines|Courir 30|Dormir 8' HabitsPlugin.tsx → 6 matches
```

## Known Stubs

None. All data fetched via TanStack Query from real Supabase tables (`habits`, `habit_logs`).

## Threat Flags

None. No new network endpoints or auth paths introduced. All Supabase writes are scoped by authenticated `user_id` from `supabase.auth.getUser()`.

## Self-Check: PASSED

- `plugins/habits/src/screens/HabitsPlugin.tsx` — FOUND
- `apps/mobile/app/(app)/(plugins)/habits/dashboard.tsx` — FOUND, imports HabitsPlugin
- `plugins/habits/src/index.ts` — FOUND, exports HabitsPlugin
- `plugins/habits/src/screens/HabitsDashboardScreen.tsx` — DELETED (confirmed)
- Commit ded8422 — FOUND in git log
- Commit 7f8cbe0 — FOUND in git log
- TypeScript: 0 errors
