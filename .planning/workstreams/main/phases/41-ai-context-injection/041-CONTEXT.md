# Phase 41: AI Context Injection - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Four AI capabilities on top of the Phases 38–40 dashboard infrastructure:
1. **AI-01** — Slide-in chat drawer on the dashboard page, injecting active sport + top-3 latest metric values into the coach AI system prompt
2. **AI-02** — Per-chart AI insight chips (one-liner per chart card), generated via a single batch API call
3. **AI-03** — Narrative summary card at the top of the Sport dashboard (above chart grid), generated in the same batch call as AI-02
4. **AI-04** — Coach-configurable numeric threshold alerts per metric; evaluated on dashboard load; visual badge on chart cards when crossed; managed via a modal panel

This phase does NOT add new sport dashboards, new chart types, or push/email notifications for alerts.

</domain>

<decisions>
## Implementation Decisions

### AI-01: Dashboard Chat Panel

- **D-01:** The coach sends AI messages via a **slide-in right drawer panel** on the dashboard page itself — NOT by navigating to `/coach/ai`. The drawer overlays the dashboard partially, keeping charts visible.
- **D-02:** The drawer is opened via a **"Demander à l'IA" button added to `DashboardControlBar`** — right side, alongside the existing PDF export button. Single click toggles open/closed.
- **D-03:** When the drawer opens and the coach sends a message, the frontend passes `{ sport, metrics }` as a `dashboard_context` field in the POST body to `POST /coach/ai/chat/stream`. The backend's `buildCoachSystemPrompt` is extended to accept and inject this context block.
- **D-04:** **Injected payload**: `sport_type` (e.g. "Powerlifting") + **top-3 latest metric values** for the active sport/date range (e.g. last estimated 1RM SQ: 185 kg, last RPE avg: 8.2, last weekly tonnage: 4 200 kg). Concise, fits system prompt budget.
- **D-05:** The chat drawer is its own component (e.g. `DashboardChatDrawer.tsx`) — it reuses the `EditChatPanel` / `AIChatClient` streaming pattern already in the codebase, scoped to the coach AI endpoint.

### AI-02/AI-03: Insight Generation

- **D-06:** **New endpoint** `POST /coach/dashboards/:clientId/insights` in `backend/api/src/coach/dashboards/`. Receives `{ sport, period, chartData }` (the same data already fetched for the chart render), calls Claude with a compact prompt, returns `{ chartInsights: Record<string, string>, narrative: string }`.
- **D-07:** **One batch call** returns all per-chart insight chips + the narrative summary in a single AI round-trip. No separate per-chart requests.
- **D-08:** **Trigger:** Auto-fires whenever the sport is selected or the date filter changes (same trigger as chart data re-fetch). Insight chips + narrative show a brief loading skeleton ("Analyse en cours…") while the call is in flight.
- **D-09:** **Narrative card** renders at the **top of the Sport tab, above the 2×2 chart grid** — full-width card with a paragraph + sport icon. Loading state: skeleton with 2 lines.
- **D-10:** `ChartCard` already has `aiInsight?: string` prop — pass the relevant insight string from the batch result directly. No ChartCard structural changes needed.

### AI-04: Alert Thresholds

- **D-11:** **New `coach_metric_thresholds` table** (new migration): `id`, `coach_id`, `client_id`, `sport_type`, `metric_key` (e.g. `'rpe_avg'`), `operator` (`'>' | '<'`), `threshold_value` (numeric), `is_active` (boolean). Clean separation from `coach_alerts` (which logs triggered events).
- **D-12:** **Threshold configuration panel** opens via a **"Alertes" button in the dashboard header** (modal overlay) — shows the coach's configured thresholds for this client + sport, with add/edit/delete. Threshold config is sport-scoped (one set of thresholds per client+sport combo).
- **D-13:** **Detection:** Threshold crossing is evaluated **on dashboard load** — the insights batch call (D-06) or a separate lightweight check reads active thresholds from `coach_metric_thresholds` and compares against the latest metric values. No cron, no Supabase Realtime.
- **D-14:** **Visual flagging:** Crossed thresholds render as an orange/red badge on the relevant chart card title bar. The Alertes modal also lists all currently-crossed thresholds with their current values. No push notification or email in this phase.

### Claude's Discretion

- Exact Hono route mounting for `/coach/dashboards/:clientId/insights` (separate file vs extending existing `dashboards/` module)
- Prompt engineering for the insights batch call (compact system prompt vs few-shot examples)
- Whether threshold evaluation lives inside the insights endpoint or a separate `/coach/dashboards/:clientId/threshold-check` call
- Drawer animation style (mirrors `DashboardEditOverlay` GSAP pattern or CSS transition)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Coach AI

- `backend/api/src/coach/ai/service.ts` — `buildCoachSystemPrompt(ctx: CoachContext)` function to extend with `dashboardContext` parameter; `POST /chat/stream` route to extend with `dashboard_context` field in request body
- `backend/api/src/coach/ai/context.ts` — `fetchCoachContext` pattern to replicate for insight generation
- `backend/api/src/coach/ai/types.ts` — `CoachContext` type to extend with optional `dashboardContext`

### Backend — Dashboards Module

- `backend/api/src/coach/dashboards/` — existing module; new `insights` route goes here
- `backend/api/src/config/models.ts` — `AGENT_MODEL` constant used by all AI calls

### Frontend — Dashboard Page & Components

- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — dashboard page client component; gets "Demander à l'IA" button in DashboardControlBar + DashboardChatDrawer + NarrativeSummaryCard + AlertsModal
- `apps/web/src/components/coach/dashboard/DashboardControlBar.tsx` — existing ControlBar; gets two new buttons: "Demander à l'IA" (opens chat drawer) and "Alertes" (opens alerts modal)
- `apps/web/src/components/coach/dashboard/ChartCard.tsx` — already has `aiInsight?: string` slot; just pass the real string
- `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — reference for slide-in drawer pattern (GSAP, overlay backdrop, panel structure)
- `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — reference for streaming chat panel UI pattern inside a drawer

### Frontend — Chat Streaming Pattern

- `apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx` — streaming chat client pattern to adapt for the dashboard drawer variant
- `apps/web/src/app/api/coach/[...path]/route.ts` — Next.js proxy route that forwards to Hono backend

### Prior Phase Contexts

- `.planning/workstreams/main/phases/40-advanced-dashboard-features/040-CONTEXT.md` — sub-tab strip decisions (D-17–D-21), ControlBar extension pattern, compare mode color scheme
- `.planning/workstreams/main/phases/38-dashboard-foundation-powerlifting/038-CONTEXT.md` — TanStack Query patterns, data fetching architecture, sport dashboard data shapes

### Requirements

- `.planning/workstreams/main/REQUIREMENTS.md` — AI-01, AI-02, AI-03, AI-04 definitions
- `.planning/workstreams/main/ROADMAP.md` §Phase 41 — success criteria (4 criteria)

### Database

- `supabase/migrations/` — existing `coach_alerts` table (Phase 29 migration) for reference before writing `coach_metric_thresholds` migration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `ChartCard` (`apps/web/src/components/coach/dashboard/ChartCard.tsx`): Already has `aiInsight?: string` prop with "Analyse IA disponible en phase 41" placeholder — just pass a real string. No structural changes needed.
- `EditChatPanel` (`apps/web/src/components/coach/dashboard/EditChatPanel.tsx`): Streaming chat panel already in the codebase. `DashboardChatDrawer` should follow this pattern for the SSE message loop.
- `DashboardEditOverlay` (`apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx`): Slide-in drawer with GSAP animation and backdrop. Reference for DashboardChatDrawer structure.
- `buildCoachSystemPrompt` in `service.ts`: Accepts `CoachContext`; extend its signature to `buildCoachSystemPrompt(ctx: CoachContext, dashboardCtx?: DashboardContext)` and append a `## Dashboard Context` section when present.

### Established Patterns

- All AI calls in the coach backend use `AGENT_MODEL` from `config/models.ts` + Vercel AI SDK v6 (`streamText` or `generateText`).
- Insights endpoint should use `generateText` (not `streamText`) — returning structured JSON is simpler with a non-streaming call.
- TanStack Query `useQuery` with `queryKey: ['dashboard-insights', clientId, sport, dateRange]` — stale when sport or dateRange changes, triggers auto-refetch.
- ControlBar already receives `sport`, `dateRange`, `compareMode` state props — extending it with `onOpenChat` and `onOpenAlerts` callbacks follows the same pattern.

### Integration Points

- `POST /coach/ai/chat/stream` body: add optional `dashboard_context: { sport: string; metrics: Record<string, string> }` field. Backend reads this in the route handler and passes to `buildCoachSystemPrompt`.
- New `POST /coach/dashboards/:clientId/insights` endpoint: receives chart data the frontend already has; returns insights JSON + narrative. Also evaluates active thresholds from `coach_metric_thresholds` and returns `crossedThresholds: ThresholdAlert[]`.
- New Supabase migration for `coach_metric_thresholds` table (after migration 059 or current last).

</code_context>

<specifics>
## Specific Ideas

- **Chat drawer**: Same slide-in-from-right pattern as `DashboardEditOverlay` — right-side panel, partial overlay, GSAP or CSS `translate-x` transition. Button label: "Demander à l'IA".
- **Insight chip loading state**: Show skeleton text ("Analyse en cours…") in the `aiInsight` slot while the batch call is in flight. On error, fall back silently (empty string = no chip rendered).
- **Narrative card**: Full-width card above charts with `🧠` icon + client name + paragraph. Same card anatomy as `ChartCard` (white bg, rounded-2xl, border-border, p-6). Loading state: 2-line skeleton.
- **Alert badge**: Orange dot or pill badge on the chart card title when a threshold is crossed (e.g. `RPE avg 8.7 > 8.5`). Color: `#FF5C1A` (warning) or `#EF4444` (critical — if delta > 20%).
- **Metrics injected in AI-01 payload**: top-3 by relevance to sport (Powerlifting: last 1RM SBD, last RPE avg, last weekly tonnage; Running: last pace, weekly km, VO2max estimate; etc.)

</specifics>

<deferred>
## Deferred Ideas

- Push/email notifications when a threshold is crossed — visual flagging only in v1.8; notifications deferred to a future phase
- Cron-based threshold evaluation (daily sweep across all clients) — on-load detection is sufficient for v1.8
- Threshold alerts for the Personnalisé (custom-widget) tab — Sport tab only in Phase 41
- Streaming insight generation (SSE) — batch `generateText` is sufficient; streaming adds complexity without clear UX benefit for one-liner chips

</deferred>

---

*Phase: 41-AI Context Injection*
*Context gathered: 2026-05-28*
