---
phase: 06-local-reminders-app-updates
plan: "04"
subsystem: mobile/notifications
tags: [ota, expo-updates, notification-center, app-updates]
dependency_graph:
  requires: []
  provides: [ota-update-card]
  affects: [apps/mobile/app/(app)/notifications.tsx]
tech_stack:
  added: []
  patterns: [useUpdates hook, ListHeaderComponent injection, __DEV__ guard]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/notifications.tsx
decisions:
  - OTA card client-side only — no notification_log write, no DB involvement (D-09)
  - Updates.reloadAsync() called directly on tap — no confirmation dialog (D-10)
  - System tint color (#6B6963) for icon — matches TYPE_META.system pattern (D-11)
  - debugShowOTA defaults to false, gated by __DEV__ — production safe even if accidentally set
metrics:
  duration_minutes: 8
  completed_date: "2026-05-28"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
---

# Phase 06 Plan 04: OTA Update Card in Notification Center Summary

OTA update card injected into notifications.tsx via expo-updates useUpdates() hook and ListHeaderComponent, with __DEV__ debug override for visual testing.

## What Was Built

Added a client-side OTA update card to the notification center screen (`apps/mobile/app/(app)/notifications.tsx`):

1. **`import * as Updates from 'expo-updates'`** — wired at the top of the file
2. **`OTAUpdateCard` component** — a card styled identically to `NFItem` with:
   - `refresh-circle-outline` Ionicons icon at system tint (#6B6963)
   - Title: "Mise à jour disponible" (fontWeight 700)
   - Body: "Une nouvelle version de l'app est prête."
   - CTA: "Mettre à jour" in PRIMARY (#FF5C1A)
3. **`Updates.useUpdates()` hook** inside `NotificationsScreen` — destructures `isUpdateAvailable`
4. **`debugShowOTA`** debug override: `__DEV__ && false` — flip to `true` for local UI testing
5. **`showOTACard`** = `isUpdateAvailable || debugShowOTA`
6. **`ListHeaderComponent`** on the FlatList — renders `<OTAUpdateCard onPress={async () => { await Updates.reloadAsync(); }} />` when `showOTACard` is true, otherwise `null`

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Add OTAUpdateCard component + useUpdates wiring + ListHeaderComponent | Done | 2e8c20a |
| 2 | Verify OTA card UI with debug flag | Checkpoint (human-verify) | — |

## Verification Results

All automated verification checks passed:
- `isUpdateAvailable` count: 2 (destructure + showOTACard usage)
- `reloadAsync` count: 1
- `OTAUpdateCard` count: 3 (definition + usage in ListHeaderComponent + prop type)
- `__DEV__` count: 1
- `debugShowOTA.*false` count: 1 (flag safely defaults to false)
- Pre-existing TypeScript errors in unrelated files (TS2307 module resolution for plugin screens, TS2339 in useNotificationSetup.ts) — none introduced by this plan

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `isUpdateAvailable` is a real live value from `Updates.useUpdates()`. The `debugShowOTA` flag defaults to `false` by design (for manual UI testing only).

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model:
- T-06-08: `isUpdateAvailable` can only be true for signed Expo EAS updates — accept
- T-06-09: `reloadAsync()` is user-initiated (explicit tap) — accept
- T-06-10: `debugShowOTA = __DEV__ && false` — `__DEV__` is always `false` in production builds, preventing any accidental exposure

## Self-Check: PASSED

- File `apps/mobile/app/(app)/notifications.tsx` exists and contains all required patterns
- Commit `2e8c20a` exists in git log
- No unintended deletions in commit
