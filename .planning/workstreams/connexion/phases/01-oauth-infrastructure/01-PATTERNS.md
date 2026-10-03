# Phase 1: OAuth Infrastructure - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 2 (config-only phase — no application/business logic files)
**Analogs found:** 2 / 2 (both exact — same repo, same file, most recent equivalent config-addition commit)

## Scope Note

This phase is infra/dashboard config, not feature code (per orchestrator note). There is no
controller/component/service/model to map. The two files this phase touches — `app.json` and
`package.json` — both have a near-perfect analog: the same files, at the commit where
`react-native-health` / `react-native-health-connect` were added for the wearables plugin. That
commit is structurally identical to this phase's task: add native SDK deps, add a config plugin
entry, add iOS entitlements, add Android permissions — all additive, all inside the same two
files. A second, equally important pattern for this phase is not a source-code pattern at all: the
**dashboard-checkpoint task format** used by the sibling `notification-mobile` workstream's
Phase 1, which is the only prior instance in this repo of a plan that stops mid-execution for a
human to perform external dashboard steps (Firebase Console) and resume on a typed signal — directly
analogous to D-03's Google Cloud Console / Apple Developer / Supabase dashboard checkpoints.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `apps/mobile/app.json` | config | batch (static build-time config, no runtime data flow) | `apps/mobile/app.json` @ commit `ffe890ec` (health/HealthKit/Health Connect addition) | exact — same file, same kind of change (entitlements + permissions + config plugin) |
| `apps/mobile/package.json` | config | batch | `apps/mobile/package.json` @ commit `ffe890ec` (added `react-native-health` + `react-native-health-connect`) | exact — same file, same kind of change (native SDK dependency addition) |
| *(plan document, not source)* — dashboard checkpoint task(s) for Google Cloud Console / Apple Developer / Supabase provider setup | N/A (planning artifact) | N/A | `.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/01-04-PLAN.md` (Firebase Console checkpoint tasks) | role-match — only prior "stop and wait for dashboard action" task pattern in this repo |

No controller, service, component, hook, or store files are created or modified in this phase.
`apps/mobile/app/(auth)/welcome.tsx` and `apps/mobile/src/lib/supabase.ts` are read-only references
(shown below) — they are **not** modified until Phase 2.

## Pattern Assignments

### `apps/mobile/app.json` (config, batch)

**Analog:** `apps/mobile/app.json` as changed in commit `ffe890ec` ("feat: add wearables plugin for
health data synchronization") — the most recent precedent for "add a native SDK's iOS entitlements +
Android permissions + config-plugin entry" in this exact file.

**Current relevant sections (as of HEAD)** — `apps/mobile/app.json`:
- `ios.entitlements` (lines 27-32): currently only HealthKit keys present —
  ```json
  "entitlements": {
    "com.apple.developer.healthkit": true,
    "com.apple.developer.healthkit.background-delivery": true,
    "com.apple.developer.healthkit.access": [],
    "aps-environment": "development"
  }
  ```
- `plugins` array (lines 67-121): config-plugin entries are a mix of bare strings (`"expo-router"`)
  and `[name, options]` tuples (`["expo-notifications", {...}]`, `["react-native-health-connect", {...}]`).
  The `react-native-health-connect` entry (lines 97-118) is the closest structural twin to what this
  phase needs to add for `@react-native-google-signin/google-signin`:
  ```json
  [
    "react-native-health-connect",
    {
      "requestPermissions": {
        "read": ["Steps", "HeartRate", "SleepSession", ...],
        "write": ["ExerciseSession", "Steps"]
      }
    }
  ]
  ```
- `android.permissions` array (lines 42-60): flat array of `"android.permission.X"` strings, appended
  to (never reordered/removed) each time a new native capability is added.
- `ios.bundleIdentifier` / `android.package` = `com.ziko.mobile` (both platforms, unchanged — this is
  the identifier Google/Apple dashboard clients bind to via SHA-1/App ID, not something this phase edits).

**Diff shape to copy** (from `git show ffe890ec -- apps/mobile/app.json`, the precedent for this
phase's `app.json` edit):
```diff
     "ios": {
       "bundleIdentifier": "com.ziko.mobile",
-      "supportsTablet": false
+      "supportsTablet": false,
+      "infoPlist": {
+        "NSHealthShareUsageDescription": "...",
+        "NSHealthUpdateUsageDescription": "..."
+      },
+      "entitlements": {
+        "com.apple.developer.healthkit": true,
+        ...
+      }
     },
     "android": {
       ...
-      "package": "com.ziko.mobile"
+      "package": "com.ziko.mobile",
+      "permissions": [
+        "android.permission.health.READ_STEPS",
+        ...
+      ]
     },
     "plugins": [
       ...
-      "expo-secure-store"
+      "expo-secure-store",
+      [
+        "react-native-health-connect",
+        { "requestPermissions": { "read": [...], "write": [...] } }
+      ]
     ]
```

**How this phase's edit maps onto that shape** (per RESEARCH.md's `Recommended app.json Changes`):
- `ios.usesAppleSignIn: true` is the equivalent of the `ios.entitlements` addition in the analog —
  except here the config **plugin** owns entitlement generation (do not hand-add
  `com.apple.developer.applesignin` to `ios.entitlements` the way HealthKit keys were hand-added;
  RESEARCH.md Pitfall 5 explicitly warns against duplicating this via both mechanisms).
- `plugins` array gets two new entries, following the exact same bare-string / tuple-with-options
  convention already established:
  ```json
  "expo-apple-authentication",
  [
    "@react-native-google-signin/google-signin",
    { "iosUrlScheme": "com.googleusercontent.apps.<FROM_DASHBOARD_CHECKPOINT>" }
  ]
  ```
- No `android.permissions` addition is needed for Google/Apple Sign-In (RESEARCH.md Pitfall 1) — this
  is the one place this phase's edit is *narrower* than the analog commit, not wider.
- No new `infoPlist` keys are needed (unlike the analog's `NSHealthShareUsageDescription` additions) —
  native sign-in SDKs don't require an iOS usage-description string the way HealthKit/Camera/Location do.

**Existing plugins array for reference** (`apps/mobile/app.json` lines 67-121, full current state):
```json
"plugins": [
  ["expo-build-properties", { "android": { "minSdkVersion": 26 } }],
  ["expo-notifications", { "icon": "...", "color": "#FF5C1A", "defaultChannel": "default", "enableBackgroundRemoteNotifications": true }],
  "expo-dev-client",
  "expo-router",
  "expo-font",
  ["expo-splash-screen", { "backgroundColor": "#F7F6F3", "image": "...", "imageWidth": 200 }],
  "expo-secure-store",
  ["react-native-health-connect", { "requestPermissions": { "read": [...], "write": [...] } }],
  "@react-native-community/datetimepicker",
  "@sentry/react-native"
]
```

---

### `apps/mobile/package.json` (config, batch)

**Analog:** `apps/mobile/package.json` as changed in commit `ffe890ec` — added two native SDK
dependencies (`react-native-health`, `react-native-health-connect`) alphabetically into the existing
`dependencies` block, no version research needed at diff-authoring time (pins were filled in by
`expo install` at execution time — this phase does the same via
`npx expo install @react-native-google-signin/google-signin expo-apple-authentication` per
RESEARCH.md's Installation section).

**Diff shape to copy:**
```diff
     "react-native": "^0.81.5",
     "react-native-chart-kit": "^6.12.0",
     "react-native-gesture-handler": "~2.28.0",
+    "react-native-health": "^1.19.0",
+    "react-native-health-connect": "^3.5.0",
     "react-native-reanimated": "~4.1.1",
```

**How this phase's edit maps onto that shape:** insert `@react-native-google-signin/google-signin`
and `expo-apple-authentication` alphabetically into the existing `dependencies` object (current file:
`apps/mobile/package.json` lines 17-83) — `@react-native-google-signin/google-signin` sorts near the
top alongside other `@`-scoped packages (lines 18-39: `@expo-google-fonts/*`, `@gluestack-*`,
`@react-native-async-storage/async-storage`, `@react-native-community/datetimepicker`, `@sentry/*`,
`@supabase/*`, `@tanstack/*`, `@ziko/*`); `expo-apple-authentication` sorts alphabetically among the
existing `expo-*` entries (lines 42-65, between `expo-av`/`expo-build-properties` and
`expo-camera`). Use `npx expo install <pkg>` (not raw `npm install`) so Expo resolves the SDK-54-
compatible version, matching how `react-native-health-connect: ^3.5.0` was pinned to the SDK-current
range rather than hand-typed.

---

### Dashboard-checkpoint task pattern (planning artifact, not source code)

**Analog:** `.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/01-04-PLAN.md`,
Task 1 (lines 81-121) — `type="checkpoint:human-action" gate="blocking"`. This is the only precedent
in the repo for a plan task that stops for a human to perform steps in an external dashboard
(Firebase Console, in that case) and resumes only on a typed confirmation signal — structurally
identical to what D-03 requires for the Google Cloud Console / Apple Developer / Supabase Auth
provider checkpoints in this phase.

**Structure to copy:**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <name>Task N: <dashboard action name></name>
  <read_first>
    - <files with the config values already written by the preceding auto task>
    - <CONTEXT.md decision IDs relevant to this checkpoint>
  </read_first>
  <what-built><what the preceding auto task(s) already wrote to app.json/package.json></what-built>
  <how-to-verify>
    Complete these manual steps:
    Step 1 — <precise dashboard navigation: "Go to console...", "Project Settings → ...">
    Step 2 — <exact value to copy back into which file/field>
    ...
    Confirm all steps are done before typing "ready".
  </how-to-verify>
  <resume-signal>Type "ready" when <precise condition></resume-signal>
  <acceptance_criteria>
    - <verifiable state, e.g. "eas credentials shows ... is configured">
  </acceptance_criteria>
  <done><one-line summary of the resulting state></done>
</task>
```

**Apply to:** each of this phase's three blocking checkpoints per D-03 — Google Cloud Console OAuth
client creation (Web/Android/iOS clients + SHA-1 registration), Apple Developer Sign In with Apple
capability (native-only per RESEARCH.md Pitfall 8, not the Services ID/Key path), and Supabase Auth
provider activation (Google + Apple, including Skip Nonce Check per RESEARCH.md Pitfall 2). Each
checkpoint's `<how-to-verify>` should mirror the Firebase-Console analog's level of precision
(named menu paths, not vague instructions), and each `<resume-signal>` should require the specific
value the checkpoint produces (Client ID, SHA-1 confirmation, etc.) before the next auto task
consumes it — matching D-03's "do not proceed past a checkpoint without its produced value" rule.

## Shared Patterns

### Additive-only, non-destructive config edits
**Source:** `apps/mobile/app.json` / `apps/mobile/package.json` history (every prior native-SDK
addition — health, notifications, this phase's OAuth SDKs)
**Apply to:** both files this phase touches
Every prior native-dependency addition in this repo (`react-native-health-connect`,
`expo-notifications`, `expo-build-properties`) was a pure append: no existing plugin/permission/
entitlement/dependency entry was reordered or removed. `git diff` after this phase's edits should
show only `+` lines against `app.json` and `package.json` (matching `01-02-PLAN.md`'s own
acceptance criterion: "No existing entries in plugins, permissions, or infoPlist are removed").

### Config-plugin array convention
**Source:** `apps/mobile/app.json` `plugins` array (lines 67-121)
**Apply to:** `app.json` plugin insertions for `expo-apple-authentication` / `@react-native-google-signin/google-signin`
Bare string when the plugin needs no options (`"expo-dev-client"`, `"expo-router"`,
`"expo-secure-store"` — this covers `expo-apple-authentication`, which per RESEARCH.md needs no
options besides the top-level `ios.usesAppleSignIn: true` flag); `[name, optionsObject]` tuple when
config is required (`["react-native-health-connect", {...}]`, `["expo-notifications", {...}]` — this
covers `@react-native-google-signin/google-signin`, which needs `{ iosUrlScheme }`).

### EAS secret / dashboard-value handoff, never committed
**Source:** `.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/01-02-PLAN.md`
(D-10: `google-services.json` as EAS file secret) and `01-04-PLAN.md` Task 1 (`eas secret:create`,
`eas credentials`)
**Apply to:** any Google/Apple dashboard-produced value this phase needs to persist
Values produced by a dashboard checkpoint (Client IDs, the iOS `iosUrlScheme`) are safe to write
directly into the committed `app.json` (they are public-by-design, per RESEARCH.md's Security
Domain table — "OAuth client ID leakage... Not a real risk"). Contrast with genuinely sensitive
values (Web client *Secret*, the Supabase Apple/Google provider secrets) which never touch this
repo at all — they're entered directly into the Supabase dashboard, exactly as `google-services.json`
(sensitive) was routed through `eas secret:create` rather than committed, while `googleServicesFile`
(the non-sensitive *path reference* to it) was committed to `app.json` directly.

## No Analog Found / Out of Scope for This Phase

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/mobile/app/(auth)/welcome.tsx` | component | request-response | Read for context only (CONTEXT.md lines 78, 94-119) — Google/Apple button wiring (`GoogleSignin.signIn()`, `AppleAuthentication.signInAsync()`, `signInWithIdToken`) is explicitly Phase 2 scope, not Phase 1 |
| `apps/mobile/src/lib/googleSignIn.ts` (or similar shared OAuth config helper) | utility | — | Orchestrator flagged this as a *possible* file; RESEARCH.md's own code examples (`GoogleSignin.configure({ webClientId })`) show this call living inline in the Phase 2 button-handler file (mirroring `welcome.tsx`'s existing inline `handleGoogle`), not a separate Phase 1 config module. No analog needed — do not create this file in Phase 1 unless the planner has a specific reason RESEARCH.md doesn't surface |
| `apps/mobile/eas.json` | config | batch | Not expected to change (RESEARCH.md Assumption A4: preview/production share one implicit EAS-managed keystore, no per-profile credential override exists) — confirm via `eas credentials` during the dashboard checkpoint rather than editing this file |

## Metadata

**Analog search scope:** `apps/mobile/app.json`, `apps/mobile/package.json`, `apps/mobile/eas.json`,
`apps/mobile/app/(auth)/welcome.tsx`, `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/stores/authStore.ts`
(read for context, not modified), git history of `apps/mobile/app.json` (16 commits reviewed),
`.planning/workstreams/notification-mobile/phases/01-infrastructure-configuration/` (sibling
config-only phase, 4 plans reviewed for structural precedent)
**Files scanned:** ~10
**Pattern extraction date:** 2026-08-23
