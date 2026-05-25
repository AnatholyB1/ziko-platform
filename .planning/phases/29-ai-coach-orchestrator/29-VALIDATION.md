---
phase: 29
slug: ai-coach-orchestrator
date: 2026-05-22
status: active
---

# Phase 29: AI Coach Orchestrator — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already installed in `backend/api/` + `apps/web/`) |
| Config file | `backend/api/vitest.config.ts` |
| Quick run | `npx vitest run --passWithNoTests` |
| Full suite | `npx vitest run` |

---

## Phase Requirements → Test Map

| Req ID | Behavior Under Test | Test Type | Automated Command | Wave |
|--------|---------------------|-----------|-------------------|------|
| AIC-01 | `fetchCoachContext` returns linked clients for coach | unit | `vitest run coach/ai/db.spec.ts` | Wave 0 |
| AIC-02 | `buildCoachSDKTools` returns 3 tools with correct `inputSchema` keys | unit | `vitest run coach/ai/service.spec.ts` | Wave 0 |
| AIC-03 | `analyze_client` rejects unlinked client (throws / returns 403 semantics) | unit | `vitest run coach/ai/tools.spec.ts` | Wave 0 |
| AIC-04 | `generate_coaching_program` creates program with `is_template=false` and `assigned_to_user_id` set | unit | `vitest run coach/ai/tools.spec.ts` | Wave 0 |
| AIC-05 | `monitor_client_alerts` detects `missed_sessions` pattern when no sessions in 7 days | unit | `vitest run coach/ai/alerts.spec.ts` | Wave 0 |
| AIC-06 | `POST /coach/ai/monitor-cron` returns 401 when `Authorization: Bearer` header is missing | unit | `vitest run coach/ai/cron.spec.ts` | Wave 0 |
| AIC-07 | `AdaptWithAIButton` navigates to `/coach/ai?template=X&client=Y` (manual browser smoke) | smoke | manual | — |
| AIC-08 | `WeeklyDigest` React Email renders valid HTML without throwing | unit | `vitest run email/WeeklyDigest.spec.tsx` | Wave 0 |
| AIC-09 | `ai_tool_audit` row is inserted after each tool execution (fire-and-forget side effect) | integration | `vitest run coach/ai/audit.spec.ts` | Wave 0 |
| AIC-10 | `creditCheck('coach_chat')` returns 402 when credit balance is 0 | unit | covered by existing credit tests pattern | ✓ existing |

---

## Wave 0 — Test Stubs to Create

These files must be scaffolded (even as empty stubs with a single `it.todo`) before Plans 02–05 execute, so `vitest run --passWithNoTests` passes from Wave 1 onward.

| File | Tests | Covers |
|------|-------|--------|
| `backend/api/src/coach/ai/db.spec.ts` | `fetchCoachContext` returns clients array; empty if no links | AIC-01 |
| `backend/api/src/coach/ai/service.spec.ts` | `buildCoachSDKTools` returns exactly 3 tools; tool names match schema | AIC-02 |
| `backend/api/src/coach/ai/tools.spec.ts` | `analyzeClientExecutor` throws on unlinked client; `generateCoachingProgramExecutor` sets `is_template=false` | AIC-03, AIC-04 |
| `backend/api/src/coach/ai/alerts.spec.ts` | `detectMissedSessions` returns alert when last session > 7 days ago | AIC-05 |
| `backend/api/src/coach/ai/cron.spec.ts` | `POST /coach/ai/monitor-cron` returns 401 without CRON_SECRET | AIC-06 |
| `packages/email/src/templates/WeeklyDigest.spec.tsx` | `render(<WeeklyDigest>)` returns non-empty HTML string | AIC-08 |
| `backend/api/src/coach/ai/audit.spec.ts` | `logToolAudit` calls `supabase.from('ai_tool_audit').insert(...)` | AIC-09 |

---

## Validation Gates per Wave

| Wave | Plan | Validation Command | Must Pass Before |
|------|------|--------------------|------------------|
| 0 | test stubs created | `npx vitest run --passWithNoTests` | Wave 1 |
| 1 | migration 050 | `supabase db push` (blocking) | Wave 2 |
| 2 | coach/ai module | `npx tsc --noEmit` + `vitest run coach/ai/` | Wave 3 |
| 3 | web chat page | `npx tsc --noEmit` (apps/web) | Wave 4 |
| 4 | alerts + buttons | `npx tsc --noEmit` (apps/web) | Wave 5 |
| 5 | email + cron | `npx tsc --noEmit` + `vitest run email/` | Wave 6 |
| 6 | E2E smoke | manual: chat → tool call → alert panel + cron dry-run | Done |

---

## Security Validation Checklist

- [ ] `createUserClient(jwt)` used in all 3 tool executors (grep: no `clientForUser` or `SERVICE_ROLE` under `coach/ai/`)
- [ ] `monitor-cron` route verifies `Authorization: Bearer ${CRON_SECRET}` before proceeding
- [ ] `ai_tool_audit` RLS: only `coach_id = auth.uid()` can read own audit rows
- [ ] `coach_alerts` RLS: only `coach_id = auth.uid()` can read/write own alerts
- [ ] No service role references under `backend/api/src/coach/` (CI grep gate in Plan 06)
