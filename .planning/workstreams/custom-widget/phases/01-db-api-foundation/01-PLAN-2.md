---
phase: 01-db-api-foundation
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/api/src/coach/dashboards/types.ts
  - backend/api/src/coach/dashboards/schemas.ts
autonomous: true
requirements:
  - INFRA-04

must_haves:
  truths:
    - "A Zod discriminated union `WidgetSchema` accepts exactly 7 widget type literals; any other type value is rejected with a ZodError"
    - "Each of the 7 widget variants has additionalProperties: false enforced (Zod .strict())"
    - "The `period` field is a closed Zod enum: z.enum(['7d','30d','90d','all'])"
    - "`DashboardConfigSchema` wraps the widget array with schema_version: z.literal(1) at the root"
    - "TypeScript types inferred from schemas are exported for use in db.ts and service.ts"
  artifacts:
    - path: "backend/api/src/coach/dashboards/types.ts"
      provides: "TypeScript interface types (Widget, DashboardConfig, WidgetPeriod)"
      exports: ["Widget", "DashboardConfig", "WidgetPeriod", "WidgetType"]
    - path: "backend/api/src/coach/dashboards/schemas.ts"
      provides: "Zod discriminated union schemas for runtime validation"
      exports: ["WidgetSchema", "DashboardConfigSchema", "PeriodEnum", "DEFAULT_WIDGETS"]
  key_links:
    - from: "schemas.ts WidgetSchema"
      to: "types.ts Widget"
      via: "z.infer<typeof WidgetSchema>"
      pattern: "z\\.infer<typeof WidgetSchema>"
    - from: "DashboardConfigSchema"
      to: "schema_version: z.literal(1)"
      via: "root object field"
      pattern: "schema_version.*z\\.literal\\(1\\)"
---

<objective>
Define the complete Zod discriminated union schemas for all 7 widget types and the root DashboardConfig schema. These schemas are the single source of truth used by every route handler, the default config generator, and all downstream Phase 02 renderers.

Purpose: Without strict schemas, the API cannot reject invalid widget configs and Phase 02 renderers face ambiguous data shapes.
Output: `types.ts` (TypeScript interfaces) + `schemas.ts` (Zod validators + default config constant).
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
@/home/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/custom-widget/ROADMAP.md
@.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md

<interfaces>
<!-- 7 canonical widget types from CONTEXT.md D-01 (locked — these are the only valid values) -->

Widget type literals (discriminated on `type` field):
  'line_chart'           — time series chart; dataKey string, color optional, unit optional
  'bar_chart'            — aggregated metric by period; dataKey string, color optional, unit optional
  'kpi_tile'             — single metric with trend; dataKey string, unit optional, format enum('number','percent','duration')
  'table'                — list of recent sessions/entries; columns array of {key,label}
  'athlete_list'         — coach's linked athletes with last activity; filter enum('all','active','at_risk')
  'threshold_indicator'  — metric vs target, color-coded; dataKey string, threshold number, unit optional
  'callout'              — free-text note by coach; message string, severity enum('info','warning','success')

Shared fields on EVERY widget variant:
  id: string (UUID, client-generated)
  type: (literal per variant)
  title: string
  period: z.enum(['7d','30d','90d','all']) — per D-02; default '30d'
  gridPos: { x: number, y: number, w: number, h: number } — per L-02

Root DashboardConfig shape (per L-03):
  { schema_version: 1, widgets: Widget[] }

Default widgets (per D-03 — 3-4 widgets returned when no row exists):
  Minimum: one kpi_tile + one line_chart
  Suggested defaults: kpi_tile(sessions_this_week), line_chart(weight_kg), bar_chart(sleep_duration), kpi_tile(habits_pct)

From backend/api/src/coach/ai/types.ts (type-only file pattern):
  No runtime code. All exports are `export interface` or `export type`.
  Import Zod inferred types with: export type Widget = z.infer<typeof WidgetSchema>
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create types.ts — TypeScript interfaces for the dashboard bounded context</name>
  <files>backend/api/src/coach/dashboards/types.ts</files>
  <read_first>
    - backend/api/src/coach/ai/types.ts — canonical type-only file pattern (interfaces only, no runtime code, no imports from non-type files)
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — D-01 through D-06, L-02, L-03
  </read_first>
  <action>
    Create backend/api/src/coach/dashboards/types.ts as a type-only file (no runtime code, no Zod imports).

    Export the following types:

    `WidgetType`: union literal of exactly the 7 strings: 'line_chart' | 'bar_chart' | 'kpi_tile' | 'table' | 'athlete_list' | 'threshold_indicator' | 'callout'

    `WidgetPeriod`: '7d' | '30d' | '90d' | 'all'

    `GridPos`: interface { x: number; y: number; w: number; h: number }

    `WidgetBase`: interface with shared fields: id: string; type: WidgetType; title: string; period: WidgetPeriod; gridPos: GridPos

    Per-variant config interfaces (one per widget type):
    - `LineChartConfig`: { dataKey: string; color?: string; unit?: string }
    - `BarChartConfig`: { dataKey: string; color?: string; unit?: string }
    - `KpiTileConfig`: { dataKey: string; unit?: string; format: 'number' | 'percent' | 'duration' }
    - `TableConfig`: { columns: Array<{ key: string; label: string }> }
    - `AthleteListConfig`: { filter: 'all' | 'active' | 'at_risk' }
    - `ThresholdIndicatorConfig`: { dataKey: string; threshold: number; unit?: string }
    - `CalloutConfig`: { message: string; severity: 'info' | 'warning' | 'success' }

    Per-variant widget interfaces (WidgetBase & { type: literal; config: XxxConfig }):
    - `LineChartWidget`, `BarChartWidget`, `KpiTileWidget`, `TableWidget`, `AthleteListWidget`, `ThresholdIndicatorWidget`, `CalloutWidget`

    `Widget`: discriminated union type of all 7 variant interfaces

    `DashboardConfig`: interface { schema_version: 1; widgets: Widget[] }

    `DashboardConfigRow`: interface for DB row shape { id: string; coach_id: string; client_id: string; widgets: Widget[]; updated_at: string; created_at: string }

    `CoachMemoryRow`: interface { id: string; coach_id: string; memory: { templates: unknown[]; preferences: Record<string, unknown> }; updated_at: string }
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -i "coach/dashboards/types" | head -5</automated>
  </verify>
  <acceptance_criteria>
    - File backend/api/src/coach/dashboards/types.ts exists
    - Exports: WidgetType, WidgetPeriod, GridPos, Widget (as discriminated union), DashboardConfig, DashboardConfigRow, CoachMemoryRow
    - No `import` statements with runtime values (type-only file)
    - `Widget` type is a union of 7 named interfaces, each with a `type` literal field and a type-specific `config` field
    - `DashboardConfig` has `schema_version: 1` (literal type, not `number`)
    - TypeScript compiler does not report errors in this file
  </acceptance_criteria>
  <done>types.ts exists with all 7 widget variant types, DashboardConfig, and CoachMemoryRow; tsc --noEmit reports no errors in this file.</done>
</task>

<task type="auto">
  <name>Task 2: Create schemas.ts — Zod discriminated union + default config constant</name>
  <files>backend/api/src/coach/dashboards/schemas.ts</files>
  <read_first>
    - backend/api/src/coach/dashboards/types.ts — the types this file must validate (just created in Task 1)
    - backend/api/src/coach/ai/service.ts (lines 1-10) — confirm Zod import style used in the project (`import { z } from 'zod'`)
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — D-01 (additionalProperties: false), D-02 (period enum), D-03 (default 3-4 widgets), L-02 (gridPos), L-03 (schema_version: 1 at root)
  </read_first>
  <action>
    Create backend/api/src/coach/dashboards/schemas.ts with Zod schemas.

    Import: import { z } from 'zod'
    Import types: import type { Widget, DashboardConfig } from './types.js'

    GridPosSchema: z.object({ x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().min(1).max(12), h: z.number().int().min(1) }).strict()

    PeriodEnum: z.enum(['7d', '30d', '90d', 'all']) — per D-02

    Shared base fields used in each variant (do not create a separate BaseSchema; inline them in each variant to allow .strict() on each variant individually):
    - id: z.string().uuid()
    - type: z.literal('...')
    - title: z.string().min(1).max(100)
    - period: PeriodEnum.default('30d')
    - gridPos: GridPosSchema

    Per-variant schemas (all use .strict() — enforces additionalProperties: false per D-01):
    - LineChartWidgetSchema: z.object({ id, type: z.literal('line_chart'), title, period, gridPos, config: z.object({ dataKey: z.string(), color: z.string().optional(), unit: z.string().optional() }).strict() }).strict()
    - BarChartWidgetSchema: same pattern with type: z.literal('bar_chart')
    - KpiTileWidgetSchema: config has dataKey, unit optional, format: z.enum(['number','percent','duration']).default('number')
    - TableWidgetSchema: config has columns: z.array(z.object({ key: z.string(), label: z.string() }).strict()).min(1)
    - AthleteListWidgetSchema: config has filter: z.enum(['all','active','at_risk']).default('all')
    - ThresholdIndicatorWidgetSchema: config has dataKey, threshold: z.number(), unit optional
    - CalloutWidgetSchema: config has message: z.string().min(1).max(500), severity: z.enum(['info','warning','success']).default('info')

    WidgetSchema: z.discriminatedUnion('type', [ LineChartWidgetSchema, BarChartWidgetSchema, KpiTileWidgetSchema, TableWidgetSchema, AthleteListWidgetSchema, ThresholdIndicatorWidgetSchema, CalloutWidgetSchema ])

    DashboardConfigSchema: z.object({ schema_version: z.literal(1), widgets: z.array(WidgetSchema).max(12) }).strict()

    Export a DEFAULT_WIDGETS constant of type DashboardConfig — the 3-4 widgets returned when no DB row exists (per D-03):
    - Widget 0: KpiTileWidget — id: crypto.randomUUID(), type: 'kpi_tile', title: 'Séances ce mois', period: '30d', gridPos: { x:0, y:0, w:4, h:2 }, config: { dataKey: 'sessions_count', format: 'number' }
    - Widget 1: LineChartWidget — id: crypto.randomUUID(), type: 'line_chart', title: 'Poids', period: '30d', gridPos: { x:4, y:0, w:8, h:2 }, config: { dataKey: 'weight_kg', unit: 'kg' }
    - Widget 2: KpiTileWidget — id: crypto.randomUUID(), type: 'kpi_tile', title: 'Habitudes', period: '7d', gridPos: { x:0, y:2, w:4, h:2 }, config: { dataKey: 'habits_pct', format: 'percent' }
    - Widget 3: BarChartWidget — id: crypto.randomUUID(), type: 'bar_chart', title: 'Sommeil', period: '30d', gridPos: { x:4, y:2, w:8, h:2 }, config: { dataKey: 'sleep_duration_hours', unit: 'h' }

    Note: DEFAULT_WIDGETS uses crypto.randomUUID() — this requires `import { randomUUID } from 'node:crypto'`. IDs in the default set are stable module-level constants (called once at module init), not re-generated per request. This is correct: the defaults are a template; lazy persistence (D-04) means they are never written to DB unless PUT is called.

    Export types: export type WidgetInput = z.input<typeof WidgetSchema>; export type PutDashboardBody = { widgets: z.infer<typeof WidgetSchema>[] }
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -i "coach/dashboards/schemas" | head -5</automated>
  </verify>
  <acceptance_criteria>
    - File backend/api/src/coach/dashboards/schemas.ts exists
    - Exports: WidgetSchema, DashboardConfigSchema, PeriodEnum, DEFAULT_WIDGETS
    - WidgetSchema is a z.discriminatedUnion with exactly 7 members
    - DashboardConfigSchema includes schema_version: z.literal(1)
    - Every widget variant schema uses .strict() (grep confirms: `grep -c "\.strict()" backend/api/src/coach/dashboards/schemas.ts` returns at least 8 — one per variant config + one per variant root + DashboardConfigSchema)
    - PeriodEnum = z.enum(['7d','30d','90d','all']) — 4 values, no others
    - DEFAULT_WIDGETS is a valid DashboardConfig object with 4 widgets (2 kpi_tile, 1 line_chart, 1 bar_chart)
    - TypeScript compiler does not report errors in this file
    - `WidgetSchema.parse({ type: 'unknown_type', id: '...', title: '...', period: '7d', gridPos: {...}, config: {} })` would throw ZodError (discriminated union rejects unknown type)
  </acceptance_criteria>
  <done>schemas.ts exists; tsc --noEmit reports no errors; grep -c ".strict()" returns 8+; DEFAULT_WIDGETS has 4 widgets.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| API route body → WidgetSchema.parse | Untrusted widget JSON crosses into validated domain |
| DB JSONB → DashboardConfigSchema.parse | Stored JSONB re-validated on read to catch schema drift |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Tampering | Widget JSONB — unknown fields injected | mitigate | .strict() on every variant schema; additionalProperties: false enforced at Zod layer |
| T-02-02 | Tampering | Widget type field — attacker invents 8th type | mitigate | z.discriminatedUnion with literal enum; unknown type literal fails parse with ZodError |
| T-02-03 | Information Disclosure | DEFAULT_WIDGETS IDs exposed | accept | IDs are per-session UUIDs with no PII; low-value target |
| T-02-SC | Tampering | npm/pip/cargo installs | accept | No new packages — Zod is already in backend/api/package.json |
</threat_model>

<verification>
After both tasks complete:
1. `npx tsc --noEmit -p backend/api/tsconfig.json` passes with no errors in coach/dashboards/*.ts
2. `grep -c "\.strict()" backend/api/src/coach/dashboards/schemas.ts` returns >= 8
3. `grep "z\.discriminatedUnion" backend/api/src/coach/dashboards/schemas.ts` returns 1 match
4. `grep "schema_version.*z\.literal(1)" backend/api/src/coach/dashboards/schemas.ts` returns 1 match
5. `grep -c "z\.enum\(\[" backend/api/src/coach/dashboards/schemas.ts | head -1` confirms PeriodEnum present
</verification>

<success_criteria>
- types.ts exports all 7 widget variant types, DashboardConfig with schema_version: 1, DashboardConfigRow, CoachMemoryRow
- schemas.ts exports a strict Zod discriminated union that rejects unknown widget types; DashboardConfigSchema wraps with schema_version: z.literal(1); DEFAULT_WIDGETS contains 4 valid widgets
- tsc --noEmit passes with no new errors
</success_criteria>

<output>
Create `.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-02-SUMMARY.md` when done.
</output>
