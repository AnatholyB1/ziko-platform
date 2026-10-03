# Phase 6 Plan 18: Mobile build against portfolio - Summary

Status: BLOCKED at Task 3 step (3) - EAS preview build ERRORED (Sentry gradle upload task). Tasks 1-2 done, Task 3 steps (1) and (2) done. Task 4 (device checklist) not started. No `MOBILE INTERNAL CHECKLIST` verdict is written.

## Done

- Authorization: `Typed authorization: approve ubxllsvanurkwkohzxau option-mobile-build` present (commit bad70585); Step 0 grep passed.
- EAS env switch (eas-cli 24.10.0 pinned): `--surface mobile --dest eas --eas-env production` and `--eas-env preview`, target portfolio, applied. Fingerprints (non-secret): URL a3934fcc, key e4575253.
- `--verify-remote` (names only): production and preview both show EXPO_PUBLIC_SUPABASE_URL present, EXPO_PUBLIC_SUPABASE_KEY present. EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE left unset.
- eas.json: `"environment"` added (preview -> preview; internal, production -> production; development unchanged). app.json expo.version and android versionName 1.4.1 -> 1.5.0. versionCode untouched, no runtimeVersion/updates. Mobile tsc passed.
- Commit ccb3b927 `chore(06-18): bind EAS envs and bump mobile to 1.5.0` on gsd/phase-6-cutover, pushed.
- PR #41, all checks green (type-check/lint/test, migration-guard, bundle verifications, GitGuardian), merged with `gh pr merge --merge`. Merge commit 8d3896310e33cb6c224d61bbf614f5ff6699b9bb (origin/main).

## Build attempts (preview profile, from a clean worktree of origin/main 8d389631)

1. Attempt 1 failed locally before upload: "Failed to resolve plugin for module expo-build-properties" because the clean worktree had no node_modules. Fixed with `npm ci --ignore-scripts` in the worktree (lockfile install, no new packages; node_modules is gitignored so it is not in the EAS archive).
2. Attempt 2: build id 111958ac-a2d5-4f33-a87b-6b5d2dc4cbdd, status ERRORED, appVersion 1.5.0, git 8d389631, created 19:25:07Z, ended 19:35:16Z (about 10 min).
   Logs: https://expo.dev/accounts/anatholyb/projects/ziko-mobile/builds/111958ac-a2d5-4f33-a87b-6b5d2dc4cbdd
   - Build env as seen in the log inlined the portfolio URL (ubxllsvanurkwkohzxau.supabase.co): the env binding works.
   - Failure: `EAS_BUILD_UNKNOWN_GRADLE_ERROR`, "Run gradlew" phase. Task `:app:createBundleReleaseJsAndAssets_SentryUpload_com.ziko.mobile@1.5.0+15_15` FAILED with sentry-cli `error: An organization ID or slug is required (provide with --org)` (sentry.gradle line 149). Env `SENTRY_DISABLE_AUTO_UPLOAD="true"` was present in the log but did not stop the upload task in this profile run.
   - expo-doctor also exited non-zero (non-fatal, build continued).
   - Not retried further, per instructions. No artifact, no install URL.

## Artifacts / unexpected

- Build id: 111958ac-a2d5-4f33-a87b-6b5d2dc4cbdd (ERRORED). Artifact URL: none.
- Previous successful builds 8d909636 / 97673059 (internal profile, 1.4.1, May 31) used the same Sentry setup, so this is a new regression or env difference to investigate (Sentry org/project config or the disable flag).
- No v*/beta* tag pushed, no `eas submit`, no production/internal build.

## Proposed fix options (not applied; need user decision)

- Look at why SENTRY_DISABLE_AUTO_UPLOAD=true does not skip the gradle upload (sentry.properties / SENTRY_ORG / @sentry/react-native plugin config in app.json), or
- Add SENTRY_ALLOW_FAILURE=true or the Sentry org/project in the preview build env via eas.json (needs another PR + merge, then a rebuild).

## Task 4

Not started. Awaiting a successful build before the device checklist.
