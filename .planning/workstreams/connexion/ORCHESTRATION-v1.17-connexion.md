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
