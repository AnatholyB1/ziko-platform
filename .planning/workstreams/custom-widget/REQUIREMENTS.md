# Requirements: v1.15 Custom Widget Dashboards

**Workstream:** `custom-widget`
**Milestone:** v1.15
**Status:** Active
**Last updated:** 2026-05-25

---

## v1 Requirements

### Dashboard Core (DASH)

- [x] **DASH-01**: Coach can view a full-screen dashboard tab on each client detail page
- [x] **DASH-02**: Dashboard loads a default config (3–4 pre-built widgets) on first access for a coach+athlete pair
- [x] **DASH-03**: Coach can drag and resize widgets to reorder the layout (react-grid-layout, locked in view mode)
- [ ] **DASH-04**: Dashboard config persists per coach+athlete pair in Supabase

### Widgets — Closed Set of 7 Types (WIDGET)

- [ ] **WIDGET-01**: Line chart — time series, configurable dataKey and period
- [ ] **WIDGET-02**: Bar chart — aggregated metric by period
- [ ] **WIDGET-03**: KPI tile — single metric with trend indicator
- [ ] **WIDGET-04**: Table — list of recent sessions/entries
- [ ] **WIDGET-05**: Athlete list — coach's linked athletes with last activity date
- [ ] **WIDGET-06**: Threshold indicator — metric vs target, color-coded
- [ ] **WIDGET-07**: Callout — free-text note added by coach

### AI Edit Session (EDIT)

- [ ] **EDIT-01**: Coach can enter edit mode: split-screen (dashboard preview left + chat right)
- [x] **EDIT-02**: Coach types in chat → Claude calls tools (add/update/remove/reorder widget) → live preview updates
- [ ] **EDIT-03**: Changes visible in preview before any save action
- [ ] **EDIT-04**: Coach can save (persist to Supabase) or cancel (discard preview)
- [ ] **EDIT-05**: Edit chat restricted to dashboard tools only — no general coaching questions in this session

### Coach Memory (MEM)

- [ ] **MEM-01**: Coach can save current dashboard as a reusable template
- [ ] **MEM-02**: Coach's widget preferences (defaults) persist for future dashboards

### Infrastructure (INFRA)

- [ ] **INFRA-01**: Migration 054: `dashboard_configs` (coach_id, client_id, widgets JSONB flat array with `{x,y,w,h}`) + `coach_memory` (templates + prefs)
- [ ] **INFRA-02a**: Hono bounded context `coach/dashboards/` — 5 CRUD routes (GET/:clientId, PUT/:clientId, DELETE/:clientId, GET/memory, PUT/memory)
- [x] **INFRA-02b**: `POST /coach/dashboards/:clientId/ai-edit` — SSE endpoint for Claude dashboard tools (Phase 03)
- [ ] **INFRA-03**: `GET /coach/clients/:clientId/widget-data` — aggregates athlete data per widget type with period scoping
- [ ] **INFRA-04**: Zod discriminated union strict (`additionalProperties: false`) + `schema_version: 1` from day one

---

## Out of Scope

- Vocal input (covered by workstream `retour-vocal`)
- Custom widget types / infinite extensibility
- Node-based / graph editor
- Color pickers, drag-onto-empty-canvas flows (anti-feature for 30s criterion)
- Auto-save (explicit "Sauvegarder" action required)
- General coaching chat in the edit session (separate chat route)

---

## Future Requirements (Deferred)

- Dashboard sharing between coaches
- Per-athlete dashboard export (PDF)
- Widget comments / annotations
- Mobile read-only view of coach dashboard

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 02 | Complete |
| DASH-02 | Phase 02 | Complete |
| DASH-03 | Phase 02 | Complete |
| DASH-04 | Phase 01 | Pending |
| WIDGET-01 | Phase 02 | Pending |
| WIDGET-02 | Phase 02 | Pending |
| WIDGET-03 | Phase 02 | Pending |
| WIDGET-04 | Phase 02 | Pending |
| WIDGET-05 | Phase 02 | Pending |
| WIDGET-06 | Phase 02 | Pending |
| WIDGET-07 | Phase 02 | Pending |
| EDIT-01 | Phase 03 | Pending |
| EDIT-02 | Phase 03 | Complete |
| EDIT-03 | Phase 03 | Pending |
| EDIT-04 | Phase 03 | Pending |
| EDIT-05 | Phase 03 | Pending |
| MEM-01 | Phase 04 | Pending |
| MEM-02 | Phase 04 | Pending |
| INFRA-01 | Phase 01 | Pending |
| INFRA-02a | Phase 01 | Pending |
| INFRA-02b | Phase 03 | Complete |
| INFRA-03 | Phase 01 | Pending |
| INFRA-04 | Phase 01 | Pending |

---

## Key Constraints

- **WOW criterion**: Guillaume customizes a dashboard in 30s via chat and saves it
- **Dev timeline**: 2–3 weeks, parallelized effort
- **Complexity ceiling**: closed widget set, flat JSON, no graph architecture
- **Stack**: react-grid-layout@2.2.1 (only new dep); Recharts already at v3.8.1
