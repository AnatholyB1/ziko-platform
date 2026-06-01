---
phase: 41-ai-context-injection
plan: "02"
subsystem: backend/coach-dashboards
tags: [insights, thresholds, ai-batch, hono, coach]
dependency_graph:
  requires:
    - 041-01 (InsightsResponse, ThresholdAlert, CoachMetricThreshold interfaces)
  provides:
    - POST /coach/dashboards/:clientId/insights
    - GET /coach/dashboards/:clientId/thresholds
    - POST /coach/dashboards/:clientId/thresholds
    - DELETE /coach/dashboards/:clientId/thresholds/:thresholdId
  affects:
    - backend/api/src/coach/dashboards/service.ts
tech_stack:
  added: []
  patterns:
    - generateText single-batch AI call (Vercel AI SDK v6)
    - Hono route registration order (L-05 pitfall prevention)
    - creditCheck/creditDeduct middleware on AI endpoint
    - Defense-in-depth: explicit coach_id+client_id scoping on DELETE + RLS
key_files:
  created: []
  modified:
    - backend/api/src/coach/dashboards/service.ts
decisions:
  - Routes registered before GET /:clientId to prevent Hono param shadowing (L-05)
  - Single generateText call for both chartInsights and narrative (D-06/D-07)
  - Threshold evaluation performed inline in insights endpoint (D-13)
  - operator validation server-side ('>' | '<') as defense layer above DB CHECK constraint
metrics:
  duration: "~8 minutes"
  completed: "2026-05-29"
  tasks_completed: 2
  files_changed: 1
---

# Phase 41 Plan 02: Insights Batch Endpoint + Threshold CRUD Summary

Five new Hono routes added to dashboardsRouter: the POST /:clientId/insights endpoint (single Claude generateText call returning chartInsights + narrative + crossedThresholds, credit-gated) and three threshold CRUD routes (GET/POST/DELETE /:clientId/thresholds) all registered before GET /:clientId to prevent route-param shadowing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add imports and insights endpoint to dashboardsRouter | c3a2bf2 | backend/api/src/coach/dashboards/service.ts |
| 2 | Add threshold CRUD routes to dashboardsRouter | 68b192d | backend/api/src/coach/dashboards/service.ts |

## What Was Built

### Task 1 — POST /:clientId/insights (backend/api/src/coach/dashboards/service.ts)

New imports added: `generateText` from 'ai', `createUserClient` from db.js (was missing from the existing import), `InsightsResponse`, `ThresholdAlert`, `CoachMetricThreshold` from `../ai/types.js`.

`buildInsightsPrompt(sport, period, chartData)` helper generates a structured French prompt instructing Claude to return strictly valid JSON with `chartInsights` (one-liner per chart key, max 80 chars) and `narrative` (max 200 chars).

`POST /:clientId/insights` route:
- Applied `creditCheck('coach_chat')` + `creditDeduct('coach_chat')` middleware
- Fetches active `coach_metric_thresholds` for (coachId, clientId, sport_type)
- Single `generateText` call with the chart data prompt
- Strips markdown fences, parses JSON with try/catch fallback to `{ chartInsights: {}, narrative: '' }`
- Evaluates threshold crossings inline: compares `chartData[metric_key]` against each threshold using `operator` ('>' or '<')
- Returns `c.json({ ...parsed, crossedThresholds } satisfies InsightsResponse)`
- Full try/catch returning 500 on error

### Task 2 — Threshold CRUD Routes (backend/api/src/coach/dashboards/service.ts)

Three routes added after the insights route, all before `dashboardsRouter.get('/:clientId'`:

**GET /:clientId/thresholds** (line 180): Lists thresholds scoped to `coach_id` + `client_id`. Optional `sport` query param chains an additional `.eq('sport_type', sport)` filter. Returns `{ thresholds: data ?? [] }`.

**POST /:clientId/thresholds** (line 207): Creates a threshold. Validates `operator` is `'>'` or `'<'` (400 if not). Validates `threshold_value` is numeric (400 if not). Inserts with `coach_id` + `client_id` from auth. Returns `{ threshold: data }`.

**DELETE /:clientId/thresholds/:thresholdId** (line 237): Deletes with triple scoping: `.eq('id', thresholdId).eq('coach_id', coachId).eq('client_id', clientId)`. This defense-in-depth ensures cross-coach deletion is impossible even if RLS were bypassed. Returns `{ deleted: true }`.

### Route Order Verification

```
L108: dashboardsRouter.post('/:clientId/insights', ...)    ← Task 1
L180: dashboardsRouter.get('/:clientId/thresholds', ...)   ← Task 2
L207: dashboardsRouter.post('/:clientId/thresholds', ...)  ← Task 2
L237: dashboardsRouter.delete('/:clientId/thresholds/:thresholdId', ...) ← Task 2
L259: dashboardsRouter.get('/:clientId', ...)              ← existing (unchanged)
```

All 4 new routes are registered before the `GET /:clientId` catch-all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Import] createUserClient not in existing dashboards/service.ts imports**
- **Found during:** Task 1
- **Issue:** `createUserClient` was exported from `./db.js` (re-exported from clients/db.js) but not imported in `service.ts`. The insights and threshold handlers need it to create a per-request Supabase client.
- **Fix:** Added `createUserClient` to the import from `./db.js` alongside the existing named imports.
- **Files modified:** backend/api/src/coach/dashboards/service.ts (line 8)
- **Commit:** c3a2bf2

## Known Stubs

None — this plan delivers backend API routes only. No UI rendering.

## Threat Flags

T-41-04 mitigated: GET /:clientId/thresholds has explicit `.eq('coach_id', coachId)` scoping — coach reads only own thresholds.
T-41-05 mitigated: POST /:clientId/thresholds validates `operator` server-side (must be '>' or '<'), complementing the DB CHECK constraint from migration 063.
T-41-07 mitigated: `creditCheck('coach_chat')` middleware applied to POST /insights — exhausted credits block Claude call.
T-41-08 mitigated: DELETE handler uses `.eq('coach_id', coachId).eq('client_id', clientId)` explicit dual scoping in addition to RLS.

## Self-Check

- [x] `backend/api/src/coach/dashboards/service.ts` contains `import { generateText }` — confirmed line 3
- [x] `backend/api/src/coach/dashboards/service.ts` contains `import { AGENT_MODEL }` — confirmed line 7
- [x] `backend/api/src/coach/dashboards/service.ts` contains `dashboardsRouter.post('/:clientId/insights'` — line 108
- [x] POST insights route appears before GET /:clientId (line 108 < line 259) — confirmed
- [x] `text.replace(/\`\`\`json\n?|\n?\`\`\`/g, '').trim()` present — confirmed
- [x] `crossedThresholds` returned in json response — confirmed (`satisfies InsightsResponse`)
- [x] `from('coach_metric_thresholds').select('*')` present — confirmed
- [x] `dashboardsRouter.get('/:clientId/thresholds'` — line 180
- [x] `dashboardsRouter.post('/:clientId/thresholds'` — line 207
- [x] `dashboardsRouter.delete('/:clientId/thresholds/:thresholdId'` — line 237
- [x] `operator must be > or <` validation in POST thresholds — confirmed
- [x] `.eq('coach_id', coachId)` in DELETE handler — confirmed
- [x] All threshold routes before GET /:clientId (lines 180, 207, 237 < 259) — confirmed
- [x] TypeScript compilation passes — `tsc --noEmit` exits 0
- [x] Commits c3a2bf2, 68b192d present in git log

## Self-Check: PASSED
