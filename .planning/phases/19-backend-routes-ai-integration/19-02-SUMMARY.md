---
phase: 19-backend-routes-ai-integration
plan: "02"
subsystem: backend/api
tags: [credits, router, token-logging, ai-telemetry, hono]
dependency_graph:
  requires: [creditService.getBalanceSummary, config/credits.DAILY_EARN_CAP, authMiddleware, 027_ai_cost_log]
  provides: [GET /credits/balance, logTokenUsage, onFinish-chat, onFinish-stream]
  affects: [backend/api/src/routes/credits.ts (new), backend/api/src/app.ts, backend/api/src/routes/ai.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget-insert, Promise.resolve-PromiseLike-wrap, router-use-auth-guard]
key_files:
  created:
    - backend/api/src/routes/credits.ts
  modified:
    - backend/api/src/app.ts
    - backend/api/src/routes/ai.ts
decisions:
  - "Promise.resolve() wraps Supabase PromiseLike insert so .catch() is available — PostgrestFilterBuilder is not a full Promise"
  - "Supabase client instantiated module-scoped in ai.ts (service key) to avoid per-request overhead — same pattern as creditGate.ts"
  - "totalUsage used in onFinish (not usage) — aggregates tokens across all 5 tool-call steps; usage is final-step only"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
requirements: [COST-02]
---

# Phase 19 Plan 02: Credits Router + Token Telemetry Summary

Credits GET /balance endpoint wired to creditService.getBalanceSummary, mounted at /credits with authMiddleware guard; logTokenUsage fire-and-forget helper added to both chat routes using totalUsage across all agent steps.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create credits router + mount in app.ts | 20491d2 | backend/api/src/routes/credits.ts (new), backend/api/src/app.ts |
| 2 | Add logTokenUsage helper + onFinish to chat routes | 47e8be6 | backend/api/src/routes/ai.ts |

## What Was Built

### Credits Router (backend/api/src/routes/credits.ts)

New Hono router providing the balance API endpoint (SC-1):
- `router.use('*', authMiddleware)` — all routes require valid JWT; unauthenticated requests get 401 before any handler executes (T-19-03)
- `GET /balance` calls `creditService.getBalanceSummary(userId)` and returns `{ balance, daily_earned, daily_cap, reset_timestamp }`
- `reset_timestamp` computed as next UTC midnight (`Date.UTC(y, m, d+1)`)
- `daily_cap` sourced from `DAILY_EARN_CAP` in `config/credits.ts`

### app.ts — Credits Mount

- Import: `import { creditsRouter } from './routes/credits.js'`
- Mount: `app.route('/credits', creditsRouter)` added after `/pantry` route

### Token Usage Logging (backend/api/src/routes/ai.ts)

Three additions:
1. **Supabase client** — module-scoped `createClient` using service key (same pattern as `creditGate.ts`), needed for server-side inserts to `ai_cost_log`
2. **`logTokenUsage(userId, modelId, totalUsage)`** — fire-and-forget insert helper; wraps Supabase `PromiseLike` in `Promise.resolve()` to access `.catch()`
3. **`onFinish` on `streamText`** (`/chat/stream`) — logs `totalUsage` after stream completes
4. **`onFinish` on `generateText`** (`/chat`) — logs `totalUsage` after non-streaming call

`/tools/execute` intentionally left without `onFinish` per D-04 — direct tool calls have zero LLM token cost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing supabase client in ai.ts**
- **Found during:** Task 2
- **Issue:** Plan stated "The `supabase` client is already instantiated at the top of ai.ts (line 24)" — but ai.ts had no supabase client. The `logTokenUsage` function requires one for inserts.
- **Fix:** Added `import { createClient } from '@supabase/supabase-js'` and module-scoped `supabase` client using same service-key pattern as `creditGate.ts`
- **Files modified:** `backend/api/src/routes/ai.ts`
- **Commit:** 47e8be6

**2. [Rule 1 - Bug] PromiseLike .catch() TypeScript error**
- **Found during:** Task 2 TypeScript check
- **Issue:** Supabase `PostgrestFilterBuilder` from `.insert()` is `PromiseLike<void>` not `Promise<void>` — `.then().catch()` chain caused TS2339 error
- **Fix:** Wrapped insert in `Promise.resolve(...)` to get full Promise with `.catch()`
- **Files modified:** `backend/api/src/routes/ai.ts`
- **Commit:** 47e8be6

## Threat Surface Scan

Threat mitigations T-19-03, T-19-04, T-19-05 implemented as specified:
- T-19-03 (Information Disclosure): `authMiddleware` on `router.use('*')` — unauthenticated requests rejected before handler
- T-19-04 (Denial of Service): Failed inserts caught and logged; do not block the AI response
- T-19-05 (Tampering): Service key used for inserts; client cannot write to `ai_cost_log` without service key

No new security surface introduced beyond what is in the plan's threat model.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/api/src/routes/credits.ts exists | FOUND |
| backend/api/src/app.ts mounts creditsRouter | FOUND (2 occurrences: import + route) |
| backend/api/src/routes/ai.ts has logTokenUsage | FOUND (3 occurrences: definition + 2 call sites) |
| onFinish count in ai.ts = 2 | FOUND (chat/stream + chat) |
| Commit 20491d2 (credits router) | FOUND |
| Commit 47e8be6 (token logging) | FOUND |
| TypeScript compiles clean | PASSED |
