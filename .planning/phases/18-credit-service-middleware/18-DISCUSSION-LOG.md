# Phase 18: Credit Service + Middleware - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 18-credit-service-middleware
**Areas discussed:** Base allocation model, 402 response shape, Service file organization, Credit cost constants

---

## Base Allocation Model

| Option | Description | Selected |
|--------|-------------|----------|
| First-N-free pass-through | Middleware counts today's actions per type. If under quota, skip deduction. No credits granted upfront. | ✓ |
| Upfront credit grant | Grant base credits daily. Requires daily reset mechanism — conflicts with no-cron decision. | |
| Action-type allowance table | Separate user_daily_allowances table. More flexible but adds complexity. | |

**User's choice:** First-N-free pass-through (Recommended)
**Notes:** None

### Follow-up: Bonus Model

| Option | Description | Selected |
|--------|-------------|----------|
| Unified pass-through | Total daily quota = base + earned bonus. One simple counter per action type. | ✓ |
| Base free + bonus deduct | Base actions free (pass-through), bonus actions deduct from earned balance. Two mechanisms. | |

**User's choice:** Unified pass-through (Recommended)
**Notes:** None

---

## 402 Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Rich response | { error, balance, required, daily_used, daily_quota, earn_hint } — everything for bottom sheet in one call | ✓ |
| Minimal + fetch | { error, balance, required } — mobile fetches earn progress separately | |
| Minimal only | { error: 'insufficient_credits' } — matches SC4 exactly, worst UX latency | |

**User's choice:** Rich response (Recommended)
**Notes:** None

---

## Service File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| New services/ directory | backend/api/src/services/creditService.ts — establishes services layer pattern | ✓ |
| Existing lib/ directory | backend/api/src/lib/creditService.ts — mixes infrastructure with business logic | |
| Alongside config/ | backend/api/src/config/credits.ts — treats logic as configuration | |

**User's choice:** New services/ directory (Recommended)
**Notes:** None

---

## Credit Cost Constants

| Option | Description | Selected |
|--------|-------------|----------|
| Config object in config/ | backend/api/src/config/credits.ts — next to models.ts, easy to find and change | ✓ |
| Inside creditService.ts | Constants at top of service file — everything in one place | |
| DB-driven (Supabase table) | credit_config table — hot-reloadable but adds DB queries on every request | |

**User's choice:** Config object in config/ (Recommended)
**Notes:** None

---

## Claude's Discretion

- TypeScript types/interfaces for creditService exports
- Middleware attachment pattern (wrapper vs afterResponse)
- Internal helper functions within creditService
- Error handling for Supabase RPC failures

## Deferred Ideas

None — discussion stayed within phase scope
