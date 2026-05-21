---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Mobile UX v2
status: planning
last_updated: "2026-05-21T21:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 16
  completed_plans: 16
  percent: 75
---

# Project State — v1.7 Mobile UX v2

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)  
See: .planning/workstreams/milestone-mobile/ROADMAP-v1.7.md  
See: .planning/workstreams/milestone-mobile/REQUIREMENTS-v1.7.md

**Core value:** Full visual redesign of the Ziko mobile app matching 24 canonical mockup files. Design + real data connections done together per screen. Active workout session excluded.

## Current Position

Phase: **33 — Home Screen Realignment** — Plans 1–4 COMPLETE (plan 05 remaining)

Progress: [████████████░░░░] 75%

## Accumulated Context

### Key Decisions

- Active workout session (`workout-active.jsx`) is the ONLY exclusion from the redesign
- Design + data connections handled together per screen (not two separate passes)
- 3-tab nav (Accueil/Séance/Profil) — PluginsDrawer replaces any separate plugin tab
- New shared components go in `packages/ui/`: FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip
- AICoachInline uses rule-based tips (not AI chat) — saves credits for real coaching
- Phase numbering continues from v1.6: phases 32–41
- 24 mockup files analyzed: all fixture data inventoried, all new components identified

### Fixture Inventory (to be replaced)

- `home.jsx`: PROFILE, STREAK, TODAY, FORME, RECENT, ALL_PLUGINS
- `plugins.jsx`: NUTRITION_TODAY, WATER, HABITS, AI_PROGRAMS, PERSONAS, COACH_MESSAGES, FEED
- `plugins-2.jsx`: STATS, SLEEP_DATA, GAMIFICATION, PANTRY, RECIPE data
- `coach.jsx`: COACH_DATA
- `workout-data.jsx`: SESSION_DATA
- `workout-program-ai.jsx`: PROGRAM_DETAIL, HISTORY_DETAIL
- `workout-rest-summary.jsx`: SUMMARY_DATA

### New Components Required (Phase 32)

- FormRing (4-segment SVG wellness ring)
- AISuggestion (standardized inline AI tip card)
- SubTabs (segmented tab bar, 2–4 tabs)
- PluginHeader (back chevron + title + optional right)
- WeekStrip (7-day date grid with completion dots)
- BugFab + BugSheet (global floating bug report)
- PaywallScreen + RechargeSheet (monetization modals)
- PluginsDrawer (18-plugin bottom grid drawer)

### Pending Todos

- [x] Phase 32 — Design System Foundation — COMPLETE
- [x] Phase 33 Plans 01–04 — Home Screen Realignment — COMPLETE
- [ ] Run `/gsd:execute-phase 33` plan 05 — final integration test / smoke

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-21T21:00:00.000Z
Stopped at: Completed 33-04-PLAN.md (Final Assembly)
Resume: `/gsd:execute-phase 33` plan 05

---

## Archive — v1.6 Mobile v2 (SHIPPED 2026-05-21)

Phases 27–31 complete. See `.planning/workstreams/milestone-mobile/v1.6-MILESTONE-AUDIT.md`.
