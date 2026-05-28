---
phase: 03-ai-edit-session
plan: 02
subsystem: api
tags: [hono, sse, streamText, vercel-ai-sdk, dashboard, tools, credits]

requires:
  - phase: 03-ai-edit-session/03-01
    provides: buildDashboardSDKTools factory — 4 dashboard mutation tools (add/update/remove/reorder)
  - phase: 01-db-api-foundation
    provides: dashboardsRouter, WidgetSchema, Widget types, creditGate middleware
provides:
  - POST /coach/dashboards/:clientId/ai-edit SSE endpoint with dashboard tool execution
  - Multi-turn conversation persistence via appendMessages on result.response
  - Scoped system prompt enforcing dashboard-only tool use
affects: [03-03-DashboardEditOverlay, 03-04-ai-edit-proxy-route]

tech-stack:
  added: []
  patterns:
    - "streamText + onStepFinish for atomic tool_result SSE emission (never from text-delta)"
    - "streamWriter reference pattern: captured outside stream() callback, assigned inside, used in onStepFinish closure"
    - "result.response awaited in finally block for reliable appendMessages on all turns including tool-call turns"

key-files:
  created: []
  modified:
    - backend/api/src/coach/dashboards/service.ts

key-decisions:
  - "streamWriter typed as any to avoid hono/streaming internal type mismatch (StreamingApi vs SSEStreamingApi)"
  - "appendMessages called with both incoming user messages + response.messages to ensure full history (user msgs not in response.messages)"
  - "onStepFinish closure captures streamWriter ref — avoids passing stream instance through streamText options"
  - "stepCountIs(2) per PITFALLS #13 / L-07 — one tool step + one confirmation per turn"

requirements-completed: [INFRA-02b, EDIT-02, EDIT-05]

duration: 15min
completed: 2026-05-28
---

# Phase 03 Plan 02: AI Edit Session — SSE Endpoint Summary

**SSE endpoint `POST /ai-edit` streams Claude tool calls as atomic `tool_result` events using `onStepFinish`, with scoped dashboard-only system prompt and per-turn `appendMessages` persistence via `result.response`**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-28T00:00:00Z
- **Completed:** 2026-05-28T00:15:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `POST /:clientId/ai-edit` route appended to `dashboardsRouter` with `creditCheck('coach_chat')` + `creditDeduct('coach_chat')` middleware
- `streamText` configured with `buildDashboardSDKTools(currentWidgets)` per-request factory, `stopWhen: stepCountIs(2)`, and `onStepFinish` for atomic `tool_result` SSE emission
- `appendMessages` called in a `finally` block via `await result.response` — reliably persists all turns including tool-call-only turns (PITFALLS #2 cleared)
- Scoped system prompt with scope guard: "For coaching questions, ask the coach to close the editor first" (EDIT-05 / D-15)

## Task Commits

1. **Task 1: Add POST /:clientId/ai-edit route to dashboardsRouter** — `69a03ac` (feat)

## Files Created/Modified

- `backend/api/src/coach/dashboards/service.ts` — Added 10 imports + 110-line `/:clientId/ai-edit` route handler

## Decisions Made

- **streamWriter as `any`:** `hono/streaming` exports `StreamingApi` type but the actual returned type from `stream()` callback is `SSEStreamingApi` — using `any` avoids a TS2322 type mismatch without adding a brittle cast
- **Dual message persistence strategy:** `result.response.messages` from Vercel AI SDK v6 contains assistant + tool messages but NOT the incoming user messages (those come from the request body); both sets are passed to `appendMessages` to ensure complete conversation history
- **`onStepFinish` closure over `streamWriter`:** The `streamWriter` ref is set synchronously before `result.fullStream` is iterated, so `onStepFinish` callbacks (which fire during iteration) see a non-null writer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: `StreamingApi` not exported from `hono/streaming`**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** Type annotation `{ write: (data: string) => Promise<void> }` was incompatible with `StreamingApi.write()` which returns `Promise<StreamingApi>`. Then `type StreamingApi` does not exist in `hono/streaming` (correct name is `SSEStreamingApi`).
- **Fix:** Changed `streamWriter` type to `any` to avoid brittleness with hono internal type names
- **Files modified:** `backend/api/src/coach/dashboards/service.ts`
- **Verification:** `tsc --noEmit` reports 0 errors
- **Committed in:** `69a03ac`

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type mismatch)
**Impact on plan:** No scope change. Pure type annotation fix; runtime behavior unchanged.

## Issues Encountered

None beyond the TypeScript type annotation fix above.

## Known Stubs

None — no placeholder values, hardcoded empty arrays, or TODO markers in the implementation.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. `T-03-05` (JWT gating) is satisfied by `authMiddleware` on `dashboardsRouter.use('*', ...)` inherited from prior routes.

## Next Phase Readiness

- `POST /coach/dashboards/:clientId/ai-edit` is live and TypeScript-clean
- Ready for Plan 03-03: `DashboardEditOverlay` frontend component (SSE client consuming `meta`, `chunk`, `tool_result`, `[DONE]` events)
- Ready for Plan 03-04: Next.js proxy route `/api/coach/dashboards/[clientId]/ai-edit` to forward to Hono

---
*Phase: 03-ai-edit-session*
*Completed: 2026-05-28*
