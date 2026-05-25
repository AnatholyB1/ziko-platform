---
phase: 27
plan: "07"
subsystem: web-coach
tags: [program-editor, week-accordion, session-slide-over, exercise-typeahead, assignment-modal, client-programs-tab]
dependency_graph:
  requires: [27-04, 27-05]
  provides: [program-editor-ui, assignment-modal, client-programs-tab]
  affects: [apps/web/coach-programs, apps/web/coach-clients]
tech_stack:
  added: []
  patterns:
    - WeekAccordion collapsible accordion with context menus
    - SessionSlideOver fixed right-panel with CSS transform animation
    - ExerciseTypeahead debounced fetch + create pattern
    - AssignmentModal IndeterminateCheckbox batch selection
    - ProgramEditorClient server/client split page pattern
key_files:
  created:
    - apps/web/src/components/coach/WeekAccordion.tsx
    - apps/web/src/components/coach/SessionSlideOver.tsx
    - apps/web/src/components/coach/ExerciseTypeahead.tsx
    - apps/web/src/components/coach/AssignmentModal.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/[id]/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/[id]/ProgramEditorClient.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx
  modified:
    - apps/web/src/components/coach/ClientTabStrip.tsx
decisions:
  - "SessionSlideOver receives apiUrl+accessToken as props (passed through from server) — avoids client-side env access"
  - "ProgramEditorClient is a separate file from page.tsx to keep Server Component boundary clean"
  - "ClientProgramsContent extracts client interactivity (shared note, remove program) into a 'use client' sub-component"
  - "RemoveProgramConfirm uses inline confirm pattern per UI-SPEC (no typed token required for program removal)"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 8
  files_modified: 1
---

# Phase 27 Plan 07: Program Editor + Assignment Modal + Client Programs Tab Summary

Built the full program editor (A3), assignment modal (A4), and client programs tab (A5+D-17) — the three heaviest interactive surfaces of Phase 27.

## What Was Built

### WeekAccordion.tsx
Collapsible week accordion with session rows. Each week has a chevron toggle + context menu (Dupliquer/Supprimer). Session rows show day chip (Lun–Dim), name, exercise count, context menu, and forward chevron. Active session highlighted with `bg-primary/5 border-l-2 border-l-primary`. Dashed "+Ajouter une semaine" button at bottom.

### SessionSlideOver.tsx
Fixed 480px right panel sliding in with `translate-x-full → translate-x-0` CSS transform (200ms ease-out). Editable session name + day-of-week chips. Exercise table with inline `type=number` inputs for sets/reps/RPE-RIR/rest and text inputs for name/notes. Delete per row. ExerciseTypeahead in footer. Escape key closes.

### ExerciseTypeahead.tsx
300ms debounced `GET /coach/programs/exercises?q=`. Dropdown with results (fitness icon + name + category chip) + "Créer l'exercice «query»" option always last. On create: `POST /coach/programs/exercises`. Loading skeleton rows. Keyboard ArrowUp/Down/Enter/Escape navigation. Full `role="combobox"` + `role="listbox"` aria attributes.

### AssignmentModal.tsx
Clone of RevokeConfirmModal backdrop pattern. IndeterminateCheckbox copied inline from ClientsTable.tsx. Client list with avatar/name/"Déjà assigné" chip. Select-all IndeterminateCheckbox. `POST /coach/programs/:id/assign { client_ids }`. Success state with checkmark SVG + "Programme assigné !" + count. Button shows "Assigner (N)" when N > 0.

### programs/[id]/page.tsx + ProgramEditorClient.tsx
Server Component for auth+data fetch; client component for all editor state. Sticky header with click-to-edit name, goal chip, week count, last-saved timestamp. Sauvegarder (visible when isDirty) + Assigner + delete buttons. Main area: WeekAccordion + SessionSlideOver. All week/session CRUD callbacks implemented using structuredClone for duplication. Weeks renumbered on delete. RevokeConfirmModal for delete (`?confirmed=true`).

### ClientTabStrip.tsx
8th tab `{ key: 'programs', label: 'Programmes' }` added.

### clients/[id]/programs/page.tsx + ClientProgramsContent.tsx
Server Component fetches `GET /coach/clients/:id/programs` + `GET /coach/clients/:id` (for shared_note). Client component renders active program card (name, "Semaine N sur M", coach/date meta, compliance bar with green ≥80% / orange 50-79% / red <50% thresholds), inline RemoveProgramConfirm (Garder / Retirer buttons, no typed confirmation per UI-SPEC), history list with compliance badges, SharedNoteEditor with 500-char limit (`maxLength=500`) + PUT to `/coach/clients/:clientId/shared-note`. No-program empty state with CTA.

## Deviations from Plan

None — plan executed as specified. `threat_flag T-27-07-03` mitigated: `maxLength=500` on textarea.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-27-07-03 | `maxLength=500` on SharedNoteEditor textarea |
| T-27-07-04 | Delete uses RevokeConfirmModal with COACH token + `?confirmed=true` |

## Self-Check: PASSED

- WeekAccordion.tsx: EXISTS
- SessionSlideOver.tsx: EXISTS
- ExerciseTypeahead.tsx: EXISTS
- AssignmentModal.tsx: EXISTS
- programs/[id]/page.tsx: EXISTS
- ProgramEditorClient.tsx: EXISTS
- clients/[id]/programs/page.tsx: EXISTS
- ClientProgramsContent.tsx: EXISTS
- ClientTabStrip.tsx: 8 tabs (programs added)
- TypeScript: 0 new errors (1 pre-existing in safe-next.spec.ts from phase 25-06)
