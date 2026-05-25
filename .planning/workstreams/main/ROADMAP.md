# ROADMAP — v1.8 Sport Dashboards

**Workstream:** main (web/coach — Next.js)
**Milestone:** v1.8 Sport Dashboards
**Granularity:** Standard
**Coverage:** 17/17 requirements mapped

---

## Phases

- [ ] **Phase 37: UI Design Contract** - Design all dashboard surfaces, sport selector, and chart layouts before any implementation
- [ ] **Phase 38: Dashboard Foundation + Powerlifting** - Dashboard tab shell, sport selector, date filter, and complete Powerlifting dashboard (4 charts)
- [ ] **Phase 39: Four Sport Dashboards** - Hyrox, Running/Cardio, Bodybuilding, and Weight Loss/Injury Return dashboards
- [ ] **Phase 40: Advanced Dashboard Features** - Side-by-side comparison and PDF export
- [ ] **Phase 41: AI Context Injection** - Dashboard metrics injected into coach chat, insight chips, narrative summary, alert thresholds

---

## Phase Details

### Phase 37: UI Design Contract
**Goal**: Coach and builder share an unambiguous visual contract for every dashboard surface before any code is written
**Depends on**: Nothing (first phase)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, PL-01, PL-02, PL-03, PL-04, HYR-01, RUN-01, BB-01, WL-01, AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. UI-SPEC.md exists and covers every dashboard surface: tab shell, sport type selector dropdown, date range filter, all 4 Powerlifting chart layouts, Hyrox/Running/Bodybuilding/Weight Loss layouts, comparison mode layout, PDF export trigger, AI insight chips placement, and narrative summary card
  2. Figma file contains annotated mockups for each surface with exact color tokens (#FF5C1A primary, #F7F6F3 background), typography, and spacing
  3. Chart library selection is documented (component name, import path) with a rationale note
  4. Every chart variant (line, bar, multi-series) is represented with sample data shapes matching the actual Supabase table columns queried
**Plans**: TBD
**UI hint**: yes

### Phase 38: Dashboard Foundation + Powerlifting
**Goal**: Coach can open any client's Dashboard tab, select Powerlifting, filter by date range, and immediately see four meaningful charts — no configuration required
**Depends on**: Phase 37
**Requirements**: DASH-01, DASH-02, DASH-03, PL-01, PL-02, PL-03, PL-04
**Success Criteria** (what must be TRUE):
  1. Coach navigates to any client detail view and sees a "Dashboard" tab alongside the existing tabs
  2. Coach opens the tab, selects "Powerlifting" from the sport dropdown, and four chart cards render instantly: 1RM SBD progression, RPE trend, weekly tonnage, intensity %
  3. Coach selects Week / Month / 3 Months from the date filter and all four charts re-render to match the selected range
  4. Charts show empty-state messaging (not a crash) when the client has no session data in the selected range
**Plans**: TBD
**UI hint**: yes

### Phase 39: Four Sport Dashboards
**Goal**: Coach can switch the sport selector to any of four additional sports and see a relevant, data-driven dashboard for that client
**Depends on**: Phase 38
**Requirements**: HYR-01, RUN-01, BB-01, WL-01
**Success Criteria** (what must be TRUE):
  1. Selecting "Hyrox" renders station splits, finish time trend, and weekly training volume sourced from cardio_sessions
  2. Selecting "Running / Cardio" renders pace trend, weekly distance, VO2max estimate, and distance chart from cardio_sessions
  3. Selecting "Bodybuilding" renders volume per muscle group, progressive overload tracking, and bodyweight trend from session_sets and body_measurements
  4. Selecting "Weight Loss / Injury Return" renders bodyweight curve, calorie compliance, and load progression sourced from body_measurements, nutrition_logs, and session_sets
  5. All four dashboards respect the date range filter already built in Phase 38
**Plans**: TBD
**UI hint**: yes

### Phase 40: Advanced Dashboard Features
**Goal**: Coach can perform deep analysis by comparing two clients or two periods, and can produce a shareable PDF snapshot of any active dashboard
**Depends on**: Phase 38
**Requirements**: DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Coach can select "Compare" mode and choose a second client (or a second date period) — both datasets render side-by-side on the same chart axes with visually distinct colors
  2. Coach can click "Export PDF" and a PDF is generated client-side or server-side containing the currently visible dashboard charts and client name/date range header
  3. The exported PDF renders legibly — chart lines, labels, and axis ticks are not blurred or cut off
**Plans**: TBD
**UI hint**: yes

### Phase 41: AI Context Injection
**Goal**: The coach's AI chat is aware of what the dashboard is showing, each chart surface displays an AI-generated insight, and the coach can configure numeric alerts that the AI monitors
**Depends on**: Phase 38
**Requirements**: AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. When the coach sends a message in the coach chat while a client's dashboard is open, the active sport type and top-3 chart metrics (latest values) are included in the system prompt — the AI can reference them without the coach re-explaining
  2. Each chart card on the dashboard displays a one-line AI insight chip (e.g. "Fatigue trending up this week") that updates when the date filter changes
  3. A narrative summary card appears at the top of the dashboard with a one-paragraph AI-generated overview of the client's overall performance for the selected period
  4. Coach can open an "Alerts" panel per client, define a numeric threshold for any metric (e.g. RPE avg > 8.5), and the system flags the coach — visually on the dashboard or via notification — when the threshold is crossed
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. UI Design Contract | 0/0 | Not started | - |
| 38. Dashboard Foundation + Powerlifting | 0/0 | Not started | - |
| 39. Four Sport Dashboards | 0/0 | Not started | - |
| 40. Advanced Dashboard Features | 0/0 | Not started | - |
| 41. AI Context Injection | 0/0 | Not started | - |

---

*Created: 2026-05-25 — Milestone v1.8 Sport Dashboards*
