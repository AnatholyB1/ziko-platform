---
phase: 06-local-reminders-app-updates
plan: "03"
subsystem: mobile-notifications
tags: [local-notifications, workout-reminders, expo-notifications, notification-preferences, weekly-trigger]
dependency_graph:
  requires: [06-01]
  provides: [workout_reminder_section, workout_reminder_scheduling]
  affects: [notification_preferences.workout_reminder_days, notification_preferences.workout_reminder_time]
tech_stack:
  added: []
  patterns: [WEEKLY trigger scheduling, 600ms debounce UPSERT, cancel-by-data-tag, InlinePicker inline copy]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/workout/[id].tsx
decisions:
  - InlinePicker copied inline (not imported — unexported from settings.tsx)
  - expo-notifications imported directly (not via lazy N() guard — app shell, not plugin)
  - DAY_TO_EXPO_WEEKDAY explicit dict prevents off-by-one (sunday=1, monday=2, ..., saturday=7)
  - Cancel loop filters data.workoutReminder===true before each reschedule (T-06-07 mitigated)
  - Weekdays sourced exclusively from user chip selection — days_per_week ignored (D-04)
  - Time stored as 'HH:00' format (InlinePicker provides hour only, minutes always 00)
metrics:
  duration: "~25 minutes"
  completed: "2026-05-29T19:16:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 0
  files_modified: 1
---

# Phase 06 Plan 03: Workout Day Reminder Section Summary

## One-liner

workout/[id].tsx gets a "Rappels d'entraînement" card with toggle, Mon-Sun weekday chips, and time InlinePicker — prefs UPSERT to notification_preferences with 600ms debounce, changes cancel+reschedule WEEKLY trigger notifications tagged data.workoutReminder=true.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add workout reminder state + load prefs from notification_preferences | 76b75aa | apps/mobile/app/(app)/workout/[id].tsx |
| 2 | Add reminder section UI + UPSERT + WEEKLY scheduling | 76b75aa | apps/mobile/app/(app)/workout/[id].tsx |

## Task 3: Checkpoint (human-verify)

This plan ends at a `checkpoint:human-verify` — awaiting visual verification of the workout reminder UI and Supabase persistence.

## Deviations from Plan

**1. [Rule 3 - Info] Changes included in prior commit 76b75aa**
- **Found during:** Commit step
- **Issue:** The file workout/[id].tsx was already committed as part of commit 76b75aa (fix(05.1-04)) from a prior session. Our Edit tool modifications were picked up by that commit because git detected them.
- **Fix:** No fix needed — the code is correct and present in HEAD. The commit hash is 76b75aa.
- **Impact:** None — all plan criteria verified present in HEAD.

## Verification Results

All plan verification criteria passed:
- `grep -c "DAY_TO_EXPO_WEEKDAY"` → 2 (declaration + use in scheduleNotificationAsync loop)
- `grep -c "workoutReminder.*true|workoutReminder: true"` → 2 (cancel loop + content.data)
- `grep -c "SchedulableTriggerInputTypes.WEEKLY"` → 1
- `grep -c "workout_reminder_days"` → 4 (load SELECT + UPSERT + state decl + 2 places)
- TypeScript: no new errors in workout/[id].tsx

## Known Stubs

None — all data flows are wired:
- State loaded from notification_preferences on mount
- Weekday chip toggling updates state + triggers debounced UPSERT
- Time picker updates state + triggers debounced UPSERT
- UPSERT cancels existing reminders and reschedules WEEKLY triggers

## Threat Flags

None — security threats mitigated as planned:
- T-06-05: Array built from WEEKDAY_ORDER toggle — only valid lowercase day strings enter
- T-06-06: DAY_TO_EXPO_WEEKDAY explicit dict — no arithmetic derivation, undefined check skips unknown keys
- T-06-07: cancel-by-workoutReminder=true runs before every reschedule — no accumulation

## Self-Check: PASSED

- [x] `apps/mobile/app/(app)/workout/[id].tsx` modified and present in HEAD (76b75aa)
- [x] `workoutReminderDays`, `workoutReminderEnabled`, `workoutReminderTime`, `showReminderTimePicker` states declared
- [x] `InlinePicker` defined inline in the file
- [x] `WORKOUT_HOUR_ITEMS`, `WEEKDAY_ORDER`, `WEEKDAY_LABELS`, `DAY_TO_EXPO_WEEKDAY` constants declared
- [x] `saveWorkoutReminderPrefs` function cancels workoutReminder=true notifications and reschedules WEEKLY
- [x] `handleReminderChange` uses 600ms debounce ref
- [x] Reminder card UI with toggle + weekday chips + time row rendered in ScrollView
- [x] useEffect loads existing prefs from notification_preferences on mount
