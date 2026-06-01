---
phase: "03"
plan: "01"
subsystem: "formulaire-condi / coach-form-builder-web"
tags: [sidebar, navigation, form-types, server-pages, auth-guard, scaffold]
dependency_graph:
  requires: []
  provides:
    - FormStatusBadge component with CoachForm/FormQuestion/TriggerConfig TS interfaces
    - /coach/forms server page with auth guard + QueryProvider
    - /coach/forms/new server page with auth guard
    - /coach/forms/[id] server page with auth guard + notFound() for unknown IDs
    - FormsListClient stub (replaced in Plan 03-02)
    - FormBuilderClient stub (replaced in Plan 03-03)
  affects:
    - apps/web/src/components/coach/CoachSidebar.tsx
tech_stack:
  added: []
  patterns:
    - Server page + client stub split (getCachedCoachUser + getLocale + createServerSupabase)
    - notFound() guard for unknown IDs
    - TypeScript interface barrel export from shared component file
key_files:
  created:
    - apps/web/src/components/coach/FormStatusBadge.tsx
    - apps/web/src/app/[locale]/(coach)/coach/forms/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx
    - apps/web/src/app/[locale]/(coach)/coach/forms/new/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx
    - apps/web/src/app/[locale]/(coach)/coach/forms/[id]/page.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - Added 'Formulaires' nav entry between 'Exercices' and 'Imports' per plan spec (D-01)
  - TypeScript interfaces exported from FormStatusBadge.tsx as the canonical type barrel for this feature
  - /coach/forms/[id] fetches full form list and filters by id — no dedicated GET /:id route in API
  - notFound() called immediately when form not found — prevents blank builder on unknown IDs
  - FormsListClient and FormBuilderClient created as minimal stubs (return <div />) to satisfy TypeScript imports; will be fully replaced in Plans 03-02 and 03-03
metrics:
  duration: "~8 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_changed: 7
---

# Phase 03 Plan 01: Sidebar Nav + FormStatusBadge + Server Page Scaffolds Summary

**One-liner:** Sidebar "Formulaires" nav entry (IoDocumentTextOutline), FormStatusBadge with draft/active/archived pills and CoachForm TS interfaces, and three auth-guarded server page scaffolds for /coach/forms routes.

---

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add "Formulaires" nav to CoachSidebar + create FormStatusBadge component | 3c62c53 |
| 2 | Scaffold /coach/forms, /coach/forms/new, /coach/forms/[id] server pages | 3c62c53 |

---

## What Was Built

### CoachSidebar.tsx
- Added `IoDocumentTextOutline` import from `react-icons/io5`
- Inserted `{ label: 'Formulaires', href: '/{locale}/coach/forms', icon: IoDocumentTextOutline, disabled: false }` at index 5 (between 'Exercices' and 'Imports')

### FormStatusBadge.tsx (new)
- Exports all CoachForm-related TypeScript interfaces: `QuestionType`, `FormQuestion`, `TriggerType`, `TriggerConfig`, `CoachForm`
- Exports `FormStatusBadge` component with correct pill colors per UI-SPEC:
  - draft: `bg-[#F0EFE9] text-[#6B6963]` → "Brouillon"
  - active: `bg-[#DCFCE7] text-[#16A34A]` → "Actif"
  - archived: `bg-[#FEE2E2] text-[#DC2626]` → "Archivé"
- Badge anatomy: `rounded-full px-2 py-0.5 text-xs font-bold inline-flex items-center`

### forms/page.tsx (new)
- Auth guard via `getCachedCoachUser()`
- Fetches `GET ${apiUrl}/forms/coach/forms` with Bearer JWT
- Passes `forms={[]}` on fetch failure (crash-safe)
- Wraps `FormsListClient` in `QueryProvider`

### forms/new/page.tsx (new)
- Auth guard via `getCachedCoachUser()`
- No data fetch needed (builder starts blank)
- Renders `FormBuilderClient` with `form={null}`

### forms/[id]/page.tsx (new)
- Auth guard via `getCachedCoachUser()`
- Fetches full form list and filters by `id`
- Calls `notFound()` (from `next/navigation`) when form not found → returns Next.js 404
- Only renders `FormBuilderClient` when form exists

### Stubs created
- `FormsListClient.tsx` — minimal `export default function FormsListClient(props: any) { return <div />; }` — replaced in Plan 03-02
- `FormBuilderClient.tsx` — same pattern — replaced in Plan 03-03

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| FormsListClient | apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx | Placeholder for Plan 03-02 implementation |
| FormBuilderClient | apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx | Placeholder for Plan 03-03 implementation |

These stubs are intentional. The /coach/forms page renders a `<div />` until Plan 03-02 replaces FormsListClient. This is the expected state after Plan 03-01.

---

## Threat Flags

No new threat surface introduced. All three server pages are guarded by `getCachedCoachUser()` (T-03-01). JWT is only used server-side, never exposed to client stubs. `notFound()` prevents rendering builder for unknown form IDs (T-03-02).

---

## Self-Check: PASSED

- [x] `apps/web/src/components/coach/CoachSidebar.tsx` — IoDocumentTextOutline + 'Formulaires' entry ✓
- [x] `apps/web/src/components/coach/FormStatusBadge.tsx` — exists ✓
- [x] `apps/web/src/app/[locale]/(coach)/coach/forms/page.tsx` — exists ✓
- [x] `apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx` — stub exists ✓
- [x] `apps/web/src/app/[locale]/(coach)/coach/forms/new/page.tsx` — exists ✓
- [x] `apps/web/src/app/[locale]/(coach)/coach/forms/new/FormBuilderClient.tsx` — stub exists ✓
- [x] `apps/web/src/app/[locale]/(coach)/coach/forms/[id]/page.tsx` — exists ✓
- [x] Commit 3c62c53 exists in git log ✓
- [x] TypeScript compiles without errors ✓
