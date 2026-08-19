---
phase: 26-crm-client-management
plan: "06"
subsystem: web-coach-crm
tags: [executive-summary, notes, tags, client-detail, coach-private, dirty-state]
dependency_graph:
  requires: [26-04, 26-05]
  provides: [ExecutiveSummaryCard, ClientNotesPanel, ClientTagInput, sessions-tab-summary, layout-notes-panel]
  affects: []
tech_stack:
  added: []
  patterns: [server-renderable summary card, use-client dirty-state textarea, autosave tag CRUD]
key_files:
  created:
    - apps/web/src/components/coach/ExecutiveSummaryCard.tsx
    - apps/web/src/components/coach/ClientTagInput.tsx
    - apps/web/src/components/coach/ClientNotesPanel.tsx
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx
decisions:
  - "ExecutiveSummaryCard is server-renderable (no use client) — mood badge computed server-side via getMoodBadgeClasses"
  - "ClientTagInput uses credentials:include for POST/DELETE tags — matches same-origin cookie auth pattern"
  - "sessions/page.tsx uses getSession() access_token for Hono API Authorization header — RSC cannot use cookie relay to Hono"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 26 Plan 06: Client Detail Sidebar Components Summary

**One-liner:** Server-renderable ExecutiveSummaryCard with mood badge thresholds, dirty-state ClientNotesPanel, and autosave ClientTagInput wired into client detail layout and sessions tab.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | ExecutiveSummaryCard + ClientTagInput + ClientNotesPanel | 15f5c50 | ExecutiveSummaryCard.tsx, ClientTagInput.tsx, ClientNotesPanel.tsx |
| 2 | Wire into layout.tsx + sessions/page.tsx | f25ea53 | layout.tsx, sessions/page.tsx |

## What Was Built

### ExecutiveSummaryCard.tsx
Server-renderable component (no `'use client'`):
- 4-column grid (`grid-cols-2 lg:grid-cols-4`) with sessions_this_week, habits_pct, last_workout_at, mood badge
- `getMoodBadgeClasses`: delta < -0.3 → red, -0.3 to 0 → yellow, > 0 → green, null → neutral
- `formatRelative`: converts ISO date to "Aujourd'hui" / "Il y a N jour(s)"
- Mood cell renders JSX badge (not plain string) with correct border/bg/text classes

### ClientTagInput.tsx
`'use client'` component:
- Max 20 tags enforced client-side
- Enter/comma → `addTag(input)`, Backspace on empty input → remove last tag
- `onBlur` autosave: calls `POST /coach/clients/:id/tags { tag }` with `credentials: 'include'`
- Chip × button: calls `DELETE /coach/clients/:id/tags/:tagId` immediately
- Chip style: `bg-primary/10 text-primary border-primary/20`

### ClientNotesPanel.tsx
`'use client'` component:
- `isDirty = content !== savedContent` — save button renders only when dirty
- `PUT /coach/clients/:id/notes { content }` with `credentials: 'include'`
- Shows "Enregistré le..." timestamp after successful save
- Embeds `<ClientTagInput>` in "Tags (privés)" section above notes textarea

### layout.tsx updates
- Imports and renders `<ClientNotesPanel>` in sticky right panel (hidden on mobile, w-72 on lg+)
- Fetches `coach_client_notes` and `coach_client_tags` with `.eq('coach_id', user.id)` (coach — NOT client)
- Parallel fetch via `Promise.all` for notes + tags

### sessions/page.tsx updates
- Imports and renders `<ExecutiveSummaryCard summary={summary} />` above the data table
- Fetches `/coach/clients/${clientId}/summary` from Hono API with `Authorization: Bearer ${jwt}`
- Falls back to zero/null summary on fetch failure (graceful degradation)

## Security — Threat Model Compliance

| Threat | Mitigation Applied |
|--------|-------------------|
| T-26-06-01: Athlete reads coach_client_notes | coach_client_notes RLS only allows coach_id = auth.uid(); no athlete-read policy |
| T-26-06-02: Tag > 50 chars submitted | DB CHECK constraint in migration 041; client trims input before POST |
| T-26-06-03: Notes/tags fetched for wrong coach | layout.tsx uses `.eq('coach_id', user.id)` where user.id = authenticated coach |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `ExecutiveSummaryCard` summary data falls back to zeros/nulls if the `/coach/clients/:id/summary` Hono endpoint is not yet implemented. Plan 07 implements that backend endpoint.
- "Voir plus" button on sessions tab still not wired (inherited stub from Plan 05).

## Threat Flags

None — no new network endpoints or auth paths introduced beyond what the threat model specifies.

## Self-Check: PASSED

Files verified:
- apps/web/src/components/coach/ExecutiveSummaryCard.tsx — FOUND
- apps/web/src/components/coach/ClientTagInput.tsx — FOUND
- apps/web/src/components/coach/ClientNotesPanel.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx — FOUND (updated)
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx — FOUND (updated)

Commits verified: 15f5c50, f25ea53
