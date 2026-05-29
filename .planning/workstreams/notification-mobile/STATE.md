---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Notification System
current_plan: 3
status: checkpoint
last_updated: "2026-05-29T19:16:00Z"
last_activity: 2026-05-29 -- Phase 06 Plan 03 Tasks 1+2 complete; stopped at checkpoint:human-verify Task 3
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 19
  completed_plans: 17
  percent: 82
---

# Project State

## Current Position

Phase: 06 (local-reminders-app-updates) — EXECUTING
Plan: 3 of 4
Status: Stopped at checkpoint:human-verify (06-03 Task 3) — awaiting visual verification
Last activity: 2026-05-29 -- Phase 06 Plan 03 Tasks 1+2 complete (commit 76b75aa); checkpoint:human-verify reached

## Progress

**Phases Complete:** 5 / 6
**Current Plan:** 3

```
[##########] 82%
```

## Accumulated Context

### Key Decisions

- Expo Push Service as sole delivery layer (no firebase-admin, no OneSignal)
- Hono backend for push send; Supabase direct for in-app reads (matches coach page bypass pattern)
- notification_log as unified inbox + audit log; idempotency_key TEXT UNIQUE for deduplication
- Vercel Cron for three scheduled jobs (CRON_SECRET Bearer auth, follows supplements.ts pattern)
- device_id as stable client-generated UUID in MMKV; UPSERT on (user_id, device_id)
- Local notifications for reminders; server push for events
- PUSH-03/PUSH-04 triggered via Supabase DB webhook → Hono (not mobile-initiated)
- PUSH-03 2-min delay: waitUntil + setTimeout(120s); re-query active session before send
- PUSH-04 level-up detection: compare old_record.level vs record.level in webhook payload
- PUSH-01/02: fire-and-forget via waitUntil in existing Hono routes
- idempotencyKey pattern: {event}_{userId}_{entityId} — deduplication via notification_log UNIQUE

### Critical Watch-Outs (from research)

- app.json must add expo-notifications plugin + aps-environment + POST_NOTIFICATIONS before any EAS build
- Expo Go does not support real push in SDK 54 — Development Build required for all push testing
- iOS permission prompt is one-shot — custom pre-permission screen mandatory before requestPermissionsAsync()
- notificationService.ts must use Supabase admin client — RLS silently returns zero rows with user JWT
- getExpoPushTokenAsync() requires explicit projectId: 9b672c1a-10c4-4d66-882c-b9a08294650f

### Stack Notes

- expo-notifications, expo-device, expo-constants already installed (no new mobile packages)
- Only backend addition: expo-server-sdk ^6.1.0 in backend/api/
- Existing notifications.tsx has correct UI shell — wire real data in Phase 3

### Phase 2 Decisions (2026-05-27)

- PUSH-04 webhook targets `user_gamification` table (not `user_xp` — that table doesn't exist)
- `WEBHOOK_SECRET` added as new env var in Vercel + Supabase webhook header
- All four pushes proven end-to-end: Supabase/Hono → waitUntil → notificationService → Expo Push → device

### Phase 3 Decisions (2026-05-28)

- notifications.tsx was already migrated (no INITIAL_ITEMS) — only deep-link navigation (useRouter) was missing
- Supabase Realtime channel named `notifications_${userId}` (per-user, avoids stale subs on logout/login)
- AppState 'active' → syncUnreadCount(userId) — badge refreshes on foreground

### Phase 5 Decisions (2026-05-28)

- NotifSubScreen state shape: 8 keys matching notification_preferences columns exactly
- Mount sequence: async IIFE UPSERT (ignoreDuplicates=true) then SELECT to hydrate state
- handleChange: 600ms debounced full-state UPSERT with auto-detected timezone_offset
- STGroup.title made optional (was required string — blocked untitled master switch group per UI-SPEC)
- Supabase PromiseLike incompatibility: .then().catch() chain → async IIFE with try/catch (TS2339 fix)

### Phase 6 Decisions (2026-05-28)

- Migration 062 (not 055 — already taken twice) adds `workout_reminder_days JSONB DEFAULT '[]'` and `workout_reminder_time TEXT DEFAULT NULL` to `notification_preferences`
- HabitsPlugin.tsx has its own local `interface Habit` (missing reminder_time) — must extend + update INSERT
- InlinePicker is unexported from settings.tsx — must be copied inline into HabitsPlugin.tsx and workout/[id].tsx
- Expo WEEKLY weekday mapping: 1=Sunday, 2=Monday, …, 7=Saturday (explicit dict required to avoid off-by-one)
- schedulAllReminders() wired in HabitsPlugin.tsx useEffect (not global _layout.tsx — avoids plugin coupling)
- OTA card client-side only (useUpdates hook), no notification_log write, `__DEV__` guard on debug override

### Phase 6 Plan 02 Decisions (2026-05-29)

- InlinePicker copied inline in HabitsPlugin.tsx (not imported) — unexported component from settings.tsx
- HABIT_HOUR_ITEMS produces 18 items (id='6'..'23', label='6h00'..'23h00')
- scheduleHabitReminder called in createHabitMutation onSuccess (data available with habit id)
- schedulAllReminders wired in useEffect watching habits array for app-start recovery
- reminder_time uses 'HH:00' format constrained by InlinePicker (T-06-03 mitigated)

### Phase 6 Plan 03 Decisions (2026-05-29)

- InlinePicker copied inline in workout/[id].tsx (not imported — unexported from settings.tsx)
- expo-notifications imported directly as ExpoNotifications (not via lazy N() guard — app shell)
- DAY_TO_EXPO_WEEKDAY explicit dict: sunday:1, monday:2, ..., saturday:7 (T-06-06 mitigated)
- Cancel loop filters data.workoutReminder===true tags before each reschedule (T-06-07 mitigated)
- Weekdays sourced exclusively from user chip selection — days_per_week ignored (D-04)
- WORKOUT_HOUR_ITEMS: 18 items (id='6'..'23', label='6h00'..'23h00')

## Session Continuity

**Stopped At:** 06-03 Task 3 — checkpoint:human-verify reached after Tasks 1+2 complete
**Resume File:** .planning/workstreams/notification-mobile/phases/06-local-reminders-app-updates/06-03-SUMMARY.md
**Next Action:** Verify workout reminder UI in Expo dev server, then type "approved" to continue to 06-04
