---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Mobile UX v2
status: complete
stopped_at: Phase 41 complete — all 6 automated checks PASS, smoke test APPROVED
last_updated: "2026-05-28T00:00:00Z"
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 36
  completed_plans: 36
  percent: 100
---

# Project State — v1.7 Mobile UX v2

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)  
See: .planning/workstreams/milestone-mobile/ROADMAP-v1.7.md  
See: .planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md

**Core value:** Full visual redesign of the Ziko mobile app matching 24 canonical mockup files. Design + real data connections done together per screen. Active workout session excluded.

## Current Position

Phase: **41 — Coach StateC + Final Audit** — COMPLETE ✅ (3/3 plans, 6/6 automated checks PASS, smoke test APPROVED, 2026-05-28)

Previous: Phase 40 — Extra Screens — COMPLETE ✅ (6/6 plans, 11/11 automated checks PASS, 2026-05-27)

Previous: Phase 39 complete — 26/26 automated checks PASS ✅
Also complete (missing from prior STATE): Phase 36 — Workout Stack Redesign (12/12 PASS, 2026-05-25) ✅

Progress: [██████████] 100% (10/10 phases complete) — **v1.7 MILESTONE COMPLETE** 🎉

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
- [x] Phase 41 — Coach StateC + Final Audit — COMPLETE (3/3 plans, 6/6 automated checks PASS, smoke test APPROVED, 2026-05-28) ✅
  - [x] 41-01 — Coach StateC label fix (progress_label → "Habitudes aujourd'hui" / "Today's habits")
  - [x] 41-02 — INITIAL_MESSAGES fixture removed; loading/empty/error sweep (5 plugins + 3 data fixtures eliminated)
  - [x] 41-03 — Phase verification — DONE (6/6 PASS + smoke test APPROVED)

### Blockers/Concerns

- Phase 35 gaps (35-G01–G07) still open — referral (35-G06) may overlap with Phase 40 plan 40-04. Coordinate or merge.

## Session Continuity

Last session: 2026-05-28
Stopped at: Phase 41 complete — v1.7 milestone fully shipped.
Resume: Phase 35 gaps (35-G01–G07) remain open — tracked separately, do not block v1.7.

---

## Archive — v1.6 Mobile v2 (SHIPPED 2026-05-21)

Phases 27–31 complete. See `.planning/workstreams/milestone-mobile/v1.6-MILESTONE-AUDIT.md`.
