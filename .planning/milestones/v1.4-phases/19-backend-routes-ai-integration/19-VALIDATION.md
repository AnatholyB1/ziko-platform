---
phase: 19
slug: backend-routes-ai-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
wave_0_exemption: "No automated test framework exists in backend/api. All verification is TypeScript type-check (tsc --noEmit) + manual integration testing. See RESEARCH.md §Validation Architecture."
created: 2026-04-05
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type-check (`tsc --noEmit`) — no test runner installed in backend/api |
| **Config file** | `backend/api/tsconfig.json` |
| **Quick run command** | `cd backend/api && npx tsc --noEmit` |
| **Full suite command** | `cd backend/api && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend/api && npx tsc --noEmit`
- **After every plan wave:** Run `cd backend/api && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** TypeScript clean + manual integration test of all three endpoints
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | COST-02 | — | Migration 027 creates ai_cost_log with RLS | type-check | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 19-01-02 | 01 | 1 | COST-02 | — | getBalanceSummary returns { balance, dailyEarned } | type-check | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 19-02-01 | 02 | 2 | COST-02 | T-19-03 | GET /credits/balance requires valid JWT (authMiddleware applied) | type-check | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 19-02-02 | 02 | 2 | COST-02 | — | onFinish logs totalUsage (not usage) to ai_cost_log on chat routes | type-check | `npx tsc --noEmit && grep -c "onFinish" src/routes/ai.ts` | ✅ existing | ⬜ pending |
| 19-03-01 | 03 | 3 | COST-02 | T-19-09 | Vision route uses Haiku, falls back to Sonnet on JSON parse failure (SyntaxError) only — not on API errors | type-check + manual | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 19-03-02 | 03 | 3 | COST-03 | — | Monthly cost ceiling verified in VERIFICATION.md | manual | `grep "COST-03 PASS" 19-VERIFICATION.md` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 setup needed — existing type-check infrastructure covers all phase requirements. No test runner installation required.

*Wave 0 exemption: No automated test framework in backend/api (type-check only project pattern). All per-task verification uses `npx tsc --noEmit`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Haiku vision fallback triggers on bad JSON | COST-02 | Requires real Anthropic API call | Feed a blurred/low-quality food photo to `/ai/vision/nutrition`; verify Sonnet is used when Haiku returns non-parseable JSON (raw text, not JSON). Confirm via `ai_cost_log` table: should see one haiku row + one sonnet row for that request. |
| 402 returned on /ai/chat with 0 credits | COST-02 | Requires DB manipulation | Set user balance to 0 in Supabase, call `POST /ai/chat` with valid JWT; verify 402 with `{ error: 'insufficient_credits' }` body (not 429). |
| EUR 0.75/month ceiling at realistic usage | COST-03 | Token measurement requires live calls | See VERIFICATION.md cost ceiling calculation. Manual review of documented projections. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (tsc --noEmit)
- [x] Sampling continuity: no consecutive tasks without automated verify
- [x] Wave 0 exemption documented — type-check-only project pattern
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
