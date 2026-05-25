# Requirements — v1.8 Sport Dashboards

**Workstream:** main (web/coach — Next.js)
**Milestone:** v1.8 Sport Dashboards
**Status:** Active

---

## Dashboard Tab

- [ ] **DASH-01**: Coach can open a "Dashboard" tab in the client detail view
- [ ] **DASH-02**: Coach can select a sport type from a dropdown to load the matching dashboard instantly (no configuration required)
- [ ] **DASH-03**: Coach can filter chart data by date range (week / month / 3 months)
- [ ] **DASH-04**: Coach can compare two clients or two periods side-by-side on the same dashboard
- [ ] **DASH-05**: Coach can export the client's active dashboard as a PDF

## Powerlifting Dashboard

- [ ] **PL-01**: Coach sees 1RM SBD progression chart — estimated 1RM for Squat, Bench, and Deadlift over time
- [ ] **PL-02**: Coach sees Fatigue via RPE trend — session average RPE over time (early burnout warning signal)
- [ ] **PL-03**: Coach sees Weekly Tonnage chart — total kg lifted per week
- [ ] **PL-04**: Coach sees Intensity % chart — percentage of 1RM per session over time

## Hyrox Dashboard

- [ ] **HYR-01**: Coach sees Hyrox dashboard — station splits, finish times, weekly training volume

## Running / Cardio Dashboard

- [ ] **RUN-01**: Coach sees Running dashboard — pace trend, distance, VO2max estimate, weekly km

## Bodybuilding / Hypertrophy Dashboard

- [ ] **BB-01**: Coach sees Bodybuilding dashboard — volume per muscle group, progressive overload tracking, bodyweight trend

## Weight Loss / Injury Return Dashboard

- [ ] **WL-01**: Coach sees Weight Loss / Injury Return dashboard — bodyweight curve, calorie compliance, load progression for rehabilitation

## AI Context Injection

- [ ] **AI-01**: Active sport + key dashboard metrics are injected into the coach chat system prompt, enabling contextual AI analysis for that client
- [ ] **AI-02**: Dashboard displays AI-generated insight chips on each chart (e.g. "Fatigue trending up this week")
- [ ] **AI-03**: Dashboard shows a one-paragraph AI narrative summary card of the client's overall performance
- [ ] **AI-04**: Coach can set numeric alert thresholds per metric; AI flags the coach when a client crosses a threshold

---

## Data Source

All dashboards query existing Supabase tables — no new data collection tables:
- `session_sets` + `workout_sessions` — powerlifting/bodybuilding data (weight, reps, RPE, exercise)
- `cardio_sessions` — running/Hyrox data (distance, pace, duration, station splits)
- `body_measurements` — weight curve
- `nutrition_logs` — calorie compliance
- `user_profiles` — athlete profile (weight for % calculations)

---

## Future Requirements (deferred)

- Real-time live session tracking view on dashboard
- Coach-configurable custom chart layouts (drag-and-drop)
- Athlete-facing dashboard (read-only) on mobile
- Aggregation/pre-compute tables for sub-50ms dashboard load on large datasets

## Out of Scope

- Dark mode — light sport theme only
- New data collection — dashboards read existing tables only; no new workout logging features
- Mobile-native coach dashboard — web only in v1.8
- CSV/Excel export — PDF export only in v1.8

---

## Traceability

_Filled by roadmapper_

| REQ-ID | Phase |
|--------|-------|
| DASH-01–03 | — |
| DASH-04–05 | — |
| PL-01–04 | — |
| HYR-01 | — |
| RUN-01 | — |
| BB-01 | — |
| WL-01 | — |
| AI-01–04 | — |

---

*Created: 2026-05-25 — Milestone v1.8 Sport Dashboards*
