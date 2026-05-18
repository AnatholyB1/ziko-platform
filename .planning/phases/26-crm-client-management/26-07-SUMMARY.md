---
phase: 26-crm-client-management
plan: "07"
subsystem: web-coach-crm
tags: [comparison-chart, recharts, client-compare, multi-client, force-dynamic]
dependency_graph:
  requires: [26-04, 26-05, 26-06]
  provides: [ComparisonChart, CompareControls, compare-page]
  affects: []
tech_stack:
  added: []
  patterns: [recharts-use-client, responsive-container-fixed-height, url-searchparams-navigation]
key_files:
  created:
    - apps/web/src/components/coach/ComparisonChart.tsx
    - apps/web/src/components/coach/CompareControls.tsx
    - apps/web/src/app/[locale]/(coach)/coach/clients/compare/page.tsx
  modified: []
decisions:
  - "ComparisonChart uses 'use client' + height={384} — avoids Recharts SSR crash (ResizeObserver undefined)"
  - "compare/page.tsx is force-dynamic RSC — CompareControls is a separate 'use client' component for metric/date selectors"
  - "UUID validation via regex + slice(0,5) prevents info disclosure of non-linked clients (T-26-07-01)"
  - "Metric validated against allowlist fallback to 'weight' (T-26-07-02)"
  - "Empty state (no data) renders inside same height={384} container — no layout shift"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-18"
  tasks_completed: 1
  files_created: 3
  files_modified: 0
---

# Phase 26 Plan 07: ComparisonChart + Compare Page Summary

**One-liner:** Recharts multi-client comparison chart with 'use client' LineChart/BarChart (height=384), force-dynamic RSC compare page with UUID validation and cache:no-store fetch, and useRouter-based CompareControls for metric/date navigation.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | ComparisonChart + CompareControls + compare/page.tsx | e0ef22a | ComparisonChart.tsx, CompareControls.tsx, compare/page.tsx |

## Task 2 Status

Task 2 is a `checkpoint:human-verify` (blocking gate). Execution paused — awaiting human verification of the chart rendering in-browser.

## What Was Built

### ComparisonChart.tsx

`'use client'` Recharts component:
- `LineChart` when `metric !== 'sessions'` (weight, sleep, mood — time-series)
- `BarChart` when `metric === 'sessions'` (aggregate — weekly count)
- `ResponsiveContainer` with `height={384}` (NOT "100%") and `aria-label` on each instance
- 5-slot color palette: `['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B']`
- Empty state: centered message in a 384px container when `data.length === 0`
- `connectNulls` on `<Line>` — gaps in data don't break the chart

### CompareControls.tsx

`'use client'` component:
- Native `<select>` for metric (Poids / Séances / Sommeil / Humeur)
- Date range chips (30j / 90j / 1an) as `role="tab"` buttons with `aria-selected`
- `useRouter().push()` for navigation — updates URL search params, triggers RSC re-render
- Active chip styled with `border-primary bg-primary/10 text-primary font-bold`

### compare/page.tsx

Server Component (RSC):
- `export const dynamic = 'force-dynamic'` + `export const revalidate = 0`
- Validates `ids` param: UUID regex filter + max 5 (T-26-07-01 info disclosure mitigation)
- Validates `metric` against allowlist `['weight','sessions','sleep','mood']`, falls back to `'weight'` (T-26-07-02)
- Validates `days` against `[30, 90, 365]`, falls back to `30`
- Redirects to `/coach/clients` when `clientIds.length < 2`
- Fetches `user_profiles` for client names (Supabase direct with coach JWT)
- Fetches comparison data via `fetch(${apiUrl}/coach/clients/compare?...)` with `cache: 'no-store'` and `Authorization: Bearer ${jwt}`
- Graceful degradation on fetch error (empty chart rendered)
- Renders client name chips with assigned palette colors
- Renders `<CompareControls>` (client) + `<ComparisonChart>` (client) within RSC shell

## Security — Threat Model Compliance

| Threat | Mitigation Applied |
|--------|-------------------|
| T-26-07-01: compare page leaks non-linked client data | UUID regex filter + max-5 slice on `ids` param; backend validates links via is_coach_of RLS |
| T-26-07-02: malformed metric string accepted | Allowlist validation with fallback to 'weight' in compare/page.tsx |
| T-26-07-03: Recharts SSR crash exposes stack trace | ComparisonChart.tsx has 'use client' — Recharts never runs on server |

## Deviations from Plan

None — plan executed exactly as written. All three files match the plan's action code exactly.

## Known Stubs

- The Hono `GET /coach/clients/compare` endpoint response is consumed by compare/page.tsx. If the endpoint returns empty data (or is not yet fully implemented), the chart gracefully shows the empty state. The backend endpoint was added in Plan 26-03.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan's threat model specifies.

## Self-Check: PASSED

Files verified:
- apps/web/src/components/coach/ComparisonChart.tsx — FOUND
- apps/web/src/components/coach/CompareControls.tsx — FOUND
- apps/web/src/app/[locale]/(coach)/coach/clients/compare/page.tsx — FOUND

Commits verified: e0ef22a
