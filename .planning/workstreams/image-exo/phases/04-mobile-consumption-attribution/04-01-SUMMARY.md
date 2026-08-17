---
phase: 04-mobile-consumption-attribution
plan: 01
subsystem: ui
tags: [react-native, expo-image, i18n, plugin-sdk, packages/ui, attribution]

# Dependency graph
requires:
  - phase: 01-schema-storage-foundation
    provides: "exercise-media Storage bucket + relative image/gif path columns"
  - phase: 03-merge-human-approved-write
    provides: "instructions_fr / instruction_steps JSONB populated for 1,318 matched exercises"
provides:
  - "Shared <AttributedMedia> component in @ziko/ui — structurally enforces 180x180 cap + Gym visual credit badge + neutral missing-media fallback"
  - "exercise.mediaUnavailable / exercise.instructionsEmptyTitle / exercise.instructionsEmptyBody i18n keys (fr+en) in @ziko/plugin-sdk"
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AttributedMedia clamps size via Math.min(size ?? 180, 180) — unconditional, no escape hatch"
    - "Badge mounts only when showBadge && uri are both true; fallback path never mounts the badge"
    - "Attribution credit text is a component default prop, not an i18n key (locked legal text, single source of truth)"

key-files:
  created:
    - packages/ui/src/components/AttributedMedia.tsx
  modified:
    - packages/ui/src/index.ts
    - packages/plugin-sdk/src/i18n.ts

key-decisions:
  - "Followed UI-SPEC.md locked pixel/color/copy values exactly — no reinterpretation"
  - "Hardcoded hex/rgba values in AttributedMedia (not theme.* lookups) per 04-PATTERNS.md, so legally-mandated attribution styling cannot drift if the theme palette changes"

patterns-established:
  - "New packages/ui shared components follow EmptyState.tsx's shape: props interface -> functional component -> named + default export, inline styles only"

requirements-completed: [MOBILE-03]

# Metrics
duration: ~16min
completed: 2026-08-17
---

# Phase 4 Plan 1: AttributedMedia Component & i18n Keys Summary

**Shared `<AttributedMedia>` component in `packages/ui` that structurally clamps display size to 180x180, renders the locked Gym visual credit badge only alongside real media, and falls back to a localized barbell placeholder when `uri` is null — plus the three FR/EN i18n keys the media/instructions surfaces depend on.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-08-17T18:08:34Z (approx, per STATE.md session marker)
- **Completed:** 2026-08-17T18:23:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `exercise.mediaUnavailable`, `exercise.instructionsEmptyTitle`, `exercise.instructionsEmptyBody` added to both `fr` and `en` dictionaries in `packages/plugin-sdk/src/i18n.ts`, resolving through the existing `t()` lookup with no code changes needed
- `AttributedMedia` component created in `packages/ui/src/components/AttributedMedia.tsx` and exported from `@ziko/ui`, satisfying the locked `AttributedMediaProps` interface from 04-UI-SPEC.md §2
- Size cap (`Math.min(size ?? 180, 180)`), attribution badge (`showBadge && uri`), and missing-media fallback (barbell-outline + localized caption, no badge) all verified structurally unconditional via grep-based acceptance criteria
- Both `packages/plugin-sdk` and `packages/ui` type-check clean (`npx tsc --noEmit`, 0 errors)
- No new npm dependency added — `expo-image` and `@expo/vector-icons` consumed via existing hoisting precedent (`ProfileHero.tsx`'s `expo-linear-gradient` import)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add exercise.mediaUnavailable / instructionsEmptyTitle / instructionsEmptyBody keys** - `3b24aab` (feat)
2. **Task 2: Create AttributedMedia component and export from @ziko/ui** - `710b5fa` (feat)

**Plan metadata:** pending final commit (see below)

## Files Created/Modified
- `packages/ui/src/components/AttributedMedia.tsx` - New shared component: size clamp, credit badge, missing-media fallback with barbell-outline icon + localized caption
- `packages/ui/src/index.ts` - Added `export { AttributedMedia } from './components/AttributedMedia';`
- `packages/plugin-sdk/src/i18n.ts` - Added 3 `exercise.*` keys to both `fr` and `en` dictionaries

## Decisions Made
- None beyond what 04-UI-SPEC.md and 04-PATTERNS.md already locked — plan executed exactly as specified, including the deliberate exclusion of the Gym visual credit string from i18n.ts (it lives only as `AttributedMedia`'s `credit` default prop, per the Copywriting Contract)

## Deviations from Plan

None - plan executed exactly as written. All grep-based and `tsc --noEmit` acceptance criteria passed on first implementation with no rework needed.

## Issues Encountered

**Worktree branch was stale relative to `dev`** — the worktree branch `worktree-agent-a694b320812730f3d` was created from a commit 154 commits behind `dev`, before any of the `image-exo` workstream's phase 1-4 planning docs and Phase 1-3 code (schema migrations, `scripts/exercise-import/`) had been committed. None of the required context files (`04-01-PLAN.md`, `04-CONTEXT.md`, `04-UI-SPEC.md`, `04-PATTERNS.md`, `STATE.md`) existed in the worktree. Resolved by running `git merge dev` on the worktree's own branch (non-protected, non-destructive — the worktree branch had only one commit not already reachable from `dev`, itself a prior merge of `dev`), which fast-forwarded in all missing planning docs and Phase 1-3 code with a clean merge and no conflicts. This is a setup-time issue for the orchestrator's worktree provisioning, not a plan-execution deviation.

## Next Phase Readiness

- `<AttributedMedia>` is import-ready as `import { AttributedMedia } from '@ziko/ui'` for Wave 2's detail-screen plan (04-02 or later)
- The three i18n keys are available via `t('exercise.mediaUnavailable')` etc. in both locales
- No blockers for downstream plans in this phase

---
*Phase: 04-mobile-consumption-attribution*
*Completed: 2026-08-17*
