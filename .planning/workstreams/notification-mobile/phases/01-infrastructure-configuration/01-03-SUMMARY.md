---
phase: 01-infrastructure-configuration
plan: 03
subsystem: mobile-notifications
tags: [expo-notifications, push-tokens, AsyncStorage, react-native, permissions, android-channels]

requires:
  - phase: notification-mobile/01-01
    provides: Supabase notification_tokens table, POST /notifications/token Hono route
  - phase: notification-mobile/01-02
    provides: notificationService.ts, Expo Push API delivery layer

provides:
  - useNotificationSetup hook with full permission flow (skip counter, canAskAgain guard, token registration)
  - NotificationPermissionModal pre-permission UI with 3 example cards and CTA buttons
  - notificationTask.ts background task registration (conditional on expo-task-manager presence)
  - TOKEN-04 Réactiver les notifications CTA in Paramètres > Notifications screen
  - _layout.tsx wired with notification handler (module scope), response listener, AppState listener

affects: [notification-mobile/02, notification-mobile/03, notification-mobile/04, notification-mobile/05]

tech-stack:
  added: []
  patterns:
    - "useNotificationSetup returns {showModal, onActivate, onSkip} — consumed by _layout.tsx"
    - "AsyncStorage for persistent device state (skip count + device_id) — MMKV not in project deps"
    - "Notifications.setNotificationHandler at module scope (not inside useEffect) per Expo SDK 54"
    - "notificationTask.ts uses dynamic require with try/catch for optional expo-task-manager dep"

key-files:
  created:
    - apps/mobile/src/hooks/useNotificationSetup.ts
    - apps/mobile/src/components/NotificationPermissionModal.tsx
    - apps/mobile/src/tasks/notificationTask.ts
  modified:
    - apps/mobile/app/(app)/_layout.tsx
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "Used AsyncStorage (@react-native-async-storage/async-storage, already installed) for notification_skip_count and notification_device_id — react-native-mmkv not in project deps and constraint forbids new packages"
  - "notificationTask.ts uses conditional dynamic require for expo-task-manager (not installed) — safe no-op fallback; core token registration is unaffected"
  - "setNotificationHandler placed at module scope in _layout.tsx (outside component) per Expo SDK 54 requirement for foreground notification display"
  - "useNotificationSetup accepts (userId?, session?) params from _layout.tsx — hook is auth-aware"

patterns-established:
  - "Pattern: Notification hook returns {showModal, onActivate, onSkip} — _layout.tsx owns modal rendering as Tabs sibling"
  - "Pattern: Token registration silently swallows errors (console.warn only) — never surfaces user-facing error"
  - "Pattern: getAndRegisterToken is an internal async function reused by both onActivate and addPushTokenListener"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04]

duration: 35min
completed: 2026-05-26
---

# Phase 01 Plan 03: Mobile Notification Infrastructure Summary

**Pre-permission Modal + useNotificationSetup hook + _layout.tsx wiring delivering full Expo push token registration pipeline with skip-counter guard, Android channels, and Settings re-enable CTA**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:35:00Z
- **Tasks:** 4 (1a, 1b, 1c, 2)
- **Files modified:** 5

## Accomplishments

- useNotificationSetup hook implements complete D-01 through D-06 permission flow: checks existing grant, canAskAgain guard, skip counter (3-strike), token registration with projectId 9b672c1a, addPushTokenListener rotation
- NotificationPermissionModal renders full-screen slide-up pre-permission UI with 3 example cards (Coach, Streak, Level-up) and Activer/Plus tard CTAs
- _layout.tsx wired: notificationTask side-effect import at module top, setNotificationHandler at module scope, addNotificationResponseReceivedListener with deep-link routing, AppState badge-sync placeholder
- TOKEN-04 satisfied: NotifSubScreen in Paramètres shows Réactiver les notifications row via Linking.openSettings() when OS permanently denies

## Task Commits

1. **Task 1a: notificationTask.ts + useNotificationSetup.ts** - `9e6998b` (feat)
2. **Task 1b: NotificationPermissionModal.tsx** - `be11290` (feat)
3. **Task 1c: Settings TOKEN-04 CTA** - `fc27462` (feat)
4. **Task 2: Wire _layout.tsx** - `e0ae598` (feat)

## Files Created/Modified

- `apps/mobile/src/tasks/notificationTask.ts` — Background task registration with expo-task-manager (conditional dynamic require)
- `apps/mobile/src/hooks/useNotificationSetup.ts` — Permission flow, token registration, skip counter (AsyncStorage), Android channels, rotation listener
- `apps/mobile/src/components/NotificationPermissionModal.tsx` — Full-screen pre-permission Modal with 3 example cards
- `apps/mobile/app/(app)/_layout.tsx` — Wired hook + modal + notification handler + response listener + AppState listener
- `apps/mobile/app/(app)/profile/settings.tsx` — Added TOKEN-04 Réactiver row in NotifSubScreen

## Decisions Made

- **AsyncStorage instead of MMKV**: react-native-mmkv is not in the project's package.json and expo-notifications constraint forbids new packages. AsyncStorage is already installed and provides equivalent persistence for the skip counter and device_id.
- **Conditional dynamic require for expo-task-manager**: The package is not installed. The background task file uses `require()` inside a try/catch so it is a safe no-op if the module is absent. Core token registration (TOKEN-01 through TOKEN-04) does not depend on this task.
- **hook signature `useNotificationSetup(userId?, session?)`**: Simplest integration — _layout.tsx already has both values from authStore; hook does nothing when either is absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AsyncStorage substituted for MMKV**
- **Found during:** Task 1a (useNotificationSetup.ts creation)
- **Issue:** Plan specifies MMKV (`react-native-mmkv`) for notification_skip_count and notification_device_id, but the package is not in apps/mobile/package.json and does not exist in node_modules. Plan constraint: "No new npm packages."
- **Fix:** Replaced all MMKV calls with async AsyncStorage equivalents. The hook's useEffect is already async, so no structural change was needed — only the storage import and call pattern changed.
- **Files modified:** apps/mobile/src/hooks/useNotificationSetup.ts
- **Verification:** TypeScript compiles without errors; grep confirms SKIP_COUNT_KEY and DEVICE_ID_KEY are used via AsyncStorage.getItem/setItem
- **Committed in:** 9e6998b (Task 1a commit)

**2. [Rule 3 - Blocking] expo-task-manager absent — safe no-op fallback**
- **Found during:** Task 1a (notificationTask.ts), confirmed by TypeScript error TS2307
- **Issue:** expo-task-manager is not installed in the project. The plan requires its use for background task definition via TaskManager.defineTask.
- **Fix:** Replaced static import with a conditional dynamic require wrapped in try/catch. The file exports an empty module marker and silently skips registration if the package is absent. Background notification delivery (foreground listener + response listener) is unaffected — only silent background receipt is degraded.
- **Files modified:** apps/mobile/src/tasks/notificationTask.ts
- **Verification:** TypeScript compiles without errors; _layout.tsx side-effect import succeeds.
- **Committed in:** 9e6998b (Task 1a commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 3 — missing dependencies substituted with available alternatives)
**Impact on plan:** No scope creep. TOKEN-01 through TOKEN-04 fully satisfied. Background silent-receipt (ARCHITECTURE.md bonus) degraded to no-op pending expo-task-manager installation.

## Issues Encountered

- `Notifications.BackgroundNotificationResult` not exported from the expo-notifications main index — only in `BackgroundNotificationTasksModule.types`. Resolved via numeric literals (2=NewData, 3=Failed) inside the dynamic require block.
- Pre-existing TypeScript errors in 5 plugin dashboard files (TS2307 for @ziko/plugin-* missing screen exports) — pre-existing, out of scope, not fixed.

## Known Stubs

None — all flows are functionally wired. The AppState listener body is a placeholder comment for Phase 3 badge sync (`notificationStore.getState().syncUnreadCount()`) — this is intentional per plan spec.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model covers (T-03-01 through T-03-04 all addressed).

## User Setup Required

**expo-task-manager installation recommended** to enable background notification receipt:
```bash
cd apps/mobile
npx expo install expo-task-manager
```
Without it, the background task silently does nothing (safe no-op). Foreground and tapped-notification flows work without it.

## Next Phase Readiness

- Phase 2 (notification sending) can call POST /notifications/token — the endpoint exists (Plan 01-01) and tokens will be registered on first authenticated launch
- Phase 3 (in-app notification center) can add `notificationStore.getState().syncUnreadCount()` to the AppState listener placeholder in _layout.tsx
- Phase 5 (preferences UI) is partially pre-built — the NotifSubScreen already has toggles wired to user_profiles.settings.notif_prefs

---
*Phase: 01-infrastructure-configuration*
*Completed: 2026-05-26*
