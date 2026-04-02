# Phase 12: Infra + Rate Limiting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 12-infra-rate-limiting
**Areas discussed:** Missing Thresholds, Window Algorithm, 429 Response Format, Route Exemption Scope

---

## Missing Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| 60 seconds global window | 200 req/min per IP — standard DDoS protection | ✓ |
| 10 minutes global window | 200 req/10min — gentler | |
| No window | Counter never resets — not practical | |

**User's choice:** 200 requests per 60 seconds (global unauth IP window)

| Option | Description | Selected |
|--------|-------------|----------|
| 100 scans / day | Generous for real usage, 24h window | |
| 50 scans / day | Conservative | |
| Same as AI chat (20/60min) | Reuses same limiter config | ✓ |

**User's choice:** Barcode scan = 20 per 60 minutes per userId (same config as AI chat)

| Option | Description | Selected |
|--------|-------------|----------|
| 10 attempts / 15min | Industry standard for login throttling | ✓ |
| 5 attempts / 5min | Tighter | |
| 20 attempts / 30min | Looser | |

**User's choice:** 10 attempts / 15min — but resolved as DEFERRED (Supabase handles auth directly, no Hono auth routes exist)

---

## Window Algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| slidingWindow | Smooth, no boundary spikes, 2 Redis ops | ✓ |
| fixedWindow | 1 Redis op, gameable at window boundary | |
| tokenBucket | Allows bursts, complex config, overkill | |

**User's choice:** `slidingWindow` for all limiters

---

## 429 Response Format

| Option | Description | Selected |
|--------|-------------|----------|
| Flat + Retry-After `{error, retryAfter}` | Simple, actionable for mobile | ✓ |
| Verbose `{error, details: {limit, remaining, reset}}` | Overkill for mobile fitness app | |
| Error string only `{error}` | No retry info | |

**User's choice:** `{ "error": "Rate limit exceeded", "retryAfter": <seconds> }`

| Option | Description | Selected |
|--------|-------------|----------|
| Seconds integer | RFC 7231, easiest for mobile | ✓ |
| HTTP-date | RFC 7231 valid but harder to parse | |

**User's choice:** Retry-After header as integer seconds

---

## Route Exemption Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Public catalog endpoints | /plugins, /supplements/* read-only | ✓ |
| Webhooks | Supabase server-side calls | ✓ |
| Cron endpoints | Already protected by CRON_SECRET | ✓ |

**User's choice:** All three categories exempted from global IP limiter

| Option | Description | Selected |
|--------|-------------|----------|
| None — Supabase handles it | No Hono /auth/* routes exist | ✓ |
| Add /auth/login proxy | Creates proxy route with IP limiting | |
| Apply to all unauth POSTs | Too broad | |

**User's choice:** RATE-05 satisfied by Supabase's built-in protections — no Hono auth proxy needed

---

## Claude's Discretion

None — all areas were decided by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
