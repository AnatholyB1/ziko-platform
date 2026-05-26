---
phase: 01-infrastructure-configuration
plan: "01"
subsystem: notifications
tags: [notifications, push, supabase, hono, expo-server-sdk]
dependency_graph:
  requires: []
  provides:
    - notification_tokens table with RLS
    - notification_log table with RLS and idempotency
    - notification_preferences table with RLS
    - notificationService.send/sendBatch/processReceipts
    - POST /notifications/token (JWT protected)
    - DELETE /notifications/token/:deviceId (JWT protected)
  affects:
    - backend/api/src/app.ts
    - backend/api/package.json
tech_stack:
  added:
    - expo-server-sdk@^6.1.0 (backend/api)
  patterns:
    - Supabase admin client (service key) for all backend token/log writes
    - ON CONFLICT (idempotency_key) DO NOTHING for deduplication
    - Expo Push chunking (<=100 per batch)
    - Quiet hours via UTC hour integer arithmetic
key_files:
  created:
    - supabase/migrations/054_notification_schema.sql
    - backend/api/src/services/notificationService.ts
    - backend/api/src/routes/notifications.ts
  modified:
    - backend/api/src/app.ts (added notificationsRouter mount)
    - backend/api/package.json (added expo-server-sdk@^6.1.0)
decisions:
  - "supabaseAdmin (SUPABASE_SERVICE_KEY) used in notificationService and notifications router — never user JWT, required for cross-user queries and RLS bypass"
  - "Migration named 054 (not 022 — stale CONTEXT.md reference corrected per PLAN.md instructions)"
  - "Quiet hours uses UTC hour integers with timezone_offset arithmetic per D-09"
  - "ON CONFLICT (idempotency_key) DO NOTHING on notification_log INSERT is the idempotency gate"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 3
  files_modified: 2
---

# Phase 01 Plan 01: Notification Schema, Service, and Token Router Summary

**One-liner:** Supabase 3-table notification schema (tokens/log/prefs) with RLS, production Expo push send service using supabaseAdmin + expo-server-sdk, and Hono token registration router mounted at /notifications.

## What Was Created

### Task 1: Migration 054_notification_schema.sql

Created `supabase/migrations/054_notification_schema.sql` with three tables:

**notification_tokens** — one row per (user_id, device_id), UNIQUE constraint for UPSERT target, partial index on user_id WHERE is_active = TRUE, RLS policy "notification_tokens_own" with USING + WITH CHECK on auth.uid() = user_id.

**notification_log** — source of truth for in-app inbox, UNIQUE(idempotency_key) for deduplication, status FSM (pending/sent/delivered/failed/skipped), receipt_ids TEXT[] for Expo receipt polling, three indexes (user+date, unread, sent status). Two RLS policies: SELECT "notification_log_read" and UPDATE "notification_log_mark_read" — no INSERT policy (server-side admin only).

**notification_preferences** — user_id PRIMARY KEY (one row per user), per-category booleans, type_prefs JSONB with 15 notification type defaults, quiet_hours_start/end as UTC hour integers (D-09), timezone_offset for local hour calculation.

### Task 2: notificationService.ts

Created `backend/api/src/services/notificationService.ts` implementing:

- `send(payload)` — full 8-step flow: preference check → quiet hours check → idempotency INSERT → active token fetch → invalid token filter → chunk+send via Expo SDK → ticket processing → log UPDATE to 'sent'
- `sendBatch(payloads)` — sequential send loop returning { sent, failed } counts
- `processReceipts(receiptIds)` — receipt polling via expo.getPushNotificationReceiptsAsync, updates notification_log status to 'delivered' or 'failed' + error_code

All Supabase reads/writes use `supabaseAdmin` created with `SUPABASE_SERVICE_KEY`. The service throws at startup if `SUPABASE_SERVICE_KEY` is absent.

### Task 3: Hono notifications router + app.ts mount

Created `backend/api/src/routes/notifications.ts` with:

- `POST /notifications/token` — validates ExponentPushToken format (rejects with 400 on invalid), UPSERTs with ON CONFLICT (user_id, device_id), returns 200 { registered: true }
- `DELETE /notifications/token/:deviceId` — soft-delete (is_active=false), returns 200 { unregistered: true }
- Both routes protected by `authMiddleware` via `notificationsRouter.use('*', authMiddleware)`

Added to `backend/api/src/app.ts`:
- Import: `import { notificationsRouter } from './routes/notifications.js';`
- Mount: `app.route('/notifications', notificationsRouter);`

## TypeScript Compilation Result

`cd backend/api && npx tsc --noEmit` exits 0 — no TypeScript errors across the full backend/api codebase including the new files.

## Supabase db push

`npx supabase db push` was attempted but failed with a Windows binary execution error (supabase CLI not available in the shell environment — `.exe` spawn failed). The Supabase CLI is not installed as a global command. The migration SQL is correctly authored and ready to apply manually via the Supabase dashboard or CLI from a machine with the CLI installed. No credentials are present in this environment to test a live push.

**Manual apply steps:**
```bash
# From repo root, with supabase CLI installed and linked project:
supabase db push
# Or via Supabase dashboard: SQL Editor → paste contents of supabase/migrations/054_notification_schema.sql
```

## Deviations from Plan

### Migration naming (documented in PLAN.md)

The CONTEXT.md contained a stale reference to migration number `022`. The PLAN.md explicitly states the correct number is `054`. The file was correctly named `054_notification_schema.sql` per the PLAN.md instruction.

### Commit attribution

A concurrent agent executing plan 01-02 (dashboard widgets) staged and committed the new files (`notifications.ts`, `notificationService.ts`, `054_notification_schema.sql`, `app.ts`) as part of commit `58f63e1` while this agent was preparing to commit. The `feat(01-01)` commit `6abc536` captured only `backend/api/package.json` (expo-server-sdk dependency). All file content is correct and committed to the dev branch — the commit message attribution differs from expected but the deliverables are intact.

### processReceipts DeviceNotRegistered token deactivation

The Expo receipts API returns receipt status keyed by receipt ID, not by push token. Since the receipt-to-token mapping is not directly available in the receipts response, DeviceNotRegistered receipt errors update the notification_log (status='failed', error_code='DeviceNotRegistered') but cannot directly mark the specific token is_active=false from receipt IDs alone. Token cleanup for DeviceNotRegistered is handled in `send()` Step 7 via ticket processing (tickets include the error immediately at send time) and in Step 5 (invalid token format filter). This is the correct Expo SDK behavior — receipt polling is for confirming delivery, not for initial error detection.

## Known Stubs

None — all implemented functionality is wired to real Supabase tables and the Expo Push API.

## Threat Flags

No new threat surface beyond what is already covered in the plan's threat model.

## Self-Check

- [x] `supabase/migrations/054_notification_schema.sql` exists (104 lines)
- [x] `backend/api/src/services/notificationService.ts` exists (exports notificationService with send/sendBatch/processReceipts)
- [x] `backend/api/src/routes/notifications.ts` exists (exports notificationsRouter)
- [x] `backend/api/src/app.ts` contains `app.route('/notifications', notificationsRouter)`
- [x] `backend/api/package.json` contains `"expo-server-sdk": "^6.1.0"`
- [x] TypeScript compiles without errors (`npx tsc --noEmit` exits 0)
- [x] All three tables have RLS enabled
- [x] notification_log has UNIQUE(idempotency_key)
- [x] notification_tokens has UNIQUE(user_id, device_id)
- [x] notification_preferences has user_id as PRIMARY KEY
- [x] All Supabase writes in notificationService use supabaseAdmin (grep: no user JWT usage)

## Self-Check: PASSED
