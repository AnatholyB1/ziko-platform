# Phase 1: OAuth Infrastructure - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the mobile app technically capable of completing a native Google or Apple OAuth handshake,
and get Supabase Auth configured to accept it — before any sign-in UI work happens (that's Phase 2).
Covers: native dependency installation, iOS/Android build config (entitlements, OAuth clients),
and Supabase Auth provider setup including automatic account linking.

</domain>

<decisions>
## Implementation Decisions

### EAS build scope
- **D-01:** Google/Apple Sign-In must work on **Preview and Production** EAS builds this phase —
  register the SHA-1 of the EAS-managed release keystore (shared across preview/production) with
  Google Cloud Console.
- **D-02:** The local dev client (debug keystore SHA-1) is explicitly **out of scope for now** —
  its SHA-1 can vary per machine/install and isn't worth the extra Google Cloud Console client
  entry at this stage. Can be added later as a fast-follow if local dev testing becomes a blocker.

### Manual dashboard steps (execution sequencing)
- **D-03:** The executor writes all code first (app.json plugins/entitlements, native config), then
  **stops at each blocking dashboard step** (Google Cloud Console OAuth client creation, Apple
  Developer Services ID + Sign in with Apple Key, Supabase Auth provider activation) with precise
  instructions — what to click, what values to copy back — and waits for user confirmation before
  continuing. Do not proceed past a dashboard checkpoint without the value it produces (client ID,
  secret, key) being confirmed back into the config.

### External access confirmed
- **D-04:** An active, paid Apple Developer Program account already exists for Ziko — no blocker on
  generating the Services ID / Sign in with Apple Key. Proceed directly to that dashboard step when
  reached.

### Supabase project scope
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workstream planning docs
- `.planning/workstreams/connexion/REQUIREMENTS.md` — OAUTH-01 through OAUTH-13, this phase covers OAUTH-08/09/10
- `.planning/workstreams/connexion/ROADMAP.md` — Phase 1 and Phase 2 goals, success criteria, dependencies

### Cross-workstream reference
- `.planning/workstreams/lien-invite/STATE.md` — confirms the only Supabase project is `ziko` / `slkobhavpwsubnsmuhya` (production), and flags a pre-existing **URGENT unrelated security issue**: `is_coach_of()`, `redeem_invitation_code()`, `peek_invitation()` are anon-executable in production due to `ALTER DEFAULT PRIVILEGES` granting EXECUTE outside the `PUBLIC` revoke. Not in scope for this phase, but worth knowing this project's default-privilege behavior before writing new SECURITY DEFINER-adjacent Auth config.

### Codebase maps
- `.planning/codebase/STACK.md` — mobile stack (Expo SDK ~54, EAS project ID `9b672c1a-10c4-4d66-882c-b9a08294650f`), build profiles in `eas.json`
- `.planning/codebase/INTEGRATIONS.md` — current Supabase Auth flow (`authStore.ts`, `onAuthStateChange`), env var map

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/src/stores/authStore.ts` — pure session listener via `onAuthStateChange`/`getSession`; no login logic itself, so OAuth sign-in just needs to produce a valid Supabase session and this store picks it up unchanged
- `apps/mobile/app/(auth)/welcome.tsx` (lines ~94-119) — Google/Apple buttons already exist in the UI; Google calls `supabase.auth.signInWithOAuth({provider:'google'})` (broken web-redirect, no native return handler), Apple is a `showAlert` placeholder — both need real native flows in Phase 2, but the buttons/layout don't need to change

### Established Patterns
- Error UX uses `showAlert` from `@ziko/plugin-sdk` (CLAUDE.md convention) — not React Native's `Alert`
- `app.json` already has `scheme: "ziko"` — usable as the OAuth redirect deep link

### Integration Points
- iOS: `apps/mobile/app.json` → `ios.entitlements` (currently only HealthKit entitlements present) needs `com.apple.developer.applesignin` added
- Android: `apps/mobile/app.json` already has `googleServicesFile: "./google-services.json"` (likely FCM-scoped, not confirmed as OAuth-scoped) — needs verification/extension for Sign-In
- `eas.json` build profiles: `development` (internal, dev client), `preview` (internal, APK), `internal`, `production` — all share bundle ID `com.ziko.mobile` / package `com.ziko.mobile`, so a single Google Cloud Console Android OAuth client (keyed by SHA-1, not bundle ID) covers preview+production once the EAS-managed release keystore's SHA-1 is registered

</code_context>

<specifics>
## Specific Ideas

No particular UI/UX references for this phase — it's pure infrastructure. Phase 2 discussion will
cover any specific sign-in UX preferences.

</specifics>

<deferred>
## Deferred Ideas

- Local dev-client OAuth support (debug keystore SHA-1 registration) — deferred per D-02, can be a
  fast-follow if local testing friction becomes a real blocker
- Separate Supabase staging project for safer testing — not deferred to a phase, just noted as a
  real gap (D-05) since none exists; testing this phase's config changes will happen carefully
  against production

### Reviewed Todos (not folded)
None — no pending todos matched Phase 1.

</deferred>

---

*Phase: 1-OAuth Infrastructure*
*Context gathered: 2026-08-23*
