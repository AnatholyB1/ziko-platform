# Phase 29: AI Coach Orchestrator — Context

**Gathered:** 2026-05-22
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 28 (complete 2026-05-21)

<domain>
## Phase Boundary

Phase 29 delivers the **coach-facing AI assistant**: a streaming chat UI at `/coach/ai`, 3 client-aware tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`), a daily background monitoring cron with alerts panel on the dashboard, and a Monday weekly digest email via Resend.

**In scope (AIC-01 through AIC-10):**
- `backend/api/src/coach/ai/` bounded module with its own service.ts, system prompt, and tool schemas
- `/coach/ai` web chat page — full streaming SSE conversation (no history sidebar)
- 3 coach tools registered in the coach-only tool registry (never exposed to athlete)
- `fetchCoachContext(coachId, jwt)` — injects linked clients into system prompt at each request
- `ai_tool_audit` table logging every coach tool invocation
- Daily Vercel cron `0 7 * * *` → `POST /coach/ai/monitor-cron`; Mondays add `?weekly=true` for digest
- `coach_alerts` table stores monitoring results; alerts panel on `/coach/dashboard`
- Resend email for Monday weekly digest (Haiku-generated summary)
- Credit-gated coach AI usage with per-tool cost classes visible to coach
- "Adapter avec l'IA" deep-link button on template pages → `/coach/ai?template=X&client=Y`

**Out of scope:**
- Phase 30: Strava Integration
- Phase 31: Public Marketing `/coachs`
- In-app push notifications (AIC-06 "optional push notification" deferred — alerts panel covers it)
- Conversation history sidebar (deferred to v1.6)
- Athlete-facing coach AI tools (coach tools are coach-only)

</domain>

<decisions>
## Implementation Decisions

### Coach AI Backend Architecture

- **D-01 — New bounded module `backend/api/src/coach/ai/`.**  
  Separate `service.ts` (public entry), `db.ts` (internal), `types.ts` (internal). Mounted at `/coach/ai` in `app.ts`. Pattern matches ARCH-01 (6 bounded modules include `ai`) and prior modules (identity, clients, programs, imports). Zero risk of leaking athlete tools to coach routes.

- **D-02 — Reuse `ai_conversations` + `ai_messages` tables.**  
  Set `plugin_context = {context: 'coach'}` to distinguish coach conversations from athlete ones. No new migration. `getOrCreateConversation`/`appendMessages` from `backend/api/src/context/conversation.ts` reused directly.

- **D-03 — `fetchCoachContext(coachId, jwt)` at each chat request.**  
  Fetches linked client names + IDs from `coach_client_links` using per-request JWT (RLS auto-applies `is_coach_of`). Injected into coach system prompt listing all linked clients. Mirrors existing `fetchUserContext` pattern from `backend/api/src/context/user.ts`.

- **D-04 — Separate coach tool registry (never mixed with athlete `allToolSchemas`).**  
  Coach tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`) live in a `coachToolSchemas` array inside `coach/ai/service.ts` or a `coach/ai/tools.ts` file. Not added to `backend/api/src/tools/registry.ts` — that registry is athlete-facing.

### Web Chat UI

- **D-05 — Full streaming SSE conversation.**  
  Same SSE data format as athlete chat: `{type:'meta', conversation_id}` → `{type:'chunk', content}` → `[DONE]`. Client component uses `fetch` with `ReadableStream`. Real-time streaming, not polling.

- **D-06 — Current session only, no history sidebar.**  
  Page loads last 20 messages from `ai_conversations` on mount. No conversation-switching UI. Simpler scope; history sidebar deferred to v1.6.

- **D-07 — Deep-link entry point from template pages (AIC-07).**  
  Template page gets an "Adapter avec l'IA" button. Navigates to `/coach/ai?template={id}&client={clientId}`. The chat page detects query params, pre-fills the input, and auto-sends on load. No inline panel needed.

### Background Monitoring + Inbox

- **D-08 — Vercel cron: `0 7 * * *` → `POST /coach/ai/monitor-cron`.**  
  Route loops over all coaches (via `coach_profiles` table), runs rule-based SQL alert detection per linked client, writes results to `coach_alerts` table. Pattern identical to Phase 15 cleanup cron.

- **D-09 — Monday weekly digest via `?weekly=true` flag.**  
  Same cron, same route. On Mondays, after alert detection, collects the week's alerts per coach, sends to Haiku for a 1-paragraph coaching summary, then emails via Resend. One route, one cron schedule.

- **D-10 — Alerts surface as a panel on `/coach/dashboard`, not a new page.**  
  Badge on the dashboard CoachSidebar icon showing unread alert count. A dismissible panel below the dashboard header lists alerts: client name, alert type, Haiku suggestion, "Open chat" link. No new `/coach/inbox` page.

- **D-11 — Rule-based SQL detection + Haiku summary per alert.**  
  SQL detects: missed sessions (no `workout_sessions` in 7 days), sleep drop (avg last 3 nights vs prior week), declining mood (journal trend), RPE inflation (avg RPE rising vs target RPE). Each pattern produces a structured alert object; Haiku writes a 1-2 sentence coaching suggestion. Fast, cheap, structured for `ai_tool_audit`.

### Email + Weekly Digest

- **D-12 — Resend for email delivery.**  
  `npm install resend` in `backend/api/`. Adds `RESEND_API_KEY` env var. React Email template for the weekly digest. Free tier: 3,000 emails/month (sufficient for beta coach count).

- **D-13 — Haiku generates the weekly digest email body.**  
  Collect all of a coach's `coach_alerts` from the past 7 days → single Haiku call → 1-paragraph summary per client with key insights and suggested actions. Cheap (1 call/coach/week).

### Claude's Discretion

- Exact Tailwind layout and typography of the `/coach/ai` chat page (message bubbles, input bar, tool-result cards)
- Alert panel UI details (animation, dismiss behavior, "mark all read" vs per-alert dismiss)
- Credit cost class per tool (`analyze_client` = 2 credits? `generate_coaching_program` = 3? — researcher should propose based on token estimates)
- React Email template design for the weekly digest

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + Requirements
- `.planning/ROADMAP.md` §Phase 29 — 5 success criteria, AIC-01..10 mapping
- `.planning/REQUIREMENTS.md` §AI Coach Orchestrator (AIC-01..10) — all 10 requirements

### Architecture Decisions (prior phases)
- `.planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md` — `is_coach_of()` shape; RLS keystone; all coach reads use per-request JWT
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-15 (`force-dynamic` + `revalidate=0` + `cache:'no-store'` mandatory on all coach routes), D-11 (ESLint no-service-role ban)
- `.planning/phases/24-coach-identity-onboarding/24-CONTEXT.md` — D-08 bounded module pattern: `service.ts` public entry, `db.ts` internal, `types.ts` internal

### Existing AI Infrastructure (read before implementing coach AI)
- `backend/api/src/routes/ai.ts` — existing athlete AI chat: SSE streaming pattern, `buildSDKTools`, `buildSystemPrompt`, `logTokenUsage`, `stepCountIs(5)` — coach/ai mirrors this structure
- `backend/api/src/tools/registry.ts` — athlete tool registry; coach tools must NOT be added here
- `backend/api/src/context/user.ts` — `fetchUserContext` — clone this pattern for `fetchCoachContext`
- `backend/api/src/context/conversation.ts` — `getOrCreateConversation` + `appendMessages` — reuse directly
- `backend/api/src/config/models.ts` — `AGENT_MODEL` (Sonnet for coach chat), `VISION_MODEL` (Haiku for alert summaries + digest)

### Credit System (Phase 17/18)
- `.planning/phases/18-credit-service-middleware/18-CONTEXT.md` — `creditCheck`/`creditDeduct` middleware pattern
- `backend/api/src/middleware/creditGate.ts` — existing middleware; coach AI routes must extend with new cost keys
- `backend/api/src/config/credits.ts` — credit cost config; add coach tool cost classes here

### Existing Coach Backend (integration points)
- `backend/api/src/coach/clients/service.ts` — existing client data routes; `analyze_client` tool reads via these same RLS-aware queries
- `backend/api/src/coach/programs/service.ts` — existing program routes; `generate_coaching_program` tool creates programs via same `workout_programs` pattern
- `backend/api/src/app.ts` — mount `coachAiRouter` at `/coach/ai` here (after `importsRouter`)

### Vercel Cron Reference (Phase 15 pattern)
- `backend/api/src/routes/storage.ts` — cleanup cron route pattern to clone for monitor-cron

### Web Architecture
- `apps/web/src/components/coach/CoachSidebar.tsx` — add "AI Coach" nav entry (currently absent); add alert badge counter
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern; add alerts panel here
- `apps/web/src/lib/supabase/server.ts` — `createServerSupabase()` factory for all server components

### DB Schema
- `supabase/migrations/036_workout_programs_ai_imports.sql` — `ai_imports` table for reference; `coach_alerts` will follow same RLS pattern
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` function used by all coach reads including `analyze_client`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/src/routes/ai.ts` — entire SSE streaming + `buildSDKTools` + `logTokenUsage` pattern; coach/ai/service.ts is a close clone with different tools and system prompt
- `backend/api/src/context/user.ts` — `fetchUserContext` — clone as `fetchCoachContext`, replacing athlete queries with `coach_client_links` + `coach_profiles` queries
- `backend/api/src/context/conversation.ts` — `getOrCreateConversation` / `appendMessages` — use as-is
- `backend/api/src/middleware/creditGate.ts` — `creditCheck`/`creditDeduct` — reuse; add new cost keys for coach tools
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern; clone for `/coach/ai` page
- `apps/web/src/components/coach/CoachSidebar.tsx` — add "AI Coach" entry + alert badge

### Established Patterns
- **Bounded module:** `backend/api/src/coach/<module>/{service.ts, db.ts, types.ts}` — service.ts is the only public entry
- **Per-request JWT:** all coach reads use `createUserClient(jwt)` — `is_coach_of` RLS auto-applied; never service role
- **SSE streaming:** `hono/streaming` + `stream()` + for-await on `result.fullStream` (see `routes/ai.ts:211-258`)
- **Vercel cron:** `vercel.json` cron config + protected route with `Authorization: Bearer {CRON_SECRET}` header check
- **`stepCountIs(5)`:** existing cap on tool-call steps; use same for coach chat

### Integration Points
- **`backend/api/src/app.ts`** — add `import { coachAiRouter } from './coach/ai/service.js'` + `app.route('/coach/ai', coachAiRouter)`
- **`vercel.json`** — add cron entry `{ "path": "/coach/ai/monitor-cron", "schedule": "0 7 * * *" }`
- **New migration (next after ~048)** — `coach_alerts` table + `ai_tool_audit` table + RLS on both
- **`apps/web/src/components/coach/CoachSidebar.tsx`** — new "AI Coach" nav entry (flip disabled: false); badge for unread alerts
- **`backend/api/src/config/credits.ts`** — add coach tool cost class constants (researcher should propose values)

</code_context>

<specifics>
## Specific Ideas

- Coach system prompt lists linked clients as a bullet list: "Your linked clients: [name] (id: uuid), [name] (id: uuid)…" — client IDs let the AI call `analyze_client(client_id)` immediately
- Alert panel on dashboard: dismissible card per client (not per alert type) — "3 alertes pour [client X]" with expand/collapse
- Weekly digest email subject: "Votre résumé hebdomadaire — [N] clients à surveiller" (FR default)
- `ai_tool_audit` schema: `id UUID PK, coach_id UUID, tool_name TEXT, target_client_id UUID NULL, args_hash TEXT, result_status TEXT, conversation_id UUID NULL, created_at TIMESTAMPTZ`
- `coach_alerts` schema: `id UUID PK, coach_id UUID, client_id UUID, alert_type TEXT (missed_sessions|sleep_drop|mood_decline|rpe_inflation), severity TEXT (low|medium|high), summary TEXT (Haiku-generated), is_read BOOL DEFAULT false, created_at TIMESTAMPTZ`

</specifics>

<deferred>
## Deferred Ideas

- **In-app push notifications** — AIC-06 mentions "optional push notification"; deferred to v1.6 (no push infra exists)
- **Conversation history sidebar** — listing past coach AI conversations; deferred to v1.6
- **Athlete-facing coach AI tools** — only coach-role users can access these tools in Phase 29
- **Per-domain cost granularity** — e.g., `analyze_client` with `period_days=90` costs more than `period_days=7`; flat per-tool cost in Phase 29

</deferred>

---

*Phase: 29-ai-coach-orchestrator*
*Context gathered: 2026-05-22*
