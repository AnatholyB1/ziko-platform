---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Notification System
status: planning
last_updated: "2026-05-27T00:00:00.000Z"
last_activity: 2026-05-27
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 2 — Action-triggered Push Notifications
Plan: —
Status: Context gathered — ready for planning
Last activity: 2026-05-27 — Phase 2 context discussion completed (4 areas)

## Progress

**Phases Complete:** 0 / 6
**Current Plan:** N/A

```
[          ] 0%
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

## Session Continuity

**Stopped At:** Phase 2 context gathered
**Resume File:** .planning/workstreams/notification-mobile/phases/02-action-triggered-push/02-CONTEXT.md
**Next Action:** `/gsd:plan-phase 2 notification-mobile` — Action-triggered Push Notifications
