# Phase 41: AI Context Injection - Research

**Researched:** 2026-05-28
**Domain:** Vercel AI SDK v6 (generateText), Hono routing, TanStack Query, React SSE streaming, Supabase migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AI-01: Dashboard Chat Panel**
- D-01: Slide-in right drawer panel on the dashboard page — NOT navigating to `/coach/ai`
- D-02: "Demander à l'IA" button added to DashboardControlBar (right side, after PDF export button)
- D-03: Frontend passes `{ sport, metrics }` as `dashboard_context` in POST body to `POST /coach/ai/chat/stream`; `buildCoachSystemPrompt` extended to inject this block
- D-04: Injected payload: `sport_type` + top-3 latest metric values for the active sport/date range
- D-05: `DashboardChatDrawer.tsx` — reuses `EditChatPanel` / `AIChatClient` SSE streaming pattern

**AI-02/AI-03: Insight Generation**
- D-06: New endpoint `POST /coach/dashboards/:clientId/insights` — receives `{ sport, period, chartData }`, calls Claude, returns `{ chartInsights: Record<string, string>, narrative: string }`
- D-07: One batch `generateText` call returns all per-chart chips + narrative. No per-chart requests
- D-08: Auto-fires when sport selected or date filter changes (same trigger as chart data refetch)
- D-09: Narrative card at top of Sport tab, above 2×2 chart grid. Loading: 2-line skeleton
- D-10: `ChartCard` already has `aiInsight?: string` prop — pass real string. No structural changes needed

**AI-04: Alert Thresholds**
- D-11: New `coach_metric_thresholds` table: `id`, `coach_id`, `client_id`, `sport_type`, `metric_key`, `operator` (`'>' | '<'`), `threshold_value` (numeric), `is_active` (boolean)
- D-12: "Alertes" button in dashboard header opens threshold config modal (add/edit/delete, sport-scoped)
- D-13: Threshold crossing evaluated on dashboard load — insights batch call (or separate lightweight check)
- D-14: Orange/red badge on chart card title when threshold crossed. No push/email in this phase

### Claude's Discretion
- Exact Hono route mounting for insights endpoint (separate file vs extending existing dashboards module)
- Prompt engineering for insights batch call
- Whether threshold evaluation lives inside insights endpoint or separate `/coach/dashboards/:clientId/threshold-check`
- Drawer animation style (GSAP vs CSS transition)

### Deferred Ideas (OUT OF SCOPE)
- Push/email notifications for threshold crossing
- Cron-based threshold evaluation (daily sweep)
- Threshold alerts for the Personnalisé (custom-widget) tab
- Streaming insight generation (SSE)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | Active sport + key dashboard metrics injected into coach chat system prompt | D-03/D-04: extend `buildCoachSystemPrompt` signature; add optional `dashboard_context` field to POST body |
| AI-02 | Dashboard displays AI-generated insight chips on each chart | D-06/D-07: batch `generateText` call returns `chartInsights: Record<string, string>` |
| AI-03 | Dashboard shows one-paragraph AI narrative summary card | D-06/D-07: same batch call returns `narrative: string`; NarrativeSummaryCard above chart grid |
| AI-04 | Coach can set numeric alert thresholds; system flags when crossed | D-11: new `coach_metric_thresholds` table (migration 062); D-13: evaluation in/beside insights endpoint |

</phase_requirements>

---

## Summary

Phase 41 adds four AI capabilities on top of the completed Phase 38–40 dashboard infrastructure. The codebase is already well-structured for this work: `buildCoachSystemPrompt` in `service.ts` has a clear single-argument signature that can be extended to accept an optional `dashboardContext` parameter; the `EditChatPanel`/`AIChatClient` SSE streaming pattern is proven and can be directly reused for the drawer; `generateText` (Vercel AI SDK v6) is already used in `coach/ai/tools.ts` and `routes/ai.ts` for non-streaming AI calls; and the Hono `dashboardsRouter` in `service.ts` is the natural home for the new insights endpoint.

The primary implementation risk is the `DashboardChatDrawer` state wiring — the drawer must lift `sport` and `metrics` state from the dashboard page down to the drawer's fetch call, which means the dashboard page becomes responsible for extracting and summarising the top-3 metrics and passing them to the drawer on every message send. The chart data for these metrics already exists in the `useQuery` results fetched by each sport dashboard component, so no extra network call is needed — the data must be surfaced up to the page level.

The `coach_metric_thresholds` table is the only new Supabase migration needed. Next migration number is **062** (last sequential numeric migration is `061_coach_read_client_program_workouts.sql`; four recent date-prefixed migrations are separate). The insights endpoint evaluation of thresholds is simplest when bundled into the same endpoint (one call, one response containing both `{ chartInsights, narrative, crossedThresholds }`).

**Primary recommendation:** Extend the existing `dashboardsRouter` in `backend/api/src/coach/dashboards/service.ts` with the new `POST /:clientId/insights` route; extend `buildCoachSystemPrompt` with an optional second parameter; create `DashboardChatDrawer.tsx` as a self-contained SSE wrapper following `EditChatPanel`'s pattern; write `NarrativeSummaryCard.tsx` and `AlertesModal.tsx` as standalone components wired into the dashboard page.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard chat drawer (AI-01) | Frontend (React) | API/Backend | Drawer is a UI component; backend only needs a new `dashboard_context` field parsed in existing route |
| System prompt injection (AI-01) | API/Backend | — | `buildCoachSystemPrompt` lives in `backend/api/src/coach/ai/service.ts`; frontend just adds a field to the POST body |
| Insights batch call (AI-02/AI-03) | API/Backend | — | `POST /coach/dashboards/:clientId/insights` calls `generateText`; frontend is a thin consumer |
| Insight/narrative rendering (AI-02/AI-03) | Frontend (React) | — | `ChartCard.aiInsight` prop + `NarrativeSummaryCard` are pure render components |
| Threshold storage (AI-04) | Database/Storage | API/Backend | `coach_metric_thresholds` table + CRUD API routes |
| Threshold evaluation (AI-04) | API/Backend | — | Run inside insights endpoint to avoid a second round-trip |
| Threshold visual badges (AI-04) | Frontend (React) | — | `ChartCard` title bar badge driven by `crossedThresholds[]` from insights response |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version in use | Purpose | Why Standard |
|---------|----------------|---------|--------------|
| `ai` (Vercel AI SDK) | v6.0.116+ | `generateText` for insights batch call; `streamText` already used for chat | Already in `backend/api`; `generateText` usage confirmed in `tools.ts` and `routes/ai.ts` |
| `@ai-sdk/anthropic` | current | Claude model provider | Already used via `AGENT_MODEL` constant in `config/models.ts` |
| `hono` | v4 | Backend router for new insights + thresholds CRUD routes | Already the web framework for all backend routes |
| `@tanstack/react-query` | v5 | `useQuery` for insights fetch with `queryKey: ['dashboard-insights', ...]` | Already used in all sport dashboard components (`PowerliftingDashboard`, etc.) |
| `lucide-react` | current | `MessageCircle`, `Bell`, `X`, `Trash2`, `Loader2` icons | Already imported in `DashboardControlBar.tsx` |
| `@supabase/supabase-js` | current | `coach_metric_thresholds` CRUD via JWT client | Already used throughout coach backend module |

[VERIFIED: codebase grep] — all packages confirmed present via direct file inspection.

### No New Packages Required

This phase introduces no new npm dependencies. Every pattern (SSE streaming, `generateText`, `useQuery`, Tailwind CSS transitions, Supabase CRUD) is already used in the codebase.

---

## Package Legitimacy Audit

> No new packages are installed in this phase. All libraries used are already present in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard Page (page.tsx)
  │
  ├─ DashboardControlBar
  │     ├─ "Demander à l'IA" button  ──► opens DashboardChatDrawer
  │     └─ "Alertes" button          ──► opens AlertesModal
  │
  ├─ NarrativeSummaryCard            ◄── insights.narrative (from useInsights hook)
  │
  ├─ SportDashboard (Powerlifting|Hyrox|…)
  │     └─ ChartCard × 4
  │           ├─ aiInsight            ◄── insights.chartInsights[chartKey]
  │           └─ alertBadge           ◄── crossedThresholds[metricKey]
  │
  ├─ DashboardChatDrawer (slide-in, right)
  │     └─ SSE loop → POST /api/coach/ai/chat/stream
  │           body: { messages, conversation_id, dashboard_context: { sport, metrics } }
  │
  └─ AlertesModal
        ├─ GET  /api/coach/dashboards/:clientId/thresholds  → list thresholds
        ├─ POST /api/coach/dashboards/:clientId/thresholds  → create threshold
        └─ DELETE /api/coach/dashboards/:clientId/thresholds/:id → delete

useInsights hook
  └─ POST /api/coach/dashboards/:clientId/insights
        body: { sport, period, chartData: { summaryMetrics } }
        response: { chartInsights: Record<string, string>, narrative: string, crossedThresholds: ThresholdAlert[] }
              └─ backend: generateText(AGENT_MODEL) + reads coach_metric_thresholds

Backend Hono routes (inside dashboardsRouter):
  POST /:clientId/insights    → generateText → returns JSON
  GET  /:clientId/thresholds  → SELECT from coach_metric_thresholds
  POST /:clientId/thresholds  → INSERT into coach_metric_thresholds
  DELETE /:clientId/thresholds/:id → DELETE from coach_metric_thresholds

Backend coach/ai/service.ts:
  buildCoachSystemPrompt(ctx, dashboardCtx?)  ← extended signature
  POST /chat/stream route  ← reads optional dashboard_context from body
```

### Recommended Project Structure (new files only)

```
apps/web/src/components/coach/dashboard/
  ├── DashboardChatDrawer.tsx       # AI-01: slide-in SSE chat panel
  ├── NarrativeSummaryCard.tsx      # AI-03: narrative above chart grid
  └── AlertesModal.tsx              # AI-04: threshold config modal

apps/web/src/hooks/
  └── useInsights.ts                # TanStack Query wrapper for insights endpoint

backend/api/src/coach/dashboards/
  └── service.ts                    # extend: add /insights, /thresholds CRUD routes
  └── types.ts                      # extend: DashboardInsights, ThresholdAlert, CoachMetricThreshold

backend/api/src/coach/ai/
  └── service.ts                    # extend: buildCoachSystemPrompt + optional DashboardContext
  └── types.ts                      # extend: DashboardContext interface

supabase/migrations/
  └── 062_coach_metric_thresholds.sql   # new migration
```

### Pattern 1: Extending buildCoachSystemPrompt (AI-01)

**What:** Add optional second parameter; append `## Dashboard Context` section when present.  
**When to use:** Called in the `/chat/stream` route handler.

```typescript
// Source: backend/api/src/coach/ai/service.ts (existing function, extend this)
// Add to types.ts:
export interface DashboardContext {
  sport_type: string;  // e.g. "Powerlifting"
  metrics: Record<string, string>;  // e.g. { "1RM Squat (dernier)": "185 kg", "RPE moyen": "8.2", "Tonnage hebdo": "4200 kg" }
}

// Extended function signature:
function buildCoachSystemPrompt(ctx: CoachContext, dashboardCtx?: DashboardContext): string {
  const sections: string[] = [COACH_BASE_SYSTEM];
  // ... existing sections ...

  if (dashboardCtx) {
    const metricLines = Object.entries(dashboardCtx.metrics)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    sections.push(
      `## Dashboard Context\nSport actif: ${dashboardCtx.sport_type}\nIndicateurs récents:\n${metricLines}`
    );
  }

  return sections.join('\n\n');
}
```

**Route handler change** — parse optional field from request body:
```typescript
// In POST /chat/stream route handler (service.ts):
const { messages = [], conversation_id: bodyConversationId, dashboard_context } = await c.req.json<{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversation_id?: string;
  dashboard_context?: DashboardContext;
}>();
// ...
const systemPrompt = buildCoachSystemPrompt(coachCtx, dashboard_context);
```

### Pattern 2: Insights Endpoint (AI-02/AI-03/AI-04)

**What:** `POST /:clientId/insights` added to `dashboardsRouter`. Uses `generateText` for one batch AI call.  
**When to use:** Triggered by `useInsights` hook when sport or dateRange changes.

```typescript
// Source: backend/api/src/coach/dashboards/service.ts (add after /memory routes, before /:clientId)
// IMPORTANT: register at /:clientId/insights — must come BEFORE the catch-all /:clientId GET
// (Hono matches routes in registration order — more specific paths first)
dashboardsRouter.post(
  '/:clientId/insights',
  creditCheck('coach_chat'),
  creditDeduct('coach_chat'),
  async (c) => {
    const { userId: coachId } = c.get('auth');
    const jwt = c.req.header('Authorization')!.slice(7);
    const clientId = c.req.param('clientId');

    const body = await c.req.json<{
      sport: string;
      period: string;
      chartData: Record<string, unknown>;  // compact summary metrics
    }>();

    // Fetch active thresholds for this coach+client+sport
    const db = createUserClient(jwt);
    const { data: thresholds } = await db
      .from('coach_metric_thresholds')
      .select('*')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .eq('sport_type', body.sport)
      .eq('is_active', true);

    // Build compact prompt
    const chartSummary = JSON.stringify(body.chartData, null, 2);
    const prompt = `Tu es un assistant coach sportif expert. Analyse ces données de dashboard pour un athlète en ${body.sport} sur la période ${body.period}.

Données: ${chartSummary}

Réponds UNIQUEMENT en JSON valide avec ce format exact:
{
  "chartInsights": {
    "<chart_key>": "<one-liner max 80 chars>"
  },
  "narrative": "<one paragraph max 200 chars>"
}

Chart keys: ${Object.keys(body.chartData).join(', ')}
Langue: français. Sois concis et actionnable.`;

    const { text } = await generateText({
      model: AGENT_MODEL,
      messages: [{ role: 'user', content: prompt }],
    });

    let parsed: { chartInsights: Record<string, string>; narrative: string };
    try {
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { chartInsights: {}, narrative: '' };
    }

    // Evaluate thresholds against chartData
    const crossedThresholds: Array<{ metric_key: string; operator: string; threshold_value: number; current_value: number }> = [];
    for (const t of (thresholds ?? [])) {
      const currentVal = (body.chartData as any)[t.metric_key];
      if (typeof currentVal === 'number') {
        const crossed = t.operator === '>' ? currentVal > t.threshold_value : currentVal < t.threshold_value;
        if (crossed) crossedThresholds.push({ metric_key: t.metric_key, operator: t.operator, threshold_value: t.threshold_value, current_value: currentVal });
      }
    }

    return c.json({ ...parsed, crossedThresholds });
  }
);
```

### Pattern 3: useInsights Hook (Frontend TanStack Query)

**What:** `useQuery` with automatic refetch on sport/dateRange change.  
**When to use:** Called from the dashboard page when sport is selected.

```typescript
// Source: apps/web/src/hooks/useInsights.ts (new file)
// Pattern mirrors PowerliftingDashboard.tsx useQuery usage [VERIFIED: codebase]
import { useQuery } from '@tanstack/react-query';

interface InsightsResult {
  chartInsights: Record<string, string>;
  narrative: string;
  crossedThresholds: Array<{ metric_key: string; operator: string; threshold_value: number; current_value: number }>;
}

export function useInsights(
  clientId: string,
  sport: string | null,
  dateRange: string,
  chartData: Record<string, unknown> | null,
) {
  return useQuery<InsightsResult>({
    queryKey: ['dashboard-insights', clientId, sport, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/coach/dashboards/${clientId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, period: dateRange, chartData }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!sport && !!chartData,
    staleTime: 120_000,   // 2 min — insights don't need real-time freshness
    gcTime: 300_000,
  });
}
```

### Pattern 4: DashboardChatDrawer SSE Loop (AI-01)

**What:** Self-contained SSE chat panel, follows `EditChatPanel`'s pattern exactly.  
**Key difference from EditChatPanel:** No `configRef`/widget state, but adds `dashboardContext` passed to POST body.

```typescript
// Source: apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx (new)
// SSE loop mirrors EditChatPanel.tsx streamEdit function [VERIFIED: codebase]
const res = await fetch('/api/coach/ai/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: conversationHistory,
    conversation_id: conversationIdRef.current,
    dashboard_context: dashboardContext,  // { sport_type, metrics: Record<string,string> }
  }),
});
// SSE parsing: identical to EditChatPanel — split on '\n\n', parse JSON events
// Event types: 'meta' (conversation_id), 'chunk' (text), 'error', '[DONE]'
```

**CSS drawer animation** (no GSAP dependency — simpler than DashboardEditOverlay):
```tsx
// Tailwind transition — no GSAP import needed
<div
  className={`fixed right-0 top-0 h-full w-[420px] bg-white border-l border-border z-30
    transform transition-transform duration-200 ease-out
    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
>
```

### Pattern 5: Thresholds CRUD Routes

**What:** Three Hono routes added to `dashboardsRouter` for threshold management.  
**Registration order:** Must register `/:clientId/thresholds` BEFORE `/:clientId` GET — Hono matches in order.

```typescript
// GET /:clientId/thresholds
dashboardsRouter.get('/:clientId/thresholds', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('clientId');
  const sport = c.req.query('sport');  // optional filter
  const db = createUserClient(jwt);
  let q = db.from('coach_metric_thresholds').select('*').eq('coach_id', coachId).eq('client_id', clientId);
  if (sport) q = q.eq('sport_type', sport);
  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ thresholds: data });
});

// POST /:clientId/thresholds
dashboardsRouter.post('/:clientId/thresholds', async (c) => { /* INSERT */ });

// DELETE /:clientId/thresholds/:thresholdId
dashboardsRouter.delete('/:clientId/thresholds/:thresholdId', async (c) => { /* DELETE with coach_id check */ });
```

### Anti-Patterns to Avoid

- **Registering `/:clientId/insights` AFTER `/:clientId`:** Hono matches routes in registration order. Specific sub-paths (`/:clientId/insights`) must be registered before the catch-all `/:clientId` GET route or Hono will treat "insights" as a clientId param.
- **Calling `generateText` per chart:** D-07 locks a single batch call. Per-chart calls would multiply latency and cost.
- **Streaming the insights response:** Batch `generateText` returning JSON cannot be streamed as text-delta events — the JSON must be complete before parsing. Do not use `streamText` for this endpoint.
- **Lifting chart raw data (Recharts arrays) to page level for insights:** The insights prompt only needs summary metrics (latest values, averages), not full time series. Extract 3–5 scalar values from the `useQuery` result in each sport dashboard and pass them up via a callback, not the full arrays.
- **Using GSAP for drawer animation:** `DashboardEditOverlay` uses GSAP for a full-screen overlay. The drawer only needs a simple `translate-x` transition — CSS `transition` + Tailwind classes are sufficient and avoid an additional GSAP call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON generation from AI | Custom string concatenation | `generateText` + JSON.parse with `.replace(/\`\`\`json.../)` cleanup | Already used in `tools.ts` line 294 and `ai-programs.ts` — proven pattern |
| SSE reading in browser | Custom EventSource or fetch reader | Copy `EditChatPanel.streamEdit` SSE loop exactly | The buffer-split-on-`\n\n` pattern handles partial chunks; reinventing introduces bugs |
| Threshold evaluation logic | Custom comparison engine | Inline `>` / `<` comparison in the insights endpoint | Two operators, one numeric comparison — no library needed |
| Request auth in new routes | Custom auth check | `authMiddleware` already applied via `dashboardsRouter.use('*', authMiddleware)` | All routes under `dashboardsRouter` are already auth-gated |
| `clientId` scoping for thresholds | Manual coach_id WHERE clause | Supabase RLS + explicit `eq('coach_id', coachId)` | Defense in depth — always scope by both coach_id and client_id |

---

## Common Pitfalls

### Pitfall 1: Hono Route Registration Order
**What goes wrong:** `POST /:clientId/insights` silently returns the dashboard config for a client whose UUID happens to be parsed as `clientId = "insights"` (404 or wrong data).  
**Why it happens:** Hono matches routes in registration order. If `GET /:clientId` is registered before `POST /:clientId/insights`, the new route is never reached.  
**How to avoid:** Register all `/:clientId/sub-path` routes before the bare `/:clientId` GET/PUT/DELETE handlers. In `service.ts`, put insights + thresholds blocks above the `dashboardsRouter.get('/:clientId', ...)` block.  
**Warning signs:** `GET /api/coach/dashboards/insights` returns a 200 with dashboard config instead of a 404.

### Pitfall 2: JSON Parsing of generateText Output
**What goes wrong:** `JSON.parse(text)` throws if Claude wraps output in markdown fences (` ```json ... ``` `).  
**Why it happens:** Claude often wraps JSON output in code fences even when instructed not to.  
**How to avoid:** Always strip with `.replace(/\`\`\`json\n?|\n?\`\`\`/g, '').trim()` before parsing — this is the established pattern in `tools.ts` line 298 and `ai-programs.ts`.  
**Warning signs:** Insights endpoint returns 500; backend logs `SyntaxError: Unexpected token \``.

### Pitfall 3: Stale closures in SSE handlers (drawer)
**What goes wrong:** The `dashboardContext` sent with each message reflects the state at component mount, not the current sport/dateRange.  
**Why it happens:** The `streamChat` callback in `DashStackChatDrawer` captures `dashboardContext` in its closure. If the parent updates `sport` or `metrics`, the closure still holds the old values.  
**How to avoid:** Pass `dashboardContext` as a parameter into the `streamChat` call (not captured at definition time), or use a `useRef` for the current context value — same pattern as `configRef` in `EditChatPanel`.  
**Warning signs:** AI answers about "powerlifting" when the coach switched to "running" before sending.

### Pitfall 4: Missing `dashboard_context` field in TypeScript body type
**What goes wrong:** TypeScript compiles without error but `dashboard_context` is silently `undefined` in the route handler because the destructure doesn't include it.  
**Why it happens:** The existing body type in the `/chat/stream` route only declares `messages` and `conversation_id`. Adding `dashboard_context` to the fetch body without updating the backend type means it is ignored.  
**How to avoid:** Update the `c.req.json<{...}>()` type parameter in the route handler to include `dashboard_context?: DashboardContext`. Add `DashboardContext` to `types.ts`.  
**Warning signs:** `buildCoachSystemPrompt` receives `undefined` for the second argument even when the frontend sends data.

### Pitfall 5: Insights query enabled guard
**What goes wrong:** `useInsights` fires immediately on dashboard mount when `sport` is `null`, returns a 400/422 error, and poisons the TanStack Query cache.  
**Why it happens:** `enabled: !!sport` alone is sufficient, but `chartData` might also be `null` when the sport dashboard data hasn't loaded yet.  
**How to avoid:** Use `enabled: !!sport && !!chartData` — only fire the insights query after the sport dashboard `useQuery` has returned data.  
**Warning signs:** Console shows `POST /api/coach/dashboards/xxx/insights 400` on initial page load before a sport is selected.

### Pitfall 6: Threshold routes shadowing "thresholds" as a clientId
**What goes wrong:** `GET /api/coach/dashboards/thresholds` is treated as `GET /:clientId` with `clientId = "thresholds"` instead of the thresholds list route.  
**Why it happens:** Thresholds routes are nested under `/:clientId`, so they must be `/:clientId/thresholds` — they ARE scoped to a client. If you need a global thresholds list, a different path is required. But per D-12, thresholds are per-client — so all routes are correctly `/:clientId/thresholds`.  
**How to avoid:** Ensure the frontend always includes `clientId` in the path. Registration order: `/thresholds` routes before `/:clientId`.

---

## Runtime State Inventory

> Not applicable — this is a greenfield feature addition, not a rename/refactor.

---

## Environment Availability

> Step 2.6: SKIPPED — Phase 41 introduces no new external tools, CLIs, or services beyond what is already running. Hono backend, Supabase, and Anthropic API are operational (confirmed by prior phases).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v3 `parameters` | AI SDK v6 `inputSchema` | SDK upgrade | Already migrated in this codebase — use `generateText({ model, messages })` not `generate({ model, prompt })` |
| AI SDK v3 `maxSteps` | AI SDK v6 `stopWhen: stepCountIs(n)` | SDK upgrade | Already used in service.ts — insights endpoint uses `generateText` (no steps needed) |
| AI SDK v3 `args` / `result` in tool callbacks | AI SDK v6 `input` / `output` | SDK upgrade | Only relevant if tools are added; insights endpoint has no tools |

**Note:** `generateText` in v6 accepts `{ model, messages, system? }` — no tools needed for the insights batch call. The response object is `{ text: string, usage: ... }`. [VERIFIED: codebase — confirmed usage at `tools.ts:294` and `routes/ai.ts:292`]

---

## Code Examples

### generateText for JSON output (established codebase pattern)

```typescript
// Source: backend/api/src/coach/ai/tools.ts:294 [VERIFIED: codebase]
const { text } = await generateText({
  model: AGENT_MODEL,
  messages: [{ role: 'user', content: programPrompt }],
});
const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
const parsed = JSON.parse(cleaned);
```

### TanStack Query with enabled guard (established pattern)

```typescript
// Source: apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx:68 [VERIFIED: codebase]
const { data, isLoading, error } = useQuery({
  queryKey: ['powerlifting', clientId, sport, dateRange],
  queryFn: () => fetchPowerliftingData(supabase, clientId, dateRange),
  enabled: sport === 'powerlifting',
  staleTime: 60_000,
});
```

### SSE fetch + buffer parsing (established pattern)

```typescript
// Source: apps/web/src/components/coach/dashboard/EditChatPanel.tsx:148 [VERIFIED: codebase]
const res = await fetch(`/api/coach/dashboards/${clientId}/ai-edit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: conversationHistory, currentWidgets: configRef.current }),
});
// Reader + buffer split pattern is in EditChatPanel.tsx lines 162-224
```

### Supabase JWT client pattern (established pattern)

```typescript
// Source: backend/api/src/coach/dashboards/db.ts [VERIFIED: codebase]
const db = createUserClient(jwt);
const { data, error } = await db
  .from('coach_metric_thresholds')
  .select('*')
  .eq('coach_id', coachId)
  .eq('client_id', clientId);
```

---

## Migration 062: coach_metric_thresholds

**Next migration number:** `062` — confirmed by listing `supabase/migrations/` (last sequential numeric file is `061_coach_read_client_program_workouts.sql`). Date-prefixed files (`20260526_*`, `20260527_*`) are separate from the numeric sequence.

**File:** `supabase/migrations/062_coach_metric_thresholds.sql`

```sql
SET LOCAL lock_timeout = '5s';

-- ============================================================
-- Migration 062: coach_metric_thresholds
-- Numeric alert threshold configuration per coach+client+sport.
-- Coach configures thresholds; evaluation happens on dashboard load
-- inside the insights endpoint (Phase 41, AI-04).
-- RLS: coach reads/writes own rows via JWT.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coach_metric_thresholds (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_type       TEXT        NOT NULL,
  metric_key       TEXT        NOT NULL,
  operator         TEXT        NOT NULL CHECK (operator IN ('>', '<')),
  threshold_value  NUMERIC     NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_metric_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_metric_thresholds_own" ON public.coach_metric_thresholds
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Fast lookup on dashboard load (coach+client+sport combo)
CREATE INDEX IF NOT EXISTS idx_coach_metric_thresholds_lookup
  ON public.coach_metric_thresholds(coach_id, client_id, sport_type)
  WHERE is_active = true;

-- End of migration 062.
```

---

## Open Questions (RESOLVED)

1. **Which chart metrics does the insights endpoint receive as ?** — RESOLVED
   - Resolution: Each sport dashboard accepts an  callback prop. The summary contains 3–5 scalar numeric values (last/most recent from the query result). The page collects this summary as  state and passes it to  as . Plan 05 Task 2 specifies the exact scalar keys for all five sports. No  helper function is needed — the extraction logic is inline in a  inside each sport dashboard.

2. **Where does the  hook live in the component tree?** — RESOLVED
   - Resolution: Option (b) selected —  lives in the dashboard page (single source of truth). Each of the five sport dashboards (Powerlifting, Hyrox, Running, Bodybuilding, WeightLoss) accepts  and calls it when their  data loads. The page stores the summary in  state.  is enabled only when both  and  are non-null (Pitfall 5 guard). The  record from the insights response is threaded back down to each sport dashboard via a  prop and from there to each  prop.

3. **Credit gate for insights endpoint** — RESOLVED
   - Resolution:  and  applied to the insights endpoint for consistency with the existing middleware pattern. See Plan 02 Task 1.
## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not yet determined — no test config file found in `apps/web/` or `backend/api/` |
| Config file | Not found — Wave 0 gap |
| Quick run command | `npm run type-check` (TypeScript check as proxy) |
| Full suite command | Not available — no test runner configured |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | Dashboard context injected into system prompt | unit | `npm run type-check` (type safety check) | ❌ Wave 0 |
| AI-01 | Chat drawer opens and sends SSE request with dashboard_context field | manual | Manual browser test | N/A |
| AI-02 | Insight chips populated from batch API response | manual | Manual browser test | N/A |
| AI-03 | Narrative card renders above chart grid | manual | Manual browser test | N/A |
| AI-04 | Threshold CRUD operations work | manual | Manual browser test | N/A |
| AI-04 | Threshold crossing produces badge on ChartCard | manual | Manual browser test | N/A |

### Sampling Rate

- **Per task commit:** `npm run type-check` from repo root
- **Per wave merge:** `npm run type-check` — no automated test suite available
- **Phase gate:** TypeScript clean + manual smoke test of all 4 features before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] No test runner configured in `backend/api/` (no `jest.config.*`, `vitest.config.*` found)
- [ ] `tools.test.ts` exists in `backend/api/src/coach/dashboards/` but no test framework is confirmed active

*(The existing `tools.test.ts` file suggests a test framework may have been intended but not wired up. Planner should check if `vitest` or `jest` is in `backend/api/package.json` before adding new tests.)*

---

## Security Domain

`security_enforcement` not explicitly set to `false` in config — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` on all new routes (already applied to `dashboardsRouter`) |
| V3 Session Management | no | Stateless JWT; no new session state |
| V4 Access Control | yes | RLS on `coach_metric_thresholds` + explicit `coach_id` scoping in every query |
| V5 Input Validation | yes | Validate `operator` field (only `'>' | '<'`), `threshold_value` must be numeric |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: coach reads another coach's thresholds via clientId param | Elevation of Privilege | RLS policy `auth.uid() = coach_id` + explicit `.eq('coach_id', coachId)` in every query |
| Prompt injection via `chartData` | Tampering | chartData is coach-provided context, not user-controlled input; sanitize to scalar values only (no arbitrary strings from client data in the insights prompt) |
| Excessive AI credit consumption (auto-trigger on every sport change) | Denial of Service | `creditCheck('coach_chat')` middleware gates the insights endpoint; user-facing error if credits exhausted |
| Threshold manipulation (coach writes thresholds for another coach's client) | Tampering | `WITH CHECK (auth.uid() = coach_id)` in RLS blocks cross-coach writes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next migration number is `062` | Migration 062 section | Would conflict with another migration at 062; planner should verify by listing migrations at task time |
| A2 | Date-prefixed migrations (`20260526_*`, `20260527_*`) do not affect the `062` sequential slot | Migration 062 section | Low risk — Supabase applies migrations in filename-sort order; `062_` sorts before `2026...` |
| A3 | `creditCheck('coach_chat')` rate is appropriate for the insights endpoint | Open Questions #3 | Possible UX friction if coaches change sport/period frequently and exhaust credits |
| A4 | `tools.test.ts` in `backend/api/src/coach/dashboards/` is not yet wired to a test runner | Validation Architecture | If vitest is configured in `backend/api/package.json`, Wave 0 test gaps are smaller |

---

## Sources

### Primary (HIGH confidence)
- `backend/api/src/coach/ai/service.ts` — `buildCoachSystemPrompt` exact signature, POST /chat/stream body parsing, SSE loop pattern [VERIFIED: codebase]
- `backend/api/src/coach/ai/context.ts` — `fetchCoachContext` two-query pattern [VERIFIED: codebase]
- `backend/api/src/coach/ai/types.ts` — `CoachContext` interface [VERIFIED: codebase]
- `backend/api/src/coach/dashboards/service.ts` — `dashboardsRouter` structure, route registration order, existing `/ai-edit` SSE pattern [VERIFIED: codebase]
- `backend/api/src/coach/dashboards/types.ts` — Dashboard type hierarchy [VERIFIED: codebase]
- `backend/api/src/coach/ai/tools.ts:294` — `generateText` JSON generation pattern [VERIFIED: codebase]
- `backend/api/src/config/models.ts` — `AGENT_MODEL` constant [VERIFIED: codebase]
- `apps/web/src/app/api/coach/[...path]/route.ts` — Next.js proxy pattern [VERIFIED: codebase]
- `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — SSE streaming loop pattern [VERIFIED: codebase]
- `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — GSAP drawer pattern [VERIFIED: codebase]
- `apps/web/src/components/coach/dashboard/ChartCard.tsx` — `aiInsight?: string` prop confirmed [VERIFIED: codebase]
- `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` — button pattern, existing props [VERIFIED: codebase]
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — page component, existing state, DashboardControlBar props [VERIFIED: codebase]
- `supabase/migrations/050_coach_ai_schema.sql` — `coach_alerts` table schema (reference for new `coach_metric_thresholds`) [VERIFIED: codebase]
- `supabase/migrations/` listing — last numeric migration is `061` [VERIFIED: codebase]
- `.planning/config.json` — `nyquist_validation: true`, `commit_docs: true` [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` — chart data shapes, TanStack Query pattern [VERIFIED: codebase]
- `apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx` — full SSE chat client reference [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified present in codebase via direct file inspection
- Architecture: HIGH — patterns verified in existing service.ts, tools.ts, EditChatPanel.tsx
- Migration schema: HIGH — coach_alerts reference table read; schema follows established pattern
- Pitfalls: HIGH — Hono route ordering pitfall is documented in service.ts comment (`L-05`)
- Test coverage: LOW — no test runner found; `tools.test.ts` file exists but runner not confirmed

**Research date:** 2026-05-28  
**Valid until:** 2026-06-28 (30 days — stable stack, no fast-moving dependencies)
