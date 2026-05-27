# Phase 40: Advanced Dashboard Features - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver three things on top of the existing sport dashboard infrastructure built in Phases 38–39:
1. **Unified page** — a sub-tab strip on the dashboard page that lets coaches switch between the Sport view (Phase 38/39: sport selector + sport-specific charts) and the Personnalisé view (custom-widget system, v1.15 workstream)
2. **Compare mode** — Coach can compare two clients (same sport) OR two time periods (same client) side-by-side on the same chart axes. **Sport tab only.**
3. **PDF export** — Coach can export the currently active dashboard view as a PDF. **Both tabs.**

This phase does NOT add new data sources, new sport dashboards, or new chart types.

**Hard dependency:** Custom-widget workstream Phase 01 (DB + API Foundation: migration 054, `GET/PUT /coach/dashboards/:clientId`, widget-data endpoint) and Phase 02 (widget renderers, DashboardGrid) must be verified complete before Phase 40 Personnalisé tab integration can execute. Sport tab features (compare mode + PDF) can plan and partially implement in parallel.

</domain>

<decisions>
## Implementation Decisions

### Unified Page — Sub-tab Toggle
- **D-17:** The dashboard page gains a sub-tab strip at the **top of the dashboard content area** (above the sport selector control bar). Two tabs: **"Sport"** (left) and **"Personnalisé"** (right).
- **D-18:** Default tab when a coach opens the Dashboard page for the first time = **Sport view**.
- **D-19:** Tab labels are `Sport` and `Personnalisé` (French). The Sport tab renders the existing DashboardControlBar + sport-specific dashboard components. The Personnalisé tab renders the custom-widget DashboardGrid.
- **D-20:** The sub-tab strip is a simple CSS-only implementation — two pill buttons in a flex row, styled consistently with the existing date filter segmented control in DashboardControlBar.

### Compare Mode — Scope
- **D-01:** Both comparison types ship in this phase: client-vs-client AND period-vs-period
- **D-02:** Client comparison requires both clients to be on the same sport (enforced in UI — sport selector is set before entering compare mode)
- **D-03:** Period comparison snaps to the existing presets (Semaine / Mois / 3 Mois) — no custom date picker needed; Period A = current selection, Period B = a second preset chosen in compare mode
- **D-21:** Compare mode applies to the **Sport tab only**. The Personnalisé tab has no Compare button.

### Compare Mode — Entry Point / UI (Sport tab)
- **D-04:** Compare mode is triggered via a "Comparer" button added to the existing `DashboardControlBar` (not a separate route or modal)
- **D-05:** When Compare is activated, an inline row expands below the existing ControlBar containing: a mode toggle (Client / Période) and the relevant selector (client dropdown or second period preset buttons)
- **D-06:** The client picker for compare mode lists all of the coach's clients — same source as the existing client list — filtering out the currently viewed client
- **D-07:** Compare mode is dismissed by clicking Comparer again (toggle off), restoring the single-dataset view

### Compare Mode — Chart Rendering
- **D-08:** Each chart card renders dual series on the same axes (not side-by-side panels). Recharts `Line` / `Bar` components get a second data series added. A legend is shown on each card.
- **D-09:** Color scheme: current subject = `#FF5C1A` (existing primary orange), comparison subject = `#3B82F6` (blue). These are the canonical compare colors for the entire feature.
- **D-10:** KPI tile widgets (`kpi_tile` type) in compare mode display both values + a computed delta (e.g. "185 kg / 172 kg · +13 kg"). Not side-by-side numbers without delta.
- **D-11:** Chart cards that cannot meaningfully show two series (e.g. `callout`, `athlete_list`) are hidden or show a "non disponible en mode comparaison" note — planner to determine which widget types fall into this category.

### PDF Export
- **D-12 (UPDATED):** PDF generation is **client-side** via `html2canvas` + `jsPDF`. No serverless function required. The export button captures the rendered dashboard DOM to a canvas, then converts to PDF. Trade-off: bitmap (not vector) — chart labels may appear slightly lower resolution, but legible.
- **D-13:** Export scope = currently active tab only. Both Sport and Personnalisé tabs have an Export button.
- **D-14:** PDF filename/header includes: client name, active tab name (Sport or Personnalisé), sport type (if Sport tab + sport selected), and date range (if Sport tab).
- **D-15:** **Sport tab:** Export PDF button lives in the right side of `DashboardControlBar`, alongside the existing date range buttons. **Personnalisé tab:** Export PDF button lives in the top-right of the dashboard content header (next to the existing "Éditer" button).

### Claude's Discretion
- Widget types that cannot show dual series in compare mode (callout, athlete_list, threshold_indicator) — researcher/planner determines exact list and fallback behavior (hide vs. placeholder note)
- Loading/pending state for the compare row before the second dataset loads (spinner vs skeleton)
- Whether the sub-tab active state persists in localStorage or resets to Sport on each page load
- Exact html2canvas configuration (scale, useCORS, ignore elements like control buttons from capture)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard Infrastructure (Phases 38–39)
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — current dashboard page; this file gets the sub-tab strip and wires Sport vs Personnalisé content. **IMPORTANT: currently shows custom-widget implementation (useDashboardConfig). Sport view content needs to be restored alongside it.**
- `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` — existing ControlBar (sport selector + date filter); gets Compare button + PDF button added for Phase 40
- `apps/web/src/types/dashboard.ts` — widget type definitions (LineChartWidget, BarChartWidget, KpiTileWidget, etc.)
- `apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx` — pattern for chart widget renderers; dual-series requires adding a second `<Line>` component
- `apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx` — same pattern as LineChartWidget for bar charts
- `apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx` — single-value tile; needs compare variant showing A / B + delta
- `apps/web/src/components/coach/dashboard/WidgetRenderer.tsx` — routes widget type to renderer; must handle compare mode prop pass-through
- `apps/web/src/hooks/useDashboardConfig.ts` — hook that returns DashboardConfig for the Personnalisé view
- `apps/web/src/hooks/useWidgetData.ts` — data fetching hook for individual widgets

### Custom-Widget Workstream (gate dependency)
- `.planning/workstreams/custom-widget/STATE.md` — check Phase 01+02 verification status before planning Personnalisé tab integration
- `.planning/workstreams/custom-widget/ROADMAP.md` — Phase 01 requirements (migration 054, CRUD routes, widget-data endpoint) must be complete
- `apps/web/src/components/coach/dashboard/DashboardGrid.tsx` — the Personnalisé tab renders this component
- `apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx` — callout widget (likely excluded from compare mode)
- `apps/web/src/components/coach/dashboard/widgets/AthleteListWidget.tsx` — athlete list (likely excluded from compare mode)

### Requirements
- `.planning/workstreams/main/REQUIREMENTS.md` — DASH-04 (comparison), DASH-05 (PDF export) are the two requirements for this phase
- `.planning/workstreams/main/ROADMAP.md` — Phase 40 success criteria (3 criteria: compare mode, PDF generation, PDF legibility)

### Prior Phase Contexts
- `.planning/workstreams/main/phases/38-dashboard-foundation-powerlifting/038-CONTEXT.md` — Sport tab data fetching architecture, animation decisions, TanStack Query patterns
- `.planning/workstreams/main/phases/37-ui-design-contract/037-UI-SPEC.md` — Visual design spec for all dashboard surfaces; card anatomy and chart styles apply to compare mode UI

### Chart Library
- Recharts is the chart library already in use — all new work must use Recharts. No new chart library introduction.

### PDF Library
- `html2canvas` + `jsPDF` — install both for Phase 40 PDF export. No serverless function.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardControlBar` (`apps/web/src/components/coach/dashboard/DashboardControlBar.tsx`): Flex row, sport selector left + date filter right. Phase 40 adds: Compare button (between date filter and a new Export PDF button) in the right section.
- `useWidgetData` hook: Currently `(clientId, widgetType, period, dataKey)`. Compare mode makes a second parallel call with the second `clientId` (or second `period`) to fetch the comparison dataset.
- `ChartCard` (`apps/web/src/components/coach/dashboard/ChartCard.tsx`): Wraps every chart. Has `aiInsight` slot. Can receive compare-mode colors/legend as additional props.
- `WidgetRenderer` (`apps/web/src/components/coach/dashboard/WidgetRenderer.tsx`): Routes widget type → component. Must pass `compareMode: boolean` and `compareData` down through here.
- `DashboardGrid` (`apps/web/src/components/coach/dashboard/DashboardGrid.tsx`): Currently used by Personnalisé tab. Receives `widgets`, `clientId`, `isEditMode`. PDF export captures this grid.

### Dashboard Page Current State
The current `dashboard/page.tsx` uses `useDashboardConfig` + `DashboardGrid` (custom-widget implementation). Phase 40 needs to add the sub-tab strip so both systems coexist: Sport tab restores DashboardControlBar + sport-specific rendering; Personnalisé tab continues using the existing DashboardGrid.

### Established Patterns
- All dashboards render as a grid of chart cards. Compare extension fits this pattern — don't break the grid layout.
- Light sport theme only (`#F7F6F3` background, `#FF5C1A` primary, `#E2E0DA` border). No dark mode variants needed.
- French UI labels throughout: "Sport", "Personnalisé", "Comparer", "Exporter PDF", "Semaine", "Mois", "3 Mois".
- Date filter segmented control style (pill buttons in a bordered container) — reuse for sub-tab strip styling.

### Integration Points
- Compare mode client picker: needs access to coach's client list. Use existing client list fetching patterns in the coach platform.
- Sub-tab strip state: `useState<'sport' | 'widget'>('sport')` at the top of `dashboard/page.tsx`.
- PDF export trigger: button onClick calls `html2canvas(dashboardElement)` then `pdf.addImage()` then `pdf.save()`. Target element ref needs to exclude control buttons from capture.

</code_context>

<specifics>
## Specific Ideas

- **Sub-tab strip visual:** Same pill-button style as the existing date filter (`bg-surface-alt rounded-lg p-0.5 border border-border`), two buttons, active button gets `bg-primary text-white shadow-sm`.
- **Sport tab experience flow:** Coach is on Client A's powerlifting dashboard → clicks "Comparer" in the ControlBar → a row expands below with "Client / Période" toggle → selects Client B → charts immediately re-render with dual series (orange = Client A, blue = Client B)
- **Period comparison:** Coach stays on the same client → clicks "Comparer" → selects "Période" mode → picks a second preset → charts show two lines for the two time windows
- **PDF filename:** `[client-name]-[sport-or-widget]-dashboard-[YYYY-MM-DD].pdf`

</specifics>

<deferred>
## Deferred Ideas

- Custom date picker for period comparison (arbitrary start/end dates) — would add significant scope; not needed for v1.8
- Export all sports in a single PDF — deferred, would require rendering each sport dashboard separately
- Compare mode for Personnalisé (custom-widget) tab — explicitly deferred; compare is Sport tab only in Phase 40
- CSV/Excel export — explicitly out of scope per REQUIREMENTS.md
- Sub-tab strip state persistence in localStorage — Claude's discretion, not a hard requirement

</deferred>

---

*Phase: 40-Advanced Dashboard Features*
*Context gathered: 2026-05-27 (updated)*
