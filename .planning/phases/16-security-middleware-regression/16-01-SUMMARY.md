---
phase: 16-security-middleware-regression
plan: 01
status: completed
completed_at: "2026-04-05"
provides: [RATE-01, SEC-01, SEC-02, SEC-03]
files_modified:
  - backend/api/src/app.ts
subsystem: backend/api
tags: [security, middleware, cors, rate-limiting, headers, zod]
dependency_graph:
  requires: []
  provides: [RATE-01, SEC-01, SEC-02, SEC-03]
  affects: [backend/api/src/app.ts]
tech_stack:
  added: []
  patterns:
    - secureHeaders() from hono/secure-headers applied globally before routes
    - ipRateLimiter (Upstash Redis sliding window) applied globally after CORS+headers
    - Conditional APP_ORIGIN push — no empty-string bypass
    - ZodError branch in onError returning structured 400 JSON
key_files:
  created: []
  modified:
    - backend/api/src/app.ts
decisions:
  - ".errors does not exist on ZodError<unknown> in the installed Zod v4 — switched to .issues (same data, correct API)"
metrics:
  duration: "< 5 minutes"
  completed_date: "2026-04-05"
  tasks_completed: 1
  files_modified: 1
---

# Phase 16 Plan 01: Security Middleware Regression — Summary

**One-liner:** Restored four middleware items dropped by the Phase 15 stale-template commit — ipRateLimiter (RATE-01), strict CORS without *.vercel.app wildcard (SEC-01), secureHeaders() (SEC-02), and ZodError 400 handler (SEC-03).

## What Was Restored

The Phase 15 commit (`7100859`) replaced `backend/api/src/app.ts` with a stale template that correctly added `storageCleanupRouter` but silently reverted all Phase 12 and Phase 13 middleware. This plan performed a targeted restoration of exactly those four items.

### Changes Applied to `backend/api/src/app.ts`

1. **Three new imports added** after `import { handle } from 'hono/vercel'`:
   - `import { secureHeaders } from 'hono/secure-headers'`
   - `import { ipRateLimiter } from './middleware/rateLimiter.js'`
   - `import { z } from 'zod'`

2. **CORS block fixed (SEC-01):** Removed `*.vercel.app` regex and the `APP_ORIGIN ?? ''` empty-string fallback (which allowed `origin === ''` to pass). Replaced with a conditional push: `if (process.env.APP_ORIGIN) { allowed.push(process.env.APP_ORIGIN); }`.

3. **Middleware re-added after CORS (SEC-02, RATE-01):**
   ```
   app.use('*', secureHeaders());
   app.use('*', ipRateLimiter);
   ```
   Order: `logger → cors → secureHeaders → ipRateLimiter → routes`

4. **ZodError handler restored (SEC-03):** `app.onError` now checks `err instanceof z.ZodError` first, returning `{ error: 'Validation error', details: err.issues }` with HTTP 400.

## Deviation from Plan

**[Rule 1 - Bug] Used `.issues` instead of `.errors` for Zod v4 compatibility**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** Plan specified `err.errors` but the installed Zod version (v4) exposes `.issues`; `.errors` does not exist on `ZodError<unknown>`, causing TS2339.
- **Fix:** Changed `err.errors` to `err.issues` — same array of `ZodIssue` objects, correct Zod v4 API.
- **Files modified:** `backend/api/src/app.ts` (same task, same commit)
- **Commit:** `881122a`

## TypeScript Compilation

`cd backend/api && npx tsc --noEmit` — **exited 0, no errors.**

## Requirements Satisfied

| ID | Description | Status |
|----|-------------|--------|
| RATE-01 | Global IP rate limiter (200 req/60s) active on all routes | Restored |
| SEC-01 | Strict CORS — no *.vercel.app wildcard, no empty-string bypass | Restored |
| SEC-02 | secureHeaders() applied globally | Restored |
| SEC-03 | ZodError returns HTTP 400 with structured details | Restored |

## Self-Check: PASSED

- `backend/api/src/app.ts` — file exists and contains all required patterns
- Commit `881122a` — verified via `git rev-parse --short HEAD`
- TypeScript: 0 errors
