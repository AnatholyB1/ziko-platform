# Phase 02: Widget Renderers + Static Dashboard — Context

**Gathered:** 2026-05-26
**Status:** Ready for execution

---

<domain>
## Phase Boundary

Phase 02 owns the entire web-frontend layer of the custom-widget dashboard:
install react-grid-layout, build 7 widget renderer components, write two
TanStack Query hooks (`useDashboardConfig`, `useWidgetData`), and wire the
fully functional dashboard into the existing `dashboard/page.tsx` route under
`apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/`.

Backend is complete from Phase 01. No SQL, no Hono routes, no Supabase
migrations are touched in this phase.

</domain>

<decisions>
## Implementation Decisions

### React Grid Layout (DASH-03)
- **L-09 (pre-locked):** `react-grid-layout@2.2.1` — install in `apps/web/` only.
  Import the bundled CSS: `import 'react-grid-layout/css/styles.css'` and
  `import 'react-size-me/lib/styles.css'` (peer dep already pulled in by rgl).
  The grid runs in `isResizable={true}` + `isDraggable={true}` in edit mode;
  both flags are `false` in view mode. Edit mode toggled by a top-bar button.
- **D-10:** Grid column count = 12 (`cols={12}`), row height = 80px
  (`rowHeight={80}`). This maps cleanly to the `gridPos.{w,h}` values from the
  backend (e.g., `w: 8, h: 2` = 640px wide × 160px tall at base row height).
- **D-11:** On layout change (`onLayoutChange` callback), the component merges
  the new `{x, y, w, h}` values back onto each widget in local state and
  immediately fires `PUT /coach/dashboards/:clientId` — no explicit "Save"
  button for layout reordering (auto-save on drag/resize). This satisfies
  DASH-03 + DASH-04 without a separate save flow (save is implicit on drag end).

### Data Fetching (hooks)
- **D-12:** `useDashboardConfig(clientId)` — TanStack Query hook, `queryKey:
  ['dashboard', clientId]`, fetches `GET /coach/dashboards/:clientId`, returns
  `DashboardConfig` (schema_version + widgets array). JWT obtained via
  `@supabase/ssr` `createBrowserClient` — same pattern used in
  `ClientNotesPanel.tsx` (`credentials: 'include'` + `Authorization: Bearer
  <token>`).
- **D-13:** `useWidgetData(clientId, widgetType, period, dataKey)` — separate
  TanStack Query hook, `queryKey: ['widget-data', clientId, widgetType, period,
  dataKey]`. Fetches
  `GET /coach/clients/:clientId/widget-data?type=X&period=Y&dataKey=Z`. Each
  widget instance calls this hook independently so individual widgets can load
  concurrently without blocking each other.
- **D-14:** Token retrieval: use `createBrowserClient` from `@supabase/ssr`
  (already in `apps/web/package.json`) to call `supabase.auth.getSession()` and
  extract `session.access_token` inside each hook. Both hooks are client-side
  only (`'use client'`).

### Widget Component Architecture
- **D-15:** Each of the 7 widget types is a standalone React component in
  `apps/web/src/components/coach/dashboard/widgets/`. Naming convention:
  `LineChartWidget.tsx`, `BarChartWidget.tsx`, `KpiTileWidget.tsx`,
  `TableWidget.tsx`, `AthleteListWidget.tsx`, `ThresholdIndicatorWidget.tsx`,
  `CalloutWidget.tsx`.
- **D-16:** All widget components receive a single prop: `widget: Widget` (the
  discriminated union type from `backend/api/src/coach/dashboards/types.ts` —
  copied to `apps/web/src/types/dashboard.ts` as a frontend-local copy, not
  imported across workspace boundaries). Components call `useWidgetData`
  internally; the shell does not fetch data on their behalf.
- **D-17:** `WidgetCard` wrapper component (`widgets/WidgetCard.tsx`) provides
  the consistent chrome: white bg, `rounded-2xl border border-border` (matching
  the existing coach CRM card style), `p-5`, title in top-left as `text-sm
  font-bold text-text`, period badge in top-right as `text-xs text-muted`.
  Loading state uses `SkeletonBlock` from
  `@/components/coach/skeletons.tsx`. Error state shows `text-sm text-muted`
  centered with a brief message.

### Recharts Patterns (from ComparisonChart.tsx)
- Use `ResponsiveContainer width="100%" height={260}` for all chart widgets.
- `CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA"` (border token).
- `XAxis` / `YAxis` with `tick={{ fontSize: 12 }}`.
- Primary color for single-series charts: `#FF5C1A` (primary token).
- `dot={false}` + `connectNulls` for LineChart (same as ComparisonChart).

### KPI Tile (WIDGET-03)
- **D-18:** KPI Tile shows: large number formatted per `format` field (number /
  percent / duration), unit label below if present, title above. No trend
  indicator in Phase 02 (trend is Phase 03+ data). The widget-data endpoint
  returns `{ value: number }` for kpi_tile type; render that single value.

### ThresholdIndicator (WIDGET-06)
- **D-19:** Render as a horizontal progress bar: current value vs threshold.
  Color: green (`#22C55E`) when value >= threshold, orange (`#FF5C1A`) when
  value < threshold. Show `value / threshold unit` label below the bar. Widget
  data returns `{ value: number }`.

### Callout (WIDGET-07)
- **D-20:** Pure static render — reads `widget.config.message` and
  `widget.config.severity`. Severity maps to left-border color: info=`#3B82F6`,
  warning=`#FF5C1A`, success=`#22C55E`. No API call (`useWidgetData` not called
  for callout type). Renders inside `WidgetCard` chrome.

### AthleteList (WIDGET-05)
- **D-21:** Calls `useWidgetData` with `type=athlete_list`. The endpoint returns
  `{ rows: Array<{ id, name, last_activity_at }> }`. Render as a compact list
  of rows inside `WidgetCard`. No pagination in Phase 02.

### Dashboard Page Architecture
- **D-22:** `dashboard/page.tsx` is replaced entirely. It becomes a `'use
  client'` component that:
  1. Calls `useDashboardConfig(clientId)` to get the widget array.
  2. Passes widgets to `DashboardGrid` component (new, in
     `components/coach/dashboard/DashboardGrid.tsx`).
  3. Has an "Éditer" / "Terminer" toggle button in the top bar.
  4. In edit mode, `DashboardGrid` enables drag+resize and calls
     `PUT /coach/dashboards/:clientId` on `onLayoutChange`.
- **D-23:** `DashboardGrid` maps over widgets and renders
  `<WidgetRenderer widget={w} />` for each one. `WidgetRenderer` is a
  switch-dispatch component in
  `components/coach/dashboard/WidgetRenderer.tsx` that routes to the correct
  per-type component.
- **D-24:** `params.id` access in `dashboard/page.tsx` uses `use(params)` React
  hook — Next.js 15 App Router pattern (params is a Promise, same as other
  pages in this codebase). Examine the existing sessions/page.tsx pattern
  (`const { id: clientId } = await params;` in server components). Since the
  dashboard page must be `'use client'`, use `use(params)` from React.

### ClientTabStrip — Dashboard Tab
- **D-25:** `ClientTabStrip.tsx` already has `{ key: 'dashboard', label:
  'Dashboard' }` as the first TABS entry (confirmed by codebase read). The tab
  navigates to `/${locale}/coach/clients/${id}/dashboard` which already exists
  as a route. No change needed to `ClientTabStrip.tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Every executor MUST read these before implementing.**

### Phase 01 Types and API Contract
- `backend/api/src/coach/dashboards/types.ts` — Widget discriminated union,
  DashboardConfig, GridPos, all 7 config interfaces
- `backend/api/src/coach/dashboards/schemas.ts` — DEFAULT_WIDGETS (4 items),
  PeriodEnum values
- `backend/api/src/coach/dashboards/service.ts` — exact route signatures (GET,
  PUT, DELETE /:clientId, GET/PUT /memory)

### Existing Frontend Patterns
- `apps/web/src/components/coach/ComparisonChart.tsx` — canonical Recharts
  usage (ResponsiveContainer, CartesianGrid, color tokens, import pattern)
- `apps/web/src/components/coach/ClientNotesPanel.tsx` — canonical client-side
  fetch pattern (`credentials: 'include'`, `Authorization: Bearer`)
- `apps/web/src/components/coach/skeletons.tsx` — SkeletonBlock, SkeletonText,
  SkeletonRow components for loading states
- `apps/web/src/components/coach/QueryProvider.tsx` — TanStack Query client
  already wrapped around all tab content in layout.tsx
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx` —
  canonical tab page pattern (server component, getCachedCoachUser, Supabase
  JWT fetch)
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` —
  QueryProvider is already mounted here; client components in tab pages can use
  useQuery directly

### Current Dashboard Route (to replace)
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` —
  placeholder with sport selector; MUST be fully replaced in Plan 5
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/loading.tsx`
  — references DashboardLoadingState (not yet created — create it in Plan 1)

### Existing dashboard/ component stubs (to replace/complement)
- `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` — stub
  returning null; can be deleted or left in place (no longer imported after
  Plan 5)

</canonical_refs>

<code_context>
## Code Insights from Codebase Exploration

### Key Discovery: Dashboard Tab Already Exists
`ClientTabStrip.tsx` already declares `{ key: 'dashboard', label: 'Dashboard' }`
as the first entry in TABS. The route `/coach/clients/:id/dashboard` already
exists (page.tsx + loading.tsx). No tab navigation changes needed.

### Key Discovery: Dashboard/page.tsx is a Placeholder
The current `dashboard/page.tsx` has a sport-selector UI
(`DashboardControlBar`, `DashboardEmptyState`, `PowerliftingDashboard`) that
references components that don't exist yet. The entire file must be replaced.
`DashboardControlBar`, `DashboardEmptyState`, `DashboardLoadingState` are
referenced in existing files but not yet created — they are dead imports from
the placeholder. Plan 1 creates `DashboardLoadingState` (needed by
`loading.tsx`). Plans 3–5 create the real components.

### Key Discovery: react-grid-layout NOT installed
`apps/web/package.json` does not have `react-grid-layout`. Must be installed
in Plan 1 as `react-grid-layout@2.2.1`. Also need `@types/react-grid-layout`
for TypeScript.

### Key Discovery: recharts v3.8.1 Already Installed
No install needed. Import pattern from `ComparisonChart.tsx`:
```ts
import { LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
```

### Key Discovery: TanStack Query Already Available
`QueryProvider` is mounted in `layout.tsx` wrapping all tab children. Client
components in `dashboard/page.tsx` can call `useQuery` directly with no
additional provider setup.

### Key Discovery: API Fetch Pattern
All client-side API calls use:
- `credentials: 'include'`
- `Authorization: Bearer <token>` header
- `process.env.NEXT_PUBLIC_API_URL` as base URL (set to
  `https://ziko-api-lilac.vercel.app` in production)

JWT obtained via `createBrowserClient` from `@supabase/ssr` +
`supabase.auth.getSession()`.

### Key Discovery: params in Client Pages
Next.js 15 passes `params` as a `Promise` in all page components. For server
components: `const { id } = await params`. For client components (dashboard):
`const { id } = use(params)` — import `use` from `'react'`.

### Design Token Quick Reference
```
Background: #F7F6F3   (bg-background)
Surface:    #FFFFFF   (bg-white)
Border:     #E2E0DA   (border-border)
Primary:    #FF5C1A   (text-primary / bg-primary)
Text:       #1C1A17   (text-text)
Muted:      #6B6963   (text-muted)
```
Card pattern: `bg-white rounded-2xl border border-border p-5`

### Widget Data API Contract
Endpoint: `GET /coach/clients/:clientId/widget-data?type=X&period=Y&dataKey=Z`

Response shapes by widget type:
- `kpi_tile`: `{ value: number }`
- `line_chart`: `{ data: Array<{ date: string; value: number }> }`
- `bar_chart`: `{ data: Array<{ date: string; value: number }> }`
- `table`: `{ rows: Array<Record<string, unknown>> }`
- `athlete_list`: `{ rows: Array<{ id: string; name: string; last_activity_at: string | null }> }`
- `threshold_indicator`: `{ value: number }`
- `callout`: no API call needed (static config)

### Dashboard Config API Contract
- `GET /coach/dashboards/:clientId` → `{ schema_version: 1, widgets: Widget[] }` (4 defaults if no DB row)
- `PUT /coach/dashboards/:clientId` with `{ widgets: Widget[] }` → persisted config

</code_context>

<deferred>
## Deferred (Phase 03+)

- AI edit session (EDIT-01 through EDIT-05) — Phase 03
- Coach memory templates (MEM-01, MEM-02) — Phase 04
- Trend indicator on KPI Tile — Phase 03
- Widget add/remove/type-change UI — Phase 03 (AI controls this)
- Explicit "Sauvegarder" button — Phase 03 (auto-save on drag is sufficient for Phase 02)

</deferred>

---

*Phase: 02-widget-renderers*
*Context gathered: 2026-05-26*
