# Phase 06 Plan 19: v1.5.0 store release Summary

Status: FAILED at Setup EAS (no EAS build, no submission). Task 1 not complete; Task 2 not reached. No claim is made that the app was device-tested.

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

## Deviations
Pipeline failure not fixed, per instructions. v1.5.0 must NOT be re-tagged. A fix (e.g. Node 22 in release.yml, or pin eas-version to a Node-20-compatible release) needs a branch + PR and a new tag v1.5.1, pending a user decision. The v1.5.0 tag now exists on the remote pointing at a commit with no release artifacts.

MOBILE FLIP: NOT ACHIEVED
