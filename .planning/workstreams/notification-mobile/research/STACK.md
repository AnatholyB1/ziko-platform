# Stack Research — Notification System

**Project:** Ziko Platform — Push Notifications + In-App Notification Center
**Researched:** 2026-05-25
**Confidence:** HIGH (verified against official Expo docs and npm registry)

---

## Required Packages (Mobile)

`expo-notifications` is **already in package.json at `^0.32.16`** — no install needed.
`expo-device` is **already in package.json at `~8.0.10`** — no install needed.
`expo-constants` is **already in package.json at `~18.0.13`** — no install needed.

| Package | Version in use | Purpose | Action |
|---------|---------------|---------|--------|
| `expo-notifications` | `^0.32.16` | Token registration, permission requests, notification listeners, badge management | Already installed — add config plugin to `app.json` |
| `expo-device` | `~8.0.10` | Device check (`isDevice`) — physical device required for Expo push tokens | Already installed — no change |
| `expo-constants` | `~18.0.13` | Read `Constants.expoConfig.extra.eas.projectId` for `getExpoPushTokenAsync` | Already installed — no change |

**No new mobile packages are required.** The three needed packages are all present. The missing piece is configuration and implementation.

---

## Required Packages (Backend)

| Package | Version | Purpose | Install Command |
|---------|---------|---------|----------------|
| `expo-server-sdk` | `^6.1.0` (latest as of May 2026) | Send push notifications via Expo Push API, handles chunking (100/batch), rate limiting, gzip, retries, receipt checking | `npm install expo-server-sdk` in `backend/api/` |

**No other backend packages are needed.** `expo-server-sdk` wraps the Expo Push API (`https://exp.host/--/api/v2/push/send`) and handles all platform routing (FCM → Android, APNs → iOS) server-side. It is the official Expo-team maintained Node.js SDK.

**Do not add** `firebase-admin` or direct APNs libraries — Expo Push Service abstracts both.

---

## Supabase Schema Additions

Next migration number: **054**.

### Table 1: `user_push_tokens`

Stores Expo push tokens per user/device. Tokens can change (app reinstall, OS update) so upsert on `(user_id, device_id)` is the correct pattern.

```sql
-- 054_push_notifications_schema.sql

CREATE TABLE public.user_push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,                    -- ExponentPushToken[xxx]
  device_id     TEXT NOT NULL,                    -- expo-device Device.deviceName or a UUID stored in MMKV
  platform      TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)                     -- one token per device per user
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_own" ON public.user_push_tokens
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast token lookup by user when sending
CREATE INDEX idx_push_tokens_user_id ON public.user_push_tokens(user_id);
```

### Table 2: `notifications`

The in-app notification center already has a UI (`notifications.tsx`) with hardcoded data. This table backs it with real data.

```sql
CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,                    -- 'pr' | 'achievement' | 'coach' | 'community' | 'reminder'
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  icon          TEXT,                             -- Ionicons name (matches existing NotifItem.icon)
  tint          TEXT,                             -- hex color (matches existing NotifItem.tint)
  action_label  TEXT,                             -- CTA button label (matches existing NotifItem.action)
  action_path   TEXT,                             -- Expo Router path to navigate on tap
  read_at       TIMESTAMPTZ,                      -- NULL = unread
  push_sent_at  TIMESTAMPTZ,                      -- NULL = in-app only, set when push was sent
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON public.notifications
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for notification center queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
```

### Table 3: `notification_preferences`

Per-category opt-in/out, decoupled from the profile so it can grow.

```sql
CREATE TABLE public.notification_preferences (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pr_enabled         BOOLEAN NOT NULL DEFAULT true,
  achievement_enabled BOOLEAN NOT NULL DEFAULT true,
  coach_enabled      BOOLEAN NOT NULL DEFAULT true,
  community_enabled  BOOLEAN NOT NULL DEFAULT true,
  reminder_enabled   BOOLEAN NOT NULL DEFAULT true,
  push_enabled       BOOLEAN NOT NULL DEFAULT true,   -- master push kill switch
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_own" ON public.notification_preferences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## APNs / FCM Configuration

### iOS — APNs (via EAS Credentials)

EAS manages APNs automatically when using Managed Workflow + EAS Build. Steps:

1. **Add push entitlement to `app.json`** — add `aps-environment` is handled automatically by EAS when the `expo-notifications` plugin is present. However, add `UIBackgroundModes` explicitly for background delivery:

```json
// apps/mobile/app.json — add inside "ios" > "infoPlist"
"UIBackgroundModes": ["remote-notification", "fetch"]
```

2. **Add `expo-notifications` config plugin** to `app.json` plugins array:

```json
[
  "expo-notifications",
  {
    "icon": "./assets/image/icon.png",
    "color": "#FF5C1A",
    "defaultChannel": "default",
    "enableBackgroundRemoteNotifications": true
  }
]
```

3. **EAS CLI provisions APNs key automatically** on first `eas build`. No manual Apple Developer portal action needed for the push key itself — EAS creates an APNs Auth Key (P8) and associates it with the bundle identifier `com.ziko.mobile`.

   To verify or rotate: `eas credentials` → `iOS` → `Push Notifications`.

4. **iOS Simulator note**: Push notifications require a real device from SDK 53+ (Expo Go removed support). Development builds on real devices work fine.

### Android — FCM V1

FCM V1 (not legacy FCM) is required — legacy FCM was shut down by Google in 2024.

1. **Create / open Firebase project** at [console.firebase.google.com](https://console.firebase.google.com) for app `com.ziko.mobile`.

2. **Download `google-services.json`** from Firebase Console → Project Settings → Your apps → Android. Place at `apps/mobile/google-services.json`.

3. **Add to `app.json`**:
```json
// apps/mobile/app.json — inside "android"
"googleServicesFile": "./google-services.json"
```

4. **Generate Service Account Key** for FCM V1:
   - Firebase Console → Project Settings → Service Accounts → Generate new private key
   - Save as `google-service-account.json` (gitignored — already in `.gitignore`)
   - Note: `eas.json` already references `"serviceAccountKeyPath": "./google-service-account.json"` for submit, but this is the **same** service account key needed for FCM credentials

5. **Upload FCM V1 credentials to EAS**:
```bash
eas credentials
# Navigate: Android → production → Google Service Account → Set up FCM V1 → Upload
```

6. **Grant Firebase Messaging API Admin role** to the service account principal in Google Cloud Console (IAM section) — required for FCM V1 sends.

---

## Integration Points with Existing Stack

### `apps/mobile/app.json`
- Add `expo-notifications` to the `plugins` array with icon/color config
- Add `UIBackgroundModes: ["remote-notification", "fetch"]` to iOS `infoPlist`
- Add `"googleServicesFile": "./google-services.json"` to the `android` section
- The `eas.extra.projectId` (`9b672c1a-10c4-4d66-882c-b9a08294650f`) is already present — used in `getExpoPushTokenAsync({ projectId })`

### `apps/mobile/src/stores/` — new `notificationStore.ts`
- Zustand store persisted via MMKV (same pattern as `userPrefsStore.ts`)
- State: `notifications[]`, `unreadCount`, `preferences`, `pushToken`
- Actions: `markRead(id)`, `markAllRead()`, `setPreferences()`, `setPushToken()`
- The existing `notifications.tsx` screen uses local `useState` — wire it to this store instead

### `apps/mobile/app/(app)/notifications.tsx`
- Already built with correct UI (categories, unread dots, filter pills, mark-all-read)
- Replace `INITIAL_ITEMS` hardcode with TanStack Query fetching from `public.notifications`
- Replace local `useState` read tracking with Zustand store + Supabase `read_at` update

### `apps/mobile/src/lib/` — new `registerPushToken.ts`
- Call on app launch (after auth confirmed) from `authStore` or root `_layout.tsx`
- Uses `expo-notifications` + `expo-device` + `expo-constants`
- Upserts token to `user_push_tokens` via Supabase client directly (no Hono needed)

### `backend/api/src/routes/` — new `notifications.ts`
- `POST /notifications/send` — send push to user(s), insert into `notifications` table
- `GET /notifications` — fetch user notifications (or let mobile use Supabase direct)
- Uses `expo-server-sdk` Expo client instance

### `backend/api/src/routes/webhooks.ts`
- Existing webhook handler can be extended with a trigger for auto-notifications (e.g., new coach message → push)

### Supabase Realtime (optional, for live unread badge)
- Subscribe to `notifications` table inserts for `user_id = currentUser` to update unread badge without polling
- Pattern: `supabase.channel('notifications').on('postgres_changes', ...).subscribe()`

---

## What NOT to Add

| Package / Approach | Why to avoid |
|-------------------|-------------|
| `firebase-admin` | Expo Push Service already routes to FCM — no need for direct FCM integration |
| Direct APNs library (`node-apn`, `apns2`) | Same reason — Expo Push Service abstracts both platforms |
| OneSignal / Braze / Courier | Third-party push aggregators add cost and complexity; Expo Push Service is free and sufficient for a single-app use case |
| `@react-native-firebase/messaging` | Requires Expo bare workflow changes, conflicts with managed workflow + EAS; unnecessary when using Expo Push Service |
| Local notifications for everything | Local notifications have no server-side truth — use for reminders/timers only, not coach or community notifications |
| Supabase Edge Functions for push sending | Adds cold-start latency and Deno runtime complexity; the existing Hono backend on Vercel is already the correct place to send pushes |
| `expo-task-manager` + background fetch for unread | Overkill — Supabase Realtime subscription is simpler and more reliable for real-time unread badges |

---

## Sources

- [Expo Notifications API Reference](https://docs.expo.dev/versions/latest/sdk/notifications/) — HIGH confidence
- [Expo Push Notifications Setup Guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) — HIGH confidence
- [Expo Sending Notifications (Push API)](https://docs.expo.dev/push-notifications/sending-notifications/) — HIGH confidence
- [expo-server-sdk on GitHub](https://github.com/expo/expo-server-sdk-node) — HIGH confidence, v6.1.0
- [Supabase Push Notifications Guide](https://supabase.com/docs/guides/functions/examples/push-notifications) — MEDIUM confidence (table schema adapted)
- [FCM V1 Credentials Setup](https://docs.expo.dev/push-notifications/fcm-credentials/) — HIGH confidence
