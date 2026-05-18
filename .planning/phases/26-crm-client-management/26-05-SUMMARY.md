---
phase: 26-crm-client-management
plan: "05"
subsystem: web-coach-crm
tags: [client-detail, tab-pages, rsc, rls, coach-read-only]
dependency_graph:
  requires: [26-03]
  provides: [client-detail-shell, 7-tab-pages, ClientDetailHeader, ClientTabStrip]
  affects: [26-06]
tech_stack:
  added: []
  patterns: [force-dynamic RSC, is_coach_of RLS via coach JWT, nested layout with tab strip]
key_files:
  created:
    - apps/web/src/components/coach/ClientDetailHeader.tsx
    - apps/web/src/components/coach/ClientTabStrip.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/measurements/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/page.tsx
  modified: []
decisions:
  - "RevokeClientButton extracted as 'use client' sub-component inside ClientDetailHeader.tsx (server-renderable outer, client sub)"
  - "RevokeConfirmModal open prop used (boolean) instead of conditional rendering — matches actual component API"
  - "Habits tab: two queries (habits + habit_logs last 30 days) with client-side completion rate computation"
  - "All tab pages include CRITICAL comment on .eq('user_id', clientId) vs user.id direction"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_created: 11
  files_modified: 0
---

# Phase 26 Plan 05: Client Detail Shell + 7 Tab Pages Summary

**One-liner:** Read-only client detail shell with nested layout, 7 force-dynamic Server Component tab pages querying Supabase via is_coach_of RLS, and ClientDetailHeader/ClientTabStrip components.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | ClientDetailHeader + ClientTabStrip | 2d8ebb2 | ClientDetailHeader.tsx, ClientTabStrip.tsx |
| 2 | Client detail layout + redirect + 7 tab pages | c589550 | layout.tsx, page.tsx, 7x [tab]/page.tsx |

## What Was Built

### ClientDetailHeader.tsx
Server-renderable outer component with:
- Avatar (32px circle, fallback initial letter)
- Client name (text-2xl font-bold text-text)
- "Vue lecture seule" badge (bg-primary/10 text-primary border-primary/20)
- `RevokeClientButton` 'use client' sub-component that opens `RevokeConfirmModal` with correct D-21 copy

### ClientTabStrip.tsx
'use client' component with:
- `usePathname()` for active tab detection via `pathname.endsWith('/[tab]')`
- `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` on all 7 tab links
- Active tab: `border-b-2 border-primary text-primary font-bold`
- Inactive: `border-transparent text-muted hover:text-text hover:border-border`

### [id]/page.tsx
Default redirect: `/[locale]/coach/clients/[id]` → `/[locale]/coach/clients/[id]/sessions`

### [id]/layout.tsx
- Fetches `user_profiles` with `.eq('id', id)` (client's UUID from URL param — NOT coach UUID)
- Redirects to `/coach/clients` if profile is null (is_coach_of RLS returns null for unlinked clients)
- Shell: ClientDetailHeader + ClientTabStrip + flex layout with `notes-panel-slot` placeholder div
- `force-dynamic` + `revalidate=0` as required by D-06

### 7 Tab Pages (all force-dynamic RSC)

| Tab | Table | Key columns | Order |
|-----|-------|-------------|-------|
| sessions | workout_sessions | name, created_at, duration_minutes | created_at DESC |
| measurements | body_measurements | weight_kg, body_fat_pct, waist_cm, chest_cm | created_at DESC |
| habits | habits + habit_logs | name, type, 30d completion rate | name ASC |
| nutrition | nutrition_logs | meal_type, food_name, calories, protein_g, carbs_g, fat_g | date DESC |
| sleep | sleep_logs | bedtime, wake_time, duration_hours, quality | date DESC |
| cardio | cardio_sessions | activity_type, duration_min, distance_km, calories | created_at DESC |
| journal | journal_entries | mood, energy, stress, context, notes | created_at DESC |

All tab pages:
- `export const dynamic = 'force-dynamic'` + `export const revalidate = 0`
- `.eq('user_id', clientId)` where `clientId` comes from URL `params.id` (NOT `user.id`)
- Last 30 rows with "Voir plus" button shown if count >= 30
- Empty state: "Aucune donnée disponible pour cette période."

## Security — Threat Model Compliance

| Threat | Mitigation Applied |
|--------|-------------------|
| T-26-05-01: Wrong user_id direction | All 7 tab pages use `.eq('user_id', clientId)` with explicit CRITICAL comments |
| T-26-05-02: force-dynamic omitted | All 9 files include `export const dynamic = 'force-dynamic'` |
| T-26-05-03: Unlinked client profile fetch | layout.tsx redirects to /clients when profile=null (is_coach_of RLS returns null) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - API correctness] RevokeConfirmModal uses `open` prop not conditional rendering**
- **Found during:** Task 1
- **Issue:** Plan template showed `{open && <RevokeConfirmModal ...>}` but actual component has `open: boolean` prop and returns `null` internally when `!open`
- **Fix:** Used `open={open}` prop directly — single `<RevokeConfirmModal open={open} ...>` render
- **Files modified:** ClientDetailHeader.tsx
- **Commit:** 2d8ebb2

## Known Stubs

- "Voir plus" button in all tab pages is not wired to client-side load-more logic (renders but onClick does nothing). Plan 06 or later will add pagination state.
- `notes-panel-slot` placeholder div in layout.tsx — Plan 06 will replace with `<ClientNotesPanel>`.
- TODO comment in sessions/page.tsx for `<ExecutiveSummaryCard clientId={clientId} />` — Plan 06.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All queries use existing is_coach_of RLS via established createServerSupabase() pattern.

## Self-Check: PASSED

Files verified:
- apps/web/src/components/coach/ClientDetailHeader.tsx — FOUND
- apps/web/src/components/coach/ClientTabStrip.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/measurements/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/page.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/page.tsx — FOUND

Commits verified: 2d8ebb2, c589550
