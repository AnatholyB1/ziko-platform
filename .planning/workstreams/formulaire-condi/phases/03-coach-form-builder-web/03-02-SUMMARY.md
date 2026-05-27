---
phase: "03"
plan: "02"
workstream: formulaire-condi
subsystem: web/coach/forms
tags: [form-list, gsap, table, context-menu, empty-state, skeleton]
dependency_graph:
  requires: [03-01]
  provides: [FormsListClient, FormCard]
  affects: [apps/web/src/app/[locale]/(coach)/coach/forms/]
tech_stack:
  added: []
  patterns: [gsap-stagger-entrance, gsap-skeleton-pulse, context-menu-outside-click, bearer-token-patch]
key_files:
  created:
    - apps/web/src/components/coach/FormCard.tsx
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx
decisions:
  - "No onDelete prop on FormCard — DELETE API route does not exist in Phase 03 scope; archive is the end-of-life action"
  - "Archive mutation uses optimistic state update — setForms maps status to archived immediately on PATCH 200"
  - "GSAP entrance fires on mount (empty deps array) — avoids re-running animation on archive mutations that update local state"
  - "Skeleton displayed only during archive mutation (isLoading), not on initial load — data comes from server via props"
metrics:
  duration: "15m"
  completed: "2026-05-27T13:17:00Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 02: FormsListClient + FormCard — Form List Page Summary

FormsListClient full implementation (3 states: empty/loading/populated) + FormCard table row component with status badge, trigger label, date, and context menu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FormCard component | 3229d21 | apps/web/src/components/coach/FormCard.tsx |
| 2 | FormsListClient full implementation | 3229d21 | apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx |

## What Was Built

### FormCard (`apps/web/src/components/coach/FormCard.tsx`)

A `'use client'` component rendering a `<tr>` table row with className `form-row border-b border-border hover:bg-[#F7F6F3] transition-colors min-h-[56px]`.

Columns rendered:
- **Title**: `text-sm font-bold text-text max-w-[280px] truncate`
- **Status**: `<FormStatusBadge status={form.status} />`
- **Trigger**: French label from `TRIGGER_LABELS` map (`first_contact` → "Premier contact", etc.)
- **Date**: `toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })`
- **Actions**: Context menu with `IoEllipsisHorizontal` (24px, aria-label="Options")

Context menu items per status:
- `draft`: "Modifier" (onEdit) + "Publier" (onPublish)
- `active`: "Voir / Archiver" (onView)
- `archived`: "Voir" (onView)

No `onDelete` prop. No `window.confirm`. Outside-click closes menu via `useEffect` + `mousedown` listener.

### FormsListClient (`apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx`)

A `'use client'` component with three render states:

**Empty state** (`forms.length === 0`):
- `IoDocumentTextOutline` 48px `text-[#E2E0DA]`
- Heading "Aucun formulaire pour l'instant" (22px/700)
- Body "Créez votre premier formulaire conditionnel pour vos athlètes."
- CTA "+ Créer un formulaire" → `router.push(/${locale}/coach/forms/new)`

**Loading skeleton** (`isLoading === true`):
- 3 rows at 60%/45%/52% width, `bg-[#E2E0DA] rounded-xl h-11`
- GSAP pulse: `gsap.to('.skeleton', { opacity: 0.5, duration: 0.75, yoyo: true, repeat: -1, ease: 'sine.inOut' })`

**Populated table** (`forms.length > 0`):
- Page header: "Formulaires" (28px/700) + "+ Nouveau formulaire" primary button
- `bg-white border border-border rounded-2xl overflow-hidden` card container
- `<table>` with `<thead>` columns: TITRE / STATUT / DÉCLENCHEUR / DATE / (actions)
  - Headers: `text-xs font-bold text-muted uppercase tracking-wider`
- `<tbody>` maps forms to `<FormCard>` rows
- GSAP entrance on mount: `gsap.from('.form-row', { y: 12, opacity: 0, duration: 0.2, stagger: 0.04, ease: 'power2.out' })`

Archive mutation:
- `PATCH ${apiUrl}/forms/coach/forms/${id}` with `Authorization: Bearer ${accessToken}`
- On 200: optimistic update `setForms(prev => prev.map(...))`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond what is specified in the plan's threat model. The archive PATCH uses the existing Bearer token pattern. No client-side privilege escalation possible (menu items shown based on server-fetched `form.status`).

## Self-Check: PASSED

- FOUND: apps/web/src/components/coach/FormCard.tsx
- FOUND: apps/web/src/app/[locale]/(coach)/coach/forms/FormsListClient.tsx
- FOUND commit: 3229d21
- TypeScript: rtk tsc --noEmit passes
- No window.confirm in FormCard or FormsListClient
- No onDelete prop in FormCard
