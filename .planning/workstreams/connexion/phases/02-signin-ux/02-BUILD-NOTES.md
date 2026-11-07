# Phase 2 Build Notes — Sign-in UX (Google & Apple)

Branch `phase/02-signin-ux`. Code: `apps/mobile/src/lib/socialAuth.ts`, `apps/mobile/app/(auth)/welcome.tsx`.
Tests: `apps/mobile/src/lib/__tests__/socialAuth.test.ts` (vitest, native modules mocked; new `apps/mobile/vitest.config.ts` + `npm test` script, mobile had no runner).

## Requirement -> test

| Req | Coverage | Tests |
|-----|----------|-------|
| OAUTH-01 Google native | mock | Google success new / returning (signInWithIdToken provider google) |
| OAUTH-02 Apple native | mock | Apple success new / returning; nonce test |
| OAUTH-03 new -> onboarding | mock | handleSocialResult "new -> onboarding"; isFreshAccount via success new |
| OAUTH-04 returning -> app | mock | handleSocialResult "returning -> app"; profile refreshed before routing |
| OAUTH-05 cancel silent | mock | Google cancelled response + thrown SIGN_IN_CANCELLED; Apple ERR_REQUEST_CANCELED; handleSocialResult cancelled |
| OAUTH-06 French error via showAlert | mock | provider error, network error, handleSocialResult error |
| OAUTH-07 persistence | by construction | same `supabase` client (AsyncStorage, persistSession); authStore unchanged. Not exercised on device. |
| OAUTH-11 auto linking | NOT PROVEN | server-side GoTrue behaviour |
| Android hides Apple | mock + UI | "Android hides Apple" test; button rendered only if `isAppleSignInSupported()` |

## Decisions
- Apple nonce: random raw nonce, SHA-256 hash sent to Apple, raw nonce sent to Supabase. Needed `expo-crypto` (added, ~15.0.9; native rebuild needed).
- Google nonce: google-signin 16.1.4 types expose no nonce option (README mentions it only as marketing). Verdict NONCE_UNSUPPORTED: the Supabase Google provider needs "Skip Nonce Check" (phase 1 accepted risk). No nonce is sent.
- New-user detection: `created_at` vs `last_sign_in_at` within 10 s. Linked pre-existing accounts count as returning.
- Apple full name saved via `auth.updateUser({data:{full_name}})`, non-blocking.
- app.json: added google-signin config plugin with `iosUrlScheme` (public reversed iOS client id).

## NOT PROVEN
- No real Google/Apple/Supabase call was made. Nothing on device/simulator. Entitlement/URL scheme only verifiable in an EAS build.
- OAUTH-11 automatic linking: server-side, mocks cannot prove it. Portfolio caveat: `mailer_autoconfirm=true` means email/password accounts count as verified without proof of ownership, so an attacker could pre-register a victim's email and have a later Google/Apple sign-in link into it (pre-hijack). Open decision for the user.
- Google "Skip Nonce Check" must be enabled in the Supabase dashboard for the iOS/Android Google flow; untested.
- Dev-client Android SHA-1 is out of scope (D-02).
