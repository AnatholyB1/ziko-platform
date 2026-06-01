---
phase: 01-db-api-foundation
plan: 5
type: execute
wave: 3
depends_on:
  - "01-01"
  - "01-03"
  - "01-04"
files_modified: []
autonomous: false

requirements:
  - INFRA-01
  - INFRA-02a
  - INFRA-03
  - INFRA-04
  - DASH-04

must_haves:
  truths:
    - "supabase db push completes without error"
    - "Table dashboard_configs exists in the live Supabase project with correct columns and RLS"
    - "Table coach_memory exists in the live Supabase project with correct columns and RLS"
    - "GET /coach/dashboards/:clientId returns { schema_version: 1, widgets: [...] } for a valid JWT"
    - "PUT /coach/dashboards/:clientId with an invalid widget type returns 400 with a ZodError message"
    - "GET /coach/clients/:clientId/widget-data?type=kpi_tile&period=30d&dataKey=sessions_count returns { value: number, label: string }"
  artifacts:
    - path: "supabase/migrations/054_dashboard_widgets.sql"
      provides: "Applied migration — both tables exist in live DB"
      contains: "dashboard_configs"
  key_links:
    - from: "supabase db push"
      to: "dashboard_configs table"
      via: "migration 054 applied"
      pattern: "dashboard_configs"
---

<objective>
Push migration 054 to the live Supabase project and verify all Phase 01 success criteria against the running API. This is the blocking gate — the phase cannot be marked complete until the DB schema exists and the routes respond correctly.

Purpose: TypeScript types and Zod schemas can appear correct without a schema push, but the tables won't exist and every DB call will return Supabase "relation does not exist" errors at runtime.
Output: Both tables exist in Supabase; all 4 Phase 01 success criteria pass.
</objective>

<execution_context>
@/home/.claude/get-shit-done/workflows/execute-plan.md
@/home/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/custom-widget/ROADMAP.md
@.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: TypeScript type-check across all modified files</name>
  <files></files>
  <read_first>
    - backend/api/src/coach/dashboards/types.ts
    - backend/api/src/coach/dashboards/schemas.ts
    - backend/api/src/coach/dashboards/db.ts
    - backend/api/src/coach/dashboards/service.ts
    - backend/api/src/app.ts
    - backend/api/src/coach/clients/service.ts
  </read_first>
  <action>
    Run TypeScript type check across the backend package to confirm all Phase 01 files compile without errors:
    cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json

    If errors exist in any coach/dashboards/* file or in the modified app.ts or clients/service.ts, fix them before proceeding to the schema push. Do not fix pre-existing errors in unrelated files — only fix errors in Phase 01 files.

    Common issues to watch for:
    - Missing .js extension on relative imports (TypeScript ESM requires .js extension even for .ts files)
    - Type mismatch between Widget[] (from types.ts) and the raw JSONB returned from Supabase (cast with `as Widget[]`)
    - PeriodEnum used as a type before it's imported — ensure import { PeriodEnum } from './schemas.js' is present where needed
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -E "coach/dashboards|coach/clients/service" | grep -v "error TS" | head -5; cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -E "coach/dashboards|coach/clients/service" | grep "error TS" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit -p backend/api/tsconfig.json` exits 0 OR any errors are in pre-existing files unrelated to Phase 01 (grep for "coach/dashboards" returns 0 errors)
    - All 6 Phase 01 files exist and are syntactically valid TypeScript
  </acceptance_criteria>
  <done>tsc --noEmit reports zero errors in Phase 01 files.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: [BLOCKING] Push migration 054 to Supabase</name>
  <what-built>Migration file supabase/migrations/054_dashboard_widgets.sql has been written. It must now be pushed to the live Supabase project before the API can use the new tables.</what-built>
  <how-to-verify>
    Run the following command from the project root:

      supabase db push

    If prompted for confirmation, type `y`.

    If `SUPABASE_ACCESS_TOKEN` is not set in your shell, export it first:
      export SUPABASE_ACCESS_TOKEN=your_token_here
      supabase db push

    After the push completes, verify the tables exist:
      supabase db psql -c "\dt public.dashboard_configs"
      supabase db psql -c "\dt public.coach_memory"

    Both commands should return the table definition. If either table is missing, the migration did not apply — check the output of `supabase db push` for errors and re-run.

    Expected successful push output contains: "Applying migration 054_dashboard_widgets.sql"
  </how-to-verify>
  <resume-signal>Type "pushed" after supabase db push succeeds and both tables are confirmed, or describe the error if it failed.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Smoke-test all Phase 01 success criteria</name>
  <files></files>
  <read_first>
    - .planning/workstreams/custom-widget/ROADMAP.md — Phase 01 success criteria (4 must-be-TRUE tests)
    - .planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md — D-01 through D-04 (what each route should return)
  </read_first>
  <action>
    With the API running locally (npm run backend from project root or backend/api/ dir), run these smoke tests:

    Test 1 — GET /coach/dashboards/:clientId returns defaults for unknown pair:
      curl -s -H "Authorization: Bearer $TEST_JWT" "http://localhost:3000/coach/dashboards/$TEST_CLIENT_ID" | jq '.schema_version, (.widgets | length)'
    Expected: `1` and `4` (schema_version=1, 4 default widgets)

    Test 2 — PUT /coach/dashboards/:clientId with invalid type returns 400:
      curl -s -X PUT -H "Authorization: Bearer $TEST_JWT" -H "Content-Type: application/json" \
        -d '{"widgets":[{"id":"test","type":"invalid_type","title":"x","period":"30d","gridPos":{"x":0,"y":0,"w":4,"h":2},"config":{}}]}' \
        "http://localhost:3000/coach/dashboards/$TEST_CLIENT_ID" | jq '.error'
    Expected: non-null string containing ZodError or validation message

    Test 3 — GET /coach/clients/:clientId/widget-data for kpi_tile:
      curl -s -H "Authorization: Bearer $TEST_JWT" \
        "http://localhost:3000/coach/clients/$TEST_CLIENT_ID/widget-data?type=kpi_tile&period=30d&dataKey=sessions_count" | jq 'keys'
    Expected: ["label","value"] or ["label","trend","value"]

    Test 4 — GET /coach/clients/:clientId/widget-data with unknown type returns 400:
      curl -s -H "Authorization: Bearer $TEST_JWT" \
        "http://localhost:3000/coach/clients/$TEST_CLIENT_ID/widget-data?type=unknown_type&period=30d" | jq '.error'
    Expected: string starting with "Unknown widget type"

    Test 5 — GET /coach/dashboards/memory returns 200 (not 404 — confirms /memory is registered before /:clientId):
      curl -s -H "Authorization: Bearer $TEST_JWT" "http://localhost:3000/coach/dashboards/memory" | jq 'has("memory")'
    Expected: `true`

    If any test fails, investigate the relevant route handler or DB function and fix before marking done.

    If $TEST_JWT and $TEST_CLIENT_ID are not available locally, document which tests were verified and which could not be run, with the reason.
  </action>
  <verify>
    <automated>cd /c/ziko-platform && npx tsc --noEmit -p backend/api/tsconfig.json 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - Test 1: GET /coach/dashboards/:clientId returns JSON with schema_version=1 and widgets array of 4 items for a new coach+client pair
    - Test 2: PUT with invalid widget type returns HTTP 400 with error message (not 500)
    - Test 3: GET /widget-data?type=kpi_tile returns JSON with `value` and `label` keys
    - Test 4: GET /widget-data?type=unknown returns HTTP 400
    - Test 5: GET /coach/dashboards/memory returns JSON with `memory` key (not treated as clientId param)
    - tsc --noEmit exits 0 with zero errors in Phase 01 files
  </acceptance_criteria>
  <done>All 5 smoke tests pass; migration 054 applied; Phase 01 success criteria met.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| supabase db push → live DB | Migration applies DDL to production Supabase; irreversible once applied |
| smoke test JWT | Test JWTs must be real Supabase-issued tokens; mock tokens will be rejected by authMiddleware |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | Migration applied out of order | mitigate | File named 054_; supabase cli checks sequence before applying |
| T-05-02 | Denial of Service | Migration fails mid-apply leaving partial tables | mitigate | SET LOCAL lock_timeout = '5s' + IF NOT EXISTS guards; safe to re-run |
| T-05-SC | Tampering | No new npm installs in this plan | accept | Verification only — no package installs |
</threat_model>

<verification>
Phase 01 is complete when ALL of the following are true:
1. `supabase db psql -c "\dt public.dashboard_configs"` shows the table
2. `supabase db psql -c "\dt public.coach_memory"` shows the table
3. `npx tsc --noEmit -p backend/api/tsconfig.json` exits 0 (or errors only in pre-existing unrelated files)
4. GET /coach/dashboards/:clientId returns { schema_version: 1, widgets: [...] }
5. PUT /coach/dashboards/:clientId with { widgets: [{ type: 'bad_type', ... }] } returns 400
6. GET /coach/clients/:clientId/widget-data?type=kpi_tile returns { value, label }
7. GET /coach/dashboards/memory returns { memory: { templates: [], preferences: {} } } (not 404)
</verification>

<success_criteria>
Migration 054 applied; dashboard_configs and coach_memory tables exist with RLS. All 4 Phase 01 ROADMAP success criteria pass against a live API + DB.
</success_criteria>

<output>
Create `.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-05-SUMMARY.md` when done.
</output>
