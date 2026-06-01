---
phase: 03-ai-edit-session
plan: 04
subsystem: ui
tags: [react, tanstack-query, gsap, dashboard, coach-crm, next.js]

requires:
  - phase: 03-ai-edit-session/03-01
    provides: Dashboard tool handlers (add_widget, update_widget, remove_widget, reorder_widgets)
  - phase: 03-ai-edit-session/03-02
    provides: POST /ai-edit SSE endpoint with streaming tool execution
  - phase: 03-ai-edit-session/03-03
    provides: DashboardEditOverlay + EditChatPanel + SaveToast + PreviewLoadingOverlay + TypingIndicator components

provides:
  - isEditing toggle wired into dashboard/page.tsx
  - Personnaliser button (ghost/outline, pencil icon) in dashboard header
  - previousConfigRef stored before entering edit mode (one-tap undo support)
  - handleSave: queryClient.setQueryData + setIsEditing(false)
  - handleCancel: instant close, no confirmation dialog
  - DashboardEditOverlay rendered conditionally when isEditing=true

affects: [03-05-plan, future-coach-crm-plans]

tech-stack:
  added: []
  patterns:
    - "isEditing toggle pattern: useState(false) + previousConfigRef(useRef) for AI edit session entry/exit"
    - "TanStack Query cache update on save: queryClient.setQueryData(['dashboard-config', clientId], newConfig)"
    - "Conditional overlay render: {isEditing && config && <DashboardEditOverlay .../>}"

key-files:
  created: []
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx

key-decisions:
  - "Query key for useDashboardConfig is ['dashboard-config', clientId] — not ['dashboard', clientId] as stated in the plan interface spec; confirmed from hook source"
  - "handleSave defined inside render function (after loading guard) to access config.widgets without conditional hook"
  - "Pencil icon implemented as inline SVG (14px) — react-icons not needed, no new dependency"

patterns-established:
  - "Personnaliser button: ghost/outline style, height 36px, pencil SVG 14px, gap-8, hover bg-[#F0EFE9]"
  - "Overlay entry: store previousConfigRef.current = config.widgets before setIsEditing(true)"

requirements-completed: [EDIT-01, EDIT-03, EDIT-04]

duration: 15min
completed: 2026-05-28
---

# Phase 03 Plan 04: Dashboard Page — AI Edit Session Wiring

**dashboard/page.tsx wired with isEditing toggle, Personnaliser button, previousConfigRef, and DashboardEditOverlay conditional render backed by TanStack Query cache invalidation on save**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-28T00:00:00Z
- **Completed:** 2026-05-28T00:15:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `isEditing` state and `previousConfigRef` added to dashboard page component
- "Personnaliser" button (ghost/outline, pencil SVG icon, 36px height) added to header — always visible when `isEditing=false`
- `handleSave(newWidgets)` updates TanStack Query cache via `queryClient.setQueryData` then closes overlay instantly
- `handleCancel()` closes overlay instantly with no confirmation dialog (D-13, PITFALLS #12)
- `DashboardEditOverlay` rendered conditionally: `{isEditing && config && <DashboardEditOverlay .../>}`
- `previousConfigRef.current = config.widgets` stored before `setIsEditing(true)` for one-tap undo support

## Task Commits

1. **Task 1: Wire isEditing state and DashboardEditOverlay into dashboard/page.tsx** - `a4d2986` (feat)

## Files Created/Modified

- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — added isEditing state, previousConfigRef, useQueryClient, DashboardEditOverlay import, Personnaliser button, handleSave, handleCancel, overlay conditional render

## Decisions Made

- Query key used: `['dashboard-config', clientId]` — confirmed from `useDashboardConfig.ts` source (plan doc said `['dashboard', clientId]`, which was incorrect)
- `handleSave` and `handleCancel` defined inside the render function (after loading guard) to access `config` without conditional hooks — standard Next.js 'use client' pattern
- Pencil icon: inline SVG (14×14 viewBox 24) — avoids any new import, no react-icons dependency needed

## Deviations from Plan

None — plan executed exactly as written. The query key correction (`['dashboard-config', ...]` vs `['dashboard', ...]`) is a minor spec discrepancy, not a deviation from intent.

## Issues Encountered

`DashboardEditOverlay.tsx` was not listed in the `ls` output initially but was found to already exist on disk. All 5 components from plan 03-03 (TypingIndicator, PreviewLoadingOverlay, SaveToast, EditChatPanel, DashboardEditOverlay) were already present — plan 03-03 had been partially executed without a SUMMARY file.

## Next Phase Readiness

- Dashboard page fully wired: clicking "Personnaliser" will open the full AI edit split-screen overlay
- `onSave` handler correctly updates the TanStack Query cache so view-mode grid reflects saved state
- `onCancel` handler closes instantly without confirmation
- Ready for plan 03-05 (Next.js proxy route `/api/coach/dashboards/[clientId]/ai-edit`)

---
*Phase: 03-ai-edit-session*
*Completed: 2026-05-28*
