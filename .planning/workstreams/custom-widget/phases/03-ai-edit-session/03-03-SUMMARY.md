---
phase: 03-ai-edit-session
plan: "03"
subsystem: ui
tags: [react, gsap, sse, typescript, dashboard, streaming]

requires:
  - phase: 03-01
    provides: Backend SSE endpoint /ai-edit + tool handlers
  - phase: 03-02
    provides: DashboardGrid, WidgetRenderer, Widget types, ChatInputBar, MessageBubble

provides:
  - DashboardEditOverlay: full-viewport 60/40 split-screen overlay with GSAP entrance
  - EditChatPanel: custom SSE consumer with configRef stale-closure guard
  - TypingIndicator: 3-dot CSS animation (0/200/400ms stagger)
  - PreviewLoadingOverlay: spinner backdrop during tool execution
  - SaveToast: GSAP slide-in + 3s auto-dismiss + Undo link

affects:
  - dashboard/page.tsx (must render DashboardEditOverlay conditionally)
  - Phase 04 polish (keyboard shortcuts, resizable pane)

tech-stack:
  added: []
  patterns:
    - "configRef + useState dual-update: both updated on every tool_result to prevent stale SSE closure"
    - "Custom SSE reader: fetch + ReadableStream buffer split on \\n\\n (no useChat hook)"
    - "GSAP fade entrance only (no exit animation) — snappy resolution pattern"
    - "Static opening message pre-populated on useState init (no API call)"

key-files:
  created:
    - apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx
    - apps/web/src/components/coach/dashboard/EditChatPanel.tsx
    - apps/web/src/components/coach/dashboard/TypingIndicator.tsx
    - apps/web/src/components/coach/dashboard/PreviewLoadingOverlay.tsx
    - apps/web/src/components/coach/dashboard/SaveToast.tsx
  modified: []

key-decisions:
  - "D-01 enforced: custom SSE fetch reader, no useChat — consistent with AIChatClient.tsx"
  - "D-09 enforced: GSAP opacity 0→1 150ms on mount, instant unmount (no exit animation)"
  - "D-11 enforced: configRef.current AND setPendingWidgets both called in onWidgetsUpdate"
  - "D-16 enforced: opening message is static Message object in useState init, no API call"
  - "PITFALLS #5: configRef.current used in POST body construction, not pendingWidgets state"
  - "PITFALLS #12: no confirmation dialog before cancel — onCancel() called directly"
  - "T-03-09 mitigated: ChatInputBar disabled={isStreaming} prevents concurrent messages"

patterns-established:
  - "configRef pattern: useRef<Widget[]> mirrors useState for use in async SSE callbacks"
  - "onStreamingChange callback: EditChatPanel bubbles isStreaming to parent via prop"
  - "TypingIndicator shown when isStreaming=true AND hasChunk=false (before first chunk arrives)"

requirements-completed:
  - EDIT-01
  - EDIT-02
  - EDIT-03
  - EDIT-04
  - EDIT-05

duration: 25min
completed: 2026-05-28
---

# Phase 03 Plan 03: DashboardEditOverlay + EditChatPanel + UI Sub-Components Summary

**Full split-screen edit overlay with custom SSE streaming, GSAP entrance, configRef stale-closure guard, and 3-dot typing indicator — all 5 frontend components for the AI dashboard editing experience**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-28T00:00:00Z
- **Completed:** 2026-05-28
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- `DashboardEditOverlay`: fixed-viewport overlay (z-20), 56px top bar with "Dashboard • Édition" label and Annuler/Sauvegarder buttons, 60/40 split content area, GSAP `opacity 0→1 150ms power2.out` on mount, no exit animation
- `EditChatPanel`: custom SSE reader replicating AIChatClient.tsx pattern; `configRef.current` (not state) in POST body; `tool_result` event calls `onWidgetsUpdate` + `setIsStreaming(false)` atomically; static opening message pre-populated from `initialWidgets`
- `TypingIndicator`: 3 dots with CSS keyframes `typing-dot`, stagger 0/200/400ms, 900ms sinusoidal cycle, same bubble chrome as assistant MessageBubble
- `PreviewLoadingOverlay`: absolute inset-0 backdrop with CSS spin animation, `role="status" aria-label`
- `SaveToast`: fixed bottom-right, green left border, GSAP slide-in from y:16, 3s auto-dismiss fade, Undo link calls `onSave(previousConfigRef.current)`

## Task Commits

1. **Task 1: TypingIndicator + PreviewLoadingOverlay + SaveToast** — included in `bd84699` (feat)
2. **Task 2: EditChatPanel + DashboardEditOverlay** — included in `bd84699` (feat)

**Plan commit:** `bd84699` — feat(03-03): DashboardEditOverlay + EditChatPanel + UI sub-components

## Files Created/Modified

- `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — Full-viewport overlay shell: GSAP entrance, 60/40 layout, save/cancel, SaveToast, PreviewLoadingOverlay
- `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — SSE stream consumer: custom ReadableStream reader, configRef.current in POST body, opening message, TypingIndicator rendering
- `apps/web/src/components/coach/dashboard/TypingIndicator.tsx` — 3-dot animated indicator with CSS keyframes
- `apps/web/src/components/coach/dashboard/PreviewLoadingOverlay.tsx` — Semi-transparent spinner overlay for preview pane
- `apps/web/src/components/coach/dashboard/SaveToast.tsx` — Fixed-position success toast with GSAP animations and Undo link

## Decisions Made

- Opening message built from `initialWidgets.map(w => w.title).join(', ')` — uses `w.title` directly (Widget has a top-level `title` field per `WidgetBase` interface)
- `isStreaming` bubbled from `EditChatPanel` to `DashboardEditOverlay` via `onStreamingChange` prop (simplest approach per plan spec)
- `TypingIndicator` shown when `isStreaming=true AND hasChunk=false`; once first chunk arrives, `hasChunk` flips to `true` and the indicator is replaced by the streaming bubble
- `conversationHistory` passed to POST excludes the static `system-opening` message (id check) to avoid sending a fake assistant message to the backend

## Deviations from Plan

None — plan executed exactly as written. All D-01 through D-16 decisions, PITFALLS items, and UI-SPEC measurements implemented as specified.

## Issues Encountered

None. TypeScript compiled without errors in all 5 files (verified via `tsc --noEmit`).

## Known Stubs

None — all components are fully wired. `DashboardEditOverlay` requires `dashboard/page.tsx` to render it conditionally (planned in a separate task per 03-CONTEXT.md integration points).

## Threat Flags

No new security surface introduced beyond what was already in the plan's threat model (T-03-08, T-03-09, T-03-10, T-03-SC).

## Self-Check: PASSED

Files confirmed present:
- `apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — FOUND
- `apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — FOUND
- `apps/web/src/components/coach/dashboard/TypingIndicator.tsx` — FOUND
- `apps/web/src/components/coach/dashboard/PreviewLoadingOverlay.tsx` — FOUND
- `apps/web/src/components/coach/dashboard/SaveToast.tsx` — FOUND

Commit `bd84699` — FOUND (5 files, 704 insertions)

## Next Phase Readiness

- All 5 components ready for integration in `dashboard/page.tsx` (`isEditing` state + "Personnaliser" button)
- The Next.js proxy route `/api/coach/dashboards/[clientId]/ai-edit` must forward to the Hono backend endpoint built in plan 03-01
- D-18 multi-turn integration test can now be run once the page-level wiring is in place

---
*Phase: 03-ai-edit-session*
*Completed: 2026-05-28*
