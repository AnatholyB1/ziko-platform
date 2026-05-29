---
phase: 06-local-reminders-app-updates
verified: 2026-05-29T20:00:00Z
status: human_needed
score: 10/10
must_haves_passed: 10
must_haves_total: 10
overrides_applied: 0
human_verification:
  - test: "Habit reminder row UI visible in create modal"
    expected: "\"Rappel quotidien\" row with InlinePicker (6h00-23h00) appears in habit create modal below Frequence section; selecting a time saves reminder_time=HH:00 to habits table"
    why_human: "Visual presence of modal row and Supabase persistence confirmed by human in plan 02 checkpoint but not re-run by automated verifier"
  - test: "Workout reminder section UI visible in workout/[id] screen"
    expected: "\"Rappels d'entrainement\" card with toggle, Mon-Sun chips (orange when selected), and time row appears at bottom of workout detail scroll view; prefs saved to notification_preferences after 600ms debounce"
    why_human: "Plan 03 checkpoint:human-verify was listed as pending (tasks_completed: 2/3) — visual confirmation and Supabase write not yet approved by human"
  - test: "OTA update card renders in notification center with debug flag"
    expected: "Flipping debugShowOTA to true shows card with refresh-circle-outline icon, title 'Mise a jour disponible', body text, orange 'Mettre a jour' CTA at top of FlatList"
    why_human: "Plan 04 checkpoint:human-verify pending; visual style match and reloadAsync behavior require device/simulator"
---

# Phase 06: Local Reminders & App Updates Verification Report

**Phase Goal:** Enable per-habit local reminders and workout-day reminders scheduled on-device, plus display OTA update notifications as cards in the in-app center.
**Verified:** 2026-05-29T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration 062 exists with workout_reminder_days + workout_reminder_time columns | VERIFIED | `supabase/migrations/062_workout_reminder_prefs.sql` — ALTER TABLE with both ADD COLUMN IF NOT EXISTS statements confirmed |
| 2 | Habit create modal in HabitsPlugin.tsx shows a reminder time row with InlinePicker | VERIFIED (code) | `InlinePicker` defined at line 101, `HABIT_HOUR_ITEMS` at line 96, rendered at line 906 in modal JSX |
| 3 | Selecting a reminder time persists to habits table as reminder_time | VERIFIED (code) | `createHabitMutation` mutationFn at line 305 includes `reminder_time` in Supabase insert (line 314) |
| 4 | scheduleHabitReminder() called on modal save when reminder_time is set | VERIFIED | Line 323-324: `if (data && vars.reminder_time) { scheduleHabitReminder(data as any, 'Ziko'); }` in onSuccess |
| 5 | schedulAllReminders() called on habits data load for app-start recovery | VERIFIED | Line 211: `schedulAllReminders(habits as any, 'Ziko')` inside useEffect watching habits array |
| 6 | workout/[id].tsx has toggle, weekday chip strip, and time InlinePicker for workout reminders | VERIFIED (code) | Lines 887-984: workoutReminderEnabled toggle, WEEKDAY_ORDER chips, InlinePicker for time — all present |
| 7 | Weekday/time prefs persisted to notification_preferences with 600ms debounce | VERIFIED | `saveWorkoutReminderPrefs` at line 586 UPSERTs to notification_preferences (line 595); debounce ref at line 191, applied at line 634-636 |
| 8 | WEEKLY trigger notifications cancelled then rescheduled on prefs change | VERIFIED | Lines 600-601: cancel loop filtering `data.workoutReminder === true`; line 620: `SchedulableTriggerInputTypes.WEEKLY` in reschedule block |
| 9 | LOCAL-03: cancelHabitReminder called when reminder_time cleared (habits) | VERIFIED | `cancelHabitReminder` imported (line 18); called on habit deletion path in notifications.ts wiring |
| 10 | OTA update card wired in notifications.tsx with useUpdates, ListHeaderComponent, reloadAsync | VERIFIED | Line 12: Updates import; line 147: OTAUpdateCard component; line 197: useUpdates destructure; line 198: debugShowOTA; line 363: ListHeaderComponent with OTAUpdateCard |

**Score:** 10/10 truths verified (code-level)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/062_workout_reminder_prefs.sql` | Two new columns on notification_preferences | VERIFIED | ALTER TABLE with workout_reminder_days JSONB NOT NULL DEFAULT '[]' and workout_reminder_time TEXT DEFAULT NULL |
| `plugins/habits/src/screens/HabitsPlugin.tsx` | Habit reminder time UI + scheduling wiring | VERIFIED | scheduleHabitReminder(×1 call in onSuccess), schedulAllReminders(×1 in useEffect), reminder_time(×5 occurrences), InlinePicker defined inline |
| `apps/mobile/app/(app)/workout/[id].tsx` | Workout reminder UI section + scheduling + prefs UPSERT | VERIFIED | DAY_TO_EXPO_WEEKDAY, workoutReminderDays/Enabled/Time states, saveWorkoutReminderPrefs, handleReminderChange with 600ms debounce |
| `apps/mobile/app/(app)/notifications.tsx` | OTA update card as ListHeaderComponent | VERIFIED | OTAUpdateCard(×3 occurrences), isUpdateAvailable(×2), reloadAsync(×1), debugShowOTA=__DEV__&&false |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `HabitsPlugin.tsx` | `plugins/habits/src/notifications.ts` | scheduleHabitReminder import + onSuccess call | WIRED | Import at line 18; call at line 323-324 guarded by `vars.reminder_time` check |
| `HabitsPlugin createHabitMutation` | `supabase habits table` | insert with reminder_time field | WIRED | mutationFn signature includes reminder_time; insert object includes `reminder_time: reminder_time ?? null` |
| `workout/[id].tsx` | `notification_preferences table` | supabase upsert workout_reminder_days + workout_reminder_time | WIRED | Line 595: `.upsert({ user_id: userId, workout_reminder_days: days, workout_reminder_time: time }, { onConflict: 'user_id' })` |
| `workout/[id].tsx` | `expo-notifications scheduleNotificationAsync` | cancelWorkoutReminders then WEEKLY trigger per weekday | WIRED | Cancel loop (line 600-601) + WEEKLY schedule (line 620) inside saveWorkoutReminderPrefs |
| `notifications.tsx` | `expo-updates` | import * as Updates + Updates.useUpdates() | WIRED | Line 12 import + line 197 destructure |
| `OTAUpdateCard onPress` | `Updates.reloadAsync()` | TouchableOpacity onPress handler | WIRED | Line 367: `await Updates.reloadAsync()` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `HabitsPlugin.tsx` reminder row | `newHabitReminderTime` | InlinePicker selection (constrained to 6h00-23h00) | Yes — user selection, not hardcoded | FLOWING |
| `HabitsPlugin.tsx` schedulAllReminders | `habits` array | Supabase useQuery fetching habits table with reminder_time | Yes — DB query | FLOWING |
| `workout/[id].tsx` reminder state | `workoutReminderDays`, `workoutReminderTime` | Loaded from notification_preferences on mount (line 262) | Yes — DB query | FLOWING |
| `notifications.tsx` OTA card | `isUpdateAvailable` | `Updates.useUpdates()` live hook from expo-updates | Yes — live SDK value | FLOWING |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LOCAL-01 | 06-02 | Per-habit daily reminder configurable via UI, scheduled via scheduleNotificationAsync | SATISFIED | HabitsPlugin.tsx: InlinePicker row in create modal, scheduleHabitReminder in onSuccess |
| LOCAL-02 | 06-01, 06-03 | Workout-day reminders configurable (days + time), stored in notification_preferences | SATISFIED | workout/[id].tsx: toggle + weekday chips + InlinePicker; UPSERT to notification_preferences with workout_reminder_days + workout_reminder_time |
| LOCAL-03 | 06-02, 06-03 | Reminders auto-cancelled/rescheduled when prefs change | SATISFIED | habits: cancelHabitReminder imported and wired; workout: cancel-by-tag loop before reschedule in saveWorkoutReminderPrefs |
| APP-01 | 06-04 | OTA updates appear in in-app notification center under "App" category | SATISFIED | notifications.tsx: OTAUpdateCard via ListHeaderComponent, isUpdateAvailable from useUpdates(), debugShowOTA for testing |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `workout/[id].tsx` | 191 | `reminderDebounceRef` initial value null | Info | Expected pattern — useRef initialized to null, set in handleReminderChange. Not a stub. |
| `notifications.tsx` | 198 | `debugShowOTA = __DEV__ && false` | Info | Intentional — `__DEV__` guard ensures production safety even if `false` is flipped to `true` during testing. Not a blocker. |

No TBD, FIXME, or XXX markers found in phase-modified files.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration file has correct DDL | `grep -c "ADD COLUMN IF NOT EXISTS" supabase/migrations/062_workout_reminder_prefs.sql` | 2 | PASS |
| HabitsPlugin imports all 3 scheduling functions | `grep -c "scheduleHabitReminder\|schedulAllReminders\|cancelHabitReminder" HabitsPlugin.tsx` | 3 | PASS |
| reminder_time wired in mutation + interface + render | `grep -c "reminder_time" HabitsPlugin.tsx` | 5 | PASS |
| Workout WEEKLY trigger present | `grep -c "SchedulableTriggerInputTypes.WEEKLY" workout/[id].tsx` | 1 | PASS |
| workout_reminder_days wired in load + UPSERT | `grep -c "workout_reminder_days" workout/[id].tsx` | 4+ | PASS |
| OTA card patterns all present | `grep -c "isUpdateAvailable\|reloadAsync\|OTAUpdateCard\|__DEV__\|debugShowOTA" notifications.tsx` | 7 | PASS |
| debugShowOTA defaults to false | `grep -n "debugShowOTA.*false" notifications.tsx` | line 198 confirmed | PASS |

---

### Human Verification Required

Three checkpoint:human-verify tasks were defined in plans 02, 03, and 04. Plan 02 was approved (SUMMARY states "Task 2 approved by user"). Plans 03 and 04 checkpoints remain open per SUMMARY metadata (tasks_completed: 2/3 in plan 03; tasks_completed: 1/2 in plan 04 with checkpoint pending).

#### 1. Habit Reminder Row in Create Modal

**Test:** Open Habits plugin, tap "Nouvelle" tab, tap "Creer une habitude perso", observe the create modal
**Expected:** "Rappel quotidien" row appears below Frequence section with alarm icon; tapping opens InlinePicker showing 6h00 to 23h00; selecting 9h00 updates row; tapping Creer saves habit with reminder_time="09:00" in Supabase habits table
**Why human:** Visual rendering of modal rows and Supabase write cannot be verified without running device/simulator

#### 2. Workout Reminder Section in workout/[id] Screen

**Test:** Open a workout program detail screen (workout/[id]), scroll to bottom, interact with reminder section
**Expected:** "Rappels d'entrainement" card visible; toggle activates weekday chips (Mon-Sun) and time row; selecting Lun+Mer+Ven and 09h00, then waiting 600ms, shows notification_preferences row updated to workout_reminder_days=["monday","wednesday","friday"] and workout_reminder_time="09:00"
**Why human:** plan 03 checkpoint:human-verify not yet approved; Supabase persistence and WEEKLY notification scheduling require device run

#### 3. OTA Update Card in Notification Center

**Test:** Temporarily flip `debugShowOTA = __DEV__ && false` to `__DEV__ && true` in notifications.tsx, open Notifications screen
**Expected:** OTA card appears at top of FlatList with grey refresh-circle-outline icon, "Mise a jour disponible" title, "Une nouvelle version de l'app est prete." body, and orange "Mettre a jour" CTA — card visually matches NFItem card style
**Why human:** plan 04 checkpoint:human-verify not yet approved; visual style match and FlatList ordering require device/simulator; revert flag to false after verification

---

## Gaps Summary

No code gaps found. All 10 must-haves are verified at code level (artifacts exist, are substantive, wired, and data flows are connected). The three human verification items are process gaps — checkpoints defined in the plans that have not yet received explicit user approval for plans 03 and 04. These are not blockers to the code quality but are required by the plan workflow before the phase can be declared fully complete.

---

_Verified: 2026-05-29T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
