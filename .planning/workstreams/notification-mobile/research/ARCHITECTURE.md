# Architecture Research — Notification System

**Project:** Ziko Platform v1.8 — Push Notifications + In-App Notification Center
**Researched:** 2026-05-25
**Confidence:** HIGH — based on official Expo SDK 54 docs, expo-server-sdk-node GitHub, Vercel cron docs, and existing project patterns

---

## Data Flow Diagrams

### Token Registration Flow

```
Mobile (Expo)                        Hono API                        Supabase
─────────────────────────────────────────────────────────────────────────────

1. App cold-start (authenticated)
   useNotificationSetup() hook
   ↓
2. Notifications.requestPermissionsAsync()
   → user grants/denies
   ↓ (granted)
3. Notifications.getExpoPushTokenAsync({
     projectId: Constants.expoConfig.extra.eas.projectId
   })
   → returns "ExponentPushToken[xxxx...]"
   ↓
4. POST /notifications/token
   { token, platform: 'ios'|'android', deviceId }
   Authorization: Bearer <supabase_jwt>
                                        ↓
                              5. authMiddleware validates JWT
                                 extracts userId
                                        ↓
                              6. UPSERT notification_tokens
                                 WHERE user_id = userId
                                 AND device_id = deviceId
                                 ON CONFLICT (user_id, device_id)
                                 DO UPDATE SET token, updated_at
                                        ↓
                              7. 200 { registered: true }

8. addPushTokenListener(onTokenRefresh)
   → fires when OS rotates token
   → repeat steps 4-7 with new token
```

**Key design decisions:**
- One row per (user_id, device_id) — a user with iPhone + iPad gets two rows. Correct behavior: both devices receive pushes.
- UPSERT on conflict prevents duplicate token rows when app restarts.
- `device_id` is generated once and stored in MMKV as a stable UUID (not the Expo token, which can rotate).
- Token registration happens after first successful auth, not during onboarding — avoids permission prompt before the user understands the app value.

---

### Push Send Flow (action-triggered)

```
Trigger Event                        Hono API                    Expo Push API      Device
──────────────────────────────────────────────────────────────────────────────────────────

Example: Coach assigns a program
          ↓
1. POST /coach/programs
   (existing route, modified)
                                     ↓
                           2. Program saved to Supabase
                                     ↓
                           3. Call notificationService.send({
                                recipientUserId: clientId,
                                category: 'coach',
                                type: 'program_assigned',
                                title: 'Nouveau programme de coach',
                                body:  'Push/Pull/Legs — 6 semaines. Commence quand tu veux.',
                                data: { url: '/(app)/(plugins)/ai-programs/detail', programId }
                              })
                                     ↓
                           4. Check notification_preferences:
                              is 'coach' category enabled for user?
                              → if disabled: skip send
                              ↓ (enabled)
                           5. SELECT token FROM notification_tokens
                              WHERE user_id = clientId AND is_active = true
                              → may return 1..N tokens (multi-device)
                                     ↓
                           6. INSERT INTO notification_log
                              { user_id, category, type, title, body,
                                data, idempotency_key, status: 'pending' }
                              → idempotency_key = sha256(type + user_id + programId)
                                     ↓
                           7. Expo.sendPushNotificationsAsync([
                                { to: token, title, body, data,
                                  channelId: 'coach',           ← Android channel
                                  sound: 'default',
                                  badge: unreadCount + 1 }
                              ])
                                     ↓                               ↓
                           8. Receive push tickets               Expo Push Service
                              tickets[0].status === 'ok'         → routes to APNs/FCM
                              tickets[0].id → receipt_id                  ↓
                                     ↓                               Device shows push
                           9. UPDATE notification_log
                              SET status = 'sent',
                                  receipt_ids = [ticket.id],
                                  sent_at = now()
                              WHERE idempotency_key = key

[15 minutes later — Vercel Cron or background job]
                           10. GET /notifications/cron/check-receipts
                               chunkPushNotificationReceiptIds(receiptIds)
                               Expo.getPushNotificationReceiptsAsync(chunk)
                                     ↓
                           11. For each receipt:
                               receipt.status === 'ok' → UPDATE log SET status = 'delivered'
                               receipt.details.error === 'DeviceNotRegistered'
                               → UPDATE notification_tokens SET is_active = false
                               → UPDATE log SET status = 'failed', error_code = 'DeviceNotRegistered'
```

**Key design decisions:**
- `notificationService.ts` is a standalone service class — not a Hono middleware. Routes call it directly after their business logic.
- Multi-device send: loop over all active tokens for the user; batch into one `sendPushNotificationsAsync` call per user (Expo accepts up to 100 per call).
- The `notification_log` row is inserted BEFORE the push is sent. Status starts as `pending`. This means even if the Expo API call fails mid-flight, the log record exists and the cron can retry.
- `DeviceNotRegistered` errors must immediately mark the token `is_active = false` in `notification_tokens`. Apple and Google penalize apps that continue sending to unregistered tokens.

---

### Cron Reminder Flow

```
Vercel Cron (vercel.json)            Hono API                        Supabase
──────────────────────────────────────────────────────────────────────────────

Schedule: "0 21 * * *" (21:00 UTC daily)
GET /notifications/cron/streak-at-risk
Authorization: Bearer ${CRON_SECRET}

                                     ↓
                           1. Verify CRON_SECRET header
                              (same pattern as supplements/storage crons)
                                     ↓
                           2. Query users eligible for streak-at-risk:
                              SELECT u.id, u.name,
                                     h.id AS habit_id, h.name AS habit_name,
                                     count(hl.id) AS streak_len
                              FROM habits h
                              JOIN user_profiles u ON u.id = h.user_id
                              LEFT JOIN habit_logs hl ON hl.habit_id = h.id
                                AND hl.date = CURRENT_DATE
                              WHERE hl.id IS NULL              -- not yet logged today
                                AND h.is_active = true
                              GROUP BY u.id, h.id
                              HAVING streak_len >= 3
                              -- streak_len computed from consecutive days;
                              -- Supabase function or app logic needed
                                     ↓
                           3. Check notification_preferences:
                              category 'health' AND type 'streak_at_risk' enabled
                                     ↓
                           4. Check quiet_hours:
                              user timezone? (stored in notification_preferences)
                              skip if current hour in user's quiet range
                                     ↓
                           5. Check rate limit: already sent streak-at-risk
                              today for this habit? SELECT from notification_log
                              WHERE idempotency_key = 'streak_at_risk-{user_id}-{habit_id}-{date}'
                              → skip if row exists (idempotent)
                                     ↓
                           6. batch push via notificationService.sendBatch()
                              → INSERT notification_log rows (idempotency_key)
                              → sendPushNotificationsAsync in chunks of 100
                                     ↓
                           7. Return { sent: N, skipped: M, errors: K }

Other cron schedules to add to vercel.json:
  "0 9 * * 0"  → /notifications/cron/weekly-digest (Sunday 9am UTC)
  "*/15 * * * *" → /notifications/cron/check-receipts (receipt polling)
```

**Key design decisions:**
- The receipt-check cron runs every 15 minutes. Expo recommends checking receipts 15 minutes after sending. Vercel cron minimum granularity is 1 minute, so `*/15 * * * *` is clean.
- Weekly digest cron runs Sunday 09:00 UTC. French users are UTC+1/+2, so this lands at 10:00–11:00 — reasonable for a Sunday morning digest.
- Idempotency key format: `{type}-{user_id}-{habit_id}-{date}`. If the cron fires twice (Vercel can occasionally fire twice under load), the second run finds the existing `notification_log` row and skips.
- Vercel cron timeout is 60s for Hobby, 15 minutes for Pro/Enterprise. A batch send of 1,000 users is feasible in 15 minutes. If the user base grows beyond ~50K, this needs to move to a queue (Vercel Queues or BullMQ).

---

### In-App Sync Flow

```
Mobile (Expo)                        Supabase (direct — no Hono hop)
──────────────────────────────────────────────────────────────────────

App opens / notifications tab focused
         ↓
1. TanStack Query: useNotifications(userId)
   → GET from Supabase directly:
     SELECT * FROM notification_log
     WHERE user_id = userId
     ORDER BY created_at DESC
     LIMIT 50
   → RLS enforces user_id = auth.uid()
   staleTime: 30_000 (30 seconds)
   refetchOnWindowFocus: true

         ↓
2. Render notification list
   group by date bucket (today / earlier)
   unread items = status IN ('pending','sent','delivered') AND read_at IS NULL

         ↓
3. User taps "Mark all read"
   → PATCH Supabase directly:
     UPDATE notification_log
     SET read_at = now()
     WHERE user_id = userId AND read_at IS NULL

         ↓
4. Tap a notification item
   → router.push(item.data.url)
   → mark single item read:
     UPDATE notification_log SET read_at = now() WHERE id = item.id

         ↓
5. Badge count update
   SELECT count(*) FROM notification_log
   WHERE user_id = userId AND read_at IS NULL
   → Notifications.setBadgeCountAsync(count)

─────────────────────────────────────────────────────────────────────

Supabase Realtime (optional enhancement, Phase 2):
   SUBSCRIBE to notification_log WHERE user_id = userId
   → invalidate TanStack Query cache on INSERT
   → show in-app toast for new notification (if app is foregrounded)
```

**Key design decisions:**
- In-app reads go DIRECTLY to Supabase, not through Hono. Same pattern as the Hono bypass used in coach pages. This eliminates one network hop for a latency-sensitive UI. RLS protects the data.
- TanStack Query handles caching, stale time, and background refetch. No custom subscription needed for v1.
- Supabase Realtime is deferred to Phase 2. It adds complexity (WebSocket connection lifecycle) for a benefit that only matters when the app is foregrounded — at which point polling every 30s is acceptable.
- Badge count is derived from `notification_log.read_at IS NULL`. It is set on app foreground via `AppState` listener, and after each "mark read" mutation.

---

## New Components

### Backend — `backend/api/src/`

| File | Role |
|------|------|
| `services/notificationService.ts` | Core push dispatch: preference check, token fetch, Expo send, log write, receipt handling |
| `routes/notifications.ts` | Hono router: `POST /notifications/token`, `GET /notifications/cron/streak-at-risk`, `GET /notifications/cron/weekly-digest`, `GET /notifications/cron/check-receipts` |

`notificationService.ts` public API surface:

```typescript
// Send to one user (all their active tokens)
notificationService.send(payload: NotificationPayload): Promise<SendResult>

// Send to many users (batched, used by cron jobs)
notificationService.sendBatch(payloads: NotificationPayload[]): Promise<BatchResult>

// Called by receipt-check cron
notificationService.processReceipts(receiptIds: string[]): Promise<void>

interface NotificationPayload {
  recipientUserId: string;
  category: 'coach' | 'workout' | 'gamification' | 'health' | 'system';
  type: string;              // e.g. 'program_assigned', 'level_up', 'streak_at_risk'
  title: string;
  body: string;
  data?: { url?: string; [key: string]: unknown };
  idempotencyKey: string;    // caller constructs: `${type}-${userId}-${entityId}`
}
```

### Mobile — `apps/mobile/`

| File | Role |
|------|------|
| `src/hooks/useNotificationSetup.ts` | Permission request, token registration, push token listener, background task registration |
| `src/hooks/useNotifications.ts` | TanStack Query hook for fetching `notification_log`, mark-read mutations, badge count sync |
| `src/stores/notificationStore.ts` | Zustand: unread count (used by tab badge and header icon) |

### Existing file modifications

| File | Change |
|------|--------|
| `app/_layout.tsx` | Add `useNotificationSetup()` call, `setNotificationHandler`, `addNotificationResponseReceivedListener` (deep link handler), `AppState` listener for badge refresh |
| `app/(app)/notifications.tsx` | Replace static `INITIAL_ITEMS` with `useNotifications()` TanStack Query; wire mark-read; add filter by category |
| `backend/api/src/app.ts` | Add `app.route('/notifications', notificationsRouter)` |
| `backend/api/vercel.json` | Add 3 new cron entries (streak-at-risk, weekly digest, receipt check) |
| `backend/api/src/routes/webhooks.ts` | Remove the TODO comment; wire `notificationService.send()` for `user_profiles INSERT` welcome push |
| Trigger-point routes (programs, invitations, etc.) | Call `notificationService.send()` after successful writes |

---

## Supabase Schema Design

### Migration 022 — `022_notification_schema.sql`

```sql
-- ============================================================
-- NOTIFICATIONS — push tokens, log, preferences
-- Migration 022
-- ============================================================

-- ── notification_tokens ──────────────────────────────────────
-- One row per (user, device). UPSERT on registration.
CREATE TABLE IF NOT EXISTS public.notification_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL,          -- stable UUID generated by mobile, stored in MMKV
  token       TEXT NOT NULL,          -- ExponentPushToken[xxxx...]
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_id)         -- idempotent UPSERT target
);

CREATE INDEX idx_notification_tokens_user ON public.notification_tokens(user_id) WHERE is_active = TRUE;

ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own tokens
CREATE POLICY "notification_tokens_own"
  ON public.notification_tokens
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Backend service (server-side, bypasses RLS via service key or trusted context)
-- needs to UPDATE is_active = false when DeviceNotRegistered — this is done server-side
-- where RLS is bypassed by the admin client.


-- ── notification_log ─────────────────────────────────────────
-- Every notification ever sent or attempted. Source of truth for the in-app inbox.
CREATE TABLE IF NOT EXISTS public.notification_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL CHECK (category IN ('coach','workout','gamification','health','system')),
  type             TEXT NOT NULL,     -- e.g. 'program_assigned', 'level_up', 'streak_at_risk'
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  data             JSONB,             -- { url, entityId, ... }
  idempotency_key  TEXT NOT NULL UNIQUE,  -- prevents duplicate sends
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','delivered','failed','skipped')),
  receipt_ids      TEXT[],            -- Expo push ticket IDs, for receipt polling
  error_code       TEXT,              -- 'DeviceNotRegistered', 'MessageTooBig', etc.
  read_at          TIMESTAMPTZ,       -- NULL = unread
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_user ON public.notification_log(user_id, created_at DESC);
CREATE INDEX idx_notification_log_unread ON public.notification_log(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notification_log_status ON public.notification_log(status) WHERE status = 'sent';
-- last index supports the receipt-check cron: find all 'sent' rows with receipt_ids to check

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Users can read and update (mark read) their own notifications
CREATE POLICY "notification_log_read"
  ON public.notification_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_log_mark_read"
  ON public.notification_log
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT and status updates are done server-side only (admin client, bypasses RLS).
-- No INSERT policy for authenticated users — they should not create log rows directly.


-- ── notification_preferences ──────────────────────────────────
-- Per-user, per-category preferences. One row per user (UPSERT on change).
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Master switch
  push_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Category switches
  coach_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  workout_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  gamification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  health_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  system_enabled   BOOLEAN NOT NULL DEFAULT TRUE,  -- not toggleable in UI but stored
  -- Granular type switches (JSONB for flexibility without schema migrations per new type)
  type_prefs       JSONB NOT NULL DEFAULT '{
    "program_assigned": true,
    "program_modified": true,
    "ai_weekly_analysis": true,
    "invitation_received": true,
    "invitation_accepted": true,
    "workout_reminder": false,
    "streak_at_risk": true,
    "post_session_summary": true,
    "level_up": true,
    "badge_unlocked": true,
    "weekly_xp_digest": false,
    "habit_reminder": false,
    "hydration_checkin": false,
    "sleep_reminder": false,
    "new_plugin": false
  }',
  -- Quiet hours (stored as simple hour integers, interpreted in UTC by server)
  quiet_hours_start INTEGER DEFAULT 22 CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end   INTEGER DEFAULT 7  CHECK (quiet_hours_end BETWEEN 0 AND 23),
  -- User's UTC offset for quiet hour calculation (e.g. 2 for UTC+2)
  timezone_offset   INTEGER DEFAULT 1  CHECK (timezone_offset BETWEEN -12 AND 14),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_own"
  ON public.notification_preferences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Why `idempotency_key` as `TEXT UNIQUE` on `notification_log`

Postgres `UNIQUE` constraint makes the INSERT fail (or be caught by `ON CONFLICT DO NOTHING`) if the same key is sent twice. This is the database-level idempotency gate. The service layer checks for the existing row before sending; the DB constraint is the safety net for race conditions.

Idempotency key format per notification type:

| Type | Key format |
|------|-----------|
| `program_assigned` | `program_assigned-{userId}-{programId}` |
| `level_up` | `level_up-{userId}-{newLevel}` |
| `badge_unlocked` | `badge_unlocked-{userId}-{badgeId}` |
| `streak_at_risk` | `streak_at_risk-{userId}-{habitId}-{date}` |
| `weekly_digest` | `weekly_digest-{userId}-{isoWeek}` |
| `invitation_received` | `invitation_received-{userId}-{invitationId}` |
| `post_session_summary` | `post_session_summary-{userId}-{sessionId}` |

For time-periodic reminders without a unique entity, use the date as the disambiguator. A weekly digest for the same user in the same week will always produce the same key — the second attempt hits the UNIQUE constraint and is silently skipped.

---

## Background Notification Handling in Expo Router v4

### In `app/_layout.tsx` (root layout additions)

```typescript
// 1. Set notification handler — controls foreground display behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,   // SDK 54: replaces shouldShowAlert
    shouldShowList: true,
  }),
});

// 2. Background task registration (must be at module scope, outside component)
// Define in a separate file: src/tasks/notificationTask.ts
// Then import it at the top of _layout.tsx so TaskManager sees it early.

// 3. In RootLayout useEffect (after auth initialized):
useEffect(() => {
  // Handle notification tap when app was backgrounded/killed
  // getLastNotificationResponse() covers the "killed → opened by tap" case
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    handleNotificationResponse(lastResponse);
  }

  // Handle notification tap while app is foregrounded or backgrounded
  const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

  // Handle new notifications arriving while app is foregrounded
  const receivedSub = Notifications.addNotificationReceivedListener((notif) => {
    // Refresh unread count in notificationStore
    // The TanStack Query will refetch on next focus; store gives immediate badge update
    notificationStore.getState().incrementUnread();
  });

  return () => {
    sub.remove();
    receivedSub.remove();
  };
}, [isInitialized]);

// 4. Deep link handler
function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const url = response.notification.request.content.data?.url as string | undefined;
  if (url) {
    router.push(url as any);
  }
  // Mark as read via direct Supabase update
  const notificationId = response.notification.request.content.data?.notificationLogId as string;
  if (notificationId) {
    supabase
      .from('notification_log')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .then(() => notificationStore.getState().syncUnreadCount());
  }
}

// 5. AppState listener for badge sync
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      notificationStore.getState().syncUnreadCount();
    }
  });
  return () => sub.remove();
}, []);
```

### `src/tasks/notificationTask.ts` (background task)

```typescript
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKGROUND_NOTIFICATION_TASK = 'ZIKO_BACKGROUND_NOTIFICATION';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  BACKGROUND_NOTIFICATION_TASK,
  ({ data, error }) => {
    if (error) return Notifications.BackgroundNotificationResult.Failed;
    // Minimal work: update badge count from local store or skip
    // Heavy work (DB calls) should not be done here — iOS kills tasks that run too long
    return Notifications.BackgroundNotificationResult.NewData;
  }
);

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
```

**Important:** This file must be imported (even as a side-effect import) at the top of `_layout.tsx` to ensure TaskManager sees it before any notification arrives. The task definition must exist at module load time.

### Android Notification Channel Setup

Android 8+ requires channels for all notifications. Set up in `useNotificationSetup.ts`:

```typescript
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('coach', {
    name: 'Coach & Programme',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7B5BD0',
    sound: 'default',
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('workout', {
    name: 'Rappels séance',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('gamification', {
    name: 'Récompenses & Succès',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#E8A33A',
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('health', {
    name: 'Santé & Habitudes',
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
  });
  await Notifications.setNotificationChannelAsync('system', {
    name: 'Alertes système',
    importance: Notifications.AndroidImportance.HIGH,
    showBadge: true,
  });
}
```

The `channelId` sent in the Expo push payload must match these IDs. The channel controls sound, vibration, and importance on Android independently of the payload.

---

## Badge Count Management

Badge count = count of rows in `notification_log` WHERE `user_id = me` AND `read_at IS NULL`.

The source of truth is Supabase. The mobile badge is a derived view.

**Sync points:**

| Event | Action |
|-------|--------|
| App becomes active (`AppState = 'active'`) | Query unread count, `setBadgeCountAsync(count)` |
| `addNotificationReceivedListener` fires (foreground) | `incrementUnread()` in store, `setBadgeCountAsync` |
| User opens notification center tab | TanStack Query refetch, re-sync badge |
| User taps "Mark all read" | Mutation, then `setBadgeCountAsync(0)` |
| User taps a single notification | Mark that row read, decrement store count, `setBadgeCountAsync` |

**No server-push badge update.** Expo's badge field in a push payload can set the badge server-side but this requires knowing the exact count at send time, which is error-prone in a multi-device scenario. Let the client compute its own count on foreground. This matches the standard pattern used by Notion, Linear, etc.

---

## Idempotency Strategy

Three layers, each catching a different failure mode:

### Layer 1 — Caller constructs a deterministic key

Every call to `notificationService.send()` requires a non-nullable `idempotencyKey`. The key encodes what happened and to whom. Same event = same key = no duplicate.

```
program_assigned-{userId}-{programId}
```

If the coach assigns the same program twice (UI bug, double-submit), the second send produces the same key. Layer 2 catches it.

### Layer 2 — Database UNIQUE constraint on `notification_log.idempotency_key`

Before calling the Expo API, the service does:
```sql
INSERT INTO notification_log (idempotency_key, status, ...)
VALUES ($key, 'pending', ...)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id
```
If `RETURNING id` is null, the row already existed — skip the Expo API call entirely. The push was either already sent or is in-flight.

This handles:
- Double-submit from UI
- Vercel cron firing twice (documented edge case under load)
- Retry from an upstream caller

### Layer 3 — `isExpoPushToken()` validation before send

The `expo-server-sdk` provides `Expo.isExpoPushToken(token)`. All tokens fetched from the DB are validated before being included in a send batch. Malformed tokens are filtered and the corresponding `notification_tokens` row is marked `is_active = false`.

### Layer 4 — Receipt polling and `DeviceNotRegistered` cleanup

After sending, receipt polling (15-minute cron) detects tokens that APNs/FCM rejected as unregistered. These are immediately marked `is_active = false`. Future sends for that user will not include the dead token. This prevents the token accumulation problem that leads to growing error rates over time.

---

## Suggested Build Order

The following order respects hard dependencies. Later phases cannot start until earlier ones are complete.

### Phase A — Infrastructure (must be first, unblocks everything)

1. **Migration 022** — create `notification_tokens`, `notification_log`, `notification_preferences` tables with RLS.
2. **`notificationService.ts`** — the core service. All other backend work calls this. Depends on: migration 022 existing.
3. **`POST /notifications/token`** route — mobile needs this to register tokens. Depends on: notificationService.ts for the UPSERT logic.
4. **`useNotificationSetup.ts` hook** — mobile token registration + permission request. Depends on: the API route.
5. **Wire `_layout.tsx`** — import background task, add `setNotificationHandler`, add response listener. Depends on: useNotificationSetup.ts.

### Phase B — Action-triggered pushes (depends on Phase A)

6. **Coach program assignment push** — wire `notificationService.send()` in `POST /coach/programs` after the DB write. This is the highest-value, lowest-risk trigger (transactional, immediate, one push per event).
7. **Coach invitation push** — wire in `/coach/invitations` routes (both "invitation received" for client and "invitation accepted" for coach).
8. **Post-session summary push** — wire in workout session create/complete path. Include 2-minute delay via `setTimeout` or a deferred Supabase function.

### Phase C — In-app notification center (depends on Phase A)

9. **`useNotifications.ts` hook** — TanStack Query hook for `notification_log`, mark-read mutations. Depends on: migration 022.
10. **`notificationStore.ts`** — Zustand for unread count and badge sync. Depends on: useNotifications.ts interface.
11. **Wire `notifications.tsx`** — replace static `INITIAL_ITEMS` with real data from `useNotifications`. Wire category filter, mark-read, deep link tap. Depends on: useNotifications.ts + notificationStore.ts.
12. **Badge count** — add AppState listener in `_layout.tsx`, wire `setBadgeCountAsync` calls. Depends on: notificationStore.ts.

### Phase D — Cron reminders (depends on Phase A + C)

13. **`GET /notifications/cron/streak-at-risk`** — query habits not logged today with streak >= 3, batch push. Depends on: notificationService.ts.
14. **`GET /notifications/cron/check-receipts`** — poll Expo receipt API, update `notification_log.status`, deactivate dead tokens. Depends on: notificationService.ts.
15. **Add cron entries to `vercel.json`** — streak-at-risk at 21:00 UTC daily, receipt check every 15 minutes, weekly digest on Sunday.
16. **Weekly digest cron** — assemble personalized weekly summary, batch push. Depends on: streak-at-risk pattern established in step 13.

### Phase E — Notification preferences UI (depends on Phase C)

17. **`notification_preferences` Supabase read/write** — add to `useNotifications.ts` or a dedicated `useNotificationPreferences.ts`. The preference table already exists from migration 022.
18. **Settings screen** — the preference UI with section switches, type toggles, quiet hours picker. Depends on: preferences hook.

### Phase F — Local reminders (independent after Phase A)

19. **Per-habit local reminders** — `Notifications.scheduleNotificationAsync` called from within the habits plugin when the user sets a reminder time. These are local (no server). Depends on: `useNotificationSetup.ts` permission grant.
20. **Workout reminders** — similar local schedule. Per-program-day, user-configured time.

---

## Hono API Route Surface (new)

```
POST /notifications/token                    ← register/refresh push token
DELETE /notifications/token/:deviceId        ← unregister on logout

GET  /notifications/cron/streak-at-risk      ← Vercel cron, CRON_SECRET auth
GET  /notifications/cron/weekly-digest       ← Vercel cron, CRON_SECRET auth
GET  /notifications/cron/check-receipts      ← Vercel cron, CRON_SECRET auth
```

All non-cron routes use the existing `authMiddleware`. Cron routes use the same `CRON_SECRET Bearer` pattern already established in `supplements.ts` and `storage.ts`.

Mobile reads `notification_log` and writes `read_at` directly to Supabase (no Hono hop). Mobile writes `notification_preferences` directly to Supabase. Only token registration and sending go through Hono.

---

## Key Dependencies (npm)

```bash
# Backend — Hono API
npm install expo-server-sdk    # Official Expo push service Node.js SDK

# Mobile — already available in Expo SDK 54
# expo-notifications is included; no separate install needed
# expo-task-manager is included; no separate install needed
```

The `expo-server-sdk` package provides `Expo`, `ExpoPushMessage`, `ExpoPushTicket`, `ExpoPushReceipt` types and the batching/chunking utilities. Use `Expo.chunkPushNotifications(messages)` before calling `sendPushNotificationsAsync` to stay within the 100-per-call limit.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Expo token registration | HIGH | Official Expo SDK 54 docs, Context7 verified |
| Expo push send via expo-server-sdk | HIGH | Official GitHub + npm docs |
| Background task registration | HIGH | Context7: `registerTaskAsync` + `TaskManager.defineTask` patterns |
| Notification response deep link | HIGH | Official Expo docs + verified community pattern (Expo Router url field) |
| Vercel cron auth pattern | HIGH | Existing project code (supplements.ts, storage.ts) |
| Supabase schema + RLS | HIGH | Matches existing migration patterns (001–021) |
| Receipt polling cadence | HIGH | Expo official docs: "check 15 minutes post-send" |
| DeviceNotRegistered cleanup | HIGH | Expo docs, expo-server-sdk error handling |
| Badge count approach | MEDIUM | Standard pattern; no single authoritative source, but consistent across iOS/Android best practices |
| Quiet hours timezone handling | MEDIUM | Storing UTC offset as integer is pragmatic but imprecise for DST; acceptable for v1 |
