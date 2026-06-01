# Research Summary v1.8 Notification System

**Project:** Ziko Platform Push Notifications + In-App Notification Center
**Domain:** Mobile fitness app (Expo SDK 54 + Hono on Vercel + Supabase)
**Researched:** 2026-05-25
**Confidence:** HIGH

---

## Executive Summary

The v1.8 Notification System is a well-scoped infrastructure addition. All three mobile packages needed are already installed (expo-notifications, expo-device, expo-constants) -- zero new mobile installs required. The missing pieces are: configuration (app.json plugin entry, FCM google-services.json, APNs entitlement), one backend package (expo-server-sdk), Supabase migration 022 for three tables, and the implementation layer. The existing notifications.tsx screen has the correct UI shell and needs real data wired via TanStack Query.

The recommended approach uses Expo Push Service as the sole delivery layer (routing to both APNs and FCM), with expo-server-sdk on Hono for batching and receipt polling. In-app reads go directly to Supabase (no Hono hop), matching the existing bypass pattern used in coach pages. A three-table schema (notification_tokens, notification_log, notification_preferences) with a UNIQUE idempotency key on notification_log provides full audit trail, deduplication, and inbox simultaneously.

The main risks are front-loaded in Phase 1: missing POST_NOTIFICATIONS in app.json (day-one Android blocker), no expo-notifications plugin entry (EAS build fails silently), Expo Go used for push testing (SDK 54 does not support real push in Expo Go), and the one-shot iOS permission prompt shown too early. These configuration mistakes are cheap to fix before any code is written but expensive to discover in a production build.

---

## Stack Additions

### Already installed (no action needed)

| Package | Version | Role |
|---------|---------|------|
| expo-notifications | ^0.32.16 | Token registration, permission, listeners, badge, local scheduling |
| expo-device | ~8.0.10 | isDevice check, real device required for Expo push tokens |
| expo-constants | ~18.0.13 | Read expoConfig.extra.eas.projectId for token fetch |

### What needs to be added

| Layer | Package | Version | Install location | Action |
|-------|---------|---------|-----------------|--------|
| Backend | expo-server-sdk | ^6.1.0 | backend/api/ | npm install expo-server-sdk |

**Zero new mobile packages.**

### Configuration additions (app.json)

Three items missing from app.json that are blockers for EAS builds:

1. expo-notifications plugin entry with icon (#FF5C1A), defaultChannel, enableBackgroundRemoteNotifications: true
2. iOS infoPlist.UIBackgroundModes: ["remote-notification", "fetch"]
3. Android POST_NOTIFICATIONS in permissions array + googleServicesFile: "./google-services.json"

### Supabase migration

Next migration: **022** (022_notification_schema.sql). Three tables:
- **notification_tokens** -- one row per (user_id, device_id), UPSERT target, is_active flag for dead-token cleanup
- **notification_log** -- source of truth for the inbox; idempotency_key TEXT UNIQUE prevents duplicate sends; status tracks pending/sent/delivered/failed; read_at drives unread count
- **notification_preferences** -- one row per user, master push_enabled switch, per-category booleans, type_prefs JSONB, quiet hours integers, timezone offset

All three tables have RLS enabled. Backend writes using admin client (bypasses RLS). Mobile reads notification_log and writes read_at directly (RLS protects via auth.uid() = user_id).

---

## Feature Table Stakes

| Feature | Notes |
|---------|-------|
| OS-level push permission with pre-permission screen | One-shot native prompt, must show custom screen first |
| Per-category notification toggles | 5 categories: Coach, Workout, Gamification, Health, App |
| Master push kill switch | Disables all push without touching individual prefs |
| In-app notification center | Already exists as static shell, wire real data |
| Read/unread state + mark-all-read | Already in shell UI, needs read_at column wired |
| Time grouping (Today / Earlier) | Already in shell |
| Category filter pills | Already in shell |
| Deep link on notification tap | data.url Expo Router path in push payload |
| App icon badge count | setBadgeCountAsync from expo-notifications |
| Quiet hours / Do Not Disturb | Server-side: suppress sends outside user window |
| Server-side notification persistence | notification_log is the inbox source of truth |

### High-value differentiators

| Feature | Trigger | Default |
|---------|---------|---------|
| Coach program assignment push | POST /coach/programs success | ON |
| Streak-at-risk notification | 21:00 cron if habit not logged + streak >= 3 days | ON |
| Post-session summary push | 2 min after workout_sessions INSERT | ON |
| Level-up / badge celebration | XP write path | ON |
| Invitation accepted (coach notification) | Invitation status change | ON |
| Smart habit reminder | User-configured time per habit (local) | OFF opt-in |
| Weekly XP digest (Sunday) | Weekly cron | OFF opt-in |
| Snooze action on workout reminders | iOS/Android notification action button | V2 |
| Supabase Realtime for live unread badge | WebSocket to notification_log | V2 |

### Anti-features to exclude from v1

- Guilt-framing copy, frame as opportunity instead
- Generic motivational push with no specific trigger
- Promotional/upsell push notifications (use in-app banners)
- All notifications ON by default (high denial rate on permission prompt)
- Notification settings buried more than 2 levels deep
- Push sent during active workout session

---

## Architecture Decisions

**Decision 1: Expo Push Service as sole delivery layer.** Do not add firebase-admin, direct APNs libraries, or third-party aggregators. expo-server-sdk on Hono is the only backend dependency.

**Decision 2: Hono backend for push send, Supabase direct for read.** Token registration goes through Hono. Push sends go through notificationService.ts. In-app reads use TanStack Query against Supabase directly, same bypass pattern as coach pages.

**Decision 3: notification_log as unified inbox + audit log.** idempotency_key TEXT UNIQUE is the deduplication gate. read_at drives unread count. status tracks the full delivery lifecycle (pending to sent to delivered or failed).

**Decision 4: Vercel Cron for three scheduled jobs** (follows existing supplements.ts/storage.ts pattern, CRON_SECRET Bearer auth):
- GET /notifications/cron/streak-at-risk, cron 0 21 * * * (daily 21:00 UTC)
- GET /notifications/cron/weekly-digest, cron 0 9 * * 0 (Sunday 09:00 UTC)
- GET /notifications/cron/check-receipts, every 15 min

**Decision 5: device_id as stable client-generated UUID in MMKV.** UPSERT keyed on (user_id, device_id) handles token rotation automatically.

**Decision 6: Local notifications for reminders, server push for events.** scheduleNotificationAsync for per-habit and workout reminders. Server-side push for coach actions, gamification, streak-at-risk.

### Major components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| notificationService.ts | backend/api/src/services/ | Core push dispatch: preference check, token fetch, Expo send, log write, receipt processing |
| routes/notifications.ts | backend/api/src/routes/ | Hono router for token registration, cron endpoints |
| useNotificationSetup.ts | apps/mobile/src/hooks/ | Permission request, token registration, push token listener, Android channel setup |
| useNotifications.ts | apps/mobile/src/hooks/ | TanStack Query for notification_log, mark-read mutations, badge count sync |
| notificationStore.ts | apps/mobile/src/stores/ | Zustand: unread count for tab badge and header icon |
| notification_tokens | Supabase | Multi-device token storage (UPSERT target) |
| notification_log | Supabase | Inbox source of truth + delivery audit |
| notification_preferences | Supabase | Per-user, per-category opt-in/out |

---

## Build Order

**Phase A -- Infrastructure (must be first; unblocks everything)**
app.json config, EAS credentials, Supabase migration 022, notificationService.ts, POST /notifications/token, useNotificationSetup.ts hook, root _layout.tsx wiring (handler + response listener + AppState badge sync), Android channel setup, Development Build for testing.
Why first: Nothing else is possible without tokens, the schema, and the send service. FCM credentials and POST_NOTIFICATIONS in app.json are zero-day blockers.

**Phase B -- Action-triggered pushes (depends on Phase A)**
Coach program assignment push, coach invitation push (both directions), post-session summary push (2-min deferred).
Why second: Highest business value, lowest complexity. Proves the end-to-end push pipeline before adding scheduled complexity.

**Phase C -- In-app notification center wired (depends on Phase A)**
useNotifications.ts hook, notificationStore.ts, replace static INITIAL_ITEMS in notifications.tsx with real TanStack Query data, category filter, mark-read, badge count via setBadgeCountAsync.
Why third: Phase A creates the data; Phase C shows it.

**Phase D -- Cron reminders (depends on Phase A + C)**
Streak-at-risk cron, receipt-check cron (dead token cleanup), weekly digest cron, vercel.json entries.
Why fourth: Requires notification_log and notificationService.ts from Phase A. Inbox visible before tuning cron output.

**Phase E -- Notification preferences UI (depends on Phase C)**
Preferences read/write hook, settings screen with section switches, type toggles, quiet hours picker, OS Settings CTA when permission denied, auto-save.
Why fifth: Users need real notifications arriving before preference management is urgent.

**Phase F -- Local reminders (independent after Phase A)**
Per-habit local reminder scheduling, workout day reminders.
Why last or parallel with E: Local-only, no server dependency. Lower priority than real push infrastructure.

---

## Critical Watch-Outs

Top 5 pitfalls that MUST be addressed in Phase 1:

**1. Missing expo-notifications plugin in app.json -- silent EAS build failure.**
Current app.json has no expo-notifications in the plugins array, no aps-environment entitlement, and no POST_NOTIFICATIONS in Android permissions. All three must be added before any EAS build.

**2. Expo Go does not support real push in SDK 54.**
Local notifications still work in Expo Go (false confidence). Real server-to-device push requires a Development Build. Must be in place before any push code is tested.

**3. iOS permission prompt is one-shot -- cold-prompting wastes it.**
Show a custom pre-permission screen before calling requestPermissionsAsync(). Track canAskAgain; if false, deep-link to OS Settings instead of re-prompting.

**4. Backend must use service role client for token queries -- user JWT fails silently under RLS.**
notificationService.ts queries notification_tokens server-side. RLS returns zero rows silently if the anon/user JWT is used. Use the Supabase admin client for all server-initiated token and log writes.

**5. getExpoPushTokenAsync() requires explicit projectId in SDK 53+.**
Hardcode projectId: 9b672c1a-10c4-4d66-882c-b9a08294650f. Do not rely on Constants.expoConfig?.extra?.eas?.projectId alone in production builds.

Bonus Phase 2 risk: Vercel synchronous bulk send will timeout. Never send more than ~50 tokens synchronously inside a Hono request. Use waitUntil from @vercel/functions or the notification_log queue pattern for large batches.

---

## Open Questions

| Question | When needed | Impact |
|----------|-------------|--------|
| Does the Firebase project for com.ziko.mobile already exist? | Phase A Day 1 | Blocks Android FCM setup. If not, create at console.firebase.google.com. |
| Is there an EAS development build profile in eas.json? | Phase A before push testing | Needed to create a Development Build. If missing, add profile before testing. |
| What is the Vercel plan tier (Hobby vs Pro)? | Phase D cron | Hobby: 60s timeout. Pro: 300s. Affects receipt-check batch size. |
| Should quiet hours use UTC offset or device timezone? | Phase E | Integer offset is acceptable for v1. |
| Is there an existing account deletion flow that needs cascade audit? | Phase A schema | Verify auth.admin.deleteUser() triggers ON DELETE CASCADE on notification_tokens. |
| Which exact Hono route files trigger coach-action pushes? | Phase B | Need to identify route files for program assignment and invitation flows. |
| Should the post-session push use setTimeout or a deferred cron entry? | Phase B | setTimeout acceptable for Hobby; cron queue safer for Pro tier. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against official Expo SDK 54 docs and npm registry. Zero ambiguity on what to install. |
| Features | HIGH | Official Expo docs + verified industry patterns. Category breakdown and default states are well-reasoned. |
| Architecture | HIGH | Data flows verified against official Expo SDK 54 docs, expo-server-sdk-node GitHub, and existing project patterns. |
| Pitfalls | HIGH | Each pitfall verified against official sources (Expo FAQ, CNIL GDPR, Vercel timeout docs). No speculative risks. |

**Overall confidence: HIGH**

### Gaps to Address

- **DST handling for quiet hours:** Integer UTC offset is imprecise during DST transitions. Acceptable for v1. Flag for v1.9 to upgrade to IANA timezone string.
- **Streak length SQL:** The streak-at-risk cron requires computing consecutive-day streaks from habit_logs. The exact SQL is not fully specified. Phase D plan must finalize this query.
- **Active workout suppression on server:** Server-side suppression would check workout_sessions for ended_at IS NULL, confirm feasibility during Phase B planning.

---

## Sources

### Primary (HIGH confidence)
- Expo Notifications API Reference (docs.expo.dev)
- Expo Push Notifications Setup Guide (docs.expo.dev)
- Expo Sending Notifications (docs.expo.dev)
- expo-server-sdk-node GitHub v6.1.0
- Expo Push Notifications FAQ (docs.expo.dev), SDK 54 Expo Go limitation confirmed
- FCM V1 Credentials Setup (docs.expo.dev/push-notifications/fcm-credentials/)
- Vercel Cron documentation

### Secondary (MEDIUM confidence)
- Supabase Push Notifications Guide
- Vercel Function Timeouts kb, Hobby 10s / Pro 300s
- CNIL GDPR Security Guide 2024
- Android Developer: Notification Runtime Permission
- Sashido: 5 Critical Expo Push Setup Mistakes

### Tertiary (LOW confidence)
- Badge count client-computes-own-count pattern, consistent across community examples but no single authoritative source

---

*Research completed: 2026-05-25*
*Ready for roadmap: yes*