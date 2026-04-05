---
phase: 16-security-middleware-regression
verified: 2026-04-05T00:00:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
---

# Phase 16: Security Middleware Regression — Verification Report

**Phase Goal:** Restore the global middleware dropped from `backend/api/src/app.ts` — re-adding `ipRateLimiter` (RATE-01), strict CORS without `*.vercel.app` wildcard (SEC-01), `secureHeaders()` (SEC-02), and the `ZodError` handler in `onError` (SEC-03).
**Verified:** 2026-04-05
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `app.ts` contains `app.use('*', ipRateLimiter)` after the CORS block | VERIFIED | Line 43: `app.use('*', ipRateLimiter);` — placed after `secureHeaders()` on line 42, which itself follows the CORS block ending on line 41 |
| 2 | `app.ts` CORS allowlist has no `*.vercel.app` regex and no `?? ''` empty-string fallback | VERIFIED | Lines 24-30: allowlist contains only `/^exp:\/\//`, `/^https?:\/\/localhost/`, and the conditional `process.env.APP_ORIGIN` push. No `*.vercel.app` pattern. No `?? ''` fallback. |
| 3 | `app.ts` contains `app.use('*', secureHeaders())` | VERIFIED | Line 42: `app.use('*', secureHeaders());` — imported from `hono/secure-headers` on line 5 |
| 4 | `app.onError` contains a `z.ZodError` branch that returns HTTP 400 | VERIFIED | Lines 62-65: `if (err instanceof z.ZodError) { return c.json({ error: 'Validation error', details: err.issues }, 400); }` — `z` imported from `zod` on line 7 |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/api/src/app.ts` | VERIFIED | 78 lines, all four middleware registrations present and ordered correctly |
| `backend/api/src/middleware/rateLimiter.js` | VERIFIED | Imported on line 6 — `ipRateLimiter` is a named import from `./middleware/rateLimiter.js` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.ts` | `hono/secure-headers` | `import { secureHeaders }` + `app.use('*', secureHeaders())` | WIRED | Lines 5 and 42 |
| `app.ts` | `./middleware/rateLimiter.js` | `import { ipRateLimiter }` + `app.use('*', ipRateLimiter)` | WIRED | Lines 6 and 43 |
| `app.ts` | `zod` | `import { z }` + `err instanceof z.ZodError` | WIRED | Lines 7 and 63 |
| `app.ts` | CORS origin check | `origin` callback with `allowed` array — no wildcard, no empty fallback | WIRED | Lines 23-35 |

---

### Middleware Order

The global middleware is applied in this order (lines 19-43):

1. `logger()` — line 19
2. `cors(...)` — lines 20-41
3. `secureHeaders()` — line 42
4. `ipRateLimiter` — line 43

`ipRateLimiter` appears after the CORS block, satisfying criterion 1 exactly.

---

### TypeScript Compilation

`cd backend/api && npx tsc --noEmit` → **clean** (zero errors, zero warnings)

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments in `app.ts`. No stub returns. No hardcoded empty values in security-relevant paths.

---

### Human Verification Required

None for automated criteria. The four criteria are fully verifiable from static code inspection and TypeScript compilation.

Optional runtime checks (not blockers):

1. **Rate limiting fires at threshold** — send 100+ rapid requests to `/health` and confirm HTTP 429 responses after the limit is hit. Cannot verify without a running server.
2. **CORS rejects unknown origins** — send a preflight with `Origin: https://evil.vercel.app` and confirm the response omits `Access-Control-Allow-Origin`. Cannot verify without a running server.
3. **Secure headers present in responses** — confirm `X-Frame-Options`, `X-Content-Type-Options`, etc. appear in HTTP responses. Cannot verify without a running server.

---

## Summary

All four success criteria are satisfied in `backend/api/src/app.ts`:

- **RATE-01** (`ipRateLimiter`): registered at line 43, after the CORS block.
- **SEC-01** (strict CORS): allowlist is an explicit array of two regexes plus an optional env-var string. No `*.vercel.app` wildcard, no `?? ''` fallback.
- **SEC-02** (`secureHeaders()`): registered at line 42, imported from `hono/secure-headers`.
- **SEC-03** (ZodError handler): `app.onError` branch at lines 62-65 catches `z.ZodError` and returns HTTP 400 with validation details.

TypeScript compiles clean. Phase 16 goal is fully achieved.

---

_Verified: 2026-04-05_
_Verifier: Claude (gsd-verifier)_
