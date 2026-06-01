# Phase 01: DB + API Foundation - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Migration 054 (`dashboard_configs` + `coach_memory` tables with RLS), 5 Hono CRUD routes
in `coach/dashboards/`, `GET /coach/clients/:clientId/widget-data?type=X&period=Y`, and
full Zod discriminated union schemas for all 7 widget types — so every subsequent phase
can build on a stable, validated data layer with zero schema risk.

</domain>

<decisions>
## Implementation Decisions

### Zod Widget Schemas (INFRA-04)
- **D-01:** Full per-widget schemas in Phase 01 — define all 7 variant shapes now
  (`line_chart`, `bar_chart`, `kpi_tile`, `table`, `athlete_list`, `threshold_indicator`,
  `callout`) with their specific field definitions. `additionalProperties: false` enforced
  on every variant. Phase 02 renderers import these types directly with no schema update.
- **D-02:** `period` is a closed Zod enum: `'7d' | '30d' | '90d' | 'all'` — unknown
  values rejected at schema level, widget-data endpoint switches safely on it.

### Default Config (INFRA-03 + DASH-04)
- **D-03:** Backend injects defaults server-side — `GET /coach/dashboards/:clientId`
  returns a computed default array of 3–4 widgets when no `dashboard_configs` row exists
  for the coach+client pair. Single source of truth for all current and future clients.
- **D-04:** Lazy persistence — GET computes and returns defaults without writing to DB.
  A `dashboard_configs` row is only created on the first `PUT` (explicit save). No phantom
  rows for coaches who open a client page without customizing.

### coach_memory Schema (INFRA-01 + MEM-01/MEM-02)
- **D-05:** One row per coach (upsert on `coach_id`) — global templates and preferences
  shared across all athletes. Matches MEM-01 (templates reusable across athletes).
- **D-06:** Phase 01 writes a minimal JSONB placeholder: `{ "templates": [], "preferences": {} }`.
  Phase 04 owns the full shape (template object structure, preference keys). No premature
  field locking in migration 054.

### Pre-locked (from roadmap design session — carry forward)
- **L-01:** Migration 054 contains both `dashboard_configs` AND `coach_memory` — single migration, no split.
- **L-02:** `dashboard_configs.widgets` = flat JSONB array; widget position stored as `{ x, y, w, h }` per element.
- **L-03:** `schema_version: 1` at the root of the `widgets` JSONB from day 1 — retrofitting post-production is days of debugging.
- **L-04:** Array order determines layout (no integer `position` field) — `reorder_widgets` tool shuffles the array.
- **L-05:** `/memory` route registered **before** `/:clientId` in Hono to prevent Hono treating "memory" as a clientId param.
- **L-06:** Dashboard AI tools isolated in `coach/dashboards/tools.ts` — never merged into `coach/ai/tools.ts`.
- **L-07:** `stopWhen: stepCountIs(2)` for dashboard AI (not 5 like the coach chat).
- **L-08:** Credit rate for `/ai-edit` = same as `coach_chat` for now (no separate `dashboard_edit` type).
- **L-09:** DASH-03 confirmed in scope: drag-to-reorder via `react-grid-layout@2.2.1` (installed in Phase 02).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + Roadmap
- `.planning/workstreams/custom-widget/REQUIREMENTS.md` — all 22 requirements with acceptance criteria; INFRA-01–04 and DASH-04 are Phase 01 scope
- `.planning/workstreams/custom-widget/ROADMAP.md` — phase success criteria (§ Phase 01 section lists the 4 must-be-TRUE tests)

### Existing Bounded Context Patterns (replicate these)
- `backend/api/src/coach/ai/` — example of a coach bounded context module (context.ts, db.ts, service.ts, tools.ts, types.ts)
- `backend/api/src/coach/clients/` — another bounded context; `db.ts` exports `createUserClient` used by all coach reads
- `backend/api/src/coach/ai/db.ts` — `createUserClient` + `createServiceClient` pattern; ARCH-03: coach reads ALWAYS use `createUserClient(jwt)`, never service key

### Migration Pattern
- `supabase/migrations/050_coach_ai_schema.sql` — canonical migration template: `SET LOCAL lock_timeout`, `CREATE TABLE IF NOT EXISTS`, `ENABLE ROW LEVEL SECURITY`, RLS policy `USING (auth.uid() = coach_id)`, partial indexes

### Schema
- `supabase/migrations/` (last file: 053_referral_schema.sql) — new migration must be `054_dashboard_widgets.sql`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createUserClient(jwt)` from `backend/api/src/coach/clients/db.ts` — use for all dashboard reads/writes (RLS fires automatically)
- Hono app mounting pattern in `backend/api/src/app.ts` — new `coach/dashboards/` bounded context mounted here

### Established Patterns
- **Bounded context structure:** every coach module is `{ index.ts (routes), db.ts (data), service.ts (logic), types.ts }` — `coach/dashboards/` must follow same shape
- **RLS pattern:** `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "{table}_own" ON public.{table} FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id)`
- **Migration header:** `SET LOCAL lock_timeout = '5s';` at top of every migration
- **Type-only files:** `types.ts` = interfaces only, no runtime code (see `coach/ai/types.ts`)

### Integration Points
- `app.ts` — mounts the new `coach/dashboards/` router
- `GET /coach/clients/:clientId` (clients bounded context) — the widget-data endpoint must either live in `coach/dashboards/` or be a separate route; **note:** `/memory` in `coach/dashboards/` must be registered before `/:clientId` to avoid param collision (L-05)
- Supabase auth middleware (`middleware/auth.ts`) — validates Bearer token, sets `c.get('auth')` with `{ userId, email }`

</code_context>

<specifics>
## Specific Ideas

- The 5 routes in `coach/dashboards/` are: `GET /:clientId` (fetch config or defaults), `PUT /:clientId` (upsert), `DELETE /:clientId` (reset), `GET /memory` (fetch coach prefs), `PUT /memory` (upsert coach prefs). The `POST /ai-edit` SSE endpoint is Phase 03.
- Default widgets (3–4) are returned by GET when no row exists — exact widget selection is at the researcher/planner's discretion but should include a KPI tile + line chart as minimum useful defaults.
- `schema_version` lives at the JSONB root: `{ schema_version: 1, widgets: [...] }` — not inside each widget element.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 01 scope.

</deferred>

---

*Phase: 01-DB + API Foundation*
*Context gathered: 2026-05-26*
