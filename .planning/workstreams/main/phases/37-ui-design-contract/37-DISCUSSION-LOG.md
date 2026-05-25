# Phase 37: UI Design Contract — Discussion Log

**Date:** 2026-05-25
**Workstream:** main (web/coach — Next.js)
**Areas discussed:** 4

---

## Area 1: Date filter placement

**Question:** Where does the Week / Month / 3 Months filter live on the dashboard?

**Options presented:**
- Global — top of dashboard (one control, all charts update simultaneously)
- Per-card — each chart has its own filter dropdown

**Selected:** Global — top of dashboard

**Notes:** Simpler UX and build. Matches REQUIREMENTS "filter by date range" as a single dashboard-level control. Sport selector and date filter share a control bar row at top of dashboard.

---

## Area 2: SBD chart design

**Question:** 1RM Squat / Bench / Deadlift — how are they displayed?

**Options presented:**
- 3 lines on one chart (Squat/Bench/Deadlift on single LineChart)
- 3 separate mini-charts (one card per lift, leaves only 1 slot for RPE)

**Selected:** 3 lines on one chart

**Notes:** Compact, easy to see relative strength at a glance. 3 separate charts would consume 3 of 4 chart slots, leaving no room for RPE. Colors: S=#FF5C1A, B=#3B82F6, D=#22C55E (reuse CLIENT_COLORS from ComparisonChart.tsx).

---

## Area 3: Chart grid density

**Question:** 4 Powerlifting charts — what's the layout?

**Options presented:**
- 2×2 grid (2 columns, 2 rows, h:240 per card)
- Single column stack (full width, requires scrolling)

**Selected:** 2×2 grid

**Notes:** All 4 charts visible without scrolling on a typical coach laptop. Matches existing ComparisonChart card style. Content area ~840px with notes panel sidebar.

---

## Area 4: AI chip reservation

**Question:** Phase 41 adds insight chips to chart cards — how does Phase 37 handle them?

**Options presented:**
- Reserve space now (every chart card includes AI insight row from Phase 38/39)
- Purely additive in Phase 41 (chips injected on top of existing layout)

**Selected:** Reserve space now

**Notes:** Prevents layout shift when Phase 41 ships. Phase 38/39 builds the slot with placeholder text; Phase 41 fills it with real AI content. Slot design: border-t separator + 🧠 icon + placeholder text row.

---

## Deferred ideas noted

- Comparison mode UX → Phase 40
- Narrative summary card → Phase 41
- Alerts panel → Phase 41
- PDF export trigger → Phase 40
- Per-card date filter → deferred (global chosen)

---

*Human-readable audit log. NOT consumed by downstream agents — they read 37-CONTEXT.md.*
