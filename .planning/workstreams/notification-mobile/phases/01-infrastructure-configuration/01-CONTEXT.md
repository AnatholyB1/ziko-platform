# Phase 1: Infrastructure & Configuration - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the push token pipeline, Supabase schema (`notification_tokens`, `notification_log`, `notification_preferences`), and the Hono `notificationService.ts` send service so every subsequent phase has tokens to target and a production-ready delivery mechanism to call.

Includes: app.json configuration, EAS Development Build, `useNotificationSetup` hook, custom pre-permission screen, token UPSERT, token rotation via `addPushTokenListener`, denied-permission handling, and the full production `notificationService.ts`.

Does NOT include: sending real push events (Phase 2), in-app notification center data (Phase 3), cron jobs (Phase 4), preferences UI (Phase 5), local reminders (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Pre-permission Screen (TOKEN-01)
- **D-01:** Screen layout: single bold headline ("🔔 Reste dans la zone — Ne rate plus une séance") followed by 3 concrete notification example cards — Coach assignment, Streak at risk (21h), Level-up. Sport card visual style (shadow/rounded, `#FF5C1A` primary).
- **D-02:** CTA buttons: "Activer" (triggers `requestPermissionsAsync`) and "Plus tard" (deferred skip).
- **D-03:** "Plus tard" behavior — deferred, not permanent. MMKV key `notification_skip_count` (int) increments on each skip. The screen re-appears on the next cold start as long as `skipCount < 3`.
- **D-04:** After 3 skips — pre-permission screen stops appearing forever. Settings screen shows a quiet CTA linking to OS notification settings instead (same flow as TOKEN-04 / `canAskAgain = false`).

### Hook Entry Point (TOKEN-02)
- **D-05:** `useNotificationSetup` mounts in `apps/mobile/app/(app)/_layout.tsx` — fires on every authenticated app start. Same location as the `authStore` subscription.
- **D-06:** Pre-permission screen is rendered as a full-screen RN `<Modal animationType="slide">` overlay controlled by the hook's local state. Not a navigation route — avoids back-navigation edge cases and requires no new Expo Router file.

### notificationService.ts (INFRA-03)
- **D-07:** Full production service implemented in Phase 1 — Phase 2 calls it with zero rework. Service signature: `sendPush(userId, notification, idempotencyKey)`.
  1. Check `notification_preferences` (master `push_enabled` + category toggle for `notification.category`)
  2. Check quiet hours: suppress silently if current UTC hour falls in `[quiet_hours_start, quiet_hours_end)`
  3. Fetch active tokens from `notification_tokens` where `user_id = userId AND is_active = true`
  4. Chunk messages into batches of ≤ 100 (Expo Push API limit)
  5. Send via `expo-server-sdk` `ExpoPushClient`
  6. Write to `notification_log` (idempotency: `ON CONFLICT (idempotency_key) DO NOTHING`)
- **D-08:** Service uses Supabase **admin client** (bypasses RLS) — required because RLS with user JWT would silently return zero tokens for other users (e.g., coach sending push to athlete).
- **D-09:** Quiet hours stored as UTC hour integers in `notification_preferences` (no IANA timezone in v1.11 — acceptable per REQUIREMENTS.md Future Requirements note).

### Android FCM (INFRA-01)
- **D-10:** `google-services.json` managed as an **EAS file secret**, never committed to the repo. Command: `eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`. app.json references `"googleServicesFile": "./google-services.json"` and EAS injects it at build time.
- **D-11:** iOS APNs key — already configured in App Store Connect. EAS manages iOS push credentials automatically during the build. No manual APNs action required in Phase 1.

### Pre-decided (carried from research / REQUIREMENTS.md)
- **D-12:** Delivery layer: Expo Push Service only — no `firebase-admin`, no OneSignal, no Braze.
- **D-13:** New backend package only: `expo-server-sdk ^6.1.0` in `backend/api/`. Zero new mobile packages (expo-notifications, expo-device, expo-constants already installed).
- **D-14:** EAS Development Build uses existing `development` profile in `apps/mobile/eas.json` (`developmentClient: true`, `distribution: internal`, real device — not simulator).
- **D-15:** `device_id` = stable UUID generated once and stored in MMKV. Token UPSERT key: `(user_id, device_id)`.
- **D-16:** `getExpoPushTokenAsync()` must pass explicit `projectId: "9b672c1a-10c4-4d66-882c-b9a08294650f"` (EAS project ID).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/workstreams/notification-mobile/REQUIREMENTS.md` — Phase 1 requirements: INFRA-01, INFRA-02, INFRA-03, INFRA-04, TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04 (all 8 in scope for this phase)
- `.planning/workstreams/notification-mobile/ROADMAP.md` — Phase 1 goal, success criteria, and dependency map

### Research
- `.planning/workstreams/notification-mobile/research/SUMMARY.md` — Full research summary: stack additions, schema definitions, feature table, risk register, implementation approach

### Existing Code to Read Before Implementing
- `apps/mobile/app/(app)/_layout.tsx` — Root authenticated layout where `useNotificationSetup` mounts
- `apps/mobile/app/(app)/notifications.tsx` — Existing notification center shell (mock data, correct UI structure — Phase 3 wires real data)
- `apps/mobile/eas.json` — EAS build profiles (`development` profile already exists)
- `apps/mobile/app.json` — Current config — must add expo-notifications plugin, iOS UIBackgroundModes, Android POST_NOTIFICATIONS + googleServicesFile
- `backend/api/src/routes/supplements.ts` (lines 129–140) — Vercel Cron auth pattern (`CRON_SECRET` Bearer) — follow for Phase 4 crons
- `backend/api/src/middleware/auth.ts` — Hono auth middleware pattern

### Schema Reference
- `supabase/migrations/` — Next migration is **022** (`022_notification_schema.sql`). Three tables: `notification_tokens`, `notification_log`, `notification_preferences`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/app/(app)/notifications.tsx` — Full UI shell with filter pills, grouped notification list, read/unread state, card components. Ready for real data in Phase 3. No changes needed in Phase 1.
- `apps/mobile/eas.json` `development` profile — Already configured with `developmentClient: true`, `distribution: internal`, real device. INFRA-04 only needs the build triggered.
- Supabase migration numbering — Currently at 021. Phase 1 migration is 022.
- `backend/api/src/routes/supplements.ts` cron pattern — Lines 129–140 show the exact CRON_SECRET Bearer auth guard. Copy for Phase 4.

### Established Patterns
- **MMKV for persistent device state** — `notification_skip_count` and `device_id` follow existing MMKV usage in the codebase (react-native-mmkv v3).
- **Supabase admin client for backend writes** — `notificationService.ts` must use admin client (not user JWT). Matches existing backend patterns.
- **Hono route structure** — New notification routes go in `backend/api/src/routes/notifications.ts`, registered in the main router.
- **showAlert from @ziko/plugin-sdk** — Use `showAlert` instead of `Alert.alert` anywhere in the mobile app (per CLAUDE.md).
- **paddingBottom: 100** — All new screens need tab bar clearance.
- **NativeWind / no StyleSheet** — Use inline style objects or NativeWind classes.
- **Ionicons** — All icon names must be valid Ionicons glyphs.

### Integration Points
- `app/(app)/_layout.tsx` — Add `useNotificationSetup()` call here
- `backend/api/src/index.ts` (or main router) — Register `/notifications` route
- `supabase/migrations/` — Add `022_notification_schema.sql`
- `apps/mobile/app.json` — Three additions: expo-notifications plugin, iOS UIBackgroundModes, Android POST_NOTIFICATIONS + googleServicesFile

</code_context>

<specifics>
## Specific Ideas

- Pre-permission screen headline: "🔔 Reste dans la zone — Ne rate plus une séance"
- Three example notification cards shown on pre-perm screen: (1) Coach assignment, (2) Streak à risque — 21h, (3) Level-up / badge
- Skip counter MMKV key: `notification_skip_count` (int); stops showing after 3 skips
- After 3 skips or `canAskAgain = false`: Settings CTA identical to TOKEN-04 denied flow — no duplication
- Modal animation: `animationType="slide"` (slide up from bottom)
- EAS secret command documented in D-10 above — planner should include it as a manual step in INFRA-01

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-infrastructure-configuration*
*Context gathered: 2026-05-26*
