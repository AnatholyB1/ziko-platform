---
phase: 12-infra-rate-limiting
plan: 01
subsystem: infra
tags: [upstash, redis, rate-limiting, hono, middleware]

# Dependency graph
requires: []
provides:
  - Upstash Redis HTTP client singleton (src/lib/redis.ts)
  - IP rate limiter middleware — 200 req/60s sliding window with exempt paths
  - createUserRateLimiter factory — configurable per-user sliding window limiters
affects: [12-02, routes/ai.ts, app.ts]

# Tech tracking
tech-stack:
  added: ["@upstash/redis", "@upstash/ratelimit"]
  patterns:
    - "Redis singleton via HTTP REST (no persistent connections, Vercel serverless safe)"
    - "Rate limiter factory pattern — one factory call per route, no stacking"
    - "Sliding window algorithm for smooth request distribution"

key-files:
  created:
    - backend/api/src/lib/redis.ts
    - backend/api/src/middleware/rateLimiter.ts
  modified:
    - backend/api/package.json
    - package-lock.json

key-decisions:
  - "Used @upstash/redis HTTP client (not ioredis) — works on Vercel serverless, no cold-start issues"
  - "slidingWindow algorithm chosen over fixedWindow to avoid boundary spike traffic"
  - "Duration type imported from @upstash/ratelimit for type-safe window parameters"
  - "Exempt paths use Set for O(1) exact matches + array prefix scan for wildcard paths"
  - "createUserRateLimiter returns middleware closure — each call creates independent limiter instance"

patterns-established:
  - "Redis singleton: import { redis } from '../lib/redis.js' for any Redis usage"
  - "User rate limiter: createUserRateLimiter(maxReqs, '60 m', 'prefix') returns Hono middleware"
  - "IP key selection: x-real-ip > x-forwarded-for[0] > 'unknown' (D-14)"

requirements-completed: [INFRA-01, RATE-01, RATE-02, RATE-03, RATE-04]

# Metrics
duration: 18min
completed: 2026-04-02
---

# Phase 12 Plan 01: Rate Limiter Infrastructure Summary

**Upstash Redis HTTP client + dual-layer Hono middleware: 200/60s IP limiter with exempt paths and configurable per-user slidingWindow limiter factory**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-02T00:00:00Z
- **Completed:** 2026-04-02T00:18:00Z
- **Tasks:** 2 (Task 0 was a human prerequisite, already complete)
- **Files modified:** 4

## Accomplishments
- Upstash Redis client singleton created and verified with PONG response
- IP rate limiter middleware with 200 req/60s sliding window and 7 exempt paths/prefixes (D-09)
- `createUserRateLimiter` factory producing per-user Hono middleware with configurable thresholds
- TypeScript compiles clean with `Duration` type from `@upstash/ratelimit`

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: Install Upstash packages, Redis client, and rate limiter middleware** - `5dde040` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `backend/api/src/lib/redis.ts` - Upstash Redis HTTP singleton, exports `redis`
- `backend/api/src/middleware/rateLimiter.ts` - Exports `ipRateLimiter` and `createUserRateLimiter` factory
- `backend/api/package.json` - Added `@upstash/redis` and `@upstash/ratelimit` dependencies
- `package-lock.json` - Updated lockfile

## Decisions Made
- Tasks 1 and 2 committed together as a single atomic unit — they form one logical change (packages enable the middleware; splitting would leave an incomplete state in git)
- `Duration` type imported from `@upstash/ratelimit` to enforce type safety on window strings — discovered at TypeScript check, auto-fixed as Rule 1 deviation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error: window parameter typed as string instead of Duration**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** `createUserRateLimiter(maxRequests, window: string, prefix)` caused TS2345 — `string` is not assignable to `Duration` type from `@upstash/ratelimit`
- **Fix:** Imported `type Duration` from `@upstash/ratelimit` and updated the parameter type
- **Files modified:** `backend/api/src/middleware/rateLimiter.ts`
- **Verification:** `npx tsc --noEmit` reports 0 errors
- **Committed in:** `5dde040` (included in task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered
- `npx tsx -e "..."` inline eval used CJS resolution and failed to find the `.js` import — resolved by using a temporary `.ts` file for the ping verification. Verification itself succeeded.

## Known Stubs
None — both files are fully functional infrastructure. No placeholder values or TODO items.

## Next Phase Readiness
- Plan 02 can now wire `ipRateLimiter` into `app.ts` (after cors, before route mounts)
- Plan 02 can call `createUserRateLimiter(20, '60 m', 'ai:chat')` on `/ai/chat` and `/ai/chat/stream`
- Plan 02 can call `createUserRateLimiter(30, '60 m', 'ai:tools')` on `/ai/tools/execute`
- Redis client is verified live against the provisioned Upstash instance

---
*Phase: 12-infra-rate-limiting*
*Completed: 2026-04-02*
