---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Custom Widget Dashboards
status: shipped
last_updated: "2026-05-28"
last_activity: 2026-05-28
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State

## Project Reference

See: `.planning/workstreams/custom-widget/milestones/v1.15-ROADMAP.md`

**Core value:** Coach customizes a per-athlete dashboard in 30s via Claude chat — live preview, one-click save
**Milestone status:** ✅ SHIPPED 2026-05-28

## Shipped Summary

**v1.15 Custom Widget Dashboards** — 4 phases, 19 plans, 2026-05-25 → 2026-05-28

Key deliverables:
- Migration 056: `dashboard_configs` + `coach_memory` tables live in production Supabase
- 7 widget types rendering live athlete data (Recharts + react-grid-layout v2)
- AI edit session: split-screen, SSE tool calls, live preview, 15/15 PITFALLS cleared
- Coach memory: TemplatePicker (GSAP), TemplateNamingModal, personalized opening message
- Post-audit fix: MEM-01 apply path (TemplatePicker now reachable for new dashboard pairs)

**WOW criterion met:** Guillaume customizes a dashboard in under 30s via chat and saves it.

## Key Decisions (Permanent Record)

- Closed widget set (hard enum) — Zod discriminated union rejects unknown types at schema level
- `schema_version: 1` from day 1 to avoid production retrofits
- Atomic tool execution — preview only updates from `part.state === output-available`
- `/memory` route registered before `/:clientId` in Hono (route order critical)
- `stopWhen: stepCountIs(2)` for dashboard edit
- `getDashboardConfig` returns `[]` for new pairs (not DEFAULT_WIDGETS) — TemplatePicker trigger
- TemplatePicker auto-skips via useEffect when `templates.length === 0`

## Tech Debt Carried Forward

- `TemplateNamingModal` does not invalidate `['coach-memory']` query cache after save
- `DashboardEmptyState` missing `prompt` prop in `page.tsx`
- `DELETE /coach/dashboards/:clientId` route has no frontend caller
- No VERIFICATION.md files for any of the 4 phases
