---
phase: 36-workout-stack-redesign
plan: "01"
subsystem: mobile/workout-stack
tags: [mobile, workout, ui-redesign, tanstack-query, linear-gradient]
dependency_graph:
  requires: []
  provides:
    - WSHeader component (light/dark variants)
    - Séance tab ProgramDetail redesign
    - TanStack Query wiring for ai_generated_programs
  affects:
    - apps/mobile/app/(app)/workout/index.tsx
    - apps/mobile/src/components/WSHeader.tsx
    - packages/ui/src/components/PluginHeader.tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery with queryKey ['active-program', userId]
    - LinearGradient from expo-linear-gradient for hero card and progress bar
    - Optional chaining on all program_data JSONB field accesses
key_files:
  created:
    - apps/mobile/src/components/WSHeader.tsx
  modified:
    - apps/mobile/app/(app)/workout/index.tsx
    - packages/ui/src/components/PluginHeader.tsx
decisions:
  - WSHeader is a standalone component (not wrapping PluginHeader) with independent layout
  - Most recent ai_generated_programs row used as active program (no is_active column)
  - currentWeek hardcoded to 1 (program just started); future plan will persist week progress
  - Exercise rows in Semaine type tab navigate to /(app)/workout/exercise/[exerciseId] per D-07
metrics:
  duration: "~25 min"
  completed: "2026-05-25"
  tasks_completed: 2
  files_changed: 3
---

# Phase 36 Plan 01: WSHeader Component + Séance Tab ProgramDetail Redesign Summary

WSHeader shared component with light/dark variants plus full Séance tab redesign showing real AI program data from `ai_generated_programs` via TanStack Query, dark hero gradient card, SubTabs schedule/weeks, empty state CTA to AIGenerator, and recent sessions strip.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | WSHeader component + PluginHeader dark prop | `01d760e` | WSHeader.tsx (new), PluginHeader.tsx (modified) |
| 2 | Séance tab ProgramDetail + TanStack Query | `1ee984f` | workout/index.tsx (full redesign) |

## What Was Built

### WSHeader Component (`apps/mobile/src/components/WSHeader.tsx`)

New shared header component for all workout screens:
- `WSHeaderProps`: `title`, `sub?`, `onBack?`, `right?`, `dark?`
- Light variant: `theme.background + 'F0'` bg, `theme.border` bottom border, `theme.text` icons/title
- Dark variant: `rgba(28,26,23,0.94)` bg, `rgba(255,250,246,0.06)` border, `#FFFAF6` text
- Back button: `borderRadius: 11`, `Ionicons name="chevron-back" size={16}`
- No StyleSheet.create — inline style objects only
- Imports `useThemeStore` from `@ziko/plugin-sdk`

### PluginHeader Extension (`packages/ui/src/components/PluginHeader.tsx`)

Added `dark?: boolean` prop (defaults to `false`) to the existing interface and function signature. WSHeader remains the primary component for workout screens; PluginHeader dark prop is available for future use in plugins.

### Séance Tab Redesign (`apps/mobile/app/(app)/workout/index.tsx`)

Complete visual redesign matching UI-SPEC §2:

**Data layer:**
- `useQuery({ queryKey: ['active-program', userId] })` fetching `ai_generated_programs` table
- `.select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single()`
- Returns most recent program as active (confirmed by research — no `is_active` column)
- `enabled: !!userId` guard
- All `program_data` JSONB accesses use optional chaining (mitigates T-36-01-02)

**Layout:**
- `SafeAreaView` → `ScrollView` (paddingBottom: 100)
- `WSHeader` light variant with `•••` menu → `showAlert` when program active
- Simple `"Au boulot."` title row when no program
- `ResumeBar` preserved unchanged for in-progress sessions

**Hero card:**
- `LinearGradient` colors `['#1C1A17', '#2A211B']` start `{x:0.13, y:0}` end `{x:1,y:1}`
- Orange glow orb: `position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,92,26,0.35)'`
- ACTIF badge (orange pill) + split badge (cream pill)
- Week progress row: `fontSize: 34` current / divider / `fontSize: 16` total
- Progress bar: `LinearGradient` fill `['#FF5C1A', '#FFB07A']` at `(currentWeek/totalWeeks)*100%`

**SubTabs + content:**
- `useState activeTab` toggles between "Semaine type" and "N semaines"
- Semaine type: `DayRow` components with day badges (orange tinted active, dashed rest)
- Exercise rows tap → `router.push(/(app)/workout/exercise/[exerciseId])` (D-07)
- N semaines: `WeekRow` with done/current/future states and EN COURS badge

**Empty state:** Barbell icon, "Aucun programme actif", subtitle, orange CTA → `router.push('/(app)/workout/ai-generate')` (D-04)

**Recent sessions strip:** Last 3 from `recentSessions` (loaded via `loadRecentSessions(90)`), "Tout voir →" → `/workout/history`

**Sticky footer CTA:** Absolute positioned, "Démarrer la séance d'aujourd'hui · {todaySessionName}", visible only when `activeProgram` exists

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes on Implementation Choices

**currentWeek hardcoded to 1:** The `ai_generated_programs` table has no week-progress tracking column (confirmed by migration 012 review). Week 1 is the correct default for a newly generated program. A future plan can add persistence (e.g., a `current_week` column or local MMKV store).

**Exercise navigation with exercise_id:** The `program_data` JSONB sessions/exercises shape from the AI tool does not always include `exercise_id` — only `name`, `sets`, `reps`. Navigation to ExerciseDetail only triggers when `exercise_id` is present in the JSONB. This is correct behavior per the data contract.

## Known Stubs

None — no hardcoded fixture data, no placeholder text that blocks the plan goal. The `currentWeek: 1` is intentional default behavior (not a stub), documented above.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan's threat model covers.

## Self-Check

- [x] `apps/mobile/src/components/WSHeader.tsx` exists
- [x] `apps/mobile/app/(app)/workout/index.tsx` modified
- [x] `packages/ui/src/components/PluginHeader.tsx` contains `dark?: boolean`
- [x] Commit `01d760e` exists (task 1)
- [x] Commit `1ee984f` exists (task 2)
- [x] TypeScript: zero errors on WSHeader and workout/index
- [x] `ai_generated_programs` table reference present in index.tsx
- [x] `queryKey: ['active-program', userId]` present
- [x] `rgba(255,92,26,0.35)` orange glow orb present
- [x] `LinearGradient` imported and used
- [x] No `Alert.alert`, `SESSION_DATA`, `PROGRAM_DETAIL`, `HISTORY_DETAIL`, `SUMMARY_DATA`
- [x] `paddingBottom: 100` on ScrollView

## Self-Check: PASSED
