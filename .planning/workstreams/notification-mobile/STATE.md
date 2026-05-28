---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Notification System
status: in_progress
last_updated: "2026-05-28T00:00:00.000Z"
last_activity: 2026-05-28
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 7
  completed_plans: 5
  percent: 71
---

# Project State

## Current Position

Phase: 3 — In-app Notification Center
Plan: 03-02 complete
Status: Wave 2 partiel — 03-02 done, 03-03 remaining
Last activity: 2026-05-28 — 03-02 complete (deep-link navigation + useRouter)

## Progress

**Phases Complete:** 1 / 6
**Current Plan:** N/A

```
[##        ] 17%
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

## Session Continuity

**Stopped At:** Phase 3, Plan 02 complete
**Resume File:** .planning/workstreams/notification-mobile/phases/03-in-app-notification-center/03-03-PLAN.md
**Next Action:** Exécuter 03-03 (Wave 2 restant)
