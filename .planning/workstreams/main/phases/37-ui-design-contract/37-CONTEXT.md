# Phase 37: UI Design Contract - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create an unambiguous visual design contract for every sport dashboard surface in the coach web app (Next.js) before any implementation code is written. Output: **UI-SPEC.md** covering the tab shell, sport selector control bar, date filter, all 4 Powerlifting chart layouts (1RM SBD, RPE trend, Tonnage, Intensity %), and the AI insight chip slot reserved in each card. Design contract also sketches the Hyrox/Running/Bodybuilding/Weight Loss card layouts so Phase 39 can implement without additional design discussion.

**In scope:** Tab shell (Dashboard tab added to ClientTabStrip), global control bar (sport selector + date filter), Powerlifting 4-chart layout, remaining 4 sport dashboard surface outlines, chart card anatomy (title + chart + AI chip slot), empty state, chart color tokens.

**Out of scope:** Comparison mode UX (Phase 40), narrative summary card (Phase 41), alert thresholds panel (Phase 41), actual chart data queries, PDF export trigger styling (Phase 40).

</domain>

<decisions>
## Implementation Decisions

### Global Control Bar
- **D-01:** The date filter is **global** — one segmented control (`[Week] [Month] [3M]`) at the top of the dashboard tab, in the same row as the sport type selector. All 4 charts update simultaneously. No per-card filter.
- **D-02:** Sport selector sits on the **left** of the control bar; date filter sits on the **right**. Both are visible above the chart grid at all times without scrolling.

### Powerlifting Chart Layout
- **D-03:** The 4 Powerlifting charts use a **2×2 grid**. Chart height: `h:240`. Matches the compact density of existing `ComparisonChart.tsx` style. Entire dashboard visible without vertical scroll on a standard coach laptop.
- **D-04:** The 1RM SBD chart uses **3 lines on one Recharts `LineChart`** — one line per lift. Color coding: Squat = `#FF5C1A` (primary orange), Bench = `#3B82F6` (blue), Deadlift = `#22C55E` (green). Consistent with `CLIENT_COLORS` already defined in `ComparisonChart.tsx`.

### Chart Card Anatomy
- **D-05:** Every chart card includes a **reserved AI insight row** at the bottom — a thin separator + a 🧠 icon placeholder row. This slot is built in Phase 38/39 (layout + placeholder text) and filled with real AI content in Phase 41. Prevents layout shift when Phase 41 ships.
- **D-06:** Chart card structure (top to bottom): card title → Recharts chart (h:240) → horizontal rule → AI insight row (placeholder). White background, `rounded-2xl`, `border border-border`, `p-6` — matching `ComparisonChart.tsx` card style.

### Claude's Discretion
- Exact empty state illustration/icon for dashboard when client has no data in selected sport+period — Claude picks a clean Ionicons-compatible approach or simple text with icon
- Sport selector component: styled `<select>` element or custom dropdown — Claude picks based on simplicity and design fit
- Chart card title typography: font weight / size within existing Tailwind conventions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/workstreams/main/REQUIREMENTS.md` — full v1.8 requirements (DASH-01–05, PL-01–04, HYR-01, RUN-01, BB-01, WL-01, AI-01–04)
- `.planning/workstreams/main/ROADMAP.md` §Phase 37 — success criteria (what UI-SPEC.md must cover)
- `.planning/workstreams/main/STATE.md` — accumulated decisions (sport selector = dropdown, ui_safety_gate)

### Existing Web Components (must read before designing)
- `apps/web/src/components/coach/ClientTabStrip.tsx` — existing tab strip; "Dashboard" tab added as `{ key: 'dashboard', label: 'Dashboard' }` entry
- `apps/web/src/components/coach/ComparisonChart.tsx` — chart card pattern, Recharts imports, `CLIENT_COLORS` palette, card styles
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — client detail layout; flex with children + w-72 notes panel sidebar

### Design Tokens (locked)
- Primary: `#FF5C1A` | Background: `#F7F6F3` | Surface: `#FFFFFF` | Border: `#E2E0DA` | Text: `#1C1A17` | Muted: `#6B6963`
- Chart color palette (from ComparisonChart): `['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B']`

### Chart Library
- Recharts v3 (`^3.8.1`) — already installed; use `LineChart`, `BarChart`, `AreaChart`, `ResponsiveContainer` from `recharts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/coach/ComparisonChart.tsx` — ready-made Recharts card with `LineChart`/`BarChart`, `ResponsiveContainer`, `CartesianGrid`, `Tooltip`, `Legend`. Copy card structure for all dashboard chart cards.
- `apps/web/src/components/coach/ClientTabStrip.tsx` — extend `TABS` array with `{ key: 'dashboard', label: 'Dashboard' }` to add the new tab
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — layout already provides `flex-1 min-w-0` content area (~840px at lg) alongside `w-72` notes panel

### Established Patterns
- Chart cards: `bg-white rounded-2xl border border-border p-6` (from ComparisonChart)
- Grid: Tailwind `grid grid-cols-2 gap-4` for 2×2 layout
- Empty state pattern: centered `<p className="text-sm text-muted">` inside a bordered card (already used in ComparisonChart)
- Color tokens: inline style objects using hex values (NativeWind design system tokens, same values in web Tailwind config)

### Integration Points
- New route: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — client component that receives `{ params: { id } }` (same pattern as other tab pages like `sessions/page.tsx`)
- `ClientTabStrip.tsx` TABS array — add Dashboard entry (pathname-based active detection already handles it)
- Supabase queries will use `is_coach_of()` RLS (coach has read access to client's data tables) — same pattern as other client detail tabs

</code_context>

<specifics>
## Specific Ideas

- **Global control bar layout:** `[ Powerlifting ▾ ]` on left, `[Week] [Month] [3M]` segmented pill group on right — both in a `flex justify-between` row above the chart grid
- **2×2 chart grid:** `grid grid-cols-2 gap-4` — four cards, each `rounded-2xl border border-border bg-white p-6`
- **SBD line colors:** Squat=#FF5C1A, Bench=#3B82F6, Deadlift=#22C55E — reuse first 3 entries of CLIENT_COLORS
- **AI chip slot:** `border-t border-border pt-3 mt-3 flex items-center gap-2 text-xs text-muted` row with a 🧠 icon — placeholder text in Phase 38/39, real AI content in Phase 41

</specifics>

<deferred>
## Deferred Ideas

- Comparison mode UX (second client or second period side-by-side) — Phase 40 scope
- Narrative summary card at top of dashboard (AI-generated paragraph) — Phase 41 scope
- Alerts panel per client (numeric threshold config) — Phase 41 scope
- PDF export trigger button styling — Phase 40 scope
- Per-card date filter (independent range per chart) — deferred entirely; global filter is the chosen approach

</deferred>

---

*Phase: 37-ui-design-contract*
*Context gathered: 2026-05-25*
