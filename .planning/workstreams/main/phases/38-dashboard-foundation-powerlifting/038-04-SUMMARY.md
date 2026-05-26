---
plan: "038-04"
phase: 38
subsystem: "coach-web / dashboard"
status: complete
checkpoint: pending-human-verify
tags: ["recharts", "tanstack-query", "powerlifting", "dashboard", "animation"]
dependency_graph:
  requires: ["038-01", "038-02", "038-03"]
  provides: ["PowerliftingDashboard — live 4-chart view wired to Supabase"]
  affects: ["apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx"]
tech_stack:
  added: []
  patterns: ["useQuery with enabled guard", "ResponsiveContainer Recharts", "CSS stagger animation via animationDelay"]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx
decisions:
  - "Used `any` cast on Recharts Tooltip formatter to satisfy ValueType union (includes readonly arrays) — safe, no user HTML injection path"
  - "Added ResponsiveContainer around all 4 charts (height=220) for proper Recharts sizing in CSS grid"
  - "No key={dateRange} on grid div — animation fires on mount only, TanStack Query re-fetches in place on dateRange change (D-10 compliant)"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-26"
  tasks_completed: 1
  files_modified: 1
---

# Phase 38 Plan 04: PowerliftingDashboard — 4 charts, live data Summary

**One-liner:** PowerliftingDashboard wires useQuery to fetchPowerliftingData and renders 4 Recharts charts (LineChart SBD with 3 colored lines, LineChart RPE with red ReferenceLine at y=8, BarChart Tonnage with rounded bars, AreaChart Intensity with orange fill) in a staggered 2x2 grid.

## What was done

- Overwrote stub `PowerliftingDashboard.tsx` with full production implementation
- Wired `useQuery` with `queryKey: ['powerlifting', clientId, sport, dateRange]` and `enabled: sport === 'powerlifting'` guard (D-02 compliance)
- `supabase` instance created once outside component for stable reference across renders
- 4 Recharts charts in 2x2 grid via `grid-cols-2 gap-4`:
  1. **LineChart SBD** — 3 lines: Squat (#FF5C1A), Bench (#3B82F6), Deadlift (#22C55E), with Legend
  2. **LineChart RPE** — single line with `ReferenceLine y={8}` dashed red (#EF4444) "Seuil" label
  3. **BarChart Tonnage** — orange bars with `radius={[4,4,0,0]}` rounded tops
  4. **AreaChart Intensity** — orange area with `fillOpacity={0.08}`, YAxis domain [0,100] with % formatter
- Shared constants defined outside component: `SHARED_AXIS_PROPS`, `TOOLTIP_STYLE`, `CHART_MARGIN`
- All render states handled: `isLoading` → `DashboardLoadingState`, `error` → French error card, empty data → `DashboardEmptyState prompt={false}`
- Stagger animation: each card has `animate-[fadeInUp_200ms_ease-out_forwards]` with `animationDelay: ${i * 50}ms` — no `key` on grid div so animation fires on mount only
- TypeScript: 0 errors

## Artifacts

- `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` — overwritten from stub (216 lines)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recharts Tooltip formatter TypeScript error**
- **Found during:** Task 1 (type-check)
- **Issue:** `formatter={(v: number) => ...}` — Recharts `ValueType` includes `readonly (string | number)[]` making `number` too narrow
- **Fix:** Used `any` cast with eslint-disable comment — safe because Recharts renders via React virtual DOM with no HTML injection path
- **Files modified:** `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx`
- **Commit:** 368ece8

**2. [Rule 2 - Enhancement] Added ResponsiveContainer wrapping all 4 charts**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan specified chart JSX without ResponsiveContainer — Recharts charts require explicit dimensions or a ResponsiveContainer to render in CSS grid
- **Fix:** Wrapped each chart in `<ResponsiveContainer width="100%" height={220}>` for correct sizing
- **Files modified:** `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx`
- **Commit:** 368ece8

## Checkpoint

Human verification required — see plan 038-04 Task 2 for 11 manual checks:

1. Start: `cd apps/web && npm run dev`
2. Log in as coach, navigate to any client detail page
3. Confirm "Dashboard" tab is leftmost tab
4. Click "Dashboard" — verify DashboardControlBar renders with sport dropdown and date control
5. While sport is null — verify DashboardEmptyState renders
6. Select "Powerlifting" — verify 4 chart cards appear in 2x2 grid with stagger animation
7. If client has data: verify SBD shows orange/blue/green lines; RPE shows dashed red ReferenceLine at y=8; Tonnage shows orange bars; Intensity shows orange area
8. If no data: verify DashboardEmptyState with "Aucune donnée disponible"
9. Switch date ranges — charts re-render WITHOUT triggering mount animation again
10. `cd apps/web && npm run type-check` — must exit 0
11. `cd apps/web && npx vitest run src/lib/dashboard/powerlifting.test.ts` — all tests pass

## Self-Check: PASSED

- `apps/web/src/components/coach/dashboard/PowerliftingDashboard.tsx` — exists and contains full implementation
- Commit `368ece8` — verified in git log
- TypeScript: 0 errors confirmed
