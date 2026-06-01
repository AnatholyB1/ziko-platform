---
phase: "04"
plan: "02"
workstream: custom-widget
subsystem: coach-dashboard
tags: [hook, component, modal, gsap, tanstack-query, memory]
completed: "2026-05-28"
duration: "~20 min"

dependency_graph:
  requires:
    - 04-01  # API layer: GET/PUT /coach/dashboards/memory + CoachMemoryData shape
  provides:
    - useCoachMemory hook (shared data layer for memory)
    - TemplateCard component (reusable template display)
    - TemplateNamingModal component (primary MEM-01 interaction surface)
  affects:
    - 04-03  # TemplatePicker will import TemplateCard + useCoachMemory
    - 04-04  # EditChatPanel will import useCoachMemory for personalized opening message

tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery with staleTime 5min + 404 empty-defaults pattern
    - GSAP fromTo entrance / to exit with onComplete unmount pattern
    - Client-side duplicate check from cached memory data (no extra API round-trip)
    - React.CSSProperties cast for webkit vendor properties (WebkitLineClamp)

key_files:
  created:
    - apps/web/src/hooks/useCoachMemory.ts
    - apps/web/src/components/coach/dashboard/TemplateCard.tsx
    - apps/web/src/components/coach/dashboard/TemplateNamingModal.tsx
  modified: []

decisions:
  - "404 on GET /memory returns empty defaults (not an error) — consistent with useDashboardConfig pattern but explicitly handled"
  - "Widget summary uses widget.title (human-readable) instead of type enum mapping — avoids WidgetType vs semantic type mismatch"
  - "GSAP exit in handleSave triggers onSuccess() before animating out — so parent shows toast while modal closes"
  - "Inline style for WebkitLineClamp cast as React.CSSProperties to satisfy TypeScript vendor prefix typing"
---

# Phase 04 Plan 02: useCoachMemory Hook + TemplateCard + TemplateNamingModal Summary

**One-liner:** TanStack Query memory hook with 5min cache, TemplateCard with GSAP press feedback, and TemplateNamingModal with full 5-state UX and GSAP entrance/exit animations.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create useCoachMemory hook + TemplateCard | `22029bb` | `hooks/useCoachMemory.ts`, `dashboard/TemplateCard.tsx` |
| 2 | Create TemplateNamingModal | `94c5b88` | `dashboard/TemplateNamingModal.tsx` |

---

## What Was Built

### useCoachMemory hook (`apps/web/src/hooks/useCoachMemory.ts`)

- Exports `CoachMemoryPreferences`, `CoachMemoryTemplate`, `CoachMemoryData` interfaces
- `useCoachMemory()` — TanStack Query hook with:
  - `queryKey: ['coach-memory']`
  - `staleTime: 5 * 60 * 1000` (5 minutes)
  - `retry: 1`
  - 404 response returns `{ preferences: {}, templates: [], recent_actions: [] }` (no throw)
  - Same Supabase session + Bearer token pattern as `useDashboardConfig.ts`

### TemplateCard component (`apps/web/src/components/coach/dashboard/TemplateCard.tsx`)

Per UI-SPEC Layout Specs section 3:
- Widget count badge: `#F0EFE9` fill, borderRadius 6, pluralized "N widgets"
- Template name: 18px/600, single-line truncation (textOverflow: ellipsis)
- Widget summary: comma-separated `widget.title` values, 2-line clamp (`-webkit-line-clamp`)
- Creation date: `Créé le DD/MM/YYYY` via `toLocaleDateString('fr-FR', ...)`
- "Utiliser ce modèle" button: full-width, 36px, `#FF5C1A`, spinner during `isApplying`
- Hover state via `useState(false)` — orange border `#FF5C1A` + shadow lift
- GSAP press feedback on button click: `scale: 0.96, duration: 0.1, yoyo, repeat: 1, power3.out`
- `isOtherApplying` prop: opacity 0.5 to visually mute when another card is being applied

### TemplateNamingModal (`apps/web/src/components/coach/dashboard/TemplateNamingModal.tsx`)

All 5 states from UI-SPEC Screen A:
- **A1 (empty):** Save button disabled (opacity 0.4, cursor not-allowed)
- **A2 (valid):** Save button enabled at `#FF5C1A`, Enter key triggers save
- **A3 (loading):** Spinner in button, input readOnly + opacity 0.6, cancel disabled
- **A4 (error):** Red border + error text "Ce nom est déjà utilisé...", input refocused
- **A5 (success):** `onSuccess()` called before GSAP exit → parent shows "Modèle enregistré" toast

GSAP contracts (exact match to UI-SPEC Motion section 1 & 2):
- Entrance: `gsap.fromTo(modalRef.current, { opacity:0, scale:0.97, y:8 }, { opacity:1, scale:1, y:0, duration:0.2, ease:'power2.out' })`
- Exit: `gsap.to(modalRef.current, { opacity:0, scale:0.97, y:4, duration:0.15, ease:'power2.in', onComplete: () => onClose() })`

Accessibility (full UI-SPEC compliance):
- `role="dialog" aria-modal="true" aria-labelledby="template-modal-title"`
- `id="template-modal-title"` on the `<h2>`
- `htmlFor="template-name-input"` on label
- `aria-describedby="template-name-error"` + `aria-invalid={!!error}` on input
- `aria-busy={isSaving}` + `aria-disabled={isButtonDisabled}` on save button
- Escape key closes modal (keyDown on backdrop)
- Input auto-focused on mount

Security (threat model compliance):
- T-04-07: uses same Supabase session Bearer token pattern
- T-04-08: no dangerouslySetInnerHTML — XSS prevented by React default escaping
- T-04-09: `isSaving` gates double-click (button disabled + aria-disabled)

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — no placeholder data or hardcoded empty values introduced.

---

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns beyond what the threat model covers.

---

## Self-Check: PASSED

- `apps/web/src/hooks/useCoachMemory.ts` — exists, confirmed
- `apps/web/src/components/coach/dashboard/TemplateCard.tsx` — exists, confirmed
- `apps/web/src/components/coach/dashboard/TemplateNamingModal.tsx` — exists, confirmed
- Commit `22029bb` — exists (Task 1)
- Commit `94c5b88` — exists (Task 2)
- All acceptance criteria grep checks: passed (10/10 Task 1, 10/10 Task 2)
- Pre-existing TypeScript errors (29 in 14 files) are unrelated to new files — caused by missing node_modules in worktree (same root cause as pre-existing `useDashboardConfig.ts` errors)
