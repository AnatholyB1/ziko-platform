# Phase 26: CRM Client Management — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 26 — CRM Client Management
**Areas discussed:** Roster list UX, Client detail tabs, Executive summary metrics, Comparison chart + notes schema

---

## Roster List UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full TanStack Table | Client-side sorting + filtering, pagination, column toggle. Install @tanstack/react-table | ✓ |
| Server-filtered simple list | Server renders filtered rows via URL search params — no TanStack | |

**User's choice:** Full TanStack Table

---

## Signal Filter Definitions

| Option | Description | Selected |
|--------|-------------|----------|
| Simple date-threshold checks | Missed 2 sessions = no workout in 14d; stale measurements = 28d; mood declining = last-3 avg < prev-3 avg | ✓ |
| Ask me to define thresholds | User has specific thresholds | |
| Skip signals for MVP | Defer CLIENT-02 signal filters | |

**User's choice:** Simple date-threshold checks (14d sessions, 28d measurements, last-3 vs prev-3 mood avg)

---

## Client Detail Tabs

| Option | Description | Selected |
|--------|-------------|----------|
| All 7 tabs (SC2 as written) | Sessions, measurements, habits, nutrition, sleep, cardio, journal in Phase 26 | ✓ |
| Priority 4 tabs first | Sessions + measurements + habits + nutrition as MVP, rest in gap closure | |

**User's choice:** All 7 tabs in Phase 26 MVP

---

## Tab Data Loading

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tab server fetch | Each tab is a dynamic route segment; URL-addressable | ✓ |
| Single page, client-side tab switch | One server component loads all data upfront | |

**User's choice:** Per-tab server fetch (URL segments)

---

## Weekly Compliance Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Sessions this week / 3 | Count workout_sessions this week / 3 assumed frequency | |
| Habit completion rate | Avg daily habit_logs completion % over 7 days | |
| Both sessions + habits | Two sub-metrics: X/3 sessions + Y% habits | ✓ |

**User's choice:** Both sessions + habits (dual sub-metrics in summary card)

---

## Mood Trend Display

| Option | Description | Selected |
|--------|-------------|----------|
| Color badge + avg delta | "Humeur: ↓ 3.2 → 2.8" badge — no charting lib in summary card | ✓ |
| Mini sparkline in summary card | 7-dot sparkline inline — needs chart lib earlier | |

**User's choice:** Color badge + avg delta (red/orange/green/grey)

---

## Chart Library (CLIENT-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts | React-first API, ~50kb gz, LineChart + BarChart for comparison | ✓ |
| Chart.js via react-chartjs-2 | Flexible but larger bundle + imperative | |
| Defer CLIENT-07 to gap closure | Ship CLIENT-01–06+08 first | |

**User's choice:** Recharts

---

## Notes Versioning

| Option | Description | Selected |
|--------|-------------|----------|
| Just updated_at | Single row per coach↔client pair, overwritten on save | ✓ |
| Append-only notes log | Each save inserts new row; history scrollable | |

**User's choice:** Just updated_at (single overwrite row)

---

## Claude's Discretion

- Exact Tailwind class structure for TanStack Table
- Executive summary card layout (2-col vs 4-col grid)
- Tags + notes placement on detail page (right panel vs bottom section)
- Exact color values for mood trend badge
- Comparison metric selector (select vs styled dropdown)
- Load-more vs infinite scroll on tab data pages

## Deferred Ideas

- Notes history / append-only log → v1.6
- 1RM comparison metric → Phase 27
- Habit compliance per-client target frequency → Phase 27
- Programs tab on client detail → Phase 27 gap closure
- Multi-coach per athlete → v1.6
- Real-time roster refresh → post-v1.5
- Bulk tag operations → Phase 27+
