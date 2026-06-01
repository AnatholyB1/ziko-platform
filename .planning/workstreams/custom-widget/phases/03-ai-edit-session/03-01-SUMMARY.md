---
phase: 03-ai-edit-session
plan: 01
subsystem: api
tags: [vercel-ai-sdk, zod, hono, dashboard, tool-handlers]

requires:
  - phase: 01-db-api-foundation
    provides: Widget discriminated union types + WidgetSchema Zod schemas

provides:
  - 4 stateless widget mutation functions (applyAddWidget, applyUpdateWidget, applyRemoveWidget, applyReorderWidgets)
  - buildDashboardSDKTools factory wrapping the 4 functions as Vercel AI SDK tool() objects

affects:
  - 03-02 (ai-edit SSE endpoint — imports buildDashboardSDKTools)
  - 03-03 (DashboardEditOverlay frontend — consumes tool_result events produced by these tools)

tech-stack:
  added: []
  patterns:
    - "widgetsRef = { current } pattern for multi-step statefulness inside stateless SSE request"
    - "jsonSchema<T>(schema as any) for inputSchema — same as buildCoachSDKTools in coach/ai/service.ts"
    - "additionalProperties: false on all 4 inputSchemas (PITFALLS #1 compliance)"

key-files:
  created:
    - backend/api/src/coach/dashboards/tools.ts
  modified: []

key-decisions:
  - "widgetsRef mutable ref captures latest array state across multi-step tool calls within one request — prevents stale closure"
  - "applyUpdateWidget only merges config sub-object — id/type/gridPos are immutable (T-03-02 threat mitigation)"
  - "applyRemoveWidget is idempotent (no throw on missing id); applyUpdateWidget throws (missing id = logic error)"
  - "applyReorderWidgets drops widgets not in ids list — ids array is the canonical new order"

patterns-established:
  - "Pure mutation helpers + factory pattern: helpers are testable in isolation, factory wires them into SDK tools"
  - "WidgetSchema.parse() in applyAddWidget enforces Zod .strict() — rejects unknown widget types and extra fields"

requirements-completed:
  - INFRA-02b
  - EDIT-02

duration: 10min
completed: 2026-05-28
---

# Phase 03 Plan 01: Dashboard Tool Handlers Summary

**4 pure widget mutation functions + buildDashboardSDKTools factory using widgetsRef for stateful multi-step AI edits**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-28T00:00:00Z
- **Completed:** 2026-05-28T00:10:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `applyAddWidget` — generates UUID if absent, validates via `WidgetSchema.parse()` (T-03-01 cleared)
- `applyUpdateWidget` — shallow-merges config sub-object only, immutable id/type/gridPos (T-03-02 cleared)
- `applyRemoveWidget` — idempotent filter (no throw on missing id)
- `applyReorderWidgets` — canonical id-list reorder, drops widgets not in ids
- `buildDashboardSDKTools` factory — `widgetsRef` pattern ensures correct multi-step state across one SSE request
- All 4 inputSchemas enforce `additionalProperties: false` (PITFALLS #1)
- No coaching tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`) — D-15 scope guard respected

## Task Commits

1. **Task 1: Implement 4 stateless widget mutation functions** - `47b6b5a` (feat)

## Files Created/Modified

- `backend/api/src/coach/dashboards/tools.ts` — 5 exports: 4 pure mutation helpers + buildDashboardSDKTools factory

## Decisions Made

- Used `widgetsRef = { current: currentWidgets }` inside factory — mutable ref avoids stale closure across tool calls in a multi-step streamText session (pre-locked D-07)
- `jsonSchema<T>(schema as any)` pattern copied from `coach/ai/service.ts` `buildCoachSDKTools` for consistency
- `additionalProperties: false` applied on the outer object of all 4 inputSchemas; nested `gridPos` object also gets `additionalProperties: false`

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `buildDashboardSDKTools` is ready to import in Plan 03-02 (`coach/dashboards/service.ts` `/ai-edit` SSE endpoint)
- `widgetsRef.current` after tool execution holds the latest array — Plan 03-02 can read it via `onStepFinish` to emit `tool_result` SSE events
- No blockers

## Self-Check

- [x] `backend/api/src/coach/dashboards/tools.ts` exists
- [x] TypeScript compiles without errors (`tsc --noEmit` clean)
- [x] Commit `47b6b5a` verified in git log
- [x] 0 coaching tool names in tools.ts
- [x] 5 occurrences of `additionalProperties: false` (4 outer + 1 gridPos nested)

## Self-Check: PASSED

---
*Phase: 03-ai-edit-session*
*Completed: 2026-05-28*
