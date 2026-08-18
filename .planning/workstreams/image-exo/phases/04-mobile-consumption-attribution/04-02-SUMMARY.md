---
phase: 04-mobile-consumption-attribution
plan: 02
subsystem: ui
tags: [react-native, expo-image, tanstack-query, supabase-storage, exercise-picker]

# Dependency graph
requires:
  - phase: 03-merge-human-approved-write
    provides: "1,318 non-custom exercises rows with populated `image` (thumb.png relative Storage path)"
provides:
  - "ExercisePicker rows render a real 40x40 thumbnail (or neutral placeholder) sourced from the exercise-media bucket"
  - "ExercisePicker's exercises query moved onto a versioned cache key (['exercises', 'v2', 'picker'])"
affects: [04-01-hero-media-attribution, future-mobile-consumption-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Storage public URL derivation per-row inside a .map() callback, no cache-busting for immutable exercise-media assets"
    - "Uniform 40x40 rounded-square media slot (real thumbnail or bordered Ionicons placeholder) placed before an existing checkbox in a list row"

key-files:
  created: []
  modified:
    - apps/mobile/src/components/ExercisePicker.tsx

key-decisions:
  - "Followed D-06 exactly: list-row thumbnails render with no AttributedMedia wrapper and no attribution badge; the deliberate omission is documented in a source comment (grep -cF \"D-06\" returns 1)."
  - "No cache-busting query param on getPublicUrl() output — exercise-media assets are immutable, unlike the mutable avatars bucket precedent in avatar.tsx."

patterns-established:
  - "Media slot: happy path expo-image Image (contentFit=cover, 40x40, borderRadius 10) vs. fallback View (theme.background fill, theme.border 1px, centered barbell-outline Ionicons) — both flexShrink: 0 so long exercise names never compress the slot."

requirements-completed: [MOBILE-02, MOBILE-06]

# Metrics
duration: ~4min (task work; excludes context-gathering overhead from stale worktree branch)
completed: 2026-08-17
---

# Phase 04 Plan 02: ExercisePicker Thumbnails & Versioned Query Key Summary

**ExercisePicker list rows now show real 40x40 exercise thumbnails from the `exercise-media` Storage bucket (or a neutral barbell placeholder), fetched under a versioned TanStack Query cache key — no attribution badge per D-06.**

## Performance

- **Duration:** ~4 min (two atomic task commits, ~3 min apart)
- **Started:** 2026-08-17T20:20:00+02:00 (approx)
- **Completed:** 2026-08-17T20:23:44+02:00
- **Tasks:** 2/2 completed
- **Files modified:** 1

## Accomplishments
- `ExercisePicker.tsx`'s `useQuery` now selects `image` alongside the existing columns and reads from the versioned key `['exercises', 'v2', 'picker']`, replacing the old unversioned `['exercises-picker']` key entirely (MOBILE-06).
- Every row derives a `publicThumbUrl` via `supabase.storage.from('exercise-media').getPublicUrl(ex.image)` with no cache-busting suffix (asset is immutable).
- Every row renders a uniform 40x40 rounded-square slot as the first child before the checkbox: a real `expo-image` thumbnail when `publicThumbUrl` is truthy, or a bordered `barbell-outline` Ionicons placeholder on `theme.background` otherwise (D-08 uniform alignment).
- No `<AttributedMedia>` wrapper, no attribution badge, and no `gymvisual` string anywhere in the file — D-06 deliberately narrows attribution to the detail-screen hero only, and the omission is documented inline with a `D-06` source comment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch the image column under a versioned query key** - `24955f4` (feat)
2. **Task 2: Render the 40x40 thumbnail slot before the checkbox** - `4d15711` (feat)

**Plan metadata:** (this SUMMARY.md commit, made by the orchestrator after worktree merge — not committed by this executor)

## Files Created/Modified
- `apps/mobile/src/components/ExercisePicker.tsx` - Added `image` field to `ExerciseRow`, extended `select()`, bumped `queryKey` to `['exercises', 'v2', 'picker']`, derived per-row `publicThumbUrl`, added `expo-image` import, and rendered the 40x40 thumbnail/placeholder slot before the checkbox.

## Decisions Made
- No deviations from the plan's explicit instructions — implemented `select()`, `queryKey`, `publicThumbUrl` derivation, and the thumbnail/placeholder slot exactly as specified in `04-02-PLAN.md`'s `<action>` blocks.
- Added `flexShrink: 0` to the happy-path `Image` style (not just the fallback `View`) per the plan's explicit "Also set `flexShrink: 0` on the slot so long exercise names never squeeze it" instruction — applied consistently to both render paths.

## Deviations from Plan

None - plan executed exactly as written. `SearchOverlay.tsx` and `workoutStore.ts` were left untouched per the plan's explicit scope note (MOBILE-06 does not apply to either — confirmed via `git diff --name-only HEAD~2 HEAD` showing only `ExercisePicker.tsx`).

## Issues Encountered

**Stale worktree branch context:** This worktree's branch (`worktree-agent-a297c854627b0c740`) was forked from `dev` at commit `76bb6bd`, before the `image-exo` workstream planning files (PLAN.md, STATE.md, CONTEXT.md, UI-SPEC.md, PATTERNS.md) were added to `dev` at `c9df8ce`. None of the `<files_to_read>` paths existed in the worktree's own history. Resolved by reading each required planning file's content directly from the `dev` branch via `git show dev:<path>` into the scratchpad, without merging `dev` into the worktree branch — this kept the worktree branch's diff scoped to only the code change required by this plan (`ExercisePicker.tsx`), avoiding an unrelated bulk merge of planning docs into a code-only worktree commit history. No plan or CLAUDE.md file was modified as a result; this is a read-only workaround, not a deviation from the plan's code instructions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MOBILE-02 and MOBILE-06 are satisfied for `ExercisePicker.tsx`. Plan 04-01 (hero media + `<AttributedMedia>` + `[exerciseId].tsx` query-key bump + instructions wiring) is independent (`depends_on: []` in this plan's frontmatter, and per the phase note this plan explicitly does not import `AttributedMedia`) and can proceed/merge without conflict — the only shared file risk is none, since 04-01's target files (`[exerciseId].tsx`, `packages/ui/src/components/AttributedMedia.tsx`, `packages/plugin-sdk/src/i18n.ts`) are disjoint from this plan's `ExercisePicker.tsx`.
- No blockers.

## Self-Check: PASSED

- FOUND: apps/mobile/src/components/ExercisePicker.tsx
- FOUND: .planning/workstreams/image-exo/phases/04-mobile-consumption-attribution/04-02-SUMMARY.md
- FOUND: 24955f4 (Task 1 commit)
- FOUND: 4d15711 (Task 2 commit)
- FOUND: e90f6e6 (SUMMARY.md commit)

---
*Phase: 04-mobile-consumption-attribution*
*Completed: 2026-08-17*
