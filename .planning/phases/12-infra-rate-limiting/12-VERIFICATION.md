---
phase: 12-infra-rate-limiting
verified: 2026-04-02T22:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Confirm UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are loaded into Vercel environment (production)"
    expected: "Both variables visible in Vercel dashboard under backend/api project environment"
    why_human: "Cannot query Vercel environment remotely; local .env presence is confirmed but Vercel env must be verified in dashboard"
---

# Phase 12: Infra + Rate Limiting Verification Report

**Phase Goal:** The API is protected against unauthenticated floods and per-user quota abuse — all rate-limited routes return 429 with Retry-After headers, backed by a persistent distributed Redis store that survives Vercel cold starts
**Verified:** 2026-04-02T22:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Upstash Redis connected — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN present | VERIFIED | Both vars present in `backend/api/.env`. `redis.ts` line 3–6 reads them via `process.env`. |
| 2 | Unauthenticated client gets 429 on 201st request; GET /health never 429s | VERIFIED | `rateLimiter.ts` line 6–9: `slidingWindow(200, '60 s')`. Line 13: EXEMPT_PATHS contains `'/health'`. `app.ts` line 39: `app.use('*', ipRateLimiter)`. |
| 3 | Authenticated user gets 429 on 21st POST to /ai/chat or /ai/chat/stream within 60 min | VERIFIED | `ai.ts` line 20: `createUserRateLimiter(20, '60 m', 'ai-chat')`. Applied to `/chat/stream` (line 140) and `/chat` (line 237) as second middleware arg. Shared prefix `rl:ai-chat` enforces combined quota. |
| 4 | Authenticated user gets 429 on 31st POST to /ai/tools/execute within 60 min | VERIFIED | `ai.ts` line 21: `createUserRateLimiter(30, '60 m', 'ai-tools')`. Applied at `router.post('/tools/execute', aiToolsLimiter, ...)` line 120. |
| 5 | Authenticated user gets 429 beyond quota on barcode scan (/ai/vision/nutrition) | VERIFIED | `ai.ts` line 22: `createUserRateLimiter(20, '60 m', 'barcode')`. Applied at `router.post('/vision/nutrition', barcodeScanLimiter, ...)` line 300. |
| 6 | All 429 responses have Retry-After header (integer seconds) + flat JSON body | VERIFIED | `rateLimiter.ts` lines 49–52 (IP limiter) and lines 77–79 (user limiter): `Math.ceil((reset - Date.now()) / 1000)`, `c.header('Retry-After', String(retryAfter))`, `c.json({ error: 'Rate limit exceeded', retryAfter }, 429)`. Matches D-07 and D-08 exactly. |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/api/src/lib/redis.ts` | Upstash Redis HTTP singleton | VERIFIED | 6 lines. Imports `Redis` from `@upstash/redis`, constructs singleton with env vars, exports `redis`. |
| `backend/api/src/middleware/rateLimiter.ts` | IP + user rate limiter middleware | VERIFIED | 84 lines. Exports `ipRateLimiter` (global) and `createUserRateLimiter` (factory). slidingWindow algorithm, exempt paths, correct IP key selection (x-real-ip > x-forwarded-for), correct 429 format. |
| `backend/api/src/app.ts` | Global IP limiter wired | VERIFIED | Line 11: imports `ipRateLimiter`. Line 39: `app.use('*', ipRateLimiter)` after cors block (line 17–38), before route mounts (lines 45–50). Matches D-13 insertion order. |
| `backend/api/src/routes/ai.ts` | Per-user limiters on AI routes | VERIFIED | Lines 20–22: 3 limiter instances created. Lines 120, 140, 237, 300: limiters applied as middleware-chain second argument. |
| `backend/api/package.json` | @upstash/redis + @upstash/ratelimit dependencies | VERIFIED | Line 16: `"@upstash/ratelimit": "^2.0.8"`. Line 17: `"@upstash/redis": "^1.37.0"`. |
| `backend/api/.env` | UPSTASH env vars present | VERIFIED | `UPSTASH_REDIS_REST_URL` set to `https://hardy-starling-91198.upstash.io`. `UPSTASH_REDIS_REST_TOKEN` set. Both non-empty. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.ts` | `middleware/rateLimiter.ts` | `import { ipRateLimiter }` | WIRED | Line 11 import + line 39 `app.use('*', ipRateLimiter)` |
| `rateLimiter.ts` | `lib/redis.ts` | `import { redis }` | WIRED | Line 3: `import { redis } from '../lib/redis.js'` used in both `ipLimiter` (line 6) and `createUserRateLimiter` (line 60) |
| `routes/ai.ts` | `middleware/rateLimiter.ts` | `import { createUserRateLimiter }` | WIRED | Line 6 import; lines 20–22 factory calls; lines 120, 140, 237, 300 route-level wiring |
| `redis.ts` | Upstash cloud | `UPSTASH_REDIS_REST_URL + TOKEN` | WIRED (local) | Env vars present in `.env`; Vercel production env needs human confirmation |
| `/health` route | exempt from IP limiter | `EXEMPT_PATHS Set` | WIRED | `rateLimiter.ts` line 13: `'/health'` in `EXEMPT_PATHS`; line 41: `isExempt` called before `ipLimiter.limit()` |
| `/webhooks/*` and cron routes | exempt from IP limiter | `EXEMPT_PREFIXES` | WIRED | `rateLimiter.ts` lines 20–24: `EXEMPT_PREFIXES` array with `/webhooks/`, `/supplements/cron/`, `/storage/cron/`. Line 28: prefix scan. |

---

## Data-Flow Trace (Level 4)

Not applicable — this phase delivers middleware infrastructure, not data-rendering components. No state-to-render data flow to trace.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — rate limiting behavior requires live HTTP requests against a running server with Redis; cannot verify without starting services. The code logic is fully verified at the static level above.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 12-01 | Upstash Redis provisioned and connected | SATISFIED | `redis.ts` singleton + env vars present in `.env` |
| RATE-01 | 12-01/12-02 | API returns 429 + Retry-After when IP exceeds global threshold | SATISFIED | `ipRateLimiter` wired globally in `app.ts` line 39; 200/60s sliding window |
| RATE-02 | 12-01/12-02 | API returns 429 + Retry-After on /ai/chat + /ai/chat/stream per userId | SATISFIED | `aiChatLimiter` (20/60m) applied to both routes; shared `rl:ai-chat` prefix enforces combined quota |
| RATE-03 | 12-01/12-02 | API returns 429 + Retry-After on /ai/tools/execute per userId | SATISFIED | `aiToolsLimiter` (30/60m) applied at line 120 |
| RATE-04 | 12-01/12-02 | API returns 429 + Retry-After on barcode scan per userId | SATISFIED | `barcodeScanLimiter` (20/60m) applied to `/vision/nutrition` at line 300 |
| RATE-05 | 12-CONTEXT D-05 | Auth brute-force protection | SATISFIED (deferred) | Decision D-05: Supabase handles auth directly from mobile; no Hono `/auth/*` routes exist. Supabase built-in rate limiting covers this. Documented as intentional non-implementation. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, FIXMEs, placeholder returns, empty implementations, or hardcoded stub values found in any of the 5 files inspected.

---

## Human Verification Required

### 1. Vercel Production Environment Variables

**Test:** Open Vercel dashboard → `ziko-api` project → Settings → Environment Variables. Check that `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present under Production environment.
**Expected:** Both variables visible with non-empty values matching the Upstash `hardy-starling-91198` database.
**Why human:** Cannot query Vercel environment remotely. Local `.env` is confirmed, but Vercel cold-start survival depends on these being in Vercel env, not just local `.env`.

---

## Gaps Summary

No gaps. All 6 success criteria are met by the implementation:

1. **Redis connectivity** — `redis.ts` singleton is correct; env vars are in `.env`.
2. **IP flood protection** — `ipRateLimiter` (200/60s sliding window) wired globally in `app.ts` after cors; `/health` is exempt via `EXEMPT_PATHS`.
3. **AI chat quota** — `aiChatLimiter` (20/60m) applied to both `/chat` and `/chat/stream` with shared prefix `rl:ai-chat`.
4. **Tools quota** — `aiToolsLimiter` (30/60m) applied to `/tools/execute`.
5. **Barcode scan quota** — `barcodeScanLimiter` (20/60m) applied to `/vision/nutrition`.
6. **429 response format** — flat JSON `{ "error": "Rate limit exceeded", "retryAfter": N }` with integer `Retry-After` header in both IP and user limiters.

The one item flagged for human verification (Vercel env vars) does not block phase completion — it is a deployment confirmation step, not an implementation gap.

---

_Verified: 2026-04-02T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
