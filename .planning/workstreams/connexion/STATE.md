---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: Connexion Google & Apple
status: blocked
stopped_at: "01-02-PLAN.md Task 1 — blocked on Google Cloud Console OAuth client registration (human action required)"
last_updated: "2026-08-23T00:15:00.000Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
  percent: 0
---

# Project State — v1.17 Connexion Google & Apple

## Project Reference

See: `.planning/PROJECT.md` (root) for cross-cutting context.
See: `.planning/workstreams/connexion/REQUIREMENTS.md` and `ROADMAP.md` for this workstream.

**Core value:** L'utilisateur peut créer un compte et se connecter à l'app mobile Ziko via Google
ou Apple, sans friction et sans doublon de compte.
**Current focus:** Phase 1 — OAuth Infrastructure

## Current Position

Phase: 1 (OAuth Infrastructure) — BLOCKED
Plan: 2 of 4
Status: Blocked at Task 1 (Google Cloud Console OAuth client registration — human action required)

Progress: [███░░░░░░░] 25%

## Accumulated Context

### Decisions

- Automatic account linking (by verified email) chosen over hard-block on collision — Google/Apple
  both guarantee verified emails, so linking is safe and avoids a confusing "account already
  exists" dead end for users who signed up with email/password first (OAUTH-11)

- Mobile only for this milestone — web coach-platform Google/Apple login deferred to v2 (OAUTH-12)
- Manual account linking from settings (for an already-logged-in user) deferred to v2 (OAUTH-13) —
  automatic linking on sign-in covers the primary case

- Phase order: infrastructure (native deps, entitlements, Supabase config) before UX — the sign-in
  screens are unbuildable/untestable without the native OAuth clients registered first

- [Phase 01-01]: expo-apple-authentication pinned at 8.0.8 (SDK-54 compatible), not RESEARCH.md's 57.0.1 floor — expo install's own SDK-54 resolver confirmed 8.0.8; npm dist-tags show 57.0.1 targets a newer SDK line, no sdk-54 tag exists for this package
- [Phase 01-01]: Removed expo install's auto-added google-signin config-plugin entry from app.json — iosUrlScheme unknown until plan 01-02's Google Cloud Console checkpoint; plan explicitly forbids adding a placeholder

### Pending Todos

None yet.

### Blockers/Concerns

- **ACTIVE BLOCKER (01-02 Task 1):** Google Cloud Console OAuth client registration (Web, Android,
  iOS) for `com.ziko.mobile`, plus reading the EAS-managed release keystore SHA-1 via
  `npx eas-cli@latest credentials`, requires human action outside this codebase. Full step-by-step
  is in `01-02-PLAN.md` Task 1 `<how-to-verify>`. Resume with the six confirmed values:
  `WEB_CLIENT_ID`, `ANDROID_CLIENT_ID`, `IOS_CLIENT_ID`, `SHA1_REGISTERED`, `GCP_PROJECT`, `STEP_5_DONE`.

- Google/Apple OAuth client registration (Google Cloud Console + Apple Developer portal) requires
  human action outside this codebase — cannot be verified or completed from code alone

- Whether Supabase Auth's automatic-linking setting is currently enabled on the live `ziko` project
  is unverifiable from code — must be checked/enabled in the dashboard during Phase 1

## Session Continuity

Last session: 2026-08-23T00:15:00.000Z
Stopped at: 01-02-PLAN.md Task 1 — blocked on Google Cloud Console OAuth client registration
Resume file: .planning/workstreams/connexion/phases/01-oauth-infrastructure/01-02-PLAN.md (resume at Task 1)
