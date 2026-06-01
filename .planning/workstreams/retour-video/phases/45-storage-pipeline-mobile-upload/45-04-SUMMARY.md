# 45-04 SUMMARY — Push Token Registration in CoachScreen

**Status:** Complete
**Completed:** 2026-05-26
**Commit:** feat(45-04): register Expo push token in CoachScreen on State C activation

## What Was Built

Added push token registration to `plugins/coach/src/screens/CoachScreen.tsx` — fires once when the coach enters State C (linked athlete).

### New additions to CoachScreen.tsx
- Imports: `expo-notifications`, `expo-device`, `expo-constants`, `Platform` from react-native, `useEffect`
- `getOrCreateDeviceId()` module-level helper — generates a stable session-scoped deviceId (module-scope variable, best-effort)
- `useEffect([link?.id])` — runs once on State C activation:
  - Guards: `!link` (State C check) and `!Device.isDevice` (simulator safety)
  - Requests push permissions — silently skips if denied
  - Calls `Notifications.getExpoPushTokenAsync({ projectId })` with fallback projectId
  - POSTs to `/notifications/token` with `{ token, platform, deviceId }` and Bearer JWT
  - All errors swallowed silently — push registration never disrupts UX

### Infrastructure used (existing, not added)
- `POST /notifications/token` Hono endpoint (routes/notifications.ts)
- `notification_tokens` table (migration 054)
- D-04/D-05 from CONTEXT.md superseded — `user_profiles.expo_push_token` column NOT added

## Deviations
- MMKV import removed: not resolvable from plugin tsconfig context. Used module-scope variable for session-stable deviceId — functionally equivalent for push registration (backend deduplicates by userId+token)
- `requestPermissionsAsync()` cast to `any` due to `NotificationPermissionsStatus` type mismatch in plugin tsconfig — existing `useNotificationSetup.ts` uses same pattern with `status`

## Task 2 — E2E Verification
**Status: Deferred** — Expo Dev Build not yet available. Physical device test (upload flow + coach push notification) deferred to next EAS build QA session.

Fallback verifications completed:
- `npx tsc --noEmit -p apps/mobile/tsconfig.json` — zero CoachScreen errors ✓
- Push token useEffect contains `notifications/token` fetch call ✓
- `Device.isDevice` guard present ✓
- `!link` guard present ✓
