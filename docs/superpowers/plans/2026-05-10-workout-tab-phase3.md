# Workout Tab Phase 3 — Implementation Plan

**Goal:** Replace the v1 Séance tab with v2 design: "Au boulot." header, `ResumeBar`, `ProgramCard` weekly grid, `StartModes` (3 cards), `WorkoutHistory` compact. Remove RPE shortcut and Supplements tip banners.

**Architecture:**
- All sub-components inline in `apps/mobile/app/(app)/workout/index.tsx`
- `ProgramCard` shows the active program's weekly day grid, derived from `activeProgram.program_workouts`
- `ResumeBar` appears when `currentSession !== null`
- `StartModes` 3 horizontal cards route to program day, free session, AI chat
- `WorkoutHistory` uses `recentSessions` from workoutStore
- Existing create/delete/duplicate program modals kept (accessed via header "+" button)
- `useThemeStore` via `theme.*` — no hardcoded colors

**What's removed:**
- RPE Calculator shortcut banner
- Supplements tip banner
- `useCommunityStore` quick-start orange button

**What's kept:**
- All program CRUD logic (loadPrograms, createProgram, deleteProgram, duplicateProgram, setActiveProgram)
- Community share modal + `useCommunityStore`
- Translation hooks

---

## Tasks

- [ ] Task 1: New header + ResumeBar + ProgramCard components
- [ ] Task 2: StartModes component
- [ ] Task 3: WorkoutHistory component + final layout assembly
- [ ] Task 4: Remove RPE/supplements banners, type-check, commit
