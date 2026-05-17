---
phase: 25
plan: 03
subsystem: backend/coach
tags: [backend, coach, invitations, redeem, rate-limit, constant-time, rls]
requirements_complete: [INVITE-03, INVITE-04, INVITE-05, INVITE-06, INVITE-07]
dependency_graph:
  requires:
    - "supabase/migrations/035_coach_invitations_links_rls.sql (redeem_invitation_code RPC)"
    - "supabase/migrations/040_peek_invitation_function.sql (peek_invitation RPC, plan 01)"
    - "backend/api/src/lib/redis.ts (Upstash singleton)"
    - "backend/api/src/middleware/auth.ts (authMiddleware sets c.get('auth').userId)"
    - "packages/coach-sdk/src/schemas/coach-link-preview.ts (wire schemas)"
  provides:
    - "GET    /coach/clients/links/me           — current active link + signed coach preview"
    - "POST   /coach/clients/links/preview      — peek invitation code (constant-time + rate-limited)"
    - "POST   /coach/clients/links/redeem       — redeem invitation code (constant-time + rate-limited)"
    - "DELETE /coach/clients/links/:id          — athlete revokes own link (idempotent)"
  affects:
    - "Plan 25-05 (athlete mobile UI) — unblocked, can now call these 4 endpoints"
    - "Plan 25-06 (verification suite) — has constant-time + rate-limit contracts to validate"
tech-stack:
  added: []
  patterns:
    - "Per-request JWT supabase-js client (no admin keys) — clones backend/api/src/coach/invitations/db.ts"
    - "Serial composed rate-limit (IP fail-fast → user) on Upstash singleton"
    - "Constant-time wire envelope: 6 DB error codes → 1 wire code (INVALID_OR_EXPIRED) — log original via console.warn"
    - "Catch-all error path returns envelope (never raw err.message) — T-25-01 bypass guard"
    - "Coach photo signing: bucket path → signed URL with 300s TTL"
key-files:
  created:
    - "backend/api/src/coach/clients/types.ts"
    - "backend/api/src/coach/clients/db.ts"
    - "backend/api/src/coach/clients/ratelimit.ts"
    - "backend/api/src/coach/clients/service.ts"
    - "backend/api/test/coach/clients-preview.spec.ts"
    - "backend/api/test/coach/clients-redeem.spec.ts"
    - "backend/api/test/coach/clients-revoke.spec.ts"
    - "backend/api/test/coach/ratelimit.spec.ts"
    - "backend/api/test/coach/timing.spec.ts"
  modified:
    - "backend/api/src/app.ts (import + mount clientsRouter at /coach/clients)"
decisions:
  - "Reuse existing Upstash redis singleton (lib/redis.ts) — do NOT instantiate a second client to avoid double-counting connections"
  - "IP bucket evaluated FIRST (fail-fast) — saves a user-bucket Redis call when an IP is already blown"
  - "Single wire error code 'INVALID_OR_EXPIRED' for all 6 DB causes (INVITE-07) — log original via console.warn for ops visibility"
  - "/preview and /redeem catch-all paths also return constant-time envelope (not raw err.message) — closes T-25-01 bypass channel"
  - "DELETE /links/:id is idempotent — re-revoke returns { ok: true } (matches invitations.revokeInvitation pattern)"
  - "Path-dispatched envelope shape in ratelimit.ts — /redeem includes link:null, /preview omits it (matches db.ts return shapes byte-for-byte)"
metrics:
  duration_minutes: ~12
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_created: 9
  files_modified: 1
  commits: 3
---

# Phase 25 Plan 03: Backend coach/clients Bounded Module Summary

**One-liner:** Athlete-side coach-link backend — 4 routes (links/me, preview, redeem, revoke) with serial IP+user rate limiting and constant-time error envelope that collapses 6 DB error codes to a single wire code.

## What Was Built

The coach/clients bounded module under `backend/api/src/coach/clients/`:

- **types.ts** — `DbErrorCode` (6 internal causes), `WireErrorCode` (single `INVALID_OR_EXPIRED`), RPC return shape unions.
- **db.ts** — `createUserClient` (per-request JWT, no service key), `getActiveLink`, `peekInvitation`, `redeemInvitation`, `revokeLink`, internal `signCoachPhoto` (300s TTL). All error branches collapse to `INVALID_OR_EXPIRED` and log original via `console.warn`.
- **ratelimit.ts** — `redemptionRateLimit` middleware composing IP bucket (5/15min sliding) fail-fast then user bucket (10/1h sliding); reuses `lib/redis.ts` singleton; 429 body byte-identical to 200 error envelope; `Retry-After` header set on every 429.
- **service.ts** — `clientsRouter` (Hono) with 4 routes; auth applied via `clientsRouter.use('*', authMiddleware)`; `/preview` + `/redeem` chain `redemptionRateLimit` between auth and handler; malformed JSON / invalid code regex / unexpected exceptions all collapse to constant-time envelope.
- **app.ts** — imports `clientsRouter` and mounts at `/coach/clients` immediately after `/coach/invitations`.
- **Test stubs** — `clients-preview`, `clients-redeem`, `clients-revoke`, `ratelimit`, `timing` (16 + 8 + 3 = 27 `it.todo` placeholders locking contracts for plan 06).

## Smoke Test Results

Boot test against local dev server (port 8080):

| Route | Method | Auth | Expected | Actual |
|---|---|---|---|---|
| `/health` | GET | none | 200 | 200 |
| `/coach/clients/links/me` | GET | none | 401 (not 404) | 401 |
| `/coach/clients/links/preview` | POST | none | 401 | 401 |
| `/coach/clients/links/redeem` | POST | none | 401 | 401 |
| `/coach/clients/links/:uuid` | DELETE | none | 401 | 401 |

All 4 routes are reachable (never 404) and gated by `authMiddleware`. The auth gate confirms `clientsRouter.use('*', authMiddleware)` runs before `redemptionRateLimit` — which is required because the user bucket keys on `c.get('auth').userId`.

## Constant-Time Envelope Confirmation (Manual Reasoning)

The 6 DB error causes (INVALID_CODE, SELF_INVITATION, REVOKED, EXPIRED, ALREADY_USED, LINK_EXISTS) all flow through the same `if (!rpc.ok)` branch in `db.ts.peekInvitation` and `db.ts.redeemInvitation`. That branch returns the exact same JS object literal `{ ok: false, error_code: 'INVALID_OR_EXPIRED', preview: null }` (preview) or `{ ok: false, error_code: 'INVALID_OR_EXPIRED', link: null, preview: null }` (redeem). The `console.warn` call uses the original `rpc.error_code` but never leaks to the response.

Additionally, `service.ts` catch-all paths return the same module-level constants (`PREVIEW_ERROR`, `REDEEM_ERROR`) on JSON parse failure, regex mismatch, or unexpected throws — closing the T-25-01 bypass channel where raw `err.message` could otherwise leak internals.

The `ratelimit.ts` 429 envelope is path-dispatched but produces the exact same shape as the corresponding 200 error envelope from `db.ts`. Only the HTTP status and the `Retry-After` header differ.

Byte-identical body shape across the 6 error causes (deep-equal at runtime) is asserted in the plan-06 vitest suite — the 16 `it.todo` stubs in `clients-preview.spec.ts` lock this contract.

## Test Stub Coverage

- `test/coach/clients-preview.spec.ts` — 10 todos covering happy path + all 6 error code collapses + byte-equal assertion + console.warn assertion
- `test/coach/clients-redeem.spec.ts` — 3 todos (success, error collapsing, post-fetch failure collapse)
- `test/coach/clients-revoke.spec.ts` — 3 todos (idempotency, ownership, post-revoke is_coach_of)
- `test/coach/ratelimit.spec.ts` — 8 todos (IP 5/15min, user 10/1h, serial composition, 429 envelope equality, Retry-After, safety)
- `test/coach/timing.spec.ts` — 3 todos (peek + redeem benchmark, warmup, p99-p1 < 50ms threshold)

Vitest collects all 27 todos cleanly (no parse errors, no type errors, 0 failures).

## Vercel Env-Var Verification

`backend/api/src/coach/clients/` requires the following env vars at runtime (already provisioned for Phase 24 invitations and Phase 22 keystone):

- `SUPABASE_URL` — base Supabase URL (used by `createUserClient`)
- `SUPABASE_PUBLISHABLE_KEY` — anon/publishable key (NEVER service role); per-request JWT supplied via `global.headers.Authorization`
- `UPSTASH_REDIS_REST_URL` — Upstash REST endpoint (used by `lib/redis.ts` singleton)
- `UPSTASH_REDIS_REST_TOKEN` — Upstash auth token

All four are confirmed present in the Vercel project (the Upstash pair has been live since Phase 24 added the IP rate limiter in `middleware/rateLimiter.ts`). The `module-load crash` row in the threat register is accepted: if env vars are absent the `new Redis({ url: ...!, token: ...! })` would dereference undefined and throw at module load — same behavior as the existing rate limiter, so no regression vs. main.

## Deviations from Plan

None — plan executed exactly as written.

The plan-supplied code blocks were applied verbatim with one tiny housekeeping change: `redeemInvitation` accepts `_clientId` (underscore-prefixed) to satisfy `noUnusedParameters` while keeping the documented call signature `redeemInvitation(jwt, payload, userId)`. The parameter is reserved for plan-04 (coach-side dashboard listing) where it will be passed through unchanged.

## Threat Surface Scan

No new surface beyond what the plan's `<threat_model>` already enumerated. All trust boundaries (client→Hono, Hono→Supabase RPC, Hono→Storage, Hono→Upstash) are pre-existing; this module mitigates T-25-01 through T-25-08 per the disposition table in the plan.

## Self-Check: PASSED

Files (all 9 created files exist):
- `backend/api/src/coach/clients/types.ts` — FOUND
- `backend/api/src/coach/clients/db.ts` — FOUND
- `backend/api/src/coach/clients/ratelimit.ts` — FOUND
- `backend/api/src/coach/clients/service.ts` — FOUND
- `backend/api/test/coach/clients-preview.spec.ts` — FOUND
- `backend/api/test/coach/clients-redeem.spec.ts` — FOUND
- `backend/api/test/coach/clients-revoke.spec.ts` — FOUND
- `backend/api/test/coach/ratelimit.spec.ts` — FOUND
- `backend/api/test/coach/timing.spec.ts` — FOUND

Modified (1 file):
- `backend/api/src/app.ts` — FOUND (import + mount lines present)

Commits (all 3 in git log):
- `96b590d` feat(25-03): add coach/clients types + db module — FOUND
- `40466bb` feat(25-03): add redemptionRateLimit middleware — FOUND
- `f66badf` feat(25-03): add clientsRouter + mount at /coach/clients — FOUND

Acceptance checks:
- `npx tsc --noEmit` exits 0 — PASS
- No `SERVICE_KEY` / `SERVICE_ROLE` under `backend/api/src/coach/clients/` — PASS
- All 4 routes return 401 (not 404) without auth — PASS
- `redemptionRateLimit` middleware composed serial IP→user — PASS
- Constant-time envelope strings present in db.ts, ratelimit.ts, service.ts — PASS
