---
phase: 02-widget-renderers
plan: 3
type: execute
wave: 2
depends_on: ["02-01", "02-02"]
files_modified:
  - apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx
  - apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx
  - apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx
autonomous: true
requirements:
  - WIDGET-01
  - WIDGET-02
  - WIDGET-03
must_haves:
  truths:
    - "LineChartWidget renders a Recharts LineChart with real data from useWidgetData"
    - "BarChartWidget renders a Recharts BarChart with real data from useWidgetData"
    - "KpiTileWidget renders a large formatted number (number/percent/duration) with unit"
    - "All three widgets show loading skeleton while data is fetching"
    - "All three widgets show an error message if useWidgetData returns error"
  artifacts:
    - path: "apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx"
      provides: "Line chart renderer for time-series data"
    - path: "apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx"
      provides: "Bar chart renderer for aggregated period data"
    - path: "apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx"
      provides: "Single-metric KPI tile with format support"
  key_links:
    - from: "LineChartWidget.tsx"
      to: "useWidgetData"
      via: "hook call with widget.config.dataKey"
      pattern: "useWidgetData"
    - from: "BarChartWidget.tsx"
      to: "useWidgetData"
      via: "hook call with widget.config.dataKey"
      pattern: "useWidgetData"
    - from: "KpiTileWidget.tsx"
      to: "useWidgetData"
      via: "hook call with widget.config.dataKey"
      pattern: "useWidgetData"
---

<objective>
Build the three chart/metric widget renderers: LineChartWidget, BarChartWidget, and KpiTileWidget.

Purpose: These three widgets cover the DEFAULT_WIDGETS defaults (2 KPI tiles + 1 line chart + 1 bar chart). Completing them means the dashboard is immediately useful with default config on first load.

Output: Three widget components in `apps/web/src/components/coach/dashboard/widgets/`
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/ziko-platform/.planning/workstreams/custom-widget/phases/02-widget-renderers/02-CONTEXT.md
@C:/ziko-platform/apps/web/src/components/coach/ComparisonChart.tsx
@C:/ziko-platform/apps/web/src/components/coach/skeletons.tsx

<interfaces>
<!-- Widget types from apps/web/src/types/dashboard.ts (created in Plan 1) -->
```typescript
// LineChartWidget
interface LineChartWidget extends WidgetBase {
  type: 'line_chart'
  config: { dataKey: string; color?: string; unit?: string }
}

// BarChartWidget
interface BarChartWidget extends WidgetBase {
  type: 'bar_chart'
  config: { dataKey: string; color?: string; unit?: string }
}

// KpiTileWidget
interface KpiTileWidget extends WidgetBase {
  type: 'kpi_tile'
  config: { dataKey: string; unit?: string; format: 'number' | 'percent' | 'duration' }
}
```

<!-- Hooks from Plan 2 -->
```typescript
// useDashboardConfig — not needed here
// useWidgetData:
function useWidgetData(
  clientId: string,
  type: string,
  period: string,
  dataKey: string,
): UseQueryResult<unknown>
```

<!-- Recharts pattern from ComparisonChart.tsx -->
import { LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Design tokens:
Primary: #FF5C1A
Border: #E2E0DA
Text: #1C1A17
Muted: #6B6963
Background: #F7F6F3
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: LineChartWidget</name>
  <files>apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx</files>
  <action>
    Create `'use client'` component. Single prop: `widget: LineChartWidget` (imported from
    `@/types/dashboard`). Also receives `clientId: string` as a second prop (needed for the
    hook call — the dashboard grid passes it down).

    Prop interface:
    ```
    interface Props { widget: LineChartWidget; clientId: string }
    ```

    Implementation:
    1. Call `useWidgetData(clientId, 'line_chart', widget.period, widget.config.dataKey)`.
    2. Wrap everything in `<WidgetCard title={widget.title} period={widget.period}
       isLoading={isLoading} error={error?.message ?? null}>`.
    3. When data is loaded, cast: `const chartData = (data as { data: Array<{ date: string;
       value: number }> }).data ?? []`.
    4. If `chartData.length === 0`, render `<p className="text-sm text-muted text-center pt-8">
       Aucune donnée disponible.</p>`.
    5. Otherwise render:
       ```
       <ResponsiveContainer width="100%" height={220}>
         <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
           <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
           <XAxis dataKey="date" tick={{ fontSize: 11 }} />
           <YAxis tick={{ fontSize: 11 }}
             tickFormatter={(v) => widget.config.unit ? `${v}${widget.config.unit}` : String(v)} />
           <Tooltip
             formatter={(v) => [widget.config.unit ? `${v} ${widget.config.unit}` : v, widget.title]} />
           <Line type="monotone" dataKey="value"
             stroke={widget.config.color ?? '#FF5C1A'} dot={false} connectNulls />
         </LineChart>
       </ResponsiveContainer>
       ```
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/widgets/LineChartWidget.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    LineChartWidget renders ResponsiveContainer wrapping LineChart with real widget data.
    Uses WidgetCard for chrome. Handles empty data gracefully. TypeScript passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: BarChartWidget</name>
  <files>apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx</files>
  <action>
    Create `'use client'` component with same pattern as LineChartWidget.

    Prop interface:
    ```
    interface Props { widget: BarChartWidget; clientId: string }
    ```

    Implementation:
    1. Call `useWidgetData(clientId, 'bar_chart', widget.period, widget.config.dataKey)`.
    2. Wrap in `<WidgetCard title={widget.title} period={widget.period}
       isLoading={isLoading} error={error?.message ?? null}>`.
    3. Cast: `const chartData = (data as { data: Array<{ date: string; value: number }> }).data ?? []`.
    4. Empty state same as LineChartWidget.
    5. Render:
       ```
       <ResponsiveContainer width="100%" height={220}>
         <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
           <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
           <XAxis dataKey="date" tick={{ fontSize: 11 }} />
           <YAxis tick={{ fontSize: 11 }}
             tickFormatter={(v) => widget.config.unit ? `${v}${widget.config.unit}` : String(v)} />
           <Tooltip
             formatter={(v) => [widget.config.unit ? `${v} ${widget.config.unit}` : v, widget.title]} />
           <Bar dataKey="value" fill={widget.config.color ?? '#FF5C1A'} radius={[3, 3, 0, 0]} />
         </BarChart>
       </ResponsiveContainer>
       ```
       Note: `radius={[3, 3, 0, 0]}` gives bars rounded top corners per the coach CRM design style.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/widgets/BarChartWidget.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    BarChartWidget renders BarChart with rounded-top bars, WidgetCard chrome, empty state.
    TypeScript passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: KpiTileWidget</name>
  <files>apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx</files>
  <action>
    Create `'use client'` component.

    Prop interface:
    ```
    interface Props { widget: KpiTileWidget; clientId: string }
    ```

    Implementation:
    1. Call `useWidgetData(clientId, 'kpi_tile', widget.period, widget.config.dataKey)`.
    2. Wrap in `<WidgetCard title={widget.title} period={widget.period}
       isLoading={isLoading} error={error?.message ?? null}>`.
    3. Cast: `const raw = (data as { value: number } | null)?.value ?? null`.
    4. Format the value based on `widget.config.format`:
       - `'number'`: `raw != null ? String(Math.round(raw)) : '—'`
       - `'percent'`: `raw != null ? `${Math.round(raw)}%` : '—'`
       - `'duration'`: `raw != null ? formatDuration(raw) : '—'` where
         `formatDuration(minutes: number)` returns `${Math.floor(minutes/60)}h${minutes%60}m`
         (or just `${minutes}min` if < 60)
    5. Render inside the card content area:
       ```
       <div className="flex flex-col items-center justify-center h-full gap-1">
         <span className="text-4xl font-bold text-text">{formattedValue}</span>
         {widget.config.unit && (
           <span className="text-sm text-muted">{widget.config.unit}</span>
         )}
       </div>
       ```
    6. Define `formatDuration` as a local helper function at the top of the file
       (not exported).
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/widgets/KpiTileWidget.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    KpiTileWidget shows large formatted number per format field. Handles null data with —.
    Duration format works for values >= 60 and < 60. TypeScript passes.
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. All 3 widget files exist in `apps/web/src/components/coach/dashboard/widgets/`.
2. Each calls `useWidgetData` with the correct type string.
3. Each wraps content in `WidgetCard`.
4. `npx tsc --noEmit` from `apps/web/` passes.
</verification>

<success_criteria>
- Files exist: `ls apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx`
- Recharts imports: `grep -l "ResponsiveContainer" apps/web/src/components/coach/dashboard/widgets/LineChartWidget.tsx apps/web/src/components/coach/dashboard/widgets/BarChartWidget.tsx`
- KPI format: `grep "percent\|duration\|number" apps/web/src/components/coach/dashboard/widgets/KpiTileWidget.tsx` returns matches
- No TS errors: `npx tsc --noEmit` from `apps/web/` exits 0
</success_criteria>

<output>Create `.planning/workstreams/custom-widget/phases/02-widget-renderers/02-03-SUMMARY.md` when done.</output>
