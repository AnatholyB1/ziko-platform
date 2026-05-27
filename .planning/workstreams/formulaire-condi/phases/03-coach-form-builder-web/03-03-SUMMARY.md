---
phase: 03-coach-form-builder-web
plan: "03"
subsystem: ui
tags: [react, nextjs, gsap, tailwind, forms, coach]

requires:
  - phase: 03-01
    provides: FormStatusBadge.tsx with all TS interfaces (CoachForm, FormQuestion, TriggerConfig, QuestionType, TriggerType); FormBuilderClient stub

provides:
  - QuestionCard: collapsed+expanded inline editor with ChoiceEditor, GSAP delete, ↑↓ controls
  - TriggerConfig: dropdown + conditional fields (N sessions / date picker / helper text) + readOnly mode
  - FormBuilderClient: full draft builder — title + questions + trigger + publication + save/publish + GSAP entrance

affects:
  - 03-04 (PublishModal injection into publishModalOpen state; ArchiveModal archiveModalOpen wiring)

tech-stack:
  added: []
  patterns:
    - "Controlled expand/collapse: single expandedIdx state in parent, only one QuestionCard expanded at a time"
    - "Inline delete confirm: replace action row with confirm row, GSAP fade+shrink onComplete callback"
    - "Builder section entrance: gsap.from('.builder-section', { stagger: 0.08 }) in useEffect"
    - "New question card GSAP: setTimeout 10ms then gsap.from('.question-card:last-child')"

key-files:
  created:
    - apps/web/src/components/coach/QuestionCard.tsx
    - apps/web/src/components/coach/TriggerConfig.tsx
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx

key-decisions:
  - "QuestionCard re-initializes draft state from prop on each expand (setDraft(question) in handleExpand) — no stale data"
  - "TriggerConfig always renders conditional container (showConditional always true) — CSS transition on opacity handles fade"
  - "publishModalOpen state lives in FormBuilderClient (not extracted) so Plan 03-04 can inject <PublishModal> without refactoring"
  - "FormBuilderClient handles both /new and /[id] routes via form prop (null = new form, CoachForm = existing)"

patterns-established:
  - "genId pattern: crypto.randomUUID() with Date.now/Math.random fallback — matches ProgramEditorClient"
  - "SectionLabel: inline function component inside FormBuilderClient, not exported — avoids unnecessary abstraction"
  - "Bearer token passed as prop from server page — no client-side Supabase session access"

requirements-completed:
  - FORM-01
  - FORM-02
  - FORM-03
  - FORM-04

duration: 6min
completed: "2026-05-27"
---

# Phase 03 Plan 03: QuestionCard + TriggerConfig + FormBuilderClient Summary

**Inline form builder with expandable question cards (4 types + ChoiceEditor), conditional trigger config dropdown, and full draft builder orchestrator with GSAP entrance stagger + save/publish flow.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-27T13:21:03Z
- **Completed:** 2026-05-27T13:26:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- QuestionCard: collapsed chip+label+↑↓⋯ row; expanded inline type dropdown + label textarea + ChoiceEditor (min-2 validation); inline delete confirmation with GSAP fade+shrink animation
- TriggerConfig: 4-option dropdown with CSS-transitioned conditional fields (number input, date picker) and helper text; readOnly renders bg-[#F0EFE9] static display for active forms
- FormBuilderClient: replaces stub with full builder — sticky header breadcrumb + draft/active action buttons, title inline input, Questions/Déclencheur/Publication sections, handleSave POST/PATCH + toast + router redirect, GSAP section entrance stagger, publishModalOpen placeholder for Plan 03-04

## Task Commits

1. **Task 1: QuestionCard with inline ChoiceEditor** - `6b79d15` (feat)
2. **Task 2: TriggerConfig component** - `90f5d72` (feat)
3. **Task 3: FormBuilderClient full draft builder** - `18421f1` (feat)

## Files Created/Modified

- `apps/web/src/components/coach/QuestionCard.tsx` — Collapsed + expanded inline editor (with ChoiceEditor), GSAP delete, ↑↓⋯ controls, inline delete confirm
- `apps/web/src/components/coach/TriggerConfig.tsx` — Trigger dropdown + conditional fields, readOnly static display
- `apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx` — Full builder replacing stub; shared by /new and /[id] routes

## Decisions Made

- `publishModalOpen` state kept in FormBuilderClient (not hoisted or extracted) so Plan 03-04 can inject `<PublishModal open={publishModalOpen} onClose={() => setPublishModalOpen(false)} ... />` without refactoring state.
- QuestionCard re-initializes draft from the `question` prop each time it is expanded (in `handleExpand`), avoiding stale draft data when parent updates the question array.
- The Archive button in the sticky header and publication section both call an empty handler for now — `archiveModalOpen` state and `ArchiveModal` are wired in Plan 03-04.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- Archive button onClick in `FormBuilderClient.tsx` (sticky header line and publication section) is an empty function — `archiveModalOpen` state and `ArchiveModal` component are intentionally deferred to Plan 03-04.
- `publishModalOpen` backdrop overlay (fixed inset-0 bg-black/40) is a placeholder — full `PublishModal` with radio group and client search is Plan 03-04.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All mutation goes through existing `handleSave` with Bearer token validated by Hono auth middleware.

## Self-Check: PASSED

- FOUND: apps/web/src/components/coach/QuestionCard.tsx
- FOUND: apps/web/src/components/coach/TriggerConfig.tsx
- FOUND: apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx
- FOUND commit 6b79d15 (Task 1)
- FOUND commit 90f5d72 (Task 2)
- FOUND commit 18421f1 (Task 3)
- TypeScript: no errors (rtk tsc --noEmit passes)

## Next Phase Readiness

- Plan 03-04 can inject `<PublishModal>` and `<ArchiveModal>` — both `publishModalOpen` and the archive handler hook are ready
- TriggerConfig `readOnly` prop wired and ready for 03-S3 active read-only view
- QuestionCard and TriggerConfig both TypeScript-clean and export correctly

---
*Phase: 03-coach-form-builder-web*
*Completed: 2026-05-27*
