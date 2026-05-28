---
phase: "04"
plan: "04"
workstream: custom-widget
subsystem: coach-dashboard
tags: [template-save, coach-memory, opening-message, personalization]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [MEM-01-entry-point, MEM-02-personalized-opening]
  affects: [DashboardEditOverlay, EditChatPanel, SaveToast]
tech_stack:
  added: []
  patterns: [useCoachMemory-for-opening-message, optional-prop-fallback, useEffect-on-loading-transition]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx
    - apps/web/src/components/coach/dashboard/EditChatPanel.tsx
    - apps/web/src/components/coach/dashboard/SaveToast.tsx
decisions:
  - "SaveToast message prop is optional with ?? fallback — existing callers without prop unchanged"
  - "Opening message useEffect depends only on isMemoryLoading to avoid re-running on memory refetch"
  - "showOpeningTypingIndicator guards on both isMemoryLoading AND messages.length===0 to avoid flash after first message"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-28"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
---

# Phase 04 Plan 04: Template Button + Personalized Opening Message Summary

Plan 04-04 wired TemplateNamingModal into DashboardEditOverlay via an "Enregistrer comme modèle" button and replaced EditChatPanel's static opening message with a memory-aware personalized version using useCoachMemory.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Enregistrer comme modèle button + TemplateNamingModal | 1cf44ca | DashboardEditOverlay.tsx, SaveToast.tsx |
| 2 | Personalize EditChatPanel opening message via useCoachMemory | 8f51d0f | EditChatPanel.tsx |

## What Was Built

### Task 1 — DashboardEditOverlay + SaveToast

- Added optional `message?: string` prop to `SaveToast` — renders `message ?? 'Dashboard sauvegardé'`; existing usages unchanged
- Added `isTemplateModalOpen` state, `templateToastVisible` state, and `saveAsTemplateBtnRef` to `DashboardEditOverlay`
- Inserted "Enregistrer comme modèle" button between Annuler and Sauvegarder in the top bar
  - Disabled when `isStreaming || isSaving` (opacity 0.4, cursor not-allowed)
  - GSAP scale press animation: `scale: 0.97, duration: 0.1, yoyo: true, repeat: 1, ease: 'power3.out'`
  - `aria-label="Enregistrer ce dashboard comme modèle réutilisable"`
  - Bookmark SVG icon (14px inline, Ionicons bookmark-outline equivalent)
- Conditional `TemplateNamingModal` render: `onSuccess` shows "Modèle enregistré" toast; `onClose` closes modal
- Second `SaveToast` for template confirmation: `message="Modèle enregistré"`, no-op `onUndo`

### Task 2 — EditChatPanel personalized opening

- Added `buildOpeningMessage(widgets, memory)` helper function:
  - C3 (no memory / empty): generic Phase 03 fallback text
  - C2 (memory has preferences or recent_actions): personalized — paragraph 1 (widget list), paragraph 2 ("J'ai appliqué vos préférences habituelles : …"), paragraph 3 (examples using recent_actions + preferred_widget)
- Removed static `OPENING_MESSAGE` init; `useState<Message[]>([])` starts empty
- `useEffect` on `isMemoryLoading` transition: sets opening message once loaded, fires `animateLastBubble()` via `setTimeout`
- `showOpeningTypingIndicator = isMemoryLoading && messages.length === 0` — shows `TypingIndicator` while memory fetches (C1 state)
- `ChatInputBar` disabled during C1 state
- All Phase 03 behaviors preserved: historyRef sync, configRef, system-opening filter, streaming TypingIndicator

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced. TemplateNamingModal receives `configRef.current` (already Zod-validated at API layer). Memory data rendered as React text nodes (escaped by default).

## Self-Check

- [x] `1cf44ca` exists in git log
- [x] `8f51d0f` exists in git log
- [x] `DashboardEditOverlay.tsx` contains "Enregistrer comme modèle" button, TemplateNamingModal, isTemplateModalOpen state
- [x] `EditChatPanel.tsx` contains useCoachMemory, buildOpeningMessage, showOpeningTypingIndicator, historyRef sync
- [x] `SaveToast.tsx` contains optional `message` prop
- [x] `tsc --noEmit` exits with only pre-existing VocalReview.test.tsx error (unrelated)
