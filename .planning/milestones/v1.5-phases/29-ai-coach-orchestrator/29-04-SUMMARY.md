---
phase: 29-ai-coach-orchestrator
plan: "04"
subsystem: web-frontend
tags: [ai, coach, alerts, dashboard, programs, gsap, sidebar]
dependency_graph:
  requires:
    - 29-03 (CoachSidebar, NavItem, dashboard page patterns)
    - 29-01 (coach_alerts table, PATCH /coach/ai/alerts/:id/read, POST /coach/ai/alerts/read-all)
  provides:
    - apps/web/src/components/coach/AlertsPanel.tsx
    - apps/web/src/components/coach/AlertCard.tsx
    - apps/web/src/components/coach/AdaptWithAIButton.tsx
    - CoachSidebar unreadAlertCount badge (via layout server fetch)
    - /coach/dashboard AlertsPanel integration
    - /coach/programs AdaptWithAIButton on template cards
  affects:
    - apps/web/src/components/coach/NavItem.tsx (badgeCount prop added)
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx (unread count fetch)
tech_stack:
  added: []
  patterns:
    - Server Component server-side fetch (alerts, session) passed as initialProps to client components
    - GSAP entrance stagger (.alert-card), badge scale-in (back.out), collapse (power2.in)
    - Fire-and-forget fetch for alert read/read-all mutations
    - NavItem badgeCount prop — absolute-positioned count bubble over icon
    - Layout-level unread alert fetch for sidebar badge
key_files:
  created:
    - apps/web/src/components/coach/AlertCard.tsx
    - apps/web/src/components/coach/AlertsPanel.tsx
    - apps/web/src/components/coach/AdaptWithAIButton.tsx
  modified:
    - apps/web/src/components/coach/NavItem.tsx
    - apps/web/src/components/coach/CoachSidebar.tsx
    - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
    - apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx
    - apps/web/src/components/coach/ProgramCard.tsx
decisions:
  - "AlertsPanel receives initialAlerts as server-fetched prop — client state initialized from it, no extra client fetch needed"
  - "Sidebar badge fetched in layout.tsx server component (not dashboard page) so it appears on all coach routes"
  - "AdaptWithAIButton renders inside ProgramCard context menu for is_template=true — locale threaded from ProgramsClient"
  - "NavItem badgeCount renders count bubble (>0) or nothing — no dot-only variant; count is more informative (T-29-13 resolved: alert reads protected by RLS + authMiddleware on backend)"
metrics:
  duration: "13 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 6
---

# Phase 29 Plan 04: Alerts Panel + Dashboard Integration Summary

**One-liner:** AlertsPanel with GSAP dismiss/stagger animations wired to dashboard, orange sidebar badge via layout-level fetch, and "Adapter avec l'IA" button on template program cards.

## What Was Built

### Task 1: AlertCard + AlertsPanel + CoachSidebar + Dashboard

**`apps/web/src/components/coach/AlertCard.tsx`** (`'use client'`):
- Props: `alert: CoachAlert, onDismiss, apiUrl, accessToken`
- Inline `CoachAlert` interface (mirrors backend types.ts)
- Severity dot: 8px circle — `#EF4444` high / `#F59E0B` medium / `#EAB308` low
- Alert type labels: FR copy for all 4 types (`missed_sessions`, `sleep_drop`, `mood_decline`, `rpe_inflation`)
- "Ouvrir le chat →" link navigates to `/fr/coach/ai?client={client_id}`
- "Marquer lu" button: GSAP `opacity:0, height:0, marginBottom:0, 200ms power2.in` collapse, then calls `onDismiss` — also fires PATCH `/coach/ai/alerts/:id/read` fire-and-forget

**`apps/web/src/components/coach/AlertsPanel.tsx`** (`'use client'`):
- No-alerts state: green shield icon + "Tous vos clients sont dans de bonnes conditions."
- With-alerts state: header (title + unread badge), AlertCard list, overflow indicator (>3 alerts), footer ("Tout marquer comme lu" + "Voir dans l'IA Coach →")
- GSAP: panel entrance `y:16→0 opacity:0→1 200ms`, cards stagger `x:-8→0 0.07s`, badge `scale:0.5→1 back.out(1.7)`
- "Afficher tout" expand: GSAP `height:0→auto opacity:0→1 250ms power2.inOut`
- "Tout marquer comme lu": POST `/coach/ai/alerts/read-all` fire-and-forget, then clears local state

**`apps/web/src/components/coach/NavItem.tsx`** — updated:
- New optional `badgeCount?: number` prop
- When `badgeCount > 0`: renders `w-5 h-5 bg-primary text-white text-xs font-semibold rounded-full` count badge absolutely positioned over the nav icon

**`apps/web/src/components/coach/CoachSidebar.tsx`** — updated:
- New optional `unreadAlertCount?: number` prop
- Passes `badgeCount={unreadAlertCount}` to the 'IA' NavItem only
- All nav items keep `disabled: false` (was already set in Plan 03)

**`apps/web/src/app/[locale]/(coach)/coach/layout.tsx`** — updated:
- Server-side fetch of unread alert count: `coach_alerts WHERE coach_id = user.id AND is_read = false`
- Passes `unreadAlertCount` to `<CoachSidebar>` — badge visible on all coach routes (not just dashboard)

**`apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx`** — updated:
- Parallel fetch: `coach_profiles`, `auth.getSession()`, `coach_alerts` (unread, limit 10, descending)
- Renders `<AlertsPanel initialAlerts={alerts ?? []} coachId={user.id} accessToken={...} apiUrl={...} />` below `<WelcomeCard>`

### Task 2: AdaptWithAIButton + ProgramCard + ProgramsClient

**`apps/web/src/components/coach/AdaptWithAIButton.tsx`** (`'use client'`):
- Props: `programId, programName, locale, disabled?`
- Default state: `border-primary text-primary bg-transparent` outlined secondary button with `IoSparklesOutline` + "Adapter avec l'IA"
- Loading state (isNavigating): `IoRefreshOutline animate-spin` + "Ouverture..."
- GSAP press feedback: `scale:0.97 100ms power3.out yoyo:true repeat:1`
- Navigates to `/${locale}/coach/ai?template=${programId}`
- `disabled` prop shows tooltip "Liez d'abord un client pour adapter ce programme"

**`apps/web/src/components/coach/ProgramCard.tsx`** — updated:
- New props: `locale?: string` (default `'fr'`), `onAdaptWithAI?: (id, name) => void`
- Context menu: renders `<AdaptWithAIButton>` between "Dupliquer" and "Assigner" when `is_template === true`
- `is_template` now destructured from props (was unused before)

**`apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx`** — updated:
- `handleAdaptWithAI(id, name)`: `router.push(/${locale}/coach/ai?template=${id})`
- Passes `locale` and `onAdaptWithAI={handleAdaptWithAI}` to all own-program ProgramCards

## Commits

| Hash | Message |
|------|---------|
| a7f194a | feat(29-04): add AlertsPanel and AlertCard components |
| f12028f | feat(29-04): add AdaptWithAIButton + wire alerts into dashboard and sidebar badge |

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Sidebar badge fetched in layout, not just dashboard page**
- **Found during:** Task 1 — plan noted "simplest: badge only visible on dashboard load"
- **Issue:** Badge that only appears on /coach/dashboard would disappear on navigation to /coach/clients etc.
- **Fix:** Added unread count fetch to `coach/layout.tsx` server component — badge visible on all coach routes
- **Files modified:** `apps/web/src/app/[locale]/(coach)/coach/layout.tsx`

**2. [Rule 1 - Structural adjustment] AdaptWithAIButton rendered inside ProgramCard (not directly in ProgramsClient)**
- **Found during:** Task 2 — plan suggested rendering in ProgramsClient's grid, but the button logically belongs inside the card's context menu
- **Fix:** Import in ProgramCard, conditional render inside menu when `is_template=true`, `locale` threaded down. `ProgramsClient` retains `handleAdaptWithAI` for hook compatibility.

## Known Stubs

None — all components wire to real data:
- `AlertsPanel` receives server-fetched `initialAlerts` from `coach_alerts` table
- `AlertCard` dismissal calls real PATCH endpoint
- `AdaptWithAIButton` navigates to real `/coach/ai` route with template param

## Threat Flags

No new threat surface beyond plan's threat model. T-29-13 mitigation in place: PATCH `/coach/ai/alerts/:id/read` is protected by `authMiddleware` + RLS on `coach_alerts` (coach can only dismiss their own alerts). Frontend sends Bearer token on all mutation fetches.

## Self-Check: PASSED

**Files exist:**
- `apps/web/src/components/coach/AlertCard.tsx` — FOUND (contains "Ouvrir le chat")
- `apps/web/src/components/coach/AlertsPanel.tsx` — FOUND (contains "Tous vos clients sont dans de bonnes conditions")
- `apps/web/src/components/coach/AdaptWithAIButton.tsx` — FOUND (contains "border-primary", "Adapter avec l'IA", "IoSparklesOutline")
- `apps/web/src/components/coach/CoachSidebar.tsx` — FOUND (contains `disabled: false` for IA item, `unreadAlertCount` prop)
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — FOUND (contains "AlertsPanel")
- `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` — FOUND (contains "AdaptWithAIButton", "handleAdaptWithAI")

**Commits exist:**
- a7f194a — FOUND
- f12028f — FOUND

**TypeScript:** 0 errors in our files (1 pre-existing error in `safe-next.spec.ts` — unrelated)
