---
phase: "05"
plan: "01"
subsystem: notification-mobile
tags: [notifications, preferences, supabase, mobile, data-layer]
dependency_graph:
  requires: []
  provides: [NotifSubScreen-data-layer]
  affects: [apps/mobile/app/(app)/profile/settings.tsx]
tech_stack:
  added: []
  patterns: [debounced-upsert, async-iife-effect, ignoreDuplicates-init-pattern]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx
decisions:
  - "Async IIFE inside useEffect instead of promise chain — fixes PromiseLike<void> TypeScript error (Supabase .then() returns PromiseLike, not native Promise, so .catch() is unavailable on the chained result)"
  - "ignoreDuplicates:true on mount UPSERT — ensures first-time users get default row without clobbering existing preferences"
  - "timezone_offset computed at call site via Math.round(-new Date().getTimezoneOffset()/60) — auto-detected, no user input needed"
metrics:
  duration: "8 minutes"
  completed: "2026-05-28"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 5 Plan 01: NotifSubScreen Data Layer Summary

**One-liner:** Rewired NotifSubScreen from `user_profiles.settings.notif_prefs` JSONB to `notification_preferences` table with UPSERT-defaults-then-SELECT mount pattern and 600ms debounced auto-save.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite NotifSubScreen state shape and mount logic | c55fbf6 | apps/mobile/app/(app)/profile/settings.tsx |

## What Was Built

The `NotifSubScreen` data layer was completely replaced:

1. **State shape** — replaced 9 unmapped keys (`sessionsReminder`, `hydration`, `streakAlert`, `coach`, `achievements`, `social`, `marketing`, `sound`, `haptics`) with 8 keys matching `notification_preferences` columns exactly: `push_enabled`, `coach_enabled`, `workout_enabled`, `gamification_enabled`, `health_enabled`, `system_enabled`, `quiet_hours_start`, `quiet_hours_end`.

2. **Mount effect** — async IIFE that: (a) UPSERTs defaults with `ignoreDuplicates: true` so first-visit users always have a row, (b) SELECTs the existing row and hydrates state. `timezone_offset` auto-detected via `Math.round(-new Date().getTimezoneOffset() / 60)`.

3. **`handleChange` helper** — accepts `Partial<typeof s>`, merges into full state, clears previous debounce timer, fires UPSERT after 600ms with full state + timezone_offset. No Save button; silent fire-and-forget.

4. **Picker visibility state** — `startPickerVisible` and `endPickerVisible` declared for Plan 02's quiet hours UI.

5. **JSX** — loading spinner unchanged; non-loading view keeps SafeAreaView + STHeader + ScrollView + notifDenied banner verbatim; content area has `{/* TODO Plan 02: master switch, category toggles, quiet hours */}` stub.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Async IIFE instead of promise chain**
- **Found during:** Task 1 verification (TypeScript compilation)
- **Issue:** The plan specified `.then().then().catch()` chaining. Supabase's `.upsert()` returns a `PostgrestFilterBuilder` whose `.then()` result is `PromiseLike<void>`, not a native `Promise<void>`. `PromiseLike` does not have a `.catch()` method, causing TS2339 error at L106.
- **Fix:** Converted the mount effect body to an `async` IIFE (`(async () => { try { ... } catch { ... } })()`) — semantically identical behaviour, TypeScript-clean, and follows the existing pattern used throughout the codebase.
- **Files modified:** apps/mobile/app/(app)/profile/settings.tsx
- **Commit:** c55fbf6

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `notification_preferences` appears ≥ 3 times | 3 (mount UPSERT, mount SELECT, save UPSERT) |
| `user_profiles` not inside NotifSubScreen | 0 occurrences |
| All 8 state keys present in useState | Confirmed |
| `ignoreDuplicates: true` appears exactly once | 1 |
| `onConflict: 'user_id'` appears twice | 2 |
| `Math.round(-new Date().getTimezoneOffset() / 60)` appears twice | 2 |
| `setTimeout` with delay 600 | 1 |
| `clearTimeout(saveRef.current)` before setTimeout | Confirmed |
| `startPickerVisible` and `endPickerVisible` declared | Confirmed |
| TypeScript compiles with no errors in settings.tsx | Passed |

## Known Stubs

- `{/* TODO Plan 02: master switch, category toggles, quiet hours */}` in the non-loading return — intentional; Plan 02 replaces this comment with the real UI groups.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All Supabase operations use user JWT with RLS policy `notification_preferences_own` (auth.uid() = user_id) as documented in the plan's threat model.

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/settings.tsx` — exists and modified
- Commit `c55fbf6` — confirmed in git log
