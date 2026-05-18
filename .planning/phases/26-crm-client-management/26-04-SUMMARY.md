---
phase: 26-crm-client-management
plan: "04"
subsystem: web-coach-crm
tags: [tanstack-table, roster, signal-filter, row-selection, sidebar]
dependency_graph:
  requires: [26-03]
  provides: [clients-roster-page, client-signal-chips, compare-button, clients-table]
  affects: [CoachSidebar]
tech_stack:
  added: ["@tanstack/react-table (v8 — already installed in 26-03)"]
  patterns: [tanstack-table-v8, signal-pre-filter, stable-row-id, max-selection-enforcement]
key_files:
  created:
    - apps/web/src/components/coach/ClientSignalChip.tsx
    - apps/web/src/components/coach/CompareButton.tsx
    - apps/web/src/components/coach/ClientsTable.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/page.tsx
  modified:
    - apps/web/src/components/coach/CoachSidebar.tsx
decisions:
  - "Signal pre-filter applied to data array before useReactTable (not via columnFilters) per RESEARCH.md anti-pattern guidance"
  - "getRowId: (row) => row.id used for stable UUID-keyed selection state"
  - "Max-5 selection enforced via enableRowSelection callback checking rowSelection object keys"
  - "RevokeClientModal inline in ClientsTable imports RevokeConfirmModal with open:true pattern"
metrics:
  duration: "12 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 26 Plan 04: Clients Roster Page + Table Summary

TanStack Table v8 roster page for /coach/clients with globalFilter search, signal pre-filter chips, max-5 row selection, CompareButton, and CoachSidebar Clients entry enabled.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create ClientSignalChip + ClientsTable + CompareButton | 93e9d80 | ClientSignalChip.tsx, CompareButton.tsx, ClientsTable.tsx |
| 2 | Create /coach/clients page + flip CoachSidebar Clients entry | 2adc8f1 | clients/page.tsx, CoachSidebar.tsx |

## What Was Built

**ClientSignalChip.tsx** — Thin chip component cloned from KycStatusChip pattern. Three signal types: `missed` (red), `stale` (yellow), `declining` (red). Each rendered with `aria-label="Signal : ..."`.

**CompareButton.tsx** — `'use client'` sticky fixed button at `bottom-4 right-6 z-40`. Returns `null` when `ids.length < 2`. On click navigates to `/[locale]/coach/clients/compare?ids=...`.

**ClientsTable.tsx** — `'use client'` TanStack Table v8 wrapper:
- `getRowId: (row) => row.id` — stable UUID-keyed selection (mandatory per RESEARCH.md)
- Signal pre-filter: `rows.filter(...)` before `useReactTable({ data: filteredRows })` — NOT via columnFilters
- `enableRowSelection: (row) => row.getIsSelected() || selectedCount < MAX_SELECTED` — max-5 enforcement
- `getCoreRowModel → getFilteredRowModel → getSortedRowModel` pipeline
- `IndeterminateCheckbox` with `useRef` + `useEffect` for indeterminate state
- Empty state: "Aucun client lié" + CTA → `/[locale]/coach/invitations`
- RevokeClientModal inline component wrapping `RevokeConfirmModal` with `open={true}`, typed COACH token

**clients/page.tsx** — Server Component:
- `export const dynamic = 'force-dynamic'` + `export const revalidate = 0` (ARCH-06, D-15)
- Fetches from `${NEXT_PUBLIC_API_URL}/coach/clients` with `Authorization: Bearer {jwt}` + `cache: 'no-store'`
- Auth guard: redirects to `/[locale]/login` if no user
- Renders `<ClientsTable rows={clients} locale={locale} />`

**CoachSidebar.tsx** — Clients entry: `disabled: true` → `disabled: false` (D-24). Programmes + IA remain `disabled: true`.

## Deviations from Plan

None — plan executed exactly as written. `RevokeConfirmModal` requires an `open: boolean` prop (confirmed from reading the file), so `RevokeClientModal` wrapper passes `open={true}` (modal only renders when `revokeTarget !== null`).

## Threat Model Compliance

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-26-04-01 | `force-dynamic` + `revalidate=0` + `cache:'no-store'` on page.tsx |
| T-26-04-02 | Server Component passes only JWT-authenticated data as props to client component |
| T-26-04-03 | RevokeClientModal requires typed "COACH" token before DELETE fires |

## Self-Check

- [x] `apps/web/src/components/coach/ClientSignalChip.tsx` — exists
- [x] `apps/web/src/components/coach/CompareButton.tsx` — exists
- [x] `apps/web/src/components/coach/ClientsTable.tsx` — exists, contains `useReactTable`, `getRowId: (row) => row.id`
- [x] `apps/web/src/app/[locale]/(coach)/coach/clients/page.tsx` — exists, contains `force-dynamic`
- [x] `apps/web/src/components/coach/CoachSidebar.tsx` — Clients entry `disabled: false`
- [x] Commit 93e9d80 — Task 1 components
- [x] Commit 2adc8f1 — Task 2 page + sidebar

## Self-Check: PASSED
