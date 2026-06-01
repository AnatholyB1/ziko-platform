---
phase: 02-widget-renderers
plan: 2
subsystem: apps/web
tags: [tanstack-query, hooks, data-fetching, supabase-ssr]
dependency_graph:
  requires: []
  provides: [useDashboardConfig, useWidgetData]
  affects: [widget-renderers, DashboardGrid]
tech_stack:
  added: []
  patterns: [createBrowserClient JWT, TanStack Query useQuery, URLSearchParams]
key_files:
  created:
    - apps/web/src/hooks/useDashboardConfig.ts
    - apps/web/src/hooks/useWidgetData.ts
  modified: []
decisions:
  - JWT obtained via createBrowserClient from @supabase/ssr inside queryFn (not at module scope)
  - staleTime 60s for dashboard config (layout changes infrequently), 30s for widget data
  - useWidgetData returns UseQueryResult<unknown> — each widget renderer casts internally
metrics:
  duration: ~5m
  completed: 2026-05-27
  tasks_completed: 2
  files_created: 2
---

# Phase 02 Plan 2: TanStack Query Hooks Summary

Two `'use client'` TanStack Query hooks for fetching dashboard config and per-widget data from the Phase 01 Hono API.

## What Was Built

**`useDashboardConfig(clientId)`** — queries `GET /coach/dashboards/:clientId`, returns `UseQueryResult<DashboardConfig>`. JWT fetched inside `queryFn` using `createBrowserClient` from `@supabase/ssr`. queryKey: `['dashboard-config', clientId]`, staleTime: 60s, enabled when clientId is truthy.

**`useWidgetData(clientId, type, period, dataKey)`** — queries `GET /coach/clients/:clientId/widget-data` with URLSearchParams `{ type, period, dataKey }`. Same JWT pattern. queryKey: `['widget-data', clientId, type, period, dataKey]`, staleTime: 30s, enabled when clientId and type are truthy. Exports `WidgetDataResult` helper type.

Both hooks throw `Error('Not authenticated')` when Supabase session is null, surface API errors via status code, and use `credentials: 'include'` + `Authorization: Bearer` header pattern consistent with the rest of the coach frontend.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/src/hooks/useDashboardConfig.ts` exists: YES
- `apps/web/src/hooks/useWidgetData.ts` exists: YES
- Commit `5f96397` recorded: YES
- Both hooks use `createBrowserClient` from `@supabase/ssr`: YES
- `useQuery` called in both hooks: YES
- `Authorization` header present in both hooks: YES
- `widget-data` URL present in `useWidgetData.ts`: YES
