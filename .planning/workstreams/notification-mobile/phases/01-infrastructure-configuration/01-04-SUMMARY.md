# Plan 01-04 Summary — EAS Development Build + End-to-End Smoke Test

**Plan:** 01-04
**Phase:** 01-infrastructure-configuration
**Completed:** 2026-05-26
**Type:** Manual (non-autonomous)

## What Was Done

All three manual checkpoint tasks completed and verified by the user.

### Task 1: Pre-build setup
- `google-services.json` downloaded from Firebase Console for `com.ziko.mobile`
- Registered as EAS file secret: `eas secret:create --scope project --name GOOGLE_SERVICES_JSON`
- FCM V1 Google Service Account credentials uploaded via `eas credentials`
- iOS APNs Auth Key confirmed registered via `eas credentials`

### Task 2: EAS Development Build + install
- EAS Development Build triggered using the `development` profile (`developmentClient: true`, real device)
- Build completed successfully
- App installed on a real physical device (not Expo Go, not simulator)
- Pre-permission Modal (`NotificationPermissionModal`) appeared on first authenticated launch

### Task 3: End-to-end smoke test
- User tapped "Activer" → native OS permission prompt appeared → permission granted
- `notification_tokens` table confirmed to contain a row with valid `ExponentPushToken[...]` and `is_active = true`
- Test push sent (via Expo Push playground or `notificationService.send()`) arrived on physical device within 30 seconds

## Acceptance Criteria

All 5 Phase 1 success criteria verified:
1. ✅ Custom pre-permission screen shown before native OS prompt
2. ✅ Token registered in `notification_tokens` after permission grant
3. ✅ `canAskAgain=false` → Settings CTA (code-verified in plan 01-03)
4. ✅ Development Build on real device with test push delivered end-to-end
5. ✅ Migration 054 applied: `notification_tokens`, `notification_log`, `notification_preferences` with RLS

## Deviations

None in this plan. Two deviations from plan 01-03 carried over:
- `react-native-mmkv` not installed → skip counter uses AsyncStorage (functional equivalent)
- `expo-task-manager` not installed → background task has safe no-op fallback (install with `npx expo install expo-task-manager` to enable)
