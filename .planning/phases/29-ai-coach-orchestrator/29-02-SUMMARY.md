---
phase: 29-ai-coach-orchestrator
plan: "02"
subsystem: backend
tags: [ai, coach, streaming, tools, cron, credits]
dependency_graph:
  requires:
    - 29-01 (migration 050: coach_alerts + ai_tool_audit tables)
    - backend/api/src/coach/clients/db.ts (createUserClient)
    - backend/api/src/middleware/creditGate.ts (creditCheck, creditDeduct)
    - backend/api/src/config/models.ts (AGENT_MODEL)
    - backend/api/src/context/conversation.ts (appendMessages)
  provides:
    - POST /coach/ai/chat/stream — SSE streaming coach AI chat
    - POST /coach/ai/monitor-cron — daily cron alert detection
    - PATCH /coach/ai/alerts/:id/read — mark alert read
    - POST /coach/ai/alerts/read-all — mark all read
    - GET /coach/ai/alerts — list unread alerts
  affects:
    - backend/api/src/app.ts (new route mounted)
    - backend/api/src/config/credits.ts (coach_chat cost added)
    - backend/api/vercel.json (3rd cron entry)
tech_stack:
  added: []
  patterns:
    - Vercel AI SDK v6 tool() with inputSchema (not parameters)
    - Hono SSE streaming via hono/streaming + stream()
    - Cron route protected by CRON_SECRET (no user JWT)
    - Defense-in-depth coach_client_links check in every tool executor
    - Fire-and-forget ai_tool_audit inserts via service client
key_files:
  created:
    - backend/api/src/coach/ai/types.ts
    - backend/api/src/coach/ai/context.ts
    - backend/api/src/coach/ai/db.ts
    - backend/api/src/coach/ai/tools.ts
    - backend/api/src/coach/ai/service.ts
  modified:
    - backend/api/src/config/credits.ts
    - backend/api/src/app.ts
    - backend/api/vercel.json
decisions:
  - "Used createUserClient(jwt) throughout all tool executors — never service key for coach reads (is_coach_of RLS must fire)"
  - "monitor-cron route defined BEFORE router.use('*', authMiddleware) so Vercel cron (no user JWT) can call it"
  - "Conversation insert in /chat/stream done directly (not via getOrCreateConversation) to set plugin_context: {context: 'coach'}"
  - "cron handler uses service-key supabase client for iteration — explicit coach_id + client_id WHERE scopes every query"
metrics:
  duration: "45 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
---

# Phase 29 Plan 02: Coach AI Backend Service Summary

**One-liner:** Full coach AI bounded module with 3 RLS-scoped tools (analyze_client, generate_coaching_program, monitor_client_alerts), SSE streaming chat, daily monitoring cron, and credit gate wired to a new `coach_chat` cost key.

## What Was Built

### Task 1: types.ts + context.ts + db.ts

**`backend/api/src/coach/ai/types.ts`** — Interfaces only: `CoachAlert`, `AiToolAuditRow`, `CoachContext`. `alert_type` union and `severity` union match the `050_coach_ai_schema.sql` CHECK constraints exactly.

**`backend/api/src/coach/ai/context.ts`** — `fetchCoachContext(coachId, jwt)` fetches `coach_profiles` + `coach_client_links` in parallel using `createUserClient(jwt)` from `../clients/db.js`. Returns `CoachContext` with profile and active linked clients. Comment: `// MUST use JWT client — service key bypasses is_coach_of RLS`.

**`backend/api/src/coach/ai/db.ts`** — Data access layer:
- `createUserClient` re-exported from `../clients/db.js` for tool executors
- `createServiceClient()` private — for cron + audit inserts only
- `getCoachAlerts(jwt, coachId)` — unread alerts, limit 10
- `markAlertRead(jwt, alertId, coachId)` — defense-in-depth `.eq('coach_id', coachId)` on top of RLS
- `markAllAlertsRead(jwt, coachId)` — bulk dismiss
- `insertAlerts(alerts[])` — batch insert via service client, throws on error
- `logToolAudit(row)` — fire-and-forget Promise.resolve(...).catch(...) via service client
- `listCoachesForCron()` — returns `{coachId}[]` from coach_profiles via service client

### Task 2: tools.ts + service.ts + credits.ts + app.ts + vercel.json

**`backend/api/src/coach/ai/tools.ts`** — 3 coach tool schemas and executors:

`analyze_client`:
- Defense-in-depth: `coach_client_links` check before any data read
- Fetches sessions count, avg sleep, avg mood, latest weight in parallel
- Returns structured `{client_id, period_days, sessions_count, avg_sleep_hours, avg_mood, latest_weight_kg, suggestions[]}`
- Throws `'Client not linked to this coach'` for unlinked clients

`generate_coaching_program`:
- Same defense-in-depth link check
- Calls `AGENT_MODEL` via `generateText` to produce `weeks_data` JSON
- Inserts to `workout_programs` with `is_template: false`, `assigned_to_user_id: clientId`
- Returns `{program_id, name, weeks_count}`

`monitor_client_alerts`:
- Fetches all active coach_client_links via JWT client
- For each client: missed sessions (7d), sleep drop (3d vs 4-10d), mood decline (7d vs 14-7d)
- Batch-inserts via `insertAlerts` (service client)
- Returns `{alerts_count, clients_scanned, alerts[]}`

All 3 executors call `logToolAudit` with `resultStatus: 'success' | 'error'`.

**`backend/api/src/coach/ai/service.ts`** — `coachAiRouter` (Hono):
- `/monitor-cron` — CRON_SECRET guard, no authMiddleware, iterates all coaches via service client, runs alert detection, Monday weekly digest stub (Plan 05 implements Resend email)
- `router.use('*', authMiddleware)` — all remaining routes require JWT
- `GET /alerts` — list unread alerts
- `PATCH /alerts/:id/read` — mark single read
- `POST /alerts/read-all` — mark all read
- `POST /chat/stream` — `creditCheck('coach_chat')` + `creditDeduct('coach_chat')`, fetchCoachContext, direct `ai_conversations` insert with `plugin_context: {context:'coach'}`, `streamText` with `stopWhen: stepCountIs(5)`, SSE headers before `stream()`, `appendMessages` after stream

**`backend/api/src/config/credits.ts`** — Added `coach_chat: 4` to `CREDIT_COSTS`; added `COACH_TOOL_COSTS` constant + `CoachToolName` type.

**`backend/api/src/app.ts`** — Import + `app.route('/coach/ai', coachAiRouter)` after `importsRouter`.

**`backend/api/vercel.json`** — 3rd cron entry: `{"path": "/coach/ai/monitor-cron", "schedule": "0 7 * * *"}`.

## Commits

| Hash | Message |
|------|---------|
| 913aa73 | feat(29-02): add coach AI types, context, and DB helpers |
| 93b6998 | feat(29-02): implement 3 coach AI tools, chat stream route, and monitor-cron endpoint |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor structural adjustment:

**[Rule 1 - Cleanup] Removed unused createUserClient call in cron handler**
- Found during: Task 2 implementation
- Issue: Monitor-cron has no user JWT, so `createUserClient('')` was instantiated but unused
- Fix: Removed the instantiation; cron handler uses only the service-key `supabase` client directly
- No behavior change

## Known Stubs

**Weekly digest email** (`service.ts` cron handler):
- Location: `backend/api/src/coach/ai/service.ts` — Monday cron path
- Stub: `console.log('[MonitorCron] Monday weekly digest stub...')` — no email sent
- Reason: Plan 05 implements Resend email send + React Email template (per CONTEXT.md D-12/D-13)

## Threat Flags

No new threat surface introduced beyond the plan's threat model. All T-29-04 through T-29-09 mitigations applied as specified.

## Self-Check: PASSED

**Files exist:**
- `backend/api/src/coach/ai/types.ts` — FOUND
- `backend/api/src/coach/ai/context.ts` — FOUND
- `backend/api/src/coach/ai/db.ts` — FOUND
- `backend/api/src/coach/ai/tools.ts` — FOUND
- `backend/api/src/coach/ai/service.ts` — FOUND

**Commits exist:**
- 913aa73 — FOUND
- 93b6998 — FOUND

**Done criteria:**
- TypeScript compiles clean — PASS
- `grep -c 'coach_chat' credits.ts` = 1 — PASS
- `grep -c 'coachAiRouter' app.ts` = 2 — PASS (import + mount)
- `grep -c 'monitor-cron' vercel.json` = 1 — PASS
