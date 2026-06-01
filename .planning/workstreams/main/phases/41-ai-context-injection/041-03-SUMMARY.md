---
phase: 41-ai-context-injection
plan: "03"
subsystem: apps/web/coach-dashboard
tags: [frontend, tanstack-query, sse, drawer, skeleton]
dependency_graph:
  requires:
    - 041-01 (InsightsResponse types in backend)
    - 041-02 (POST /api/coach/dashboards/:clientId/insights endpoint)
  provides:
    - useInsights hook (queryKey dashboard-insights)
    - NarrativeSummaryCard component
    - DashboardChatDrawer component
  affects:
    - apps/web/src/hooks/useInsights.ts
    - apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx
    - apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery with enabled dual guard
    - SSE buffer+reader loop (mirrored from EditChatPanel)
    - CSS translate-x slide-in drawer (no GSAP)
    - useRef for dashboard context (avoids stale closure)
key_files:
  created:
    - apps/web/src/hooks/useInsights.ts
    - apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx
    - apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx
  modified: []
decisions:
  - InsightsResult interface defined locally in useInsights.ts (Next.js cannot import from backend types directly)
  - ChatInputBar props adapted: onSend→onSubmit, no placeholder prop — matches existing ChatInputBar interface
  - inputValue state managed locally in DashboardChatDrawer (ChatInputBar requires controlled value/onChange)
metrics:
  duration: "~10 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  files_changed: 3
---

# Phase 41 Plan 03: Frontend Hooks & Components — useInsights, NarrativeSummaryCard, DashboardChatDrawer Summary

Three new frontend files delivering the core AI delivery units: TanStack Query hook for insights, narrative card component with skeleton loading, and SSE chat drawer with dashboard context injection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useInsights hook | 84d04a9 | apps/web/src/hooks/useInsights.ts |
| 2 | Create NarrativeSummaryCard component | 4fc97e9 | apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx |
| 3 | Create DashboardChatDrawer component | 1fbb8f5 | apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx |

## What Was Built

### useInsights (apps/web/src/hooks/useInsights.ts)

TanStack Query hook with `queryKey: ['dashboard-insights', clientId, sport, dateRange]`. `queryFn` calls `POST /api/coach/dashboards/${clientId}/insights` with body `{ sport, period: dateRange, chartData }`. Guard `enabled: !!sport && !!chartData` ensures the hook never fires on initial mount when the sport dashboard hasn't loaded yet. `staleTime: 120_000`, `gcTime: 300_000`. Local `InsightsResult` interface mirrors the backend `InsightsResponse` (avoids Next.js importing backend types directly) and includes the `crossedThresholds` array.

### NarrativeSummaryCard (apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx)

Returns `null` immediately when `sport` is falsy (D-09 silent fail). Card root uses `bg-white rounded-2xl border border-border p-6 mb-4 w-full` matching `ChartCard` anatomy exactly. Header row: brain emoji + `"Analyse IA — {sport}"` in `text-[15px] font-semibold text-text`. Loading state: 2-line `animate-pulse` skeleton. Loaded state: paragraph with `text-sm text-muted leading-relaxed max-w-prose` — fallback text when `narrative` is undefined.

### DashboardChatDrawer (apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx)

Slide-in panel with `transform transition-transform duration-200 ease-out`, `translate-x-0` (open) vs `translate-x-full` (closed) — no GSAP. `dashboardContextRef: React.MutableRefObject<DashboardContext | null>` prop; read at call time inside `streamChat` callback (`dashboardContextRef.current`) to avoid stale closure (RESEARCH.md Pitfall 3). SSE buffer+reader loop copied verbatim from EditChatPanel lines 162–224 with endpoint changed to `/api/coach/ai/chat/stream` and body extended with `dashboard_context`. `conversationIdRef` persists the conversation across turns. Backdrop uses `bg-black/20` (20% opacity). `aria-modal="true"`, `role="dialog"` for accessibility. Error state with inline retry button in primary orange.

## Deviations from Plan

### Auto-adapted: ChatInputBar props

**Found during:** Task 3 — reading ChatInputBar source
**Issue:** The plan spec calls for `onSend` and `placeholder` props on `ChatInputBar`, but the actual component interface is `{ value, onChange, onSubmit, disabled }` with no `placeholder` prop.
**Fix:** Used `value`/`onChange`/`onSubmit`/`disabled` as the actual interface requires. Added local `inputValue` state to DashboardChatDrawer (controlled pattern). This is functionally equivalent to the plan's intent.
**Files modified:** DashboardChatDrawer.tsx only

## Known Stubs

None — these are new components with no data source wired (wiring is Plan 05, Wave 3). The `useInsights` hook will return `undefined` data until the backend endpoint (Plan 02) is deployed. `NarrativeSummaryCard` renders the fallback string in that case. `DashboardChatDrawer` is functional standalone once mounted with valid props.

## Threat Flags

None — all trust boundaries per the plan's threat model are accepted (T-41-09, T-41-10, T-41-SC).

## Self-Check

- [x] apps/web/src/hooks/useInsights.ts exists — contains `export function useInsights(`, `enabled: !!sport && !!chartData`, `staleTime: 120_000`, POST to `/api/coach/dashboards/${clientId}/insights`
- [x] apps/web/src/components/coach/dashboard/NarrativeSummaryCard.tsx exists — contains `export function NarrativeSummaryCard(`, `return null`, `animate-pulse`, `bg-white rounded-2xl border border-border p-6`, `max-w-prose`
- [x] apps/web/src/components/coach/dashboard/DashboardChatDrawer.tsx exists — contains `export function DashboardChatDrawer(`, `dashboardContextRef`, `dashboard_context: dashboardContextRef.current`, `/api/coach/ai/chat/stream`, `translate-x-full`, `translate-x-0`, `transition-transform duration-200 ease-out`, `bg-black/20`, `aria-modal="true"`, `conversation_id: conversationIdRef.current`, no `gsap` import
- [x] Commits 84d04a9, 4fc97e9, 1fbb8f5 present in git log
- [x] TypeScript: 0 new errors (only pre-existing VocalReview.test.tsx TS2305 unrelated to this plan)

## Self-Check: PASSED
