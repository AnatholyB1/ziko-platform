# Roadmap: v1.15 Custom Widget Dashboards

**Workstream:** `custom-widget`
**Milestone:** v1.15
**Created:** 2026-05-25

---

## Overview

This milestone delivers a per-athlete customizable dashboard to the coach CRM. A coach opens the Dashboard tab on any client detail page, sees a default set of 7 widget types rendered with live athlete data, then enters edit mode where a split-screen chat with Claude lets them reshape the dashboard in natural language. The entire customize-to-save flow must complete in under 30 seconds. Long-term preferences and reusable templates persist in a `coach_memory` record, so future dashboards start from the coach's established defaults.

---

## Phases

- [ ] **Phase 01: DB + API Foundation** - Migration 054, 5 Hono CRUD routes, widget-data endpoint, Zod schema with `schema_version: 1`
- [ ] **Phase 02: Widget Renderers + Static Dashboard** - DashboardShell, DashboardGrid, all 7 widget components with live data, Dashboard tab wired in
- [ ] **Phase 03: AI Edit Session** - Split-screen editor, Claude tool calls, live preview via SSE, save/cancel, credit gate, PITFALLS checklist cleared
- [ ] **Phase 04: Polish + Coach Memory** - Template save/apply, coach preference persistence, opening message, discoverable Customize entry point

---

## Phase Details

### Phase 01: DB + API Foundation
**Goal**: The data layer and API surface are in place so every other phase can build without schema risk
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02a, INFRA-03, INFRA-04, DASH-04
**Success Criteria** (what must be TRUE):
  1. Migration 054 applies cleanly; `dashboard_configs` and `coach_memory` tables exist in Supabase with correct RLS policies (coach reads/writes only their own rows)
  2. `GET /coach/dashboards/:clientId` returns the stored widget array (or empty array for new pairs); `PUT` upserts and returns the full config with `schema_version: 1` intact
  3. `GET /coach/clients/:clientId/widget-data?type=X&period=Y` returns correctly shaped data for each of the 7 widget types
  4. The Zod discriminated union rejects an unknown widget type with a clear validation error; `additionalProperties: false` enforced on all variants
**Plans**: 5 plans

Plans:
- [ ] 01-PLAN-1.md — Migration 054: dashboard_configs + coach_memory tables with RLS
- [ ] 01-PLAN-2.md — Zod schemas: 7 widget type variants + DashboardConfigSchema + DEFAULT_WIDGETS
- [ ] 01-PLAN-3.md — Hono bounded context coach/dashboards/: 5 CRUD routes + app.ts mount
- [ ] 01-PLAN-4.md — Widget-data endpoint: GET /coach/clients/:clientId/widget-data for all 7 types
- [ ] 01-PLAN-5.md — [BLOCKING] Schema push + smoke tests: supabase db push + Phase 01 verification

### Phase 02: Widget Renderers + Static Dashboard
**Goal**: Coaches can open a real, populated dashboard on any client detail page with no AI involvement
**Depends on**: Phase 01
**Requirements**: DASH-01, DASH-02, DASH-03, WIDGET-01, WIDGET-02, WIDGET-03, WIDGET-04, WIDGET-05, WIDGET-06, WIDGET-07
**Success Criteria** (what must be TRUE):
  1. The Dashboard tab appears in the ClientTabStrip; clicking it for a new coach+athlete pair renders a default config of 3–4 pre-built widgets
  2. All 7 widget types (line chart, bar chart, KPI tile, table, athlete list, threshold indicator, callout) render without errors using real data from the widget-data endpoint
  3. Widget layout persists — if a coach reloads the page, the same widgets appear in the same positions
  4. Coach can drag and resize widgets to reorder the layout; changes are reflected immediately in the grid (locked in view mode once edit ends)
**Plans**: TBD
**UI hint**: yes

### Phase 03: AI Edit Session
**Goal**: Coaches can customize a dashboard via natural language chat and see changes live in under 30 seconds
**Depends on**: Phase 02
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, INFRA-02b
**Success Criteria** (what must be TRUE):
  1. Clicking "Customize" enters split-screen mode: dashboard preview on the left, chat panel on the right; view-mode dashboard is hidden
  2. Typing "Add a weight progression chart for the last 30 days" causes Claude to call `add_widget`, and the widget appears in the preview panel within 5 seconds — with no intermediate broken JSON states visible
  3. The preview reflects all pending changes (add, update, remove, reorder) before any save action; the original dashboard is unmodified until Save is clicked
  4. Clicking Save persists the pending config to Supabase and closes the split-screen; clicking Cancel discards all pending changes and restores the original view
  5. The edit chat refuses general coaching questions — Claude responds that this session is for dashboard customization only
  6. Two-turn integration test passes: add widget in turn 1, update it in turn 2 — conversation history is correctly appended after each step (PITFALLS checklist cleared)
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — tools.ts: 4 stateless widget mutation functions + buildDashboardSDKTools factory
- [x] 03-02-PLAN.md — POST /:clientId/ai-edit SSE endpoint in service.ts (streamText + onStepFinish + creditGate)
- [ ] 03-03-PLAN.md — DashboardEditOverlay + EditChatPanel + TypingIndicator + PreviewLoadingOverlay + SaveToast
- [ ] 03-04-PLAN.md — dashboard/page.tsx: Personnaliser button + isEditing state + overlay wiring
- [ ] 03-05-PLAN.md — Unit tests + two-turn integration test (D-18) + PITFALLS checklist clearance

### Phase 04: Polish + Coach Memory
**Goal**: Coaches can save dashboard templates and have their widget preferences remembered across athletes
**Depends on**: Phase 03
**Requirements**: MEM-01, MEM-02
**Success Criteria** (what must be TRUE):
  1. Coach can save the current dashboard as a named template; that template is available when creating a dashboard for a different athlete
  2. Coach's widget preferences (e.g., preferred default period, preferred chart types) persist in `coach_memory` and are applied automatically when a new dashboard is initialized
  3. The edit session opens with a concrete opening message listing 2–3 example customization actions, eliminating blank-slate paralysis
**Plans**: TBD

---

## Coverage Validation

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 02 | Pending |
| DASH-02 | Phase 02 | Pending |
| DASH-03 | Phase 02 | Pending |
| DASH-04 | Phase 01 | Pending |
| WIDGET-01 | Phase 02 | Pending |
| WIDGET-02 | Phase 02 | Pending |
| WIDGET-03 | Phase 02 | Pending |
| WIDGET-04 | Phase 02 | Pending |
| WIDGET-05 | Phase 02 | Pending |
| WIDGET-06 | Phase 02 | Pending |
| WIDGET-07 | Phase 02 | Pending |
| EDIT-01 | Phase 03 | Pending |
| EDIT-02 | Phase 03 | Pending |
| EDIT-03 | Phase 03 | Pending |
| EDIT-04 | Phase 03 | Pending |
| EDIT-05 | Phase 03 | Pending |
| MEM-01 | Phase 04 | Pending |
| MEM-02 | Phase 04 | Pending |
| INFRA-01 | Phase 01 | Pending |
| INFRA-02a | Phase 01 | Pending |
| INFRA-02b | Phase 03 | Pending |
| INFRA-03 | Phase 01 | Pending |
| INFRA-04 | Phase 01 | Pending |

**Coverage: 23/23 requirements mapped (18 v1 + 5 INFRA). No orphans.**

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. DB + API Foundation | 0/5 | Not started | - |
| 02. Widget Renderers + Static Dashboard | 0/TBD | Not started | - |
| 03. AI Edit Session | 2/5 | In Progress|  |
| 04. Polish + Coach Memory | 0/TBD | Not started | - |
