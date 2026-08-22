# Roadmap: Connexion Google & Apple (Mobile)

**Workstream:** `connexion`
**Milestone:** v1.17

## Overview

The mobile welcome screen already has Google and Apple buttons, but neither works: Apple is a
placeholder alert, and Google calls Supabase's web-redirect OAuth flow with no native return
handler. No native OAuth dependencies are installed and no entitlements are configured — this is
a from-scratch native integration, not a wiring fix. Two phases: infrastructure first (native
deps, iOS/Android build config, Supabase provider setup, automatic account linking), then the
actual sign-in UX built on top of it.

## Phases

- [ ] **Phase 1: OAuth Infrastructure** - Native dependencies, iOS/Android build config, and Supabase provider setup that the sign-in UX depends on
- [ ] **Phase 2: Google & Apple Sign-In UX** - Wire the welcome screen buttons to real native flows, with correct routing, session handling, and automatic account linking

## Phase Details

### Phase 1: OAuth Infrastructure

**Goal**: The mobile app is technically capable of completing a native Google or Apple OAuth
handshake and Supabase is configured to accept it — before any UI work happens.
**Depends on**: Nothing (first phase)
**Requirements**: OAUTH-08, OAUTH-09, OAUTH-10

**Plans:** 4 plans

Plans:
- [ ] 01-01-PLAN.md — Install the native OAuth SDKs and declare Apple Sign-In in app.json
- [ ] 01-02-PLAN.md — Register the Google OAuth clients (Web/Android/iOS) + release keystore SHA-1, wire client IDs into app.json
- [ ] 01-03-PLAN.md — Enable Sign In with Apple on the App ID and configure the Supabase Auth providers
- [ ] 01-04-PLAN.md — Prove the entitlement and native-module link on real EAS build artifacts

**Success criteria:**
1. iOS build includes the `com.apple.developer.applesignin` entitlement
2. Android build has a registered OAuth client (prod/preview release-keystore SHA-1) wired to `google-services.json`
   *(revised during planning: the local dev/debug keystore SHA-1 is out of scope per CONTEXT.md D-02)*
3. Supabase Auth dashboard has Google and Apple providers enabled with correct client IDs/secrets
4. Supabase Auth automatic linking (by verified email) is confirmed active for the `ziko` project
   *(revised during planning: RESEARCH.md Finding 1 / Pitfall 7 established there is no toggle to enable —
   automatic linking is default GoTrue behavior. Phase 1 enables the providers, keeps "Allow manual
   linking" OFF, and carries the behavioral linking test into Phase 2, which is the first phase where a
   real Google/Apple sign-in can be performed.)*
5. Native dependencies installed (`expo-apple-authentication` + `@react-native-google-signin/google-signin`)
   and the app builds successfully on both platforms
   *(revised during planning: `expo-web-browser`/`expo-auth-session` are deliberately NOT installed —
   RESEARCH.md rules out the browser-redirect path as the cause of the very bug this milestone fixes)*

### Phase 2: Google & Apple Sign-In UX

**Goal**: A user can actually sign in with Google or Apple from the welcome screen, land in the
right place (onboarding for new accounts, straight into the app for returning ones), and get
automatically linked if their email already exists.
**Depends on**: Phase 1 (needs native deps, entitlements, and Supabase provider config in place)
**Requirements**: OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, OAUTH-05, OAUTH-06, OAUTH-07, OAUTH-11

**Success criteria:**
1. Tapping the Google button on `welcome.tsx` completes a native sign-in and returns to the app (no dead-end browser redirect)
2. Tapping the Apple button on `welcome.tsx` completes a native Sign in with Apple flow (placeholder alert removed)
3. First-time sign-in routes to `/(auth)/onboarding/step-1`; returning sign-in routes to `/(app)/`
4. Cancelling the native picker returns silently to welcome — no error shown
5. Provider/network failure shows a French `showAlert` error
6. Session persists across app restart, same as email/password sessions
7. Signing in with an email that matches an existing verified email/password account links automatically instead of erroring or duplicating

---
*Roadmap created: 2026-08-23*
