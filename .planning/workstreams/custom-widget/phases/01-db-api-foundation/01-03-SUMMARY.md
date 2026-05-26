---
phase: 01-db-api-foundation
plan: 3
subsystem: backend/coach/dashboards
tags: [hono, supabase, rls, bounded-context, dashboard, coach-memory]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [getDashboardConfig, upsertDashboardConfig, deleteDashboardConfig, getCoachMemory, upsertCoachMemory, dashboardsRouter]
  affects: [backend/api/src/app.ts]
tech_stack:
  added: []
  patterns: [bounded-context-db, hono-router, supabase-user-client, l05-route-order]
key_files:
  created:
    - backend/api/src/coach/dashboards/db.ts
    - backend/api/src/coach/dashboards/service.ts
  modified:
    - backend/api/src/app.ts
decisions:
  - L-05 compliance: /memory routes registered before /:clientId in service.ts to prevent Hono treating "memory" as a clientId param
  - No SUPABASE_SERVICE_KEY: all DB operations use createUserClient(jwt) with user JWT
  - DEFAULT_WIDGETS fallback: getDashboardConfig returns DEFAULT_WIDGETS.widgets when no row exists
metrics:
  duration: 15min
  completed: 2026-05-26
---

# Phase 01 Plan 3: Coach Dashboards Bounded Context — db.ts + service.ts + app.ts mount

## One-liner

Hono 5-route CRUD router for `dashboard_configs` + `coach_memory` tables, with JWT-scoped Supabase data access layer and L-05-compliant route ordering.

## What Was Built

### 1. `backend/api/src/coach/dashboards/db.ts`

Data access layer with 5 exported functions:

- `getDashboardConfig(jwt, coachId, clientId)` — returns stored widgets or `DEFAULT_WIDGETS.widgets` when no row exists (`maybeSingle` fallback)
- `upsertDashboardConfig(jwt, coachId, clientId, widgets)` — validates each widget via `WidgetSchema.parse()`, upserts with `onConflict: 'coach_id,client_id'`
- `deleteDashboardConfig(jwt, coachId, clientId)` — hard delete, caller receives defaults
- `getCoachMemory(jwt, coachId)` — returns `CoachMemoryRow | null` via `maybeSingle`
- `upsertCoachMemory(jwt, coachId, memory)` — upserts with `onConflict: 'coach_id'`

All functions use `createUserClient(jwt)` — no service key.

### 2. `backend/api/src/coach/dashboards/service.ts`

Hono router with `authMiddleware` applied globally. Route order (L-05 compliance):

| Order | Method | Path         | Description                             |
|-------|--------|--------------|-----------------------------------------|
| 1     | GET    | /memory      | Returns coach memory (templates + prefs) |
| 2     | PUT    | /memory      | Upserts coach memory                    |
| 3     | GET    | /:clientId   | Returns DashboardConfig (or defaults)   |
| 4     | PUT    | /:clientId   | Validates + upserts widgets             |
| 5     | DELETE | /:clientId   | Deletes config, returns defaults        |

`schema_version: 1` appears in GET /:clientId (via `getDashboardConfig` return) and PUT /:clientId (spread with `schema_version: 1 as const`).

### 3. `backend/api/src/app.ts`

Added import and mount after `coachAiRouter`:

```typescript
import { dashboardsRouter } from './coach/dashboards/service.js';
// ...
app.route('/coach/dashboards', dashboardsRouter);
```

Note: `app.ts` was also modified by a concurrent agent (43-02) adding `exercisesRouter` — both mounts coexist correctly.

## Acceptance Criteria — All Met

- [x] `getDashboardConfig` returns `DEFAULT_WIDGETS.widgets` when `maybeSingle` returns null
- [x] `upsertDashboardConfig` uses `onConflict: 'coach_id,client_id'`
- [x] `upsertCoachMemory` uses `onConflict: 'coach_id'`
- [x] No `SUPABASE_SERVICE_KEY` usage in dashboards bounded context
- [x] `/memory` routes appear before `/:clientId` in service.ts (L-05 compliant)
- [x] `app.route('/coach/dashboards', dashboardsRouter)` — 1 match in app.ts
- [x] `schema_version` present in GET and PUT `/:clientId` handlers
- [x] `WidgetSchema.parse` appears in PUT `/:clientId`
- [x] `tsc --noEmit` clean (no errors in coach/dashboards/)

## Commit

Files landed in commit `37583ee` (feat(01-02): add voiceRouter skeleton — multi-agent concurrent commit that included dashboards files alongside retour-vocal work).

## Deviations from Plan

None — plan executed exactly as written. The commit hash differs from the expected `feat(01-03)` label because a concurrent agent (retour-vocal plan 01-02) committed the staged files as part of its own commit. The file content is identical to the plan specification.

## Threat Flags

None — no new network endpoints beyond the planned 5 routes; all protected by `authMiddleware`; RLS enforced at DB layer via user JWT.

## Self-Check: PASSED

- backend/api/src/coach/dashboards/db.ts — FOUND (git ls-files confirms)
- backend/api/src/coach/dashboards/service.ts — FOUND (git ls-files confirms)
- backend/api/src/app.ts contains `app.route('/coach/dashboards', dashboardsRouter)` — FOUND
- Commit 37583ee exists — CONFIRMED (git log --follow)
