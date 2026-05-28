---
phase: 01-db-api-foundation
plan: 4
type: execute
wave: 3
depends_on:
  - "01-01"
  - "01-02"
  - "01-03"
files_modified:
  - backend/api/src/coach/dashboards/db.ts
  - backend/api/src/coach/clients/service.ts
autonomous: true
requirements:
  - INFRA-03

must_haves:
  truths:
    - "GET /coach/clients/:clientId/widget-data?type=line_chart&period=30d returns { entries: [{date, value}] }"
    - "GET /coach/clients/:clientId/widget-data?type=kpi_tile&period=7d returns { value: number, label: string }"
    - "GET /coach/clients/:clientId/widget-data?type=bar_chart&period=30d returns { entries: [{date, value}] }"
    - "GET /coach/clients/:clientId/widget-data?type=table&period=30d returns { rows: [...] }"
    - "GET /coach/clients/:clientId/widget-data?type=athlete_list&period=all returns { athletes: [...] }"
    - "GET /coach/clients/:clientId/widget-data?type=threshold_indicator returns { value: number, threshold: number }"
    - "GET /coach/clients/:clientId/widget-data?type=callout returns { message: string }"
    - "Unknown type query param returns 400 with clear error message"
    - "Unknown period query param returns 400"
    - "dataKey query param routes the kpi_tile/line_chart/bar_chart/threshold_indicator to the correct Supabase table"
  artifacts:
    - path: "backend/api/src/coach/dashboards/db.ts"
      provides: "Widget-data aggregation functions for all 7 widget types"
      exports: ["getWidgetData"]
    - path: "backend/api/src/coach/clients/service.ts"
      provides: "GET /:clientId/widget-data route handler"
      contains: "widget-data"
  key_links:
    - from: "GET /coach/clients/:clientId/widget-data"
      to: "getWidgetData in coach/dashboards/db.ts"
      via: "import from '../dashboards/db.js'"
      pattern: "getWidgetData"
    - from: "getWidgetData"
      to: "Supabase tables"
      via: "createUserClient(jwt) RLS-scoped queries"
      pattern: "createUserClient"
---

<objective>
Implement `GET /coach/clients/:clientId/widget-data?type=X&period=Y&dataKey=Z` — the endpoint each widget calls to fetch athlete data. Returns correctly shaped data for all 7 widget types, period-scoped and coach-RLS-enforced.

Purpose: Without this endpoint, Phase 02 widgets cannot display real athlete data — they would be empty shells.
Output: `getWidgetData` function in db.ts + route handler in clients/service.ts.
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
@/home/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/custom-widget/ROADMAP.md
@.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md

<interfaces>
<!-- Widget-data response shapes per type — these are the contracts Phase 02 renderers depend on -->

type=line_chart: { entries: Array<{ date: string; value: number }> }
  dataKey options: 'weight_kg' (body_measurements), 'sleep_duration_hours' (sleep_logs), 'mood' (journal_entries), 'cardio_distance_km' (cardio_sessions)

type=bar_chart: { entries: Array<{ date: string; value: number }> }
  dataKey options: same pool as line_chart; aggregated by period bucket (daily for 7d/30d, weekly for 90d, all-time total for 'all')

type=kpi_tile: { value: number; label: string; trend?: number }
  dataKey options: 'sessions_count' (workout_sessions), 'habits_pct' (habit_logs), 'weight_kg' (latest body_measurements), 'sleep_duration_hours' (avg sleep_logs)
  trend: percentage change vs previous equivalent period (optional — omit if insufficient data)

type=table: { rows: Array<Record<string, string | number>> }
  Returns last N rows from the relevant table (N = period-based: 7d→7 rows max, 30d→20, 90d→50, all→100)
  dataKey options: 'sessions' (workout_sessions: name, created_at, duration), 'nutrition' (nutrition_logs: food_name, calories, date), 'measurements' (body_measurements: weight_kg, created_at)

type=athlete_list: { athletes: Array<{ id: string; name: string | null; last_active: string | null }> }
  Returns the coach's linked athletes from coach_client_links + user_profiles
  period param ignored for this type (always returns current linked athletes)
  filter query param (from AthleteListConfig): 'all' | 'active' | 'at_risk' — 'active' = last_active within 14 days; 'at_risk' = no session in last 14 days

type=threshold_indicator: { value: number; threshold: number; unit?: string }
  dataKey: same pool as kpi_tile; threshold and unit passed as query params (from widget config)
  value = current period average/count (same logic as kpi_tile)

type=callout: { message: string; severity: 'info' | 'warning' | 'success' }
  No DB query — message is stored in the widget config itself (callout is coach-authored text)
  message and severity passed as query params from the widget config

Period to date math:
  '7d'  → new Date(Date.now() - 7  * 86400000)
  '30d' → new Date(Date.now() - 30 * 86400000)
  '90d' → new Date(Date.now() - 90 * 86400000)
  'all' → new Date('2020-01-01') (effectively no date filter)

From backend/api/src/coach/clients/db.ts (createUserClient — used in all existing client db functions):
export function createUserClient(jwt: string): SupabaseClient

From backend/api/src/coach/dashboards/schemas.ts:
export const PeriodEnum — z.enum(['7d','30d','90d','all'])

From backend/api/src/coach/clients/service.ts (existing — read before modifying):
Hono router with authMiddleware already applied; all existing routes follow the clientsRouter pattern
New route goes AFTER existing /:id routes to avoid conflicts; use path /:clientId/widget-data
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add getWidgetData to db.ts — aggregation functions for all 7 widget types</name>
  <files>backend/api/src/coach/dashboards/db.ts</files>
  <read_first>
    - backend/api/src/coach/dashboards/db.ts — current content (written in Plan 3 Task 1); append to this file, do not overwrite
    - backend/api/src/coach/clients/db.ts (lines 560-640) — how getClientSessions, getClientSleep, getClientMeasurements query Supabase; exact table names, column names, and .order/.limit patterns; replicate these for widget-data
    - backend/api/src/coach/dashboards/schemas.ts — PeriodEnum type for the period parameter
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — D-02 (period enum), INFRA-03 requirement
  </read_first>
  <action>
    Append a `getWidgetData` function to the existing backend/api/src/coach/dashboards/db.ts file (do not overwrite — preserve the 5 functions already written in Plan 3).

    Add import for PeriodEnum type from './schemas.js' at the top (if not already imported).
    Import z from 'zod' if not already imported.

    Function signature:
    getWidgetData(jwt: string, coachId: string, clientId: string, type: string, period: string, params: Record<string, string>): Promise<Record<string, unknown>>

    Validate period against PeriodEnum before querying. Throw Error('Invalid period') if not in enum.

    Compute `since` date from period:
    - '7d' → new Date(Date.now() - 7 * 86400000).toISOString()
    - '30d' → new Date(Date.now() - 30 * 86400000).toISOString()
    - '90d' → new Date(Date.now() - 90 * 86400000).toISOString()
    - 'all' → '2020-01-01T00:00:00.000Z'

    Switch on `type`:

    case 'line_chart': query based on params.dataKey:
      - 'weight_kg': db.from('body_measurements').select('created_at, weight_kg').eq('user_id', clientId).gte('created_at', since).order('created_at', ascending: true); return { entries: data.map(r => ({ date: r.created_at.split('T')[0], value: r.weight_kg })) }
      - 'sleep_duration_hours': db.from('sleep_logs').select('date, duration_hours').eq('user_id', clientId).gte('date', since.split('T')[0]).order('date', ascending: true); return { entries: data.map(r => ({ date: r.date, value: r.duration_hours })) }
      - 'mood': db.from('journal_entries').select('created_at, mood').eq('user_id', clientId).gte('created_at', since).order('created_at', ascending: true); return { entries: data.map(r => ({ date: r.created_at.split('T')[0], value: r.mood })) }
      - default (unknown dataKey): return { entries: [] }

    case 'bar_chart': same query logic as line_chart — returns { entries: [...] } (renderer decides how to aggregate visually)

    case 'kpi_tile': based on params.dataKey:
      - 'sessions_count': count workout_sessions since `since`; return { value: count, label: 'séances' }
      - 'habits_pct': habits completion rate (reuse logic from getClientSummary in clients/db.ts — habits count × 7d ÷ 7); return { value: pct, label: 'habitudes' }
      - 'weight_kg': latest body_measurements weight; return { value: latest.weight_kg, label: 'kg' }
      - 'sleep_duration_hours': avg sleep_logs duration_hours since `since`; return { value: avg, label: 'h de sommeil' }
      - default: return { value: 0, label: params.dataKey ?? 'metric' }

    case 'table': based on params.dataKey:
      - 'sessions': getClientSessions-equivalent (workout_sessions: id, name, created_at); return { rows: data.map(r => ({ date: r.created_at.split('T')[0], name: r.name ?? 'Séance', duration: '-' })) }
      - 'nutrition': nutrition_logs (food_name, calories, date) since `since`; return { rows: data.map(r => ({ date: r.date, food: r.food_name, calories: r.calories })) }
      - 'measurements': body_measurements since `since`; return { rows: data.map(r => ({ date: r.created_at.split('T')[0], weight: r.weight_kg })) }
      - default: return { rows: [] }

    case 'athlete_list':
      Query coach_client_links for this coach (coach_id = coachId, revoked_at IS NULL). Then fetch user_profiles for each linked client. Optionally filter by params.filter ('active'/'at_risk'): last_active within 14 days = active; no session in 14 days = at_risk. Return { athletes: [...] }. Period param ignored.

    case 'threshold_indicator':
      Same as kpi_tile logic for the given params.dataKey. Return { value: number, threshold: parseFloat(params.threshold ?? '0'), unit: params.unit ?? undefined }

    case 'callout':
      No DB query. Return { message: params.message ?? '', severity: params.severity ?? 'info' }

    default: throw new Error(`Unknown widget type: ${type}`)

    All queries use createUserClient(jwt) — RLS enforces the coach can only see their linked clients' data.
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -i "coach/dashboards/db" | head -5</automated>
  </verify>
  <acceptance_criteria>
    - backend/api/src/coach/dashboards/db.ts now exports getWidgetData in addition to the 5 existing functions
    - getWidgetData switches on all 7 type values; default case throws Error with the unknown type name
    - period validation: invalid period value throws Error('Invalid period') before any DB query
    - All DB queries use createUserClient(jwt) — no service key
    - case 'callout' returns immediately without any DB query
    - case 'athlete_list' queries coach_client_links with eq('coach_id', coachId) to scope to this coach
    - tsc --noEmit reports no new errors in this file
  </acceptance_criteria>
  <done>getWidgetData exported from db.ts; handles all 7 types; tsc --noEmit clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add widget-data route to clients/service.ts</name>
  <files>backend/api/src/coach/clients/service.ts</files>
  <read_first>
    - backend/api/src/coach/clients/service.ts — read the full file before editing; identify the last route before the export; new route goes at the END (after all existing /:id/* routes) to avoid path conflicts with existing /:id routes
    - backend/api/src/coach/dashboards/db.ts — getWidgetData signature (just added in Task 1)
    - backend/api/src/coach/dashboards/schemas.ts — PeriodEnum for validation error message
  </read_first>
  <action>
    Edit backend/api/src/coach/clients/service.ts — add at the end of the file (before any closing export if present, otherwise after the last route definition):

    Add import at top: import { getWidgetData } from '../dashboards/db.js'

    Add route at end of router:
    clientsRouter.get('/:clientId/widget-data', async (c) => {
      const { userId } = c.get('auth')
      const jwt = c.req.header('Authorization')!.slice(7)
      const clientId = c.req.param('clientId')
      const type = c.req.query('type')
      const period = c.req.query('period') ?? '30d'

      if (!type) return c.json({ error: 'type query param required' }, 400)

      // Collect optional params (dataKey, threshold, unit, message, severity, filter)
      const params: Record<string, string> = {}
      for (const key of ['dataKey', 'threshold', 'unit', 'message', 'severity', 'filter']) {
        const v = c.req.query(key)
        if (v !== undefined) params[key] = v
      }

      try {
        const data = await getWidgetData(jwt, userId, clientId, type, period, params)
        return c.json(data)
      } catch (err: any) {
        const msg: string = err?.message ?? 'Unknown error'
        if (msg.startsWith('Unknown widget type') || msg === 'Invalid period') {
          return c.json({ error: msg }, 400)
        }
        console.error('[widget-data]', err)
        return c.json({ error: 'Internal server error' }, 500)
      }
    })

    Do not modify any existing routes or imports in clients/service.ts beyond adding the import and this one route.
    The /:clientId/widget-data path must be placed AFTER any existing /:clientId or /:id routes, not before.
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -i "coach/clients/service" | head -5</automated>
  </verify>
  <acceptance_criteria>
    - backend/api/src/coach/clients/service.ts contains the route `clientsRouter.get('/:clientId/widget-data', ...)`
    - Import of getWidgetData from '../dashboards/db.js' is present at top of file
    - The new route is placed after all existing routes (grep line numbers confirm)
    - Missing `type` param returns 400
    - Unknown type/period errors from getWidgetData are returned as 400 (not 500)
    - tsc --noEmit reports no new errors in coach/clients/service.ts
  </acceptance_criteria>
  <done>widget-data route added to clients/service.ts at end of router; import present; tsc --noEmit clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HTTP query params → getWidgetData | type, period, dataKey, threshold come from untrusted client; validated before DB query |
| clientId URL param → Supabase RLS | Coach requests data for a specific athlete; createUserClient(jwt) + RLS enforces the coach can only access their linked clients' data |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Information Disclosure | widget-data — cross-client data access | mitigate | createUserClient(jwt) enforces is_coach_of RLS; coach can only query their linked athletes |
| T-04-02 | Tampering | type param injection — SQL via widget type | mitigate | switch statement on known string values; unknown type throws error before any query |
| T-04-03 | Tampering | dataKey param — arbitrary column name injection | mitigate | switch on known dataKey values in getWidgetData; unknown dataKey returns empty data, never interpolated into SQL |
| T-04-04 | Denial of Service | period='all' → unbounded DB scan | accept | 'all' uses 2020-01-01 cutoff; athlete data volume bounded by real training history; no .limit() removal |
| T-04-05 | Elevation of Privilege | athlete_list queries coach_client_links | mitigate | query scoped to eq('coach_id', coachId) derived from JWT — coach cannot list another coach's athletes |
| T-04-SC | Tampering | No new npm installs | accept | No new packages required |
</threat_model>

<verification>
After both tasks complete:
1. `npx tsc --noEmit -p backend/api/tsconfig.json` — zero new errors
2. `grep "widget-data" backend/api/src/coach/clients/service.ts` — returns match
3. `grep "getWidgetData" backend/api/src/coach/dashboards/db.ts` — returns match for both function definition and export
4. `grep "case 'callout'" backend/api/src/coach/dashboards/db.ts` — present (callout returns no DB query)
5. `grep "createUserClient" backend/api/src/coach/dashboards/db.ts` — present in getWidgetData (ARCH-03 compliance)
</verification>

<success_criteria>
- getWidgetData handles all 7 widget types; returns correctly shaped data objects; unknown type returns 400
- GET /coach/clients/:clientId/widget-data route in clientsRouter accepts type + period + optional params; delegates to getWidgetData; maps errors to 400/500 correctly
- tsc --noEmit passes with no new errors
</success_criteria>

<output>
Create `.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-04-SUMMARY.md` when done.
</output>
