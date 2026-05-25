---
phase: 35-profile-settings-redesign
plan: 02
subsystem: ui
tags: [react-native, tanstack-query, supabase, ionicons, profile, badges, gallery]

# Dependency graph
requires:
  - phase: 35-01
    provides: "PRStatCard, ProfileHero, profile/index.tsx scaffold with hero + tab bar"
provides:
  - "PRStatsTab: 2x2 stat grid (sessions/streak/prs/weeks) + PR récents card with real Supabase data"
  - "PRProgressTab: 2-column photo gallery from body_measurements + Ajouter dashed card"
  - "PRBadgesTab: 3-column badge grid with STATIC_BADGES fallback + 3 locked placeholders"
  - "useQuery(['measurements', userId]): body_measurements where photo_url IS NOT NULL, limit 4"
  - "useQuery(['badges', userId]): user_gamification.badges JSONB column, maybeSingle()"
  - "Extended useQuery(['profile', userId]) with streak (consecutive habit_logs days) and prs (session_sets is_pr count)"
affects: [35-03, public-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-local tab components (PRStatsTab/PRProgressTab/PRBadgesTab) — not exported, consumed only by ProfileScreen"
    - "Streak computed client-side: habit_logs deduplicated by date, iterated backward from today"
    - "PR rows: session_sets grouped by exercise_id in Map, sorted by max weight_kg, top 3"
    - "STATIC_BADGES fallback array: badges tab shows design-spec data when user_gamification.badges is empty"
    - "Gallery placeholder colors: GALLERY_COLORS array indexed modulo 4 for dark-brown tones"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/index.tsx

key-decisions:
  - "All three tab components written in the same file as ProfileScreen (not separate files) — reduces import complexity and matches plan spec"
  - "streak computed from habit_logs only (60-day window, consecutive days backward from today) — workout_sessions not included to avoid double counting"
  - "prs falls back to 0 if session_sets.is_pr column doesn't exist (prCountRes.error check)"
  - "PR rows use a Map keyed by exercise_id to get max weight per exercise, then take top 3 — delta always 0 per plan spec"
  - "STATIC_BADGES used when badgesData is empty or null — gives the badges tab meaningful content for all users"
  - "measurementsData and badgesData queries use enabled: !!userId, staleTime matching profile query"

requirements-completed: [PROF-02, PROF-03, PROF-05]

# Metrics
duration: 5min
completed: 2026-05-22
---

# Phase 35 Plan 02: Profile Tab Content — Stats, Progrès, Badges Summary

**Three profile tab components (PRStatsTab/PRProgressTab/PRBadgesTab) wired with real TanStack Query data from session_sets, habit_logs, body_measurements, and user_gamification — all stubs from plan 35-01 removed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-22T11:45:52Z
- **Completed:** 2026-05-22T11:50:44Z
- **Tasks:** 2 (executed atomically in one file write)
- **Files modified:** 1

## Accomplishments

- Extended `useQuery(['profile', userId])` queryFn to compute real `streak` (consecutive habit_logs days, 60-day window) and `prs` (session_sets is_pr count with fallback to 0 on column error)
- Added `useQuery(['measurements', userId])` querying `body_measurements` where `photo_url IS NOT NULL`, limit 4, ordered by `created_at DESC`
- Added `useQuery(['badges', userId])` querying `user_gamification.badges` JSONB column via `maybeSingle()`
- Created PRStatsTab with 4 PRStatCard tiles + PR récents card showing top 3 exercises by max weight with delta display
- Created PRProgressTab with 2-column gallery grid, fallback gradient colors, label pills, and always-visible "Ajouter" dashed card
- Created PRBadgesTab with 3-column earned badge grid (STATIC_BADGES fallback) + 3 locked placeholders with dashed borders

## Task Commits

1. **Tasks 1+2: PRStatsTab + PRProgressTab + PRBadgesTab (all three tabs + queries)** — `bc6aaee` (feat)

## Files Created/Modified

- `apps/mobile/app/(app)/profile/index.tsx` — Added PRStatsTab, PRProgressTab, PRBadgesTab file-local components; extended profile query; added measurements and badges queries; replaced empty View stub with real tab routing

## Decisions Made

- Tasks 1 and 2 executed in one atomic write since they both modify the same single file — committed together as one `feat(35-02)` commit
- STATIC_BADGES constant provides 6 design-spec badges as fallback, ensuring the Badges tab always shows meaningful content even before gamification data is populated
- Streak computed from habit_logs only (not workout_sessions) to avoid double-counting active days
- Delta for PR rows is always 0 per plan spec — complex delta computation deferred to a future plan

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All tab content stubs from plan 35-01 have been replaced with real implementations. The STATIC_BADGES constant is an intentional fallback (not a stub) — it displays when the user has no gamification data, per plan specification.

## Issues Encountered

None.

## Next Phase Readiness

- Profile screen fully functional with all 3 tabs and real data
- plan 35-03 (Settings screen) can reuse STRow/STGroup/STToggle from packages/ui (created in 35-01)
- TypeScript compiles clean in profile/index.tsx (pre-existing errors in unrelated files: ImportFileScreen.tsx L840, settings.tsx L45, chat.tsx L357 — out of scope per deviation rule scope boundary)

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/index.tsx` — FOUND (modified)
- Commit `bc6aaee` — verified present in git log
- PRStatsTab, PRProgressTab, PRBadgesTab — all 3 present (grep count: 9)
- measurements query present (grep count: 2)
- badges query present (grep count: 2)
- lock-closed-outline present (count: 1)
- Verrouillé present (count: 1)
- camera-outline present (count: 1)
- All 4 stat labels present: Séances totales, Jours d'affilée, PR battus, Semaines actives (count: 4)

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
