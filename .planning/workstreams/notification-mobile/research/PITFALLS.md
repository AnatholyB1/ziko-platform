# Pitfalls Research — Notification System

**Project:** Ziko Platform (Expo SDK 54 + Hono on Vercel + Supabase)
**Researched:** 2026-05-25
**Confidence:** HIGH (verified against official Expo docs, Supabase docs, CNIL/GDPR sources)

---

## Critical Pitfalls

| Severity | Pitfall | Prevention | Phase |
|----------|---------|------------|-------|
| HIGH | Expo Go no longer supports push in SDK 54 — dev team tests in Expo Go and assumes it works | Use Development Build for ALL push notification testing | Phase 1 (Setup) |
| HIGH | APNs p8 key revocation kills push for ALL users instantly with no warning | Never revoke a push key without rotating first; use `eas credentials` to manage | Phase 1 (Setup) |
| HIGH | Backend reads push tokens using user JWT — RLS blocks cross-user token queries silently | Use Supabase service role client (never anon/user JWT) for backend-initiated token queries | Phase 1 (DB) |
| HIGH | Android 13+ requires `POST_NOTIFICATIONS` runtime permission — manifest alone is not enough | Call `requestPermissionsAsync()` at the right UX moment; never cold-call on app open | Phase 1 (Mobile) |
| HIGH | No receipt polling = silent delivery failure goes undetected in production | Implement a scheduled receipt-check job (Vercel Cron, 15 min delay) | Phase 2 (Backend) |
| HIGH | Stale tokens accumulate — DeviceNotRegistered never surfaces without receipt polling | Delete tokens immediately on `DeviceNotRegistered` receipt; upsert on every login | Phase 2 (Backend) |
| MEDIUM | Vercel serverless timeout (10s Hobby / 300s Pro) blocks long batch sends inside a request | Use `waitUntil` or fire-and-forget to a queue; never send 1000 tokens synchronously | Phase 2 (Backend) |
| MEDIUM | Push tokens stored as personal data without RGPD consent record — CNIL fine risk | Log consent with timestamp; include push token deletion in account delete flow | Phase 1 (DB) |
| MEDIUM | Payload exceeds 4096 bytes — silently dropped by Expo Push API | Keep notification body short; never embed user data payloads; test payload size | Phase 2 (Backend) |
| MEDIUM | MismatchSenderId: FCM `google-services.json` sender ID differs from server credential | Keep `google-services.json` in sync with the FCM project used in EAS credentials | Phase 1 (Setup) |

---

## APNs/FCM Credential Pitfalls

### Pitfall: APNs Key Revocation Breaks All iOS Push Instantly
**What goes wrong:** A developer revokes the Apple Push Notification key in the Apple Developer portal (e.g., during a routine security audit or by mistake). All iOS push notifications stop immediately for every user. There is no graceful degradation.

**Why it happens:** Apple p8 push keys are account-level, not app-level. One revocation affects all apps using that key.

**Consequences:** Zero iOS push delivery. `InvalidCredentials` errors in all push receipts.

**Prevention:**
- Use EAS managed credentials (`eas credentials`). Never manually revoke keys.
- If rotation is needed: add new key first, update EAS, confirm delivery, then revoke old key.
- APNs p8 keys do NOT expire — do not "refresh" them unnecessarily.

**Detection:** `InvalidCredentials` error in push receipts within minutes of revocation.

**Phase:** Phase 1 (EAS + Credentials Setup)

---

### Pitfall: FCM Credentials Mismatch (MismatchSenderId)
**What goes wrong:** The FCM server key uploaded to EAS/Expo does not match the `google-services.json` Sender ID. Android push fails with `MismatchSenderId`.

**Why it happens:** Developer uploads credentials from a different Firebase project than the one in `google-services.json`, or rotates keys independently.

**Prevention:**
- Always update `google-services.json` and EAS credentials from the same Firebase project simultaneously.
- Validate with a test send immediately after any credential rotation.

**Detection:** `MismatchSenderId` in push receipts for Android tokens.

**Phase:** Phase 1 (EAS + Credentials Setup)

---

### Pitfall: EAS Build Profiles Not Configured for Notifications
**What goes wrong:** Development build works. Production EAS build has no push entitlement or missing credentials. Notifications silently fail only in production.

**Why it happens:** EAS build profiles (`eas.json`) can have different credential configurations. The `production` profile may not have been set up with push credentials.

**Ziko context:** `app.json` currently has no `expo-notifications` plugin entry and no `aps-environment` entitlement. This MUST be added before any EAS build.

**Prevention:**
- Add `expo-notifications` to the `plugins` array in `app.json`.
- Add `"com.apple.developer.push-notifications": true` to `ios.entitlements`.
- Add `android.permission.POST_NOTIFICATIONS` to `android.permissions`.
- Run `eas credentials` for both iOS and Android before first push build.

**Detection:** Notifications work in dev build, fail silently in production build.

**Phase:** Phase 1 (app.json + EAS Setup) — must be the very first task.

---

## Token Lifecycle Pitfalls

### Pitfall: One Token Per User — Multi-Device Blindspot
**What goes wrong:** Schema stores a single `push_token` column on the `user_profiles` table. User has iPhone + iPad (or logs in on a new phone). Old device loses notifications. New device never registered.

**Why it happens:** Simplest implementation overrides the single column on each login. One user = one device assumption is wrong.

**Prevention:** Use a dedicated `device_tokens` table with `(user_id, device_id, platform, token, updated_at)`. Upsert keyed on `(user_id, device_id)`.

```sql
CREATE TABLE public.device_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id text NOT NULL,           -- UUID generated client-side, stored in MMKV
  platform text NOT NULL,            -- 'ios' | 'android'
  expo_push_token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, device_id)
);
```

**Phase:** Phase 1 (DB Schema)

---

### Pitfall: Token Registered Once, Never Refreshed
**What goes wrong:** Token is registered on first app launch and never updated. Token can change after: OS upgrade (Android), reinstall, clearing app data. New token is never stored. Push delivery drops silently.

**Why it happens:** Token registration code runs only in the onboarding flow or once on auth, never rechecked.

**Prevention:**
- Call `getExpoPushTokenAsync()` on every app foreground resume and upsert if changed.
- Store the token in MMKV locally; compare before upsert to avoid unnecessary network calls.

**Phase:** Phase 1 (Mobile Token Registration)

---

### Pitfall: Tokens Not Deleted on Logout / Account Delete
**What goes wrong:** User logs out. Their push token stays in the DB. They continue receiving notifications after logout (privacy violation). Or they delete their account and you continue attempting delivery.

**Prevention:**
- On logout: mark `device_tokens.is_active = false` (or delete the row if no audit need).
- On account delete: cascade delete via `ON DELETE CASCADE` on `user_id` foreign key.
- RGPD: account deletion must remove all personal data including push tokens.

**Phase:** Phase 1 (DB Schema) + Phase 2 (Auth integration)

---

### Pitfall: DeviceNotRegistered Silently Ignored
**What goes wrong:** User uninstalls the app. Backend keeps sending to their token. `DeviceNotRegistered` errors appear in push receipts but are never checked. Wasted API calls, degraded sender reputation.

**Why it happens:** Push tickets return `ok` immediately. `DeviceNotRegistered` only appears in receipts, which must be fetched separately after ~15 minutes.

**Prevention:**
- Implement a Vercel Cron job that fetches receipts 15-30 minutes after sends.
- On `DeviceNotRegistered`: set `device_tokens.is_active = false` immediately.
- Expo Push API clears receipts after 24 hours — poll before they expire.

**Phase:** Phase 2 (Receipt Polling Job)

---

## Vercel Serverless Pitfalls

### Pitfall: Synchronous Bulk Send Times Out the Request
**What goes wrong:** A trigger (e.g., coach sends announcement to all clients) fires a POST to Hono. The handler loops through 500 tokens, calls Expo Push API synchronously, and the Vercel function times out (10s on Hobby, 300s on Pro). The HTTP response is killed mid-send. Partial delivery with no error surfaced to the caller.

**Why it happens:** Vercel serverless functions are not designed for long-running batch operations.

**Prevention:**
- Never send more than ~50 tokens synchronously in a single request.
- For bulk sends, use `waitUntil` from `@vercel/functions` to continue after responding.
- For large-scale sends (>500 tokens), use a Vercel Cron + database queue pattern: insert notification jobs into a `notification_queue` table, cron processes batches every minute.

**Expo batch limits (confirmed):**
- Max 100 tokens per Expo Push API request
- Max 600 notifications/second per project
- Max 1000 receipt IDs per receipt check request
- Max payload: 4096 bytes

**Phase:** Phase 2 (Backend Send Infrastructure)

---

### Pitfall: Cold Start Latency for Time-Sensitive Notifications
**What goes wrong:** A real-time notification (e.g., "Your coach just sent you a program") triggers a Hono endpoint that hasn't been called in hours. Cold start adds 2-3 seconds before the push is even sent. Combined with APNs/FCM propagation, notification arrives 5-10 seconds late.

**Why it happens:** Vercel serverless functions are ephemeral. Inactive functions have no warm instance.

**Prevention:**
- Enable Vercel Fluid Compute on the Hono API — reduces cold starts via instance reuse.
- For the notification-specific route, consider an Edge Function if the logic is simple enough (Edge has near-zero cold start).
- A Vercel Cron pinging the endpoint every 5 minutes keeps it warm (acceptable for non-real-time notifications).
- Accept: push notifications are inherently asynchronous — design UX to not promise instant delivery.

**Phase:** Phase 2 (Backend Infrastructure)

---

### Pitfall: No Retry Logic for Transient Expo API Failures
**What goes wrong:** Expo Push API returns HTTP 429 (rate limit) or 5xx. The backend logs an error and drops the notification permanently.

**Prevention:**
- Use `expo-server-sdk-node` — it includes automatic chunking (100/batch), 6 concurrent connections cap, and exponential backoff for retries.
- Implement a `notification_queue` table with `status` (pending/sent/failed) and `retry_count`. Cron reprocesses failed items.

**Phase:** Phase 2 (Backend Infrastructure)

---

## Privacy / RGPD Pitfalls

### Pitfall: Push Token Stored Without Consent Record
**What goes wrong:** App registers push token silently on first launch without explicit user consent. Under RGPD (French CNIL enforcement), push tokens are personal data. Storing them without a consent record and legal basis is a violation. CNIL issued €55.2M in fines in 2024 alone.

**Why it happens:** Developers treat push tokens as technical configuration, not personal data.

**Legal basis required:**
- Push tokens are personal data — they identify a specific device linked to a user.
- Sending via APNs/FCM involves international data transfers (Apple/Google servers outside EU).
- Under GDPR Art. 49(1)(a), explicit consent is required for this international transfer if no adequacy decision or SCCs cover it.

**Prevention:**
- Show an explicit opt-in screen before calling `requestPermissionsAsync()`.
- Store in DB: `consent_given_at: timestamptz`, `consent_source: text` (e.g., "onboarding_step_4").
- Add to Privacy Policy: what push tokens are, that they may be processed on Apple/Google servers.
- On account deletion, delete all tokens within 30 days (RGPD erasure right).

**Phase:** Phase 1 (Consent UI + DB Schema)

---

### Pitfall: Push Token Not Included in Data Export / Erasure
**What goes wrong:** User exercises RGPD right of erasure (Art. 17). The app deletes the user account but the `device_tokens` table row remains. The push token continues to be sent notifications if another bug causes it to be used.

**Prevention:**
- `device_tokens.user_id` must have `ON DELETE CASCADE` to `auth.users`.
- Audit the account deletion flow to confirm `auth.admin.deleteUser()` triggers cascade.
- Include push token list in any data export response (Art. 20).

**Phase:** Phase 1 (DB Schema) — add cascade at migration time, not retrofitted.

---

## Expo Permissions Pitfalls

### Pitfall: Android 13+ POST_NOTIFICATIONS Not in Manifest
**What goes wrong:** `app.json` does not include `android.permission.POST_NOTIFICATIONS`. Expo SDK 54 with `targetSdkVersion >= 33` requires this permission declared AND a runtime prompt. Without it, no notifications appear on Android 13+ devices — no error, just silent failure.

**Ziko context:** Current `app.json` does NOT have `POST_NOTIFICATIONS` in the permissions array. This is a day-one blocker.

**Prevention:**
Add to `app.json`:
```json
"android": {
  "permissions": [
    "android.permission.POST_NOTIFICATIONS",
    // ... existing permissions
  ]
}
```
Then call `requestPermissionsAsync()` at an appropriate moment in the UX.

**Phase:** Phase 1 (app.json) — zero-effort fix, zero-day blocker.

---

### Pitfall: Permission Prompt Shown at the Wrong Moment
**What goes wrong:** App calls `requestPermissionsAsync()` immediately on first open before the user understands the app's value. iOS and Android both allow only ONE native prompt per install. User dismisses it ("allow later") — push is permanently disabled for that install without another uninstall/reinstall cycle.

**iOS specifics:** iOS shows the native prompt only once ever. After denial, the user must go to Settings manually.
**Android 13+:** Same one-shot behavior for `POST_NOTIFICATIONS`.

**Prevention:**
- Show an in-app "pre-permission" screen first (explain why push helps them: workout reminders, coach messages, XP earned).
- Only trigger `requestPermissionsAsync()` after user taps "Enable notifications" on your custom screen.
- Check `canAskAgain` — if `false`, deep-link to Settings instead of calling the API again.
- Track permission state in the auth store / MMKV. Do not prompt on every launch.

**Phase:** Phase 1 (Permission UX) — design this before implementing.

---

### Pitfall: `getExpoPushTokenAsync()` Called Without `projectId`
**What goes wrong:** In SDK 53+, `getExpoPushTokenAsync()` requires the `projectId` option (EAS project UUID). Omitting it falls back to an inferred value that may be incorrect in production builds, returning a token that doesn't match the EAS project — push sends fail with `InvalidToken`.

**Ziko context:** EAS projectId is `9b672c1a-10c4-4d66-882c-b9a08294650f` (confirmed in `app.json`). Must pass this explicitly.

**Prevention:**
```typescript
const token = await Notifications.getExpoPushTokenAsync({
  projectId: '9b672c1a-10c4-4d66-882c-b9a08294650f',
});
```
Do not rely on `Constants.expoConfig?.extra?.eas?.projectId` alone in bare workflow builds.

**Phase:** Phase 1 (Mobile Token Registration)

---

## Testing Pitfalls

### Pitfall: Testing Push with Expo Go (SDK 54)
**What goes wrong:** Entire team tests notifications in Expo Go. Everything appears to work (local notifications work in Expo Go). Real push notifications (from Expo Push API) are NOT supported in Expo Go from SDK 53+ (Android) and SDK 54 (iOS). Production push will fail silently.

**Official status (confirmed):**
- SDK 54: "Push notifications no longer work inside Expo Go. Use a Development Build."
- Local notifications (`scheduleNotificationAsync`) still work in Expo Go.
- Real push (server → Expo API → device) requires a Development Build.

**Prevention:**
- Set up a Development Build with `eas build --profile development` before writing any push code.
- Document this for every developer joining the project.
- Use Expo's push notification tool (`https://expo.dev/notifications`) to test end-to-end with real tokens.

**Phase:** Phase 1 (Setup) — development build required before any push testing.

---

### Pitfall: Testing Receipt Polling Locally
**What goes wrong:** Receipts are not available immediately — Expo recommends waiting 15 minutes. Developer tests the receipt-check endpoint immediately after sending and sees no receipts, concludes receipt polling is broken, removes it.

**Prevention:**
- Wait at least 15 minutes after a test send before checking receipts.
- Write an integration test that specifically asserts the receipt fetch format, not the timing.
- In local dev, use Expo's test push tool which provides synthetic receipt IDs.

**Phase:** Phase 2 (Backend — Receipt Polling)

---

### Pitfall: Notification Handler Not Registered Before App Fully Loads
**What goes wrong:** User taps a notification while app is terminated. App launches. The notification response handler is registered too late (inside a component that mounts after navigation). The tap response is lost — no deep link, no specific screen opens.

**Why it happens:** Expo delivers the initial notification response synchronously during app startup. Handlers registered asynchronously (in effects, after navigation renders) miss it.

**Prevention:**
- Register `setNotificationHandler` and add `addNotificationResponseReceivedListener` in the root layout's `useEffect` at the earliest possible point.
- Also check `Notifications.getLastNotificationResponseAsync()` on app start to handle cold-start notification taps.
- On iOS specifically, register the listener BEFORE any async operations.

**Phase:** Phase 1 (Mobile — Notification Handler Setup)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: app.json + EAS Setup | Missing `POST_NOTIFICATIONS` and `expo-notifications` plugin | Add both before first build — zero-day blocker |
| Phase 1: DB Schema | Single token per user, no cascade on delete | Multi-device table with `ON DELETE CASCADE` from day one |
| Phase 1: Permission UX | Cold-prompt on first launch → high denial rate | Pre-permission screen before native dialog |
| Phase 1: Token Registration | Missing `projectId` in `getExpoPushTokenAsync()` | Hardcode EAS projectId explicitly |
| Phase 1: Testing Setup | Testing in Expo Go SDK 54 | Development Build required — document this |
| Phase 2: Send Infrastructure | Synchronous bulk send timing out Vercel | `waitUntil` or queue-based batch processing |
| Phase 2: Receipt Polling | No receipt job → stale tokens accumulate | Vercel Cron every 15-30 min post-send |
| Phase 2: RGPD | Token stored without consent record | Consent timestamp in DB + privacy policy update |
| Phase 2: Credentials | APNs key rotation mid-production | Rotate via EAS, not Apple portal directly |
| Phase 3: Notification Types | Background notification not received (Doze, Low Power) | Use `high` priority for critical Android notifications |

---

## Sources

- [Expo Push Notifications FAQ (official)](https://docs.expo.dev/push-notifications/faq/)
- [Expo: Sending Notifications with Push Service](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Expo: Receiving Notifications](https://docs.expo.dev/push-notifications/receiving-notifications/)
- [Expo: Push Notification Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo SDK 53 Changelog](https://expo.dev/changelog/sdk-53)
- [Expo: 5 Critical Setup Mistakes (Sashido)](https://www.sashido.io/en/blog/expo-push-notifications-setup-caveats-troubleshooting)
- [Android Developer: Notification Runtime Permission](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Push Notifications Example](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [CNIL: GDPR Security Guide 2024](https://www.cnil.fr/sites/cnil/files/2024-03/cnil_guide_securite_personnelle_ven_0.pdf)
- [GDPR: Art. 49 International Transfers](https://gdpr-info.eu/)
- [Push notifications are a privacy nightmare (David Libeau)](https://blog.davidlibeau.fr/push-notifications-are-a-privacy-nightmare/)
- [Vercel: Improving Cold Start Performance](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)
- [Vercel: Function Timeouts](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Inngest: What is waitUntil](https://www.inngest.com/blog/vercel-cloudflare-wait-until)
- [Expo Push API Benchmarks (Knock)](https://knock.app/push-api-benchmarks/expo)
- [Expo: Batch size 100 limit discussion](https://github.com/expo/expo/discussions/34947)
