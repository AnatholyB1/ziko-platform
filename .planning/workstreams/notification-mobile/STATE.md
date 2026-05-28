---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Notification System
current_plan: 06-01
status: Ready to execute
last_updated: "2026-05-28T00:00:00Z"
last_activity: 2026-05-28 — Phase 6 planned (4 plans in 2 waves)
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 19
  completed_plans: 15
  percent: 83
---

# Project State

## Current Position

Phase: 6 — Local Reminders & App Updates 📋 PLANNED (4 plans, 2 waves)
Plan: 06-01 (next to execute)
Status: Ready to execute Phase 6
Last activity: 2026-05-28 — Phase 6 planned (4 plans in 2 waves)

## Progress

**Phases Complete:** 5 / 6
**Current Plan:** N/A

```
[########  ] 83%
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

## Session Continuity

**Stopped At:** Phase 6 planning complete — verification passed
**Resume File:** .planning/workstreams/notification-mobile/phases/06-local-reminders-app-updates/
**Next Action:** `/gsd-execute-phase 6 --ws notification-mobile` — execute Wave 1 (06-01 + 06-04 in parallel)
