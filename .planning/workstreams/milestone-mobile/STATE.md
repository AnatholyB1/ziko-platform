---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Mobile UX v2
status: in_progress
stopped_at: Phase 40 complete — 11/11 automated checks PASS
last_updated: "2026-05-27T20:47:21Z"
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 33
  completed_plans: 33
  percent: 90
---

# Project State — v1.7 Mobile UX v2

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)  
See: .planning/workstreams/milestone-mobile/ROADMAP-v1.7.md  
See: .planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md

**Core value:** Full visual redesign of the Ziko mobile app matching 24 canonical mockup files. Design + real data connections done together per screen. Active workout session excluded.

## Current Position

Phase: **40 — Extra Screens** — COMPLETE ✅ (6/6 plans, 11/11 automated checks PASS, 2026-05-27)

Previous: Phase 39 complete — 26/26 automated checks PASS ✅
Also complete (missing from prior STATE): Phase 36 — Workout Stack Redesign (12/12 PASS, 2026-05-25) ✅

Progress: [█████████░] 90% (9/10 phases complete)

## Accumulated Context

### Key Decisions

- Active workout session (`workout-active.jsx`) is the ONLY exclusion from the redesign
- Design + data connections handled together per screen (not two separate passes)
- 3-tab nav (Accueil/Séance/Profil) — PluginsDrawer replaces any separate plugin tab
- New shared components go in `packages/ui/`: FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip
- AICoachInline uses rule-based tips (not AI chat) — saves credits for real coaching
- Phase numbering continues from v1.6: phases 32–41
- 24 mockup files analyzed: all fixture data inventoried, all new components identified
- **Apparences screen:** Theme section removed; only Langue + Région + Unités kept, wired to DB
- **Parrainage rewards:** track-only (status `reward_pending`); no automated disbursement; admin credits manually; user sees "Récompense en attente — validation sous 48h"
- **useUnits() hook:** centralized unit conversion hook in `apps/mobile/src/hooks/useUnits.ts`; all measurement screens must consume it

### Fixture Inventory (to be replaced)

- `home.jsx`: PROFILE, STREAK, TODAY, FORME, RECENT, ALL_PLUGINS — ✅ DONE (Phase 33)
- `plugins.jsx`: NUTRITION_TODAY, WATER, HABITS, AI_PROGRAMS, PERSONAS, COACH_MESSAGES, FEED — ✅ DONE (Phase 37)
- `plugins-2.jsx`: STATS, SLEEP_DATA, GAMIFICATION, PANTRY, RECIPE data
- `coach.jsx`: COACH_DATA
- `workout-data.jsx`: SESSION_DATA
- `workout-program-ai.jsx`: PROGRAM_DETAIL, HISTORY_DETAIL
- `workout-rest-summary.jsx`: SUMMARY_DATA

### New Components Required (Phase 32) — all built ✅

- FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip, BugFab/BugSheet
- PaywallScreen, RechargeSheet, PluginsDrawer

### Pending Todos

- [x] Phase 32 — Design System Foundation — COMPLETE
- [x] Phase 33 — Home Screen Realignment — COMPLETE (all 5 plans, verified)
- [x] Phase 34 — Auth + Onboarding Redesign — COMPLETE (all 4 plans, verified)
- [x] Phase 35 — Profile + Settings Redesign — automated PASS; human smoke test gaps found
  - [x] 35-01 through 35-15 executed + verified (30/30 automated checks)
  - [ ] 35-G01 — Cache invalidation + mutation wiring
  - [ ] 35-G02 — Password change spinner fix
  - [ ] 35-G03 — Progress photo FormData + column fix
  - [ ] 35-G04 — Crédits IA real balance
  - [ ] 35-G05 — Apparences: remove theme, add language/region migration 052, useUnits hook
  - [ ] 35-G06 — Parrainage: migration 053 + Hono routes + mobile screen
  - [ ] 35-G07 — Gap verification (automated + smoke test re-run)
- [x] Phase 37 — Priority Plugins Redesign — COMPLETE (7/7 plans, smoke test APPROVED 2026-05-26)
- [x] Phase 38 — Remaining Plugins Group 1 — COMPLETE (4/4 plans, automated 10/10 PASS, smoke test APPROVED 2026-05-27)
- [x] Phase 36 — Workout Stack Redesign — COMPLETE (6/6 plans, automated 12/12 PASS, 2026-05-25) ← was missing from previous STATE
- [x] Phase 39 — Remaining Plugins Group 2 — COMPLETE (4/4 plans, automated 26/26 PASS, 2026-05-27)
- [x] Phase 40 — Extra Screens — COMPLETE (6/6 plans, 11/11 automated checks PASS, 2026-05-27) ✅
  - [x] 40-01 — Notifications + Store redesign
  - [x] 40-02 — AIChatScreen + AvatarUpload
  - [x] 40-03 — Calendar + Search + Help/Legal
  - [x] 40-04 — ProgramBuilder + Community stubs + LiftDetail + GoalEdit + Referral — DONE (0afabd7)
  - [x] 40-05 — EmptyState + ErrorScreen components + integrations
  - [x] 40-06 — Phase verification — DONE (11/11 PASS)
- [ ] Phase 41 — Coach StateC + Final Audit — NOT STARTED

### Blockers/Concerns

- Phase 35 gaps (35-G01–G07) still open — referral (35-G06) may overlap with Phase 40 plan 40-04. Coordinate or merge.

## Session Continuity

Last session: 2026-05-27
Stopped at: Phase 40 complete — 11/11 automated checks PASS. Phase 40 : VALIDATION COMPLETE.
Resume: Phase 35 gaps (35-G01–G07) then Phase 41 — Coach StateC + Final Audit.

---

## Archive — v1.6 Mobile v2 (SHIPPED 2026-05-21)

Phases 27–31 complete. See `.planning/workstreams/milestone-mobile/v1.6-MILESTONE-AUDIT.md`.
