# Phase 1: OAuth Infrastructure - Research

**Researched:** 2026-08-23
**Domain:** Native mobile OAuth (Google Sign-In + Sign in with Apple) + Supabase Auth provider configuration, Expo SDK 54 / EAS
**Confidence:** HIGH (stack + dashboard config verified against current official Supabase/Expo docs); MEDIUM on a few dashboard UI specifics and one repo-specific build-pipeline risk that must be verified live

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**EAS build scope**
- **D-01:** Google/Apple Sign-In must work on **Preview and Production** EAS builds this phase —
  register the SHA-1 of the EAS-managed release keystore (shared across preview/production) with
  Google Cloud Console.
- **D-02:** The local dev client (debug keystore SHA-1) is explicitly **out of scope for now** —
  its SHA-1 can vary per machine/install and isn't worth the extra Google Cloud Console client
  entry at this stage. Can be added later as a fast-follow if local dev testing becomes a blocker.

**Manual dashboard steps (execution sequencing)**
- **D-03:** The executor writes all code first (app.json plugins/entitlements, native config), then
  **stops at each blocking dashboard step** (Google Cloud Console OAuth client creation, Apple
  Developer Services ID + Sign in with Apple Key, Supabase Auth provider activation) with precise
  instructions — what to click, what values to copy back — and waits for user confirmation before
  continuing. Do not proceed past a dashboard checkpoint without the value it produces (client ID,
  secret, key) being confirmed back into the config.
  - **Research correction:** the native-only Apple configuration this phase should use does NOT
    require a Services ID or a signing Key/secret — see Finding 2 / Pitfall in this document. The
    "Apple Developer Services ID + Sign in with Apple Key" checkpoint as literally worded in D-03
    describes the *web OAuth* configuration path, not the native path this phase's stack
    recommends. Flagging for the planner/user to confirm before locking the checkpoint sequence.

**External access confirmed**
- **D-04:** An active, paid Apple Developer Program account already exists for Ziko — no blocker on
  generating the Services ID / Sign in with Apple Key. Proceed directly to that dashboard step when
  reached.

**Supabase project scope**
- **D-05:** Only one Supabase project exists (`ziko`, production — `slkobhavpwsubnsmuhya`, per
  `.planning/workstreams/lien-invite/STATE.md`). No separate staging/test project — provider setup
  and automatic-linking configuration happen directly on production. There is no safe place to
  "test" the dashboard config before it's live; the plan should account for that (e.g. verify with
  a throwaway/disposable test account, not by touching real user data).

### Claude's Discretion
- Exact choice of native SDK/package for Google Sign-In (e.g. `@react-native-google-signin/google-signin`
  vs. an Expo AuthSession-based approach) — this is an implementation detail for research/planning,
  not a founder-level decision. The dev-client-out-of-scope decision (D-02) should inform which
  approach is picked (avoid one that hard-requires a dev-client rebuild loop if it adds friction).
  - **Research conclusion:** `@react-native-google-signin/google-signin` (native SDK), not
    `expo-auth-session`. See Standard Stack / Alternatives Considered below.

### Deferred Ideas (OUT OF SCOPE)
- Local dev-client OAuth support (debug keystore SHA-1 registration) — deferred per D-02, can be a
  fast-follow if local testing friction becomes a real blocker
- Separate Supabase staging project for safer testing — not deferred to a phase, just noted as a
  real gap (D-05) since none exists; testing this phase's config changes will happen carefully
  against production
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OAUTH-08 | iOS build embeds the `com.apple.developer.applesignin` entitlement | `usesAppleSignIn: true` + `expo-apple-authentication` config plugin (see Architecture Patterns / app.json Changes); verify via EAS build artifact, not just the `app.json` diff (Pitfall 4) |
| OAUTH-09 | Android OAuth client configured (SHA-1 registered) and wired to `google-services.json` | Register the EAS-managed release keystore SHA-1 (`eas credentials`, D-01) with a Google Cloud Console Android OAuth client keyed to `com.ziko.mobile`; no local Android config-file change needed for Google Sign-In itself (Pitfall 1, Pitfall 3) |
| OAUTH-10 | Google + Apple providers enabled in Supabase dashboard with correct client IDs/secrets; automatic linking by verified email active | Field-by-field dashboard mapping in Code Examples; automatic linking is default GoTrue behavior, not a togglable setting (Finding 1 / Pitfall 7) — verify with a live disposable-account test per D-05 |
</phase_requirements>

## Summary

This phase installs two native SDKs (`@react-native-google-signin/google-signin` for Google,
`expo-apple-authentication` for Apple), wires the corresponding `app.json` config plugins/entitlements,
and configures three external systems by hand: Google Cloud Console (OAuth clients), Apple Developer
Console (Sign in with Apple capability), and the Supabase Auth dashboard (Google + Apple providers).
Both providers converge on the same Supabase call — `supabase.auth.signInWithIdToken({ provider, token, nonce? })`
— so Phase 2's sign-in UX work is decoupled from this phase's infrastructure once each provider is enabled.

Two research findings materially change what the plan should do, both flagged prominently below:

1. **"Automatic linking by verified email" (OAUTH-10/11) is not a dashboard toggle.** It is Supabase
   Auth's default, always-on behavior for identities sharing a verified email. There is nothing to
   "activate." The only linking-related toggle in the dashboard is **"Allow manual linking"**, which is
   an unrelated feature (`linkIdentity()` for an already-logged-in user — OAUTH-13, deferred to v2).
   Phase 1's job for OAUTH-10 is narrower than the roadmap wording implies: enable the two providers
   correctly; verify the default linking behavior with a disposable test account (per D-05).
2. **`apps/mobile/android/` is committed to git** (45 tracked files, generated by a past `expo prebuild`
   run) while `apps/mobile/ios/` does not exist. EAS Build treats a project with a committed platform
   directory as bare/unmanaged for that platform and does **not** re-run `prebuild` for it — `app.json`
   plugin/config changes targeting Android will silently not apply to the native project unless someone
   explicitly regenerates or hand-edits it. This is a real, unverified-until-tested risk for this phase
   (see Pitfall 1) and should shape how the plan sequences and verifies the Android build.

**Primary recommendation:** Use native SDKs for both providers (`@react-native-google-signin/google-signin`
+ `expo-apple-authentication`), not `expo-auth-session`/`expo-web-browser`. Do not install
`expo-web-browser` or `expo-auth-session` for this phase — the native-ID-token approach documented by
Supabase for Expo React Native avoids the browser-redirect flow entirely, matches D-02's dev-client-avoidance
intent, and is simpler to wire to `signInWithIdToken`.

## Architectural Responsibility Map

This phase has no backend/database component — it is entirely mobile-native config plus third-party
dashboard config. Tiers adapted from the standard web table to this mobile context:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Native OAuth consent UI (Google/Apple picker) | Mobile Native Client (iOS/Android OS-level UI) | — | Handled entirely by Google Play Services / Apple `AuthenticationServices`, not app code |
| ID token issuance | Google/Apple identity servers (external) | — | Outside app and outside Supabase; app only receives the signed JWT |
| ID token verification + session issuance | Supabase Auth (GoTrue, hosted) | — | `signInWithIdToken` validates the token against the registered Client IDs and issues a Supabase session — never hand-verify JWTs in app code |
| Automatic identity linking by verified email | Supabase Auth (GoTrue, hosted) | — | Built-in server-side behavior, not app logic |
| Entitlement / OAuth client registration | Google Cloud Console + Apple Developer Console (external dashboards) | EAS-managed credentials (keystore) | Static, one-time-per-environment config; not app runtime code |
| Native module linking (Android) | Gradle autolinking (`autolinkLibrariesWithApp()`) | — | Already present in `android/app/build.gradle`; works from `node_modules` regardless of prebuild state |
| Native capability declaration (iOS entitlement) | Expo config plugin → CNG prebuild | — | `usesAppleSignIn: true` + `expo-apple-authentication` plugin generates `com.apple.developer.applesignin` at build time (`ios/` is not committed, so CNG runs normally) |

## Standard Stack

### Core

| Library | Version (verified 2026-08-23) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-google-signin/google-signin` | `16.1.4` [VERIFIED: npm registry] | Native Google Sign-In (Credential Manager on Android, native SDK on iOS) → returns Google ID token | Referenced by name in Supabase's own official "Expo React Native" Google docs tab; 855K weekly downloads; compileSdk/kotlin requirements already met by SDK 54 |
| `expo-apple-authentication` | `57.0.1` [VERIFIED: npm registry] | Native Sign in with Apple on iOS → returns Apple identity token | Official Expo SDK package, referenced by Supabase's own "Expo React Native" Apple docs tab; 1.4M weekly downloads |

### Supporting

None required for this phase. `@supabase/supabase-js` (`^2.47.0`, already installed) already exposes
`signInWithIdToken`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-native-google-signin/google-signin` (native SDK) | `expo-auth-session` + `expo-web-browser` (AuthSession proxy / browser redirect) | AuthSession works in Expo Go and needs no config plugin, but produces the exact "browser opens, never returns to app" failure mode CONTEXT.md flags as the current bug in `welcome.tsx`. Native SDK is the Supabase-documented path for React Native and avoids the redirect problem entirely. Not recommended for this project. |
| `expo-apple-authentication` (native SDK) | `supabase.auth.signInWithOAuth({ provider: 'apple' })` web redirect | Only alternative on Android (which has no native Apple auth at all — see Pitfall 6) and would work on iOS too, but throws away the native UX Apple's guideline 4.8 review generally expects and reintroduces the redirect problem. Use native on iOS; Apple sign-in stays unavailable on Android (Google-only there), consistent with `welcome.tsx`'s current button set. |

**Installation:**
```bash
npx expo install @react-native-google-signin/google-signin expo-apple-authentication
```
`expo install` (not raw `npm install`) resolves the SDK-54-compatible version automatically — the
versions above are what SDK 54 currently resolves to, but let `expo install` pick the exact pin at
execution time rather than hardcoding these numbers into the plan.

**Version verification:** confirmed via `npm view <pkg> version` against the live npm registry on
2026-08-23 (see Package Legitimacy Audit for full provenance). Both package names are also stated
verbatim in Supabase's official `auth-google.mdx` / `auth-apple.mdx` docs (fetched raw from GitHub,
not summarized) — see Sources.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads (last week) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@react-native-google-signin/google-signin` | npm | ~5.5 yrs (created 2021-03-01) | 855,949 | github.com/react-native-google-signin/google-signin | OK | Approved |
| `expo-apple-authentication` | npm | ~7 yrs (created 2019-09-14) | 1,401,613 | github.com/expo/expo | OK | Approved |

slopcheck was successfully installed and run (`pip install slopcheck`, then `slopcheck scan --json`
against a scratch `package.json` containing both packages — actual project files were not touched).
Both packages passed with status `OK` and no flags. Both names are additionally confirmed verbatim in
Supabase's official documentation (see Sources), satisfying the `[VERIFIED]` provenance bar.

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│  welcome.tsx (Phase 2)  │   ← button wiring is Phase 2; Phase 1 only makes this possible
│  Google / Apple buttons │
└───────────┬──────────────┘
            │ imperative call
            ▼
┌─────────────────────────────────────┐        ┌──────────────────────────────┐
│ Native SDK (this phase installs)     │        │ Google / Apple identity       │
│ - GoogleSignin.signIn()              │───────▶│ servers (OS-level consent UI, │
│ - AppleAuthentication.signInAsync()  │◀───────│ outside the app entirely)     │
└───────────┬───────────────────────────┘        └──────────────────────────────┘
            │ returns idToken (+ nonce for Apple)
            ▼
┌─────────────────────────────────────┐
│ supabase.auth.signInWithIdToken({    │
│   provider, token, nonce? })         │  ← Phase 2 wiring; Phase 1 makes the
└───────────┬───────────────────────────┘    provider config exist so this call succeeds
            │ validates token audience against
            │ registered Client IDs (this phase)
            ▼
┌─────────────────────────────────────┐
│ Supabase Auth (GoTrue, hosted)       │
│ - verifies ID token signature/aud    │
│ - automatic linking by verified      │  ← default behavior, not a toggle (Finding 1)
│   email if identity already exists   │
│ - issues session (access+refresh)    │
└───────────┬───────────────────────────┘
            │ onAuthStateChange fires
            ▼
┌─────────────────────────────────────┐
│ apps/mobile/src/stores/authStore.ts  │  ← unchanged; already listens for any session
└─────────────────────────────────────┘
```

This phase's scope stops at "the providers are enabled and the app can obtain a valid ID token" — the
top and bottom boxes (button wiring, routing on session change) are Phase 2.

### Recommended app.json Changes

```jsonc
// apps/mobile/app.json
{
  "expo": {
    "ios": {
      // ... existing fields unchanged ...
      "usesAppleSignIn": true            // generates the entitlement via config plugin — do NOT
                                          // also hand-add com.apple.developer.applesignin to
                                          // ios.entitlements; let the plugin own it (Pitfall 4)
    },
    "plugins": [
      // ... existing plugins unchanged ...
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          // REVERSED_CLIENT_ID-style value from the iOS OAuth client created in
          // Google Cloud Console during the dashboard checkpoint — format:
          // "com.googleusercontent.apps.<IOS_CLIENT_ID_NUMBER>"
          "iosUrlScheme": "com.googleusercontent.apps.<TO_BE_FILLED_FROM_CHECKPOINT>"
        }
      ]
    ]
  }
}
```

No Android-side `app.json` changes are required for Google Sign-In itself (see Pitfall 1) — the
Android OAuth client is matched by package name (`com.ziko.mobile`) + registered SHA-1 fingerprint on
Google's side, not by a local config file. Do not add `googleServicesFile` for iOS (Ziko doesn't use
Firebase on iOS) — use `iosUrlScheme` instead, as shown above.

### Pattern 1: Native ID token exchange (both providers)
**What:** Obtain a provider ID token natively, exchange it with `signInWithIdToken` — no browser
redirect, no deep-link callback handling.
**When to use:** Always, for this project — see Alternatives Considered above.
**Example (Google, Expo React Native — from Supabase's official docs):**
```tsx
// Source: https://supabase.com/docs/guides/auth/social-login/auth-google (react-native tab)
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { supabase } from '../utils/supabase'

GoogleSignin.configure({
  webClientId: 'WEB_CLIENT_ID_FROM_GOOGLE_CLOUD_CONSOLE', // the WEB client, not the Android one
})

async function onGooglePress() {
  try {
    await GoogleSignin.hasPlayServices()
    const response = await GoogleSignin.signIn()
    if (isSuccessResponse(response)) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      })
    }
  } catch (error: any) {
    if (error.code === statusCodes.IN_PROGRESS) {
      // sign-in already in progress
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      // Play Services not available/outdated
    }
  }
}
```

**Example (Apple, Expo — from Supabase's official docs):**
```tsx
// Source: https://supabase.com/docs/guides/auth/social-login/auth-apple (react-native tab)
import * as AppleAuthentication from 'expo-apple-authentication'

const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ],
})
if (credential.identityToken) {
  const { error, data: { user } } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  })
}
```
Both of these are Phase 2 wiring, included here only because their *shape* determines what Phase 1's
provider config must support (nonce handling, Client ID list contents).

### Anti-Patterns to Avoid
- **Manually validating/decoding the ID token in app code:** Supabase Auth already does this
  server-side against the registered Client IDs. Don't hand-roll JWT verification.
- **Adding both `usesAppleSignIn: true` AND a hand-written `com.apple.developer.applesignin` entitlements
  entry:** redundant; let the config plugin be the single source of truth (Pitfall 4).
- **Passing the Android OAuth Client ID as `webClientId` in `GoogleSignin.configure()`:** must be the
  Web client's ID, not Android's — this is a common, silent-failure-prone mistake (see Code Examples).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID token signature/audience verification | Custom JWT decode + verify against Google/Apple JWKS | `supabase.auth.signInWithIdToken()` | Supabase Auth does this server-side; a hand-rolled client-side check adds no security (the client can't be trusted anyway) and is easy to get wrong (audience/issuer/expiry checks) |
| Duplicate-account detection/merging | Custom "does this email already exist" query + manual identity merge | Supabase Auth's built-in automatic linking by verified email | This is default GoTrue behavior (Finding 1) — building custom linking logic would fight the platform and risk creating orphaned identities |
| Android SHA-1 → OAuth client binding | A locally-stored mapping file / custom verification | Google Cloud Console's native SHA-1 registration (matches by package name + signature) | This is how Android's Credential Manager / Play Services natively verifies app identity — there's no app-code equivalent to build |

**Key insight:** every part of this phase is either (a) static dashboard/config-plugin state, or (b) a
call into a platform SDK whose entire job is to make hand-rolled equivalents unnecessary. If a plan
task proposes writing verification/linking logic in `backend/api` or `authStore.ts`, that's a sign the
task has drifted out of Phase 1's scope (or is duplicating something Supabase already does).

## Common Pitfalls

### Pitfall 1: Committed `android/` directory may silently ignore `app.json` plugin changes
**What goes wrong:** `apps/mobile/android/` is tracked in git (45 files, standard `expo prebuild`
output, confirmed via `git ls-files`). `apps/mobile/ios/` does not exist and is not tracked. EAS Build's
documented behavior is to treat a project as bare/unmanaged for any platform whose native directory is
checked into version control, and skip re-running `prebuild` for that platform — meaning `app.json`
changes that would normally regenerate native Android files may not take effect on Android without an
explicit `expo prebuild --platform android` (or manual native edit).
**Why it happens:** the `android/` directory appears to be leftover CNG output from a previous local
`expo run:android`/prebuild that got committed (files are unmodified boilerplate — `MainActivity.kt`,
`MainApplication.kt` — not hand-written custom native code), not an intentional bare-workflow decision.
**How it affects this phase specifically:** good news — Google Sign-In on Android needs **no native
file changes** (see Architecture Patterns / app.json section above): the OAuth client is matched by
package name + SHA-1 at Google's servers, and the npm package autolinks via `autolinkLibrariesWithApp()`
in the already-committed `android/app/build.gradle`, which reads `node_modules` at Gradle build time
regardless of prebuild state. So this pitfall likely does **not** block Phase 1's Android success
criteria. It matters if a future phase needs an Android-side config-plugin change (e.g., adding
Firebase to `google-services.json`-driven native files) — that would NOT auto-apply and needs explicit
verification.
**Verify live:** confirm the first EAS Android build after this phase's changes actually succeeds and
that Google Sign-In initializes (`GoogleSignin.hasPlayServices()` should not throw) — don't assume the
committed `android/` directory is harmless without one real build/test.

### Pitfall 2: iOS nonce mismatch with `@react-native-google-signin/google-signin`
**What goes wrong:** Supabase Auth validates a nonce on `signInWithIdToken` by default. Google's iOS
native SDK (which this library wraps) does not reliably expose a way to pass a custom nonce through
`GoogleSignin.signIn()` — the library's `configure()`/`signIn()` API surface has no documented nonce
parameter. This produces a `"Passed nonce and nonce in id_token must align"` error on iOS specifically.
**Why it happens:** mismatch between what Supabase's default nonce verification expects and what this
particular library's iOS path actually sends.
**How to avoid:** enable **Skip Nonce Check** for the Google provider in the Supabase dashboard
(`Authentication → Providers → Google → Skip Nonce Check`). This is a real security trade-off (nonce
verification exists to prevent ID token replay) — flag it explicitly as an accepted risk during the
Supabase dashboard checkpoint rather than silently enabling it.
**Warning signs:** `signInWithIdToken` returns an error mentioning "nonce" specifically on iOS
(Android's Credential Manager path is not reported to have this issue with this library).

### Pitfall 3: `webClientId` vs Android client ID confusion
**What goes wrong:** `GoogleSignin.configure({ webClientId })` must receive the **Web application**
type OAuth client's ID, not the Android client's ID — even though the app is Android. Passing the
Android client ID here causes silent authentication failures or Play Services errors.
**Why it happens:** intuitive but wrong — the "Web" client acts as Google Sign-In's audience-verification
anchor across platforms; this is explicit in both Google's and Supabase's docs but easy to miss.
**How to avoid:** during the Google Cloud Console checkpoint, clearly label which of the (up to 3)
client IDs created is which: Web (→ `webClientId` + Supabase Client ID field, first in the list),
Android (→ SHA-1-bound, not referenced anywhere in app code), iOS (→ `iosUrlScheme` config plugin value
+ also added to Supabase's Client IDs list).

### Pitfall 4: iOS entitlement requires a rebuild, not just an app.json edit
**What goes wrong:** Adding `usesAppleSignIn: true` / the `expo-apple-authentication` plugin to
`app.json` has no effect on a build already in flight or a previously-built binary — the entitlement is
baked in at native-project-generation time (CNG prebuild, which EAS Build runs automatically for iOS
since `ios/` is not committed). A build started before this config lands, or a locally cached
prebuild output, will not have the entitlement.
**How to avoid:** verify the entitlement is present by inspecting the actual EAS build artifact/logs
(or `eas build` output) after the config change lands — don't assume from the `app.json` diff alone
that success criterion 1 is met.

### Pitfall 5: Config plugin ordering / duplicate entitlement declarations
**What goes wrong:** manually adding `com.apple.developer.applesignin` to `ios.entitlements` *and*
setting `usesAppleSignIn: true` can produce duplicate or conflicting entitlement declarations during
prebuild, depending on plugin merge order.
**How to avoid:** pick one mechanism — `usesAppleSignIn: true` (recommended, matches official Expo
docs) — and don't hand-edit `ios.entitlements` for this specific key.

### Pitfall 6: Sign in with Apple has no native path on Android
**What goes wrong:** assuming `expo-apple-authentication` or any native library provides Android
support for Apple sign-in. It does not — Apple's native Authentication Services framework is
iOS/macOS/watchOS/tvOS only.
**How to avoid:** this is already reflected in the existing `welcome.tsx` (Apple button is
iOS-oriented) and the roadmap (Apple requirement is driven by App Store Guideline 4.8, an iOS-only
review rule). No Android Apple entitlement/config is needed or possible; don't scope Android Apple work
into this phase.

### Pitfall 7: Treating "automatic linking" as something to enable
**What goes wrong:** OAUTH-10's phrasing ("le linking automatique... est activé") and STATE.md's
blocker note ("whether Supabase Auth's automatic-linking setting is currently enabled... is
unverifiable from code") both imply there's a setting to flip. There isn't one for automatic linking
specifically (see Finding 1 in Summary). Spending a checkpoint hunting for a toggle that doesn't exist
wastes the one blocking-dashboard-step budget this phase has.
**How to avoid:** treat OAUTH-10's linking requirement as satisfied once (a) both providers are
correctly enabled with matching verified-email semantics, and (b) a live test with a disposable account
confirms an OAuth sign-in with an email matching an existing verified email/password account links
rather than errors (per D-05's "no safe staging" constraint — this test IS the verification, not a
dashboard setting). The one real linking-adjacent toggle that exists ("Allow manual linking") is for
OAUTH-13 (v2, deferred) and should NOT be enabled in this phase — enabling it early has no benefit and
expands surface area unnecessarily.

### Pitfall 8: Assuming the native-only Apple path needs a Services ID + secret key
**What goes wrong:** D-03's checkpoint description ("Apple Developer Services ID + Sign in with Apple
Key") describes the **web OAuth flow** configuration (used for `signInWithOAuth`). This phase's chosen
stack (`expo-apple-authentication` native, `signInWithIdToken`) is explicitly documented by Supabase as
NOT requiring a Services ID, signing Key, or the 6-month secret rotation — only the existing App ID
(`com.ziko.mobile`) needs the Sign In with Apple capability enabled, and that same App ID needs to be
listed under Supabase's Apple provider "Client IDs" field.
**How to avoid:** the planner should confirm with the user whether to (a) do the minimal native-only
setup (recommended — fewer moving parts, no secret rotation to maintain), or (b) also set up the full
web OAuth path now in case Phase 2/v2 web coach-platform login (OAUTH-12) wants it later. Don't silently
assume (b) without asking, since it adds a recurring 6-month maintenance burden (secret key rotation)
for a capability (web Apple login) that's explicitly out of scope for this milestone (OAUTH-12 is v2).

## Code Examples

### Google Cloud Console → Supabase dashboard field mapping
```
Google Cloud Console creates:
  Web OAuth client       → Client ID + Client Secret
  Android OAuth client    → bound to SHA-1 + package name (com.ziko.mobile); ID itself isn't used in app code
  iOS OAuth client         → Client ID used for iosUrlScheme in app.json

Supabase dashboard (Authentication → Providers → Google):
  Client ID (secret)       = Web client's Client ID
  Client Secret             = Web client's Client Secret
  Authorized/Client IDs list = "<web-client-id>,<android-client-id>,<ios-client-id>"  (web MUST be first)
  Skip Nonce Check           = enabled  (see Pitfall 2)
```

### Apple Developer Console → Supabase dashboard field mapping (native-only, recommended per Pitfall 8)
```
Apple Developer Console:
  App ID (com.ziko.mobile) → enable "Sign In with Apple" capability in the Capabilities list
  (No Services ID, no signing Key/.p8, no 6-month secret rotation needed — native-only apps
   skip the entire OAuth/web configuration branch per Supabase's official docs.)

Supabase dashboard (Authentication → Providers → Apple):
  Client IDs list = "com.ziko.mobile"
  Secret Key / Team ID fields = leave blank (only required for the OAuth/web flow, not used here)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `supabase.auth.signInWithOAuth({ provider: 'google' })` web-redirect (current `welcome.tsx` code) | Native SDK + `signInWithIdToken` | Documented as the recommended React Native path in Supabase's current docs | Eliminates the "never returns to app" bug this phase exists to fix; this phase lays the groundwork, Phase 2 does the swap |
| Legacy FCM (unrelated to this phase, noted for context) | FCM V1 | Google shut down legacy FCM in 2024 | Not directly relevant to OAuth, but confirms the `google-services.json` / Firebase project already set up for push notifications is on the current API surface and can likely host the new OAuth clients in the same Google Cloud project |

**Deprecated/outdated:** the `signInWithOAuth` web-redirect call currently in `welcome.tsx` for Google
is the exact pattern Supabase's own docs steer native app developers away from — Phase 2 replaces it,
Phase 1 makes the replacement possible.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Google Cloud project backing the existing FCM setup (`google-services.json`, delivered via EAS secret per the notification-mobile milestone) can/should host the new Google Sign-In OAuth clients rather than a new project | Code Examples / Summary | Low — worst case, a second GCP project is created; no functional harm, just extra dashboard housekeeping. Confirm at the Google Cloud Console checkpoint. |
| A2 | `@react-native-google-signin/google-signin`'s iOS path has no documented custom-nonce parameter, requiring "Skip Nonce Check" | Pitfall 2 | Medium — if a nonce param does exist in a newer version and is missed, the plan would unnecessarily weaken nonce verification. Verify against the installed version's actual TypeScript types during execution before enabling Skip Nonce Check. |
| A3 | EAS Build genuinely skips native-directory regeneration for Android because `android/` is committed (vs. some other explanation for why it's tracked) | Pitfall 1 | Medium — if wrong, no harm (extra caution was unnecessary); if the committed directory is stale in some other way, could cause a silent build failure that this research didn't fully diagnose. Must be confirmed by an actual EAS build during execution, not assumed. |
| A4 | Preview and Production EAS build profiles share one implicit EAS-managed Android keystore (no per-profile credential override exists in `eas.json`/`credentials.json`) | Summary (Finding re: D-01) | Low — confirmable in seconds via `eas credentials`; if wrong, the plan needs a second SHA-1 registered. |
| A5 | The native-only Apple configuration (no Services ID/secret) is sufficient for this milestone's scope (mobile-only, OAUTH-12 web login deferred to v2) | Pitfall 8 | Low-Medium — if the user wants to hedge for near-term web login, skipping the OAuth setup now means redoing this checkpoint later. Purely a scoping question, not a technical risk. |

## Open Questions

1. **Does the existing Google Cloud project (from the FCM/notification-mobile setup) already exist and is it accessible for creating new OAuth clients?**
   - What we know: `google-services.json` exists as an EAS file secret; a Firebase (=GCP) project for `com.ziko.mobile` was set up during the archived v1.11 notification milestone.
   - What's unclear: whether the person executing this phase's checkpoints has access to that same GCP project, or needs to create a new one.
   - Recommendation: surface this as the first question at the Google Cloud Console checkpoint rather than assuming either way.

2. **Is `com.ziko.mobile`'s Apple App ID already registered with an active Apple Developer account, and does it already have other capabilities (e.g., Push Notifications, HealthKit) that need to coexist with Sign In with Apple?**
   - What we know: `app.json` already has HealthKit and background-mode entitlements for iOS, and D-04 confirms an active paid Apple Developer account exists.
   - What's unclear: whether the App ID identifier already exists in the Apple Developer portal (likely yes, given HealthKit/push are already configured) or needs first-time creation.
   - Recommendation: the checkpoint instructions should say "find the existing `com.ziko.mobile` identifier and add the Sign In with Apple capability" rather than "create a new App ID" — confirm which applies live.

3. **Native-only Apple setup vs. also configuring the web OAuth path now (Pitfall 8 / A5)?**
   - What we know: native-only is sufficient for this milestone's mobile-only scope and avoids a recurring 6-month secret rotation obligation.
   - What's unclear: whether the user wants to front-load the web OAuth config in anticipation of OAUTH-12 (v2, web coach-platform login).
   - Recommendation: default to native-only (simpler, less maintenance) unless the user says otherwise at the Apple Developer checkpoint.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `eas-cli` (global) | `eas credentials` to fetch the release keystore SHA-1 | ✗ (not installed globally in this environment) | — | `npx eas-cli@latest credentials` (confirmed working — resolves to `22.2.0` via network) |
| Node.js | Package installs, `expo install` | ✓ | not explicitly checked, project requires >=18 | — |
| Xcode / macOS | Local iOS native builds | ✗ (not applicable — EAS Build handles iOS compilation in the cloud) | — | EAS cloud build; no local Xcode needed for this phase |
| Android Studio / SDK | Local Android native builds | Not checked (not required — EAS Build handles Android compilation in the cloud) | — | EAS cloud build |

**Missing dependencies with no fallback:** none — all required tooling is either present or has a working `npx` fallback.
**Missing dependencies with fallback:** `eas-cli` — use `npx eas-cli@latest <command>` throughout the plan instead of assuming a global `eas` binary.

## Validation Architecture

`apps/mobile` has **no test framework configured** — no `vitest`/`jest` config, no test script in
`package.json`, no test files. This is consistent with the rest of the mobile app (only `backend/api`
and `apps/web` have Vitest per `.planning/codebase/STACK.md`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | none configured for `apps/mobile` |
| Config file | none |
| Quick run command | n/a |
| Full suite command | n/a |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OAUTH-08 | iOS build embeds `com.apple.developer.applesignin` | manual-only | inspect EAS build artifact/logs after `eas build --profile production --platform ios` | ❌ no automation exists |
| OAUTH-09 | Android OAuth client registered, SHA-1 wired | manual-only | `GoogleSignin.hasPlayServices()` should resolve without throwing on a real device/build | ❌ no automation exists |
| OAUTH-10 | Supabase providers enabled, correct client IDs, linking verified | manual-only (checkpoint) | live test: sign up with email/password using a disposable email, then sign in with a Google/Apple account sharing that same email, confirm one user record results | ❌ no automation exists |

**Justification for manual-only:** this phase is infrastructure/dashboard configuration with no
testable application logic — there is nothing to unit-test. Automated coverage becomes meaningful in
Phase 2, once actual sign-in flow code exists in `welcome.tsx`.

### Sampling Rate
- **Per task commit:** N/A — no automated suite exists for this app
- **Per wave merge:** manual EAS build verification (build succeeds on both platforms)
- **Phase gate:** all 5 roadmap success criteria manually confirmed, including a live disposable-account
  linking test (D-05 constraint — no safe staging project)

### Wave 0 Gaps
- No mobile test framework exists project-wide. Setting one up is out of scope for this phase (pure
  infra/config, nothing unit-testable) — flag for a future phase if `apps/mobile` ever needs automated
  coverage.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) `signInWithIdToken` — server-side ID token signature/audience verification; never hand-verify tokens client-side |
| V3 Session Management | yes (inherited, no new work) | Existing `authStore.ts` / Supabase session refresh — unchanged by this phase |
| V4 Access Control | no | No new authorization surface introduced in this phase |
| V5 Input Validation | no | No user-supplied input processed by this phase's code |
| V6 Cryptography | yes | Nonce generation/verification for replay protection — owned by Supabase Auth server-side; the one deviation (Skip Nonce Check for iOS Google, Pitfall 2) is a deliberate, flagged trade-off due to a client library limitation, not a hand-rolled crypto decision |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ID token replay | Spoofing | Nonce verification (Supabase default) — explicitly weakened for iOS Google per Pitfall 2; accept and document this trade-off rather than silently shipping it |
| Pre-account takeover via unverified email linking | Spoofing / Elevation of Privilege | Supabase Auth's automatic linking only links to accounts with a *verified* email and purges unconfirmed identities on match (per official docs) — this is exactly why "automatic linking" doesn't need extra app-side guarding |
| Malicious app impersonation (Android) | Spoofing | SHA-1 + package name binding at the Google Cloud Console OAuth client — verify the SHA-1 registered matches the actual EAS-managed release keystore, not a stale/local one |
| OAuth client ID leakage | Information Disclosure | Not a real risk — OAuth client IDs (unlike secrets) are meant to be public/embedded in app binaries; only the Web client's *Secret* (Supabase-side only) needs protecting |

## Sources

### Primary (HIGH confidence)
- [Supabase — Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google) — fetched raw `.mdx` source directly from GitHub (not summarized); Client ID/Secret fields, Expo React Native tab code sample, `webClientId` semantics, Skip Nonce Check location
- [Supabase — Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) — fetched raw `.mdx` source directly from GitHub; native-only vs OAuth-flow configuration split, Expo code sample, 6-month secret rotation caveat (OAuth-flow only, doesn't apply here)
- [Supabase — Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking) — fetched raw `.mdx` source directly from GitHub; automatic vs manual linking distinction (Finding 1)
- [Supabase — General configuration](https://supabase.com/docs/guides/auth/general-configuration) — fetched raw `.mdx`; confirms dashboard toggle is named "Allow manual linking," no separate automatic-linking toggle exists
- npm registry (`npm view`, `api.npmjs.org/downloads`) — package versions, ages, weekly downloads for both candidate packages, checked 2026-08-23
- slopcheck scan output — both packages `OK`, no flags

### Secondary (MEDIUM confidence)
- [react-native-google-signin — Expo setup guide](https://react-native-google-signin.github.io/docs/setting-up/expo) — WebFetch summary (not raw source); config plugin shape, `iosUrlScheme` field, SDK 54 compileSdk/kotlin compatibility note
- WebSearch: iOS nonce mismatch with `@react-native-google-signin/google-signin` + Supabase (Pitfall 2) — cross-referenced across multiple community sources (GitHub issue #1176, Supabase discussion #34959) converging on the same explanation
- WebSearch: EAS Build behavior when native `android`/`ios` directories are committed to git (Pitfall 1) — converging community reports (expo/eas-cli issues #2616, #3127) plus direct repo inspection (`git ls-files`) confirming Ziko's specific state

### Tertiary (LOW confidence)
- None — everything above was cross-verified against at least one authoritative or repo-inspection source before inclusion.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package names/APIs verified against raw official Supabase docs source, versions verified against live npm registry, legitimacy verified via slopcheck
- Architecture: HIGH — flow verified against official docs' own code samples for both providers
- Pitfalls: MEDIUM-HIGH — Pitfall 1 (committed `android/`) is repo-inspection-confirmed as a *state* (the directory is genuinely committed) but its *build-time consequence* is inferred from Expo/EAS community reports, not a live test in this repo; flagged for live verification during execution. Pitfall 2 (iOS nonce) is corroborated across multiple independent sources but should be re-checked against the exact installed package version's TypeScript types before committing to "Skip Nonce Check" (A2).

**Research date:** 2026-08-23
**Valid until:** ~30 days (dashboard UI field names/locations and exact npm patch versions can drift faster than this; re-verify field names live at execution time rather than trusting screenshots-in-docs verbatim)
