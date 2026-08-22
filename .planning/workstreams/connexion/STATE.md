---
gsd_state_version: 1.0
workstream: connexion
milestone: v1.17
milestone_name: Connexion Google & Apple
current_phase: 1
current_phase_name: OAuth Infrastructure
status: planning
stopped_at: Requirements + roadmap defined, not yet planned
last_updated: "2026-08-23T00:00:00.000Z"
last_activity: 2026-08-23
last_activity_desc: Requirements (11 REQ) and roadmap (2 phases) written
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State — v1.17 Connexion Google & Apple

## Project Reference

See: `.planning/PROJECT.md` (root) for cross-cutting context.
See: `.planning/workstreams/connexion/REQUIREMENTS.md` and `ROADMAP.md` for this workstream.

**Core value:** L'utilisateur peut créer un compte et se connecter à l'app mobile Ziko via Google
ou Apple, sans friction et sans doublon de compte.
**Current focus:** Phase 1 — OAuth Infrastructure (native deps, entitlements, Supabase provider config)

## Current Position

Phase: Not started (defining requirements — complete, ready to plan)
Plan: —
Status: Ready to plan Phase 1

Progress: [░░░░░░░░░░] 0% (0/2 phases complete)

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

### Pending Todos

None yet.

### Blockers/Concerns

- Google/Apple OAuth client registration (Google Cloud Console + Apple Developer portal) requires
  human action outside this codebase — cannot be verified or completed from code alone
- Whether Supabase Auth's automatic-linking setting is currently enabled on the live `ziko` project
  is unverifiable from code — must be checked/enabled in the dashboard during Phase 1

## Session Continuity

Last session: 2026-08-23
Stopped at: Requirements + roadmap written, not yet committed/planned
Resume file: None — next step is `/gsd-discuss-phase 1 --ws connexion` or `/gsd-plan-phase 1 --ws connexion`
