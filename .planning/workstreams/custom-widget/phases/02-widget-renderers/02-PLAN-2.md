---
phase: 02-widget-renderers
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/hooks/useDashboardConfig.ts
  - apps/web/src/hooks/useWidgetData.ts
autonomous: true
requirements:
  - DASH-02
  - DASH-04
must_haves:
  truths:
    - "useDashboardConfig(clientId) fetches GET /coach/dashboards/:clientId with auth and returns Widget[]"
    - "useWidgetData fetches GET /coach/clients/:clientId/widget-data with type/period/dataKey params"
    - "Both hooks handle loading, error, and empty states"
    - "JWT is obtained from Supabase browser client session on every call"
  artifacts:
    - path: "apps/web/src/hooks/useDashboardConfig.ts"
      provides: "TanStack Query hook returning DashboardConfig"
      exports: ["useDashboardConfig"]
    - path: "apps/web/src/hooks/useWidgetData.ts"
      provides: "TanStack Query hook returning per-widget data"
      exports: ["useWidgetData"]
  key_links:
    - from: "apps/web/src/hooks/useDashboardConfig.ts"
      to: "GET /coach/dashboards/:clientId"
      via: "fetch with Bearer token"
      pattern: "coach/dashboards"
    - from: "apps/web/src/hooks/useWidgetData.ts"
      to: "GET /coach/clients/:clientId/widget-data"
      via: "fetch with Bearer token + query params"
      pattern: "widget-data"
---

<objective>
Write the two TanStack Query hooks that feed all widget components and the dashboard shell with live API data.

Purpose: Centralizes all data fetching for the dashboard into two reusable hooks. Widget renderers (Plan 3–4) and DashboardGrid (Plan 5) import these hooks without knowing the fetch implementation details.

Output: `useDashboardConfig.ts` and `useWidgetData.ts` in `apps/web/src/hooks/`
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/ziko-platform/.planning/workstreams/custom-widget/phases/02-widget-renderers/02-CONTEXT.md
@C:/ziko-platform/apps/web/src/components/coach/ClientNotesPanel.tsx
@C:/ziko-platform/apps/web/src/components/coach/QueryProvider.tsx

<interfaces>
<!-- API contracts for the two hooks -->

GET /coach/dashboards/:clientId
  Headers: Authorization: Bearer <jwt>
  Response: { schema_version: 1, widgets: Widget[] }
  (returns 4 default widgets when no DB row exists for this coach+client pair)

GET /coach/clients/:clientId/widget-data?type=X&period=Y&dataKey=Z
  Headers: Authorization: Bearer <jwt>
  Query params:
    type: WidgetType (e.g. 'kpi_tile', 'line_chart', etc.)
    period: WidgetPeriod ('7d' | '30d' | '90d' | 'all')
    dataKey: string (e.g. 'sessions_count', 'weight_kg', 'habits_pct')
  Response shape by type:
    kpi_tile:             { value: number }
    line_chart:           { data: Array<{ date: string; value: number }> }
    bar_chart:            { data: Array<{ date: string; value: number }> }
    table:                { rows: Array<Record<string, unknown>> }
    athlete_list:         { rows: Array<{ id: string; name: string; last_activity_at: string | null }> }
    threshold_indicator:  { value: number }
    callout:              (never called — static widget)

<!-- JWT pattern from ClientNotesPanel.tsx -->
fetch(`${apiUrl}/coach/clients/${clientId}/notes`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ content }),
});
// Bearer token pattern (from sessions/page.tsx server side):
const { data: { session } } = await supabase.auth.getSession();
const jwt = session?.access_token ?? '';
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: useDashboardConfig hook</name>
  <files>apps/web/src/hooks/useDashboardConfig.ts</files>
  <action>
    Create `apps/web/src/hooks/useDashboardConfig.ts` as a `'use client'` module.

    The hook signature:
    ```
    export function useDashboardConfig(clientId: string)
    ```

    Implementation requirements:
    1. Obtain JWT: use `createBrowserClient` from `@supabase/ssr` with
       `process.env.NEXT_PUBLIC_SUPABASE_URL!` and
       `process.env.NEXT_PUBLIC_SUPABASE_KEY!`.
       Call `supabase.auth.getSession()` inside the `queryFn` to get the current token.
       If `session` is null, throw an Error('Not authenticated').

    2. Call `useQuery` from `@tanstack/react-query` with:
       - `queryKey: ['dashboard-config', clientId]`
       - `queryFn`: fetches `${process.env.NEXT_PUBLIC_API_URL}/coach/dashboards/${clientId}`
         with `headers: { Authorization: 'Bearer ' + jwt }` and `credentials: 'include'`
       - `staleTime: 60_000` (1 minute — dashboards don't change frequently)
       - `enabled: !!clientId`

    3. Parse the response JSON. If `!res.ok`, throw an Error with the status.

    4. Return the full `useQuery` result typed as `UseQueryResult<DashboardConfig>`.
       Import `DashboardConfig` from `@/types/dashboard`.

    The hook does NOT mutate. The PUT (save) call is handled directly in
    DashboardGrid (Plan 5) — this hook is read-only.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/hooks/useDashboardConfig.ts 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    Hook exported, typed as UseQueryResult&lt;DashboardConfig&gt;, queryKey includes clientId,
    JWT fetched from Supabase browser client. TypeScript passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: useWidgetData hook</name>
  <files>apps/web/src/hooks/useWidgetData.ts</files>
  <action>
    Create `apps/web/src/hooks/useWidgetData.ts` as a `'use client'` module.

    The hook signature:
    ```
    export function useWidgetData(
      clientId: string,
      type: string,
      period: string,
      dataKey: string,
    )
    ```

    Implementation requirements:
    1. Same JWT pattern as `useDashboardConfig` — `createBrowserClient` from `@supabase/ssr`,
       call `getSession()` inside `queryFn`.

    2. `useQuery` with:
       - `queryKey: ['widget-data', clientId, type, period, dataKey]`
       - `queryFn`: builds URL as
         `${process.env.NEXT_PUBLIC_API_URL}/coach/clients/${clientId}/widget-data`
         with URLSearchParams: `{ type, period, dataKey }`.
         Fetches with `headers: { Authorization: 'Bearer ' + jwt }` + `credentials: 'include'`.
       - `staleTime: 30_000` (30 seconds — widget data can refresh more frequently)
       - `enabled: !!clientId && !!type`

    3. Return type: `UseQueryResult<unknown>` — each widget renderer casts the data
       to its expected shape internally (no shared response type needed here).

    4. Export a helper type `WidgetDataResult = ReturnType<typeof useWidgetData>` for
       consumers that need to reference the return type.
  </action>
  <verify>
    <automated>cd C:/ziko-platform/apps/web && npx tsc --noEmit src/hooks/useWidgetData.ts 2>&1 | grep -c "error TS" || echo "0"</automated>
  </verify>
  <done>
    Hook exported with 4 params. queryKey includes all 4 params. URL built with
    URLSearchParams. TypeScript passes. Returns UseQueryResult&lt;unknown&gt;.
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. `apps/web/src/hooks/useDashboardConfig.ts` exists and exports `useDashboardConfig`.
2. `apps/web/src/hooks/useWidgetData.ts` exists and exports `useWidgetData`.
3. `npx tsc --noEmit` from `apps/web/` passes for both files.
4. Both hooks use `createBrowserClient` from `@supabase/ssr` for JWT.
</verification>

<success_criteria>
- Hooks exist: `ls apps/web/src/hooks/useDashboardConfig.ts apps/web/src/hooks/useWidgetData.ts`
- TanStack Query used: `grep -c "useQuery" apps/web/src/hooks/useDashboardConfig.ts` returns 1
- Auth header present: `grep "Authorization" apps/web/src/hooks/useDashboardConfig.ts` returns match
- Widget-data URL correct: `grep "widget-data" apps/web/src/hooks/useWidgetData.ts` returns match
</success_criteria>

<output>Create `.planning/workstreams/custom-widget/phases/02-widget-renderers/02-02-SUMMARY.md` when done.</output>
