---
phase: 02-widget-renderers
plan: 4
type: execute
wave: 2
depends_on: ["02-01", "02-02"]
files_modified:
  - apps/web/src/components/coach/dashboard/widgets/TableWidget.tsx
  - apps/web/src/components/coach/dashboard/widgets/AthleteListWidget.tsx
  - apps/web/src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx
  - apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx
autonomous: true
requirements:
  - WIDGET-04
  - WIDGET-05
  - WIDGET-06
  - WIDGET-07
must_haves:
  truths:
    - "TableWidget renders tabular rows with configurable columns from useWidgetData"
    - "AthleteListWidget renders a compact list of athletes with last activity date"
    - "ThresholdIndicatorWidget renders a color-coded progress bar (green above threshold, orange below)"
    - "CalloutWidget renders a severity-colored callout card with static message — no API call"
    - "All 4 widgets show loading skeleton and error states via WidgetCard"
  artifacts:
    - path: "apps/web/src/components/coach/dashboard/widgets/TableWidget.tsx"
      provides: "Table renderer with dynamic column definitions"
    - path: "apps/web/src/components/coach/dashboard/widgets/AthleteListWidget.tsx"
      provides: "Athlete list with last activity date display"
    - path: "apps/web/src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx"
      provides: "Horizontal progress bar with threshold comparison"
    - path: "apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx"
      provides: "Static severity-colored callout message"
  key_links:
    - from: "TableWidget.tsx"
      to: "useWidgetData"
      via: "type='table' call"
      pattern: "useWidgetData.*table"
    - from: "AthleteListWidget.tsx"
      to: "useWidgetData"
      via: "type='athlete_list' call"
      pattern: "useWidgetData.*athlete_list"
    - from: "ThresholdIndicatorWidget.tsx"
      to: "useWidgetData"
      via: "type='threshold_indicator' call"
      pattern: "useWidgetData.*threshold_indicator"
---

<objective>
Build the remaining 4 widget renderers: TableWidget, AthleteListWidget, ThresholdIndicatorWidget, and CalloutWidget.

Purpose: Completes the full set of 7 widget types. After Plans 3 and 4 are both done, WidgetRenderer (Plan 5) can dispatch to all 7 types without any missing component.

Output: Four widget components in `apps/web/src/components/coach/dashboard/widgets/`
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/ziko-platform/.planning/workstreams/custom-widget/phases/02-widget-renderers/02-CONTEXT.md
@C:/ziko-platform/apps/web/src/components/coach/skeletons.tsx

<interfaces>
<!-- Widget types from apps/web/src/types/dashboard.ts (Plan 1) -->
```typescript
interface TableWidget extends WidgetBase {
  type: 'table'
  config: { columns: Array<{ key: string; label: string }> }
}
interface AthleteListWidget extends WidgetBase {
  type: 'athlete_list'
  config: { filter: 'all' | 'active' | 'at_risk' }
}
interface ThresholdIndicatorWidget extends WidgetBase {
  type: 'threshold_indicator'
  config: { dataKey: string; threshold: number; unit?: string }
}
interface CalloutWidget extends WidgetBase {
  type: 'callout'
  config: { message: string; severity: 'info' | 'warning' | 'success' }
}
```

<!-- API response shapes -->
table:          { rows: Array<Record<string, unknown>> }
athlete_list:   { rows: Array<{ id: string; name: string; last_activity_at: string | null }> }
threshold_indicator: { value: number }
callout:        no API call (static)

<!-- WidgetCard from Plan 1 -->
import { WidgetCard } from './WidgetCard'
// Props: title, period?, isLoading?, error?, children

<!-- Design tokens -->
Primary:  #FF5C1A  (orange — below threshold)
Success:  #22C55E  (green — at/above threshold)
Info:     #3B82F6  (blue)
Border:   #E2E0DA
Text:     #1C1A17
Muted:    #6B6963
Background: #F7F6F3
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: TableWidget</name>
  <files>apps/web/src/components/coach/dashboard/widgets/TableWidget.tsx</files>
  <action>
    Create `'use client'` component.

    Prop interface:
    ```
    interface Props { widget: TableWidget; clientId: string }
    ```

    Implementation:
    1. Call `useWidgetData(clientId, 'table', widget.period, 'rows')`.
       (dataKey is 'rows' — the endpoint returns `{ rows: [...] }` for table type)
    2. Wrap in `<WidgetCard title={widget.title} period={widget.period}
       isLoading={isLoading} error={error?.message ?? null}>`.
    3. Cast: `const rows = (data as { rows: Array<Record<string, unknown>> } | null)?.rows ?? []`.
    4. If rows.length === 0:
       `<p className="text-sm text-muted text-center pt-8">Aucune donnée disponible.</p>`
    5. Otherwise render a scrollable table:
       ```
       <div className="overflow-auto max-h-52">
         <table className="w-full text-sm">
           <thead>
             <tr>
               {widget.config.columns.map(col => (
                 <th key={col.key}
                   className="py-2 px-3 text-left text-xs font-bold tracking-wide uppercase text-muted bg-[#F7F6F3] sticky top-0">
                   {col.label}
                 </th>
               ))}
             </tr>
           </thead>
           <tbody>
             {rows.map((row, i) => (
               <tr key={i} className="border-t border-border hover:bg-[#F7F6F3]">
                 {widget.config.columns.map(col => (
                   <td key={col.key} className="py-2 px-3 text-text">
                     {String(row[col.key] ?? '—')}
                   </td>
                 ))}
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       ```
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/widgets/TableWidget.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    TableWidget renders dynamic columns from widget.config.columns. Scrollable tbody at max-h-52.
    Empty state and loading/error via WidgetCard. TypeScript passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: AthleteListWidget + ThresholdIndicatorWidget</name>
  <files>
    apps/web/src/components/coach/dashboard/widgets/AthleteListWidget.tsx
    apps/web/src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx
  </files>
  <action>
    **AthleteListWidget.tsx** (`'use client'`):
    Prop: `{ widget: AthleteListWidget; clientId: string }`

    1. Call `useWidgetData(clientId, 'athlete_list', widget.period, widget.config.filter)`.
    2. Wrap in `<WidgetCard title={widget.title} period={widget.period}
       isLoading={isLoading} error={error?.message ?? null}>`.
    3. Cast:
       `const athletes = (data as { rows: Array<{ id: string; name: string; last_activity_at: string | null }> } | null)?.rows ?? []`.
    4. Empty state if length === 0: `<p className="text-sm text-muted text-center pt-8">Aucun athlète.</p>`
    5. Otherwise render a compact list:
       ```
       <ul className="space-y-2 overflow-auto max-h-52">
         {athletes.map(a => (
           <li key={a.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
             <span className="text-sm font-normal text-text">{a.name}</span>
             <span className="text-xs text-muted">
               {a.last_activity_at
                 ? new Date(a.last_activity_at).toLocaleDateString('fr-FR')
                 : 'Jamais'}
             </span>
           </li>
         ))}
       </ul>
       ```

    ---

    **ThresholdIndicatorWidget.tsx** (`'use client'`):
    Prop: `{ widget: ThresholdIndicatorWidget; clientId: string }`

    1. Call `useWidgetData(clientId, 'threshold_indicator', widget.period, widget.config.dataKey)`.
    2. Wrap in `<WidgetCard title={widget.title} period={widget.period}
       isLoading={isLoading} error={error?.message ?? null}>`.
    3. Cast: `const value = (data as { value: number } | null)?.value ?? null`.
    4. If value is null: `<p className="text-sm text-muted text-center pt-8">—</p>`
    5. Otherwise:
       - `const pct = Math.min(100, Math.round((value / widget.config.threshold) * 100))`
       - `const isAbove = value >= widget.config.threshold`
       - `const barColor = isAbove ? '#22C55E' : '#FF5C1A'`
       - Render:
         ```
         <div className="flex flex-col gap-3 justify-center h-full px-2">
           <div className="flex items-end justify-between mb-1">
             <span className="text-3xl font-bold text-text">
               {value}{widget.config.unit ? ` ${widget.config.unit}` : ''}
             </span>
             <span className="text-xs text-muted">
               seuil: {widget.config.threshold}{widget.config.unit ? ` ${widget.config.unit}` : ''}
             </span>
           </div>
           <div className="w-full bg-[#E2E0DA] rounded-full h-3">
             <div
               className="h-3 rounded-full transition-all duration-300"
               style={{ width: `${pct}%`, backgroundColor: barColor }}
             />
           </div>
           <span className="text-xs text-muted text-right">{pct}%</span>
         </div>
         ```
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/widgets/AthleteListWidget.tsx src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    AthleteListWidget renders athlete rows with last_activity_at formatted in fr-FR.
    ThresholdIndicatorWidget renders colored progress bar with pct calculation.
    Both use WidgetCard chrome. TypeScript passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: CalloutWidget</name>
  <files>apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx</files>
  <action>
    Create `'use client'` component. Callout is static — does NOT call `useWidgetData`.

    Prop interface:
    ```
    interface Props { widget: CalloutWidget }
    ```
    (No `clientId` needed — no API call)

    Severity color map:
    ```
    const SEVERITY_COLORS = {
      info: '#3B82F6',
      warning: '#FF5C1A',
      success: '#22C55E',
    } as const
    ```

    Severity label map (French):
    ```
    const SEVERITY_LABELS = {
      info: 'Info',
      warning: 'Attention',
      success: 'Succès',
    } as const
    ```

    Render inside `<WidgetCard title={widget.title} period={undefined}
    isLoading={false} error={null}>`:
    ```
    <div
      className="h-full flex items-start gap-3 rounded-xl p-4"
      style={{ borderLeft: `4px solid ${SEVERITY_COLORS[widget.config.severity]}` }}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-1"
          style={{ color: SEVERITY_COLORS[widget.config.severity] }}>
          {SEVERITY_LABELS[widget.config.severity]}
        </p>
        <p className="text-sm text-text leading-relaxed">{widget.config.message}</p>
      </div>
    </div>
    ```
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/components/coach/dashboard/widgets/CalloutWidget.tsx 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    CalloutWidget renders static message with left border colored by severity.
    No API call made. Three severity colors implemented. TypeScript passes.
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. All 4 widget files exist in `apps/web/src/components/coach/dashboard/widgets/`.
2. AthleteListWidget and ThresholdIndicatorWidget call `useWidgetData`.
3. CalloutWidget does NOT call `useWidgetData` (static).
4. `npx tsc --noEmit` from `apps/web/` passes.
</verification>

<success_criteria>
- All 4 files exist: `ls apps/web/src/components/coach/dashboard/widgets/TableWidget.tsx apps/web/src/components/coach/dashboard/widgets/AthleteListWidget.tsx apps/web/src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx`
- Callout has no API call: `grep -c "useWidgetData" apps/web/src/components/coach/dashboard/widgets/CalloutWidget.tsx` returns 0
- Threshold colors present: `grep "22C55E\|FF5C1A" apps/web/src/components/coach/dashboard/widgets/ThresholdIndicatorWidget.tsx` returns matches
- No TS errors: `npx tsc --noEmit` from `apps/web/` exits 0
</success_criteria>

<output>Create `.planning/workstreams/custom-widget/phases/02-widget-renderers/02-04-SUMMARY.md` when done.</output>
