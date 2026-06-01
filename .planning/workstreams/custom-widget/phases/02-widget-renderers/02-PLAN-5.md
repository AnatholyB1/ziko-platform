---
phase: 02-widget-renderers
plan: 5
type: execute
wave: 3
depends_on: ["02-03", "02-04"]
files_modified:
  - apps/web/src/components/coach/dashboard/WidgetRenderer.tsx
  - apps/web/src/components/coach/dashboard/DashboardGrid.tsx
  - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx
autonomous: true
requirements:
  - DASH-01
  - DASH-02
  - DASH-03
  - DASH-04
must_haves:
  truths:
    - "Dashboard tab loads and shows 4 default widgets on first visit for any coach+client pair"
    - "All 7 widget types can be rendered without errors when present in the config"
    - "Coach can toggle edit mode with an Éditer / Terminer button in the dashboard header"
    - "In edit mode, widgets are draggable and resizable via react-grid-layout"
    - "After dragging/resizing, the new layout is auto-saved via PUT /coach/dashboards/:clientId"
    - "On page reload, the same widget positions are restored (persisted config)"
  artifacts:
    - path: "apps/web/src/components/coach/dashboard/WidgetRenderer.tsx"
      provides: "Switch dispatch from Widget.type to the correct renderer component"
    - path: "apps/web/src/components/coach/dashboard/DashboardGrid.tsx"
      provides: "react-grid-layout grid with edit mode toggle and layout save"
    - path: "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx"
      provides: "Dashboard page — replaces placeholder, wires useDashboardConfig + DashboardGrid"
  key_links:
    - from: "dashboard/page.tsx"
      to: "useDashboardConfig"
      via: "hook call with clientId from params"
      pattern: "useDashboardConfig"
    - from: "DashboardGrid.tsx"
      to: "PUT /coach/dashboards/:clientId"
      via: "fetch on onLayoutChange"
      pattern: "coach/dashboards"
    - from: "WidgetRenderer.tsx"
      to: "all 7 widget components"
      via: "switch on widget.type"
      pattern: "widget.type"
---

<objective>
Build WidgetRenderer (dispatch), DashboardGrid (react-grid-layout with edit mode), and replace the placeholder dashboard/page.tsx with the fully wired dashboard.

Purpose: This is the capstone plan — it connects all previous plans into a working dashboard. After this plan, the Dashboard tab shows real data, supports drag-to-reorder, and persists layouts.

Output: Three files wiring together everything built in Plans 1–4 into the live Dashboard tab.
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/ziko-platform/.planning/workstreams/custom-widget/phases/02-widget-renderers/02-CONTEXT.md
@C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx
@C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx
@C:/ziko-platform/apps/web/src/components/coach/ClientNotesPanel.tsx

<interfaces>
<!-- All widget component props (from Plans 3–4) -->
```typescript
// All chart/data widgets: { widget: XxxWidget; clientId: string }
LineChartWidget:        { widget: LineChartWidget; clientId: string }
BarChartWidget:         { widget: BarChartWidget; clientId: string }
KpiTileWidget:          { widget: KpiTileWidget; clientId: string }
TableWidget:            { widget: TableWidget; clientId: string }
AthleteListWidget:      { widget: AthleteListWidget; clientId: string }
ThresholdIndicatorWidget: { widget: ThresholdIndicatorWidget; clientId: string }
CalloutWidget:          { widget: CalloutWidget }  // no clientId — static
```

<!-- useDashboardConfig from Plan 2 -->
```typescript
function useDashboardConfig(clientId: string): UseQueryResult<DashboardConfig>
// DashboardConfig: { schema_version: 1; widgets: Widget[] }
```

<!-- react-grid-layout API (react-grid-layout@2.2.1) -->
```typescript
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-size-me/lib/styles.css'

// Layout item: { i: string; x: number; y: number; w: number; h: number }
// Props: cols, rowHeight, width, isDraggable, isResizable, onLayoutChange
// onLayoutChange: (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void
```

<!-- Next.js 15 client component params pattern -->
```typescript
// In a 'use client' component with params prop typed as Promise:
import { use } from 'react'
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // ...
}
```

<!-- PUT dashboard API -->
// PUT /coach/dashboards/:clientId
// Body: { widgets: Widget[] }
// Headers: Authorization: Bearer <jwt>, Content-Type: application/json
// Response: { schema_version: 1, widgets: Widget[] }
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: WidgetRenderer dispatch component</name>
  <files>apps/web/src/components/coach/dashboard/WidgetRenderer.tsx</files>
  <action>
    Create `'use client'` component. This is the type-safe dispatch layer.

    Prop interface:
    ```
    interface Props { widget: Widget; clientId: string }
    ```
    Import `Widget` from `@/types/dashboard`.
    Import all 7 widget components from `./widgets/`.

    Implement a switch on `widget.type`:
    ```
    switch (widget.type) {
      case 'line_chart': return <LineChartWidget widget={widget} clientId={clientId} />
      case 'bar_chart':  return <BarChartWidget widget={widget} clientId={clientId} />
      case 'kpi_tile':   return <KpiTileWidget widget={widget} clientId={clientId} />
      case 'table':      return <TableWidget widget={widget} clientId={clientId} />
      case 'athlete_list': return <AthleteListWidget widget={widget} clientId={clientId} />
      case 'threshold_indicator': return <ThresholdIndicatorWidget widget={widget} clientId={clientId} />
      case 'callout':    return <CalloutWidget widget={widget} />
      default:
        // Exhaustive check — TypeScript should flag unhandled types
        return <div className="text-xs text-muted p-4">Widget inconnu</div>
    }
    ```

    TypeScript narrowing: because `Widget` is a discriminated union and each case
    narrows to the exact widget subtype, pass `widget` directly to the typed prop
    without casting. TypeScript will verify correctness.

    Export as named export: `export function WidgetRenderer({ widget, clientId }: Props)`.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/WidgetRenderer.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    WidgetRenderer dispatches all 7 widget types. No TypeScript errors.
    Default case handles unknown types without crashing.
  </done>
</task>

<task type="auto">
  <name>Task 2: DashboardGrid with react-grid-layout and edit mode</name>
  <files>apps/web/src/components/coach/dashboard/DashboardGrid.tsx</files>
  <action>
    Create `'use client'` component.

    Prop interface:
    ```
    interface Props {
      widgets: Widget[]
      clientId: string
      isEditMode: boolean
      onLayoutSaved?: (widgets: Widget[]) => void
    }
    ```

    Implementation:

    1. **CSS imports** (at the very top of the file, before other imports):
       ```
       import 'react-grid-layout/css/styles.css'
       ```
       Note: `react-size-me/lib/styles.css` may not exist in v2.2.1 — skip it.
       Only import the one CSS file that exists.

    2. Import `GridLayout` as default import from `'react-grid-layout'`.

    3. **Local state:** `const [localWidgets, setLocalWidgets] = useState(widgets)`.
       Update when `widgets` prop changes: `useEffect(() => setLocalWidgets(widgets), [widgets])`.

    4. **Build layout array** for GridLayout from widgets:
       ```
       const layout = localWidgets.map(w => ({
         i: w.id,
         x: w.gridPos.x,
         y: w.gridPos.y,
         w: w.gridPos.w,
         h: w.gridPos.h,
       }))
       ```

    5. **onLayoutChange handler:**
       ```
       const handleLayoutChange = async (newLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
         // Merge new positions back into widget objects
         const updated = localWidgets.map(w => {
           const pos = newLayout.find(l => l.i === w.id)
           if (!pos) return w
           return { ...w, gridPos: { x: pos.x, y: pos.y, w: pos.w, h: pos.h } }
         })
         setLocalWidgets(updated)

         // Auto-save via PUT
         try {
           const supabase = createBrowserClient(
             process.env.NEXT_PUBLIC_SUPABASE_URL!,
             process.env.NEXT_PUBLIC_SUPABASE_KEY!,
           )
           const { data: { session } } = await supabase.auth.getSession()
           const jwt = session?.access_token ?? ''
           await fetch(`${process.env.NEXT_PUBLIC_API_URL}/coach/dashboards/${clientId}`, {
             method: 'PUT',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${jwt}`,
             },
             credentials: 'include',
             body: JSON.stringify({ widgets: updated }),
           })
           onLayoutSaved?.(updated)
         } catch (err) {
           console.error('[DashboardGrid] layout save failed:', err)
         }
       }
       ```

    6. **Render:**
       ```
       <GridLayout
         className="layout"
         layout={layout}
         cols={12}
         rowHeight={80}
         width={1200}
         isDraggable={isEditMode}
         isResizable={isEditMode}
         onLayoutChange={isEditMode ? handleLayoutChange : undefined}
         margin={[16, 16]}
         containerPadding={[0, 0]}
       >
         {localWidgets.map(w => (
           <div key={w.id}>
             <WidgetRenderer widget={w} clientId={clientId} />
           </div>
         ))}
       </GridLayout>
       ```

    Import `createBrowserClient` from `@supabase/ssr`.
    Import `WidgetRenderer` from `./WidgetRenderer`.
    Import `Widget` from `@/types/dashboard`.

    Note on `width={1200}`: react-grid-layout@2.2.1 requires a static width or
    the `WidthProvider` HOC. Use static `width={1200}` for simplicity in Phase 02.
    Phase 03 can upgrade to WidthProvider if needed.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/DashboardGrid.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    DashboardGrid renders GridLayout with correct layout array. isDraggable/isResizable
    wired to isEditMode. onLayoutChange merges positions and fires PUT. TypeScript passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Replace dashboard/page.tsx with the real dashboard</name>
  <files>apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx</files>
  <action>
    **Completely replace** the existing placeholder `dashboard/page.tsx`.
    The current file imports `DashboardControlBar`, `DashboardEmptyState`,
    `PowerliftingDashboard` — none of which are needed. Replace the entire file.

    New implementation (`'use client'`):

    ```
    'use client'

    import { use, useState } from 'react'
    import { useDashboardConfig } from '@/hooks/useDashboardConfig'
    import { DashboardGrid } from '@/components/coach/dashboard/DashboardGrid'
    import { DashboardLoadingState } from '@/components/coach/dashboard/DashboardLoadingState'

    export default function DashboardPage({
      params,
    }: {
      params: Promise<{ id: string }>
    }) {
      const { id: clientId } = use(params)
      const [isEditMode, setIsEditMode] = useState(false)
      const { data: config, isLoading, error } = useDashboardConfig(clientId)

      if (isLoading) return <DashboardLoadingState />

      if (error || !config) {
        return (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted">
              Impossible de charger le tableau de bord. Réessayez.
            </p>
          </div>
        )
      }

      return (
        <div>
          {/* Edit mode toggle bar */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text">
              Tableau de bord ({config.widgets.length} widgets)
            </h2>
            <button
              onClick={() => setIsEditMode(prev => !prev)}
              className={`px-4 py-2 rounded-lg text-sm font-normal transition-colors ${
                isEditMode
                  ? 'bg-primary text-white'
                  : 'bg-white border border-border text-text hover:bg-[#F7F6F3]'
              }`}
            >
              {isEditMode ? 'Terminer' : 'Éditer'}
            </button>
          </div>

          {isEditMode && (
            <p className="text-xs text-muted mb-3">
              Faites glisser les widgets pour réorganiser la mise en page.
              Les modifications sont enregistrées automatiquement.
            </p>
          )}

          <DashboardGrid
            widgets={config.widgets}
            clientId={clientId}
            isEditMode={isEditMode}
          />
        </div>
      )
    }
    ```

    Key notes:
    - Use `use(params)` (React hook) not `await params` — this is a client component.
    - `useDashboardConfig` provides the 4 default widgets on first visit (server returns
      DEFAULT_WIDGETS when no DB row exists — per D-03/D-04 from Phase 01 CONTEXT.md).
    - No need to import `DashboardControlBar`, `DashboardEmptyState`, or
      `PowerliftingDashboard` — they were placeholder components from the old page.
    - The `loading.tsx` in the same directory already references `DashboardLoadingState`
      which was created in Plan 1 — the import is now valid.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/app/[locale]/\(coach\)/coach/clients/[id]/dashboard/page.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    dashboard/page.tsx is fully replaced. Imports useDashboardConfig, DashboardGrid,
    DashboardLoadingState. Uses use(params) for clientId. Edit mode toggles drag/resize.
    TypeScript passes. No references to old placeholder components remain.
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. `WidgetRenderer.tsx` switches on all 7 widget types with proper TypeScript narrowing.
2. `DashboardGrid.tsx` renders GridLayout with isDraggable/isResizable bound to `isEditMode` prop.
3. `DashboardGrid.tsx` calls `PUT /coach/dashboards/:clientId` on layout change.
4. `dashboard/page.tsx` no longer references `DashboardControlBar`, `DashboardEmptyState`,
   or `PowerliftingDashboard`.
5. `dashboard/page.tsx` uses `use(params)` to extract clientId.
6. `npx tsc --noEmit` from `apps/web/` passes with 0 errors.
7. `grep -r "DashboardControlBar" apps/web/src` returns NO results (old placeholder cleaned up).
</verification>

<success_criteria>
- All 3 new files exist: WidgetRenderer.tsx, DashboardGrid.tsx, and updated dashboard/page.tsx
- No dead imports: `grep -r "DashboardControlBar\|DashboardEmptyState\|PowerliftingDashboard" apps/web/src/app` returns no results
- GridLayout used: `grep "GridLayout\|react-grid-layout" apps/web/src/components/coach/dashboard/DashboardGrid.tsx` returns matches
- PUT wired: `grep "PUT\|method.*PUT" apps/web/src/components/coach/dashboard/DashboardGrid.tsx` returns match
- No TS errors: `npx tsc --noEmit` from `apps/web/` exits 0
</success_criteria>

<output>Create `.planning/workstreams/custom-widget/phases/02-widget-renderers/02-05-SUMMARY.md` when done.</output>
