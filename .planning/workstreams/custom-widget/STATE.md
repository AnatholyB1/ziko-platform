---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Custom Widget Dashboards
status: planning
last_updated: "2026-05-25"
last_activity: 2026-05-25
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25)

**Core value:** Coach customizes a per-athlete dashboard in 30s via Claude chat — live preview, one-click save
**Current focus:** Phase 01 — DB + API Foundation (ready to plan)

## Current Position

Phase: 01 of 04 (DB + API Foundation)
Plan: — of — in current phase
Status: Ready to plan
Last activity: 2026-05-25 — Roadmap created (4 phases, 22 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

- **Closed widget set (hard enum)**: 7 widget types only; Zod discriminated union rejects unknown types at schema level — scope-creep prevention
- **schema_version: 1 from day 1**: Add to root JSONB immediately; retrofitting after production data exists is days of debugging
- **Atomic tool execution (not streamText)**: Preview ONLY updates from `part.state === output-available`; streaming partial JSON causes invalid intermediate states
- **Array order for layout (not integer position field)**: Simpler schema; reorder_widgets tool shuffles the array
- **Multi-turn spike on day 1 of Phase 3**: Two-turn integration test must pass before any Phase 3 plan is marked complete (PITFALLS: forgetting `response.messages` silently breaks history)
- **Dashboard tools isolated in `coach/dashboards/tools.ts`**: Never merged into `coach/ai/tools.ts`; `stopWhen: stepCountIs(2)` (not 5)
- **/memory route registered before /:clientId in Hono**: Route order critical to prevent Hono treating "memory" as a clientId param

### Pending Todos

None yet.

### Blockers/Concerns

- Open question: drag-to-reorder confirmed in scope (DASH-03)? react-grid-layout install gates Phase 02 plan.
- Open question: credit deduction rate for `/ai-edit` — same as `coach_chat`? Must confirm before Phase 03.
- Open question: `coach_memory` in migration 054 or 055? Decide before Phase 01 migration is written.

## Session Continuity

Last session: 2026-05-25
Stopped at: Roadmap created, no plans written yet
Resume file: None
