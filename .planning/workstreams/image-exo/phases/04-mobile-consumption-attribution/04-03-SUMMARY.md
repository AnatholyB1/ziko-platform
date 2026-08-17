---
phase: 04-mobile-consumption-attribution
plan: 03
subsystem: ui
tags: [react-native, expo-image, tanstack-query, supabase-storage, i18n, attribution]

# Dependency graph
requires:
  - phase: 04-mobile-consumption-attribution (plan 01)
    provides: "Shared <AttributedMedia> component in @ziko/ui + exercise.mediaUnavailable/instructionsEmptyTitle/instructionsEmptyBody i18n keys"
  - phase: 03-merge-human-approved-write
    provides: "gif/image/instructions_fr/instruction_steps populated in production for 1,318 matched exercises"
provides:
  - "Exercise detail hero (`[exerciseId].tsx`) renders the real animated GIF via AttributedMedia in a full-width square card, single Gym visual badge instance"
  - "Consignes tab sourced directly from instruction_steps JSONB with locale selection, legacy-prose fallback for is_custom rows, and EmptyState for fully-empty rows"
  - "Exercise detail query key versioned to ['exercises', 'v2', exerciseId]"
  - "WSHeader title localized via tExercise(name, name_fr)"
affects: [04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AttributedMedia consumed with no size prop — relies on its own 180 default, never upscaled to fill the card"
    - "Legacy-prose fallback (instructions/instructions_fr TEXT) renders only when instruction_steps is empty — serves is_custom rows with no structured steps"
    - "Three-state Consignes tab branching: steps.length > 0 -> numbered list, else non-empty legacy text -> plain paragraph, else -> EmptyState"

key-files:
  created: []
  modified:
    - "apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx"

key-decisions:
  - "Followed 04-UI-SPEC.md's locked interpretation: hero CARD is full-width square (D-01), MEDIA inside renders at AttributedMedia's native 180x180 default, centered — no size prop passed, no upscaling"
  - "Legacy instructions/instructions_fr TEXT columns render as a single unstructured paragraph (no numbering/parsing) when instruction_steps is empty but legacy prose exists — resolves 04-CONTEXT.md's open discretion item without reintroducing JSON.parse/split fragility; this branch exists solely for is_custom=true rows since all 1,318 non-custom rows have instruction_steps populated"
  - "Split the single-file diff into two atomic task commits (hero/query-key vs instructions/i18n) despite interleaved import lines, by temporarily reverting Task 2's edits, committing Task 1, then reapplying and committing Task 2"

patterns-established:
  - "Detail-screen media hero consumes AttributedMedia unconditionally (uri only, no size override) inside a card matching the existing stat-tile shadow/border convention"

requirements-completed: [MOBILE-01, MOBILE-04, MOBILE-05, MOBILE-06]

# Metrics
duration: ~35min
completed: 2026-08-17
---

# Phase 4 Plan 3: Exercise Detail Hero & Instructions Consumption Summary

**Exercise detail screen now renders the real attributed GIF hero via `<AttributedMedia>` and sources the Consignes tab directly from `instruction_steps` JSONB, replacing the fake `Démo · 0:42` video chrome and the fragile `JSON.parse`/`.split('\n')` instructions chain.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Deleted the 16:9 fake video placeholder (diagonal overlay, play button, `Démo · 0:42` badge, `HD` badge) and replaced it with a full-width square card matching the stat-tile shadow/border convention, containing exactly one `<AttributedMedia uri={publicGifUrl} showBadge />` instance
- `publicGifUrl` derived from `supabase.storage.from('exercise-media').getPublicUrl(exercise.gif)` — uses the animated `gif` column (never `image`/`thumb.png`), no cache-busting (immutable Storage asset)
- Exercise detail query key bumped from `['exercise', exerciseId]` to `['exercises', 'v2', exerciseId]` (MOBILE-06)
- Consignes tab now reads `instruction_steps[locale] ?? instruction_steps.en` directly (no `JSON.parse`, no `.split('\n')`, no `try`/`catch`) — zero parsing code remains in the file
- Added a legacy-prose fallback branch (plain paragraph, `instructions_fr`/`instructions` verbatim) for rows with no `instruction_steps` but existing free text — serves `is_custom = true` exercises exclusively, since all 1,318 non-custom production rows already have `instruction_steps`
- Added `EmptyState` (variant `'no-data'`) for the fully-empty case, using the `exercise.instructionsEmptyTitle`/`exercise.instructionsEmptyBody` i18n keys from plan 04-01
- Header title localized via `tExercise(exercise.name, exercise.name_fr)`, falling back to `'Exercice'` when `exercise` is absent
- `npx tsc --noEmit` confirms zero errors in `[exerciseId].tsx`; total error count unchanged at 6 (pre-existing baseline in `settings.tsx`/`useNotificationSetup.ts`)
- All grep-based acceptance criteria from both tasks pass exactly as specified

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the fake 16:9 video placeholder with the real attributed square GIF hero** - `438344c` (feat)
2. **Task 2: Source the Consignes tab from instruction_steps and localize the exercise name** - `81b73e9` (feat)

**Plan metadata:** pending final commit (see below)

## Files Created/Modified
- `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` - Hero block replaced with attributed square GIF card; query key versioned; instructions sourced from `instruction_steps` JSONB with legacy-prose and empty-state fallbacks; header title localized

## Decisions Made
- Followed 04-UI-SPEC.md's locked resolution of its one internal tension: the hero CARD is full-width square (honest to the design convention and D-01), while the MEDIA renders at `AttributedMedia`'s native 180x180 default (no `size` prop passed) — never upscaled
- Legacy `instructions`/`instructions_fr` TEXT fallback renders as an unstructured single paragraph, resolving 04-CONTEXT.md's open "Claude's Discretion" item on the safest non-regressive behavior for rows without `instruction_steps`
- Because Task 1 and Task 2 both touch the same import block in one file, committed them as two atomic commits by temporarily reverting Task 2's edits, committing Task 1's isolated diff, then reapplying and committing Task 2's diff — preserves the plan's one-commit-per-task requirement despite the interleaved single-file diff

## Deviations from Plan

None - plan executed exactly as written. Both tasks' full grep-based acceptance criteria and the `npx tsc --noEmit` baseline check passed on first implementation with no rework needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `[exerciseId].tsx` now fully consumes the media and structured-instructions data delivered by Phase 3, satisfying MOBILE-01, MOBILE-04, MOBILE-05, and MOBILE-06 for this screen
- Screen-level attribution (MOBILE-03) is satisfied here via the single `AttributedMedia` instance on the hero, consistent with plan 04-01's component contract and D-05
- No blockers for 04-04 (`ExercisePicker` thumbnails / remaining phase scope)

---
*Phase: 04-mobile-consumption-attribution*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx`
- FOUND commit `438344c` (Task 1: hero replacement + query key)
- FOUND commit `81b73e9` (Task 2: instructions + localized header)
