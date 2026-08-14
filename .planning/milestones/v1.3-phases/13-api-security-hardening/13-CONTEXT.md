# Phase 13: API Security Hardening - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the Hono API against three concrete attack vectors: unrestricted CORS origins, missing HTTP security headers, and unvalidated inputs reaching Claude Sonnet. No frontend work — all changes are in `backend/api/`. Mobile app (Expo/React Native) is unaffected by CORS changes (native apps don't send browser Origin headers).

</domain>

<decisions>
## Implementation Decisions

### CORS allowed origins (SEC-01)
- **D-01:** Remove the `*.vercel.app` wildcard entirely — no regex wildcards allowed
- **D-02:** Allowlist: `exp://` (Expo dev client) + `localhost` (local dev) + `APP_ORIGIN` env var (production)
- **D-03:** No Vercel preview URL support — if a preview deploy needs API access, `APP_ORIGIN` must be updated explicitly
- **D-04:** Mobile app (Expo/React Native) is unaffected — native apps don't send browser `Origin` headers

### Zod input validation (SEC-03)
- **D-05:** Use `.strict()` on all three AI route schemas — unknown fields return 400 immediately
- **D-06:** Routes to validate: `POST /ai/chat`, `POST /ai/chat/stream`, `POST /ai/tools/execute`
- **D-07:** `messages` array: min 1 item, each item requires `role` (enum: user|assistant|system) and `content` (string) — no artificial max caps
- **D-08:** `conversation_id` field: optional string (UUID format not enforced)
- **D-09:** No unknown fields pass through — strict contract enforced

### Validation error format
- **D-10:** Dev (`NODE_ENV !== 'production'`): structured errors `{ error: "Validation failed", details: [{ path, message }] }` from Zod issues
- **D-11:** Prod (`NODE_ENV === 'production'`): opaque `{ error: "Invalid request body" }` — no field names or schema exposed
- **D-12:** Both cases return HTTP 400

### Security headers (SEC-02)
- **D-13:** Use Hono's built-in `secureHeaders()` middleware applied globally in `app.ts`
- **D-14:** No custom header overrides — default `secureHeaders()` profile covers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`

### Claude's Discretion
- Exact `secureHeaders()` options (defaults are fine)
- Where in `app.ts` middleware chain to insert `secureHeaders()` (before or after CORS — order doesn't matter for security here)
- Whether `zValidator` is inline on each route or extracted into a shared schema file

</decisions>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — standard security patterns apply.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §API Security — SEC-01, SEC-02, SEC-03 acceptance criteria
- `.planning/ROADMAP.md` §Phase 13 — success criteria (4 verifiable conditions)

### Existing code to modify
- `backend/api/src/app.ts` — CORS config (lines 17–38), middleware chain, security headers insertion point
- `backend/api/src/routes/ai.ts` — Three routes receiving validation: `/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute`
- `backend/api/src/middleware/rateLimiter.ts` — Middleware pattern to follow for consistency

### Hono documentation (patterns)
- No external specs — Hono v4 `secureHeaders()` and `@hono/zod-validator` are the implementation tools; researcher should verify current API surface

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/src/middleware/rateLimiter.ts` — Middleware factory pattern (`createUserRateLimiter`) — follow same structure if extracting validation schemas
- `backend/api/src/middleware/auth.ts` — Auth middleware wired before AI routes — `zValidator` must wire after auth (or inline on routes)

### Established Patterns
- Global middleware in `app.ts` via `app.use('*', ...)` — `secureHeaders()` follows same pattern
- Per-route middleware in `routes/ai.ts` via `router.use('*', ...)` or inline — `zValidator` goes inline per route (each route has different schema)

### Integration Points
- `app.ts` line 17–38: CORS block — replace `origin` function to remove `*.vercel.app` regex
- `routes/ai.ts` POST handlers: add `zValidator('json', schema)` as second argument to each `router.post(...)` call
- Error handler in `app.ts` (`app.onError`) — may need to handle `ZodError` type specifically for the env-based error format

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-api-security-hardening*
*Context gathered: 2026-04-03*
