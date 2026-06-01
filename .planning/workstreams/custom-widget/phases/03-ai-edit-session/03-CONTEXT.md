# Phase 03: AI Edit Session — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 03 delivers the full AI editing experience: a full-viewport split-screen
overlay (60% preview / 40% chat) that opens when the coach clicks "Customize",
streams Claude tool call results into a live pending preview via SSE, and closes
cleanly on Save (persist to Supabase) or Cancel (discard). The backend gains
one new SSE endpoint (`POST /coach/dashboards/:clientId/ai-edit`) backed by
4 isolated tool handlers. No DB schema changes (all tables exist from Phase 01).
No new frontend dependencies.

Phase 02's static dashboard is the baseline — this phase makes it editable.

</domain>

<decisions>
## Implementation Decisions

### SSE / Streaming Pattern (INFRA-02b)
- **D-01:** Frontend uses the **custom SSE reader pattern** from `AIChatClient.tsx`
  — `fetch` + `ReadableStream`, parsing `data: {type, ...}` events. No Vercel AI
  SDK `useChat` hook. Consistent with all other AI surfaces in the codebase.
  New event type: `tool_result` carries the new widget array after each tool call.
- **D-02:** SSE event envelope for this endpoint adds one new type to the existing
  set (`meta`, `chunk`, `error`, `[DONE]`):
  ```
  data: {"type":"tool_result","widgets":[...]}
  ```
  Frontend handler: `configRef.current = event.widgets; setPendingWidgets(event.widgets)`
- **D-03:** Backend uses **`streamText` + `onStepFinish`** — text confirmation
  streams token-by-token as `chunk` events; when a tool completes, `onStepFinish`
  emits the `tool_result` SSE event with the full updated widget array.
  Tool execution is atomic (never partial JSON into the preview).
- **D-04:** Reuse the Hono `stream()` wrapper pattern from `coach/ai/service.ts`.
  No new streaming abstraction. Add `tool_result` emission inside `onStepFinish`.

### Tool Signatures (INFRA-02b)
- **D-05:** **4 separate tools** in `coach/dashboards/tools.ts`:
  - `add_widget({ type, config })` — appends a new widget to the array
  - `update_widget({ id, config })` — merges config onto an existing widget by id
  - `remove_widget({ id })` — removes a widget by id
  - `reorder_widgets({ ids: string[] })` — reorders the array by explicit id list
  All 4 tools operate on a local mutable copy of `currentWidgets` (from request
  body) and return the mutated array. Each tool emits one `tool_result` event.
- **D-06:** Tool result payload = **widget array only** `{ widgets: Widget[] }`.
  Claude writes the prose confirmation as a streamed `chunk` — clean separation
  between data (tool result) and prose (assistant message).
- **D-07:** Backend is **stateless** — each `POST /ai-edit` request includes
  `{ messages, currentWidgets }`. Tool handlers mutate from `currentWidgets`
  (the current pending state, not the DB state). No server-side session object.
  `response.messages` is appended to conversation history via `appendMessages()`
  after every turn (PITFALLS: forgetting this is the #1 silent multi-turn failure).

### Split-Screen Overlay
- **D-08:** "Customize" button opens a **full-viewport overlay** — covers the
  entire content area (ClientTabStrip + client header hidden behind it).
  CoachSidebar remains visible. Preview left (60%), chat right (40%). Fixed ratio,
  not user-resizable.
- **D-09:** Overlay **enters with a GSAP fade** (opacity 0→1, ~150ms,
  `power2.out` — same as other coach CRM pages). **Exits instantly** on Save or
  Cancel (snappy resolution, no animation).
- **D-10:** The overlay is a `'use client'` component
  `DashboardEditOverlay.tsx` in `components/coach/dashboard/`. It is rendered
  conditionally in `dashboard/page.tsx` via `{isEditing && <DashboardEditOverlay ... />}`.
  When `isEditing` is false, the static `DashboardGrid` view renders normally.

### Pending State Architecture
- **D-11:** Pending state lives **local to `DashboardEditOverlay`** — no Zustand
  store for the edit session. Two parallel state holders:
  - `const [pendingWidgets, setPendingWidgets] = useState<Widget[]>(initialWidgets)`
    → drives React re-render (the preview pane)
  - `const configRef = useRef<Widget[]>(initialWidgets)` → source of truth inside
    all async SSE handler closures (prevents stale capture)
  Both are updated together on every `tool_result` event.
  Unmounting the overlay discards pending state automatically (no explicit reset).
- **D-12:** `initialWidgets` = the current saved config from `useDashboardConfig`,
  passed as a prop into `DashboardEditOverlay`. The preview starts from the
  current saved state and diverges as tools apply changes.

### Save / Cancel
- **D-13:** **Save** → `PUT /coach/dashboards/:clientId` with `pendingWidgets`,
  then close overlay (set `isEditing = false`). Brief toast: "Dashboard sauvegardé".
  **Cancel** → close overlay immediately (discard pending state). No confirmation
  dialog (PITFALLS: confirmation dialogs destroy the 30s criterion).
- **D-14:** A single `previousConfig` ref holds the pre-session saved state for
  one-tap Undo after Save (brief toast with Annuler link). This is the only
  history mechanism — no undo stack, no version history (PITFALLS: deferred).

### System Prompt & Scope Guard (EDIT-05)
- **D-15:** Dashboard edit session system prompt is scoped: "You are a dashboard
  configuration assistant. You may only call add_widget, update_widget,
  remove_widget, or reorder_widgets. For coaching questions, ask the coach to
  close the editor first." No coaching tools registered in this session.
- **D-16:** Opening message generated server-side and emitted as the first
  `chunk` event on connection: "Votre dashboard affiche actuellement : [widget
  names]. Dites-moi ce que vous souhaitez modifier. Exemples : 'Mettez le score
  de sommeil en premier', 'Supprimez la note', 'Ajoutez un graphe de poids sur
  30 jours'." This eliminates blank-slate paralysis (PITFALLS).

### Credit Gate
- **D-17 (pre-locked L-08):** Credit rate for `/ai-edit` = same as `coach_chat`.
  Use existing `creditCheck` + `creditDeduct` middleware pattern from
  `coach/ai/service.ts`.

### Multi-Turn Integration Test (Day 1 gate)
- **D-18 (pre-locked):** A two-turn integration test MUST pass before any Phase
  03 plan is marked complete:
  - Turn 1: `add_widget` called, widget appears in preview, `response.messages` appended
  - Turn 2: `update_widget` on the widget from turn 1, history correctly referenced
  Test failure = `response.messages` not appended (PITFALLS #1 silent failure).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PITFALLS Checklist (mandatory before any plan is complete)
- `.planning/workstreams/custom-widget/research/PITFALLS.md` — 15-item red flag
  checklist; every item must be explicitly cleared during Phase 03 code review
  (required by success criterion #6)

### Requirements + Roadmap
- `.planning/workstreams/custom-widget/REQUIREMENTS.md` — EDIT-01 through EDIT-05
  and INFRA-02b are Phase 03 scope
- `.planning/workstreams/custom-widget/ROADMAP.md` — Phase 03 success criteria
  (6 must-be-TRUE tests)

### Prior Phase Decisions
- `.planning/workstreams/custom-widget/phases/01-db-api-foundation/01-CONTEXT.md`
  — L-06 (tools.ts isolation), L-07 (stepCountIs(2)), L-08 (credit rate)
- `.planning/workstreams/custom-widget/phases/02-widget-renderers/02-CONTEXT.md`
  — D-12 (useDashboardConfig hook), D-14 (token retrieval), D-22/D-23 (dashboard
  page architecture that DashboardEditOverlay integrates into)

### Existing SSE / Chat Pattern to Replicate
- `apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx` — canonical
  custom SSE reader pattern (fetch + ReadableStream, event type parsing); Phase 03
  replicates this pattern with `tool_result` added
- `backend/api/src/coach/ai/service.ts` — canonical Hono `stream()` + `streamText`
  + `onStepFinish` backend pattern to replicate in `/ai-edit` endpoint
- `apps/web/src/components/coach/ChatInputBar.tsx` — reuse as-is in the chat panel
- `apps/web/src/components/coach/MessageBubble.tsx` — reuse as-is for chat messages

### Dashboard Backend (Phase 01)
- `backend/api/src/coach/dashboards/types.ts` — Widget discriminated union (all 4
  tools operate on these types)
- `backend/api/src/coach/dashboards/schemas.ts` — Zod schemas + DEFAULT_WIDGETS
- `backend/api/src/coach/dashboards/service.ts` — existing CRUD routes; `/ai-edit`
  is added to this bounded context

### Dashboard Frontend (Phase 02)
- `apps/web/src/components/coach/dashboard/DashboardGrid.tsx` — reused in the
  preview pane (inside DashboardEditOverlay, with `isResizable={false}`,
  `isDraggable={false}` in preview mode)
- `apps/web/src/components/coach/dashboard/WidgetRenderer.tsx` — reused as-is
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` —
  modified to add isEditing state + render DashboardEditOverlay

### Credit Gate
- `backend/api/src/middleware/creditGate.ts` — `creditCheck` + `creditDeduct`
  middleware pattern to apply to `/ai-edit`

### Conversation History
- `backend/api/src/context/conversation.ts` — `appendMessages()` called after
  every `/ai-edit` turn with `response.messages`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatInputBar.tsx` — drop-in for the chat panel input; already handles
  Enter/Shift+Enter, disabled state, GSAP send animation
- `MessageBubble.tsx` — reuse for chat message rendering in edit panel
- `DashboardGrid.tsx` — reuse in preview pane with drag/resize disabled
- `WidgetRenderer.tsx` — reuse as-is; receives `widget: Widget` prop
- `stream()` from `hono/streaming` — already used in `coach/ai/service.ts`;
  same import in the new `/ai-edit` handler
- `creditCheck` + `creditDeduct` — already wired in `coach/ai/service.ts`; copy
  the middleware application pattern
- `appendMessages` from `context/conversation.ts` — same call as in `coach/ai`
- `createUserClient(jwt)` from `coach/clients/db.ts` — for the PUT save call
  inside the tool handler (if needed for DB validation)

### Established Patterns
- **SSE event envelope:** `{ type: 'meta' | 'chunk' | 'error' | 'tool_result' }` —
  `tool_result` is the only new type; others are identical to `coach/ai/service.ts`
- **configRef + setState pattern:** PITFALLS mandate — both updated together on
  every `tool_result` event to prevent stale closure in SSE callbacks
- **Stateless request body:** `{ messages, currentWidgets }` — no server session
- **GSAP fade entrance:** `gsap.from(overlayRef.current, { opacity: 0, y: 0, duration: 0.15, ease: 'power2.out' })` — same as AIChatClient page entrance

### Integration Points
- `dashboard/page.tsx` — add `const [isEditing, setIsEditing] = useState(false)`;
  render `<DashboardEditOverlay>` when true; pass `onSave` and `onCancel` handlers
- `coach/dashboards/service.ts` — add `app.post('/:clientId/ai-edit', ...)` route
  at the bottom of the bounded context router
- `/api/coach/dashboards/:clientId/ai-edit` — Next.js proxy route needed (same
  as `/api/coach/ai/chat/stream` proxy that forwards to Hono)

</code_context>

<specifics>
## Specific Ideas

- **Tool result emitted in `onStepFinish`:** The callback receives `stepType` and
  `output`. When `output.toolCalls` exists, iterate and compute the new widget
  array, then `stream.write('data: ' + JSON.stringify({type:'tool_result', widgets}) + '\n\n')`.
- **Opening message timing:** Emit as the very first `chunk` event before any
  user message is processed — part of the connection setup, not a Claude response.
  Alternative: pre-render it as a static "system" bubble in the chat panel on
  mount (no API call needed). Planner chooses approach.
- **`stopWhen: stepCountIs(2)`** — inherited from pre-locked L-07. One tool call
  + one text confirmation per turn. Bounds latency to well under 30s.
- **Preview loading state:** While streaming (between user send and `tool_result`),
  show "Mise à jour du dashboard..." spinner overlay on the preview pane
  (`part.state === input-available` equivalent = `isStreaming === true && tool_result not yet received`).

</specifics>

<deferred>
## Deferred Ideas

- **Undo stack / version history** — PITFALLS-flagged; explicitly deferred. Phase 03
  ships single `previousConfig` ref for one-tap Undo only.
- **Resizable split pane** — user-draggable divider between preview and chat; fixed
  60/40 in Phase 03, could be a Phase 04 polish item.
- **Keyboard shortcuts in edit mode** — Cmd+S to save, Esc to cancel; Phase 04 polish.
- **Widget add UI (non-AI path)** — clicking a "+" button to add a widget without
  typing. Out of scope for Phase 03 (AI-only path). Deferred.

</deferred>

---

*Phase: 03-ai-edit-session*
*Context gathered: 2026-05-27*
