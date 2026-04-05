---
phase: 13-api-security-hardening
verified: 2026-04-03T10:18:04Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 13: API Security Hardening Verification Report

**Phase Goal:** The API enforces strict CORS, emits security headers on every response, and validates all inputs reaching Claude Sonnet — so malformed or malicious payloads are rejected before touching any AI or database layer.

**Verified:** 2026-04-03T10:18:04Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A request from `https://evil.example.com` receives a CORS rejection — wildcard `*.vercel.app` removed | VERIFIED | `app.ts` CORS origin function contains no `vercel.app` regex; grep found zero matches for `vercel\.app` in `app.ts` |
| 2 | Every response includes `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` | VERIFIED | `secureHeaders()` imported from `hono/secure-headers` and applied globally at line 42 via `app.use('*', secureHeaders())` |
| 3 | POST `/ai/chat` with malformed `messages` returns HTTP 400 — never reaches Claude Sonnet | VERIFIED | `zValidator('json', chatSchema)` wired as middleware on the route; `messageSchema` uses `.strict()` + `role: z.enum(...)` + `content: z.string()` enforcing structure before handler runs; `app.onError` catches `z.ZodError` and returns 400 |
| 4 | POST `/ai/chat` with valid payload passes validation and reaches the handler | VERIFIED | `chatSchema` accepts `messages: array(messageSchema).min(1)` and optional `conversation_id: string`; handler reads via `c.req.valid('json')` |
| 5 | POST `/ai/chat/stream` with valid payload passes validation and reaches the handler | VERIFIED | `zValidator('json', chatSchema)` wired at line 155; handler reads via `c.req.valid('json')` at line 156 |
| 6 | POST `/ai/tools/execute` with valid payload passes validation and reaches the handler | VERIFIED | `zValidator('json', toolExecuteSchema)` wired at line 139; handler reads via `c.req.valid('json')` at line 141 |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/api/src/app.ts` | CORS allowlist without `*.vercel.app`, `secureHeaders()` middleware, ZodError handler | VERIFIED | All three present; no `vercel\.app` pattern found; `secureHeaders()` at line 42; `z.ZodError` branch in `onError` at line 61 |
| `backend/api/src/routes/ai.ts` | Zod validation on all 3 POST AI routes | VERIFIED | `zValidator` on `/tools/execute` (line 139), `/chat/stream` (line 155), `/chat` (line 249); 3 `.strict()` schemas defined |
| `backend/api/package.json` | `@hono/zod-validator` in dependencies | VERIFIED | `"@hono/zod-validator": "^0.7.6"` present; package resolved in monorepo root `node_modules/@hono/zod-validator` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.ts` | `hono/secure-headers` | `import { secureHeaders }` | WIRED | Import at line 4; usage at line 42 |
| `routes/ai.ts` | `@hono/zod-validator` | `import { zValidator }` | WIRED | Import at line 6; used on 3 routes at lines 139, 155, 249 |
| `app.ts` | `routes/ai.ts` | ZodError caught in `onError` before generic 500 | WIRED | `err instanceof z.ZodError` at line 61; returns 400 with env-aware format (prod: opaque; dev: structured details) |

---

### Data-Flow Trace (Level 4)

Not applicable. This phase modifies middleware and validation — no dynamic data rendering. Validation flow is traced structurally above.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with no errors | `npx tsc --noEmit` (in `backend/api/`) | Exit 0, no errors | PASS |
| Commits documented in SUMMARY exist in git | `git log --oneline` | `88d39fc` and `1a7e0c8` both present | PASS |
| `*.vercel.app` pattern absent from CORS config | grep `vercel\.app` in `app.ts` | Zero matches | PASS |
| All 3 routes use `c.req.valid('json')` not `c.req.json()` | grep `await c\.req\.json` in `ai.ts` | Only match is `/vision/nutrition` (intentionally excluded per D-06) | PASS |
| `@hono/zod-validator` resolvable | `ls node_modules/@hono/zod-validator` | Present at monorepo root (npm workspace hoisting) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-01 | 13-01-PLAN.md | CORS restricted to explicit origins — wildcard `*.vercel.app` removed | SATISFIED | CORS `origin` function in `app.ts` allowlist: `exp://`, `localhost`, `APP_ORIGIN` env var only — no regex wildcards |
| SEC-02 | 13-01-PLAN.md | `secureHeaders()` applied globally — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS | SATISFIED | `app.use('*', secureHeaders())` at line 42 in `app.ts` |
| SEC-03 | 13-01-PLAN.md | Input validation via `zValidator` on `/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute` — Zod schemas before Claude Sonnet | SATISFIED | `zValidator('json', chatSchema)` on 2 chat routes; `zValidator('json', toolExecuteSchema)` on tools route; all with `.strict()` |

No orphaned requirements. All SEC-01, SEC-02, SEC-03 requirements mapped and satisfied.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern checked | Result |
|------|-----------------|--------|
| `app.ts` | TODO/FIXME/placeholder comments | None |
| `app.ts` | Empty implementations | None — all middleware is real (cors, secureHeaders, ipRateLimiter, onError) |
| `routes/ai.ts` | `await c.req.json` in validated handlers | Only in `/vision/nutrition` which is intentionally excluded per D-06 |
| `routes/ai.ts` | Missing `.strict()` on schemas | All 3 schemas (`messageSchema`, `chatSchema`, `toolExecuteSchema`) use `.strict()` |

---

### Human Verification Required

The following items need a live API to fully confirm but are not blocking — code-level evidence is conclusive:

#### 1. CORS rejection produces correct HTTP response

**Test:** `curl -v -H "Origin: https://evil.example.com" http://localhost:3000/health`
**Expected:** Response does NOT include `Access-Control-Allow-Origin: https://evil.example.com`
**Why human:** Requires running API server; CORS behavior depends on request type (preflight vs simple)

#### 2. Security headers present on every response

**Test:** `curl -I http://localhost:3000/health`
**Expected:** Response includes `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`
**Why human:** Requires running API server; actual header values from `secureHeaders()` defaults need live confirmation

#### 3. Validation rejection on malformed payload returns 400

**Test:** `curl -X POST http://localhost:3000/ai/chat -H "Content-Type: application/json" -H "Authorization: Bearer <valid_token>" -d '{"messages":[{"wrong":"field"}]}'`
**Expected:** HTTP 400 with structured error body
**Why human:** Requires authenticated request with valid Supabase token

---

### Summary

Phase 13 goal is achieved. All three security requirements are implemented correctly in the codebase:

**SEC-01 (CORS lockdown):** The `*.vercel.app` wildcard regex has been entirely removed from `app.ts`. The CORS allowlist now contains only: `exp://` (Expo dev client), `localhost` patterns, and the explicit `APP_ORIGIN` env var — applied only when defined, preventing the empty-string bypass.

**SEC-02 (Security headers):** `secureHeaders()` from `hono/secure-headers` is imported and applied globally via `app.use('*', secureHeaders())` in the middleware chain, positioned after CORS and before the IP rate limiter. Every response will include the required security headers.

**SEC-03 (Input validation):** Three Zod schemas are defined with `.strict()`: `messageSchema` (role enum + content string), `chatSchema` (messages array min 1 + optional conversation_id), and `toolExecuteSchema` (tool_name string + optional parameters record). `zValidator('json', schema)` is wired as inline middleware on all three target routes. Validated handlers use `c.req.valid('json')` instead of `c.req.json()`. A `ZodError` handler in `app.onError` returns 400 with env-appropriate error format (structured in dev, opaque in production). The `z.record(z.string(), z.unknown())` two-argument pattern correctly handles Zod v4 compatibility.

TypeScript compiles with zero errors. Both implementation commits (`88d39fc`, `1a7e0c8`) verified in git history.

---

_Verified: 2026-04-03T10:18:04Z_
_Verifier: Claude (gsd-verifier)_
