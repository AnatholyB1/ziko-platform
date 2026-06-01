---
phase: 02-widget-renderers
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/src/types/dashboard.ts
  - apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx
  - apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx
autonomous: true
requirements:
  - DASH-01
  - DASH-03
  - WIDGET-01
  - WIDGET-02
  - WIDGET-03
  - WIDGET-04
  - WIDGET-05
  - WIDGET-06
  - WIDGET-07
must_haves:
  truths:
    - "react-grid-layout@2.2.1 is installed in apps/web/ with its TypeScript types"
    - "Frontend Widget types are available as a local TypeScript module (no cross-workspace imports)"
    - "WidgetCard renders a titled card with loading skeleton and error state"
    - "DashboardLoadingState renders 4 skeleton cards (fixes the dead import in loading.tsx)"
  artifacts:
    - path: "apps/web/src/types/dashboard.ts"
      provides: "Widget discriminated union + all sub-types, DashboardConfig, GridPos — frontend copy"
      exports: ["Widget", "DashboardConfig", "GridPos", "WidgetType", "WidgetPeriod", "LineChartWidget", "BarChartWidget", "KpiTileWidget", "TableWidget", "AthleteListWidget", "ThresholdIndicatorWidget", "CalloutWidget"]
    - path: "apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx"
      provides: "Card chrome wrapper with title, period badge, loading, error states"
    - path: "apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx"
      provides: "4-skeleton loading placeholder used by dashboard/loading.tsx"
  key_links:
    - from: "apps/web/src/types/dashboard.ts"
      to: "backend/api/src/coach/dashboards/types.ts"
      via: "manual copy — types must stay in sync"
      pattern: "WidgetType|DashboardConfig|GridPos"
---

<objective>
Install react-grid-layout, create the frontend type definitions, build the WidgetCard chrome wrapper, and create DashboardLoadingState.

Purpose: Establishes the shared types and base component that all 7 widget renderers (Plans 3–4) and the DashboardGrid (Plan 5) depend on. Also unblocks the dead import in `dashboard/loading.tsx` which references `DashboardLoadingState` that does not exist yet.

Output: npm install complete, `apps/web/src/types/dashboard.ts`, `WidgetCard.tsx`, `DashboardLoadingState.tsx`
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/ziko-platform/.planning/workstreams/custom-widget/phases/02-widget-renderers/02-CONTEXT.md
@C:/ziko-platform/backend/api/src/coach/dashboards/types.ts
@C:/ziko-platform/apps/web/src/components/coach/skeletons.tsx
@C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/loading.tsx

<interfaces>
<!-- Types to copy verbatim into apps/web/src/types/dashboard.ts (frontend-local copy) -->
<!-- Source: backend/api/src/coach/dashboards/types.ts -->

```typescript
export type WidgetType =
  | 'line_chart' | 'bar_chart' | 'kpi_tile' | 'table'
  | 'athlete_list' | 'threshold_indicator' | 'callout'

export type WidgetPeriod = '7d' | '30d' | '90d' | 'all'

export interface GridPos { x: number; y: number; w: number; h: number }

export interface WidgetBase {
  id: string; type: WidgetType; title: string; period: WidgetPeriod; gridPos: GridPos
}
// (all 7 config interfaces + discriminated union Widget type)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install react-grid-layout</name>
  <files>apps/web/package.json</files>
  <action>
    From the `apps/web/` directory, run:
    `npm install react-grid-layout@2.2.1`
    `npm install --save-dev @types/react-grid-layout`

    Confirm `package.json` now lists `"react-grid-layout": "2.2.1"` in dependencies
    and `"@types/react-grid-layout"` in devDependencies.

    Do NOT run a full npm install for the entire monorepo — scope to `apps/web/` only.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && grep -c "react-grid-layout" package.json</automated>
  </verify>
  <done>package.json contains react-grid-layout@2.2.1 and @types/react-grid-layout</done>
</task>

<task type="auto">
  <name>Task 2: Create frontend Widget types</name>
  <files>apps/web/src/types/dashboard.ts</files>
  <action>
    Create `apps/web/src/types/dashboard.ts` as a frontend-local copy of the Widget
    type definitions. Do NOT import from the backend workspace — this is an intentional
    copy to avoid cross-workspace coupling.

    The file must export:
    - `WidgetType` (union of 7 string literals)
    - `WidgetPeriod` ('7d' | '30d' | '90d' | 'all')
    - `GridPos` interface
    - `WidgetBase` interface
    - Per-type config interfaces: `LineChartConfig`, `BarChartConfig`, `KpiTileConfig`,
      `TableConfig`, `AthleteListConfig`, `ThresholdIndicatorConfig`, `CalloutConfig`
    - Per-type widget interfaces (extending WidgetBase with typed `config` field):
      `LineChartWidget`, `BarChartWidget`, `KpiTileWidget`, `TableWidget`,
      `AthleteListWidget`, `ThresholdIndicatorWidget`, `CalloutWidget`
    - `Widget` discriminated union type
    - `DashboardConfig` interface: `{ schema_version: 1; widgets: Widget[] }`

    Copy these exactly from `backend/api/src/coach/dashboards/types.ts` — keep
    field names and types identical. This is a type contract, not creative work.
    Add the comment: `// Frontend-local copy of backend/api/src/coach/dashboards/types.ts`
    at the top. No runtime code, no imports.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit --strict src/types/dashboard.ts 2>&1 | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <done>
    `apps/web/src/types/dashboard.ts` exports Widget, DashboardConfig, GridPos, and
    all 7 widget sub-types. TypeScript strict check passes with 0 errors.
  </done>
</task>

<task type="auto">
  <name>Task 3: WidgetCard chrome + DashboardLoadingState</name>
  <files>
    apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx
    apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx
  </files>
  <action>
    Create `apps/web/src/components/coach/dashboard/widgets/` directory (mkdir).

    **WidgetCard.tsx** (`'use client'` — receives reactive props):
    Props interface:
    ```
    interface WidgetCardProps {
      title: string
      period?: string        // e.g. "30d" — shown as badge top-right
      isLoading?: boolean
      error?: string | null
      children: React.ReactNode
    }
    ```
    Render structure:
    - Outer: `<div className="bg-white rounded-2xl border border-border p-5 h-full flex flex-col">`
    - Header row: `<div className="flex items-center justify-between mb-3">`
      - Title: `<span className="text-sm font-bold text-text">{title}</span>`
      - Period badge (if period): `<span className="text-xs text-muted bg-[#F7F6F3] px-2 py-0.5 rounded-full">{period}</span>`
    - Content area: `<div className="flex-1 min-h-0">`
      - If isLoading: render `<SkeletonBlock className="w-full h-full" />` (import from `@/components/coach/skeletons`)
      - If error: render `<p className="text-sm text-muted text-center pt-8">{error}</p>`
      - Otherwise: render `{children}`

    **DashboardLoadingState.tsx** (Server Component — no `'use client'`):
    Renders 4 `WidgetCard` shells in a 2×2 CSS grid with `isLoading={true}` and
    placeholder titles. Use `min-h-[200px]` on each card to give skeletons visible height.
    Grid: `<div className="grid grid-cols-2 gap-4">` with 4 cards.
    Import `WidgetCard` with the relative path.
    This fixes the dead import in `dashboard/loading.tsx`.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    WidgetCard accepts title/period/isLoading/error/children and renders correct chrome.
    DashboardLoadingState renders 4 skeleton cards in a 2-column grid.
    TypeScript compile passes.
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. `apps/web/package.json` has `react-grid-layout@2.2.1` in dependencies.
2. `apps/web/src/types/dashboard.ts` exports Widget discriminated union with all 7 variants.
3. `WidgetCard` component exists and accepts the correct props.
4. `DashboardLoadingState` exists and resolves the dead import in `loading.tsx`.
5. `npx tsc --noEmit` from `apps/web/` passes.
</verification>

<success_criteria>
- react-grid-layout installed: `grep "react-grid-layout" apps/web/package.json` returns a match
- Types defined: `grep "ThresholdIndicatorWidget\|AthleteListWidget" apps/web/src/types/dashboard.ts` returns matches
- WidgetCard exists: file at `apps/web/src/components/coach/dashboard/widgets/WidgetCard.tsx`
- DashboardLoadingState exists: file at `apps/web/src/components/coach/dashboard/DashboardLoadingState.tsx`
- No TypeScript errors: `npx tsc --noEmit` from `apps/web/` exits 0
</success_criteria>

<output>Create `.planning/workstreams/custom-widget/phases/02-widget-renderers/02-01-SUMMARY.md` when done.</output>
