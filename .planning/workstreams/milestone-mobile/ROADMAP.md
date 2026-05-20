# Roadmap: v1.6 Mobile v2

**Workstream:** milestone-mobile  
**Milestone:** v1.6 Mobile v2  
**Parallel to:** v1.5 Coach Platform (Phases 22–31, main branch)  
**Branch:** milestone-mobile

## Overview

Five phases deliver the mobile athlete side of the coach-athlete link: a mandatory "Mon coach" plugin with a 3-state invitation UX (no code → preview → linked), revocation from settings, full fr+en i18n, and optional AI tools — all against zero new backend endpoints (Phase 25 routes reused). A parallel design catch-up thread retro-designs the four Phase 24 web surfaces that shipped without a Figma design contract and audits them for rework.

Design-first is enforced: Phases 28 (Mon coach Figma) and 30 (web surfaces Figma) always precede their implementation phases.

## Phases

- [ ] **Phase 27: Spike — Mandatory Plugin Pattern** — Validate data-driven vs registry-driven mandatory enforcement before any code is written
- [x] **Phase 28: UI Design — Mon coach Plugin** — Figma design contract for all 3 states (State A / B / C) before screen implementation
- [x] **Phase 29: Plugin "Mon coach" — Full Implementation** — Scaffold, mandatory enforcement, 3-state screen UX, revocation, i18n (completed 2026-05-20)
  > Design gate: Phase 28 complete 2026-05-18 — Phase 29 is unblocked.
- [x] **Phase 30: UI Design Catch-Up — Phase 24 Web Surfaces** — ~~N/A: web surfaces are out of scope for this mobile-only workstream. Dropped 2026-05-20.~~
- [ ] **Phase 31: AI Tools — coach_get_link + coach_revoke_link** — Optional AI tools wired into backend registry

## Phase Details

### Phase 27: Spike — Mandatory Plugin Pattern
**Goal**: The mandatory enforcement approach is validated with a written decision record before any implementation begins, eliminating architecture risk.
**Depends on**: Nothing (workstream foundation)
**Requirements**: COACH-05
**Success Criteria** (what must be TRUE):
  1. A spike document exists in `.planning/workstreams/milestone-mobile/phases/27-spike-mandatory-pattern/` comparing data-driven (`user_plugins.is_mandatory` column) vs registry-driven (`manifest.mandatory: true`) enforcement, with a recommended approach and rollback plan.
  2. The decision record identifies which code files must be touched for each approach and names the approach chosen (one wins, one is deferred).
  3. The "Désinstaller" button suppression behavior is confirmed to work end-to-end in a local test scenario for the chosen pattern.
**Plans**: 3 plans

Plans:
- [x] 27-01-PLAN.md — Write SPIKE.md decision record (comparison table, chosen approach, rollback plan, files-to-touch)
- [x] 27-02-PLAN.md — Apply 3 minimal code changes: mandatory field in PluginManifest, PluginLoader pre-load, store trash button gate
- [ ] 27-03-PLAN.md — End-to-end verification: TypeScript clean compile + human dev build confirmation

### Phase 28: UI Design — Mon coach Plugin
**Goal**: A Figma design contract for the "Mon coach" plugin exists before any mobile screen is built, fixing the design-first gate.
**Depends on**: Phase 27
**Requirements**: COACH-10
**Success Criteria** (what must be TRUE):
  1. A Figma file is produced via `/gsd-ui-phase` covering all 3 screen states: State A (code entry), State B (coach preview card), State C (linked coach card with metadata).
  2. A `UI-SPEC.md` in `.planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/` documents exact colors, shadow values (`shadowOpacity: 0.08, radius: 12, elevation: 3`), typography, component layout, and copy for each state.
  3. The design uses the light sport theme (`#FF5C1A` primary, `#F7F6F3` background, `#E2E0DA` border, `#1C1A17` text) and Ionicons icons throughout with no dark mode variants.
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 28-01-PLAN.md — UI-SPEC: Design Contract (retrospective, complete 2026-05-18)
- [x] 28-02-PLAN.md — Figma Mockup Generation (complete 2026-05-19 — coach.jsx primary + Figma cloud bonus)
- [x] 28-03-PLAN.md — Phase Verification & ROADMAP Update (complete 2026-05-19)

### Phase 29: Plugin "Mon coach" — Full Implementation
**Goal**: The "Mon coach" plugin is live on mobile: pre-installed and non-removable for athletes, displaying 3 states driven by the Phase 25 backend, with fr+en strings.
**Depends on**: Phase 28
**Requirements**: COACH-01, COACH-02, COACH-03, COACH-04, COACH-06, COACH-07, COACH-08, COACH-09, COACH-11, COACH-12, COACH-13, COACH-14
**Success Criteria** (what must be TRUE):
  1. An athlete with `role = 'client'` or `'both'` who signs in for the first time automatically has the coach plugin installed and enabled; the "Désinstaller" button is grayed out with a tooltip explaining it is mandatory.
  2. An athlete with no linked coach sees State A — a 6-character text input auto-uppercased, filtered to `[A-Z2-9]`, with a submit CTA enabled only when 6 valid characters are present; entering a non-existent or expired code shows a constant-time error message that does not reveal whether the code exists.
  3. After entering a valid code the athlete sees State B — a coach preview card showing photo, display name, specialties chips, bio, and KYC badge — and can either confirm ("Lier mon compte") or cancel.
  4. After confirming, the athlete sees State C — the coach card with "Lié depuis [date]" — and can tap "Retirer ce coach" from both the plugin screen and the Settings > Mon coach section; doing so opens a confirmation modal requiring the user to type "COACH" before the action fires, then calls `DELETE /coach/clients/links/:id` and returns to State A.
  5. Every user-facing string resolves via `useTranslation()` with a `coach.*` namespace; switching app locale shows correct French and English text for all states and error cases.
**Plans**: 4 plans

Plans:
- [x] 29-01-PLAN.md — Wave 0: UserProfile.role type fix + i18n keys + plugin scaffold (package.json, manifest, screens stub, route wrapper)
- [x] 29-02-PLAN.md — Wave 1: PluginLoader registration + auto-install for client-role athletes
- [x] 29-03-PLAN.md — Wave 1: CoachScreen full implementation (3 states, modal, stats queries)
- [x] 29-04-PLAN.md — Wave 2: Settings injection (MON COACH section) + store trash button tooltip

### Phase 30: UI Design Catch-Up — Phase 24 Web Surfaces
**Status**: ~~DROPPED 2026-05-20~~ — Web surfaces are out of scope for this mobile-only workstream. UIDESIGN requirements belong to the web platform workstream, not milestone-mobile.

Plans: N/A

### Phase 31: AI Tools — coach_get_link + coach_revoke_link
**Goal**: The coach plugin exposes two AI tools that let the Claude orchestrator check and revoke the coach link on behalf of the athlete.
**Depends on**: Phase 29
**Requirements**: COACH-15
**Success Criteria** (what must be TRUE):
  1. The plugin manifest declares `aiTools: [coach_get_link, coach_revoke_link]` with valid JSON Schema parameters; the tools appear in `GET /ai/tools` on the live backend.
  2. Asking the AI coach "Who is my coach?" triggers `coach_get_link` and returns the coach's display name and link date in the response.
  3. Asking the AI to "Retirer mon coach" triggers `coach_revoke_link`, which calls the existing `DELETE /coach/clients/links/:id` route, and the plugin screen returns to State A afterward.
**Plans**: 2 plans

Plans:

Wave 1:
- [ ] 31-01-PLAN.md — Implement `coach.ts`: `coach_get_link` + `coach_revoke_link` tool functions

Wave 2 *(blocked on Wave 1 completion)*:
- [ ] 31-02-PLAN.md — Wire into registry.ts (import + executors map + allToolSchemas) + update `plugins/coach/src/manifest.ts` (aiTools + aiSystemPromptAddition)

Cross-cutting constraints:
- userToken (JWT) is mandatory for both tool functions — confirmed gate and no_active_link guard required
- COACH-15 requires all 3 success criteria verifiable end-to-end before phase close

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 27. Spike — Mandatory Plugin Pattern | 2/3 | In Progress | - |
| 28. UI Design — Mon coach Plugin | 3/3 | Complete | 2026-05-19 |
| 29. Plugin "Mon coach" — Full Implementation | 4/4 | Complete   | 2026-05-20 |
| 30. UI Design Catch-Up — Phase 24 Web Surfaces | N/A | Dropped (out of scope) | 2026-05-20 |
| 31. AI Tools — coach_get_link + coach_revoke_link | 0/2 | Planned | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| COACH-01 | Phase 29 |
| COACH-02 | Phase 29 |
| COACH-03 | Phase 29 |
| COACH-04 | Phase 29 |
| COACH-05 | Phase 27 |
| COACH-06 | Phase 29 |
| COACH-07 | Phase 29 |
| COACH-08 | Phase 29 |
| COACH-09 | Phase 29 |
| COACH-10 | Phase 28 |
| COACH-11 | Phase 29 |
| COACH-12 | Phase 29 |
| COACH-13 | Phase 29 |
| COACH-14 | Phase 29 |
| COACH-15 | Phase 31 |
| UIDESIGN-01 | ~~Phase 30~~ — dropped (web scope) |
| UIDESIGN-02 | ~~Phase 30~~ — dropped (web scope) |
| UIDESIGN-03 | ~~Phase 30~~ — dropped (web scope) |
| UIDESIGN-04 | ~~Phase 30~~ — dropped (web scope) |
| UIDESIGN-05 | ~~Phase 30~~ — dropped (web scope) |

**Coverage: 20/20 requirements mapped.**
