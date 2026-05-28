# Phase 6: Local Reminders & App Updates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 6-local-reminders-app-updates
**Areas discussed:** Habit reminder entry point, Workout reminder scope, OTA update card delivery

---

## Habit Reminder Entry Point

### Q1: Where does reminder_time get configured?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the create modal (Recommended) | Add a time row to the existing showCreateModal — one modal handles it all | ✓ |
| Long-press → edit sheet | Each habit row gets a long-press or edit icon opening a settings sheet | |
| Both: create modal + edit | Reminder time in create modal + edit path for existing habits | |

**User's choice:** Inside the create modal
**Notes:** Simplest path, no new screens.

---

### Q2: Time picker component

| Option | Description | Selected |
|--------|-------------|----------|
| InlinePicker — same as quiet hours (Recommended) | Reuse existing InlinePicker from settings.tsx, zero new deps | ✓ |
| Native DateTimePicker | @react-native-community/datetimepicker, more native feel but new dep | |

**User's choice:** InlinePicker — same as quiet hours

---

### Q3: scheduleHabitReminder() trigger points

| Option | Description | Selected |
|--------|-------------|----------|
| On modal save + on app start (Recommended) | Schedule on save; schedulAllReminders() on app start for OS recovery | ✓ |
| On app start only | Only restore on launch; slower to take effect | |
| On modal save only | No recovery if OS clears notifications | |

**User's choice:** On modal save + on app start

---

## Workout Reminder Scope

### Q1: Source of "which days are workout days"

| Option | Description | Selected |
|--------|-------------|----------|
| User picks weekdays explicitly (Recommended) | User selects Mon/Wed/Fri etc. via weekday selector; days_per_week ignored | ✓ |
| Auto-spread from days_per_week | If 3 days → auto Mon/Wed/Fri | |
| Descope LOCAL-02 from this phase | Ship LOCAL-01 + APP-01 only, LOCAL-02 to v1.12+ | |

**User's choice:** User picks weekdays explicitly

---

### Q2: Where does the weekday picker + toggle live?

| Option | Description | Selected |
|--------|-------------|----------|
| In the workout program view (Recommended) | From workout/[id].tsx — contextually placed next to the program | ✓ |
| In Notification Preferences screen | Add to NotifSubScreen in settings.tsx alongside category toggles | |
| In the habits dashboard | Co-located with LOCAL-01 but odd UX | |

**User's choice:** In the workout program view

---

### Q3: Where are workout reminder preferences stored?

| Option | Description | Selected |
|--------|-------------|----------|
| notification_preferences JSONB column (Recommended) | Two new columns: workout_reminder_days + workout_reminder_time; single source of truth | ✓ |
| workout_programs table | reminder columns tied to a specific program; lost if program deleted | |
| MMKV / local only | No DB; simpler but lost on reinstall | |

**User's choice:** notification_preferences JSONB column

---

## OTA Update Card Delivery

### Q1: How does the OTA card appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side injection — no DB (Recommended) | useUpdates() hook; synthetic card prepended to list; zero server involvement | ✓ |
| Write to notification_log | INSERT row on update detected; persists but needs cleanup | |
| Banner only, not in center | Dismissible banner outside notification center; doesn't fulfill APP-01 | |

**User's choice:** Client-side injection — no DB

---

### Q2: OTA card action

| Option | Description | Selected |
|--------|-------------|----------|
| Apply update immediately (Recommended) | Tap calls Updates.reloadAsync(); "Mettre à jour" CTA | ✓ |
| Download then prompt | Two-step: fetchUpdateAsync → confirm → reloadAsync | |
| Link to App Store/Play Store | Opens store listing; irrelevant for OTA | |

**User's choice:** Apply update immediately

---

## Claude's Discretion

None — all areas had explicit user decisions.

## Deferred Ideas

- Snooze action on workout reminders (iOS/Android notification action buttons) — v1.12+
- Per-program reminder config (tied to a specific program, not user-level) — v1.12+
- Native binary update notification (App Store / Play Store link) — out of scope for OTA
