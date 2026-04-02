---
phase: 12-infra-rate-limiting
plan: 02
subsystem: infra
tags: [rate-limiting, hono, middleware, app.ts, ai-routes]

# Dependency graph
requires:
  - 12-01 (ipRateLimiter + createUserRateLimiter from middleware/rateLimiter.ts)
provides:
  - Global IP rate limiting active on all non-exempt routes
  - Per-user rate limiting on all AI POST endpoints
affects: [routes/ai.ts, app.ts, RATE-01, RATE-02, RATE-03, RATE-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Middleware-chain pattern: router.post('/route', limiterMiddleware, async (c) => { ... })"
    - "Shared limiter instance for /chat and /chat/stream (same Redis prefix = shared quota per D-02)"
    - "Global IP limiter inserted between cors and health check per D-13"

key-files:
  created: []
  modified:
    - backend/api/src/app.ts
    - backend/api/src/routes/ai.ts

key-decisions:
  - "ipRateLimiter placed after cors to allow preflight OPTIONS through without consuming IP quota"
  - "aiChatLimiter shared between /chat and /chat/stream — same Redis prefix 'rl:ai-chat' enforces 20/60min across both per D-02"
  - "Each route gets exactly one user limiter — no stacking per D-10"
  - "RATE-05 satisfied by Supabase built-in auth rate limiting — no Hono implementation needed per D-05"

# Metrics
duration: 8min
completed: 2026-04-02
---

# Phase 12 Plan 02: Wire Rate Limiters Summary

**Global IP limiter wired into app.ts after cors; per-user limiters on all four AI POST routes via middleware-chain pattern**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-04-02T22:19:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `ipRateLimiter` inserted into `app.ts` global middleware chain at position: `logger -> cors -> ipRateLimiter -> health check -> route mounts`
- `createUserRateLimiter` imported in `routes/ai.ts`; three limiter instances created after `authMiddleware`
- All four AI POST routes protected with per-user sliding window limiters:
  - `POST /chat` and `POST /chat/stream` share `aiChatLimiter` (20 req/60min, prefix `rl:ai-chat`)
  - `POST /tools/execute` uses `aiToolsLimiter` (30 req/60min, prefix `rl:ai-tools`)
  - `POST /vision/nutrition` uses `barcodeScanLimiter` (20 req/60min, prefix `rl:barcode`)
- `GET /tools` unchanged — read-only schema endpoint, no limiter needed
- TypeScript compiles with 0 errors

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1+2  | Wire ipRateLimiter into app.ts and per-user limiters into routes/ai.ts | `9997032` |

Tasks 1 and 2 were committed atomically — they form one indivisible wiring change.

## Files Modified

- `backend/api/src/app.ts` — import + `app.use('*', ipRateLimiter)` after cors block
- `backend/api/src/routes/ai.ts` — import + 3 limiter instances + middleware-chain applied to 4 routes

## Decisions Made

- Tasks 1 and 2 committed together — wiring app.ts and routes/ai.ts are both required for any rate limiting to be active; splitting would leave an incomplete state
- Middleware order preserved: `ipRateLimiter` placed immediately after cors closing paren, before `// Health check` comment — /health continues to be exempt via rateLimiter.ts EXEMPT_PATHS set (not by placement)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all limiters are fully wired and functional against the live Upstash Redis instance provisioned in Plan 01.

## Requirements Completed

- **RATE-01:** Global IP limiter active — 200 req/60s per IP, 429 on 201st for non-exempt routes
- **RATE-02:** `/ai/chat` and `/ai/chat/stream` limited to 20 POST/60min per userId
- **RATE-03:** `/ai/tools/execute` limited to 30 POST/60min per userId
- **RATE-04:** `/ai/vision/nutrition` limited to 20 POST/60min per userId
- **RATE-05:** Satisfied by Supabase built-in auth rate limiting (D-05, no Hono code needed)

---
*Phase: 12-infra-rate-limiting*
*Completed: 2026-04-02*
