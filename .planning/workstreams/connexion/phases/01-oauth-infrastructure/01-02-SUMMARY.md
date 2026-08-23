---
phase: 01-oauth-infrastructure
plan: 02
subsystem: auth
tags: [oauth, google-signin, google-cloud-console, expo, app.json, checkpoint]

# Dependency graph
requires:
  - phase: 01-01
    provides: "@react-native-google-signin/google-signin and expo-apple-authentication installed; Apple entitlement wired; google-signin config-plugin entry deliberately left absent pending this plan"
provides: []
affects: ["01-03-oauth-infrastructure", "01-04-oauth-infrastructure", "02-*"]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions: []

patterns-established: []

requirements-completed: []

# Metrics
duration: 8min (blocked)
completed: BLOCKED
---

# Phase 1 Plan 2: Google OAuth Client Registration Summary

**BLOCKED at Task 1 — Google Cloud Console OAuth client registration (Web/Android/iOS) requires human action in an external dashboard; no code changes have been made yet.**

## Performance

- **Duration:** ~8 min (pre-checkpoint verification only)
- **Started:** 2026-08-23T00:00:00Z (approx)
- **Tasks:** 0/3 completed
- **Files modified:** 0

## Accomplishments (pre-checkpoint verification)
- Confirmed `apps/mobile/app.json` `ios.bundleIdentifier` and `android.package` both equal `com.ziko.mobile`, as required before quoting them to the user in the checkpoint instructions
- Confirmed `apps/mobile/eas.json` has no per-profile `credentials` override on `preview`, `internal`, or `production` build profiles — supports RESEARCH assumption A4 (all three share the one implicit EAS-managed release keystore)
- Read 01-01-SUMMARY.md, PROJECT.md, workstream STATE.md, and config.json to confirm project context before starting

## Task Commits

None yet — Task 1 is a blocking human-action checkpoint and has not been resumed. No commits were made in this session.

## Files Created/Modified

None yet.

## Decisions Made

None yet — no downstream value has been assumed per D-03. Awaiting human-confirmed WEB_CLIENT_ID, ANDROID_CLIENT_ID, IOS_CLIENT_ID, SHA1_REGISTERED, GCP_PROJECT, STEP_5_DONE from the Google Cloud Console checkpoint.

## Deviations from Plan

None - no code work has started; nothing to deviate from yet.

## Issues Encountered

None. This is the expected blocking checkpoint (D-03) — Google Sign-In client registration is entirely dashboard-driven and has no code-side equivalent (RESEARCH "Don't Hand-Roll").

## User Setup Required

**External service configuration required.** See Task 1's `<how-to-verify>` block in
`01-02-PLAN.md` for the full step-by-step (Google Cloud Console client creation for Web/Android/iOS,
`npx eas-cli@latest credentials` SHA-1 read, optional `google-services.json` refresh). Summary of what
is needed:
1. Decide which Google Cloud project to use (existing Firebase-backed project for `com.ziko.mobile`, or a new one)
2. Read the EAS-managed release keystore SHA-1 via `npx eas-cli@latest credentials` (Android → production, then preview)
3. Create a Web OAuth client (redirect URI `https://slkobhavpwsubnsmuhya.supabase.co/auth/v1/callback`) — copy Client ID AND Secret (secret must NOT be pasted back here or committed)
4. Create an Android OAuth client bound to `com.ziko.mobile` + the SHA-1 from step 2
5. Create an iOS OAuth client bound to `com.ziko.mobile`
6. If the existing Firebase-backed project was used, refresh `google-services.json` and re-upload it as the `GOOGLE_SERVICES_JSON` EAS file secret
7. Report back: `WEB_CLIENT_ID`, `ANDROID_CLIENT_ID`, `IOS_CLIENT_ID`, `SHA1_REGISTERED`, `GCP_PROJECT`, `STEP_5_DONE`

## Next Phase Readiness

Not ready — this plan is blocked at Task 1. Once the human supplies the six confirmed values, a
continuation agent should:
- Resume at Task 2 (wire `google-signin` config plugin + `expo.extra.googleSignIn` into `app.json`)
- Then Task 3 (verify installed `@react-native-google-signin/google-signin` version's nonce support, read-only)
- Then complete this SUMMARY.md with real values, task commits, and self-check

## Self-Check: PASSED

- FOUND: apps/mobile/app.json (bundle IDs verified: `com.ziko.mobile` on both platforms)
- FOUND: apps/mobile/eas.json (no per-profile credentials override on preview/internal/production)
- No commits to verify yet (0 tasks completed)

---
*Phase: 01-oauth-infrastructure*
*Status: BLOCKED — awaiting human action at Task 1*
