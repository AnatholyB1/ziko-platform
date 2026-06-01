---
phase: 06
status: issues-found
critical: 1
warning: 3
info: 2
---
# Code Review: Phase 06

## Summary

Four files reviewed: one SQL migration, two React Native screens (habits plugin and workout detail), and the notifications screen. The migration is clean. The main concerns are: a silent data-loss race in the workout reminder debounce (timer not cleared on unmount), an unvalidated `reminder_time` format written to the DB that can break notification scheduling, a mixed-language notification body (French title, English body), and a typo in the exported function name.

## Findings

[severity: critical] `apps/mobile/app/(app)/workout/[id].tsx:634-638` — `reminderDebounceRef` is never cleared on unmount. If the user navigates away within the 600 ms window, the debounced `saveWorkoutReminderPrefs` fires on an unmounted component and can write stale/empty state (e.g. `days=[]`, `time=null`) to `notification_preferences`, silently erasing the user's reminder config. Add a `useEffect` cleanup: `return () => { if (reminderDebounceRef.current) clearTimeout(reminderDebounceRef.current); }`.

[severity: warning] `apps/mobile/app/(app)/workout/[id].tsx:607-609` — `time.split(':').map(Number)` is used without validating that `time` matches `HH:MM`. If the DB or a future code path stores a malformed string (e.g. `"9"` without the colon), `parts[1]` is `undefined`, coerced to `NaN`, and `ExpoNotifications.scheduleNotificationAsync` receives `minute: NaN`, which throws or silently skips every notification. Validate the format before use (e.g. `/^\d{2}:\d{2}$/`).

[severity: warning] `apps/mobile/app/(app)/workout/[id].tsx:614-615` — Notification body is mixed French/English: title is `"Séance du jour 💪"` (French) but body is `"C'est ton jour d'entraînement — let's go!"` (French/English hybrid). This is cosmetically inconsistent but also a UX defect because the app is presented as French-first. Body should be fully French or use a translation key.

[severity: warning] `plugins/habits/src/notifications.ts:91` — Exported function is named `schedulAllReminders` (missing 'e'). The import in `HabitsPlugin.tsx` line 18 mirrors the typo (`schedulAllReminders`), so it works today, but any future caller reading the export list will not find `scheduleAllReminders` and the typo will spread. Rename to `scheduleAllReminders` in both files.

[severity: info] `plugins/habits/src/screens/HabitsPlugin.tsx:211` — `schedulAllReminders(habits as any, 'Ziko')` is called inside a `useEffect` that runs every time `habits` changes, including on every remote re-fetch. This reschedules every habit reminder on each data refresh, potentially creating duplicate system notifications if `cancelHabitReminder` inside `scheduleHabitReminder` misses existing entries (e.g. if `habitId` data field is absent). Low risk given the cancel-before-schedule pattern in `notifications.ts`, but the effect has no dependency guard (e.g. a ref tracking the last scheduled set). Worth auditing for notification duplication under frequent re-fetches.

[severity: info] `apps/mobile/app/(app)/notifications.tsx:197` — `Updates.useUpdates()` is called unconditionally. In a bare-workflow or custom dev client without OTA configured, this hook can throw. It is currently safe because the call is inside a try-free hook that expo-updates guards internally, but the pattern is fragile; wrapping in a try/catch or a `Constants.expoConfig?.updates` guard would make intent explicit.
