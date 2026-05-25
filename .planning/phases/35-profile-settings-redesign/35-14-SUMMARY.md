---
phase: 35-profile-settings-redesign
plan: 14
subsystem: mobile-profile
tags: [badges, supabase, tanstack-query, rpc]
dependency_graph:
  requires: [35-12]
  provides: [real-badge-display]
  affects: [apps/mobile/app/(app)/profile/index.tsx]
tech_stack:
  added: []
  patterns: [tanstack-query-dual-parallel, fire-and-forget-rpc]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/index.tsx
decisions:
  - "BadgeItem type added above design tokens for reuse within file"
  - "queryClient added to ProfileScreen (was only in PRProgressTab before)"
  - "Unearned badge uses lock-closed-outline Ionicons + opacity 0.4 on the card wrapper"
  - "Tier tint map: tier 1 = bronze #E8A33A, tier 2 = silver #9CA3AF, tier 3 = gold #FFD700"
metrics:
  duration: "8 minutes"
  completed: "2026-05-22"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
requirements: [PROF-05]
---

# Phase 35 Plan 14: Badges Real Data Wiring Summary

Connect `PRBadgesTab` to the real `user_badges` + `badge_definitions` tables (migration 051), replacing the placeholder `user_gamification.badges` query with a dual Supabase query and fire-and-forget `check_and_award_badges` RPC.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace badges query + update PRBadgesTab | e8f508b | apps/mobile/app/(app)/profile/index.tsx |

## What Was Built

- **`BadgeItem` type** added with `slug`, `name`, `icon` (emoji), `tier`, `earned`, `earned_at` fields
- **Dual parallel query** (`queryKey: ['badges', userId]`): `badge_definitions` (all definitions) + `user_badges` (earned entries) via `Promise.all`
- **Sorting**: earned badges first, then by tier DESC
- **`PRBadgesTab`** rewritten with `BadgeItem[]` prop — earned badges in full color with emoji icon, unearned at opacity 0.4 with lock icon
- **Header** shows dynamic `{earnedBadges.length} obtenus · {unearnedBadges.length} à débloquer`
- **Tier tint colors**: tier 1 = `#E8A33A` (bronze), tier 2 = `#9CA3AF` (silver), tier 3 = `#FFD700` (gold)
- **`check_and_award_badges(userId)` RPC** called fire-and-forget in `useEffect` keyed on `sessionCount + userId`, then invalidates `['badges', userId]` cache

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] queryClient not in scope in ProfileScreen**
- **Found during:** TypeScript check after initial implementation
- **Issue:** `queryClient` was only declared in `PRProgressTab`, not in `ProfileScreen` where the `useEffect` with `check_and_award_badges` lives
- **Fix:** Added `const queryClient = useQueryClient()` to `ProfileScreen` function body
- **Files modified:** apps/mobile/app/(app)/profile/index.tsx
- **Commit:** e8f508b

## Known Stubs

None — all 11 badges from `badge_definitions` are queried and displayed (earned in color, unearned greyed).

## Threat Flags

No new threat surface introduced. Mitigations T-35-14-01 (RLS on user_badges) and T-35-14-03 (SECURITY DEFINER RPC) are handled at DB level by migration 051.

## Self-Check: PASSED

- `user_badges` present in index.tsx: 2 occurrences
- `badge_definitions` present in index.tsx: 2 occurrences
- `check_and_award_badges` present in index.tsx: 2 occurrences
- `user_gamification.*badges` removed: 0 occurrences
- TypeScript errors in profile/index.tsx: 0
- Commit e8f508b exists and staged only profile/index.tsx
