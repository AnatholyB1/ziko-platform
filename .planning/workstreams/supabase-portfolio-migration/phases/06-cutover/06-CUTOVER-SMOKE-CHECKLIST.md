# Phase 6 Cutover Smoke Checklist

Manual verification for the carried Phase 5 UI items and the D-12 core flows.

- Build / deployment under test:
- Tester:
- Date:
- Device model and OS (no account emails):

**Rule:** any FAIL = STOP and run the surface rollback in `scripts/portfolio-migration/RUNBOOK.md` (Phase 6, section 6.5).
Record no PII in the Note column: no emails, no user ids, no tokens.

## Section A: Mobile (new native build, 06-18)

| ID | Surface | Bucket/flow | Steps | Expected | Result (PASS/FAIL) | Note (no PII) |
|----|---------|-------------|-------|----------|--------------------|---------------|
| M-01 | mobile profile | ziko-avatars | Open profile, pick a new avatar, save, reopen the profile | Avatar uploads and displays after reopening | | |
| M-02 | mobile profile | ziko-profile-photos | Upload a profile photo, check it displays, then remove it | Upload and display work. Quirk expected (Phase 5 D-02): private bucket, public SELECT policy, no DELETE policy, so removal of the object may not delete it. This is not a failure | | |
| M-03 | mobile workout | ziko-exercise-media | Open an exercise screen and the exercise picker | Exercise media displays in both | | |
| M-04 | plugin-nutrition | ziko-scan-photos | Take a nutrition scan photo (upload via /storage/upload-url), view the result | Photo uploads and displays | | |
| M-05 | plugin-coach | ziko-coach-logos | Open Mon Coach with a linked coach that has a logo | Coach logo displays | | |
| M-06 | mobile athlete | ziko-coach-videos | Upload an athlete video, then open it from the coach web UI (pairs with W-05) | Upload succeeds, coach can view it | | |
| M-07 | mobile auth | signup flag | Fresh install, register a new account, finish onboarding | Onboarding completes (signup flag creates profile and credits) | | |
| M-08 | mobile auth | existing login | Log in with an existing account after cutover. Also launch the app with a persisted pre-cutover session (Pitfall 10) | Login works. The stale session lands on login without a crash | | |
| M-09 | mobile read | history / dashboard | Open workout history and the dashboard | Both load with data | | |
| M-10 | mobile write | habit / hydration | Log a habit or hydration entry, restart the app | Entry persists after restart | | |
| M-11 | mobile AI | chat | Send one chat message | Response streams, credit balance decreases | | |
| M-12 | mobile onboarding | ziko-chat completion card | Complete the onboarding ziko-chat card | Writes succeed (hydration / journal / measurements table map) | | |

## Section B: Web coach UI (06-16)

| ID | Surface | Bucket/flow | Steps | Expected | Result (PASS/FAIL) | Note (no PII) |
|----|---------|-------------|-------|----------|--------------------|---------------|
| W-01 | web coach | ziko-coach-kyc | Upload a KYC document, then view it through api/photo | Upload succeeds, document displays | | |
| W-02 | web coach | ziko-coach-exercises | Upload coach exercise media | Upload succeeds, media displays | | |
| W-03 | web coach | ziko-coach-logos | Upload a coach logo, open the branding preview | Logo uploads, preview shows it | | |
| W-04 | web coach | ziko-ai-imports | Upload a file in the coach AI import | Upload accepted, import starts | | |
| W-05 | web coach | ziko-coach-videos | View the athlete video uploaded in M-06 | Video plays | | |
| W-06 | web coach | CRM | Open the coach CRM client list | List loads | | |

## Section C: Scripted items (no manual action)

Each item is proven by a report file filled in by 06-10, 06-12 or 06-15.

| Item | Route / check | Proving report |
|------|---------------|----------------|
| S-1 | GET /coach/clients/links/me (ziko-coach-kyc) | report from 15-smoke-core-flows (06-10 / 06-12 / 06-15) |
| S-2 | POST /coach/videos/upload-url (ziko-coach-videos) | report from 15-smoke-core-flows (06-10 / 06-12 / 06-15) |
| S-3 | GET /coach/videos/:videoId/signed-url (ziko-coach-videos) | report from 15-smoke-core-flows (06-10 / 06-12 / 06-15) |
| S-4 | GET /coach/videos/annotations/:annotationId/audio-url (ziko-coach-videos) | report from 15-smoke-core-flows (06-10 / 06-12 / 06-15) |
| S-5 | GET /coach/exercises/:id/media-url (ziko-coach-exercises) | report from 15-smoke-core-flows (06-10 / 06-12 / 06-15) |
| S-6 | POST /coach/imports (ziko-ai-imports) | report from 15-smoke-core-flows (06-10 / 06-12 / 06-15) |
| S-7 | codemod: 11-codemod-buckets.mjs and 12-codemod-tables.mjs `--check` repo-wide residual pass, merged together with the env flip | check output recorded by 06-08 and 06-15 |

Proven on portfolio by 06-12 (`scripts/portfolio-migration/reports/preview-storage-auth.json`, harness smoke, backend 14/14 incl. deny cases): S-1, S-2, S-3, S-4, S-5. S-6 (POST /coach/imports) is covered by 15-smoke-core-flows and is pending 06-12 step 5 (preview URLs need the bypass file).
