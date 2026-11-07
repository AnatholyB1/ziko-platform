# Orchestration v1.17 connexion (resume file)

Branch: milestone/v1.17 (worktree .claude/worktrees/integration-v1.17), base main 71d240e7 (plan 01-01 already in main).
Target auth = projet `portfolio` ubxllsvanurkwkohzxau (le projet `ziko` slkobhavpwsubnsmuhya est SUPPRIME depuis 2026-10-06; plans 01-02..04 le citent encore).

## Done (2026-11-07)
- GCP project `ziko` (ziko-491420): consent screen configured (mode Testing). Web client 450830070582-72naafunl4eefm18fmudih0sv5nho3rb ; iOS client 450830070582-16jfrfkhi1de75sm7plrljvrvjbr4rs8 (bundle com.ziko.mobile). Web redirect URI = portfolio /auth/v1/callback.
- Portfolio /auth/v1/settings: google=false apple=false mailer_autoconfirm=true (risk: auto-link + autoconfirm = pre-hijack).

## Blocked on human
1. Android SHA-1 (EAS keystore) -> Android client. expo.dev not logged in the browser; CLI is logged in (anatholyb) but `eas credentials` is interactive.
2. Supabase portfolio Google provider secret entry (secret never in chat).
3. Apple Developer: Sign In with Apple capability on App ID com.ziko.mobile (login/2FA).

## Next
- Phase 2 code with mocks (builder, branch phase/02-signin-ux).
- Rewrite plans 01-02..04 for portfolio, DEPLOY-CHECKLIST-v1.17.md.

## Update 2026-11-07 (later)
- Phase 2 code merged into milestone/v1.17 (merge of phase/02-signin-ux, 4 commits). Gate: 14/14 vitest, tsc OK. Mock-only; linking (OAUTH-11), device flows, native build NOT proven.
- Deviations: expo-crypto added (needs native rebuild); Google nonce unsupported by google-signin 16.1.4 -> Supabase "Skip Nonce Check" must be ON for Google; isNewUser = created_at/last_sign_in_at < 10s.
- Still blocked: items 1-3 above + user decisions Q1-Q4. Plans 01-02..04 and ROADMAP/REQUIREMENTS still cite deleted `ziko` project (rewrite pending).

## Update: Android client (2026-11-07)
- SHA-1 keystore EAS prod (public, via Expo GraphQL, package com.ziko.mobile): 66:76:D0:65:58:83:BA:51:6B:6F:50:F5:06:0A:AD:2B:F8:F4:39:9E
- Android client created in GCP ziko-491420: 450830070582-8m4aval4rinqm50ru6lt6lsj2o280lmr.apps.googleusercontent.com
- Remaining human: Supabase Google provider (secret, Skip Nonce Check, authorized IDs Web,Android,iOS), Apple capability, Play App Signing SHA-1 (add as 2nd Android client or extra fingerprint), consent screen publish, mailer_autoconfirm decision.

## Update: Play App Signing client (2026-11-07)
- Play App Signing SHA-1 (public) AC:7B:04:8A:35:30:0B:9E:F6:87:BF:B9:7E:1B:0C:58:E0:13:F6:2C -> Android client 450830070582-7sl8pr0amvkjb383ckt7qa7ii3c2p852.apps.googleusercontent.com (GCP ziko-491420).
- Authorized Client IDs for Supabase Google provider: Web 72naafunl4eefm18fmudih0sv5nho3rb, Android 8m4aval4rinqm50ru6lt6lsj2o280lmr, Android(Play) 7sl8pr0amvkjb383ckt7qa7ii3c2p852, iOS 16jfrfkhi1de75sm7plrljvrvjbr4rs8 (all 450830070582-*.apps.googleusercontent.com), Web first.
- NOT done (left to the user): secret entry in Supabase, provider enablement, Apple capability, consent screen publish, mailer_autoconfirm change.
