# Phase 12: Infra + Rate Limiting - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Provision Upstash Redis and add rate limiting middleware to the Hono API. Two layers:
1. **IP-keyed global limiter** — protects all routes against unauthenticated floods (except exempted routes)
2. **userId-keyed per-route limiters** — enforces per-user quotas on AI chat, tools/execute, and barcode scan

This phase does NOT include CORS hardening, security headers, or Zod validation (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Rate Limit Thresholds

- **D-01:** Global unauthenticated IP limit — **200 requests per 60 seconds** per IP. 429 on the 201st request.
- **D-02:** Authenticated AI chat limit (`/ai/chat` + `/ai/chat/stream`) — **20 POST requests per 60 minutes** per userId. 429 on the 21st.
- **D-03:** Authenticated tools limit (`/ai/tools/execute`) — **30 POST requests per 60 minutes** per userId. 429 on the 31st.
- **D-04:** Barcode scan limit — **same config as AI chat: 20 per 60 minutes** per userId (barcode is cheaper than AI but reuses the same limiter config).
- **D-05:** Auth brute-force (RATE-05) — **DEFERRED**: Supabase handles auth directly from the mobile app; the Hono API has no `/auth/*` routes. RATE-05 is satisfied by Supabase's built-in rate limiting. No Hono proxy route needed.

### Window Algorithm

- **D-06:** All limiters use **`slidingWindow`** from `@upstash/ratelimit` — smooth, no boundary spike, accurate. 2 Redis ops per check (acceptable cost on Upstash free tier).

### 429 Response Format

- **D-07:** 429 body is **flat JSON** — `{ "error": "Rate limit exceeded", "retryAfter": <seconds> }` where `retryAfter` is an integer (seconds until window resets).
- **D-08:** `Retry-After` header uses **seconds integer** format — RFC 7231 compliant, easiest for mobile clients to parse and show countdown UI.

### Route Exemptions (global IP limiter bypass)

- **D-09:** The following routes skip the global IP rate limiter entirely:
  - `GET /health` — health check, must never 429
  - `GET /plugins` and all `/supplements/categories`, `/supplements/brands`, `/supplements/search` — public read-only catalog, no auth required
  - All `/webhooks/*` — Supabase calls these server-side; blocking breaks DB triggers
  - All `/supplements/cron/*` and `/storage/cron/*` — already protected by `CRON_SECRET`; a rate limit would break scheduled jobs
- **D-10:** Per-user limiters (D-02, D-03, D-04) apply only to their specific routes — they do not stack on top of each other.

### Infrastructure

- **D-11:** Use `@upstash/ratelimit` + `@upstash/redis` packages (HTTP-based, works on Vercel serverless). Do NOT use `hono-rate-limiter` with MemoryStore — silently useless after cold start.
- **D-12:** Upstash Redis provisioning is a **manual prerequisite** — create database on Upstash console, copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to local `.env` and Vercel environment before any code is written.
- **D-13:** Middleware insertion order in `app.ts`: `logger → cors → ipRateLimiter → [route mounts] → authMiddleware (per-router) → userRateLimiter (per-route) → handler`
- **D-14:** Rate limit key selection: `userId` (authenticated routes) > `x-real-ip` (Vercel-set header for IP) > `x-forwarded-for` (last resort only — never use as primary on Vercel, egress proxy collapses all users).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Rate Limiting — RATE-01 through RATE-05 acceptance criteria
- `.planning/ROADMAP.md` §Phase 12 — Success Criteria (exact request counts: 200 global, 20 chat, 30 tools)

### Existing Backend Code
- `backend/api/src/app.ts` — current middleware stack and route mounts (insertion point for ipRateLimiter)
- `backend/api/src/middleware/auth.ts` — authMiddleware pattern (compose with userRateLimiter)
- `backend/api/src/routes/supplements.ts` — cron CRON_SECRET pattern (reference for cron exemption)
- `backend/api/package.json` — current dependencies (add @upstash/ratelimit, @upstash/redis here)

No external specs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authMiddleware` (`backend/api/src/middleware/auth.ts`) — sets `c.set('auth', { userId })` — userId available to userRateLimiter via `c.get('auth').userId`
- `cors` middleware already applied globally — ipRateLimiter must be added AFTER cors (preflight OPTIONS must not hit rate limiter)
- Cron CRON_SECRET pattern in `supplements.ts` — reference for exempting cron routes

### Established Patterns
- Hono middleware: `app.use('*', middleware)` for global; `router.use('*', middleware)` for per-router
- All AI routes go through `aiRouter` which already applies `authMiddleware` — userRateLimiter slots in per-route
- Route mounting order in `app.ts` lines 43–48: ai, plugins, webhooks, bugs, supplements, pantry

### Integration Points
- `app.ts` — add `ipRateLimiter` middleware after `cors`, before route mounts
- `routes/ai.ts` — add `userRateLimiter` per route (POST /chat, POST /chat/stream, POST /tools/execute)
- New `middleware/rateLimiter.ts` file — export `createIpLimiter()`, `createUserLimiter(limit, window)`, and a `rateLimitMiddleware` factory
- `backend/api/.env` + Vercel env — add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

</code_context>

<specifics>
## Specific Ideas

- Barcode scan and AI chat reuse the same limiter config (20/60min) — single factory call, consistent behavior
- RATE-05 (auth brute-force) is satisfied by Supabase's built-in protections — no Hono route needed, requirement considered closed
- `retryAfter` in response body mirrors `Retry-After` header exactly — mobile client reads one source of truth

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-infra-rate-limiting*
*Context gathered: 2026-04-02*
