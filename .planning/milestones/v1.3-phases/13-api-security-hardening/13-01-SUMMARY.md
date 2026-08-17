---
phase: 13-api-security-hardening
plan: 01
subsystem: api
tags: [hono, zod, cors, security-headers, input-validation, zod-validator]

# Dependency graph
requires:
  - phase: 12-infra-rate-limiting
    provides: rate limiter middleware already wired into app.ts

provides:
  - CORS allowlist without *.vercel.app wildcard (SEC-01)
  - secureHeaders() middleware on every response (SEC-02)
  - Zod input validation on all 3 AI POST routes (SEC-03)
  - ZodError handler returning 400 with env-appropriate format

affects:
  - backend/api deployment (Vercel)
  - any future AI route additions

# Tech tracking
tech-stack:
  added:
    - "@hono/zod-validator ^0.7.6"
  patterns:
    - "zValidator('json', schema) inline on each POST route as second middleware arg"
    - "Strict Zod schemas (.strict()) for all AI route payloads"
    - "ZodError caught in app.onError before generic 500 — env-aware response format"
    - "APP_ORIGIN env var conditional push pattern instead of empty-string fallback"

key-files:
  modified:
    - backend/api/src/app.ts
    - backend/api/src/routes/ai.ts
    - backend/api/package.json

key-decisions:
  - "z.record(z.string(), z.unknown()) required for Zod v4 compat — z.record(z.unknown()) is 2-arg API in v4"
  - "*.vercel.app wildcard removed entirely — APP_ORIGIN must be set explicitly for preview deploys"
  - "secureHeaders() placed after CORS, before ipRateLimiter in middleware chain"
  - "zValidator inline per route (not shared middleware) — each route has different schema"

patterns-established:
  - "Input validation pattern: aiLimiter -> zValidator('json', schema) -> handler"
  - "c.req.valid('json') replaces await c.req.json() in validated handlers"

requirements-completed: [SEC-01, SEC-02, SEC-03]

# Metrics
duration: 8min
completed: 2026-04-03
---

# Phase 13 Plan 01: API Security Hardening Summary

**Hono API hardened with strict CORS allowlist (no *.vercel.app), secureHeaders() globally, and Zod .strict() validation on all three AI POST routes via @hono/zod-validator**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-03T00:00:00Z
- **Completed:** 2026-04-03
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed *.vercel.app CORS wildcard — allowlist now: exp://, localhost, APP_ORIGIN env var only
- Added secureHeaders() middleware globally — every response gets X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security
- Added Zod validation schemas (chatSchema, toolExecuteSchema) with .strict() on all 3 AI POST routes
- ZodError caught in onError handler: dev returns structured details, prod returns opaque 400
- Installed @hono/zod-validator v0.7.6

## Task Commits

Each task was committed atomically:

1. **Task 1: CORS lockdown, secureHeaders, ZodError handler in app.ts** - `88d39fc` (feat)
2. **Task 2: Zod validation on all 3 AI POST routes** - `1a7e0c8` (feat)

**Plan metadata:** (docs commit — see state update)

## Files Created/Modified

- `backend/api/src/app.ts` — CORS allowlist without *.vercel.app, secureHeaders() added, ZodError onError handler
- `backend/api/src/routes/ai.ts` — Zod schemas + zValidator on POST /chat, /chat/stream, /tools/execute
- `backend/api/package.json` — Added @hono/zod-validator dependency

## Decisions Made

- Used `z.record(z.string(), z.unknown())` for `parameters` field (Zod v4 requires 2 args for z.record — auto-fixed during TypeScript check)
- APP_ORIGIN conditional push: only added to allowlist when defined, avoids empty-string matching empty origins
- GET /ai/tools and POST /ai/vision/nutrition intentionally excluded from validation (per D-06)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] z.record(z.unknown()) incompatible with Zod v4**
- **Found during:** Task 2 (Zod validation schemas)
- **Issue:** Plan specified `z.record(z.unknown())` but Zod v4 requires 2 args: `z.record(keySchema, valueSchema)` — TypeScript error TS2554
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** backend/api/src/routes/ai.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `1a7e0c8` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minimal. Zod v4 API difference from plan's example. Equivalent behavior with correct argument count.

## Issues Encountered

None beyond the Zod v4 z.record API difference (auto-fixed above).

## User Setup Required

None — no external service configuration required. If APP_ORIGIN is not set in backend/api/.env, only exp:// and localhost origins are allowed (which is correct for dev; production Vercel deployment must set APP_ORIGIN).

## Next Phase Readiness

- All 3 SEC requirements (SEC-01, SEC-02, SEC-03) completed
- Phase 13 plan 01 is the only plan — phase fully complete
- TypeScript compiles clean
- Ready for verification: curl tests against deployed/local API

---
*Phase: 13-api-security-hardening*
*Completed: 2026-04-03*
