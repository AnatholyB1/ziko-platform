# Phase 6 Plan 18: Mobile build against portfolio - Summary

Status: complete-with-waiver (device checklist waived by user). Tasks 1-3 done (portfolio-pointed Android 1.5.0 preview APK built). Task 4 (device checklist M-01..M-12 + W-05 and signup-landing proof) not started. No `MOBILE INTERNAL CHECKLIST` verdict is written.

## Done

- Authorization: `Typed authorization: approve ubxllsvanurkwkohzxau option-mobile-build` present (commit bad70585); Step 0 grep passed.
- EAS env switch (eas-cli 24.10.0 pinned): `--surface mobile --dest eas --eas-env production` and `--eas-env preview`, target portfolio, applied. Fingerprints (non-secret): URL a3934fcc, key e4575253.
- `--verify-remote` (names only): production and preview both show EXPO_PUBLIC_SUPABASE_URL present, EXPO_PUBLIC_SUPABASE_KEY present. EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE left unset.
- eas.json: `"environment"` added (preview -> preview; internal, production -> production; development unchanged). app.json expo.version and android versionName 1.4.1 -> 1.5.0. versionCode untouched (remote appVersionSource), no runtimeVersion/updates. Mobile tsc passed.
- PR #41 (env binding + 1.5.0): commit ccb3b927, all checks green, merged. Merge commit 8d3896310e33cb6c224d61bbf614f5ff6699b9bb.
- PR #42 (Sentry preview fix): commit 6b472425 `fix(06-18): disable Sentry auto-upload in the preview build profile`, all checks green (type-check/lint/test, migration-guard, bundle verifications, GitGuardian), merged with `gh pr merge --merge`. Merge commit b292901d73d08eae11be10dcbafee9eb773aa1a2 (origin/main). It also carried the local planning-docs commits.

## Build attempts (preview profile, clean worktree of origin/main)

1. Attempt 1: local preflight failed ("Failed to resolve plugin for module expo-build-properties"), clean worktree had no node_modules. Fixed with `npm ci --ignore-scripts` in the worktree (lockfile install, nothing new).
2. Attempt 2: build 111958ac-a2d5-4f33-a87b-6b5d2dc4cbdd, ERRORED (git 8d389631, about 10 min). Gradle task `:app:createBundleReleaseJsAndAssets_SentryUpload_com.ziko.mobile@1.5.0+15_15` failed with sentry-cli `error: An organization ID or slug is required (provide with --org)`.
   - Root cause: `preview` was the only build profile without `"env": {"SENTRY_DISABLE_AUTO_UPLOAD": "true"}` (internal and production carry it, which is why the May internal builds passed), and no Sentry org is configured (sentry.properties relies on SENTRY_ORG env). The upload task therefore ran and failed.
   - Fix: PR #42 adds that env block to `build.preview` (no other change).
3. Attempt 3 (after PR #42): build id d05e6e41-6ea7-44b4-95a3-c17e291a9d0d, status FINISHED, appVersion 1.5.0, git b292901d, created 19:58:37Z, completed 20:24:14Z (about 25.6 min).
   - Build page / install URL: https://expo.dev/accounts/anatholyb/projects/ziko-mobile/builds/d05e6e41-6ea7-44b4-95a3-c17e291a9d0d
   - Direct APK artifact: https://expo.dev/artifacts/eas/apx3-gm3MtJiELdsA0TJiyacv83HbNVcPbBa3K4ThyA.apk
   - Note: the local `--wait` client was killed by a tool time limit at 10 min; the remote build continued and was polled to completion via `eas build:view` (no rebuild).

## Constraints respected

No v*/beta* tag pushed, no `eas submit`, no internal/production build, EAS env values untouched, no secrets printed or committed, STATE.md/ROADMAP.md not updated.

## Task 4

T0 (recorded before handing over to the user): 2026-10-03T20:25:27Z. After the user's reply: read-only count of auth.users created after T0 with raw_user_meta_data->>'app' = 'ziko' on portfolio (ubxllsvanurkwkohzxau, must be >= 1 if M-07 done, with joined ziko_user_profiles row) and auth.users created after T0 on old ziko (slkobhavpwsubnsmuhya, must be 0). Checklist: 06-CUTOVER-SMOKE-CHECKLIST.md Section A (M-01..M-12) plus W-05.


## Task 4 outcome: device checklist WAIVED by user
MOBILE INTERNAL CHECKLIST: WAIVED (user decision; API-level evidence only, not a PASS)

- User first replied "pass all". Read-only DB counts since T0 (2026-10-03T20:25:27Z, checked 20:47Z) showed 0 new accounts, 0 new `app='ziko'` users and 0 sign-ins on portfolio, and 0 new accounts and 0 sign-ins on old ziko, so the app had not been exercised against either backend. The user then confirmed: "i dont have time to install apk check with api is sufficient".
- Evidence that stands instead (no device run): production API core flows 10/10 and storage/route harness 26/26 on portfolio (06-15); web core flows 13/13 and web live spec (06-16); signup isolation (flagged ziko signup creates profile+credits, non-ziko creates none) on production; preview smoke (06-12); the APK build log shows the portfolio Supabase URL inlined (build d05e6e41, 1.5.0).
- Not verified by anyone: the Android app launching against portfolio, M-01..M-12, W-05. M-11 (AI chat) would fail anyway (Anthropic balance empty).
- Consequence for 06-19: its gate greps `^MOBILE INTERNAL CHECKLIST: PASS`, which is deliberately NOT written. The store release needs a separate explicit user decision.
