---
phase: 01-infrastructure-configuration
plan: 02
subsystem: infra
tags: [expo-notifications, fcm, apns, push-notifications, app-json, eas]

requires: []
provides:
  - "app.json expo-notifications plugin configured with icon, color, defaultChannel, enableBackgroundRemoteNotifications"
  - "iOS infoPlist UIBackgroundModes: [remote-notification, fetch]"
  - "Android POST_NOTIFICATIONS permission declared"
  - "Android googleServicesFile reference to ./google-services.json (EAS file secret)"
affects: [01-03, 01-04]

tech-stack:
  added: []
  patterns:
    - "expo-notifications config plugin placed before expo-router in plugins array"
    - "google-services.json delivered exclusively via EAS file secret — never committed"

key-files:
  created: []
  modified:
    - apps/mobile/app.json

key-decisions:
  - "expo-notifications plugin inserted before expo-router so native module initializes first"
  - "google-services.json referenced in app.json but never committed — managed via eas secret:create"
  - "UIBackgroundModes added to ios.infoPlist (not entitlements) per Expo docs"

patterns-established:
  - "Additive-only app.json edits — never remove existing plugins or permissions"

requirements-completed: [INFRA-01]

duration: 5min
completed: 2026-05-26
---

# Phase 01 Plan 02: app.json Notification Configuration Summary

**expo-notifications config plugin + iOS APNs background modes + Android POST_NOTIFICATIONS + FCM googleServicesFile added to app.json in four additive edits**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added expo-notifications config plugin (icon: `./assets/image/icon.png`, color: `#FF5C1A`, defaultChannel: `default`, enableBackgroundRemoteNotifications: `true`) before expo-router in the plugins array
- Added `UIBackgroundModes: ["remote-notification", "fetch"]` to `ios.infoPlist` alongside existing NS* keys
- Added `android.permission.POST_NOTIFICATIONS` to `android.permissions` array
- Added `googleServicesFile: "./google-services.json"` to `android` object — EAS injects file at build time via file secret

## Task Commits

1. **Task 1: Update app.json — three notification additions** - `342d7ec` (feat)

## Files Created/Modified
- `apps/mobile/app.json` - Four additive notification config changes; no existing content removed; EAS projectId `9b672c1a-10c4-4d66-882c-b9a08294650f` preserved

## Decisions Made
- Placed expo-notifications before expo-router: ensures the native module config plugin runs in the correct order during EAS build
- UIBackgroundModes goes in `ios.infoPlist`, not `ios.entitlements` — Expo's managed workflow reads this section for background mode declarations
- google-services.json is NOT committed; user must register it as EAS file secret with `eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json` (documented in Plan 04)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

Before the EAS Development Build (Plan 04), the user must register google-services.json as an EAS file secret:

```bash
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

This step is documented in Plan 04 (EAS build trigger). The file must NOT be committed to git.

## Next Phase Readiness
- app.json is fully configured for push notifications
- Plan 03 (notification hook) can now implement `registerForPushNotifications()` — app.json provides the required native entitlements and permissions
- Plan 04 (EAS build) requires the google-services.json EAS file secret to be registered before triggering the build

---
*Phase: 01-infrastructure-configuration*
*Completed: 2026-05-26*
