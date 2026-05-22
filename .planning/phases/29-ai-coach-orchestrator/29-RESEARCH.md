# Phase 29: AI Coach Orchestrator — Research

**Researched:** 2026-05-22
**Domain:** Vercel AI SDK v6 streaming, Hono cron routes, Resend email, React Email, GSAP animations, Supabase RLS for audit tables
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — New bounded module `backend/api/src/coach/ai/` with `service.ts` (public), `db.ts` (internal), `types.ts` (internal). Mounted at `/coach/ai` in `app.ts` after `importsRouter`.
- **D-02** — Reuse `ai_conversations` + `ai_messages` tables. Set `plugin_context = {context: 'coach'}` to distinguish. No new migration for conversation storage.
- **D-03** — `fetchCoachContext(coachId, jwt)` at each chat request. Fetches linked clients from `coach_client_links` via RLS JWT. Injected into system prompt.
- **D-04** — Separate coach tool registry (`coachToolSchemas`) inside `coach/ai/service.ts` or `coach/ai/tools.ts`. NOT added to `backend/api/src/tools/registry.ts`.
- **D-05** — Full streaming SSE: `{type:'meta', conversation_id}` → `{type:'chunk', content}` → `[DONE]`. Client uses `fetch` + `ReadableStream`.
- **D-06** — Current session only, no history sidebar. Page loads last 20 messages from `ai_conversations` on mount.
- **D-07** — Deep-link `/coach/ai?template={id}&client={clientId}` auto-sends prefill message on 500ms delay after mount.
- **D-08** — Vercel cron `0 7 * * *` → `POST /coach/ai/monitor-cron`. Loops over all coaches, runs rule-based SQL per linked client, writes to `coach_alerts`.
- **D-09** — Monday weekly digest: same route, same schedule, add `?weekly=true` flag for Mondays.
- **D-10** — Alerts panel on `/coach/dashboard` (not a new page). Badge on sidebar "IA" entry. Dismissible per-alert.
- **D-11** — Rule-based SQL detection: missed sessions (no `workout_sessions` in 7 days), sleep drop (avg last 3 nights vs prior week), declining mood (journal trend), RPE inflation (avg RPE rising vs target).
- **D-12** — Resend for email delivery. `npm install resend` in `backend/api/`. `RESEND_API_KEY` env var. React Email template.
- **D-13** — Haiku generates weekly digest email body. Single Haiku call per coach per week.

### Claude's Discretion

- Exact Tailwind layout and typography of `/coach/ai` chat page — governed by 29-UI-SPEC.md
- Alert panel UI details (animation, dismiss behavior) — governed by 29-UI-SPEC.md
- Credit cost class per tool: `analyze_client=2`, `generate_coaching_program=3`, `monitor_client_alerts=1` (proposed by UI-SPEC, researcher endorses)
- React Email template design — governed by 29-UI-SPEC.md

### Deferred Ideas (OUT OF SCOPE)

- In-app push notifications (AIC-06 "optional push notification")
- Conversation history sidebar (v1.6)
- Athlete-facing coach AI tools
- Per-domain cost granularity (flat per-tool cost in Phase 29)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIC-01 | Coach can chat from `/coach/ai` with context-aware system prompt listing linked clients | D-03 + fetchCoachContext pattern, SSE streaming clone of routes/ai.ts |
| AIC-02 | AI exposes 3 coach tools: `analyze_client`, `generate_coaching_program`, `monitor_client_alerts` | D-04 separate registry, Vercel AI SDK v6 `inputSchema` + `tool()` pattern |
| AIC-03 | `analyze_client` uses per-request JWT (never service role), returns progression/risks/suggestions | `createUserClient(jwt)` pattern from coach/clients/db.ts; SQL queries via is_coach_of RLS |
| AIC-04 | `generate_coaching_program` persists multi-week program (assigned, NOT template), returns program ID | `createProgram` + `assignProgram` pattern from coach/programs/db.ts |
| AIC-05 | `monitor_client_alerts` detects patterns (missed sessions, sleep drop, mood decline, RPE inflation) | Rule-based SQL queries per D-11; writes to `coach_alerts` table (migration 050) |
| AIC-06 | Background job runs monitor every 24h, surfaces results in coach inbox | Vercel cron `0 7 * * *` in vercel.json + CRON_SECRET auth pattern from storage.ts |
| AIC-07 | "Adapt this program for client X" deep-link from template pages | `AdaptWithAIButton` component + `?template=X&client=Y` query params; ProgramsClient update |
| AIC-08 | Monday weekly digest email via Resend + Haiku summary | `resend` npm package + React Email template in `packages/email/`; `?weekly=true` cron flag |
| AIC-09 | Every tool invocation logged to `ai_tool_audit` | Migration 050 `ai_tool_audit` table; fire-and-forget insert from tool executor |
| AIC-10 | Credit-gated coach AI usage with per-tool cost classes | Extend `CREDIT_COSTS` in `credits.ts`; `creditCheck`/`creditDeduct` middleware on chat route |
</phase_requirements>

---

## Summary

Phase 29 adds a coach-facing AI assistant. The backend is a bounded module at `backend/api/src/coach/ai/` that closely mirrors the existing athlete AI at `backend/api/src/routes/ai.ts`. The SSE streaming pattern (hono/streaming + `for await` on `result.fullStream`), the `buildSDKTools`/`buildSystemPrompt` pattern, and the `getOrCreateConversation`/`appendMessages` conversation persistence are all reusable without modification. The key differences are: (1) coach tools use `createUserClient(jwt)` from `coach/clients/db.ts` instead of `clientForUser()` from `tools/db.ts` — because `clientForUser` currently uses service key and bypasses RLS, while coach tools MUST pass user JWT so `is_coach_of` RLS applies; (2) a separate `coachToolSchemas` array never mixed into `allToolSchemas`; (3) a new `fetchCoachContext` that fetches linked clients list rather than personal health data.

The monitoring cron follows the identical CRON_SECRET auth pattern of `storageCleanupRouter`. The next DB migration number is 050 (latest is 049). The `resend` package (v6.12.3) and `@react-email/components` (v1.0.12) are both on npm and slopcheck-clean; `resend` needs to be added to `backend/api/package.json`. GSAP (v3.15.0) is already installed in `apps/web/package.json` — no new install needed. React Email template should live in `packages/email/src/templates/WeeklyDigest.tsx`.

**Primary recommendation:** Clone `routes/ai.ts` as the starting scaffold for `coach/ai/service.ts`, swap `allToolSchemas`+`buildSDKTools` for the 3 coach tools, replace `fetchUserContext` with `fetchCoachContext`, add `is_coach_of` defense-in-depth check inside each tool executor, and wire cron + email on top.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coach AI chat (SSE streaming) | API / Backend | — | Token-level streaming with tool execution; must be server-side to protect API keys and RLS JWT |
| Coach tool execution (analyze, generate, monitor) | API / Backend | Database / Storage | Tool executors run SQL via RLS-scoped client; never in browser |
| `fetchCoachContext` system prompt injection | API / Backend | — | Requires per-request JWT Supabase call; server only |
| `/coach/ai` chat page (SSE client) | Frontend Server (SSR) | Browser / Client | Page.tsx is server component (force-dynamic); AIChatClient.tsx is the client-side ReadableStream consumer |
| Alerts panel | Browser / Client | Frontend Server (SSR) | AlertsPanel reads `coach_alerts` via server component on dashboard page; dismiss is client-side optimistic |
| Background monitoring cron | API / Backend | — | Vercel scheduled serverless function |
| Weekly digest email | API / Backend | — | Resend API call from cron route; no client involvement |
| Credit deduction for coach AI | API / Backend | Database / Storage | `creditCheck`/`creditDeduct` middleware — same as athlete AI |
| Deep-link "Adapter avec l'IA" | Browser / Client | — | Navigation only; ProgramCard/ProgramsClient update |
| `ai_tool_audit` logging | API / Backend | Database / Storage | Fire-and-forget insert from tool executor after each invocation |
| GSAP animations | Browser / Client | — | All animation in Client Components only; never in Server Components |

---

## Standard Stack

### Core (already in project — no new install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | v6.0.116+ | `streamText`, `generateText`, `tool`, `jsonSchema`, `stepCountIs` | Already installed; routes/ai.ts uses exact API |
| `@ai-sdk/anthropic` | installed | `AGENT_MODEL` (Sonnet), `VISION_MODEL` (Haiku) | Already wired in config/models.ts |
| `hono` + `hono/streaming` | installed | SSE streaming route | `stream()` pattern confirmed in routes/ai.ts |
| `@supabase/supabase-js` | installed | `createUserClient(jwt)` for RLS-scoped queries | Required for is_coach_of RLS pass-through |
| `gsap` | 3.15.0 | GSAP animations in AIChatClient + AlertsPanel | Already in `apps/web/package.json` — verified `[VERIFIED: npm registry]` |

### New Installs Required

| Library | Version | Purpose | Install Target |
|---------|---------|---------|---------------|
| `resend` | 6.12.3 | Email delivery for weekly digest | `backend/api/` |
| `@react-email/components` | 1.0.12 | React Email template primitives | `packages/email/` (new package) |
| `react-email` | 6.3.0 | Email template dev preview (devDep) | `packages/email/` (new package) |

**Installation:**
```bash
# In backend/api/
npm install resend

# In packages/email/ (new package)
npm install @react-email/components react
npm install --save-dev react-email typescript
```

**Version verification (performed 2026-05-22):**
- `resend`: 6.12.3 [VERIFIED: npm registry]
- `@react-email/components`: 1.0.12 [VERIFIED: npm registry]
- `react-email`: 6.3.0 [VERIFIED: npm registry]
- `gsap`: 3.15.0 already in `apps/web/package.json` [VERIFIED: codebase]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `resend` | `nodemailer` + SMTP | Resend has simpler API for React Email templates + free 3k/month tier |
| `@react-email/components` | Raw HTML email | React Email provides tested cross-client components; no hand-rolling |
| Separate `packages/email` | Inline in `backend/api` | Separate package enables sharing schema types with web; cleaner boundary |

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| resend | npm | ~3 yrs | ~1M/wk | github.com/resendlabs/resend-node | [OK] | Approved |
| @react-email/components | npm | ~3 yrs | ~500k/wk | github.com/resendlabs/react-email | [OK] | Approved |
| react-email | npm | ~3 yrs | ~500k/wk | github.com/resendlabs/react-email | [OK] | Approved |
| gsap | npm | ~10 yrs | ~4M/wk | greensock/GSAP | [OK] | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Coach Browser
     │
     │  fetch() ReadableStream (SSE)
     ▼
[AIChatClient.tsx] ──POST /coach/ai/chat/stream──►
                                                  [coachAiRouter]
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼            ▼            ▼
                                  fetchCoachContext  getOrCreate  creditCheck
                                  (coach_client_     Conversation  creditDeduct
                                   links via JWT)    (ai_conv.)
                                          │
                                          ▼
                                   streamText(AGENT_MODEL)
                                   + coachToolSchemas
                                   + stopWhen: stepCountIs(5)
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                       analyze_client  generate_  monitor_client
                              │        program        │
                              │           │           │
                    createUserClient(jwt) ◄────────────┘
                    (is_coach_of RLS auto-applied)
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
              Supabase DB           ai_tool_audit
          (sessions, sleep,         (fire-and-forget
           journal, etc.)            INSERT)

Vercel Cron (0 7 * * *) ──► POST /coach/ai/monitor-cron
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                   SQL rule-based        ?weekly=true?
                   alert detection            │
                         │               Haiku summary
                         ▼               per coach
                   coach_alerts INSERT        │
                                             ▼
                                    Resend.emails.send()
                                    (WeeklyDigest template)

Coach Browser (dashboard)
     │
[AlertsPanel.tsx] ──► GET /coach/alerts (from server component)
                         │
                   coach_alerts table (RLS: coach_id = auth.uid())
```

### Recommended Project Structure

```
backend/api/src/coach/ai/
├── service.ts          # Public entry — Hono router + coachAiRouter export
│                       # Contains: chat/stream, monitor-cron routes
│                       # Contains: buildCoachSDKTools, buildCoachSystemPrompt
│                       # Contains: coachToolSchemas array
├── db.ts               # Internal — fetchCoachContext, logAlerts, logToolAudit
│                       #           listCoachesForCron, getCoachAlerts
└── types.ts            # Internal — CoachContext, CoachAlert, AiToolAuditRow

packages/email/
├── package.json        # new workspace package
├── tsconfig.json
└── src/
    └── templates/
        └── WeeklyDigest.tsx   # React Email template

apps/web/src/
├── app/[locale]/(coach)/coach/ai/
│   ├── page.tsx              # Server Component (force-dynamic, revalidate=0)
│   └── AIChatClient.tsx      # Client Component — SSE + GSAP
├── components/coach/
│   ├── AlertsPanel.tsx       # Client Component (dismiss, expand)
│   ├── AlertCard.tsx         # Individual alert card
│   ├── CreditWidget.tsx      # Header credit balance + cost chips
│   ├── ToolResultCard.tsx    # Polymorphic tool result (analyze/generate/monitor)
│   ├── MessageBubble.tsx     # User + AI message rendering (markdown)
│   ├── ChatInputBar.tsx      # Fixed input bar with auto-grow textarea
│   └── AdaptWithAIButton.tsx # Reusable button for template pages
```

### Pattern 1: SSE Streaming — Exact Clone of routes/ai.ts

**What:** `hono/streaming` + `stream()` + `for await` on `result.fullStream`
**When to use:** All streaming AI responses

```typescript
// Source: backend/api/src/routes/ai.ts lines 196-258 (VERIFIED: codebase)
import { stream } from 'hono/streaming';
import { streamText, tool, jsonSchema, stepCountIs } from 'ai';

// In route handler:
const result = streamText({
  model: AGENT_MODEL,
  system: systemPrompt,
  messages: allMessages,
  tools: buildCoachSDKTools(coachId, jwt),
  stopWhen: stepCountIs(5),
  onFinish: ({ totalUsage }) => {
    logTokenUsage(coachId, 'claude-sonnet-4-20250514', totalUsage);
  },
});

c.header('Content-Type', 'text/event-stream');
c.header('Cache-Control', 'no-cache');
c.header('Connection', 'keep-alive');

return stream(c, async (s) => {
  await s.write(
    `data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`,
  );
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      const text = (part as any).textDelta ?? '';
      if (text) await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
    }
    // NOTE: no app_navigate for coach tools — omit that branch
  }
  await s.write('data: [DONE]\n\n');
  // Then appendMessages(...)
});
```

### Pattern 2: Vercel AI SDK v6 Tool Definition

**What:** `tool()` with `inputSchema: jsonSchema(...)` and `execute: async (input) => ...`
**When to use:** All 3 coach tools

```typescript
// Source: backend/api/src/routes/ai.ts lines 93-115 (VERIFIED: codebase)
import { tool, jsonSchema } from 'ai';

const analyzeClientTool = tool({
  description: 'Analyze a linked client\'s training, sleep, mood and nutrition data for a given period.',
  inputSchema: jsonSchema<{ client_id: string; period_days?: number }>({
    type: 'object',
    properties: {
      client_id: { type: 'string', description: 'UUID of the client to analyze' },
      period_days: { type: 'number', description: 'Number of days to look back (default: 30)' },
    },
    required: ['client_id'],
  }),
  execute: async (input) => {
    // input.client_id, input.period_days  ← NOT args.client_id (AI SDK v6)
    const result = await analyzeClientData(input.client_id, input.period_days ?? 30, jwt);
    await logToolAudit({ coachId, toolName: 'analyze_client', targetClientId: input.client_id, conversationId, status: 'success' });
    return result;
  },
});
```

**Critical AI SDK v6 differences (from v3):** [VERIFIED: codebase]
- `inputSchema` (NOT `parameters`)
- `input` in execute callback (NOT `args`)
- `stopWhen: stepCountIs(5)` (NOT `maxSteps: 5`)
- `totalUsage` in `onFinish` (aggregated all steps)

### Pattern 3: Vercel Cron with CRON_SECRET Auth

**What:** Route protected by `Authorization: Bearer {CRON_SECRET}` header check
**When to use:** All Vercel-scheduled routes

```typescript
// Source: backend/api/src/routes/storage.ts lines 131-138 (VERIFIED: codebase)
storageCleanupRouter.post('/cron/cleanup', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // ... handler body
});

// vercel.json entry (VERIFIED: codebase):
// { "path": "/coach/ai/monitor-cron", "schedule": "0 7 * * *" }
// Vercel passes Authorization: Bearer {CRON_SECRET} automatically on Pro tier
```

Note: The cron service does NOT pass a user JWT. The `monitor-cron` handler must use the service key to loop over all coaches, then construct per-coach user clients for each coach's linked clients. The rule-based SQL detection in the cron uses the service client (scanning ALL coaches), but the actual data queries for each client MUST pass the coach's JWT (or reconstruct it via service key + coach_id scoping). Given AIC-06 says "loops over all coaches via coach_profiles", the cron will use service client for the iteration + alert writes, and use service client for the SQL alert detection queries (with explicit `is_coach_of` defense-in-depth check in the query WHERE clause).

### Pattern 4: `createUserClient(jwt)` — RLS-Aware Coach Queries

**What:** Coach tool executors receive the coach's JWT from the SSE handler and pass it to `createUserClient`
**When to use:** ALL data reads inside `analyze_client`, `generate_coaching_program`, `monitor_client_alerts` when called from chat (non-cron)

```typescript
// Source: backend/api/src/coach/clients/db.ts lines 25-34 (VERIFIED: codebase)
export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}
// RLS is_coach_of() applies automatically — coach can only read linked clients
```

**Critical trap:** `clientForUser()` from `tools/db.ts` uses service key — it bypasses RLS. NEVER use it in coach tools. Always use `createUserClient(jwt)` from `coach/clients/db.ts`.

### Pattern 5: Credit Gate Extension

**What:** Add coach-specific action keys to `CREDIT_COSTS` and `CreditAction` type
**When to use:** Credit-gating the `/coach/ai/chat/stream` route

```typescript
// Source: backend/api/src/config/credits.ts (VERIFIED: codebase)
// EXTEND with:
export const CREDIT_COSTS = {
  chat: 4,
  scan: 3,
  program: 4,
  import: 0,
  coach_chat: 4,           // same cost as athlete chat
  coach_analyze: 2,        // lower — tool is called within a chat turn
  coach_generate: 3,       // structured program generation
  coach_monitor: 1,        // mostly SQL, Haiku summary only
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
```

The `/coach/ai/chat/stream` route uses `creditCheck('coach_chat')` + `creditDeduct('coach_chat')`.
Tool-level credit deduction (per tool invocation) is tracked in `ai_tool_audit` but NOT separately credit-gated at the middleware level — the per-chat credit gate covers the conversation. The UI shows tool costs as informational only (per UI-SPEC).

### Pattern 6: Resend Email Send

**What:** `new Resend(key).emails.send()` with React Email rendered template
**When to use:** Monday weekly digest from monitor-cron

```typescript
// [ASSUMED] — Resend API pattern from training knowledge; verify against docs.resend.com
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { WeeklyDigest } from '@ziko/email/templates/WeeklyDigest';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Ziko Coach <coach@ziko-app.com>',
  to: coachEmail,
  subject: `Votre résumé hebdomadaire — ${alertCount} clients à surveiller`,
  react: WeeklyDigest({ coachName, clientSummaries, weekLabel }),
});
```

### Pattern 7: `fetchCoachContext` — Coach System Prompt Data

**What:** Fetches coach profile + linked clients list and injects into system prompt
**When to use:** Every `/coach/ai/chat/stream` request (same as `fetchUserContext` for athletes)

```typescript
// Source: mirrors backend/api/src/context/user.ts (VERIFIED: codebase)
// New implementation in backend/api/src/coach/ai/db.ts

export interface CoachContext {
  coachProfile: { display_name: string | null; specialties: string[] | null } | null;
  linkedClients: Array<{ id: string; name: string | null }>;
}

export async function fetchCoachContext(coachId: string, jwt: string): Promise<CoachContext> {
  const db = createUserClient(jwt);

  const [profileRes, clientsRes] = await Promise.all([
    db.from('coach_profiles').select('display_name, specialties').eq('user_id', coachId).single(),
    db.from('coach_client_links')
      .select('client_id, user_profiles!client_id(name)')
      .eq('coach_id', coachId)
      .is('revoked_at', null)
      // Only active, non-expired links
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
  ]);

  const clients = (clientsRes.data ?? []).map((row: any) => ({
    id: row.client_id,
    name: row.user_profiles?.name ?? null,
  }));

  return {
    coachProfile: profileRes.data ?? null,
    linkedClients: clients,
  };
}
```

**System prompt client list format** (per D-specifics):
```
Your linked clients:
- Marie Dupont (id: uuid-1)
- Thomas Bernard (id: uuid-2)
- Lucas Martin (id: uuid-3)
```

### Pattern 8: GSAP in Next.js Client Components

**What:** `useEffect` + `useRef` for safe GSAP DOM manipulation
**When to use:** AIChatClient.tsx, AlertsPanel.tsx (all specified in 29-UI-SPEC.md)

```typescript
// Source: apps/web/src/app/[locale]/(coach)/coach/imports/ImportsClient.tsx
// lines 182-189 (VERIFIED: codebase)
'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const pageRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (pageRef.current) {
    gsap.from(pageRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    gsap.from('.import-row', { y: 8, opacity: 0, duration: 0.18, stagger: 0.04, ease: 'power2.out' });
  }
}, []);
```

All GSAP patterns from 29-UI-SPEC.md follow this same structure — `gsap.from()` / `gsap.to()` / `gsap.fromTo()` with `duration`, `ease`, `stagger`, `yoyo`, `repeat` props.

### Anti-Patterns to Avoid

- **`clientForUser()` in coach tools:** Uses service key, bypasses RLS. Always use `createUserClient(jwt)` from `coach/clients/db.ts` in chat-triggered tools.
- **Adding coach tools to `allToolSchemas`:** Athletes would gain access to coach tools. Keep `coachToolSchemas` separate.
- **Service role in cron SQL queries:** Cron runs with service key for iteration, but monitoring SQL queries must scope by `coach_id` + `is_coach_of` check explicitly in WHERE clauses.
- **Deducting tool-level credits via middleware:** Tool invocations happen within a single chat turn already credit-gated. Middleware credit gate covers the conversation; tool costs are UI-informational only.
- **Skipping `force-dynamic` on `/coach/ai` page:** All `(coach)` pages require `export const dynamic = 'force-dynamic'; export const revalidate = 0;` per ARCH-06 and Phase 23 D-15.
- **Sending SSE before headers in Hono:** Set `c.header()` values BEFORE calling `stream()`.
- **`parameters` instead of `inputSchema` in AI SDK v6:** Breaking change from v3. All 3 tools must use `inputSchema: jsonSchema(...)`.
- **React Email in SSR Server Component:** React Email `render()` is server-side safe, but the template file must not import browser-only APIs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming | Custom chunked HTTP | `hono/streaming` + `streamText` | Handles backpressure, error events, connection lifecycle |
| AI tool orchestration | Manual multi-step loop | `stopWhen: stepCountIs(5)` in `streamText` | SDK handles tool-call → result → continue loop |
| Email HTML cross-client compatibility | Raw HTML email templates | `@react-email/components` | Email clients (Gmail, Outlook) have major CSS incompatibilities |
| Email delivery | Direct SMTP | `resend` | Handles deliverability, bounces, tracking |
| Credit balance check | Inline balance query | `creditCheck`/`creditDeduct` middleware | Handles premium bypass, free quota, idempotency, 402 error shape |
| Conversation persistence | Custom table | `ai_conversations` + `ai_messages` + `getOrCreateConversation` | Already exists and tested |
| RLS-aware Supabase client | Manual header injection | `createUserClient(jwt)` from `coach/clients/db.ts` | Already wired, tested in 11 prior modules |

**Key insight:** 80% of this phase is wiring existing infrastructure — the streaming pattern, tool framework, conversation persistence, credit gate, RLS client, and cron secret auth are all established. The novel work is: 3 tool executors (SQL queries), `fetchCoachContext`, `coach_alerts`/`ai_tool_audit` migrations, Resend email, and the web chat UI.

---

## DB Schema: New Migration 050

**File:** `supabase/migrations/050_coach_ai_alerts_audit.sql`

Latest migration is `049_ai_imports_bucket.sql` [VERIFIED: codebase — `ls supabase/migrations/`].

### `coach_alerts` table

```sql
CREATE TABLE public.coach_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL CHECK (alert_type IN ('missed_sessions','sleep_drop','mood_decline','rpe_inflation')),
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  summary         TEXT NOT NULL,           -- Haiku-generated 1-2 sentence coaching suggestion
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_alerts ENABLE ROW LEVEL SECURITY;
-- Coach reads own alerts; cron inserts use service key (bypasses RLS)
CREATE POLICY "coach_alerts_own"
  ON public.coach_alerts
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
```

### `ai_tool_audit` table

```sql
CREATE TABLE public.ai_tool_audit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name        TEXT NOT NULL,
  target_client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  args_hash        TEXT,                   -- SHA256 of JSON.stringify(input) for debugging
  result_status    TEXT NOT NULL CHECK (result_status IN ('success','error')),
  conversation_id  UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_tool_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_tool_audit_own"
  ON public.ai_tool_audit
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
-- Cron inserts use service key — no additional policy needed for cron
```

### RLS notes for cron route

The monitor-cron runs without a user JWT. It uses the service key client for:
- SELECT on `coach_profiles` (iterate all coaches)
- SELECT on `coach_client_links` (get each coach's clients)
- SQL alert detection queries on athlete tables (WITH explicit WHERE coach_id/client_id + inline `is_coach_of` check)
- INSERT on `coach_alerts`
- INSERT on `ai_tool_audit`

Service key bypasses RLS — this is acceptable because the cron route is protected by CRON_SECRET and the queries scope explicitly to coach_id + verify is_coach_of via a manual check. [ASSUMED] — This is the same rationale used by the storage cleanup cron. The alternative (per-coach JWT) would require storing coach refresh tokens, which adds complexity out of scope.

---

## app.ts Mount Point

```typescript
// Source: backend/api/src/app.ts (VERIFIED: codebase)
// Add after importsRouter (last current entry):
import { coachAiRouter } from './coach/ai/service.js';
// ...
app.route('/coach/ai', coachAiRouter);
```

## vercel.json Cron Entry

```json
// Source: backend/api/vercel.json (VERIFIED: codebase — existing crons at lines 6-13)
// Add to "crons" array:
{ "path": "/coach/ai/monitor-cron", "schedule": "0 7 * * *" }
```

## CoachSidebar Update

```typescript
// Source: apps/web/src/components/coach/CoachSidebar.tsx line 19 (VERIFIED: codebase)
// Change: disabled: true → disabled: false
// Add: alertCount prop for badge rendering
{ label: 'IA', href: '/fr/coach/ai', icon: IoSparklesOutline, disabled: false },
// + badge when alertCount > 0
```

## React Email Package Structure

The package is new: `packages/email/`. It needs:
- `package.json` with name `@ziko/email` and workspace setup
- `tsconfig.json` extending root
- `src/templates/WeeklyDigest.tsx`

The `packages/coach-sdk/package.json` serves as a reference for the dual ESM/CJS tsup build setup. However, for React Email templates consumed server-side only (backend/api), a simpler setup is acceptable — just TypeScript compilation, no ESM/CJS dual build needed.

---

## Alert Detection SQL Patterns

### Missed Sessions (7 days)
```sql
-- Client has NO workout_sessions in the last 7 days
NOT EXISTS (
  SELECT 1 FROM public.workout_sessions ws
  WHERE ws.user_id = :client_id
    AND ws.started_at > NOW() - INTERVAL '7 days'
)
-- Defense-in-depth: also verify is_coach_of
AND EXISTS (
  SELECT 1 FROM public.coach_client_links ccl
  WHERE ccl.coach_id = :coach_id
    AND ccl.client_id = :client_id
    AND ccl.revoked_at IS NULL
)
```

### Sleep Drop (avg last 3 nights vs prior week)
```sql
-- Compare avg duration_hours: last 3 nights vs 4-10 days ago
WITH recent AS (
  SELECT AVG(duration_hours) AS avg_recent
  FROM public.sleep_logs
  WHERE user_id = :client_id AND sleep_date > NOW() - INTERVAL '3 days'
),
baseline AS (
  SELECT AVG(duration_hours) AS avg_baseline
  FROM public.sleep_logs
  WHERE user_id = :client_id
    AND sleep_date BETWEEN NOW() - INTERVAL '10 days' AND NOW() - INTERVAL '3 days'
)
SELECT avg_recent, avg_baseline,
       (avg_baseline - avg_recent) AS drop_hours
FROM recent, baseline
WHERE (avg_baseline - avg_recent) > 1.0  -- >1h drop triggers alert
```

### Mood Decline (journal trend)
```sql
-- Average mood last 7 days vs prior 7 days
WITH recent_mood AS (
  SELECT AVG(mood) AS avg_recent
  FROM public.journal_entries
  WHERE user_id = :client_id AND logged_at > NOW() - INTERVAL '7 days'
),
baseline_mood AS (
  SELECT AVG(mood) AS avg_baseline
  FROM public.journal_entries
  WHERE user_id = :client_id
    AND logged_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
)
SELECT avg_recent, avg_baseline
FROM recent_mood, baseline_mood
WHERE (avg_baseline - avg_recent) > 0.5  -- >0.5 point drop triggers alert
```

### RPE Inflation
```sql
-- This requires session_sets with rpe column — [ASSUMED] schema exists based on workout_sessions/session_sets tables
-- Detect avg RPE last 7 days > avg RPE prior 14 days by >2 points
```

**Note on RPE:** [ASSUMED] The `session_sets` table has an `rpe` column based on RPE plugin requirements and program schema. Verify column exists before writing RPE inflation query.

---

## Common Pitfalls

### Pitfall 1: Using `clientForUser()` Instead of `createUserClient(jwt)` in Coach Tools
**What goes wrong:** `clientForUser()` in `tools/db.ts` uses service key (bypasses RLS). Coach reads unlinked client data. ARCH-03 violation — CI grep catches `SERVICE_ROLE` but not this subtle pattern.
**Why it happens:** Copy-pasting from athlete tool executors which use `clientForUser()`.
**How to avoid:** Import `createUserClient` from `coach/clients/db.ts` (or re-export from `coach/ai/db.ts`). Add inline comment: `// MUST use JWT client — service key bypasses is_coach_of RLS`.
**Warning signs:** Coach AI can see data for unlinked clients; no error thrown.

### Pitfall 2: AI SDK v6 `parameters` vs `inputSchema`
**What goes wrong:** `parameters:` (v3 API) causes runtime error: "tool.parameters is not a function" or silently ignores the tool.
**Why it happens:** Training data and most examples online still show v3 API.
**How to avoid:** Use `inputSchema: jsonSchema(...)` — confirmed in `routes/ai.ts` line 99.
**Warning signs:** Tools never called; no error in stream (silently ignored).

### Pitfall 3: SSE Headers Must Precede `stream()` Call
**What goes wrong:** Headers not sent to client; browser ReadableStream reader receives wrong Content-Type; streaming fails.
**Why it happens:** Hono's `stream()` sends headers when it writes first bytes. Setting headers after `stream()` has no effect.
**How to avoid:** Always `c.header('Content-Type', 'text/event-stream')` etc. BEFORE the `return stream(c, ...)` call — confirmed pattern in `routes/ai.ts` lines 207-211.

### Pitfall 4: Cron Route Not Protected
**What goes wrong:** Anyone can POST to `/coach/ai/monitor-cron` and trigger unlimited Haiku calls + DB writes.
**Why it happens:** Forgetting CRON_SECRET check.
**How to avoid:** Copy exact guard from `storageCleanupRouter.post('/cron/cleanup', ...)` lines 133-137. The route must NOT use `authMiddleware` (cron doesn't have a user JWT).

### Pitfall 5: Tool Execution Inside SSE — JWT Not Threaded
**What goes wrong:** Coach tool executors need the coach's JWT to create `createUserClient(jwt)`. If the JWT is not threaded from the SSE handler into the tool closure, queries fall back to service key or fail.
**Why it happens:** Tools are defined outside the route handler, but need per-request state.
**How to avoid:** Define `buildCoachSDKTools(coachId, jwt)` as a factory function called inside the handler (same as `buildSDKTools(userId, userToken)` in `routes/ai.ts` line 93). The `jwt` is captured in the closure.

### Pitfall 6: Conversation `plugin_context` Not Set for Coach
**What goes wrong:** Coach conversations appear in athlete AI conversation list; or future filtering breaks.
**Why it happens:** `getOrCreateConversation` creates with no `plugin_context` by default.
**How to avoid:** When inserting new `ai_conversations`, set `plugin_context = '{"context":"coach"}'::jsonb`. This requires passing an options object or using the Supabase insert directly.

### Pitfall 7: Monday Cron Trigger Logic
**What goes wrong:** Weekly digest sent every day, or never sent on Mondays.
**Why it happens:** `?weekly=true` is appended by Vercel to the cron URL — but Vercel doesn't do this automatically. The cron route must check the current day of week server-side.
**How to avoid:** In the cron handler, check `new Date().getUTCDay() === 1` (Monday = 1) to trigger the weekly digest path. The `?weekly=true` URL variation from CONTEXT.md refers to using a query param as a manual override; the automatic Monday trigger is day-of-week detection in the handler.

### Pitfall 8: `react-email` Render in Vercel Serverless
**What goes wrong:** `render()` from `@react-email/components` may fail if JSX transform is not configured.
**Why it happens:** React Email templates are JSX; `backend/api/` must have `"jsx": "react-jsx"` in tsconfig.
**How to avoid:** Verify `backend/api/tsconfig.json` has `"jsx": "react-jsx"` or use `render()` from `@react-email/render` with pre-compiled templates.

---

## Code Examples

### Analyze Client Tool — Core Structure
```typescript
// Source: pattern mirrors backend/api/src/routes/ai.ts buildSDKTools (VERIFIED: codebase)
// New code in backend/api/src/coach/ai/service.ts

import { tool, jsonSchema } from 'ai';
import { createUserClient } from '../clients/db.js';

function buildCoachSDKTools(coachId: string, jwt: string, conversationId: string) {
  return {
    analyze_client: tool({
      description: 'Analyze a linked client\'s training, sleep, mood and nutrition data. Returns progression metrics, risk signals, and coaching suggestions.',
      inputSchema: jsonSchema<{ client_id: string; period_days?: number }>({
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          period_days: { type: 'number', default: 30 },
        },
        required: ['client_id'],
      }),
      execute: async (input) => {
        const db = createUserClient(jwt);  // NOT clientForUser()
        // Defense-in-depth: verify is_coach_of before any data read
        const { data: link } = await db
          .from('coach_client_links')
          .select('id')
          .eq('coach_id', coachId)
          .eq('client_id', input.client_id)
          .is('revoked_at', null)
          .maybeSingle();
        if (!link) throw new Error('Client not linked to this coach');
        // ... fetch sessions, sleep, mood, RPE for period_days
        // Fire-and-forget audit log
        logToolAudit({ coachId, toolName: 'analyze_client', targetClientId: input.client_id, conversationId, status: 'success' });
        return { progression: {}, risks: [], suggestions: [] };
      },
    }),
    // generate_coaching_program, monitor_client_alerts follow same structure
  };
}
```

### Generate Coaching Program Tool
```typescript
// Uses assignProgram() from coach/programs/db.ts (VERIFIED: codebase — service.ts line 246)
// generate_coaching_program creates a workout_programs row with is_template=FALSE
// and assigned_to_user_id = input.client_id
execute: async (input) => {
  // 1. Use generateText(AGENT_MODEL) with a structured prompt to build weeks_data JSON
  // 2. Call createProgram(jwt, coachId, { ..., is_template: false, assigned_to_user_id: input.client_id })
  //    from coach/programs/db.ts
  // 3. Return { program_id, name, weeks_count }
}
```

### AlertsPanel Loading Pattern (Server Component → Client Component)
```typescript
// Source: pattern from apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx (VERIFIED: codebase)
// dashboard/page.tsx is Server Component:
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Fetch alerts server-side with user JWT:
const { data: alerts } = await supabase
  .from('coach_alerts')
  .select('*')
  .eq('coach_id', user.id)
  .eq('is_read', false)
  .order('created_at', { ascending: false })
  .limit(10);

return (
  <div className="flex flex-col gap-8">
    <WelcomeCard ... />
    <AlertsPanel initialAlerts={alerts ?? []} coachId={user.id} accessToken={accessToken} />
  </div>
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `parameters` in AI SDK tool | `inputSchema: jsonSchema(...)` | AI SDK v6 | Breaking rename; all tools must use new API |
| `maxSteps` in streamText | `stopWhen: stepCountIs(N)` | AI SDK v6 | Breaking rename |
| `args` in tool execute | `input` in tool execute | AI SDK v6 | Breaking rename |
| `result` in tool execute | `output` in tool execute (when returning) | AI SDK v6 | Impacts tool result inspection |
| `usage` (final step only) | `totalUsage` (aggregated all steps) in onFinish | AI SDK v6 | Token logging must use `totalUsage` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resend `emails.send()` API shape with `react:` prop | Pattern 6 | Breaking — verify docs.resend.com before implementation |
| A2 | `session_sets` table has `rpe` column for RPE inflation detection | Alert Detection SQL | Missing column = RPE alert type unusable; can be descoped to v1.6 |
| A3 | Monitor-cron uses service key for iteration + explicit coach_id WHERE scoping (not per-coach JWT) | Pattern 3 + DB Schema | Acceptable trade-off; alternative requires stored refresh tokens |
| A4 | React Email `render()` works in backend/api serverless without additional JSX config changes | Pitfall 8 | Build failure; mitigation: check backend/api/tsconfig.json before implementing email |
| A5 | `packages/email` as a new workspace package (not inlined in backend/api) | Architecture Patterns | Low risk — inline approach also works; package structure aligns with ARCH-04 monorepo conventions |

---

## Open Questions

1. **RPE Inflation Data Source**
   - What we know: `session_sets` table exists; RPE plugin calculates RPE
   - What's unclear: Whether `session_sets.rpe` column is populated, or if RPE is stored elsewhere
   - Recommendation: Check `supabase/migrations/012_new_plugins_schema.sql` or `session_sets` schema before writing the RPE inflation query. If column doesn't exist, descope RPE alert to v1.6.

2. **`ai_conversations` `plugin_context` Insert Override**
   - What we know: `getOrCreateConversation` inserts with no `plugin_context`
   - What's unclear: Whether `plugin_context` column accepts JSONB insert via the existing function signature
   - Recommendation: The coach chat handler should insert the `ai_conversations` row directly (not via `getOrCreateConversation`) to control `plugin_context`, then use `appendMessages` for message persistence.

3. **`packages/email` Workspace Registration**
   - What we know: `packages/coach-sdk` is a workspace package in root `package.json`
   - What's unclear: Root `package.json` workspace globs — does `packages/*` pattern cover new `packages/email`?
   - Recommendation: Check root `package.json` `workspaces` field before creating `packages/email`. If glob is `packages/*`, no change needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | backend/api | ✓ | (Vercel runtime) | — |
| `gsap` | apps/web animations | ✓ | 3.15.0 | CSS transitions (inferior) |
| `resend` | Weekly digest email | ✗ (not yet installed) | 6.12.3 on npm | Skip email, log only |
| `@react-email/components` | WeeklyDigest template | ✗ (not yet installed) | 1.0.12 on npm | HTML string template (inferior) |
| `RESEND_API_KEY` env var | Resend send | ✗ (needs provisioning) | — | Skip email in dev |
| `CRON_SECRET` env var | monitor-cron auth | ✓ (used by storage cron) | set | — |
| Vercel Pro | Cron jobs | ✓ (confirmed Phase 23) | — | — |

**Missing dependencies with no fallback:**
- `resend` npm package (install step required in Wave 0)
- `RESEND_API_KEY` (provision from resend.com + add to Vercel env vars)

**Missing dependencies with fallback:**
- `@react-email/components` — could use HTML string template as fallback, but React Email is strongly preferred for cross-client compatibility

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already installed in backend/api + apps/web) |
| Config file | `backend/api/vitest.config.ts` |
| Quick run command | `npx vitest run --passWithNoTests` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIC-01 | fetchCoachContext returns linked clients | unit | `vitest run coach/ai/db.spec.ts` | ❌ Wave 0 |
| AIC-02 | buildCoachSDKTools returns 3 tools with correct inputSchema | unit | `vitest run coach/ai/service.spec.ts` | ❌ Wave 0 |
| AIC-03 | analyze_client rejects unlinked client (403 semantics) | unit | `vitest run coach/ai/tools.spec.ts` | ❌ Wave 0 |
| AIC-04 | generate_coaching_program creates program with is_template=false | unit | `vitest run coach/ai/tools.spec.ts` | ❌ Wave 0 |
| AIC-05 | monitor_client_alerts detects missed_sessions pattern | unit | `vitest run coach/ai/alerts.spec.ts` | ❌ Wave 0 |
| AIC-06 | monitor-cron route rejects missing CRON_SECRET | unit | `vitest run coach/ai/cron.spec.ts` | ❌ Wave 0 |
| AIC-07 | AdaptWithAIButton navigates to correct URL with template+client params | smoke | manual browser | — |
| AIC-08 | Weekly digest email renders valid HTML (React Email) | unit | `vitest run email/WeeklyDigest.spec.ts` | ❌ Wave 0 |
| AIC-09 | ai_tool_audit row inserted after tool execution | integration | `vitest run coach/ai/audit.spec.ts` | ❌ Wave 0 |
| AIC-10 | creditCheck('coach_chat') returns 402 on zero balance | unit | (existing credit tests cover pattern) | ✓ |

### Wave 0 Gaps
- [ ] `backend/api/src/coach/ai/db.spec.ts` — covers AIC-01, AIC-03
- [ ] `backend/api/src/coach/ai/service.spec.ts` — covers AIC-02
- [ ] `backend/api/src/coach/ai/tools.spec.ts` — covers AIC-03, AIC-04
- [ ] `backend/api/src/coach/ai/alerts.spec.ts` — covers AIC-05
- [ ] `backend/api/src/coach/ai/cron.spec.ts` — covers AIC-06
- [ ] `packages/email/src/templates/WeeklyDigest.spec.tsx` — covers AIC-08 (render to string)
- [ ] `backend/api/src/coach/ai/audit.spec.ts` — covers AIC-09

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Hono `authMiddleware` (Supabase JWT validation) on all `/coach/ai` routes |
| V3 Session Management | partial | Conversations are per-user via `ai_conversations.user_id` RLS |
| V4 Access Control | yes | `is_coach_of` RLS on all coach data reads; defense-in-depth in tool executors |
| V5 Input Validation | yes | `inputSchema: jsonSchema(...)` on tool inputs; UUID regex on client_id params |
| V6 Cryptography | no | No new crypto required; JWT handled by existing auth middleware |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Coach reads unlinked client's data via tool | Elevation of Privilege | `createUserClient(jwt)` + `is_coach_of` RLS + inline defense-in-depth check in tool executor |
| Unauthenticated cron trigger | Elevation of Privilege / DoS | CRON_SECRET check before any processing |
| Prompt injection via client name in system prompt | Tampering | Client names are fetched from DB (not user-supplied in request body); system prompt injection risk is low |
| Excessive AI credit consumption via tool chaining | DoS | `stopWhen: stepCountIs(5)` caps tool-call depth; `creditCheck('coach_chat')` gates the conversation |
| Tool audit log tampering | Repudiation | `ai_tool_audit` RLS: `coach_id = auth.uid()` for reads; cron inserts use service key (trusted server path) |

---

## Sources

### Primary (HIGH confidence)
- `backend/api/src/routes/ai.ts` — Complete SSE streaming pattern, buildSDKTools, stepCountIs, onFinish totalUsage [VERIFIED: codebase]
- `backend/api/src/context/user.ts` — fetchUserContext pattern to clone [VERIFIED: codebase]
- `backend/api/src/context/conversation.ts` — getOrCreateConversation, appendMessages [VERIFIED: codebase]
- `backend/api/src/middleware/creditGate.ts` — creditCheck, creditDeduct, CreditAction type [VERIFIED: codebase]
- `backend/api/src/config/credits.ts` — CREDIT_COSTS shape to extend [VERIFIED: codebase]
- `backend/api/src/config/models.ts` — AGENT_MODEL, VISION_MODEL [VERIFIED: codebase]
- `backend/api/src/routes/storage.ts` — CRON_SECRET auth pattern [VERIFIED: codebase]
- `backend/api/src/coach/clients/db.ts` — createUserClient(jwt) [VERIFIED: codebase]
- `backend/api/src/coach/clients/service.ts` — Route registration patterns, JWT extraction [VERIFIED: codebase]
- `backend/api/src/coach/programs/service.ts` — createProgram, assignProgram pattern [VERIFIED: codebase]
- `backend/api/src/app.ts` — Mount point after importsRouter [VERIFIED: codebase]
- `backend/api/vercel.json` — Existing cron entries pattern [VERIFIED: codebase]
- `apps/web/src/components/coach/CoachSidebar.tsx` — IA nav item disabled:true to flip [VERIFIED: codebase]
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern [VERIFIED: codebase]
- `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` — ProgramCard integration point [VERIFIED: codebase]
- `apps/web/src/app/[locale]/(coach)/coach/imports/ImportsClient.tsx` — GSAP usage pattern [VERIFIED: codebase]
- `apps/web/package.json` — gsap 3.15.0 already installed [VERIFIED: codebase]
- `supabase/migrations/` — Latest migration is 049; next is 050 [VERIFIED: codebase]
- `packages/coach-sdk/package.json` — Workspace package structure reference [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `slopcheck` results: resend, @react-email/components, react-email, gsap all [OK] [VERIFIED: slopcheck]
- `npm view resend version` → 6.12.3; `npm view @react-email/components version` → 1.0.12 [VERIFIED: npm registry]

### Tertiary (LOW confidence / ASSUMED)
- Resend `emails.send({ react: Component })` API shape — [ASSUMED]
- `session_sets.rpe` column existence — [ASSUMED]
- React Email render compatibility with backend/api tsconfig — [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing deps verified in codebase; new deps verified via npm + slopcheck
- Architecture: HIGH — bounded module pattern is established across 5 prior modules; SSE clone is exact
- Pitfalls: HIGH — `clientForUser` vs `createUserClient` trap is concrete and testable; SDK v6 diffs verified in codebase
- DB schema: HIGH — migration 050 naming verified; table schemas derived from CONTEXT.md specifics
- Email integration: MEDIUM — Resend package verified; exact API call shape is ASSUMED

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable stack; AI SDK v6 API unlikely to change)
