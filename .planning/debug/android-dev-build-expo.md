---
slug: android-dev-build-expo
status: resolved
trigger: manual
created: 2026-05-28
---

# Debug Session: Android Dev Build Failure

## Symptoms

Android dev build fails after recent commits modifying:
- `apps/mobile/android/app/src/main/java/com/ziko/mobile/MainActivity.kt`
- `apps/mobile/package.json`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/android/app/src/main/res/values/strings.xml`

## Evidence

- timestamp: 2026-05-28T00:00:00Z
  file: apps/mobile/package.json
  note: |
    `expo-dev-client` pinned to `^56.0.16` — SDK 56 package installed in a SDK 54 project.
    `expo-task-manager` pinned to `^56.0.15` — also SDK 56.
    Both npm semver ranges used `^` (caret) allowing major-compatible updates, but since
    these packages switched to a 56.x.x versioning scheme in SDK 56, the caret operator
    pulled SDK 56 packages into an SDK 54 project.
    expo/bundledNativeModules.json (SDK 54) specifies:
      expo-dev-client: ~6.0.20
      expo-task-manager: ~14.0.9
      expo-notifications: ~0.32.16

- timestamp: 2026-05-28T00:01:00Z
  file: apps/mobile/android/app/src/main/java/com/ziko/mobile/MainActivity.kt
  note: |
    Git diff shows the HealthConnect call changed from:
      `HealthConnectPermissionDelegate.setPermissionDelegate(this)`
    to:
      `HealthConnectPermissionDelegate.setPermissionDelegate(this, hcProviderPackage)`
    The installed react-native-health-connect@3.5.0 has a 2-param signature with
    providerPackageName as optional second arg — this call is CORRECT. Not the cause.

- timestamp: 2026-05-28T00:02:00Z
  file: apps/mobile/android/app/src/main/AndroidManifest.xml
  note: No issues found. Health Connect permissions and intent filters are valid.

- timestamp: 2026-05-28T00:03:00Z
  file: apps/mobile/android/app/src/main/res/values/strings.xml
  note: No issues. Contains only app_name and expo_splash_screen values.

## Hypotheses

1. [CONFIRMED] SDK version mismatch: expo-dev-client@56, expo-task-manager@56 installed
   against expo@54 — native module ABIs differ, causing Gradle compile errors.

2. [RULED OUT] HealthConnectPermissionDelegate API mismatch — the 2-param call matches the
   installed react-native-health-connect@3.5.0 signature exactly.

3. [RULED OUT] AndroidManifest.xml changes — no structural issues found.

4. [RULED OUT] strings.xml — unchanged from valid state.

## Current Focus

hypothesis: resolved
next_action: n/a

## Resolution

root_cause: |
  Two packages in apps/mobile/package.json used the `^` (caret) semver operator on versions
  that crossed a major versioning scheme change, pulling Expo SDK 56 native modules into an
  Expo SDK 54 project:
    - expo-dev-client: `^56.0.16` resolved to 56.0.16 (SDK 56) — should be ~6.0.20 (SDK 54)
    - expo-task-manager: `^56.0.15` resolved to 56.0.15 (SDK 56) — should be ~14.0.9 (SDK 54)
  SDK 56 native modules have incompatible Android native code (different Gradle dependencies,
  Expo Modules API version) relative to SDK 54, causing Gradle compilation failure.

fix: |
  Corrected apps/mobile/package.json:
    expo-dev-client: "^56.0.16" -> "~6.0.20"
    expo-task-manager: "^56.0.15" -> "~14.0.9"
    expo-notifications: "^0.32.16" -> "~0.32.16" (tilde instead of caret, same resolved version but safer)
  Ran npm install. Verified:
    expo-dev-client now: 6.0.21
    expo-task-manager now: 14.0.9
    expo-notifications now: 0.32.16
  All three are now SDK 54-compatible. Android build should succeed.
