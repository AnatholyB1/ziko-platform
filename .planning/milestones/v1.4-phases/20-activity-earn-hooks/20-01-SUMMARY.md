---
phase: 20-activity-earn-hooks
plan: "01"
subsystem: backend
tags: [credits, earn, hooks, tools, hono]
dependency_graph:
  requires: [backend/api/src/services/creditService.ts, backend/api/src/config/credits.ts]
  provides: [POST /credits/earn endpoint, earnCredits hooks in 5 tool executors]
  affects: [backend/api/src/routes/credits.ts, backend/api/src/tools/habits.ts, backend/api/src/tools/nutrition.ts, backend/api/src/tools/measurements.ts, backend/api/src/tools/stretching.ts, backend/api/src/tools/cardio.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget async, idempotency key pattern, VALID_SOURCES allowlist]
key_files:
  created: []
  modified:
    - backend/api/src/routes/credits.ts
    - backend/api/src/tools/habits.ts
    - backend/api/src/tools/nutrition.ts
    - backend/api/src/tools/measurements.ts
    - backend/api/src/tools/stretching.ts
    - backend/api/src/tools/cardio.ts
decisions:
  - "POST /earn always returns HTTP 200 with { credited: boolean } — validation failures return credited:false, never 4xx"
  - "VALID_SOURCES allowlist: ['workout','habit','meal','measurement','stretch','cardio'] — rejects unknown sources with credited:false"
  - "habits_log idempotency key uses habit_${habit_id}_${date} pattern — prevents double-credit on same-day re-log"
  - "All other tools (nutrition, measurements, stretching, cardio) use record UUID from insert .select('id') as idempotency key"
  - "All earn calls are fire-and-forget: no await, .catch(() => {}) suffix — earn failure never blocks activity save"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 6
---

# Phase 20 Plan 01: Activity Earn Hooks Summary

**One-liner:** POST /credits/earn endpoint with VALID_SOURCES allowlist + fire-and-forget earnCredits hooks wired into all 5 backend tool executors (habits, nutrition, measurements, stretching, cardio).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST /credits/earn endpoint + habits and nutrition earn hooks | a582c44 | credits.ts, habits.ts, nutrition.ts |
| 2 | Measurements, stretching, and cardio tool earn hooks | e291f42 | measurements.ts, stretching.ts, cardio.ts |

## What Was Built

**POST /credits/earn endpoint** (`backend/api/src/routes/credits.ts`):
- Added after the existing GET /balance block
- Validates `source` against `VALID_SOURCES` allowlist: `['workout', 'habit', 'meal', 'measurement', 'stretch', 'cardio']`
- Always returns HTTP 200 with `{ credited: boolean }` — no 4xx errors per D-06
- Calls `creditService.earnCredits(userId, source, idempotency_key)` from validated input
- Auth enforced by existing `router.use('*', authMiddleware)` at router level

**5 tool executor earn hooks:**
- `habits_log` — idempotency key `habit_${habit_id}_${date}` (prevents double-credit on same-day re-log)
- `nutrition_log_meal` — idempotency key = record UUID from `.select('id')`
- `measurements_log` — idempotency key = record UUID from `.select('id')`
- `stretching_log_session` — idempotency key = record UUID from `.select('id')`
- `cardio_log_session` — idempotency key = record UUID from `.select('id')`

All hooks: added `import { earnCredits } from '../services/creditService.js'`, placed after `if (error) throw new Error(error.message)` and before `return`, called as `earnCredits(...).catch(() => {})` — never awaited.

## Verification Results

```
grep -rn "earnCredits" backend/api/src/tools/ → 10 matches (5 files × import + call)
grep -rn "await earnCredits" backend/api/src/tools/ → 0 matches (all fire-and-forget)
grep -n "router.post.*earn" backend/api/src/routes/credits.ts → line 31
grep -n "VALID_SOURCES" backend/api/src/routes/credits.ts → line 40
npx tsc --noEmit → exits 0 (TypeScript compiles clean)
```

## Decisions Made

- POST /earn always returns 200 with `{ credited: boolean }` — aligns with D-06 (mobile client must never crash on earn failure)
- VALID_SOURCES allowlist prevents injection of arbitrary source strings into ai_credit_transactions
- habits idempotency uses `habit_${habit_id}_${date}` because the habits_log upsert is by `habit_id,date` — same-day re-log of same habit should not double-credit; UUID-based keys don't apply here since there is no unique insert UUID (upsert pattern)
- All other tools use record UUID because insert always creates a new row with a unique UUID — idempotency is guaranteed by DB uniqueness

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all threats from the plan's threat model are mitigated:
- T-20-01: authMiddleware enforces JWT validation before handler runs
- T-20-02: VALID_SOURCES allowlist rejects unknown sources
- T-20-03: creditService.earnCredits enforces DAILY_EARN_CAP=4 + idempotency key
- T-20-04: .catch(() => {}) ensures earn failure never blocks activity save
- T-20-05: ai_credit_transactions table provides audit trail

## Self-Check: PASSED

Files verified present:
- backend/api/src/routes/credits.ts — FOUND (contains router.post('/earn'))
- backend/api/src/tools/habits.ts — FOUND (contains earnCredits)
- backend/api/src/tools/nutrition.ts — FOUND (contains earnCredits)
- backend/api/src/tools/measurements.ts — FOUND (contains earnCredits)
- backend/api/src/tools/stretching.ts — FOUND (contains earnCredits)
- backend/api/src/tools/cardio.ts — FOUND (contains earnCredits)

Commits verified:
- a582c44 — feat(20-01): POST /credits/earn endpoint + habits and nutrition earn hooks
- e291f42 — feat(20-01): measurements, stretching, and cardio earn hooks
