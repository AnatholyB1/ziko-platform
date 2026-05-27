# Roadmap: v1.11 Notification System

**Workstream:** notification-mobile
**Milestone:** v1.11 Notification System
**Branch:** per phase
**Phase numbering:** starts at 1 (new workstream)

## Overview

The v1.11 Notification System delivers end-to-end push and in-app notifications for the Ziko mobile app. It is structured in 6 phases that move from infrastructure (tokens, schema, send service) to action-triggered push events, in-app inbox, scheduled cron reminders, user preferences, and local device reminders. Every phase builds on the token infrastructure established in Phase 1.

---

## Phases

- [x] **Phase 1: Infrastructure & Configuration** — Establish the push token pipeline, Supabase schema, and backend send service so all subsequent phases have a working delivery foundation
- [ ] **Phase 2: Action-triggered Push Notifications** — Wire the highest-value server-side push events (program assignment, invitations, post-session summary, level-up) to prove the end-to-end pipeline
- [ ] **Phase 3: In-app Notification Center** — Replace mock data in the existing notification center shell with real TanStack Query data, mark-read, badge count, deep links, and Supabase Realtime
- [ ] **Phase 4: Cron / Scheduled Notifications** — Add three Vercel cron jobs: streak-at-risk daily alert, receipt polling for dead-token cleanup, and opt-in weekly digest
- [ ] **Phase 5: Notification Preferences UI** — Expose master switch, per-category toggles, quiet hours, and OS Settings deep-link in a Paramètres > Notifications screen with auto-save
- [ ] **Phase 6: Local Reminders & App Updates** — Schedule per-habit local reminders and workout-day reminders via `scheduleNotificationAsync`, plus OTA update card in the in-app center

---

## Phase Details

### Phase 1: Infrastructure & Configuration
**Goal:** Establish the push token pipeline, Supabase schema, and Hono send service so every subsequent phase has tokens to target and a delivery mechanism to call.
**Depends on:** none
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04
**Success Criteria** (what must be TRUE):
  1. User sees a custom pre-permission screen before the native OS prompt and can grant or skip — the native prompt is never shown cold
  2. After granting permission, the device push token is silently registered (or updated) in `notification_tokens` on every app start without user action
  3. If the iOS permission was permanently denied, the app does not re-prompt; a CTA in Settings deep-links to OS system preferences instead
  4. A Development Build is available on a real device and a test push sent via `notificationService.ts` arrives on that device end-to-end
  5. Migration 054 is applied: `notification_tokens`, `notification_log`, and `notification_preferences` tables exist with RLS and ON DELETE CASCADE
**Plans:** 4 plans
Plans:
- [x] 01-01-PLAN.md — Migration 054 + notificationService.ts + Hono /notifications router
- [x] 01-02-PLAN.md — app.json: expo-notifications plugin, iOS UIBackgroundModes, Android POST_NOTIFICATIONS + googleServicesFile
- [x] 01-03-PLAN.md — useNotificationSetup hook + NotificationPermissionModal + _layout.tsx wiring
- [x] 01-04-PLAN.md — EAS Development Build + end-to-end smoke test (manual)
**UI hint:** yes

### Phase 2: Action-triggered Push Notifications
**Goal:** Deliver server-side push notifications for the four highest-value business events, proving the full Hono → Expo Push Service → device pipeline.
**Depends on:** Phase 1
**Requirements:** PUSH-01, PUSH-02, PUSH-03, PUSH-04
**Success Criteria** (what must be TRUE):
  1. When a coach assigns a program, the athlete receives a push notification on their device within seconds
  2. When an invitation is accepted, both the athlete and the coach each receive a push notification
  3. Approximately 2 minutes after a workout session ends, the athlete receives a push summary — and no push is sent if a session is still active
  4. When a user levels up or unlocks a badge, they receive exactly one push notification even if multiple events occur in the same session
**Plans:** 4 plans
Plans:
- [ ] 02-01-PLAN.md — PUSH-01: program assignment push (waitUntil in POST /coach/programs/:id/assign)
- [ ] 02-02-PLAN.md — PUSH-02: invitation accepted push bidirectional (waitUntil in POST /coach/clients/links/redeem)
- [ ] 02-03-PLAN.md — PUSH-03 + PUSH-04: Supabase webhook handlers + 2-min delay + level-up detection (new push-events.ts router)
- [ ] 02-04-PLAN.md — Supabase Dashboard webhook configuration + end-to-end smoke test (manual)

### Phase 3: In-app Notification Center
**Goal:** Replace the static mock data in the existing `notifications.tsx` shell with live Supabase data, enabling read/unread management, deep links, badge sync, and real-time updates.
**Depends on:** Phase 1
**Requirements:** CENTER-01, CENTER-02, CENTER-03, CENTER-04, CENTER-05
**Success Criteria** (what must be TRUE):
  1. The notification center displays real notifications fetched from `notification_log` via TanStack Query (no hardcoded mock items)
  2. Tapping a notification marks it read and navigates to the relevant screen via its deep-link path
  3. "Mark all as read" sets `read_at` on all unread entries; the unread badge on the header icon drops to zero immediately
  4. The app icon badge count and header badge reflect the current unread count and update without a manual refresh
  5. A new push notification sent from the server appears in the center in real time via Supabase Realtime without the user pulling to refresh
**Plans:** TBD
**UI hint:** yes

### Phase 4: Cron / Scheduled Notifications
**Goal:** Add three Vercel cron jobs that send scheduled push notifications for streak risk, dead token cleanup, and weekly digest.
**Depends on:** Phase 1, Phase 3
**Requirements:** CRON-01, CRON-02, CRON-03
**Success Criteria** (what must be TRUE):
  1. At 21:00 UTC, users with a habit streak of 3 or more days that was not logged that day receive a single streak-at-risk push
  2. Every 15 minutes, the receipt-check cron queries Expo Push receipts and marks `DeviceNotRegistered` tokens as `is_active = false` — no push is ever sent to a dead token twice
  3. On Sunday at 09:00 UTC, users who have opted in to the weekly digest receive a push summarizing their week's sessions, XP earned, and current streak
**Plans:** TBD

### Phase 5: Notification Preferences UI
**Goal:** Give users full control over which notifications they receive via a master switch, per-category toggles, quiet hours, and an OS Settings escape hatch — all auto-saved.
**Depends on:** Phase 3
**Requirements:** PREF-01, PREF-02, PREF-03, PREF-04
**Success Criteria** (what must be TRUE):
  1. User can disable all push notifications with a single master switch; no push is delivered while it is off
  2. User can independently toggle 5 notification categories (Coach, Workout, Gamification, Santé & Habitudes, App); server-side sends respect each toggle
  3. User can set a quiet hours window; no push is delivered by the server outside that window
  4. All preference changes are persisted automatically to `notification_preferences` — there is no Save button and no change is lost on navigation
**Plans:** TBD
**UI hint:** yes

### Phase 6: Local Reminders & App Updates
**Goal:** Enable per-habit local reminders and workout-day reminders scheduled on-device, plus display OTA update notifications as cards in the in-app center.
**Depends on:** Phase 1
**Requirements:** LOCAL-01, LOCAL-02, LOCAL-03, APP-01
**Success Criteria** (what must be TRUE):
  1. User can set a daily reminder time per habit from the habit interface; the reminder fires locally at that time via `scheduleNotificationAsync`
  2. User can enable workout-day reminders based on their coach program or personal plan schedule; reminders appear on the correct days
  3. When a habit reminder time changes or a program day changes, previously scheduled local notifications are cancelled and rescheduled automatically — no stale reminders fire
  4. When an OTA app update is available, a card appears in the in-app notification center under the "App" category — no native push is sent for updates
**Plans:** TBD
**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Configuration | 0/4 | In progress | - |
| 2. Action-triggered Push Notifications | 0/4 | Planning done | - |
| 3. In-app Notification Center | 0/0 | Not started | - |
| 4. Cron / Scheduled Notifications | 0/0 | Not started | - |
| 5. Notification Preferences UI | 0/0 | Not started | - |
| 6. Local Reminders & App Updates | 0/0 | Not started | - |
