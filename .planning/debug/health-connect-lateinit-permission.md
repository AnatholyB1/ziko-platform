---
status: resolved
trigger: "Authorization error when connecting Samsung Health or other health apps via Health Connect"
created: "2026-05-21"
updated: "2026-05-21"
workstream: milestone-mobile
sentry: ZIKO-MOBILE-4
---

# Debug Session — health-connect-lateinit-permission

## Symptoms

- **Expected**: Tapping "Connecter Health Connect" opens the system permissions dialog
- **Actual**: Fatal crash — `UninitializedPropertyAccessException`
- **Error**: `lateinit property requestPermission has not been initialized` at `HealthConnectPermissionDelegate.launchPermissionsDialog:45`
- **Timeline**: Never worked (first report 2026-05-19)
- **Device**: Samsung SM-S926B, Android 16, production build 1.4.1+13

## Current Focus

hypothesis: HealthConnectPermissionDelegate.setPermissionDelegate() was never called from MainActivity.onCreate(), so both lateinit ActivityResultLauncher fields are uninitialized when requestPermission() is triggered from JS.
test: Read HealthConnectPermissionDelegate.kt source
expecting: Confirm setPermissionDelegate(activity) must be called before launchPermissionsDialog
next_action: RESOLVED — applied fix to MainActivity.kt

## Evidence

- timestamp: 2026-05-21
  observation: HealthConnectPermissionDelegate is a Kotlin `object` with `lateinit var requestPermission: ActivityResultLauncher<Set<String>>`
  source: node_modules/react-native-health-connect/.../HealthConnectPermissionDelegate.kt:19

- timestamp: 2026-05-21
  observation: setPermissionDelegate(activity) must be called in MainActivity.onCreate() to register the ActivityResultLauncher before onStart()
  source: HealthConnectPermissionDelegate.kt:22-42

- timestamp: 2026-05-21
  observation: MainActivity.kt has no import or call to HealthConnectPermissionDelegate
  source: apps/mobile/android/app/src/main/java/com/ziko/mobile/MainActivity.kt

## Eliminated

- hypothesis: react-native-health-connect not installed
  eliminated_by: package.json shows ^3.5.0

## Resolution

root_cause: "HealthConnectPermissionDelegate.setPermissionDelegate(activity) was never called in MainActivity.onCreate(). Without this call, both `requestPermission` and `requestRoutePermission` lateinit vars remain uninitialized. When the user taps 'Connect', the JS layer calls HC.requestPermission() which hits launchPermissionsDialog() → crash."
fix: "Added HealthConnectPermissionDelegate.setPermissionDelegate(this) call in MainActivity.onCreate() before super.onCreate(null). Added the import."
files_changed:
  - apps/mobile/android/app/src/main/java/com/ziko/mobile/MainActivity.kt
