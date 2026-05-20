---
phase: 27
plan: "06"
subsystem: web-coach-programs
tags: [programs, coach, web, sidebar, template-library]
dependency_graph:
  requires: [27-04]
  provides: [programs-list-page, new-program-form, program-card-component, sidebar-programs-active]
  affects: [CoachSidebar, coach/programs routes]
tech_stack:
  added: []
  patterns: [force-dynamic Server Component, ProgramsClient client sub-component, typed-confirmation delete modal]
key_files:
  created:
    - apps/web/src/components/coach/ProgramCard.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/new/page.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - "ProgramsClient extracted as co-located 'use client' sub-component to keep page.tsx as a Server Component while enabling client-side folder filtering"
  - "handleDelete/handleDuplicate in ProgramsClient use console.log stubs — wired to actual API calls in 27-07"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_changed: 5
---

# Phase 27 Plan 06: Programs List + New Form + ProgramCard + Sidebar Flip Summary

One-liner: Programs list page (MES TEMPLATES + BIBLIOTHÈQUE ZIKO), new program form (5 fields, POST /coach/programs), ProgramCard component with context menu + typed-confirmation delete, and CoachSidebar Programmes entry enabled.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Flip CoachSidebar + create ProgramCard | cfcb1d4 | CoachSidebar.tsx, ProgramCard.tsx |
| 2 | Create programs list page + new program form | cfcb1d4 | programs/page.tsx, ProgramsClient.tsx, programs/new/page.tsx |

## What Was Built

### CoachSidebar.tsx
Single character change: `disabled: true` → `disabled: false` on the Programmes NAV_ITEMS entry. Programmes nav item now navigates to `/fr/coach/programs`.

### ProgramCard.tsx
Named export `ProgramCard` — reusable card component for both own templates and seed templates:
- Own templates: `IoEllipsisHorizontal` context menu with Modifier / Dupliquer / Assigner / Supprimer actions
- Seed templates: `IoLockClosedOutline` icon with CSS group-hover "Utiliser ce template" tooltip overlay
- Delete confirmation modal: typed-confirmation pattern requiring "SUPPRIMER" (mirrors RevokeConfirmModal pattern)
- Context menu closes on outside click via `useEffect` + `document.addEventListener`

### programs/page.tsx (Server Component)
- `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
- `createServerSupabase()` + `getUser()` + redirect to `/${locale}/login` if unauthenticated
- Parallel server-side fetch: `GET /coach/programs` + `GET /coach/programs/folders` with JWT Authorization header + `cache: 'no-store'`
- Passes programs + folders + locale to `ProgramsClient` client sub-component

### ProgramsClient.tsx ('use client')
- Folder rail (left `w-48 aside`): "Tous les programmes" / "Sans dossier" / folder items + "Nouveau dossier" CTA
- Active folder state drives `filteredOwn` list — client-side filtering, no route changes needed
- MES TEMPLATES section: `grid grid-cols-1 gap-3` of `ProgramCard` for own templates; empty state with `IoDocumentTextOutline` + CTA when no own templates
- BIBLIOTHÈQUE ZIKO section: `ProgramCard isSeed=true` for `created_by_coach_id === null` rows; Officiel badge (`bg-primary/10 text-primary`)

### programs/new/page.tsx ('use client')
- 5 form fields: Nom (required), Description (optional textarea), Objectif (goal chips), Nombre de semaines (number input 1–52), Dossier (select from fetched folders)
- `nameError` inline validation (`text-xs text-red-600 mt-1`) triggered on empty submit
- Folders loaded on mount via `createClientSupabase()` + `GET /coach/programs/folders`
- On submit: `POST ${NEXT_PUBLIC_API_URL}/coach/programs` → redirect to `/${locale}/coach/programs/${newId}`
- Cancel: `router.push` to programs list
- Submit button `disabled` while loading

## Deviations from Plan

### Auto-added — ProgramsClient co-location
The plan specified extracting folder filtering into a `ProgramsClient` sub-component but did not specify where to put it. Co-located it at `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` (same directory as page.tsx) to keep the route folder self-contained. This is consistent with the InvitationsClient pattern in the invitations route.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `handleDelete` logs to console | ProgramsClient.tsx | DELETE /coach/programs/:id API route not yet implemented — wired in 27-07 |
| `handleDuplicate` logs to console | ProgramsClient.tsx | POST /coach/programs/:id/duplicate API route not yet implemented — wired in 27-07 |
| `handleEdit` navigates to /programs/:id/edit | ProgramsClient.tsx | Edit page route built in 27-07 |

These stubs do not prevent the plan's primary goal (viewing programs list + creating new program) from being achieved.

## Threat Surface

All mitigations from the plan threat register applied:
- T-27-06-01: `force-dynamic` + `createServerSupabase().auth.getUser()` + redirect on null user
- T-27-06-02: Delete confirmation requires typing "SUPPRIMER" before enabling the destructive button; backend enforces `created_by_coach_id = coachId` ownership

## Self-Check: PASSED

Files verified:
- FOUND: apps/web/src/components/coach/CoachSidebar.tsx (modified)
- FOUND: apps/web/src/components/coach/ProgramCard.tsx (created)
- FOUND: apps/web/src/app/[locale]/(coach)/coach/programs/page.tsx (created)
- FOUND: apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx (created)
- FOUND: apps/web/src/app/[locale]/(coach)/coach/programs/new/page.tsx (created)
- Commit cfcb1d4 verified in git log
- TypeScript check: 1 pre-existing error in apps/web/test/safe-next.spec.ts (unrelated to this plan — no new TS errors introduced)
