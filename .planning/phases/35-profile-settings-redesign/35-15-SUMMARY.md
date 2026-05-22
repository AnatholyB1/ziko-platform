---
phase: 35-profile-settings-redesign
plan: 15
subsystem: ui
tags: [react-native, supabase, tanstack-query, privacy, profile]

# Dependency graph
requires:
  - phase: 35-profile-settings-redesign
    provides: "migration 051 adding user_profiles.is_public direct column"
provides:
  - "security.tsx reads/writes is_public from user_profiles direct column (not settings JSONB)"
  - "Profile/settings stack audit — no critical hardcodes remaining"
affects: [community, profile-visibility, profile-query-cache]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct column takes priority over JSONB fallback for migrated fields"
    - "useQueryClient.invalidateQueries after upsert to direct column to sync TanStack cache"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/security.tsx

key-decisions:
  - "is_public upserts to direct column; show_stats/show_activities stay in settings JSONB (no dedicated columns)"
  - "Soft migration: load uses (data as any)?.is_public ?? prefs?.is_public ?? true — column priority, JSONB fallback"
  - "Audit passed — no critical subscription_tier or is_public hardcodes in index.tsx or settings.tsx"
  - "STATIC_BADGES in index.tsx is dead code (defined but never rendered) — not a hardcode, not a blocker"

patterns-established:
  - "Direct column migration pattern: upsert dedicated path for new column, JSONB path for unmigrated fields"

requirements-completed: [PROF-03, SET-01]

# Metrics
duration: 15min
completed: 2026-05-22
---

# Phase 35 Plan 15: Security & Privacy Hardcode Audit Summary

**is_public toggle in security.tsx wired to direct user_profiles column via upsert + TanStack cache invalidation, audit confirms no critical hardcodes in profile/settings stack**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22T00:15:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- security.tsx now selects `settings, is_public` and reads is_public from the direct column (migration 051), with soft JSONB fallback for migration smoothness
- updatePrivacy splits is_public writes (direct column upsert + queryClient.invalidateQueries) from show_stats/show_activities writes (settings JSONB)
- Full audit of index.tsx, settings.tsx, security.tsx — no critical subscription_tier or is_public hardcodes found in JSX

## Task Commits

1. **Task 1: Wire is_public to direct column in security.tsx** - `bc9d784` (feat)
2. **Task 2: Audit profile/settings stack** - no file changes needed (audit passed clean)

## Files Created/Modified
- `apps/mobile/app/(app)/profile/security.tsx` - Added useQueryClient, select includes is_public column, updatePrivacy splits is_public path from JSONB path

## Decisions Made
- Soft migration pattern: `(data as any)?.is_public ?? prefs?.is_public ?? true` — direct column wins, JSONB privacy settings remain as fallback for users who set privacy before migration 051
- show_stats and show_activities stay in settings JSONB — they have no dedicated columns; no change needed
- queryClient.invalidateQueries with queryKey `['profile', userId]` ensures profile screen reflects updated visibility immediately after toggle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error on `useRef<ReturnType<typeof setTimeout>>()` in security.tsx (line 62) and settings.tsx (line 46) — both existed before this plan and were not introduced by plan 35-15. The error is identical in both files and pre-dates this wave.

## Known Stubs

None — no stubs introduced in this plan.

## Audit Results

| File | subscription_tier | is_public | STATIC_BADGES |
|------|-------------------|-----------|---------------|
| index.tsx | Not present in JSX | Not present in JSX | Defined but unused (dead code) |
| settings.tsx | Read from `profile?.subscription_tier ?? 'free'` (authStore) | N/A | N/A |
| security.tsx | N/A | Now reads from direct column, upserts to direct column | N/A |
| referral.tsx | Not touched (stub intentional) | N/A | N/A |
| help.tsx | Not touched (stub intentional) | N/A | N/A |

## Next Phase Readiness
- Profile visibility toggle is now authoritative — community/API queries on `user_profiles.is_public` will reflect user preference
- Profile/settings stack is clean — no critical hardcodes remain in the rendered JSX
- referral.tsx and help.tsx remain intentional stubs pending future feature plans

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
