---
phase: 01-db-api-foundation
plan: 3
type: execute
wave: 2
depends_on:
  - "01-01"
  - "01-02"
files_modified:
  - backend/api/src/coach/dashboards/db.ts
  - backend/api/src/coach/dashboards/service.ts
  - backend/api/src/app.ts
autonomous: true
requirements:
  - INFRA-02a
  - DASH-04

must_haves:
  truths:
    - "GET /coach/dashboards/memory returns 200 with coach's memory row (or 200 with empty placeholder if no row)"
    - "PUT /coach/dashboards/memory upserts coach_memory row and returns updated memory"
    - "GET /coach/dashboards/:clientId returns { schema_version: 1, widgets: [...] } — defaults when no row, stored array when row exists"
    - "PUT /coach/dashboards/:clientId upserts the widgets array and returns the full config with schema_version: 1"
    - "DELETE /coach/dashboards/:clientId deletes the row and returns 200"
    - "/memory route is registered BEFORE /:clientId to prevent param collision (L-05)"
    - "All routes require a valid coach JWT (401 without it)"
    - "app.ts mounts dashboardsRouter at /coach/dashboards"
  artifacts:
    - path: "backend/api/src/coach/dashboards/db.ts"
      provides: "Supabase data access functions for dashboard_configs and coach_memory"
      exports: ["getDashboardConfig", "upsertDashboardConfig", "deleteDashboardConfig", "getCoachMemory", "upsertCoachMemory"]
    - path: "backend/api/src/coach/dashboards/service.ts"
      provides: "Hono router with 5 dashboard CRUD routes"
      exports: ["dashboardsRouter"]
    - path: "backend/api/src/app.ts"
      provides: "Mounts dashboardsRouter at /coach/dashboards"
      contains: "app.route('/coach/dashboards', dashboardsRouter)"
  key_links:
    - from: "service.ts routes"
      to: "db.ts functions"
      via: "direct import"
      pattern: "from '\\.\/db\\.js'"
    - from: "app.ts"
      to: "dashboardsRouter"
      via: "app.route('/coach/dashboards', dashboardsRouter)"
      pattern: "coach/dashboards.*dashboardsRouter"
    - from: "GET /:clientId response"
      to: "DashboardConfigSchema"
      via: "schema_version: 1 at root"
      pattern: "schema_version.*1"
---

<objective>
Build the `coach/dashboards/` bounded context: DB access layer (`db.ts`) + Hono router (`service.ts`) with 5 CRUD routes + mount in `app.ts`. This is the API surface that Phase 02 (UI) and Phase 03 (AI) build on.

Purpose: Without these routes, no dashboard config can be read, written, or reset — blocking all subsequent phases.
Output: Three files — db.ts, service.ts, and a one-line addition to app.ts.
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
@/home/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/custom-widget/ROADMAP.md
@.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md

<interfaces>
<!-- Contracts the executor needs. Read these files before implementing. -->

From backend/api/src/coach/clients/db.ts (createUserClient — ARCH-03):
export function createUserClient(jwt: string): SupabaseClient
  — uses SUPABASE_PUBLISHABLE_KEY + Bearer auth header
  — RLS fires automatically; NEVER use service key for coach reads

From backend/api/src/coach/dashboards/types.ts (created in Plan 2):
export interface DashboardConfig { schema_version: 1; widgets: Widget[] }
export interface DashboardConfigRow { id: string; coach_id: string; client_id: string; widgets: Widget[]; updated_at: string; created_at: string }
export interface CoachMemoryRow { id: string; coach_id: string; memory: { templates: unknown[]; preferences: Record<string, unknown> }; updated_at: string }

From backend/api/src/coach/dashboards/schemas.ts (created in Plan 2):
export const DashboardConfigSchema — z.object({ schema_version: z.literal(1), widgets: z.array(WidgetSchema).max(12) }).strict()
export const WidgetSchema — z.discriminatedUnion(...)
export const DEFAULT_WIDGETS — DashboardConfig (4 widgets, no DB row)

From backend/api/src/middleware/auth.ts (existing):
authMiddleware sets c.get('auth') as { userId: string; email: string }
JWT is in Authorization header as: `Bearer <token>`
Extract: const jwt = c.req.header('Authorization')!.slice(7)

From backend/api/src/app.ts (existing — read before modifying):
Imports and mounts 12 routers; add dashboardsRouter as the 13th
Pattern: import { dashboardsRouter } from './coach/dashboards/service.js'
Mount: app.route('/coach/dashboards', dashboardsRouter)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create db.ts — data access layer for dashboard_configs and coach_memory</name>
  <files>backend/api/src/coach/dashboards/db.ts</files>
  <read_first>
    - backend/api/src/coach/ai/db.ts — canonical bounded context db.ts pattern; how createUserClient is imported and used; error handling pattern (throw new Error(error.message))
    - backend/api/src/coach/clients/db.ts — createUserClient export (lines 1-35); the exact function being re-exported
    - backend/api/src/coach/dashboards/types.ts — DashboardConfigRow, CoachMemoryRow, DashboardConfig interfaces (just written in Plan 2)
    - backend/api/src/coach/dashboards/schemas.ts — DEFAULT_WIDGETS constant (just written in Plan 2)
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — D-03 (lazy persistence), D-04 (no phantom rows), D-05 (one row per coach upsert), L-03 (schema_version: 1 at root)
  </read_first>
  <action>
    Create backend/api/src/coach/dashboards/db.ts.

    Re-export createUserClient from '../clients/db.js' (same pattern as coach/ai/db.ts re-exports it).

    Implement these 5 functions:

    `getDashboardConfig(jwt, coachId, clientId)`: Promise<DashboardConfig>
    - Uses createUserClient(jwt)
    - Query: db.from('dashboard_configs').select('widgets').eq('coach_id', coachId).eq('client_id', clientId).maybeSingle()
    - If no row (data is null): return { schema_version: 1, widgets: DEFAULT_WIDGETS.widgets } — lazy persistence, no DB write (D-04)
    - If row exists: return { schema_version: 1, widgets: data.widgets as Widget[] }
    - Throw Error on Supabase error

    `upsertDashboardConfig(jwt, coachId, clientId, widgets)`: Promise<DashboardConfigRow>
    - Validates widgets array with WidgetSchema (each element) before upsert; throws ZodError message if invalid
    - Uses db.from('dashboard_configs').upsert({ coach_id: coachId, client_id: clientId, widgets, updated_at: new Date().toISOString() }, { onConflict: 'coach_id,client_id' }).select('id,coach_id,client_id,widgets,updated_at,created_at').single()
    - Returns the upserted row cast as DashboardConfigRow
    - Throw Error on Supabase error

    `deleteDashboardConfig(jwt, coachId, clientId)`: Promise<void>
    - Deletes row: db.from('dashboard_configs').delete().eq('coach_id', coachId).eq('client_id', clientId)
    - Throw Error on Supabase error

    `getCoachMemory(jwt, coachId)`: Promise<CoachMemoryRow | null>
    - Query: db.from('coach_memory').select('id,coach_id,memory,updated_at').eq('coach_id', coachId).maybeSingle()
    - Returns null if no row (no phantom writes — caller handles null as empty state)
    - Throw Error on Supabase error

    `upsertCoachMemory(jwt, coachId, memory)`: Promise<CoachMemoryRow>
    - Uses db.from('coach_memory').upsert({ coach_id: coachId, memory, updated_at: new Date().toISOString() }, { onConflict: 'coach_id' }).select('id,coach_id,memory,updated_at').single()
    - Returns the upserted row
    - Throw Error on Supabase error

    Import Widget from ./types.js for type cast. Import WidgetSchema, DEFAULT_WIDGETS from ./schemas.js.
    Never use service key — all 5 functions use createUserClient(jwt) only (ARCH-03).
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -i "coach/dashboards/db" | head -5</automated>
  </verify>
  <acceptance_criteria>
    - File backend/api/src/coach/dashboards/db.ts exists
    - Exports: getDashboardConfig, upsertDashboardConfig, deleteDashboardConfig, getCoachMemory, upsertCoachMemory, createUserClient (re-export)
    - No direct use of SUPABASE_SERVICE_KEY in this file — all calls use createUserClient(jwt)
    - getDashboardConfig returns { schema_version: 1, widgets: DEFAULT_WIDGETS.widgets } when maybeSingle() returns null
    - upsertDashboardConfig uses onConflict: 'coach_id,client_id' (upsert, not insert)
    - upsertCoachMemory uses onConflict: 'coach_id' (one row per coach, D-05)
    - tsc --noEmit reports no errors in this file
  </acceptance_criteria>
  <done>db.ts exists with 5 exported functions; no service key usage; tsc --noEmit clean.</done>
</task>

<task type="auto">
  <name>Task 2: Create service.ts + mount in app.ts — 5 Hono routes</name>
  <files>
    backend/api/src/coach/dashboards/service.ts
    backend/api/src/app.ts
  </files>
  <read_first>
    - backend/api/src/coach/ai/service.ts (lines 1-30) — Hono router pattern: const router = new Hono(); router.use('*', authMiddleware); authMiddleware extracts auth; exact import paths
    - backend/api/src/coach/clients/service.ts (lines 1-60) — how clientsRouter is structured, exported, mounted
    - backend/api/src/app.ts — current 12 mounts; where to add the 13th (after coachAiRouter line, before notFound)
    - backend/api/src/coach/dashboards/db.ts — function signatures (just created in Task 1)
    - backend/api/src/coach/dashboards/schemas.ts — DashboardConfigSchema for request body validation
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — L-05 (/memory before /:clientId), D-03 (defaults on GET), D-04 (DELETE resets to defaults)
  </read_first>
  <action>
    Create backend/api/src/coach/dashboards/service.ts:

    Import Hono, authMiddleware, all 5 db functions, DashboardConfigSchema, WidgetSchema from './schemas.js'.
    Import types from './types.js'.

    export const dashboardsRouter = new Hono()
    dashboardsRouter.use('*', authMiddleware)

    Route order is CRITICAL per L-05 — register static paths before dynamic:

    1. GET /memory — REGISTERED FIRST
       - Extract { userId } from c.get('auth'), jwt from Authorization header
       - Call getCoachMemory(jwt, userId)
       - If null: return c.json({ memory: { templates: [], preferences: {} } })
       - If row: return c.json({ memory: row.memory })

    2. PUT /memory — REGISTERED SECOND
       - Parse body: expect { memory: unknown }
       - Call upsertCoachMemory(jwt, userId, body.memory)
       - Return c.json({ memory: row.memory })

    3. GET /:clientId — REGISTERED THIRD
       - Extract clientId from c.req.param('clientId')
       - Call getDashboardConfig(jwt, userId, clientId)
       - Return c.json(config) — shape is { schema_version: 1, widgets: [...] }

    4. PUT /:clientId — REGISTERED FOURTH
       - Parse body: expect { widgets: unknown[] }
       - Validate each widget via WidgetSchema.parse() — return 400 with ZodError message on failure
       - Call upsertDashboardConfig(jwt, userId, clientId, validatedWidgets)
       - Return c.json({ schema_version: 1 as const, ...row }) — include schema_version in response per L-03

    5. DELETE /:clientId — REGISTERED FIFTH
       - Call deleteDashboardConfig(jwt, userId, clientId)
       - Return c.json({ deleted: true, defaults: DEFAULT_WIDGETS }) — returns defaults so client can immediately display them per D-03

    Error handling in every route: wrap in try/catch; return c.json({ error: err.message }, 400) for validation errors, c.json({ error: 'Internal server error' }, 500) for unexpected errors.

    In backend/api/src/app.ts:
    - Add import: import { dashboardsRouter } from './coach/dashboards/service.js'
    - Add mount after the coachAiRouter line: app.route('/coach/dashboards', dashboardsRouter)
    - Do not modify any other line in app.ts
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -i "coach/dashboards" | head -10</automated>
  </verify>
  <acceptance_criteria>
    - File backend/api/src/coach/dashboards/service.ts exists and exports dashboardsRouter
    - Route registration order in service.ts: GET /memory, PUT /memory, GET /:clientId, PUT /:clientId, DELETE /:clientId — grep shows "memory" routes appear before "clientId" routes in file
    - GET /:clientId response includes `schema_version: 1` at root
    - PUT /:clientId validates each widget with WidgetSchema.parse(); invalid widget body returns 400
    - DELETE /:clientId returns DEFAULT_WIDGETS in the response body
    - backend/api/src/app.ts contains: `app.route('/coach/dashboards', dashboardsRouter)` — grep confirms
    - backend/api/src/app.ts contains import of dashboardsRouter from './coach/dashboards/service.js'
    - tsc --noEmit reports no errors in coach/dashboards/service.ts or app.ts
  </acceptance_criteria>
  <done>service.ts and app.ts updated; /memory routes registered before /:clientId; tsc --noEmit clean; app.ts has dashboardsRouter mount.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HTTP request body → WidgetSchema.parse | Untrusted JSON from coach browser crosses into validated domain |
| Coach JWT → createUserClient → RLS | All DB reads/writes scoped to authenticated coach's rows only |
| clientId URL param | Coach requests data for a specific athlete; RLS on dashboard_configs enforces coach_id = auth.uid() (no explicit clientId ownership check needed — the schema handles it) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Spoofing | JWT extraction in routes | mitigate | authMiddleware validates Bearer token via Supabase; c.get('auth') only set on valid token |
| T-03-02 | Tampering | PUT body — arbitrary widget JSON | mitigate | WidgetSchema.parse() with .strict() variants; invalid shape returns 400 with ZodError |
| T-03-03 | Information Disclosure | GET /:clientId — cross-coach data access | mitigate | createUserClient(jwt) + RLS USING (auth.uid() = coach_id); coach cannot read another coach's configs |
| T-03-04 | Elevation of Privilege | DELETE resets config — no ownership check beyond RLS | accept | RLS policy enforces coach_id = auth.uid(); delete only affects the calling coach's row; acceptable |
| T-03-05 | Denial of Service | widgets array > 12 items | mitigate | DashboardConfigSchema enforces .max(12) on widgets array |
| T-03-SC | Tampering | npm installs | accept | No new packages; Hono and Zod already in backend/api/package.json |
</threat_model>

<verification>
After both tasks complete:
1. `npx tsc --noEmit -p backend/api/tsconfig.json` — zero errors in coach/dashboards/
2. `grep -n "memory" backend/api/src/coach/dashboards/service.ts | head -5` — /memory routes appear before /:clientId
3. `grep "app.route.*coach/dashboards" backend/api/src/app.ts` — returns 1 match
4. `grep "schema_version" backend/api/src/coach/dashboards/service.ts` — appears in GET /:clientId and PUT /:clientId responses
5. `grep "WidgetSchema.parse" backend/api/src/coach/dashboards/service.ts` — appears in PUT /:clientId handler
</verification>

<success_criteria>
- db.ts exports 5 data functions; all use createUserClient(jwt); getDashboardConfig returns DEFAULT_WIDGETS when no row
- service.ts exports dashboardsRouter with 5 routes; /memory registered before /:clientId; PUT validates with Zod
- app.ts mounts dashboardsRouter at /coach/dashboards
- tsc --noEmit passes with no new errors
</success_criteria>

<output>
Create `.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-03-SUMMARY.md` when done.
</output>
