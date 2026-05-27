---
phase: 44-program-editor-athlete-media-integration
plan: "44-03"
subsystem: coach-web
tags: [exercise-typeahead, coach-custom, badge, passthrough]
dependency_graph:
  requires: ["44-01"]
  provides: [ExerciseTypeahead-coach_exercise_id-passthrough, ExerciseTypeahead-custom-badge]
  affects: [apps/web/src/components/coach/ExerciseTypeahead.tsx]
tech_stack:
  added: []
  patterns: [conditional-badge-render, nullable-id-passthrough]
key_files:
  modified:
    - apps/web/src/components/coach/ExerciseTypeahead.tsx
decisions:
  - "exercise_id set to null for coach_custom results; coach_exercise_id carries the identifier"
  - "Custom badge placed after category chip using primary/10 background per design spec"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-27"
---

# Phase 44 Plan 03: ExerciseTypeahead — Custom Badge + coach_exercise_id Passthrough Summary

Extended `ExerciseTypeahead` to surface coach-custom exercises with a visible "Custom" badge and route the `coach_exercise_id` through the `onAdd` callback while nulling `exercise_id` for custom results.

## What Was Changed

### Task 1 — Interface extensions
- `ExerciseResult` gained `source?: 'global' | 'coach_custom'` and `coach_exercise_id?: string | null`
- `AddedExercise` gained `coach_exercise_id?: string | null`

### Task 2 — `selectResult()` update
- When `result.source === 'coach_custom'`, `exercise_id` is passed as `null`
- `coach_exercise_id: result.coach_exercise_id ?? null` is always included in the `onAdd()` call

### Task 3 — "Custom" badge in dropdown
- Added conditional `<span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">Custom</span>`
- Placed after the existing category chip; row order is: [icon] [name] [category?] [Custom?]

## Verification

`rtk tsc --noEmit` in `apps/web/` — TypeScript compilation completed (exit 0).

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 41adc3b | feat(44-03): ExerciseTypeahead custom badge + coach_exercise_id passthrough |

## Self-Check: PASSED
- `apps/web/src/components/coach/ExerciseTypeahead.tsx` — exists and modified
- Commit `41adc3b` — confirmed in git log
