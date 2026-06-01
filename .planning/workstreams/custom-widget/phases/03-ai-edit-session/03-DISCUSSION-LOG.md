# Phase 03: AI Edit Session - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 03-ai-edit-session
**Areas discussed:** SSE / chat hook, Tool signature design, Split-screen layout, Pending state architecture

---

## SSE / Chat Hook

| Option | Description | Selected |
|--------|-------------|----------|
| Custom SSE + tool_result event | Extend existing AIChatClient pattern; new `tool_result` event type carries widget array; no new dependency | ✓ |
| Vercel AI SDK useChat hook | Native toolInvocations / part.state handling but breaks consistency with AIChatClient | |

**User's choice:** Custom SSE + tool_result event
**Notes:** Consistency with existing codebase pattern was the deciding factor.

| Option | Description | Selected |
|--------|-------------|----------|
| streamText + onStepFinish | Text streams live; tool_result emitted atomically on step completion | ✓ |
| generateText (fully atomic) | No streaming — everything waits for complete response; kills streaming UX | |

**User's choice:** streamText + onStepFinish

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse stream() from coach/ai/service.ts | Copy pattern, add tool_result emission in onStepFinish | ✓ |
| Dedicated streamingResponse helper in coach/dashboards/ | Typed utility but extra module for single endpoint | |

**User's choice:** Reuse stream() pattern

---

## Tool Signature Design

| Option | Description | Selected |
|--------|-------------|----------|
| 4 separate tools | add_widget / update_widget / remove_widget / reorder_widgets; targeted mutations | ✓ |
| 1 composite update_dashboard_config | Full array replacement every turn; simpler schema | |

**User's choice:** 4 separate tools — matches success criteria wording ("Claude calls add_widget")

| Option | Description | Selected |
|--------|-------------|----------|
| Request-scoped (stateless) | currentWidgets in request body; no server session | ✓ |
| Server-side session state | Mutable editSession object per coach+client; requires cleanup | |

**User's choice:** Request-scoped — stateless backend

| Option | Description | Selected |
|--------|-------------|----------|
| Widget array only in tool result | Claude writes prose confirmation separately as streamed chunk | ✓ |
| Array + confirmation text in tool result | Eliminates Claude text step but feels robotic | |

**User's choice:** Widget array only

---

## Split-Screen Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Full viewport overlay | Covers ClientTabStrip + client header; max preview real estate | ✓ |
| In-tab, within dashboard page | Stays within tab bounds; cramped on 1280px | |

**User's choice:** Full viewport overlay

| Option | Description | Selected |
|--------|-------------|----------|
| 60 / 40 split | Preview 60%, chat 40%; comfortable for 2-3 visible bubbles | ✓ |
| 50 / 50 | Equal; preview tight with 4+ widgets | |
| 65 / 35 | Preview dominant; chat very narrow | |

**User's choice:** 60 / 40

| Option | Description | Selected |
|--------|-------------|----------|
| Fade-in on enter, instant on exit | GSAP fade ~150ms open; instant close | ✓ |
| No animation | Pure toggle; simpler | |

**User's choice:** Fade-in on enter, instant on exit

---

## Pending State Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Local component state + useRef | useState for render, useRef for async closures; unmount discards automatically | ✓ |
| Zustand editSessionStore | Persists across remounts; requires explicit reset; more ceremony | |

**User's choice:** Local component state + useRef

| Option | Description | Selected |
|--------|-------------|----------|
| configRef.current + setPendingWidgets | Both updated on tool_result; ref is closure source of truth | ✓ |
| State only, no ref | Simpler but causes stale closure on rapid sequential tool calls (PITFALLS #1) | |

**User's choice:** configRef.current + setPendingWidgets (PITFALLS pattern)

| Option | Description | Selected |
|--------|-------------|----------|
| { messages, currentWidgets } | Full pending state in request body; stateless backend | ✓ |
| { messages } only | Backend reads from DB; misses unsaved pending changes on turn 2+ | |

**User's choice:** { messages, currentWidgets }

---

## Claude's Discretion

- Opening message delivery: server-side first `chunk` event vs static pre-rendered bubble on mount — planner decides
- Exact wording of the opening message (French) — planner/executor writes it
- Toast implementation detail for Save confirmation

## Deferred Ideas

- Undo stack / version history — PITFALLS-flagged; explicitly deferred
- Resizable split pane divider — Phase 04 polish
- Keyboard shortcuts (Cmd+S, Esc) — Phase 04 polish
- Widget add UI without AI (+ button) — deferred; Phase 03 is AI-only path
