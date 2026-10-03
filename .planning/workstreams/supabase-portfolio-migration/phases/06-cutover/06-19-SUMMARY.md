# Phase 06 Plan 19: v1.5.0 store release Summary

Status: FAILED. v1.5.0 failed at Setup EAS (Node 20 vs eas-cli 24.10); fixed by PR #43; v1.5.1 got past Setup EAS, Android build finished, iOS build FAILED (Sign in with Apple provisioning profile), so the Android submit step never ran. Nothing is in a store track. No claim is made that the app was device-tested.

## Gates used
- Release decision line in 06-AUTHORIZATIONS.md (`Release decision: release v1.5.0 without device check`) replaces the `MOBILE INTERNAL CHECKLIST: PASS` gate. 06-18-SUMMARY.md still says `MOBILE INTERNAL CHECKLIST: WAIVED`.
- `Typed authorization: approve ubxllsvanurkwkohzxau option-mobile-build` present (06-18 block).
- Auto-chain false (`workflow._auto_chain_active` = false; `workflow.auto_advance` key not set).

## Pre-flight
- origin/main = b292901d73d08eae11be10dcbafee9eb773aa1a2; apps/mobile/app.json version 1.5.0; eas.json production profile has environment production and SENTRY_DISABLE_AUTO_UPLOAD=true; preview has the Sentry env block.
- EAS production env: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY present (17-env-switch.mjs --verify-remote).
- GitHub secret EXPO_TOKEN exists.

## Release
- Tag v1.5.0 created on origin/main (b292901d) and pushed.
- Run: https://github.com/AnatholyB1/ziko-platform/actions/runs/37153805409 — conclusion: failure.
- Job Type-check & Lint: success.
- Job EAS Build & Submit: failed at step "Setup EAS" (expo/expo-github-action@v8, eas-version: latest resolved to eas-cli 24.10.0).
- Error: `@oclif/plugin-autocomplete@3.3.0: The engine "node" is incompatible with this module. Expected version ">=22.0.0". Got "20.20.2"` (the workflow uses Node 20).
- EAS build ids: none (build never started). Android submission: not run.

## Fix and v1.5.1 retry
- Cause of v1.5.0 failure: see Release section (Node 20 job vs eas-cli 24.10 needing Node >=22).
- Fix: PR https://github.com/AnatholyB1/ziko-platform/pull/43 (branch fix/release-eas-node22), only the `eas-build-submit` job node-version 20 -> 22; checks green; merged with a merge commit = 25c669d9f83521700196fc8be2aca29a76e7afe2 (origin/main).
- Tag v1.5.1 created on 25c669d9 and pushed (app.json version stays 1.5.0; the tag name only triggers the pipeline; EAS remote versioning assigns build numbers). v1.5.0 tag untouched.
- Release run: https://github.com/AnatholyB1/ziko-platform/actions/runs/37154477347 — conclusion: failure.
- Setup EAS and Install dependencies: success. Step "Build production (v* tag)": failure.
- EAS build ids: Android 953d5957-7470-4c8c-a3ca-460e24428e98 (status finished, .aab produced); iOS 8ed39a53-d200-4659-b4f9-e6cee39d1f81 (status failed).
- iOS error ("Run fastlane"): provisioning profile "*[expo] com.ziko.mobile AppStore 2026-05-11..." doesn't support the Sign in with Apple capability / lacks the com.apple.developer.applesignin entitlement.
- Android submission: NOT run (step skipped because the build command exited 1 on the iOS failure). The finished Android build was not submitted manually (out of scope per hard limits).
- Stopped here; no further tags without a user decision.

## Deviations
Pipeline failure not fixed, per instructions. v1.5.0 must NOT be re-tagged. A fix (e.g. Node 22 in release.yml, or pin eas-version to a Node-20-compatible release) needs a branch + PR and a new tag v1.5.1, pending a user decision. The v1.5.0 tag now exists on the remote pointing at a commit with no release artifacts.

MOBILE FLIP: NOT ACHIEVED
