# Phase 6: Local Reminders & App Updates - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Schedule per-habit local reminders and workout-day reminders on-device via `scheduleNotificationAsync`, plus surface OTA update notifications as cards in the in-app notification center.

**In scope:**
- LOCAL-01: Per-habit daily reminder — user sets `reminder_time` in the habit create modal; `scheduleHabitReminder()` fires on save + on app start
- LOCAL-02: Workout-day reminders — user picks specific weekdays + reminder time from the workout program view; preferences stored in `notification_preferences`
- LOCAL-03: Automatic cancel/reschedule when reminder_time or program days change
- APP-01: OTA update card injected client-side into the notification center when `useUpdates()` detects a pending update; tapping calls `Updates.reloadAsync()`

**Not in scope:** server push for OTA updates, snooze actions, IANA timezone for workout reminders, writing OTA update rows to `notification_log`, per-program reminder config (reminder is per-user, not per-program).

</domain>

<decisions>
## Implementation Decisions

### Habit Reminder Entry Point (LOCAL-01)
- **D-01:** Reminder time is configured **inside the existing `showCreateModal`** in `HabitsPlugin.tsx`. No new screens or edit flows. The modal already handles habit create — add a time row there.
- **D-02:** UI component: **reuse the existing `InlinePicker`** from `settings.tsx` (the same component used for quiet hours in Phase 5). Show hour options as `"06h00"` … `"23h00"`. Zero new dependencies; consistent with Phase 5 pattern.
- **D-03:** Scheduling trigger: call `scheduleHabitReminder()` **on modal save** (when `reminder_time` is set or changed) and **on app start** via `schedulAllReminders()` after habits load. Call `cancelHabitReminder()` when `reminder_time` is cleared/removed. This covers both immediate effect and OS-cleared notification recovery.

### Workout Reminder Configuration (LOCAL-02)
- **D-04:** The source of "which days" is **user-chosen weekdays** via a weekday selector in the workout program view. `days_per_week` is ignored for scheduling — the user explicitly picks Mon/Wed/Fri etc.
- **D-05:** The workout reminder toggle + weekday picker + time picker live **in the workout program view** (`apps/mobile/app/(app)/workout/[id].tsx` or the active program card). Contextually placed — user is looking at their program when they configure reminders for it.
- **D-06:** Workout reminder preferences are stored in **`notification_preferences` via two new columns**: `workout_reminder_days` (e.g. `TEXT[]` or `JSONB` array of weekday strings like `["monday","wednesday","friday"]`) and `workout_reminder_time` (`TEXT`, `"HH:MM"` format). Requires a new migration (e.g. `055_workout_reminder_prefs.sql`). This keeps all notification preferences in a single table.

### LOCAL-03: Cancel/Reschedule Logic
- **D-07:** When `reminder_time` changes on an existing habit, `scheduleHabitReminder()` already calls `cancelHabitReminder()` internally before scheduling the new trigger — no extra logic needed.
- **D-08:** When workout reminder days change, cancel all notifications whose `data.workoutReminder = true` and reschedule with the new weekday set. Use the same `data`-tag pattern as habits.

### OTA Update Card (APP-01)
- **D-09:** OTA detection is **client-side only** — use `expo-updates` `useUpdates()` hook. When `isUpdateAvailable` is true, prepend a synthetic card to the notifications list in `notifications.tsx`. **Nothing is written to `notification_log`** — no DB involvement, no migration needed.
- **D-10:** Tapping the OTA card calls **`Updates.reloadAsync()`** immediately to apply the update. Card shows a `"Mettre à jour"` CTA button. The card disappears after reload (app restarts with the new bundle).
- **D-11:** The OTA card uses the existing `"system"` category visual style (or `"app"` type if the screen already distinguishes it). It is injected at the top of the list, above other notifications, so it's always visible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/notification-mobile/REQUIREMENTS.md` — Phase 6 requirements: LOCAL-01, LOCAL-02, LOCAL-03, APP-01
- `.planning/workstreams/notification-mobile/ROADMAP.md` — Phase 6 goal, success criteria, dependency on Phase 1

### Prior Phase Context (locked decisions)
- `.planning/workstreams/notification-mobile/phases/05-notification-preferences-ui/05-CONTEXT.md` — `notification_preferences` table schema, `InlinePicker` usage pattern, save/UPSERT pattern, `notification_preferences` columns already defined
- `.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/01-CONTEXT.md` — Android notification channel names, `useNotificationSetup` hook patterns, expo-notifications lazy-load guard

### Existing Code to Read Before Implementing
- `plugins/habits/src/notifications.ts` — **CRITICAL**: Full `scheduleHabitReminder()`, `cancelHabitReminder()`, `schedulAllReminders()` already implemented. Read before implementing LOCAL-01 — do NOT rewrite, only wire.
- `plugins/habits/src/store.ts` — `Habit` interface: `reminder_time: string | null; // 'HH:MM'` field already defined.
- `plugins/habits/src/screens/HabitsPlugin.tsx` — `showCreateModal` state + modal body. This is where the time picker row goes.
- `apps/mobile/app/(app)/workout/[id].tsx` — Workout program detail view where workout reminder UI goes. Contains `days_per_week` field.
- `apps/mobile/app/(app)/notifications.tsx` — Notification center where OTA update card is injected client-side. Contains `NFItem` component to reuse or replicate for the OTA card.
- `apps/mobile/app/(app)/profile/settings.tsx` — Contains `InlinePicker` component definition. Copy or import it for use in HabitsPlugin.tsx.
- `supabase/migrations/054_notification_schema.sql` — `notification_preferences` table schema: current columns. New migration adds `workout_reminder_days` + `workout_reminder_time`.

### Migration to Create
- New migration `055_workout_reminder_prefs.sql`: ADD COLUMN `workout_reminder_days JSONB DEFAULT '[]'` and `workout_reminder_time TEXT DEFAULT NULL` to `notification_preferences`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scheduleHabitReminder(habit, agentName)` — `plugins/habits/src/notifications.ts:49` — schedules daily trigger, cancels existing before rescheduling. Ready to wire.
- `cancelHabitReminder(habitId)` — `plugins/habits/src/notifications.ts:76` — scans all scheduled notifications by `data.habitId`, cancels matches.
- `schedulAllReminders(habits, agentName)` — `plugins/habits/src/notifications.ts:91` — bulk reschedule; call on app start after habits load.
- `InlinePicker` — `apps/mobile/app/(app)/profile/settings.tsx` (line ~164) — reusable for `reminder_time` and workout weekday selection. Props: `visible`, `items`, `selectedId`, `onSelect`, `onClose`, `theme`.
- `showCreateModal` state + `<Modal>` — `plugins/habits/src/screens/HabitsPlugin.tsx:554` — existing modal where D-01 time row is added.
- `NFItem` component — `apps/mobile/app/(app)/notifications.tsx` — notification card component to replicate/adapt for the OTA update card.

### Established Patterns
- **Lazy expo-notifications require** — `plugins/habits/src/notifications.ts:8-19` uses `N()` guard for Expo Go Android safety. Follow same pattern for any new scheduling code.
- **Supabase direct for mobile reads/writes** — No Hono hop. `supabase.from('notification_preferences')...`
- **600ms debounce UPSERT** — for notification_preferences changes (from Phase 5 pattern)
- **InlinePicker hour format** — `"06h00"` to `"23h00"` (24 items, same as quiet hours)
- **NativeWind / inline styles** — No StyleSheet. `style={{ ... }}` objects only.
- **`showAlert` from `@ziko/plugin-sdk`** — instead of `Alert.alert`.

### Integration Points
- `plugins/habits/src/screens/HabitsPlugin.tsx` — add `reminder_time` row + InlinePicker to the create modal (D-01). Wire `scheduleHabitReminder()` in the habit save handler.
- `apps/mobile/app/(app)/workout/[id].tsx` — add workout reminder section (toggle + weekday selector + time picker) (D-05). Write prefs to `notification_preferences` via Supabase direct.
- `apps/mobile/app/(app)/notifications.tsx` — inject OTA update card at top of list when `isUpdateAvailable` from `useUpdates()` (D-09).
- `apps/mobile/src/hooks/useNotificationSetup.ts` (or `_layout.tsx`) — call `schedulAllReminders()` on app start after habits are loaded (D-03 app-start trigger).

</code_context>

<specifics>
## Specific Ideas

- Habit reminder time format in InlinePicker: `"06h00"` through `"23h00"` — same format as quiet hours Phase 5
- Workout reminder days stored as JSON array of lowercase English weekday strings: `["monday", "wednesday", "friday"]`
- OTA card injected as first item in the FlatList, outside the normal data array — e.g., `ListHeaderComponent` or a boolean flag that renders the card above the list
- OTA card CTA label: `"Mettre à jour"` — consistent with French UI throughout
- `Updates.reloadAsync()` called directly on card tap (no confirm dialog)

</specifics>

<deferred>
## Deferred Ideas

- Snooze action on workout reminders (iOS/Android notification action button) — v1.12+
- Per-program reminder config (reminder tied to a specific program, not the user) — v1.12+
- Native binary update notification (App Store / Play Store link) — not applicable for OTA, out of scope

</deferred>

---

*Phase: 6-local-reminders-app-updates*
*Context gathered: 2026-05-28*
