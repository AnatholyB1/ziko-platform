---
phase: 19-backend-routes-ai-integration
plan: "03"
subsystem: backend/api
tags: [vision, ai-cost, haiku, sonnet-fallback, credit-gate, token-logging]
dependency_graph:
  requires: [config/models.VISION_MODEL, middleware/creditGate, logTokenUsage, ai_cost_log]
  provides: [upgraded /ai/vision/nutrition, 19-VERIFICATION.md cost-ceiling]
  affects: [backend/api/src/routes/ai.ts]
tech_stack:
  added: []
  patterns: [haiku-primary-sonnet-fallback, inner-try-catch-parse-only, credit-gate-middleware-chain]
key_files:
  created:
    - .planning/phases/19-backend-routes-ai-integration/19-VERIFICATION.md
  modified:
    - backend/api/src/routes/ai.ts
decisions:
  - "VISION_MODEL (Haiku) is primary for /vision/nutrition — 70% cheaper per scan; Sonnet fallback only on SyntaxError from JSON.parse, not on API errors"
  - "Inner try/catch wraps only JSON.parse — outer try/catch wraps both model calls so Anthropic API errors go to 500, not to Sonnet fallback"
  - "COST-03 PASS at realistic engagement (9 active days/month, 50% quota) = EUR 0.44 — well under EUR 0.75 ceiling"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements: [COST-02, COST-03]
---

# Phase 19 Plan 03: Vision Route Upgrade + Cost Ceiling Verification Summary

Vision /nutrition endpoint upgraded to use Haiku as primary model with Sonnet fallback on JSON parse failure only; credit gate enforced via creditCheck+creditDeduct('scan'); both model calls log tokens via onFinish; VERIFICATION.md documents EUR 0.75 ceiling analysis with COST-03 PASS verdict at realistic engagement levels.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Upgrade vision route — Haiku model, credit gate, Sonnet fallback, telemetry | 1a41fdc | backend/api/src/routes/ai.ts |
| 2 | Document cost ceiling calculation in VERIFICATION.md (SC-5, COST-03) | b5118dd | .planning/phases/19-backend-routes-ai-integration/19-VERIFICATION.md |

## What Was Built

### Vision Route Upgrade (backend/api/src/routes/ai.ts)

Four changes to the AI routes file:

1. **Imports updated:** Replaced local `const AGENT_MODEL = anthropic(...)` with `import { AGENT_MODEL, VISION_MODEL } from '../config/models.js'`. Added `import { creditCheck, creditDeduct } from '../middleware/creditGate.js'`. Removed bare `import { anthropic }` (no longer needed locally).

2. **Credit gate added to middleware chain:** Route signature changed from `router.post('/vision/nutrition', async (c) =>` to `router.post('/vision/nutrition', creditCheck('scan'), creditDeduct('scan'), async (c) =>`. This enforces T-19-09 — 0-credit users receive 402 before any LLM call is made.

3. **Haiku-first model pattern:** Primary call uses `VISION_MODEL` (Haiku) — 70% cheaper per scan. `onFinish` logs tokens with `'claude-haiku-4-5-20251001'`.

4. **Sonnet fallback on SyntaxError only (D-09):** Inner try/catch wraps only `JSON.parse(cleaned)`. If Haiku returns unparseable JSON, falls through to Sonnet. If Haiku throws an API error, the outer catch returns 500 immediately — Sonnet is NOT called. Sonnet fallback also has its own `onFinish` logging `'claude-sonnet-4-20250514'`.

Total `onFinish` count in ai.ts = 4:
- `/chat/stream` (streamText Sonnet)
- `/chat` (generateText Sonnet)
- `/vision/nutrition` Haiku primary
- `/vision/nutrition` Sonnet fallback

### VERIFICATION.md (Cost Ceiling Analysis)

New document at `.planning/phases/19-backend-routes-ai-integration/19-VERIFICATION.md`:
- Anthropic pricing table for Sonnet ($3.00/$15.00 per 1M tokens) and Haiku ($0.80/$4.00)
- Per-call cost estimates for all four AI routes
- Free-tier maximum daily usage (3 chat + 3 scan)
- Realistic monthly projection: EUR 0.44 (9 active days, 50% quota utilization)
- Power user worst case: EUR 2.91 (30 days at full quota, 120 activity completions/month)
- COST-03 PASS verdict at realistic engagement; config lever documented for tighter enforcement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] VISION_MODEL import source**
- **Found during:** Task 1
- **Issue:** The plan's interface comment showed `AGENT_MODEL` as a local constant in ai.ts (line 18), but ai.ts already had `const AGENT_MODEL = anthropic('claude-sonnet-4-20250514')` defined locally — NOT imported from config/models.ts. The plan's Change 1 said to change `import { AGENT_MODEL }` to `import { AGENT_MODEL, VISION_MODEL }`, but no such import existed.
- **Fix:** Replaced local `const AGENT_MODEL` definition AND bare `import { anthropic }` with `import { AGENT_MODEL, VISION_MODEL } from '../config/models.js'`. This matches the architectural intent (models.ts is the single source of truth per STATE.md decisions).
- **Files modified:** `backend/api/src/routes/ai.ts`
- **Commit:** 1a41fdc

**2. [Rule 2 - Missing Critical] creditCheck/creditDeduct imports**
- **Found during:** Task 1
- **Issue:** The plan stated "The `creditCheck` and `creditDeduct` imports already exist (line 10)" but they were absent from the actual file.
- **Fix:** Added `import { creditCheck, creditDeduct } from '../middleware/creditGate.js'`
- **Files modified:** `backend/api/src/routes/ai.ts`
- **Commit:** 1a41fdc

**3. [Rule 3 - Blocking] VERIFICATION.md did not exist**
- **Found during:** Task 2
- **Issue:** Plan said to "update the existing" 19-VERIFICATION.md but the file did not exist (only 19-VALIDATION.md existed). The plan references both files: VALIDATION.md = nyquist sampling strategy; VERIFICATION.md = cost ceiling document.
- **Fix:** Created 19-VERIFICATION.md from scratch with full content as specified in plan action.
- **Files created:** `.planning/phases/19-backend-routes-ai-integration/19-VERIFICATION.md`
- **Commit:** b5118dd

## Threat Surface Scan

Threat mitigations T-19-08 and T-19-09 implemented as specified:
- T-19-08 (Information Disclosure): `authMiddleware` applied globally on router — unauthenticated requests rejected before handler
- T-19-09 (Spoofing/Credit bypass): `creditCheck('scan') + creditDeduct('scan')` in middleware chain — 0-credit users get 402 before any LLM call

T-19-06 (Sonnet fallback abuse) and T-19-07 (double-model DoS) accepted per plan threat register — user cannot force SyntaxError; rate limiter prevents bulk abuse.

No new security surface introduced beyond plan's threat model.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/api/src/routes/ai.ts modified | FOUND |
| .planning/phases/19-backend-routes-ai-integration/19-VERIFICATION.md created | FOUND |
| Commit 1a41fdc (vision route upgrade) | FOUND |
| Commit b5118dd (VERIFICATION.md) | FOUND |
| VISION_MODEL in ai.ts | FOUND (import + 2 usages) |
| creditCheck('scan') in ai.ts | FOUND |
| onFinish count = 4 | FOUND |
| EUR 0.75 in VERIFICATION.md | FOUND |
| COST-03 PASS in VERIFICATION.md | FOUND |
| TypeScript compiles clean | PASSED |
