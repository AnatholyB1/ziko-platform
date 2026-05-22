---
phase: 29-ai-coach-orchestrator
plan: "03"
subsystem: web-frontend
tags: [ai, coach, chat, streaming, sse, components, react]
dependency_graph:
  requires:
    - 29-02 (POST /coach/ai/chat/stream SSE endpoint)
    - backend/api/src/config/credits.ts (COACH_TOOL_COSTS)
  provides:
    - /coach/ai route (server component + client component)
    - apps/web/src/components/coach/MessageBubble.tsx
    - apps/web/src/components/coach/ChatInputBar.tsx
    - apps/web/src/components/coach/CreditWidget.tsx
    - apps/web/src/components/coach/ToolResultCard.tsx
  affects:
    - apps/web/src/components/coach/CoachSidebar.tsx (IA nav item enabled)
tech_stack:
  added: []
  patterns:
    - Server Component force-dynamic + createServerSupabase for auth
    - fetch() ReadableStream SSE consumer (split on \n\n, data: prefix)
    - GSAP entrance animations (page, chips stagger, streaming cursor)
    - Fixed input bar at left:240px (sidebar width w-60)
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/ai/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx
    - apps/web/src/components/coach/MessageBubble.tsx
    - apps/web/src/components/coach/ChatInputBar.tsx
    - apps/web/src/components/coach/CreditWidget.tsx
    - apps/web/src/components/coach/ToolResultCard.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - "accessToken passed as prop server→client, used only in Authorization header — never stored in DOM or localStorage (T-29-10)"
  - "Deep-link ?template + ?client prefill has 500ms auto-send delay after mount (per D-07)"
  - "CoachSidebar IA nav item enabled (disabled: false) as part of this plan"
  - "ToolResultCard GSAP targets .tool-card class; status chip uses .status-chip class"
metrics:
  duration: "25 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
---

# Phase 29 Plan 03: Coach AI Chat UI Summary

**One-liner:** Full `/coach/ai` route with SSE streaming, GSAP-animated chat UI, inline tool result cards, credit balance widget, and deep-link prefill from template pages.

## What Was Built

### Task 1: page.tsx + AIChatClient.tsx — Streaming Chat Core

**`apps/web/src/app/[locale]/(coach)/coach/ai/page.tsx`** — Server Component:
- `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
- Auth via `createServerSupabase()` + redirect to login if no user
- Fetches last coach conversation (`ai_conversations` filtered by `plugin_context: {context:'coach'}`)
- Fetches unread alert count from `coach_alerts` (prop for Plan 04 sidebar badge)
- Extracts `session.access_token` server-side and passes to `AIChatClient`

**`apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx`** — Client Component (`'use client'`):
- State: `messages`, `isStreaming`, `inputValue`, `conversationId`, `error`
- `streamChat()`: adds user message immediately, creates placeholder AI message, reads SSE via `ReadableStream` reader, handles `meta`/`chunk`/`error`/`[DONE]` events
- Deep-link prefill: `useSearchParams()` reads `?template` + `?client`; auto-sends after 500ms
- GSAP: page entrance (y:16→0, opacity 0→1, 200ms), suggestion chips stagger (y:8, 0.06s), streaming cursor blink (sine.inOut, repeat:-1), new bubble appear (y:12, 180ms)
- Empty state: IoSparklesOutline(48, #E2E0DA) + "Commencez une conversation" + description + 3 suggestion chips
- Error state: red card + "Réessayer" button that re-submits last user message

### Task 2: 4 Coach Components

**`apps/web/src/components/coach/MessageBubble.tsx`**:
- User: right-aligned, `bg-[#F0EFE9] rounded-2xl rounded-tr-sm px-4 py-2 max-w-[640px]`
- AI: left-aligned with orange "Z" avatar (32px circle), `bg-white border border-border rounded-2xl rounded-tl-sm`
- `whitespace-pre-wrap` on AI content for multi-line responses

**`apps/web/src/components/coach/ChatInputBar.tsx`**:
- Fixed bottom bar at `left: 240px, right: 0` (matches sidebar w-60)
- Auto-grow textarea (`min-h-[44px] max-h-[120px] resize-none`)
- Enter sends (no Shift+Enter), GSAP scale 0.94 press on send button
- Footer: "Propulsé par Claude Sonnet · 3 outils disponibles"

**`apps/web/src/components/coach/CreditWidget.tsx`**:
- Fetches `GET /credits/balance` on mount with Bearer token; shows `--` on error
- Balance: amber (#F59E0B) at ≤10 credits, red (#EF4444) at 0
- Tool cost chips: hardcoded "Analyser: 2cr · Générer: 3cr · Surveiller: 1cr"

**`apps/web/src/components/coach/ToolResultCard.tsx`**:
- Props: `toolName`, `status`, `args?`, `result?`
- GSAP card entrance (y:8, opacity, 220ms) + status chip transition (scale 0.9→1, 150ms)
- Status chips: blue "En cours...", green "Terminé", red "Échec"
- `generate_coaching_program` success: purple "Programme créé" badge + "Voir le programme →" link

**`apps/web/src/components/coach/CoachSidebar.tsx`** — IA nav item `disabled: false` (was true)

## Commits

| Hash | Message |
|------|---------|
| 0566336 | feat(29-03): add coach AI chat page server component and AIChatClient |
| 1a1d323 | feat(29-03): add MessageBubble, ChatInputBar, CreditWidget, ToolResultCard components |

## Deviations from Plan

None — plan executed exactly as written.

**Minor structural note:** The streaming cursor blink and "Génération en cours..." label are rendered inline within the message list (after the last AI message bubble), rather than as a separate overlay. This matches the UI-SPEC §Streaming State description exactly.

## Known Stubs

None — all components wire to real data:
- `CreditWidget` fetches live from `/credits/balance`
- `AIChatClient` streams from `/coach/ai/chat/stream`
- `ToolResultCard` renders from `toolInvocations` array on messages (plan 02 backend populates this via SSE tool events if implemented — currently the SSE only sends chunk/meta/done, so tool cards render when parent wires `toolInvocations` prop)

**Note on tool invocations:** The current SSE wire format (`chunk`/`meta`/`[DONE]`) does not include tool invocation events. `ToolResultCard` and the `toolInvocations` array on `Message` are wired and ready; they will render when Plan 04 or 05 adds tool event streaming to the SSE format.

## Threat Flags

No new threat surface beyond plan's threat model. T-29-10 mitigation verified: `accessToken` is passed server→client as a prop, used only in `fetch()` Authorization header, never written to DOM or localStorage.

## Self-Check: PASSED

**Files exist:**
- `apps/web/src/app/[locale]/(coach)/coach/ai/page.tsx` — FOUND (contains `force-dynamic`)
- `apps/web/src/app/[locale]/(coach)/coach/ai/AIChatClient.tsx` — FOUND (contains `use client`, `/coach/ai/chat/stream`)
- `apps/web/src/components/coach/MessageBubble.tsx` — FOUND (contains `message-bubble`)
- `apps/web/src/components/coach/ChatInputBar.tsx` — FOUND (contains `fixed bottom-0`, `left: '240px'`)
- `apps/web/src/components/coach/CreditWidget.tsx` — FOUND (contains `IoFlashOutline`)
- `apps/web/src/components/coach/ToolResultCard.tsx` — FOUND (contains `analyze_client`, `tool-card`)

**Commits exist:**
- 0566336 — FOUND
- 1a1d323 — FOUND

**TypeScript:** 0 errors in our files (pre-existing test file error in `safe-next.spec.ts` is unrelated)
