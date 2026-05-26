---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Mobile UX v2
status: in_progress
stopped_at: Phase 37 complete — 7/7 plans executed, human smoke test approved 2026-05-26
last_updated: "2026-05-26T00:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 23
  completed_plans: 19
  percent: 66
---

# Project State — v1.7 Mobile UX v2

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)  
See: .planning/workstreams/milestone-mobile/ROADMAP-v1.7.md  
See: .planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md

**Core value:** Full visual redesign of the Ziko mobile app matching 24 canonical mockup files. Design + real data connections done together per screen. Active workout session excluded.

## Current Position

Phase: **37 — Priority Plugins Redesign** — COMPLETE ✅

Automated verification: 13/13 PASS ✅  
Human smoke test: APPROVED ✅ (2026-05-26)

Progress: [████████░░] 66%

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

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-26
Stopped at: Phase 37 complete — all 6 priority plugins redesigned (Nutrition, Hydration, Habits, AI Programs, Coach IA, Community). SubTabs pill style + AISuggestion label shipped. Backend persona injection active.
Resume: Next phase per ROADMAP-v1.7.md (Phase 36 gap closure or Phase 38).

---

## Archive — v1.6 Mobile v2 (SHIPPED 2026-05-21)

Phases 27–31 complete. See `.planning/workstreams/milestone-mobile/v1.6-MILESTONE-AUDIT.md`.
