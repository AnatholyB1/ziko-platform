---
phase: 18-credit-service-middleware
plan: "01"
subsystem: backend-credits
tags: [credits, service-layer, typescript, supabase]
dependency_graph:
  requires: [supabase/migrations/026_ai_credits.sql, backend/api/src/config/models.ts]
  provides: [backend/api/src/config/credits.ts, backend/api/src/services/creditService.ts]
  affects: [backend/api/src/middleware/creditMiddleware.ts (Plan 02)]
tech_stack:
  added: []
  patterns: [supabase-rpc-wrapping, idempotent-earn-with-partial-index, read-then-write-balance]
key_files:
  created:
    - backend/api/src/config/credits.ts
    - backend/api/src/services/creditService.ts
  modified: []
decisions:
  - "earnCredits uses read-then-write for balance increment — earn races add only, minor underpayment favors platform"
  - "23505 unique-violation is the idempotency signal — no additional DB round-trip needed"
  - "getQuotaStatus counts deduct source=action for usage (not just deduct type) to align with how Phase 02 middleware will record actions"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 2
---

# Phase 18 Plan 01: Credit Service & Config Summary

Credit config constants and creditService business logic layer — typed TypeScript wrapper over Phase 17 DB primitives (deduct_ai_credits RPC, ai_credit_transactions, user_ai_credits).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create credit cost constants and quota config | e09d8e5 | backend/api/src/config/credits.ts |
| 2 | Create creditService with balance, earn, deduct, quota functions | 7c5ec51 | backend/api/src/services/creditService.ts |

## What Was Built

### `backend/api/src/config/credits.ts`

Single authoritative source for all credit math constants:

- `CREDIT_COSTS` — `{ chat: 4, scan: 3, program: 4 }` (D-08, D-09)
- `CreditAction` — union type derived from `CREDIT_COSTS` keys
- `DAILY_QUOTAS` — `{ chat: { base: 1, bonus: 2 }, scan: { base: 1, bonus: 2 } }` (D-10)
- `MONTHLY_QUOTAS` — `{ program: { base: 1, bonus: 1 } }` (D-10)
- `EARN_AMOUNT = 1`
- `DAILY_EARN_CAP = 4` (chat.bonus + scan.bonus)

No Anthropic or Claude model IDs — `models.ts` remains the sole model-ID file.

### `backend/api/src/services/creditService.ts`

Four exported async functions:

**`getBalance(userId)`** — Upserts `user_ai_credits` (ignoreDuplicates preserves existing balance), then selects current balance. Returns `{ balance: 0 }` on any error. (CRED-03)

**`earnCredits(userId, source, idempotencyKey)`** — Counts today's earn transactions; returns `{ credited: false }` if `>= DAILY_EARN_CAP`. Inserts earn transaction; on `23505` unique-violation (EARN-10 idempotency) returns `{ credited: false }`. On success: read-then-write balance increment. (EARN-07, EARN-10)

**`deductCredits(userId, action, idempotencyKey)`** — Calls `supabase.rpc('deduct_ai_credits', ...)` which uses `SELECT FOR UPDATE` row lock in a `SECURITY DEFINER` function. Parses JSONB result into typed return. (CRED-02)

**`getQuotaStatus(userId, action)`** — Counts usage and earn transactions for today (or this month for `program`). Computes `dailyQuota = base + min(earnCount, bonus)`. Returns `QuotaStatus` with `withinFreeQuota`, `dailyUsed`, `dailyQuota`, `balance`, `earnHint`. (CRED-02, EARN-07)

## Deviations from Plan

None - plan executed exactly as written.

The one nuance: `getQuotaStatus` counts `source = action` in `ai_credit_transactions` for usage tracking. The plan said to count "transactions for this action" — this matches the column the `deduct_ai_credits` RPC populates (`p_action_type` → `source`). Aligns with how Plan 02 middleware will record deductions.

## Known Stubs

- `earnHint` in `getQuotaStatus` is statically `'Log a workout to earn credits'` (first of 6 possible hints). Plan 20 will make this dynamic based on today's actual earn state. Not a blocker for Plan 02 or Plan 19.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns introduced. `creditService.ts` is a pure service layer consumed by future middleware — no direct HTTP exposure in this plan.

## Self-Check: PASSED

Files created:
- FOUND: backend/api/src/config/credits.ts (commit e09d8e5)
- FOUND: backend/api/src/services/creditService.ts (commit 7c5ec51)

TypeScript: zero errors (`rtk npx tsc --noEmit --project backend/api/tsconfig.json` passed)

All plan acceptance criteria met:
- CREDIT_COSTS exports with correct values (chat=4, scan=3, program=4)
- CreditAction, DAILY_QUOTAS, MONTHLY_QUOTAS, EARN_AMOUNT, DAILY_EARN_CAP all exported
- No model IDs in credits.ts
- getBalance, earnCredits, deductCredits, getQuotaStatus all exported
- QuotaStatus interface exported
- rpc('deduct_ai_credits') called in deductCredits
- ai_credit_transactions and user_ai_credits queried
- Import from '../config/credits.js' present
- DAILY_EARN_CAP referenced
- 23505 error code handled (idempotency)
