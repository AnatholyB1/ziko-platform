---
phase: "05"
plan: "02"
subsystem: notification-mobile
tags: [notifications, preferences, mobile, ui, inline-picker]
dependency_graph:
  requires: [NotifSubScreen-data-layer]
  provides: [NotifSubScreen-complete-ui]
  affects: [apps/mobile/app/(app)/profile/settings.tsx, packages/ui/src/components/STGroup.tsx]
tech_stack:
  added: []
  patterns: [conditional-section-render, opacity-pointer-events-disabled-state, inline-picker-modal]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx
    - packages/ui/src/components/STGroup.tsx
decisions:
  - "STGroup title prop made optional to support untitled master switch group — matches UI-SPEC D-04 (no title on master switch group)"
  - "HOUR_ITEMS array defined inside NotifSubScreen function body (not module-level) — avoids module-scope initialization issues"
  - "Quiet hours group uses conditional render {s.push_enabled && ...} not opacity — section fully hidden when master is OFF per UI-SPEC D-06"
metrics:
  duration: "6 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 5 Plan 02: NotifSubScreen Complete UI Summary

**One-liner:** Replaced NotifSubScreen JSX stub with master switch group, 5 category toggle rows (disabled state via opacity/pointerEvents), and conditional quiet hours section with two InlinePicker bottom sheets for hour selection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement master switch group and 5 category toggle groups | 3cefcf8 | apps/mobile/app/(app)/profile/settings.tsx, packages/ui/src/components/STGroup.tsx |
| 2 | Implement quiet hours pickers and remove TODO placeholder | ba1a1fc | apps/mobile/app/(app)/profile/settings.tsx |

## What Was Built

The `NotifSubScreen` visual layer was completely implemented:

1. **Master switch group** — Untitled `STGroup` with a single `STRow` for "Toutes les notifications" bound to `s.push_enabled`. Toggle calls `handleChange({ push_enabled: v })` for debounced auto-save.

2. **Category toggle group** — `STGroup title="Catégories"` with 5 rows: Coach (#FF5C1A), Workout (#E94B3C), Gamification (#E8A33A), Santé & Habitudes (#22C55E), App (#6B6963). Wrapped in a `View` with `opacity: s.push_enabled ? 1 : 0.4` and `pointerEvents={s.push_enabled ? 'auto' : 'none'}` — visually disabled and non-interactive when master switch is OFF.

3. **Quiet hours section** — `STGroup title="Heures silencieuses"` conditionally rendered only when `s.push_enabled === true`. Contains "De" row (start picker, moon-outline icon) and "À" row (end picker, sunny-outline icon). Right prop shows current value formatted as `"${hour}h00"`.

4. **InlinePicker modals** — Two `InlinePicker` instances placed after `</ScrollView>` inside `SafeAreaView`. Each uses `HOUR_ITEMS` (24 items: id = "0"–"23", label = "0h00"–"23h00"). Selection calls `handleChange` with `parseInt(id, 10)` and closes the picker. The `HOUR_ITEMS` const is defined inside the function body.

5. **TODO placeholder removed** — The `{/* TODO Plan 02: master switch, category toggles, quiet hours */}` comment is fully replaced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] STGroup `title` prop was required, blocking untitled master switch group**
- **Found during:** Task 1 verification (TypeScript compilation — TS2741)
- **Issue:** `packages/ui/src/components/STGroup.tsx` defined `title: string` (required). The UI-SPEC D-04 and plan explicitly specify no title on the master switch group.
- **Fix:** Changed `STGroupProps.title` from `string` to `string | undefined` (optional), wrapped the `<Text>` render in `{title !== undefined && (...)}` to suppress the title label when not provided.
- **Files modified:** packages/ui/src/components/STGroup.tsx
- **Commit:** 3cefcf8

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `notification_preferences` appears ≥ 3 times | 3 (mount UPSERT, mount SELECT, save UPSERT) |
| `Toutes les notifications` (master switch label) | 1 ✓ |
| `Catégories` (category group title) | 1 ✓ |
| `Heures silencieuses` (quiet hours group title) | 1 ✓ |
| `push_enabled` binding on master switch | 9 occurrences ✓ |
| `coach_enabled`, `health_enabled`, `system_enabled` bindings | 7 each ✓ |
| `ignoreDuplicates: true` present | 1 ✓ |
| `HOUR_ITEMS` defined inside function body with Array.from 24 items | 3 occurrences ✓ |
| `parseInt(id, 10)` appears twice | 2 ✓ |
| `startPickerVisible`/`endPickerVisible` as visible props | Confirmed ✓ |
| `setStartPickerVisible(false)` in onSelect and onClose | Confirmed ✓ |
| `setEndPickerVisible(false)` in onSelect and onClose | Confirmed ✓ |
| `TODO Plan 02` placeholder removed | Not found ✓ |
| TypeScript compiles without errors in settings.tsx | Passed ✓ |
| `user_profiles` not inside NotifSubScreen | 0 occurrences ✓ |

## Known Stubs

None — all UI groups are fully wired to `handleChange` and Supabase via the 600ms debounce from Plan 01.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The `parseInt(id, 10)` in InlinePicker handlers operates on a controlled array of string integers "0"–"23" (T-05-03: accepted). No injection surface.

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/settings.tsx` — exists and modified
- `packages/ui/src/components/STGroup.tsx` — exists and modified  
- Commit `3cefcf8` — confirmed in git log (Task 1)
- Commit `ba1a1fc` — confirmed in git log (Task 2)
