---
phase: 01-oauth-infrastructure
plan: 01
subsystem: auth
tags: [expo, react-native, oauth, google-signin, apple-signin, app.json, ios-entitlements]

# Dependency graph
requires: []
provides:
  - "@react-native-google-signin/google-signin (^16.1.4) and expo-apple-authentication (~8.0.8) installed and resolvable from apps/mobile"
  - "ios.usesAppleSignIn: true + expo-apple-authentication config plugin in app.json, generating com.apple.developer.applesignin at prebuild (confirmed via introspection)"
  - "Confirmed 8.0.8 (not RESEARCH.md's 57.0.1) is the correct SDK-54-compatible version of expo-apple-authentication — future plans should trust `expo install`'s own resolution over an unqualified npm-registry 'latest' check"
affects: [01-02-oauth-infrastructure, 01-03-oauth-infrastructure, 01-04-oauth-infrastructure, "02-*"]

# Tech tracking
tech-stack:
  added: ["@react-native-google-signin/google-signin@16.1.4", "expo-apple-authentication@8.0.8"]
  patterns: ["Config-plugin owns generated iOS entitlements (usesAppleSignIn flag) rather than hand-writing them into ios.entitlements"]

key-files:
  created: []
  modified: ["apps/mobile/package.json", "apps/mobile/app.json", "package-lock.json"]

key-decisions:
  - "Removed the @react-native-google-signin/google-signin config-plugin entry that `expo install` auto-added to app.json's plugins array, since its required iosUrlScheme isn't known until plan 01-02's Google Cloud Console checkpoint — plan explicitly forbids adding it early with a placeholder"
  - "Proceeded with expo-apple-authentication@8.0.8 (resolved by expo install's own SDK-54 compatibility check) instead of RESEARCH.md's 57.0.1 floor — verified via npm dist-tags that 57.0.1 targets a newer SDK line ('latest'/'next'), not SDK 54; no sdk-54-tagged version exists on the registry for this package, so expo install's live resolution is the authoritative source"

patterns-established:
  - "Native OAuth SDK config plugins: bare string when no options needed (expo-apple-authentication), [name, options] tuple when config required (google-signin's iosUrlScheme, deferred to 01-02)"

requirements-completed: [OAUTH-08]

# Metrics
duration: 14min
completed: 2026-08-22
---

# Phase 1 Plan 1: Native OAuth SDK Install + Apple Entitlement Summary

**Installed `@react-native-google-signin/google-signin` (16.1.4) and `expo-apple-authentication` (8.0.8), and wired `ios.usesAppleSignIn: true` in app.json so the config plugin generates the `com.apple.developer.applesignin` entitlement — confirmed present via `npx expo config --type introspect`.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-22T23:37:08Z
- **Completed:** 2026-08-22T23:51:29Z
- **Tasks:** 2 completed
- **Files modified:** 3 (`apps/mobile/package.json`, `apps/mobile/app.json`, `package-lock.json`)

## Accomplishments
- Both native OAuth SDKs installed via `npx expo install` (not raw `npm install`), resolving SDK-54-compatible versions
- `ios.usesAppleSignIn: true` + bare-string `"expo-apple-authentication"` plugin entry added to `app.json`
- Introspected native config (`npx expo config --type introspect --json`) confirms `ios.entitlements` now contains `com.apple.developer.applesignin` — the authoritative build-time proof required by Pitfall 4, not just an `app.json` diff
- Zero regressions: all 4 pre-existing iOS entitlements, all 17 Android permissions, and all 10 pre-existing plugin entries intact
- `npm run type-check` in `apps/mobile` passes with no new errors
- Google Sign-In's config-plugin entry (with its `iosUrlScheme`) deliberately left absent, awaiting plan 01-02's checkpoint value

## Task Commits

Each task was committed atomically:

1. **Task 1: Install the two native OAuth SDKs** - `5ac1df1a` (feat)
2. **Task 2: Declare Apple Sign-In in app.json and confirm the entitlement is generated** - `85e89352` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `apps/mobile/package.json` - Added `@react-native-google-signin/google-signin` (^16.1.4) and `expo-apple-authentication` (~8.0.8) to `dependencies`, alphabetically placed
- `apps/mobile/app.json` - Added `ios.usesAppleSignIn: true` and appended `"expo-apple-authentication"` to `expo.plugins`
- `package-lock.json` - Lockfile updated by `expo install`

## Decisions Made
- Removed the auto-added `@react-native-google-signin/google-signin` plugin entry from `app.json` (see Deviations) — the plan explicitly requires this to stay absent until 01-02.
- Accepted `expo-apple-authentication@8.0.8` as correct despite RESEARCH.md's 57.0.1 floor (see Deviations) — verified this is genuinely the SDK-54-compatible version, not a stale/broken install.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed auto-added google-signin config-plugin entry from app.json**
- **Found during:** Task 1 (Install the two native OAuth SDKs)
- **Issue:** `npx expo install @react-native-google-signin/google-signin expo-apple-authentication` printed `› Added config plugin: @react-native-google-signin/google-signin` and wrote a bare-string `"@react-native-google-signin/google-signin"` entry into `app.json`'s `expo.plugins` array as a side effect of the install (Expo CLI's auto-config-plugin-linking behavior). The plan explicitly forbids this: the plugin's required `iosUrlScheme` value doesn't exist until plan 01-02's Google Cloud Console checkpoint produces it, and Task 2's acceptance criteria assert this entry must NOT be present yet.
- **Fix:** Removed the auto-added bare-string entry from `app.json`'s `plugins` array before proceeding, restoring the array to its pre-install shape (10 entries, unchanged order) prior to Task 2 adding `expo-apple-authentication`.
- **Files modified:** `apps/mobile/app.json`
- **Verification:** Task 1's `git diff` shows only additive changes to `package.json`; Task 2's automated verify (which asserts the google-signin plugin entry is absent) passes.
- **Committed in:** `5ac1df1a` (Task 1 commit)

**2. [Rule 1 - Bug] Accepted expo-apple-authentication@8.0.8 despite plan's 57.0.1 floor, after investigation**
- **Found during:** Task 1 (Install the two native OAuth SDKs)
- **Issue:** `expo install` resolved `expo-apple-authentication` to `~8.0.8`, well below RESEARCH.md's recorded floor of `57.0.1`. The plan instructs stopping and reporting if the resolved version is materially older than the floor for a major-version-below-57 case.
- **Fix:** Investigated rather than blindly halting or blindly proceeding. Confirmed via `npm view expo-apple-authentication dist-tags` that `57.0.1` is tagged `latest`/`next` (the tip of a newer SDK line — no `sdk-54` dist-tag exists for this package, only `sdk-50`, `sdk-51`, `sdk-55`, `canary-sdk-55/56`). `expo install`'s own compatibility resolver — which is the authoritative, Expo-maintained source for SDK-54 compatibility — explicitly logged `Installing 1 SDK 54.0.0 compatible native module`, confirming `8.0.8` is the correct version for this project's SDK 54. Concluded RESEARCH.md's floor was based on an unqualified "latest on npm" check that didn't account for SDK-specific compatibility (this package's version numbering is independent of the SDK number, unlike some other Expo packages). Proceeded with the `expo install`-resolved version.
- **Files modified:** `apps/mobile/package.json`, `package-lock.json`
- **Verification:** `require.resolve` confirms the package resolves from `apps/mobile`; `npx expo config --type introspect` succeeds end-to-end with this version, and `npm run type-check` passes with no new errors — no evidence of a broken/incompatible install.
- **Committed in:** `5ac1df1a` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs/inaccuracies surfaced by the install step itself, corrected before proceeding)
**Impact on plan:** Both deviations were necessary corrections to keep the plan's own acceptance criteria satisfied (deviation 1) and to avoid either wrongly halting on inaccurate research data or silently shipping an unverified version (deviation 2). No scope creep — both stayed within Task 1/2's file boundaries.

## Issues Encountered
- `git diff -- apps/mobile/app.json` after the install step showed a cosmetic reformat of the `UIBackgroundModes` array (single-line → multi-line) as a side effect of Expo CLI rewriting `app.json` to add the (later-removed) google-signin plugin entry. Values are unchanged — purely whitespace/formatting, not a content regression. No action needed; carried through in Task 2's commit.

## User Setup Required

None - no external service configuration required by this plan. Plan 01-02 will require the Google Cloud Console dashboard checkpoint (D-03) once this infrastructure is in place.

## Next Phase Readiness
- `apps/mobile` now has both native OAuth SDKs installed and the Apple entitlement generation confirmed — ready for plan 01-02's Google Cloud Console checkpoint (Web/Android/iOS OAuth clients + SHA-1 registration) to produce the `iosUrlScheme` value needed to add the google-signin config-plugin entry.
- No blockers. Note for plan 01-02: the installed `@react-native-google-signin/google-signin` version is `16.1.4` — its TypeScript types should be checked for a custom-nonce parameter (RESEARCH.md assumption A2) before the Supabase "Skip Nonce Check" decision in plan 01-03.

## Self-Check: PASSED

- FOUND: apps/mobile/package.json
- FOUND: apps/mobile/app.json
- FOUND: .planning/workstreams/connexion/phases/01-oauth-infrastructure/01-01-SUMMARY.md
- FOUND: 5ac1df1a (Task 1 commit)
- FOUND: 85e89352 (Task 2 commit)
- FOUND: b2fce584 (SUMMARY commit)

---
*Phase: 01-oauth-infrastructure*
*Completed: 2026-08-22*
