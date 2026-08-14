---
phase: 18-credit-service-middleware
plan: "02"
subsystem: backend-credits
tags: [credits, middleware, hono, typescript, premium-bypass]
dependency_graph:
  requires: [backend/api/src/services/creditService.ts, backend/api/src/config/credits.ts]
  provides: [backend/api/src/middleware/creditGate.ts]
  affects: [backend/api/src/routes/ai.ts]
tech_stack:
  added: []
  patterns: [hono-middleware-factory, await-next-post-handler-pattern, fire-and-forget-deduction]
key_files:
  created:
    - backend/api/src/middleware/creditGate.ts
  modified:
    - backend/api/src/routes/ai.ts
decisions:
  - "creditDeduct calls await next() first so handler runs before deduction — SC5 compliance requires inspecting c.res.status after the full chain"
  - "Fire-and-forget deduction: errors logged but never fail the HTTP response already sent to the client"
  - "X-Request-Id header used as idempotency key; falls back to crypto.randomUUID() when absent"
  - "Streaming note documented: HTTP 200 set before stream completes — deduction fires on header send, matching Anthropic billing model"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 18 Plan 02: Credit Gate Middleware Summary

Hono middleware pair (creditCheck/creditDeduct) wired into AI chat routes. Free-tier users are gated by daily quota and balance; premium users bypass entirely. Deduction only fires on handler success.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create creditGate middleware pair (creditCheck + creditDeduct) | 1f06d31 | backend/api/src/middleware/creditGate.ts |
| 2 | Wire credit middleware into AI chat routes | e889b30 | backend/api/src/routes/ai.ts |

## What Was Built

### `backend/api/src/middleware/creditGate.ts`

Two exported factory functions:

**`creditCheck(action: CreditAction)`** — returns Hono middleware that gates access in priority order:
1. **PREM-02**: Queries `user_profiles.tier`. If `'premium'`, sets `creditPassThrough=true` and calls `next()` immediately — no quota check, no balance check.
2. **D-01/D-02**: Calls `creditService.getQuotaStatus(userId, action)`. If `withinFreeQuota=true`, sets `creditPassThrough=true` and calls `next()` — first-N-free daily pass-through.
3. **D-04**: If balance < cost, returns 402 with rich JSON: `{ error, balance, required, daily_used, daily_quota, earn_hint }`.
4. Otherwise sets `creditPassThrough=false` and calls `next()` — balance confirmed, deduction will follow.

**`creditDeduct(action: CreditAction)`** — returns Hono middleware that deducts after handler completes:
1. Calls `await next()` first — entire downstream chain (zValidator + handler) runs.
2. If `creditPassThrough === true` — returns without deduction (free quota or premium).
3. If `c.res.status >= 400` — returns without deduction per SC5 (no charge on failure).
4. Generates idempotency key from `X-Request-Id` header or `crypto.randomUUID()`.
5. Calls `creditService.deductCredits()` fire-and-forget with `.catch()` — deduction errors never fail the response.

Context variable extension (`declare module 'hono'`) follows the same pattern as `auth.ts`.
Supabase client follows the same pattern as `auth.ts` (service key fallback to publishable key).

### `backend/api/src/routes/ai.ts`

Added import for `creditCheck` and `creditDeduct`. Two routes modified:

```
/chat/stream: aiChatLimiter -> creditCheck('chat') -> creditDeduct('chat') -> zValidator -> handler
/chat:        aiChatLimiter -> creditCheck('chat') -> creditDeduct('chat') -> zValidator -> handler
```

Not gated (as specified):
- `GET /tools` — free schema listing
- `POST /tools/execute` — deferred to Phase 19
- `POST /vision/nutrition` — deferred to Phase 19 as creditCheck('scan')

No handler logic was modified — the middleware is purely additive.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All middleware logic is fully implemented. The `earnHint` stub from Plan 01 (`creditService.ts`) is carried through `getQuotaStatus` — it will appear in 402 responses as `'Log a workout to earn credits'`. Tracked in Plan 01 SUMMARY; Phase 20 will make it dynamic.

## Threat Flags

None. creditGate.ts is a pure middleware — no new network endpoints or auth paths introduced. The Supabase client used for tier lookup is the same server-side pattern as auth.ts (service key, no session persistence).

## Self-Check: PASSED

Files created/modified:
- FOUND: backend/api/src/middleware/creditGate.ts (commit 1f06d31)
- FOUND: backend/api/src/routes/ai.ts (commit e889b30)

Acceptance criteria verified:
- creditGate.ts exports creditCheck and creditDeduct factory functions
- declare module 'hono' with creditPassThrough: boolean present
- c.json({ error: 'insufficient_credits' ... }, 402) present (D-04)
- tier === 'premium' check present (PREM-02)
- c.get('creditPassThrough') check in creditDeduct present
- c.res.status >= 400 guard present (SC5)
- await next() in creditDeduct before status check present
- Import from '../services/creditService.js' and '../config/credits.js' present
- ai.ts imports { creditCheck, creditDeduct } from '../middleware/creditGate.js'
- /chat/stream and /chat routes contain creditCheck('chat') and creditDeduct('chat')
- /tools GET, /tools/execute POST, /vision/nutrition POST do NOT contain creditCheck
- aiChatLimiter runs before creditCheck in both chat route chains
- TypeScript: zero errors (npx tsc --noEmit --project backend/api/tsconfig.json passed)
