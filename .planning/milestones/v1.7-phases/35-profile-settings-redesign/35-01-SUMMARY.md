---
phase: 35-profile-settings-redesign
plan: 01
subsystem: ui
tags: [react-native, tanstack-query, supabase, expo-linear-gradient, ionicons, animated]

# Dependency graph
requires: []
provides:
  - "STToggle: animated 40x24 pill toggle with spring thumb animation in packages/ui"
  - "STGroup: settings group wrapper with uppercase label + card container in packages/ui"
  - "STRow: settings row with icon/label/sub/right in packages/ui"
  - "PRStatCard: stat card with icon circle, value, label in packages/ui"
  - "ProfileHero: 160px LinearGradient hero cover with radial overlays + floating buttons in packages/ui"
  - "profile/index.tsx rebuilt: hero + 84px avatar -44px overlap + followers row + 3-tab scaffold"
affects: [35-02, 35-03, settings-screen, public-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared settings components exported from packages/ui (STRow/STGroup/STToggle) — reused in settings screen"
    - "TanStack Query key ['profile', userId] — single hook fetching user_profiles + workout_sessions + friendships"
    - "fmtN helper for count formatting >= 1000 → Nk"
    - "ProfileHero isolates hero rendering (gradient + overlays + floating buttons) from parent screen"
    - "Skeleton state via conditional render (isLoading) with fixed #E2E0DA placeholder views"

key-files:
  created:
    - packages/ui/src/components/STToggle.tsx
    - packages/ui/src/components/STGroup.tsx
    - packages/ui/src/components/STRow.tsx
    - packages/ui/src/components/PRStatCard.tsx
    - packages/ui/src/components/ProfileHero.tsx
  modified:
    - packages/ui/src/index.ts
    - apps/mobile/app/(app)/profile/index.tsx

key-decisions:
  - "expo-linear-gradient already installed — used directly in ProfileHero instead of fallback View simulation"
  - "ProfileHero only renders the 160px hero rectangle + floating buttons; avatar rendered by parent with marginTop:-44"
  - "streak and prs stubbed as 0 in useProfileData queryFn — will be computed properly in plan 35-02"
  - "Tab content renders empty View when sessions > 0 (stubs wired in 35-02); empty state card shown when sessions === 0"
  - "Old sub-components (IdentityCard, TotalsRow, MorphoRow, CreditsCard, PRsList, GoalsList, SettingsList) fully removed"

requirements-completed: [PROF-01, PROF-04, PROF-05, PROF-06]

# Metrics
duration: 25min
completed: 2026-05-22
---

# Phase 35 Plan 01: Profile Hero + Shared Settings Components Summary

**5 shared UI components (STRow/STGroup/STToggle/ProfileHero/PRStatCard) + profile screen rebuilt with 160px LinearGradient hero, 84px avatar at -44px overlap, and real TanStack Query data from user_profiles/workout_sessions/friendships**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22T00:25:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Created 4 shared settings components (STToggle, STGroup, STRow, PRStatCard) in `packages/ui/` with animated thumb, separator dividers, icon squares, and stat cards — all exported from index.ts
- Created ProfileHero with expo-linear-gradient (avatarColor → #1C1A17), two radial circle overlays (rgba white top-left, rgba orange bottom-right), and floating glass nav buttons
- Rebuilt profile/index.tsx: ProfileHero + 84px avatar (-44px overlap, borderRadius 24, 4px #F7F6F3 border) + followers row (ABONNÉS/ABONNEMENTS/SEMAINES with fmtN) + 3-tab scaffold (Stats/Progrès/Badges) + skeleton + empty state

## Task Commits

1. **Task 1: STRow, STGroup, STToggle, PRStatCard** — `7ad77a1` (feat)
2. **Task 2: ProfileHero component** — `de57e89` (feat)
3. **Task 3: Rebuild profile/index.tsx** — `4c8d250` (feat)

## Files Created/Modified

- `packages/ui/src/components/STToggle.tsx` — Animated 40x24 toggle pill, thumb left:2/18, green when on
- `packages/ui/src/components/STGroup.tsx` — Uppercase label + card container with 1px dividers
- `packages/ui/src/components/STRow.tsx` — Icon square + label/sub + toggle/value/chevron right element
- `packages/ui/src/components/PRStatCard.tsx` — Stat card: icon circle (32px), value (22px/700), muted label
- `packages/ui/src/components/ProfileHero.tsx` — 160px LinearGradient hero + 2 radial overlays + floating buttons
- `packages/ui/src/index.ts` — Added 5 new exports
- `apps/mobile/app/(app)/profile/index.tsx` — Full rewrite: hero + identity + followers + tab scaffold

## Decisions Made

- Used `expo-linear-gradient` (already installed) for ProfileHero gradient — no fallback needed
- Avatar rendered by parent screen with `marginTop: -44`; ProfileHero only manages the 160px rectangle
- `streak` and `prs` stats stubbed as 0 — plan 35-02 will wire real computation
- Tab content renders empty View when sessions > 0 (35-02 wires actual content); empty state shown when sessions === 0

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `data.stats.streak = 0` in `useProfileData` queryFn (line ~52) — will be computed (consecutive days with habit_logs OR workout_sessions) in plan 35-02
- `data.stats.prs = 0` in `useProfileData` queryFn (line ~52) — will be computed from `session_sets` in plan 35-02
- Tab content area (Stats/Progrès/Badges) renders `<View />` when sessions > 0 — stubs wired in plan 35-02

These stubs are intentional per plan specification: "streak and prs are stubbed as 0 here — plan 35-02 will compute them properly and add the tab content."

## Issues Encountered

None.

## Next Phase Readiness

- All 5 shared components exported from `@ziko/ui` and available for reuse in settings screen (plan 35-03)
- ProfileHero usable in public profile route `/(app)/profile/[userId].tsx` (plan 35-02)
- Tab content area scaffold ready for Stats/Progrès/Badges implementation in plan 35-02
- TypeScript compiles clean in both `packages/ui` and `apps/mobile` (0 errors)

## Self-Check: PASSED

- `packages/ui/src/components/STRow.tsx` — FOUND
- `packages/ui/src/components/STGroup.tsx` — FOUND
- `packages/ui/src/components/STToggle.tsx` — FOUND
- `packages/ui/src/components/PRStatCard.tsx` — FOUND
- `packages/ui/src/components/ProfileHero.tsx` — FOUND
- `apps/mobile/app/(app)/profile/index.tsx` — FOUND (rebuilt)
- Commits: 7ad77a1, de57e89, 4c8d250 — all present in git log

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
