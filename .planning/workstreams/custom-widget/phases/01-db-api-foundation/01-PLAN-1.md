---
phase: 01-db-api-foundation
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/054_dashboard_widgets.sql
autonomous: true
requirements:
  - INFRA-01
  - DASH-04

must_haves:
  truths:
    - "Migration 054 applies without error against the live Supabase project"
    - "Table dashboard_configs exists with columns: id, coach_id, client_id, widgets (JSONB, default empty array), updated_at, created_at — and a UNIQUE constraint on (coach_id, client_id)"
    - "Table coach_memory exists with columns: id, coach_id (UNIQUE), memory (JSONB), updated_at"
    - "Both tables have RLS enabled; policy allows auth.uid() = coach_id for ALL operations"
    - "Composite index on dashboard_configs(coach_id, client_id) exists"
  artifacts:
    - path: "supabase/migrations/054_dashboard_widgets.sql"
      provides: "Supabase migration for dashboard_configs and coach_memory tables"
      contains: "dashboard_configs"
    - path: "supabase/migrations/054_dashboard_widgets.sql"
      provides: "coach_memory table definition"
      contains: "coach_memory"
  key_links:
    - from: "dashboard_configs.coach_id"
      to: "auth.users(id)"
      via: "REFERENCES with ON DELETE CASCADE"
      pattern: "REFERENCES auth\\.users\\(id\\) ON DELETE CASCADE"
    - from: "dashboard_configs RLS"
      to: "auth.uid()"
      via: "USING (auth.uid() = coach_id)"
      pattern: "auth\\.uid\\(\\) = coach_id"
---

<objective>
Write Supabase migration 054 creating the `dashboard_configs` and `coach_memory` tables with correct schema, constraints, and RLS policies — so every subsequent phase can build on a stable data layer with zero schema risk.

Purpose: Without this migration, no dashboard config can be persisted and no Phase 02 component can read real data.
Output: `supabase/migrations/054_dashboard_widgets.sql` ready for `supabase db push`.
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
@/home/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/custom-widget/ROADMAP.md
@.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md

<interfaces>
<!-- Key patterns from the canonical migration template. Read before writing 054. -->

From supabase/migrations/050_coach_ai_schema.sql (canonical template — replicate exactly):
- Header: SET LOCAL lock_timeout = '5s';
- Table definition: CREATE TABLE IF NOT EXISTS public.{table} (...)
- RLS enable: ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
- Policy: CREATE POLICY "{table}_own" ON public.{table} FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
- Index naming: idx_{table}_{purpose}
- IF NOT EXISTS on every index

From backend/api/src/coach/clients/db.ts (createUserClient pattern):
export function createUserClient(jwt: string) — uses SUPABASE_PUBLISHABLE_KEY + Bearer auth header
All coach reads MUST use this client (ARCH-03) — not the service key.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write migration 054 — dashboard_configs + coach_memory</name>
  <files>supabase/migrations/054_dashboard_widgets.sql</files>
  <read_first>
    - supabase/migrations/050_coach_ai_schema.sql — canonical migration header, table definition pattern, RLS policy naming, index naming convention; replicate exactly
    - supabase/migrations/053_referral_schema.sql — confirms 054 is the correct next number and shows any patterns added since 050
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — locked decisions L-01 through L-04, D-05, D-06
  </read_first>
  <action>
    Create supabase/migrations/054_dashboard_widgets.sql containing both tables in a single migration (per L-01).

    Start with: SET LOCAL lock_timeout = '5s';

    Table 1 — dashboard_configs:
    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
    - client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
    - widgets JSONB NOT NULL DEFAULT '[]'::jsonb — flat ordered array; schema_version at root injected by API (per L-02, L-03)
    - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    - CONSTRAINT dashboard_configs_unique UNIQUE (coach_id, client_id)
    Enable RLS. Policy "dashboard_configs_own" FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id).
    Composite index idx_dashboard_configs_lookup ON public.dashboard_configs(coach_id, client_id) IF NOT EXISTS.

    Table 2 — coach_memory:
    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE — one row per coach (per D-05)
    - memory JSONB NOT NULL DEFAULT '{"templates":[],"preferences":{}}'::jsonb — minimal placeholder per D-06; Phase 04 owns the full shape
    - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    Enable RLS. Policy "coach_memory_own" FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id).
    Index idx_coach_memory_coach ON public.coach_memory(coach_id) IF NOT EXISTS.

    Note on coach_memory column: CONTEXT.md D-06 says "minimal JSONB placeholder: { templates: [], preferences: {} }". Use a single `memory` JSONB column (not separate `preferences` + `templates` columns) so Phase 04 can evolve the shape without a column migration. The JSONB default encodes both keys.

    Do NOT add pg_jsonschema validation — deferred until schema is stable per ARCHITECTURE.md.
    Do NOT add a trigger for updated_at — the API will set it explicitly on upsert.
  </action>
  <verify>
    <automated>grep -c "dashboard_configs" supabase/migrations/054_dashboard_widgets.sql && grep -c "coach_memory" supabase/migrations/054_dashboard_widgets.sql && grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/054_dashboard_widgets.sql</automated>
  </verify>
  <acceptance_criteria>
    - File supabase/migrations/054_dashboard_widgets.sql exists
    - First line is: SET LOCAL lock_timeout = '5s';
    - Contains CREATE TABLE IF NOT EXISTS public.dashboard_configs — with id, coach_id, client_id, widgets JSONB, updated_at, created_at columns
    - dashboard_configs has CONSTRAINT dashboard_configs_unique UNIQUE (coach_id, client_id)
    - dashboard_configs widgets column: NOT NULL DEFAULT '[]'::jsonb
    - Contains CREATE TABLE IF NOT EXISTS public.coach_memory — with id, coach_id UNIQUE, memory JSONB, updated_at columns
    - coach_memory memory column default: '{"templates":[],"preferences":{}}'::jsonb
    - Both tables: ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;
    - Both tables: CREATE POLICY "{table}_own" FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id)
    - Index idx_dashboard_configs_lookup on (coach_id, client_id) with IF NOT EXISTS
    - Index idx_coach_memory_coach on (coach_id) with IF NOT EXISTS
    - No pg_jsonschema calls
    - No updated_at triggers (API manages updated_at)
  </acceptance_criteria>
  <done>Migration file written; grep confirms both table names and two ENABLE ROW LEVEL SECURITY statements present.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| auth.users → dashboard_configs | coach_id must equal auth.uid(); RLS enforces at DB level |
| auth.users → coach_memory | coach_id must equal auth.uid(); RLS enforces at DB level |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | dashboard_configs.coach_id | mitigate | RLS policy USING (auth.uid() = coach_id) — coach can only read/write own rows |
| T-01-02 | Information Disclosure | dashboard_configs — cross-coach data leak | mitigate | WITH CHECK (auth.uid() = coach_id) on every write; composite index enforces uniqueness |
| T-01-03 | Tampering | widgets JSONB column | accept | Schema validated by Zod at API layer (Plan 2); JSONB itself is untyped at DB level — acceptable for JSONB pattern |
| T-01-04 | Tampering | coach_memory.memory JSONB | accept | Low-risk placeholder in Phase 01; Zod validation added in API layer |
| T-01-SC | Tampering | No new npm/pip/cargo installs in this plan | accept | No package install — migration is SQL only |
</threat_model>

<verification>
After task completes:
1. `grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/054_dashboard_widgets.sql` returns 2
2. `grep "DEFAULT '[]'::jsonb" supabase/migrations/054_dashboard_widgets.sql` matches dashboard_configs.widgets
3. `grep "coach_memory_own" supabase/migrations/054_dashboard_widgets.sql` returns 1 match
4. File starts with `SET LOCAL lock_timeout = '5s';`
</verification>

<success_criteria>
supabase/migrations/054_dashboard_widgets.sql exists, contains both table definitions with correct RLS, and matches the canonical migration pattern from 050_coach_ai_schema.sql.
</success_criteria>

<output>
Create `.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-01-SUMMARY.md` when done.
</output>
