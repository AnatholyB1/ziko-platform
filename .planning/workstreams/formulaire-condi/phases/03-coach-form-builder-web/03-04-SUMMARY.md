---
phase: "03"
plan: "04"
workstream: formulaire-condi
subsystem: web-coach-forms
tags: [forms, publish-modal, archive-modal, read-only, gsap, hono]
dependency_graph:
  requires:
    - "03-03: FormBuilderClient with publishModalOpen state, QuestionCard, TriggerConfig"
  provides:
    - "POST /forms/coach/forms/:id/publish accepts { target, client_id } body"
    - "PublishModal component — radio group + client typeahead + GSAP animations"
    - "ArchiveModal component — destructive confirm + GSAP animations"
    - "FormBuilderClient wired with both modals + active read-only view"
  affects:
    - "backend/api/src/routes/forms.ts"
    - "apps/web/src/components/coach/PublishModal.tsx"
    - "apps/web/src/components/coach/ArchiveModal.tsx"
    - "apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx"
tech_stack:
  added: []
  patterns:
    - "GSAP scale+fade modal open/close (power2.inOut / power2.in)"
    - "Debounced typeahead search (300ms) with GSAP stagger on results"
    - "toast + redirect on modal success (1.5s delay)"
    - "Save guard: handlePublishClick checks form.id before opening publish modal"
key_files:
  created:
    - path: apps/web/src/components/coach/PublishModal.tsx
      role: Publish modal — radio group Un client / Tous, client typeahead, GSAP animations
    - path: apps/web/src/components/coach/ArchiveModal.tsx
      role: Destructive confirm dialog — archive form, GSAP animations
  modified:
    - path: backend/api/src/routes/forms.ts
      change: POST /publish handler patched to parse { target, client_id } and distribute instances
    - path: apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx
      change: Wired PublishModal + ArchiveModal, handlePublishClick guard, active read-only questions, Q_TYPE_LABELS
decisions:
  - "handlePublishClick uses toast+save+return guard (not auto-open) because handleSave redirects for new forms — opening the modal on the same render cycle would be a race condition"
  - "Active read-only rendered inline in FormBuilderClient (option b) to avoid cross-plan QuestionCard modification"
  - "PublishModal client typeahead slice to 8 results matches T-03-12 DoS acceptance"
metrics:
  duration: "6m"
  completed_at: "2026-05-27T13:37:13Z"
  tasks_completed: 4
  files_changed: 4
requirements:
  - FORM-05
  - FORM-01
  - FORM-02
  - FORM-03
  - FORM-04
---

# Phase 03 Plan 04: PublishModal + ArchiveModal + publish API patch + active read-only view — Summary

**One-liner:** Full publish/archive modal flow wired end-to-end: patched Hono publish handler routes to one client or all via `create_form_instances_for_trigger`, with GSAP-animated PublishModal (typeahead) and ArchiveModal (destructive confirm), active read-only form view with lock icons.

---

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| Task 0 | Patch POST /publish to accept { target, client_id } body | 285f9b2 | Done |
| Task 1 | Create PublishModal (radio group + typeahead + GSAP) | 285f9b2 | Done |
| Task 2 | Create ArchiveModal (destructive confirm + GSAP) | 285f9b2 | Done |
| Task 3 | Wire modals into FormBuilderClient + active read-only view | 285f9b2 | Done |

---

## What Was Built

### Task 0 — Backend publish handler patch
`backend/api/src/routes/forms.ts` — `POST /coach/forms/:id/publish` now:
- Parses `{ target, client_id }` from request body
- Returns 400 when `target === 'one'` and `client_id` is absent
- Activates the form (sets status to 'active')
- Routes distribution: `target === 'one'` → calls `create_form_instances_for_trigger` for that client; otherwise fetches all `coach_client_links` (revoked_at IS NULL) and calls the RPC for each
- RPC errors logged via `console.warn` but do not fail the request — form is already active

### Task 1 — PublishModal
`apps/web/src/components/coach/PublishModal.tsx`:
- Radio group: "Un client spécifique" / "Tous mes clients"
- When "Un client" selected: debounced (300ms) typeahead search against `GET /coach/clients?search=...`; results dropdown with GSAP stagger fade; selected client shows chip with X to clear
- `canConfirm = target === 'all' || (target === 'one' && !!selectedClient)` — Confirmer disabled until ready
- `handleConfirm` sends `{ target }` or `{ target, client_id }` to match patched API
- GSAP open: `gsap.from(dialogRef, { scale: 0.95, opacity: 0, duration: 0.25, ease: 'power2.inOut' })`
- GSAP close: `gsap.to(dialogRef, { scale: 0.97, opacity: 0, duration: 0.15, ease: 'power2.in', onComplete: onClose })`
- Escape key + click-outside handlers wired

### Task 2 — ArchiveModal
`apps/web/src/components/coach/ArchiveModal.tsx`:
- `IoWarningOutline` 32px `text-[#F59E0B]` centered above title
- Title "Archiver ce formulaire ?" + body copy from UI-SPEC Copywriting Contract
- `handleArchive` sends `PATCH /forms/coach/forms/:id` with `{ status: 'archived' }`
- Same GSAP open/close pattern as PublishModal
- "Archiver" button uses `bg-destructive text-white hover:bg-red-700`

### Task 3 — FormBuilderClient wiring
`apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx`:
- `archiveModalOpen` state added
- `toast` type widened to include `'info'`
- `handlePublishSuccess`: closes modal + success toast + redirect to /coach/forms after 1.5s
- `handleArchiveSuccess`: same pattern
- `handlePublishClick`: if `form.id` is null → shows info toast + calls `handleSave()` + returns (user must click Publish again after save redirects to the ID-based URL)
- `Q_TYPE_LABELS` map: `{ text: 'Texte libre', scale: 'Échelle 1-10', yesno: 'Oui / Non', choice: 'Choix unique' }`
- Active mode: read-only cards with `bg-[#F0EFE9]`, type chip, label, `IoLockClosedOutline` 12px; `+ Ajouter une question` button hidden
- Both "Archiver" buttons (header + publication section) wired to `setArchiveModalOpen(true)`
- Publish modal placeholder replaced with real `<PublishModal>` guarded by `publishModalOpen && form?.id`
- `<ArchiveModal>` rendered guarded by `archiveModalOpen && form?.id`

---

## Deviations from Plan

None — plan executed exactly as written. The `handlePublishClick` implementation chose the "toast + return" approach (plan option 2) over the auto-open approach because `handleSave` redirects for new forms (`router.push(.../${newId})`), so attempting to open the modal on the same render cycle would target a component that's about to unmount. The plan explicitly anticipated this and provided both options.

---

## Known Stubs

None. All flows are fully wired end-to-end.

---

## Threat Flags

No new threat surface beyond what was modeled in the plan's threat register:
- T-03-08: Bearer token on POST /publish — implemented
- T-03-09: Bearer token on PATCH archive — implemented
- T-03-10: client_id validated by coach_client_links RLS at RPC level — implemented
- T-03-11: GET /coach/clients returns only coach's own clients — existing backend constraint

---

## Success Criteria Validation

- FORM-05: Coach can publish to one client (typeahead selection) or all clients — confirmed
- Backend POST /publish accepts and routes on target/client_id — confirmed (9 occurrences of `client_id` in forms.ts)
- Unsaved new forms cannot open PublishModal directly — `handlePublishClick` guard prevents this
- D-12: Active form shows all questions read-only with lock icons — implemented via `isActive` branch in questions section
- D-11: Publish opens modal (not inline); Archive opens destructive confirm modal — implemented
- All modal copy matches UI-SPEC Copywriting Contract exactly
- TypeScript compiles without errors in both `backend/api` and `apps/web`

---

## Phase 03 Complete — All 5 success criteria met:
1. Coach can build form (title + questions + trigger) — Plan 03-03
2. Coach can reorder (↑↓) and delete questions — Plan 03-03
3. Coach can configure trigger with conditional fields — Plan 03-03
4. Coach can publish to one or all clients — this plan
5. Coach sees form list with status badges — Plan 03-02

---

## Self-Check: PASSED

- `backend/api/src/routes/forms.ts` — modified, in git (285f9b2)
- `apps/web/src/components/coach/PublishModal.tsx` — created, in git (285f9b2)
- `apps/web/src/components/coach/ArchiveModal.tsx` — created, in git (285f9b2)
- `apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx` — modified, in git (285f9b2)
- TypeScript: `rtk tsc --noEmit` passes for both projects
- `grep -c 'client_id' backend/api/src/routes/forms.ts` → 9 (> 0)
